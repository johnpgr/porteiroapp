# Simplified Implementation: Expo Background Notifications + CallKeep

**Date**: 2025-11-03
**Approach**: Use Expo's built-in background notification handling (no native FCM needed!)
**Status**: Ready for Implementation

---

## Why This Works (Simpler Approach)

You're right - we don't need native FCM! Expo supports **headless background notifications** that run JavaScript even when app is killed.

### Current Problem

```typescript
// apps/interfone-api/src/services/push.service.ts (LINE 72-76)
const payload = {
  to: params.pushToken,
  title: 'Chamada do Interfone',  // ❌ This prevents background handling
  body: '...',                      // ❌ This shows notification instead
  data: { ... }
};
```

**Result**: Shows notification in system tray, but doesn't wake app to handle call logic.

### The Fix

```typescript
// Send data-only notification with background content flag
const payload = {
  to: params.pushToken,
  // NO title or body!
  data: {
    type: 'intercom_call',
    callId: params.callId,
    callerName: params.fromName,
    apartmentNumber: params.apartmentNumber,
  },
  _contentAvailable: true,  // ✅ This makes it a "headless" notification
  priority: 'high',
};
```

**Result**: Triggers `TaskManager` background task even when app killed → Display native call UI via CallKeep/ConnectionService.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOORMAN INITIATES CALL                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│       Backend: Send Expo Push (data-only, no title/body)       │
│  {                                                               │
│    "to": "ExponentPushToken[...]",                              │
│    "_contentAvailable": true,                                    │
│    "priority": "high",                                           │
│    "data": { "type": "intercom_call", "callId": "..." }         │
│  }                                                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│   Expo Push Service → FCM (Android) / APNs (iOS)                │
│   Headless background notification delivered                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│          TaskManager Background Task Runs                       │
│   (even when app killed!)                                       │
│   1. Extract call data from notification.data                   │
│   2. Display native call UI via CallKeep (iOS) or               │
│      ConnectionService (Android)                                │
│   3. Store call data in AsyncStorage for when user answers      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend - Send Data-Only Notifications

### 1.1 Update Push Service

**File**: `apps/interfone-api/src/services/push.service.ts`

```typescript
/**
 * Send a call invite push notification (HEADLESS)
 * Uses data-only notification to wake app in background
 */
async sendCallInvite(params: CallInvitePushParams): Promise<SendPushResult> {
  if (!this.enabled) {
    return {
      success: false,
      pushToken: params.pushToken,
      error: 'Push notifications are disabled'
    };
  }

  // Validate Expo push token format
  if (!this.isValidExpoPushToken(params.pushToken)) {
    console.warn(`⚠️ Invalid Expo push token format: ${params.pushToken}`);
    return {
      success: false,
      pushToken: params.pushToken,
      error: 'Invalid push token format'
    };
  }

  // CRITICAL CHANGE: Send data-only notification (no title/body)
  const payload = {
    to: params.pushToken,
    // NO title or body - this makes it a headless notification
    _contentAvailable: true, // iOS: deliver as background notification
    priority: 'high' as const,
    channelId: 'intercom-call', // Android notification channel
    data: {
      type: 'intercom_call',
      callId: params.callId,
      from: params.from,
      fromName: params.fromName || 'Doorman',
      apartmentNumber: params.apartmentNumber || '',
      buildingName: params.buildingName || '',
      channelName: params.channelName,
      timestamp: Date.now().toString(),
      action: 'incoming_call',
      ...params.metadata
    }
  };

  try {
    console.log('📤 [push] Sending HEADLESS notification (data-only)', {
      to: `${params.pushToken?.slice(0, 12)}...`,
      callId: params.callId,
      _contentAvailable: true,
    });

    const response = await fetch(this.expoApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(payload)
    });

    console.log('📡 [push] Expo POST status', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`❌ Expo push notification failed (${response.status}):`, errorText);
      return {
        success: false,
        pushToken: params.pushToken,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();

    // Expo returns an array of results when you send an array of messages,
    // and an object when you send a single message. Normalize here.
    const firstResult = Array.isArray(result?.data)
      ? result.data[0]
      : result?.data ?? result;

    if (firstResult?.status === 'error') {
      console.error('❌ Expo push notification error:', firstResult.message, {
        details: firstResult?.details,
      });
      return {
        success: false,
        pushToken: params.pushToken,
        error: firstResult.message || 'Push notification failed'
      };
    }

    console.log(`✅ Headless push notification sent (ticket: ${firstResult?.id})`);

    return {
      success: true,
      pushToken: params.pushToken,
      ticketId: firstResult?.id
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to send push notification:', errorMessage);
    return {
      success: false,
      pushToken: params.pushToken,
      error: errorMessage
    };
  }
}
```

