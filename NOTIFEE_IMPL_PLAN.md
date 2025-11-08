# Notifee Implementation Plan (Refined)

**Last Updated:** 2025-11-08
**Status:** Ready for implementation

---

## Project Structure Notes

⚠️ **IMPORTANT:**
- **This is a pnpm workspace monorepo** - Use `pnpm` for all package operations
- **Mobile app package:** `@porteiroapp/porteiro-mobile` (located in `apps/expo/`)
- **Native directories gitignored:** `./android` and `./ios` are regenerated on each EAS build - DO NOT manually edit files in these directories
- **Native config changes:** Use Expo config plugins or `app.json` for Android/iOS modifications

---

## Current State Analysis

### ✅ Already Working
- **FullScreenCallUI** (`components/FullScreenCallUI.tsx`) - Complete with ringtone lifecycle management
- **CallCoordinator/CallSession** - Robust architecture with RTM warmup, session persistence, event emitter
- **iOS VoIP Setup** - PushKit configured, token registration working, delegates to callCoordinator
- **Audio Service** - Intercom ringtone methods implemented
- **Basic notification infrastructure** - expo-notifications channels configured

### ❌ Critical Issues Identified

#### 1. RACE CONDITION (`_layout.tsx:33-45`)
**Problem:** Module-level initialization runs BEFORE useEffect event subscription
```
Line 33-45: initNotificationHandler() + callCoordinator.initialize()  [FIRES FIRST]
Line 315-330: callCoordinator.on('sessionCreated', handler)            [SUBSCRIBES SECOND]
```
**Impact:** When app killed, `recoverPersistedSession()` emits `sessionCreated` before listener attached → UI doesn't show
**Fix:** Move initialization INTO useEffect AFTER event subscription

#### 2. BACKGROUND TASK INCOMPLETE (`backgroundNotificationTask.ts`)
**Problem:** Task only stores to AsyncStorage, doesn't create session
```typescript
// Current: Just stores data
await AsyncStorage.setItem('@pending_intercom_call', JSON.stringify(callData));

// Missing: Session creation
// await callCoordinator.handleIncomingPush(pushData);  // NOT CALLED
```
**Impact:** Session only created when app opens, not in background → delays UI display
**Fix:** Call `callCoordinator.handleIncomingPush()` in background task

#### 3. NO FULL-SCREEN WAKE (Android)
**Problem:** expo-notifications can't reliably wake killed app on Android
**Impact:** User may miss calls when app killed/locked
**Fix:** Use notifee with `fullScreenAction`

#### 4. SOUND DISABLED (`notificationHandler.ts:35`)
**Problem:** `shouldPlaySound: false` for intercom_call (comment references removed CallKeep)
**Impact:** No notification sound (relies on app being open for ringtone)
**Fix:** Keep disabled after migration (app plays ringtone, not notification)

---

## Implementation Plan

### Phase 1: Install & Configure Notifee Channels

**Files:** `apps/expo/services/notificationHandler.ts`, `apps/expo/package.json`

1. **Install notifee (from monorepo root):**
   ```bash
   pnpm --filter @porteiroapp/porteiro-mobile add @notifee/react-native
   ```

   **Note:** Must be Expo-compatible version. Notifee auto-configures via Expo config plugin.

2. **Rebuild app (triggers EAS prebuild):**
   ```bash
   pnpm --filter @porteiroapp/porteiro-mobile run prebuild:clean
   pnpm --filter @porteiroapp/porteiro-mobile run android
   ```

   Or use shorthand from root:
   ```bash
   pnpm start:android
   ```

   **Note:** This regenerates `./android` and `./ios` directories with notifee native code

3. **Add notifee channel creation:**
   - Import `notifee` and `AndroidImportance`
   - Create `setupNotifeeChannels()` function (call alongside existing expo channels)
   - Add HIGH importance `intercom_call` channel with vibration/sound
   - Add DEFAULT importance `call_in_progress` channel (silent, for active calls)
   - **Keep existing expo-notifications channels for non-call types** (visitor, delivery, emergency)

