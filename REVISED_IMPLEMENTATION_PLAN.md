# Revised Implementation Plan: Reliable Intercom Calls (No Polling)

**Date**: 2025-11-03
**Status**: Ready for Implementation
**Approach**: Hybrid push notifications + ConnectionService/CallKeep

---

## Executive Summary

Based on research of WhatsApp/Telegram approaches and analysis of current PorteiroApp implementation:

### What We Have
- ✅ Expo Push Notifications (works for visitor/delivery notifications)
- ✅ RTM standby connection (instant delivery when app alive)
- ⚠️ Polling fallback every 3 seconds (inefficient, needs removal)
- ❌ Expo Push with title/body prevents background call handling

### What We Need
- ✅ Native FCM data-only messages for Android intercom calls
- ✅ VoIP Push (PushKit) for iOS intercom calls
- ✅ Self-managed ConnectionService (Android native call UI)
- ✅ CallKeep integration (iOS native call UI)
- ✅ Remove polling entirely

### Architecture Decision

**Hybrid Push Approach:**
```
Intercom Calls (Critical):
  - Android: Native FCM data-only + ConnectionService
  - iOS: VoIP Push + CallKeep

Other Notifications (Non-Critical):
  - All platforms: Keep existing Expo Push
```

---

## Phase 1: Backend - Implement Native FCM for Calls

### 1.1 Install Firebase Admin SDK

```bash
cd apps/interfone-api
npm install firebase-admin
```

### 1.2 Add Firebase Service Account

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Save as `apps/interfone-api/firebase-service-account.json`
4. Add to `.gitignore`

**File**: `apps/interfone-api/.gitignore`
```
firebase-service-account.json
```

### 1.3 Initialize Firebase Admin

**File**: `apps/interfone-api/src/services/firebase.service.ts` (NEW)

```typescript
import * as admin from 'firebase-admin';
import * as path from 'path';

class FirebaseService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.initialized) return;

    try {
      const serviceAccountPath = path.resolve(
        __dirname,
        '../../firebase-service-account.json'
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });

      this.initialized = true;
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
    }
  }

  /**
   * Send FCM data-only message (high priority)
   * This wakes the app even when killed
   */
  async sendDataMessage(params: {
    fcmToken: string;
    data: Record<string, string>; // Must be string key-value pairs
    priority?: 'high' | 'normal';
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const message: admin.messaging.Message = {
        token: params.fcmToken,
        // NO notification object - this is critical!
        data: params.data,
        android: {
          priority: params.priority === 'high' ? 'high' : 'normal',
          // High priority messages can wake device from Doze
        },
      };

      const messageId = await admin.messaging().send(message);
      console.log('✅ FCM data message sent:', messageId);

      return { success: true, messageId };
    } catch (error) {
      console.error('❌ Failed to send FCM data message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send FCM messages to multiple tokens
   */
  async sendDataMessageMulticast(params: {
    fcmTokens: string[];
    data: Record<string, string>;
    priority?: 'high' | 'normal';
  }): Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{ success: boolean; error?: string }>;
  }> {
    const message: admin.messaging.MulticastMessage = {
      tokens: params.fcmTokens,
      data: params.data,
      android: {
        priority: params.priority === 'high' ? 'high' : 'normal',
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map((r) => ({
        success: r.success,
        error: r.error?.message,
      })),
    };
  }
}

export default new FirebaseService();
```

### 1.4 Update Push Service to Support Both

**File**: `apps/interfone-api/src/services/push.service.ts`