### Testing Phase 1

```bash
# Test from backend API
curl -X POST http://localhost:3001/api/calls/start \
  -H "Content-Type: application/json" \
  -d '{
    "apartmentNumber": "101",
    "buildingId": "your-building-id",
    "doormanId": "your-doorman-id"
  }'
```

- [ ] Backend sends data-only notification (no title/body)
- [ ] Check logs: `_contentAvailable: true` is present
- [ ] Expo Push Service accepts the message

**Expected Timeline**: 1-2 hours

---

## Phase 2: Mobile App - Background Task Handler

### 2.1 Install Dependencies

```bash
cd apps/expo
npx expo install expo-task-manager
```

### 2.2 Configure iOS Background Modes

**File**: `apps/expo/app.json`

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": [
          "remote-notification",  // ✅ Required for background notifications
          "voip"
        ]
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2196F3",
          "mode": "production",
          "sounds": [
            "./assets/audio/doorbell_push.mp3",
            "./assets/audio/telephone_toque_interfone.mp3"
          ],
          "enableBackgroundRemoteNotifications": true  // ✅ Enable background handling
        }
      ],
      "expo-secure-store"
    ]
  }
}
```

### 2.3 Create Background Notification Task

**File**: `apps/expo/services/backgroundNotificationTask.ts` (NEW)

```typescript
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import callKeepService from './CallKeepService';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

/**
 * Define the background task that runs when a notification is received
 * This runs even when the app is killed!
 */
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundTask] Error:', error);
    return;
  }

  console.log('[BackgroundTask] Received notification data:', data);

  // Check if this is a notification response (user tapped) or just received
  const isNotificationResponse = 'actionIdentifier' in data;

  if (!isNotificationResponse) {
    // This is a notification that was just received (not user action)
    const notificationData = (data as any)?.notification?.request?.content?.data;

    if (notificationData?.type === 'intercom_call') {
      console.log('[BackgroundTask] Incoming intercom call detected!');

      const callData = {
        callId: notificationData.callId,
        callerName: notificationData.fromName || 'Doorman',
        apartmentNumber: notificationData.apartmentNumber || '',
        channelName: notificationData.channelName,
        timestamp: Date.now(),
      };

      // Store call data for when app fully opens
      await AsyncStorage.setItem(
        '@pending_intercom_call',
        JSON.stringify(callData)
      );

      // Display native call UI
      if (Platform.OS === 'ios') {
        // iOS: Use CallKeep
        await callKeepService.initialize();
        await callKeepService.displayIncomingCall(
          callData.callId,
          callData.callerName,
          callData.apartmentNumber,
          false // audio only
        );
      } else if (Platform.OS === 'android') {
        // Android: Schedule local notification with CallStyle
        // This will trigger ConnectionService (to be implemented)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Incoming Call',
            body: `${callData.callerName} - Apt ${callData.apartmentNumber}`,
            data: callData,
            sound: 'telephone_toque_interfone.mp3',
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: 'call',
          },
          trigger: null, // Immediate
        });
      }

      console.log('[BackgroundTask] Displayed call UI');
    }
  } else {
    // User tapped on notification
    console.log('[BackgroundTask] User tapped notification');
  }
});

/**
 * Register the background task
 * MUST be called at module level (not inside component)
 */
export async function registerBackgroundNotificationTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_NOTIFICATION_TASK
    );

    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('[BackgroundTask] Registered successfully');
    } else {
      console.log('[BackgroundTask] Already registered');
    }
  } catch (error) {
    console.error('[BackgroundTask] Failed to register:', error);
  }
}
```

### 2.4 Register Task at App Startup

**File**: `apps/expo/app/_layout.tsx`

```typescript
import { registerBackgroundNotificationTask } from '~/services/backgroundNotificationTask';

// IMPORTANT: Register at module level (outside component)
registerBackgroundNotificationTask();

