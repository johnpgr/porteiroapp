# CallKeep Removal & Custom Full-Screen Call UI

**Branch:** `refactor/remove-callkeep`
**Status:** Planning
**Created:** 2025-01-07

---

## Executive Summary

Remove `react-native-callkeep` dependency and implement custom full-screen React Native UI for incoming calls. Direct control over call lifecycle eliminates race conditions between native and JS layers.

**Key Benefits:**
- Direct control - no native/JS bridge race conditions
- Simpler architecture - one state source (CallCoordinator + CallSession)
- Better UX - full-screen UI with custom branding
- Easier debugging - all logic in TypeScript

---

## Phase 1: Package & Config Cleanup

### Remove Packages
```bash
pnpm remove react-native-callkeep @config-plugins/react-native-callkeep
```

### Update `app.json`
**File:** `apps/expo/app.json`

1. **Remove** line 30: `"@config-plugins/react-native-callkeep"`
2. **Keep** Android permissions (required for full-screen intent):
   - `android.permission.USE_FULL_SCREEN_INTENT`
   - `android.permission.FOREGROUND_SERVICE`
   - `android.permission.WAKE_LOCK`
3. **Keep** iOS VoIP background mode (required for VoIP wake)
4. **Keep** `withVoipPush.js` plugin (needed for iOS PushKit)

### Delete Files
1. `services/CallKeepService.ts`
2. `services/AndroidForegroundService.ts`
3. `CALLKEEP_FIX_ANDROID.md`
4. `CALLKEEP_FOREGROUND_SERVICE_FLOW.md`

### Clean Notification Channels
**File:** `services/notificationHandler.ts`

- **Delete** lines 116-124: `intercom_call_keep` channel
- **Keep** `intercom_call` channel (needed for Android full-screen intent)

---

## Phase 2: CallSession Refactor

**File:** `services/calling/CallSession.ts`

### Remove CallKeep Dependencies

1. **Remove** `callKeepUUID` property entirely (use only `id`)
2. **Remove** import: `import { callKeepService } from '~/services/CallKeepService';`
3. **Remove** `callKeepUUID` from constructor parameter

### Simplify Methods

#### `answer()` (lines 161-244)
**Remove:**
- Line 176: `callKeepService.answerIncoming()`
- Line 236: `callKeepService.reportConnectedCall()`

**Keep:**
- Token fetching logic
- RTC channel join
- Ringtone stop

#### `end()` (lines 250-293)
**Remove:**
- Line 263: `callKeepService.endCall()`
- `setNativeState('idle')` calls

**Keep:**
- RTC leave
- Backend notification
- Storage clear

#### `decline()` (lines 298-333)
**Remove:**
- Line 303: `callKeepService.rejectCall()`
- `setNativeState('idle')` call

**Keep:**
- Backend notification
- Storage clear

### Remove Native State Management

**Delete:**
- `_nativeState` property
- `setNativeState()` method
- `isConsistent()` method
- `syncNativeState()` method

### Update Persistence

**`save()` method:**
- Remove `callKeepUUID` from `CallSessionData` interface
- Remove from serialization

**`load()` method:**
- Remove `callKeepUUID` from deserialization

---

## Phase 3: CallCoordinator Refactor

**File:** `services/calling/CallCoordinator.ts`

### Remove CallKeep Integration

1. **Remove** import: `import { callKeepService } from '~/services/CallKeepService';`

### Update Methods

#### `initialize()` (lines 46-64)
**Remove:**
- Lines 55-57: CallKeep event listener registrations

**Keep:**
- Session recovery logic

#### `handleIncomingPush()` (lines 94-206)
**Remove:**
- Lines 174-180: `callKeepService.displayIncomingCall()`

**Add:**
- Guard for concurrent calls:
```typescript
if (this.activeSession) {
  console.log('[CallCoordinator] Call already active, auto-declining');
  await this.declineCall(data.callId, 'busy');
  return;
}
```

**Flow after removal:**
- Creates session
- Emits `sessionCreated` event
- UI layer listens and displays full-screen component