```typescript
import firebaseService from './firebase.service';

class PushNotificationService {
  // ... existing code ...

  /**
   * Send intercom call invite via NATIVE FCM (Android) or VoIP Push (iOS)
   * This bypasses Expo Push for critical call delivery
   */
  async sendCallInviteNative(params: {
    fcmToken: string; // Native FCM token (Android) or VoIP token (iOS)
    platform: 'android' | 'ios';
    callId: string;
    from: string;
    fromName?: string;
    apartmentNumber?: string;
    channelName: string;
  }): Promise<SendPushResult> {
    if (params.platform === 'android') {
      // Android: Send FCM data-only message
      // CRITICAL: All values must be strings for FCM data messages
      const result = await firebaseService.sendDataMessage({
        fcmToken: params.fcmToken,
        data: {
          type: 'incoming_call',
          callId: params.callId,
          from: params.from,
          fromName: params.fromName || 'Doorman',
          apartmentNumber: params.apartmentNumber || '',
          channelName: params.channelName,
          timestamp: Date.now().toString(),
        },
        priority: 'high',
      });

      return {
        success: result.success,
        pushToken: params.fcmToken,
        error: result.error,
        ticketId: result.messageId,
      };
    } else {
      // iOS: Send VoIP push (to be implemented)
      // For now, fall back to Expo push
      console.warn('⚠️ iOS VoIP push not yet implemented, using Expo push fallback');
      return this.sendCallInvite({
        pushToken: params.fcmToken,
        callId: params.callId,
        from: params.from,
        fromName: params.fromName,
        apartmentNumber: params.apartmentNumber,
        channelName: params.channelName,
      });
    }
  }

  /**
   * Send call invites to multiple recipients (hybrid approach)
   */
  async sendCallInvitesToMultipleHybrid(
    baseParams: Omit<CallInvitePushParams, 'pushToken'>,
    recipients: Array<{
      pushToken: string; // Could be Expo, FCM, or VoIP token
      fcmToken?: string; // Native FCM token for Android
      platform?: 'android' | 'ios';
      name?: string;
    }>
  ): Promise<SendPushResult[]> {
    console.log('📣 [push] Sending call invites (hybrid approach)', {
      recipients: recipients.length,
      callId: baseParams.callId,
    });

    const promises = recipients.map(async (recipient) => {
      // Prefer native FCM for Android if available
      if (recipient.platform === 'android' && recipient.fcmToken) {
        return this.sendCallInviteNative({
          fcmToken: recipient.fcmToken,
          platform: 'android',
          callId: baseParams.callId,
          from: baseParams.from,
          fromName: baseParams.fromName,
          apartmentNumber: baseParams.apartmentNumber,
          channelName: baseParams.channelName,
        });
      }

      // Fall back to Expo push (existing implementation)
      return this.sendCallInvite({
        ...baseParams,
        pushToken: recipient.pushToken,
        fromName: baseParams.fromName || recipient.name,
      });
    });

    return Promise.all(promises);
  }
}

export default new PushNotificationService();
```

### 1.5 Update Database Schema

Add `fcm_token` column to store native FCM tokens separately from Expo tokens:

```sql
-- apps/interfone-api/migrations/add_fcm_token.sql

ALTER TABLE profiles
ADD COLUMN fcm_token TEXT,
ADD COLUMN device_platform TEXT CHECK (device_platform IN ('android', 'ios', 'web'));

COMMENT ON COLUMN profiles.fcm_token IS 'Native FCM token (Android) or VoIP token (iOS) for critical call delivery';
COMMENT ON COLUMN profiles.push_token IS 'Expo push token for general notifications';
```

### Testing Phase 1

- [ ] Firebase Admin SDK connects successfully
- [ ] Can send FCM data-only message to test device
- [ ] Message arrives when app is killed
- [ ] Database stores both `push_token` and `fcm_token`

**Expected Timeline**: 4-6 hours

---

## Phase 2: Android - Native FCM Receiver + ConnectionService

### 2.1 Add React Native Firebase

```bash
cd apps/expo
npx expo install @react-native-firebase/app @react-native-firebase/messaging
```

### 2.2 Configure Firebase for Android

**File**: `apps/expo/android/app/google-services.json`

Download from Firebase Console and place here.

**File**: `apps/expo/android/build.gradle`

