# CallKeep Android Fix - Full Screen Incoming Call UI

## Problem
CallKeep UI was not showing on Android - neither the full-screen call interface nor even the notification with Answer/Decline buttons. Only seeing push notifications.

## Root Causes Identified

### 1. **Missing Critical Android Permissions** ❌
The `AndroidManifest.xml` was missing essential permissions required for full-screen incoming call UI on Android 10+:
- `USE_FULL_SCREEN_INTENT` - **Critical for showing full-screen call UI**
- `FOREGROUND_SERVICE` - Required to keep app alive during calls
- `CALL_PHONE` & `READ_PHONE_STATE` - CallKeep requirements
- `WAKE_LOCK` - To wake device when call arrives

### 2. **Missing Notification Channels** ❌
CallKeep requires specific notification channels to exist BEFORE it can display incoming calls:
- `intercom-call-keep` channel (for CallKeep's foreground service) - **MISSING**
- `call` channel (for AndroidForegroundService) - **MISSING**

Without these channels, Android silently fails to show any CallKeep notifications.

### 3. **Disabled CallKeep Foreground Service Config** ❌
The foregroundService configuration in CallKeepService was commented out, preventing proper integration with Android's connection service.

## Fixes Applied

### Fix 1: Added Required Permissions to app.json (Expo Config)

**IMPORTANT:** We configure permissions via `app.json` because the `android/` directory is ephemeral and regenerated on each build.

Added to `android.permissions` array in `app.json`:

```json
"permissions": [
  // ... existing permissions ...
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.CALL_PHONE",
  "android.permission.READ_PHONE_STATE"
]
```

**Location:** `apps/expo/app.json`

**Why this way:** The `android/` folder is .gitignored and rebuilt by Expo on each build. Any manual changes to `AndroidManifest.xml` would be lost. Expo's config system ensures permissions persist across builds.

### Fix 2: Created Missing Notification Channels (snake_case naming)

Added to `notificationHandler.ts`:

```typescript
// CallKeep foreground service channel (CRITICAL - required for CallKeep to work)
await Notifications.setNotificationChannelAsync('intercom_call_keep', {
  name: 'Chamadas Ativas (CallKeep)',
  importance: Notifications.AndroidImportance.MAX,
  sound: 'telephone_toque_interfone.mp3',
  enableVibrate: true,
  enableLights: true,
  showBadge: true,
  description: 'Canal para gerenciar chamadas de interfone ativas',
});

// Call channel (for AndroidForegroundService)
await Notifications.setNotificationChannelAsync('call', {
  name: 'Chamadas em Progresso',
  importance: Notifications.AndroidImportance.HIGH,
  sound: null, // No sound - CallKeep handles ringtone
  enableVibrate: false,
  showBadge: true,
  description: 'Mantém o app ativo durante chamadas',
});
```

### Fix 3: Added Notification Categories for Action Buttons

```typescript
await Notifications.setNotificationCategoryAsync('call', [
  {
    identifier: 'ANSWER_CALL',
    buttonTitle: 'Atender',
    options: {
      opensAppToForeground: true,
    },
  },
  {
    identifier: 'DECLINE_CALL',
    buttonTitle: 'Recusar',
    options: {
      opensAppToForeground: false,
      isDestructive: true,
    },
  },
]);
```

**Location:** `apps/expo/services/notificationHandler.ts`

### Fix 4: Enabled CallKeep Foreground Service Config

Uncommented and configured in CallKeepService:

```typescript
android: {
  // ...
  foregroundService: {
    channelId: 'intercom_call_keep',
    channelName: 'Intercom Calls',
    notificationTitle: 'Intercom call in progress',
    notificationIcon: 'logo'
  }
}
```

**Location:** `apps/expo/services/CallKeepService.ts`

### Fix 5: Optimized AndroidForegroundService Notification

Removed conflicting sound/vibration since CallKeep handles those:

```typescript
// No sound - CallKeep handles ringtone
// No vibration - CallKeep handles haptics
```

**Location:** `apps/expo/services/AndroidForegroundService.ts`

## Architecture Overview

### Call Flow Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PUSH NOTIFICATION (Wake Up App)                              │
│    Backend → FCM → Device                                        │
│    ┌─────────────────────────────────┐                          │
│    │ 🔔 Chamada do Porteiro          │  ← "Chamada do {name}"  │
│    │ Apartamento 101                  │  ← User sees this first │
│    └─────────────────────────────────┘                          │
│                    ↓                                             │
│    App wakes up via backgroundNotificationTask                  │
│    Extracts: type: 'intercom_call', callId, callerName, etc.   │
│                    ↓                                             │
│ ───────────────────────────────────────────────────────────────│
│ 2. FOREGROUND SERVICE STARTS                                     │
│    AndroidForegroundService.start()                              │
│    Creates persistent notification to keep app alive            │
│    ┌─────────────────────────────────┐                          │
│    │ 🔔 Incoming call from Porteiro  │  ← Silent notification   │
│    │ 101                              │     (no sound/vibration) │
│    │ [PERSISTENT - CAN'T SWIPE AWAY] │                          │
│    └─────────────────────────────────┘                          │
│                    ↓                                             │
│ ───────────────────────────────────────────────────────────────│
│ 3. CALLKEEP NATIVE UI DISPLAYS                                   │
│    callKeepService.displayIncomingCall()                         │
│    ┌──────────────────────────────────┐                         │
│    │   📞 FULL-SCREEN NATIVE UI       │  ← Full-screen         │
│    │   Porteiro                        │     Android call       │
│    │   101                             │     interface          │
│    │                                   │                        │
│    │   [🟢 Answer]  [🔴 Decline]      │  ← Native buttons      │
│    └──────────────────────────────────┘                         │
│                    ↓                                             │
│    User interacts with native UI                                │
│    - Ringtone plays                                             │
│    - Vibration works                                            │
│    - Can answer/decline                                         │
│                    ↓                                             │
│    Call active or ended                                         │
│    ↓                                                             │
│    foregroundService.stop() → Notification dismissed            │
└─────────────────────────────────────────────────────────────────┘
```

### Why Three "Notifications"?

1. **Initial Push Notification** ("Chamada do Porteiro")
   - Purpose: Wake app from background/killed state
   - Visible: Briefly (1-2 seconds)
   - Source: Backend via FCM/Expo Push
   - Channel: `intercom_call`

2. **Foreground Service Notification** ("Incoming call from...")
   - Purpose: Keep Android from killing app during active call
   - Visible: Entire call duration (in notification tray)
   - Source: AndroidForegroundService
   - Channel: `call`
   - Silent: No sound/vibration

3. **CallKeep Native UI** (Full-screen interface)
   - Purpose: Native Android call interface with Answer/Decline
   - Visible: Full-screen takeover
   - Source: RNCallKeep native module
   - Channel: `intercom_call_keep` (for foreground service)
   - Active: Plays ringtone, handles vibration

## Required Actions

### 1. Rebuild the Android App ⚠️

The `app.json` permission changes **require a native rebuild**. Expo will automatically generate the correct `AndroidManifest.xml` with all the necessary permissions:

```bash
cd apps/expo

# Clean build
rm -rf android/build android/app/build

# Rebuild
npx expo run:android
# OR
eas build --platform android --profile development
```

### 2. Grant New Permissions on First Launch

Users will be prompted for new permissions:
- ✅ Phone access (READ_PHONE_STATE, CALL_PHONE)
- ✅ Full screen intent permission (USE_FULL_SCREEN_INTENT)
- ✅ Notification permissions

**IMPORTANT:** Users MUST grant these permissions for CallKeep to work!

### 3. Test Incoming Call Flow

After rebuilding:

1. Log in as morador (resident)
2. Ensure notifications are enabled
3. Trigger an incoming intercom call from porteiro
4. **Expected behavior:**
   - ✅ Full-screen CallKeep UI appears
   - ✅ Native Android call interface
   - ✅ Answer/Decline buttons work
   - ✅ Ringtone plays
   - ✅ Small notification in tray (foreground service indicator)

## Initialization Order (Critical)

The app initialization sequence ensures proper setup:

```
1. App Launch
   ↓
2. initializeNotificationHandler() 
   - Sets up channels: intercom_call, intercom-call-keep, call, etc.
   - Configures notification categories (Answer/Decline actions)
   ↓
3. registerBackgroundNotificationTask()
   - Registers handler for background push notifications
   ↓
4. User Logs In (as morador)
   ↓
5. MoradorLayout mounts
   ↓
6. callKeepService.initialize()
   - Now channels exist, so CallKeep can use them
   ↓
7. Incoming Call Flow Works ✅
```

**Location:** `apps/expo/app/_layout.tsx` (lines 28-42)

## Verification Checklist

After rebuild, verify:

- [ ] App successfully builds without errors
- [ ] User is prompted for phone permissions on first launch
- [ ] Notification channels visible in Android Settings → App Info → Notifications
  - [ ] "Chamadas Ativas (CallKeep)" channel exists
  - [ ] "Chamadas em Progresso" channel exists
  - [ ] "Interfone (Chamada)" channel exists
- [ ] Incoming call triggers full-screen CallKeep UI
- [ ] Answer button works
- [ ] Decline button works
- [ ] Ringtone plays during incoming call
- [ ] Foreground service notification appears in tray during call
- [ ] All notifications dismissed after call ends

## Common Issues & Troubleshooting

### Issue: "CallKeep permissions not granted"
**Solution:** Go to Android Settings → Apps → Porteiro App → Permissions → Enable Phone permissions

### Issue: "Full screen intent not working"
**Solution:** Android 12+ requires explicit permission. Go to Settings → Apps → Special app access → Display over other apps → Enable for Porteiro App

### Issue: "No notification channels found"
**Solution:** Uninstall and reinstall the app to trigger fresh notification channel creation

### Issue: "I manually edited AndroidManifest.xml but changes are gone"
**Solution:** The `android/` folder is ephemeral and regenerated by Expo. All Android configuration must be done via:
- `app.json` for permissions and basic config
- Config plugins (in `plugins/` directory) for advanced native modifications
- Never edit files in `android/` directly - they will be overwritten

### Issue: "Still only seeing push notification, no CallKeep UI"
**Debug steps:**
1. Check logcat for `[CallKeep]` logs
2. Verify `displayIncomingCall()` is being called
3. Check if `hasPermissions` returns true
4. Verify notification channels exist in Android Settings

### Issue: "App crashes on incoming call"
**Solution:** Check for conflicting notification handlers. Only one `setNotificationHandler()` call should exist (in notificationHandler.ts)

## Files Modified

- `apps/expo/app.json` - Added Android permissions (USE_FULL_SCREEN_INTENT, CALL_PHONE, READ_PHONE_STATE)
- `apps/expo/services/notificationHandler.ts` - Added notification channels and categories
- `apps/expo/services/CallKeepService.ts` - Enabled foregroundService config
- `apps/expo/services/AndroidForegroundService.ts` - Removed conflicting sound/vibration

**Note:** The `android/` directory is NOT modified directly as it's ephemeral and regenerated by Expo on each build. All Android configuration is done through `app.json` and config plugins.

## References

- [CallKeep Documentation](https://github.com/react-native-webrtc/react-native-callkeep)
- [Android Full-Screen Intent](https://developer.android.com/develop/ui/views/notifications/time-sensitive)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

---

**Last Updated:** 2025-11-06
**Status:** ✅ Ready for Testing (after rebuild)