#### Replace `handleAnswer()` with public `answerActiveCall()`
**Old (private):**
```typescript
private async handleAnswer(callUUID: string): Promise<void>
```

**New (public):**
```typescript
async answerActiveCall(): Promise<void> {
  if (!this.activeSession) {
    Alert.alert('No active call');
    return;
  }
  await this.activeSession.answer();
}
```

**Remove:**
- All recovery logic (Cases 2 & 3)
- `callUUID` parameter

#### Replace `handleEnd()` with public `endActiveCall()`
**Old (private):**
```typescript
private async handleEnd(callUUID: string): Promise<void>
```

**New (public):**
```typescript
async endActiveCall(reason: 'decline' | 'hangup' = 'hangup'): Promise<void> {
  if (!this.activeSession) return;

  if (reason === 'decline') {
    await this.activeSession.decline();
  } else {
    await this.activeSession.end(reason);
  }

  this.activeSession = null;
}
```

**Remove:**
- All recovery logic
- `callUUID` parameter

#### Delete `handleMute()`
**Remove entirely** - UI handles via `useAgora.toggleMute()`

---

## Phase 4: Convert IncomingCallModal → FullScreenCallUI

**File:** `components/IncomingCallModal.tsx` (edit in-place, then rename)

### Layout Changes

1. **Replace** `<Modal>` wrapper with `<View>`:
```tsx
// Before
<Modal visible={isVisible} transparent animationType="slide">
  <View style={styles.overlay}>
    {/* content */}
  </View>
</Modal>

// After
<View style={styles.overlay}>
  {/* content */}
</View>
```

2. **Update** `overlay` style:
```tsx
overlay: {
  position: 'absolute',  // ADD
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,          // ADD
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  justifyContent: 'center',
  alignItems: 'center',
}
```

### Update Props

```tsx
interface FullScreenCallUIProps {
  session: CallSession;          // Direct session object
  onAnswer: () => void;           // Callback to coordinator
  onDecline: () => void;          // Callback to coordinator
}
```

**Remove:**
- `visible` prop (determined by parent state)
- `onClose` prop (handled by state change)
- `agoraContext` prop (use session directly)

### Add Ringtone Management

```tsx
useEffect(() => {
  // Play ringtone when component mounts
  agoraAudioService.playIntercomRingtone();

  // Stop ringtone when component unmounts
  return () => {
    agoraAudioService.stopIntercomRingtone();
  };
}, []);
```

### Update Button Handlers

```tsx
const handleAnswer = () => {
  agoraAudioService.stopIntercomRingtone();  // Stop immediately
  onAnswer();                                // Trigger coordinator
  // Keep UI open - transitions to in-call controls
};

const handleDecline = () => {
  agoraAudioService.stopIntercomRingtone();  // Stop immediately
  onDecline();                               // Trigger coordinator
  // UI closes via state change
};
```

### Display Data from Session

```tsx
<Text style={styles.infoText}>
  {session.callerName || 'Porteiro'}
</Text>
<Text style={styles.infoSubText}>
  {session.apartmentNumber ? `Apt ${session.apartmentNumber}` : 'Chamada de Interfone'}
</Text>
<Text style={styles.statusText}>
  {session.state === 'ringing' && 'Recebendo...'}
  {session.state === 'connecting' && 'Conectando...'}
  {session.state === 'connected' && 'Conectado'}
</Text>
```

### Answer UX: Immediate Transition

Show in-call controls immediately after answer button pressed (no waiting for RTC connection):

```tsx
const showActiveCall = session.state !== 'ringing' && session.state !== 'rtm_ready';

{showActiveCall ? (
  // In-call controls (mute, speaker, end)
  <View style={styles.controlsContainer}>
    {/* Controls */}
  </View>
) : (
  // Incoming call buttons (answer, decline)
  <View style={styles.actionsContainer}>
    {/* Buttons */}
  </View>
)}
```

### Rename File

After changes complete, rename:
```
components/IncomingCallModal.tsx → components/FullScreenCallUI.tsx
```

---

## Phase 5: Wire to _layout.tsx

**File:** `app/_layout.tsx`

### Add Imports