**Key Decision:** Hybrid approach - notifee for intercom calls, expo-notifications for other types

**Code changes:**
```typescript
import notifee, { AndroidImportance } from '@notifee/react-native';

async function setupNotifeeChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Critical channel for incoming calls
  await notifee.createChannel({
    id: 'intercom_call',
    name: 'Interfone (Chamada)',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'telephone_toque_interfone',
    lights: true,
  });

  // Silent channel for in-progress calls
  await notifee.createChannel({
    id: 'call_in_progress',
    name: 'Chamadas em Progresso',
    importance: AndroidImportance.DEFAULT,
    vibration: false,
  });
}

// Call in initializeNotificationHandler()
export async function initializeNotificationHandler() {
  setupNotificationHandler();
  await setupNotificationChannels(); // existing expo channels
  await setupNotifeeChannels();      // NEW
  startTokenListener();
}
```

---

### Phase 2: Refactor Background Task

**Files:** `apps/expo/services/backgroundNotificationTask.ts`

**Critical changes:**

1. **Import notifee**
   ```typescript
   import notifee, { AndroidImportance } from '@notifee/react-native';
   ```

2. **For `type === 'intercom_call'`:**
   - Display notifee notification with `fullScreenAction` (Android only)
   - Add native action buttons (Recusar/Atender)
   - **Call `callCoordinator.handleIncomingPush()` (CRITICAL - currently missing)**
   - Keep AsyncStorage backup as fallback

3. **For other notification types:**
   - Keep existing expo-notifications flow

4. **Keep expo notification response handler** for action buttons (`_layout.tsx:343-403`)

**Code changes:**
```typescript
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;

  const notification = data as Notifications.Notification;
  const pushData = notification?.request?.content?.data;

  if (pushData?.type === 'intercom_call') {
    try {
      // 1. Display full-screen notification (Android)
      if (Platform.OS === 'android') {
        await notifee.displayNotification({
          title: (pushData.callerName as string) || 'Chamada do Porteiro',
          body: pushData.apartmentNumber
            ? `Apt ${pushData.apartmentNumber}`
            : 'Chamada de interfone',
          android: {
            channelId: 'intercom_call',
            importance: AndroidImportance.HIGH,

            // THIS FORCES APP TO FOREGROUND FROM KILLED STATE
            fullScreenAction: {
              id: 'default',
            },

            // Native buttons for lock screen
            actions: [
              {
                title: 'Recusar',
                id: 'decline_call',
                pressAction: { id: 'decline_call' },
              },
              {
                title: 'Atender',
                id: 'answer_call',
                pressAction: { id: 'answer_call', launchActivity: 'default' },
              },
            ],

            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
          },
        });
      }

      // 2. CRITICAL: Create session in background (currently missing)
      await callCoordinator.handleIncomingPush(pushData as VoipPushData);

      // 3. Keep AsyncStorage backup as fallback
      const callData = {
        callId: pushData.callId,
        callerName: pushData.callerName,
        apartmentNumber: pushData.apartmentNumber,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('@pending_intercom_call', JSON.stringify(callData));

    } catch (e) {
      console.error('[Background Task] Failed:', e);
    }
  } else if (pushData?.type) {
    // Keep existing flow for visitor/delivery/emergency
    // ... existing code
  }
});
```

**Key Decision:** Keep 6s RTM timeout (not 3s mentioned in original plan)

---

### Phase 3: Fix Race Condition in _layout.tsx

**Files:** `apps/expo/app/_layout.tsx`

**Critical fix:** Move module-level initialization (lines 33-45) INTO useEffect AFTER event subscription

**Current (WRONG):**
```typescript
// Line 33-45: Module level - runs FIRST
initializeNotificationHandler();
registerBackgroundNotificationTask();
callCoordinator.initialize(); // Fires sessionCreated

// Line 315-330: useEffect - runs SECOND
useEffect(() => {
  callCoordinator.on('sessionCreated', handler); // Too late!
}, []);
```

