# Quick Reference: Android CallKeep Debugging

## One-Liner Commands

### Monitor All Call Logs
```bash
adb logcat | grep --color=always -E "BackgroundTask|CallKeep|CallCoordinator|$"
```

### Monitor Background Task Only
```bash
adb logcat | grep "BackgroundTask"
```

### Check if Task is Registered
```bash
adb logcat -d | grep "BackgroundTask.*Registered" | tail -5
```

### Check Permissions
```bash
adb shell dumpsys package com.porteiroapp.notifications | grep -E "POST_NOTIFICATIONS|READ_PHONE_STATE|CALL_PHONE"
```

### Get Push Token
```bash
adb logcat -d | grep "ExpoPushToken\|push token" | tail -1
```

### Clear App Data & Restart
```bash
adb shell am force-stop com.porteiroapp.notifications && \
adb shell pm clear com.porteiroapp.notifications && \
adb shell monkey -p com.porteiroapp.notifications -c android.intent.category.LAUNCHER 1
```

### Save Logs to File
```bash
adb logcat > debug-$(date +%Y%m%d-%H%M%S).log
```

## Common Issues Quick Fix

### Task Not Triggering
1. Check registration: `adb logcat -d | grep "BackgroundTask.*Registered"`
2. Verify app state: Background task skips if app is foreground
3. Check notification payload has `type: 'intercom_call'`

### CallKeep UI Not Showing
1. Check permissions: `adb shell dumpsys package com.porteiroapp.notifications | grep phone`
2. Verify device: Must be physical device (not emulator)
3. Check battery optimization: Settings > Apps > Battery > Unrestricted

### Payload Not Parsed
1. Monitor extraction: `adb logcat | grep "BackgroundTask.*extract\|BackgroundTask.*data"`
2. Check payload structure matches expected format
3. Verify `type: 'intercom_call'` is present

## Debug Script

Use the interactive script:
```bash
cd apps/expo
./debug-android-calls.sh
```

## Full Documentation

See `docs/DEBUG_ANDROID_CALLS.md` for complete guide.