```tsx
import { callCoordinator } from '~/services/calling/CallCoordinator';
import type { CallSession } from '~/services/calling/CallSession';
import { FullScreenCallUI } from '~/components/FullScreenCallUI';
```

### Add State

Add after line ~281:
```tsx
const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
```

### Initialize Coordinator

In existing `prepare()` useEffect (around line 286):
```tsx
// After initializing notification handler
callCoordinator.initialize();
```

### Subscribe to Events

New useEffect:
```tsx
useEffect(() => {
  const unsubscribers = [
    callCoordinator.on('sessionCreated', ({ session }) => {
      console.log('[_layout] Incoming call session created');
      setIncomingCall(session);
    }),
    callCoordinator.on('sessionEnded', () => {
      console.log('[_layout] Call session ended');
      setIncomingCall(null);
    })
  ];

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}, []);
```

### Render Overlay

Before closing `</SafeAreaProvider>` (around line 412):
```tsx
{incomingCall && (
  <FullScreenCallUI
    session={incomingCall}
    onAnswer={() => {
      console.log('[_layout] User tapped Answer');
      callCoordinator.answerActiveCall();
    }}
    onDecline={() => {
      console.log('[_layout] User tapped Decline');
      callCoordinator.endActiveCall('decline');
    }}
  />
)}
```

---

## Phase 6: Update Notification Handlers

**File:** `app/_layout.tsx` (lines 328-366)

### Answer Action (lines 341-349)

**Remove:**
```tsx
await AsyncStorage.setItem('@pending_intercom_call', JSON.stringify(callData));
router.push('/morador/(tabs)');
```

**Replace with:**
```tsx
if (actionId === 'ANSWER_CALL' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
  console.log('[Notification] User tapped Answer from notification');

  // Coordinator handles answer logic
  await callCoordinator.answerActiveCall();

  // Navigate to home (UI will appear via state subscription)
  router.push('/morador/(tabs)');
  return;
}
```

### Decline Action (lines 350-366)

**Remove:**
```tsx
try {
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  await fetch(`${apiUrl}/api/calls/${callData.callId}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'declined' }),
  });
} catch (error) {
  console.error('Failed to decline call:', error);
}
```

**Replace with:**
```tsx
else if (actionId === 'DECLINE_CALL') {
  console.log('[Notification] User declined call from notification');

  // Coordinator handles decline logic + API call
  await callCoordinator.endActiveCall('decline');
  return;
}
```

### Default Tap (notification body)

When user taps notification body (not action button):
```tsx
// Default action - open app
console.log('[Notification] User tapped notification body');
router.push('/morador/(tabs)');
// Full-screen UI will appear via state subscription if call still active
```

---

## Phase 7: Multi-Call Guard

**File:** `services/calling/CallCoordinator.ts`

Add guard at start of `handleIncomingPush()` (line ~98):

```typescript
// Check if we already have this call
if (this.activeSession?.id === data.callId) {
  console.log('[CallCoordinator] Call already exists, ignoring duplicate push');
  return;
}