export default function RootLayout() {
  // ... rest of your component
}
```

### 2.5 Handle Stored Call Data on App Open

**File**: `apps/expo/hooks/useAgora.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Inside useAgora hook
useEffect(() => {
  // Check for pending call when app opens
  const checkPendingCall = async () => {
    const pendingCallData = await AsyncStorage.getItem('@pending_intercom_call');

    if (pendingCallData) {
      const callData = JSON.parse(pendingCallData);

      // Check if call is still active (not expired)
      const age = Date.now() - callData.timestamp;
      if (age < 60000) { // 60 seconds
        // Show incoming call modal
        handleIncomingCall(callData);
      }

      // Clear stored data
      await AsyncStorage.removeItem('@pending_intercom_call');
    }
  };

  checkPendingCall();
}, []);
```

### Testing Phase 2

**Build development app** (background tasks don't work in Expo Go):

```bash
cd apps/expo

# Android
npx expo run:android

# iOS
npx expo run:ios
```

**Test scenarios:**

1. **App in foreground**: Call received → Modal shows immediately
2. **App in background**: Call received → Background task runs → CallKeep displays
3. **App killed**: Kill app → Call received → Background task runs → CallKeep displays

- [ ] Background task executes when app killed
- [ ] CallKeep shows native call UI (iOS)
- [ ] Local notification displays (Android)
- [ ] Stored call data loaded when app opens

**Expected Timeline**: 8-12 hours

---

## Phase 3: Integrate CallKeep (Already Exists!)

Your `CallKeepService.ts` already exists. Just wire it to the background task (done in Phase 2.3 above).

### 3.1 Initialize CallKeep on App Launch

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
import callKeepService from '~/services/CallKeepService';

// Inside AuthProvider
useEffect(() => {
  if (user && user.user_type === 'morador') {
    // Initialize CallKeep for residents
    callKeepService.initialize();
  }
}, [user]);
```

### 3.2 Handle CallKeep Events

**File**: `apps/expo/hooks/useAgora.ts`

```typescript
// Override CallKeep answer/decline handlers
useEffect(() => {
  callKeepService.onAnswerCall = async ({ callUUID }) => {
    console.log('[useAgora] CallKeep answer:', callUUID);

    // Get call ID from AsyncStorage
    const pendingCallData = await AsyncStorage.getItem('@pending_intercom_call');
    if (pendingCallData) {
      const callData = JSON.parse(pendingCallData);
      await answerCall(callData.callId);
    }
  };

  callKeepService.onEndCall = async ({ callUUID }) => {
    console.log('[useAgora] CallKeep end:', callUUID);

    const pendingCallData = await AsyncStorage.getItem('@pending_intercom_call');
    if (pendingCallData) {
      const callData = JSON.parse(pendingCallData);
      await declineCall(callData.callId);
    }
  };
}, [answerCall, declineCall]);
```

**Expected Timeline**: 2-4 hours

---

## Phase 4: Remove Polling Mechanism

Now that background notifications work, remove the polling fallback!

### 4.1 Remove Polling from useAgora

**File**: `apps/expo/hooks/useAgora.ts`

```typescript
// DELETE these:
const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// DELETE entire polling effect (around line 1461-1550)
useEffect(() => {
  // Proactive polling for incoming calls
  // ... DELETE ALL THIS
}, [user]);

// DELETE checkPendingCalls function
const checkPendingCalls = async () => {
  // ... DELETE ALL THIS
};
```

### 4.2 Optional: Remove Backend Polling Endpoint

**File**: `apps/interfone-api/src/routes/call.routes.ts`

```typescript
// Optional: Remove or deprecate
// router.get('/calls/pending', callController.getPendingCalls);
```

### Testing Phase 4

- [ ] No calls to `/api/calls/pending` in network logs
- [ ] Incoming calls still work reliably
- [ ] Battery usage improves
- [ ] App idle time has no network traffic

**Expected Timeline**: 1-2 hours

---

## Phase 5: Android ConnectionService (Optional, for Better UX)

If you want native Android call UI (not just notification), implement ConnectionService.

See `ANDROID_CALL_HANDLING_RESEARCH.md` section 2.3 for full implementation.

**Expected Timeline**: 12-16 hours (optional)

---

## Total Timeline