```gradle
buildscript {
  dependencies {
    // Add this line
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

**File**: `apps/expo/android/app/build.gradle`

```gradle
apply plugin: 'com.google.gms.google-services' // Add at bottom
```

### 2.3 Create Firebase Messaging Service

**File**: `apps/expo/android/app/src/main/java/com/porteiroapp/notifications/MyFirebaseMessagingService.java`

```java
package com.porteiroapp.notifications;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

  private static final String CHANNEL_ID = "intercom-call-service";
  private static final int CALL_NOTIFICATION_ID = 12345;

  @Override
  public void onMessageReceived(RemoteMessage remoteMessage) {
    super.onMessageReceived(remoteMessage);

    Map<String, String> data = remoteMessage.getData();
    String type = data.get("type");

    // Only handle incoming call messages here
    if (!"incoming_call".equals(type)) {
      return;
    }

    String callId = data.get("callId");
    String callerName = data.get("fromName");
    String apartmentNumber = data.get("apartmentNumber");
    String channelName = data.get("channelName");

    // CRITICAL: Must display notification immediately
    // Otherwise FCM will deprioritize future messages
    showIncomingCallNotification(callId, callerName, apartmentNumber);

    // Report incoming call to ConnectionService
    reportIncomingCall(callId, callerName, apartmentNumber, channelName);

    // Send broadcast to React Native to trigger modal
    sendCallBroadcast(callId, callerName, apartmentNumber, channelName);
  }

  @Override
  public void onNewToken(String token) {
    super.onNewToken(token);
    // Send new FCM token to React Native
    Intent intent = new Intent("com.porteiroapp.FCM_TOKEN_REFRESH");
    intent.putExtra("token", token);
    sendBroadcast(intent);
  }

  private void showIncomingCallNotification(String callId, String callerName, String apt) {
    createNotificationChannel();

    // Create answer intent
    Intent answerIntent = new Intent(this, CallActionReceiver.class);
    answerIntent.setAction("ANSWER_CALL");
    answerIntent.putExtra("callId", callId);
    PendingIntent answerPendingIntent = PendingIntent.getBroadcast(
      this, 0, answerIntent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );

    // Create decline intent
    Intent declineIntent = new Intent(this, CallActionReceiver.class);
    declineIntent.setAction("DECLINE_CALL");
    declineIntent.putExtra("callId", callId);
    PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
      this, 1, declineIntent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );

    // Create full screen intent (shows over lock screen)
    Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
    fullScreenIntent.putExtra("callId", callId);
    fullScreenIntent.putExtra("callerName", callerName);
    fullScreenIntent.putExtra("apartmentNumber", apt);
    fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
      this, 0, fullScreenIntent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );

    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_call)
      .setContentTitle("Incoming Call")
      .setContentText(callerName + " - Apt " + apt)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setOngoing(true)
      .setAutoCancel(false)
      .setFullScreenIntent(fullScreenPendingIntent, true)
      .addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
      .build();

    NotificationManager notificationManager =
      (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    notificationManager.notify(CALL_NOTIFICATION_ID, notification);
  }

  private void reportIncomingCall(String callId, String callerName, String apt, String channel) {
    TelecomManager telecomManager = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);

    Bundle extras = new Bundle();
    extras.putString("callId", callId);
    extras.putString("callerName", callerName);
    extras.putString("apartmentNumber", apt);
    extras.putString("channelName", channel);

    PhoneAccountHandle phoneAccountHandle = new PhoneAccountHandle(
      new ComponentName(this, MyConnectionService.class),
      "intercom_calls"
    );

    Uri handle = Uri.fromParts(PhoneAccount.SCHEME_TEL, apt, null);

    try {
      telecomManager.addNewIncomingCall(phoneAccountHandle, extras);
    } catch (Exception e) {
      android.util.Log.e("FCM", "Failed to report incoming call", e);
    }
  }

  private void sendCallBroadcast(String callId, String callerName, String apt, String channel) {
    Intent intent = new Intent("com.porteiroapp.INCOMING_CALL");
    intent.putExtra("callId", callId);
    intent.putExtra("callerName", callerName);
    intent.putExtra("apartmentNumber", apt);
    intent.putExtra("channelName", channel);
    sendBroadcast(intent);
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "Intercom Calls",
        NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("Incoming intercom call notifications");
      channel.enableVibration(true);
      channel.setLightColor(Color.BLUE);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

      NotificationManager manager = getSystemService(NotificationManager.class);
      manager.createNotificationChannel(channel);
    }
  }
}
```

### 2.4 Register Service in AndroidManifest

**File**: `apps/expo/android/app/src/main/AndroidManifest.xml`

```xml
<manifest>
  <!-- Add permissions -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
  <uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />

  <application>
    <!-- Firebase Messaging Service -->
    <service
      android:name=".notifications.MyFirebaseMessagingService"
      android:exported="false">
      <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
      </intent-filter>
    </service>

    <!-- ConnectionService (will be implemented next) -->
    <service
      android:name=".notifications.MyConnectionService"
      android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
      android:exported="true">
      <intent-filter>
        <action android:name="android.telecom.ConnectionService" />
      </intent-filter>
    </service>

    <!-- Call Action Receiver -->
    <receiver
      android:name=".notifications.CallActionReceiver"
      android:exported="false">
      <intent-filter>
        <action android:name="ANSWER_CALL" />
        <action android:name="DECLINE_CALL" />
      </intent-filter>
    </receiver>
  </application>