**Fixed (CORRECT):**
```typescript
// Remove lines 33-45 entirely

useEffect(() => {
  // 1. Define handlers
  const onSessionCreated = ({ session, recovered }) => {
    if (!session.isOutgoing) {
      setIncomingCall(session);
    }
  };

  const onSessionEnded = () => {
    setIncomingCall(null);
  };

  // 2. Subscribe FIRST
  const unsubCreated = callCoordinator.on('sessionCreated', onSessionCreated);
  const unsubEnded = callCoordinator.on('sessionEnded', onSessionEnded);

  // 3. Initialize SECOND (guarantees listeners ready)
  initializeNotificationHandler();
  registerBackgroundNotificationTask();
  callCoordinator.initialize(); // Now sessionCreated will be caught

  // 4. Cleanup
  return () => {
    unsubCreated();
    unsubEnded();
  };
}, []); // Run once on mount
```

**Impact:** Ensures `recoverPersistedSession()` events caught even when app killed

**Keep existing:**
- FullScreenCallUI overlay rendering (lines 436-448)
- Notification response listener (lines 343-403) for expo action buttons

---

### Phase 4: Cleanup

**Files:** `apps/expo/services/notificationHandler.ts`

Minor cleanups:

1. **Remove CallKeep comment** (line 12) - outdated reference
2. **Keep `shouldPlaySound: false`** for intercom_call (line 35) - correct behavior (app plays ringtone via FullScreenCallUI, not notification)

---

### Phase 5: iOS Verification

**Status:** ✅ Already working - no changes needed

**Why it works:**
1. VoIP push configured (`plugins/withVoipPush.js`)
2. Token registration working (`utils/voipPushNotifications.ts`)
3. VoIP push delegates to `callCoordinator.handleIncomingPush()`
4. Phase 3 fix ensures `sessionCreated` event caught
5. FullScreenCallUI renders automatically

**Note:** iOS doesn't need notifee - PushKit provides the wake capability

---

## Testing Checklist

### Android
- [ ] App killed: FCM push → full-screen notification → app wakes → UI shows
- [ ] App background: Push → notification → UI shows
- [ ] App foreground: Push → UI shows immediately
- [ ] Lock screen: Native buttons (Atender/Recusar) work
- [ ] Ringtone plays/stops correctly
- [ ] Session persists across app restart
- [ ] RTM warmup completes before UI shown

### iOS
- [ ] App killed: VoIP push → app wakes → UI shows
- [ ] App background: VoIP push → UI shows
- [ ] App foreground: VoIP push → UI shows
- [ ] Ringtone plays/stops correctly
- [ ] Session persists across app restart

---

## Implementation Order

1. **Phase 1** - Install notifee, configure channels
   ```bash
   pnpm --filter @porteiroapp/porteiro-mobile add @notifee/react-native
   ```
2. **Phase 2** - Refactor background task (add callCoordinator call + fullScreenAction)
3. **Phase 3** - Fix race condition in _layout.tsx (MOST CRITICAL)
4. **Phase 4** - Cleanup comments
5. **Rebuild** - Prebuild + run Android
   ```bash
   pnpm --filter @porteiroapp/porteiro-mobile run prebuild:clean
   pnpm start:android
   ```
6. **Test** - Verify all scenarios above

---

## Configuration Decisions (Locked In)

Based on codebase analysis and user input:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Notification library** | Hybrid: notifee (calls) + expo-notifications (other) | Minimize changes, leverage notifee only where needed |
| **AsyncStorage backup** | Keep as fallback | Safety net if coordinator call fails |
| **RTM timeout** | Keep 6000ms | More reliable than 3000ms, current code uses 6s |
| **Action handlers** | Keep expo notification response listener | Existing flow works, notifee just wakes app |
| **Phase 4 (ringtone)** | Skip - already implemented | FullScreenCallUI already perfect |
| **expo-notifications handler** | Keep for non-call types | Still handles visitor/delivery/emergency |

---

## Files Modified Summary

**Package:** `@porteiroapp/porteiro-mobile` (apps/expo/)