| Phase | Component | Hours | Required? |
|-------|-----------|-------|-----------|
| Phase 1 | Backend - Data-only push | 1-2 | ✅ Yes |
| Phase 2 | App - Background task handler | 8-12 | ✅ Yes |
| Phase 3 | CallKeep integration | 2-4 | ✅ Yes |
| Phase 4 | Remove polling | 1-2 | ✅ Yes |
| Phase 5 | Android ConnectionService | 12-16 | ⚠️ Optional |
| **Total (Required)** | | **12-20 hours** | |
| **Total (With Optional)** | | **24-36 hours** | |

---

## Key Advantages Over Native FCM Approach

| Aspect | Expo Approach | Native FCM Approach |
|--------|---------------|---------------------|
| **Setup Complexity** | Low (no Firebase Admin SDK) | High (Firebase setup, service account) |
| **Native Code** | Minimal (just CallKeep) | Extensive (FCM service, ConnectionService) |
| **Maintenance** | Low (Expo handles FCM abstraction) | High (maintain native code) |
| **Reliability** | 90-95% (depends on device) | 95-98% (Google's official approach) |
| **Implementation Time** | 12-20 hours | 42-64 hours |
| **Build Size** | No change | +2-3 MB (Firebase SDK) |

---

## Known Limitations

### 1. iOS Delivery Limits

Apple recommends limiting headless notifications to **2-3 per hour** per device. For intercom calls, this is fine (few calls per day).

### 2. Android Doze Mode

During deep Doze mode, even high-priority notifications may be delayed 5-15 seconds. This is acceptable for most use cases.

### 3. No Guarantees

From Expo docs: "The OS doesn't guarantee delivery." Battery optimization, Doze mode, or app restrictions can affect delivery.

### 4. Development Build Required

Background tasks **don't work in Expo Go**. Must build with:
```bash
npx expo run:android
npx expo run:ios
```

---

## When to Upgrade to Native FCM

If after implementation you see:
- Missed call rate > 10%
- User complaints about delayed calls
- Battery optimization issues on certain devices

Then consider migrating to native FCM (REVISED_IMPLEMENTATION_PLAN.md).

---

## Migration Path (If Needed Later)

The good news: You can easily add native FCM later without rewriting everything!

```typescript
// Backend can send both Expo and FCM
if (recipient.fcmToken) {
  await firebaseService.sendDataMessage(...); // Native FCM
} else {
  await expoPushService.sendCallInvite(...);  // Expo Push
}
```

This allows gradual rollout:
1. Start with Expo (all users)
2. Add FCM as optional enhancement
3. Migrate high-value users to FCM
4. Keep Expo as fallback

---

## Testing Checklist

### Before Implementation
- [ ] Current missed call rate: _____%
- [ ] Current battery drain: _____mAh/hour
- [ ] Polling network usage: _____KB/min

### After Implementation
- [ ] Background task registered successfully
- [ ] Data-only notifications received when app killed
- [ ] CallKeep displays on iOS lock screen
- [ ] Android notification shows with call actions
- [ ] Answer/decline actions work
- [ ] No polling traffic in network logs
- [ ] Battery drain reduced
- [ ] Missed call rate: _____%

### Device Testing
- [ ] Pixel 7 (Android 14)
- [ ] Samsung Galaxy (One UI)
- [ ] Xiaomi (MIUI)
- [ ] iPhone 13 (iOS 17)
- [ ] iPhone with Low Power Mode ON

---

## Rollback Plan

If issues arise:

### Quick Rollback (5 minutes)
```typescript
// apps/interfone-api/src/services/push.service.ts
// Add title/body back to payload
const payload = {
  to: params.pushToken,
  title: 'Chamada do Interfone',  // Re-enable
  body: '...',                     // Re-enable
  data: { ... }
};
```

### Re-enable Polling (10 minutes)
Uncomment polling code in `useAgora.ts` (keep git history).

---

## Summary

**You were right!** We can use Expo's headless background notifications instead of native FCM. This approach is:

✅ **Much simpler** (12-20 hours vs 42-64 hours)
✅ **Less code to maintain** (no native Firebase integration)
✅ **Good enough reliability** (90-95% for most devices)
✅ **Easy to upgrade later** (can add native FCM if needed)

The key changes:
1. Backend: Remove `title` and `body`, add `_contentAvailable: true`
2. App: Use `TaskManager` to handle notifications in background
3. App: Wire to existing `CallKeepService`
4. Remove polling

**Ready to start with Phase 1?**