// Auto-decline if already in a call (one call at a time)
if (this.activeSession) {
  console.log('[CallCoordinator] Already in call, auto-declining new call');
  await this.declineCall(data.callId, 'busy');
  return;
}
```

---

## Phase 8: VoIP Push Integration (iOS)

### Files to Verify

1. **`plugins/withVoipPush.js`** - Ensure native AppDelegate modification works
2. **`utils/voipPushNotifications.ts`** - Update to call `callCoordinator.handleIncomingPush()`

### Update VoIP Handler

**File:** `utils/voipPushNotifications.ts`

**Remove:**
```typescript
// Old: Direct CallKeep call
await callKeepService.displayIncomingCall(
  callId,
  callerName,
  apartmentNumber,
  false
);
```

**Replace with:**
```typescript
// New: Delegate to coordinator
await callCoordinator.handleIncomingPush({
  callId,
  from: data.from,
  callerName: data.fromName,
  apartmentNumber: data.apartmentNumber,
  buildingName: data.buildingName,
  channelName: data.channelName,
  timestamp: data.timestamp
});
```

### Test VoIP Wake

**Critical test:** iOS app killed → VoIP push arrives → App wakes → Full-screen UI appears

**Expected flow:**
1. iOS receives VoIP push
2. Native AppDelegate wakes app
3. `voipPushNotifications.ts` receives payload
4. Calls `callCoordinator.handleIncomingPush()`
5. Coordinator creates session, emits event
6. `_layout.tsx` sets state
7. `<FullScreenCallUI>` renders
8. User sees call screen

---

## Phase 9: Testing Checklist

### Android Tests

- [ ] **Foreground:** App open → Call arrives → Full-screen UI appears
- [ ] **Background:** App backgrounded → Call arrives → Full-screen UI appears
- [ ] **Killed:** App killed → Push arrives → Full-screen intent shows UI
- [ ] **Answer from notification action:** Works correctly
- [ ] **Answer from full-screen UI:** Works correctly
- [ ] **Decline from notification action:** Works correctly
- [ ] **Decline from full-screen UI:** Works correctly
- [ ] **Ringtone:** Plays when UI appears, stops on answer/decline
- [ ] **In-call controls:** Mute, speaker, end buttons work
- [ ] **Second call:** Auto-rejected with "busy" message

### iOS Tests

- [ ] **Foreground:** App open → Call arrives → Full-screen UI appears
- [ ] **Background:** App backgrounded → VoIP push → Full-screen UI appears
- [ ] **Killed:** App killed → VoIP push wakes app → Full-screen UI appears
- [ ] **Answer from notification action:** Works correctly
- [ ] **Answer from full-screen UI:** Works correctly
- [ ] **Decline actions:** Work correctly
- [ ] **Ringtone:** Plays and stops correctly
- [ ] **In-call controls:** All buttons functional
- [ ] **Second call:** Auto-rejected

### State & Performance Tests

- [ ] **RTM warmup:** Connects before UI shows (3s timeout)
- [ ] **Session persistence:** Survives app crash/restart
- [ ] **State consistency:** CallSession state always accurate
- [ ] **Memory:** No leaks from event listeners
- [ ] **Logs:** Clean, no CallKeep references

---

## Phase 10: Documentation

### Update CHANGELOG.md

Add concise entry:
```markdown
## [Version] - 2025-01-07

### Changed
- Removed CallKeep dependency
- Implemented custom full-screen call UI
- Direct control over call lifecycle (eliminates race conditions)
- Auto-reject concurrent calls (one call at a time)
```

### Update PLAN.md

Mark this section as completed, update status to "✅ Complete"

### Remove References

Search codebase for remaining CallKeep references:
```bash
grep -r "CallKeep" apps/expo/
grep -r "callKeep" apps/expo/
```

Delete or update any lingering references.

---

## Unresolved Questions

### iOS Background Behavior
**Q:** Without CallKeep on iOS, will VoIP push + high-priority notification reliably wake app from killed state?
**A:** VoIP push (PushKit) is the reliable wake mechanism. High-priority notification is supplementary. VoIP push will wake the app.

### RTM Warmup Edge Cases
**Q:** What if RTM warmup exceeds background time limit on iOS?
**A:** Test first. If timeout occurs, show UI anyway and fail gracefully if RTM not ready. User sees error message.

### Session Recovery
**Q:** After app crash during active call, how to resume?
**A:** `CallCoordinator.recoverPersistedSession()` runs on init. Checks if call still active via API, restores session if valid.

### Migration Path
**Q:** What happens if user updates app mid-call?
**A:** Call will drop (expected during app update). Next call uses new system. No migration needed.

---

## Success Criteria

✅ No CallKeep code remains in codebase
✅ Full-screen UI appears for all incoming calls
✅ Answer/Decline work from both UI and notification
✅ Ringtone plays and stops correctly
✅ iOS VoIP wake works from killed state
✅ Android full-screen intent works from killed state
✅ Concurrent calls auto-rejected
✅ State always consistent (no race conditions)
✅ All tests pass
✅ Documentation updated

---

**Plan Created:** 2025-01-07
**Status:** Ready for Implementation
**Estimated Time:** 2-3 days (8-12 hours)