</manifest>
```

### 2.5 Implement ConnectionService

(See ANDROID_CALL_HANDLING_RESEARCH.md section 2.3 for complete ConnectionService implementation)

### 2.6 React Native Integration - Register FCM Token

**File**: `apps/expo/services/fcmTokenService.ts` (NEW)

```typescript
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { supabase } from '~/utils/supabase';

export class FCMTokenService {
  /**
   * Request FCM permission and get token
   */
  static async requestPermissionAndGetToken(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[FCM] Permission not granted');
        return null;
      }

      const token = await messaging().getToken();
      console.log('[FCM] Token obtained:', token);
      return token;
    } catch (error) {
      console.error('[FCM] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Save FCM token to backend
   */
  static async saveFCMToken(userId: string, token: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          fcm_token: token,
          device_platform: 'android',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[FCM] Failed to save token:', error);
        return false;
      }

      console.log('[FCM] Token saved to backend');
      return true;
    } catch (error) {
      console.error('[FCM] Error saving token:', error);
      return false;
    }
  }

  /**
   * Listen for token refresh
   */
  static onTokenRefresh(callback: (token: string) => void): () => void {
    const unsubscribe = messaging().onTokenRefresh(callback);
    return unsubscribe;
  }
}
```

### 2.7 Update Auth Provider to Register FCM Token

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
import { FCMTokenService } from '~/services/fcmTokenService';

// Inside AuthProvider component
useEffect(() => {
  if (!user || Platform.OS !== 'android') return;

  const registerFCMToken = async () => {
    try {
      const token = await FCMTokenService.requestPermissionAndGetToken();

      if (token) {
        await FCMTokenService.saveFCMToken(user.id, token);
      }
    } catch (error) {
      console.error('[Auth] Failed to register FCM token:', error);
    }
  };

  registerFCMToken();

  // Listen for token refresh
  const unsubscribe = FCMTokenService.onTokenRefresh(async (newToken) => {
    await FCMTokenService.saveFCMToken(user.id, newToken);
  });

  return () => {
    unsubscribe();
  };
}, [user]);
```

### Testing Phase 2

- [ ] FCM token registered on app launch
- [ ] FCM data message received when app killed
- [ ] `onMessageReceived` triggers in background
- [ ] Notification displays immediately
- [ ] ConnectionService shows native call UI
- [ ] Answer/decline actions work

**Expected Timeline**: 16-24 hours

---

## Phase 3: Remove Polling Mechanism

Now that we have reliable push delivery, remove the polling fallback.

### 3.1 Remove Polling from useAgora

