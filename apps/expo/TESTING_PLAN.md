# Background Call Notification Testing Plan

## Prerequisites

### Environment Setup
1. **Build Development App**
   ```bash
   cd apps/expo
   npx eas build --profile development --platform android
   # or
   npx eas build --profile development --platform ios
   ```

2. **Install on Physical Device**
   - Testing MUST be on physical device (simulators don't support push notifications properly)
   - Install development build
   - Ensure device has stable internet connection

3. **Backend Setup**
   - Ensure interfone-api is running and accessible
   - Verify push notifications are enabled (PUSH_NOTIFICATIONS_ENABLED !== 'false')
   - Check Expo push token is registered in database

4. **Permissions**
   - Grant notification permissions when prompted
   - Grant microphone permissions
   - iOS: Verify Settings → Notifications → James Avisa shows "Allow Notifications"

---

## Test Scenarios

### Scenario 1: App Completely Killed (Primary Test)

**Goal**: Verify background TaskManager wakes app and displays native call UI when killed

**Steps**:
1. Login as morador (resident)
2. Force kill app completely:
   - iOS: Swipe up from app switcher
   - Android: Settings → Apps → James Avisa → Force Stop
3. Wait 10 seconds (ensure app fully terminated)
4. From another device/account, initiate intercom call to this resident's apartment
5. Watch for notification arrival on device

**Expected Results**:
- ✅ Native call UI appears within 3-5 seconds (iOS: CallKit, Android: ConnectionService)
- ✅ Caller name shows "Doorman" or doorman name
- ✅ Subtitle shows "Apt [number]"
- ✅ Ringtone plays (`telephone_toque_interfone.mp3`)
- ✅ Answer/Decline buttons work

**Answer Call Sub-test**:
1. Tap "Answer" on native call UI
2. App should open/wake

**Expected**:
- ✅ App opens to intercom call screen
- ✅ Call connects within 2-3 seconds
- ✅ Audio works bidirectionally
- ✅ Call controls (mute, speaker, end) work
- ✅ AsyncStorage cleared (`@pending_intercom_call` removed)

**Decline Call Sub-test**:
1. Tap "Decline" on native call UI

**Expected**:
- ✅ Native UI dismisses
- ✅ Backend receives decline signal
- ✅ Call status updates to 'declined'
- ✅ AsyncStorage cleared

**Logs to Check**:
```
[BackgroundTask] Received notification data
[BackgroundTask] ✅ Incoming intercom call detected!
[BackgroundTask] ✅ Stored call data to AsyncStorage
[BackgroundTask] ✅ Displayed native call UI via CallKeep
[useAgora] Checking for pending incoming call from background task
[useAgora] CallKeep: User answered call
```

---

### Scenario 2: App in Background (Suspended)

**Goal**: Verify notification handling when app backgrounded but not killed

**Steps**:
1. Login as morador
2. Press home button (app goes to background)
3. Wait 5 seconds
4. Initiate intercom call

**Expected Results**:
- ✅ Native call UI appears immediately
- ✅ OR notification banner shows with call info
- ✅ Tapping opens app with call screen ready
- ✅ Call can be answered successfully

**Logs to Check**:
```
[BackgroundTask] Received notification data
[Foreground] Notificação recebida (if app was in foreground recently)
```

---

### Scenario 3: App in Foreground (Active)

**Goal**: Verify RTM signal takes precedence over push notification

**Steps**:
1. Login as morador
2. Keep app open and active
3. Navigate to morador home screen
4. Initiate intercom call

**Expected Results**:
- ✅ In-app call modal appears immediately (via RTM, NOT push)
- ✅ No native call UI shown (RTM is faster)
- ✅ Call can be answered directly in app
- ✅ No TaskManager logs (RTM handles it)

**Logs to Check**:
```
[RTM] Received message type: INVITE
[useAgora] Incoming invite received
```

**NOT expected**:
```
[BackgroundTask] Received notification data  ❌ Should not appear
```

---

### Scenario 4: Call Timeout (Missed Call)

**Goal**: Verify cleanup when resident doesn't answer

**Steps**:
1. Kill app completely
2. Initiate intercom call
3. See native call UI appear
4. **DO NOT answer** - wait 60 seconds
5. Backend should timeout and end call

**Expected Results**:
- ✅ Native call UI dismisses automatically after backend timeout
- ✅ Call status in database: 'missed'
- ✅ AsyncStorage cleared
- ✅ When app opens, no stale call data

---

### Scenario 5: Multiple Calls (Race Condition)

**Goal**: Verify only one call shown at a time

**Steps**:
1. Kill app
2. Initiate call #1
3. Immediately initiate call #2 (within 2 seconds)
4. Observe behavior

**Expected Results**:
- ✅ Only ONE native call UI shown (first one wins)
- ✅ Second call either queued or rejected
- ✅ No app crashes
- ✅ No duplicate call screens

---

### Scenario 6: Doorman Ends Call Before Answer

**Goal**: Verify cleanup when doorman cancels

**Steps**:
1. Kill app
2. Initiate call (native UI shows)
3. Doorman ends call before resident answers
4. Backend updates call status to 'ended'

**Expected Results**:
- ✅ Native call UI dismisses
- ✅ AsyncStorage cleared
- ✅ If app opens, no stale call data

---

### Scenario 7: Network Issues During Call

**Goal**: Test offline/poor connectivity handling

**Steps**:
1. Kill app
2. Initiate call
3. Answer call
4. During call, disable WiFi/cellular briefly
5. Re-enable network

**Expected Results**:
- ✅ Call gracefully handles disconnection
- ✅ Reconnects when network returns (if within timeout)
- ✅ OR shows "Call ended" if timeout exceeded
- ✅ No app crash

---

### Scenario 8: User Denies Notification Permissions

**Goal**: Verify fallback when permissions denied

**Steps**:
1. Uninstall app
2. Reinstall and login
3. **Deny** notification permission when prompted
4. Kill app
5. Initiate call

**Expected Results**:
- ⚠️ No native call UI (can't wake app without permission)
- ℹ️ Call depends on RTM when app reopens
- ✅ App should show permission request prompt or warning

---

### Scenario 9: Expired Push Token

**Goal**: Test handling of invalid/expired Expo push token

**Steps**:
1. Login as morador
2. Manually corrupt push token in database:
   ```sql
   UPDATE users SET push_token = 'ExpoPushToken[INVALID]' WHERE id = 'user_id';
   ```
3. Kill app
4. Initiate call

**Expected Results**:
- ⚠️ Backend logs push error
- ℹ️ No notification received
- ✅ App doesn't crash when reopened
- ✅ RTM still works when app opens

**Backend Logs**:
```
❌ Expo push notification failed (400): Invalid push token
```

---

### Scenario 10: CallKeep Initialization Failure

**Goal**: Test fallback when CallKeep fails

**Steps**:
1. Simulate CallKeep failure (requires code modification for testing):
   ```typescript
   // In backgroundNotificationTask.ts line 76
   throw new Error('CallKeep test failure');
   ```
2. Kill app
3. Initiate call

**Expected Results**:
- ✅ Falls back to local notification
- ✅ Notification shows with call info
- ✅ Sound plays
- ✅ Tapping notification opens app

**Logs**:
```
[BackgroundTask] CallKeep failed, falling back to notification
[BackgroundTask] ✅ Scheduled local notification (fallback)
```

---

### Scenario 11: AsyncStorage Data Persistence

**Goal**: Verify pending call data survives app restart

**Steps**:
1. Kill app
2. Initiate call
3. See native call UI
4. Force kill app AGAIN (without answering)
5. Manually reopen app

**Expected Results**:
- ✅ If call is still active (< 60s old), app restores call screen
- ✅ If call expired (> 60s old), AsyncStorage cleared, no stale data

**Code Reference**: useAgora.ts:1147
```typescript
const age = Date.now() - (callData.timestamp || 0);
if (age < 60000) { // 60 seconds
  // Restore call
}
```

---

### Scenario 12: Rapid Answer from Native UI

**Goal**: Verify immediate answer without race conditions

**Steps**:
1. Kill app
2. Initiate call
3. **Immediately** tap Answer when native UI shows (< 1 second)

**Expected Results**:
- ✅ App opens quickly
- ✅ Call connects without errors
- ✅ No "call already ended" errors
- ✅ Audio works immediately

---

## Platform-Specific Tests

### iOS Only

**Test A: CallKit Integration**
1. Kill app, receive call
2. Verify CallKit UI matches iOS system style
3. Test answer from lock screen
4. Test answer from notification center
5. Verify call shows in recent calls list (Phone app)

**Test B: Background Modes**
1. Check Info.plist has `remote-notification` and `voip`
2. Verify `_contentAvailable: true` triggers background task
3. Test with Low Power Mode enabled

### Android Only

**Test A: ConnectionService Integration**
1. Kill app, receive call
2. Verify native call UI shows
3. Test answer from lock screen
4. Test with Doze mode (battery optimization)

**Test B: Battery Optimization**
1. Settings → Battery → App battery usage → James Avisa
2. Enable "Optimized" (restrictive mode)
3. Kill app, test call reception

**Test C: Notification Channels**
1. Settings → Apps → James Avisa → Notifications
2. Verify "intercom-call" channel exists
3. Test with channel disabled (should fall back or fail gracefully)

---

## Negative Testing

### Invalid Data Tests

1. **Missing callId**
   ```typescript
   // Backend sends notification without callId
   data: { type: 'intercom_call', channelName: 'test' }
   ```
   Expected: Graceful failure, no crash

2. **Malformed notification data**
   ```typescript
   data: { type: 'intercom_call', callId: null }
   ```
   Expected: Background task logs error, doesn't crash

3. **Wrong notification type**
   ```typescript
   data: { type: 'visitor_arrival', callId: '123' }
   ```
   Expected: Background task ignores, no call UI

### Stress Tests

1. **10 Consecutive Calls**
   - Initiate 10 calls back-to-back
   - Answer/decline each
   - Check for memory leaks
   - Verify AsyncStorage cleaned up

2. **Call While Previous Call Active**
   - Answer call #1
   - Receive call #2 during call #1
   - Expected: Call #2 rejected or queued

---

## Verification Checklist

After each test scenario, verify:

- [ ] No app crashes
- [ ] No memory leaks (check device memory usage)
- [ ] AsyncStorage cleaned (`@pending_intercom_call` removed after call ends)
- [ ] Backend call status updated correctly
- [ ] Logs show expected flow
- [ ] User experience smooth (< 3s from push to UI)

---

## Debugging Guide

### Enable Verbose Logging

1. **View logs during test**:
   ```bash
   # iOS
   npx react-native log-ios

   # Android
   npx react-native log-android

   # Or use Expo CLI
   npx expo start
   # Then press 'r' to reload
   ```

2. **Check AsyncStorage**:
   ```typescript
   // Add to useAgora.ts temporarily
   useEffect(() => {
     AsyncStorage.getItem('@pending_intercom_call').then(data => {
       console.log('PENDING CALL DATA:', data);
     });
   }, []);
   ```

3. **Monitor push delivery**:
   - Check Expo push notification tool: https://expo.dev/notifications
   - Verify push receipts and tickets

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Native UI doesn't show | Permissions denied | Check Settings → Notifications |
| Push not received | Token not registered | Check `users.push_token` in database |
| App doesn't open on answer | Deep linking issue | Check app.json scheme |
| Audio doesn't work | Microphone permission | Grant in Settings |
| Background task not running | Not registered at module level | Check app/_layout.tsx:29 |

---

## Success Criteria

✅ **All scenarios pass** with expected results
✅ **No crashes** in any test case
✅ **Performance**: Call UI shows within 3 seconds of push
✅ **Reliability**: 95%+ success rate over 20 test calls
✅ **Battery**: No significant battery drain (< 5% over 1 hour idle)
✅ **Memory**: No leaks after 10+ call cycles

---

## Test Log Template

```markdown
## Test Session: [Date/Time]
**Device**: [iPhone 14 / Samsung Galaxy S23 / etc.]
**OS**: [iOS 17.2 / Android 14 / etc.]
**App Version**: [2.0.6]
**Build**: [Development]

### Scenario 1: App Killed
- [ ] Native UI appeared: YES/NO
- [ ] Time to UI: ____ seconds
- [ ] Answer worked: YES/NO
- [ ] Audio quality: GOOD/FAIR/POOR
- [ ] Notes: ___________________________

### Scenario 2: App Background
- [ ] Notification received: YES/NO
- [ ] ...

### Issues Found:
1. ________________________________
2. ________________________________

### Logs:
```
[Paste relevant logs here]
```
```

---

## Rollback Plan

If critical issues found:

1. **Disable push notifications**:
   ```typescript
   // apps/interfone-api/.env
   PUSH_NOTIFICATIONS_ENABLED=false
   ```

2. **Re-enable polling** (temporary):
   ```bash
   git revert [commit-hash]
   ```

3. **Fall back to RTM-only**: Remove background task registration from app/_layout.tsx