1. `apps/expo/services/notificationHandler.ts` - Add notifee channels, remove comment
2. `apps/expo/services/backgroundNotificationTask.ts` - Add notifee display + coordinator call
3. `apps/expo/app/_layout.tsx` - Move init into useEffect after subscription
4. `apps/expo/package.json` - Add @notifee/react-native dependency (via pnpm)
5. `apps/expo/app.json` - May need to add notifee plugin config (if permission not auto-added)

**Native directories (regenerated, not edited manually):**
- `./android/` - Regenerated via `expo prebuild` (gitignored)
- `./ios/` - Regenerated via `expo prebuild` (gitignored)

**Lines of code changed:** ~50
**Risk level:** Medium (core initialization flow changes)
**Estimated time:** 2-3 hours

---

## Potential Issues & Mitigations

### Issue: USE_FULL_SCREEN_INTENT permission
**Symptom:** Full-screen notification doesn't wake app on Android 10+
**Mitigation:** Notifee should auto-add permission via its Expo config plugin during prebuild
**Verify:** Check `./android/app/src/main/AndroidManifest.xml` after prebuild (regenerated, not in git)
**Fallback:** If not added automatically, create/modify Expo config plugin in `app.json` or `plugins/` directory:
```json
{
  "plugins": [
    [
      "@notifee/react-native",
      {
        "mode": "eas"
      }
    ]
  ]
}
```
**Note:** DO NOT manually edit `./android` files - they're gitignored and regenerated on each build

### Issue: Race condition still occurs
**Symptom:** UI doesn't show on recovered session
**Debug:** Add logs before/after subscription and initialization
**Verify:** Check useEffect runs before `recoverPersistedSession()`

### Issue: notifee actions conflict with expo handlers
**Symptom:** Action buttons don't work
**Debug:** Check which listener catches the action
**Fix:** May need to migrate to `notifee.onBackgroundEvent()` (Phase 2 alternative)

### Issue: Sound plays twice
**Symptom:** Both notification and FullScreenCallUI play ringtone
**Fix:** Ensure `shouldPlaySound: false` in notification handler (already set)

---

## Success Criteria

✅ **Android killed app:** FCM push wakes app, full-screen UI shows within 2s, ringtone plays
✅ **iOS killed app:** VoIP push wakes app, UI shows within 2s, ringtone plays
✅ **Session recovery:** App restart after crash shows incoming call UI
✅ **Race condition eliminated:** Logs show event subscription before initialization
✅ **No regressions:** Existing visitor/delivery/emergency notifications still work

---

## EAS Build Considerations

**Important:** This project uses EAS Build with prebuild workflow

- `./android` and `./ios` directories are **gitignored**
- Native directories are **regenerated** on each build via `expo prebuild`
- Notifee's Expo config plugin auto-adds native code during prebuild
- All native configuration must be done via:
  - `app.json` / `app.config.js`
  - Expo config plugins (`.js` files in `plugins/` directory)
  - Package dependencies (notifee auto-configures)

**Workflow:**
1. Add dependency: `pnpm --filter @porteiroapp/porteiro-mobile add @notifee/react-native`
2. Local development: `pnpm run prebuild:clean` → regenerates android/ios
3. EAS build: Automatically runs prebuild on cloud
4. Verify: Check regenerated `./android/app/src/main/AndroidManifest.xml` for permissions

**DO NOT:**
- Manually edit files in `./android` or `./ios` (changes lost on next prebuild)
- Commit `./android` or `./ios` to git (already in .gitignore)

---

## References

- [Notifee Full-Screen Notifications](https://notifee.app/react-native/docs/android/behaviour#full-screen-notifications)
- [Notifee Expo Plugin](https://notifee.app/react-native/docs/installation#expo)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [Expo Prebuild](https://docs.expo.dev/workflow/prebuild/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [React Native VoIP Push](https://github.com/react-native-webrtc/react-native-voip-push-notification)
- [EAS Build](https://docs.expo.dev/build/introduction/)

---

**Next Steps:** Execute Phase 1 (install notifee, configure channels)