**File**: `apps/expo/hooks/useAgora.ts`

```typescript
// DELETE these lines (search for "polling"):
const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// DELETE entire polling setup effect (around line 1461-1550)
useEffect(() => {
  // Proactive polling for incoming calls
  // ... DELETE ALL THIS
}, [user]);

// DELETE checkPendingCalls function
const checkPendingCalls = async () => {
  // ... DELETE ALL THIS
};
```

### 3.2 Remove Polling API Endpoint (Optional)

**File**: `apps/interfone-api/src/routes/call.routes.ts`

```typescript
// OPTIONAL: Remove or deprecate this endpoint
// router.get('/calls/pending', callController.getPendingCalls);
```

### Testing Phase 3

- [ ] App no longer polls `/api/calls/pending`
- [ ] Incoming calls still work via FCM + ConnectionService
- [ ] Battery usage improves
- [ ] No network traffic when idle

**Expected Timeline**: 2-4 hours

---

## Phase 4: iOS VoIP Push + CallKeep

(See FOREGROUND_SERVICE_IMPLEMENTATION.md Phase 3 for complete iOS implementation)

**Expected Timeline**: 16-24 hours

---

## Phase 5: Auth Session Improvements

(See FOREGROUND_SERVICE_IMPLEMENTATION.md Phase 4 for auth fixes)

**Expected Timeline**: 4-6 hours

---

## Total Timeline

| Phase | Component | Hours |
|-------|-----------|-------|
| Phase 1 | Backend FCM setup | 4-6 |
| Phase 2 | Android FCM + ConnectionService | 16-24 |
| Phase 3 | Remove polling | 2-4 |
| Phase 4 | iOS VoIP push | 16-24 |
| Phase 5 | Auth improvements | 4-6 |
| **Total** | | **42-64 hours** |

---

## Migration Strategy

### Week 1: Android Only

1. Deploy Phase 1 + 2 (backend + Android)
2. Test with Android users only
3. Keep Expo Push as fallback for iOS

### Week 2: iOS + Cleanup

1. Deploy Phase 4 (iOS VoIP push)
2. Monitor call delivery metrics
3. Remove polling (Phase 3) once confident

### Week 3: Optimize

1. Auth improvements (Phase 5)
2. Battery/performance testing
3. Analytics integration

---

## Key Differences from Original Plan

| Original Plan | Revised Plan | Reason |
|---------------|--------------|--------|
| Persistent foreground service | No foreground service | Not needed with reliable FCM |
| CallKeep only | ConnectionService + CallKeep | More control on Android |
| Expo Push everywhere | Hybrid (FCM for calls, Expo for others) | Reliability vs simplicity trade-off |
| Remove CallKeepService | Wire existing CallKeepService | It already exists, just needs wiring |

---

## Success Metrics

### Before Implementation

- Missed call rate: ~15-20% (depends on device)
- Battery usage: Medium (polling overhead)
- Average call delivery time: 5-15 seconds

### After Implementation

- Missed call rate: <5%
- Battery usage: Low (no polling)
- Average call delivery time: 1-3 seconds
- 95% of calls answered/declined within 30 seconds

---

## Rollback Plan

If issues arise:

1. **Enable Expo Push fallback** in backend:
   ```typescript
   const USE_NATIVE_FCM = process.env.USE_NATIVE_FCM === 'true';
   ```

2. **Re-enable polling temporarily**:
   ```typescript
   const ENABLE_POLLING_FALLBACK = true;
   ```

3. **Monitor FCM delivery rates** via Firebase Console

---

## Questions to Answer Before Starting

1. ✅ Do we have Firebase project set up? (Yes, google-services.json exists)
2. ✅ Are we okay with two push systems (Expo + FCM)? (Hybrid approach)
3. ⏳ Can we test on physical Android devices? (Required)
4. ⏳ Do we have Apple Developer account for VoIP cert? (iOS Phase 4)

---

**Ready to start with Phase 1?**
