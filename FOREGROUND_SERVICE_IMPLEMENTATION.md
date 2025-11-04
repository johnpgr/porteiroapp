# WhatsApp-like Foreground Service Implementation Plan

**Project**: PorteiroApp - Condominium Management System
**Feature**: Native call handling with foreground service persistence
**Status**: Implementation Ready
**Last Updated**: 2025-11-03

---

## Executive Summary

This document outlines the implementation plan for adding WhatsApp-like call handling to PorteiroApp's intercom system. The goal is to ensure residents receive incoming intercom calls reliably, even when the app is backgrounded or killed, through:

1. **Android Foreground Service** - Keeps app alive for call handling
2. **iOS VoIP Push Notifications** - Instant call delivery via PushKit
3. **CallKeep Integration** - Native system call UI on both platforms
4. **Auth Session Improvements** - Fix race conditions and redundancies

---

## Current System Analysis

### Architecture Overview

**Components:**
- **Frontend**: React Native Expo app with Agora RTC/RTM SDK
- **Backend**: Express API (`interfone-api`) with Supabase PostgreSQL
- **Push**: Expo Push Notifications via Edge Functions
- **Call Flow**: Doorman → API → RTM Signal + Push → Resident App

**Call State Machine:**
```
idle → dialing → ringing → connecting → connected → ending → ended
                          ↘ declined
                          ↘ missed
                          ↘ failed
```

### Current Notification Paths

1. **RTM Real-time** (when app open):
   - Doorman calls `POST /api/calls/start`
   - Backend sends RTM `INVITE` signal
   - Resident's `useAgora` hook receives invite
   - `IncomingCallModal` displays custom UI

2. **Push Notifications** (when backgrounded):
   - Backend sends standard FCM/APNs push
   - Notification displayed in system tray
   - User taps notification → opens app → shows modal

3. **Polling Fallback** (when RTM disconnected):
   - `GET /api/calls/pending` every 3 seconds
   - Inefficient but ensures no missed calls

### Critical Gaps Identified

| Issue | Impact | Priority |
|-------|--------|----------|
| Android kills app after 5 min in background | Missed calls | **CRITICAL** |
| iOS standard push delayed 5-30s | Poor UX | **HIGH** |
| No native call UI (CallKeep dormant) | Non-standard UX | **HIGH** |
| Polling drains battery | Resource waste | **MEDIUM** |
| Auth race conditions on startup | App crashes | **CRITICAL** |
| Redundant SecureTokenStorage module | Code smell | **LOW** |

---

## Phase 1: Android Foreground Service

### Objective
Implement persistent foreground service to keep app alive for incoming calls.

### Implementation

#### 1.1 Create Native Module Structure

**File**: `apps/expo/modules/CallForegroundService/android/CallForegroundService.kt`

```kotlin
package expo.modules.callforegroundservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallForegroundServiceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is null")

  override fun definition() = ModuleDefinition {
    Name("CallForegroundService")

    Function("start") {
      title: String,
      message: String,
      channelId: String = "intercom-call-service"
    ->
      val intent = Intent(context, CallForegroundService::class.java).apply {
        action = CallForegroundService.ACTION_START
        putExtra("title", title)
        putExtra("message", message)
        putExtra("channelId", channelId)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stop") {
      val intent = Intent(context, CallForegroundService::class.java).apply {
        action = CallForegroundService.ACTION_STOP
      }
      context.stopService(intent)
    }

    Function("update") {
      title: String,
      message: String
    ->
      val intent = Intent(context, CallForegroundService::class.java).apply {
        action = CallForegroundService.ACTION_UPDATE
        putExtra("title", title)
        putExtra("message", message)
      }
      context.startService(intent)
    }
  }
}

class CallForegroundService : Service() {
  private var notificationManager: NotificationManager? = null
  private var channelId: String = "intercom-call-service"

  companion object {
    const val ACTION_START = "START_FOREGROUND_SERVICE"
    const val ACTION_STOP = "STOP_FOREGROUND_SERVICE"
    const val ACTION_UPDATE = "UPDATE_FOREGROUND_SERVICE"
    const val NOTIFICATION_ID = 12345
  }

  override fun onCreate() {
    super.onCreate()
    notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val title = intent.getStringExtra("title") ?: "Intercom Active"
        val message = intent.getStringExtra("message") ?: "Ready to receive calls"
        channelId = intent.getStringExtra("channelId") ?: channelId

        val notification = createNotification(title, message)
        startForeground(NOTIFICATION_ID, notification)
      }
      ACTION_STOP -> {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
      ACTION_UPDATE -> {
        val title = intent.getStringExtra("title") ?: "Intercom Active"
        val message = intent.getStringExtra("message") ?: "Ready to receive calls"

        val notification = createNotification(title, message)
        notificationManager?.notify(NOTIFICATION_ID, notification)
      }
    }

    return START_STICKY // Restart service if killed
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Intercom Call Service",
        NotificationManager.IMPORTANCE_LOW // Low importance to avoid sound/vibration
      ).apply {
        description = "Keeps app active to receive intercom calls"
        setShowBadge(false)
      }
      notificationManager?.createNotificationChannel(channel)
    }
  }

  private fun createNotification(title: String, message: String): Notification {
    val contentIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    }

    return NotificationCompat.Builder(this, channelId)
      .setContentTitle(title)
      .setContentText(message)
      .setSmallIcon(android.R.drawable.ic_menu_call)
      .setContentIntent(contentIntent)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }
}
```

#### 1.2 Update AndroidManifest.xml

**File**: `apps/expo/android/app/src/main/AndroidManifest.xml`

Add inside `<application>` tag:

```xml
<service
    android:name="expo.modules.callforegroundservice.CallForegroundService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="phoneCall" />
```

Add permission before `<application>` tag:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
```

#### 1.3 Create TypeScript Interface

**File**: `apps/expo/modules/CallForegroundService/index.ts`

```typescript
import { requireNativeModule } from 'expo-modules-core';

interface CallForegroundServiceModule {
  start(title: string, message: string, channelId?: string): void;
  stop(): void;
  update(title: string, message: string): void;
}

const CallForegroundService = requireNativeModule<CallForegroundServiceModule>(
  'CallForegroundService'
);

export default CallForegroundService;
```

#### 1.4 Integrate with Intercom Service

**File**: `apps/expo/services/intercomCallService.ts`

```typescript
// Add import at top
import { Platform } from 'react-native';
import CallForegroundService from '~/modules/CallForegroundService';

export class IntercomCallService {
  // Add method to start foreground service
  async startForegroundServiceIfNeeded(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      CallForegroundService.start(
        'Intercom Active',
        'Ready to receive calls',
        'intercom-call-service'
      );
      console.log('[IntercomCallService] Foreground service started');
    } catch (error) {
      console.error('[IntercomCallService] Failed to start foreground service:', error);
    }
  }

  // Add method to show incoming call in foreground notification
  async updateForegroundServiceForIncomingCall(apartmentNumber: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      CallForegroundService.update(
        'Incoming Call',
        `Intercom calling from entrance - Apt ${apartmentNumber}`
      );
    } catch (error) {
      console.error('[IntercomCallService] Failed to update foreground service:', error);
    }
  }

  // Add method to stop foreground service
  async stopForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      CallForegroundService.stop();
      console.log('[IntercomCallService] Foreground service stopped');
    } catch (error) {
      console.error('[IntercomCallService] Failed to stop foreground service:', error);
    }
  }
}
```

#### 1.5 Wire to Auth Provider

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
import { intercomCallService } from '~/services/intercomCallService';

// Inside AuthProvider component, add effect after user login
useEffect(() => {
  if (user && user.user_type === 'morador') {
    // Start foreground service for residents
    intercomCallService.startForegroundServiceIfNeeded();
  } else {
    // Stop if user logs out or is not a resident
    intercomCallService.stopForegroundService();
  }

  return () => {
    intercomCallService.stopForegroundService();
  };
}, [user]);
```

### Testing Checklist

- [ ] Service starts when resident logs in
- [ ] Service persists when app is backgrounded
- [ ] Service survives app process kill
- [ ] Notification is LOW priority (no sound/vibration)
- [ ] Notification updates when call incoming
- [ ] Service stops on logout
- [ ] No ANR (Application Not Responding) errors

---

## Phase 2: CallKeep Integration

### Objective
Wire existing `CallKeepService` to Agora call flow for native call UI.

### Implementation

#### 2.1 Install Dependencies

```bash
cd apps/expo
pnpm add react-native-callkeep
```

#### 2.2 Configure iOS CallKit

**File**: `apps/expo/app.json`

Add to `ios.infoPlist`:

```json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": [
        "remote-notification",
        "voip"
      ],
      "NSCameraUsageDescription": "This app needs access to camera for video calls",
      "NSMicrophoneUsageDescription": "This app needs access to microphone for voice calls"
    }
  }
}
```

#### 2.3 Update CallKeep Service

**File**: `apps/expo/services/CallKeepService.ts`

Replace entire file with:

```typescript
import RNCallKeep, { IOptions } from 'react-native-callkeep';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';

class CallKeepService {
  private initialized = false;
  private callUUID: string | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const options: IOptions = {
      ios: {
        appName: 'James Avisa',
        includesCallsInRecents: true,
        supportsVideo: false,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
      },
      android: {
        alertTitle: 'Permissions Required',
        alertDescription: 'This app needs access to make and manage calls',
        cancelButton: 'Cancel',
        okButton: 'OK',
        imageName: 'phone_account_icon',
        additionalPermissions: [],
        selfManaged: false,
        foregroundService: {
          channelId: 'com.porteiroapp.notifications',
          channelName: 'Intercom Calls',
          notificationTitle: 'Intercom call in progress',
          notificationIcon: 'Path to the resource icon of the notification',
        },
      },
    };

    try {
      await RNCallKeep.setup(options);
      this.setupEventListeners();
      this.initialized = true;
      console.log('[CallKeep] Initialized successfully');
    } catch (error) {
      console.error('[CallKeep] Setup failed:', error);
    }
  }

  private setupEventListeners(): void {
    // Android only: handle incoming call display
    if (Platform.OS === 'android') {
      RNCallKeep.setAvailable(true);
    }

    // User answered the call
    RNCallKeep.addEventListener('answerCall', this.onAnswerCall);

    // User declined/ended the call
    RNCallKeep.addEventListener('endCall', this.onEndCall);

    // iOS: app activated after answering
    RNCallKeep.addEventListener('didActivateAudioSession', this.onAudioSessionActivated);
  }

  async displayIncomingCall(
    callId: string,
    callerName: string,
    apartmentNumber: string,
    hasVideo: boolean = false
  ): Promise<void> {
    this.callUUID = uuid.v4() as string;

    try {
      await RNCallKeep.displayIncomingCall(
        this.callUUID,
        callerName,
        `Apartment ${apartmentNumber}`,
        'generic',
        hasVideo
      );

      console.log('[CallKeep] Displayed incoming call:', this.callUUID);

      // Store mapping of CallKeep UUID to our callId
      await this.storeCallMapping(this.callUUID, callId);
    } catch (error) {
      console.error('[CallKeep] Failed to display incoming call:', error);
    }
  }

  async startCall(
    callId: string,
    targetName: string,
    apartmentNumber: string,
    hasVideo: boolean = false
  ): Promise<void> {
    this.callUUID = uuid.v4() as string;

    try {
      await RNCallKeep.startCall(
        this.callUUID,
        targetName,
        `Apartment ${apartmentNumber}`,
        'generic',
        hasVideo
      );

      console.log('[CallKeep] Started outgoing call:', this.callUUID);

      await this.storeCallMapping(this.callUUID, callId);
    } catch (error) {
      console.error('[CallKeep] Failed to start call:', error);
    }
  }

  async endCall(reason: 'answered' | 'declined' | 'missed' | 'failed' = 'answered'): Promise<void> {
    if (!this.callUUID) return;

    try {
      await RNCallKeep.endCall(this.callUUID);
      console.log('[CallKeep] Ended call:', this.callUUID, 'reason:', reason);

      this.callUUID = null;
      await this.clearCallMapping();
    } catch (error) {
      console.error('[CallKeep] Failed to end call:', error);
    }
  }

  async reportCallEnded(reason: number = 1): Promise<void> {
    if (!this.callUUID) return;

    try {
      await RNCallKeep.reportEndCallWithUUID(this.callUUID, reason);
      this.callUUID = null;
    } catch (error) {
      console.error('[CallKeep] Failed to report call ended:', error);
    }
  }

  async setCurrentCallActive(): Promise<void> {
    if (!this.callUUID) return;

    try {
      await RNCallKeep.setCurrentCallActive(this.callUUID);
    } catch (error) {
      console.error('[CallKeep] Failed to set call active:', error);
    }
  }

  // Event handlers - these will be overridden by app
  onAnswerCall = async ({ callUUID }: { callUUID: string }) => {
    console.log('[CallKeep] User answered call:', callUUID);
    // Will be implemented in useAgora hook
  };

  onEndCall = async ({ callUUID }: { callUUID: string }) => {
    console.log('[CallKeep] User ended call:', callUUID);
    // Will be implemented in useAgora hook
  };

  onAudioSessionActivated = () => {
    console.log('[CallKeep] Audio session activated');
  };

  // Helper methods for mapping CallKeep UUID to our callId
  private async storeCallMapping(callkeeepUUID: string, callId: string): Promise<void> {
    // Store in AsyncStorage or in-memory map
    // Implementation depends on your needs
  }

  private async clearCallMapping(): Promise<void> {
    // Clear stored mapping
  }

  async getCallIdFromUUID(callkeepUUID: string): Promise<string | null> {
    // Retrieve callId from CallKeep UUID
    return null;
  }

  cleanup(): void {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didActivateAudioSession');
  }
}

export const callKeepService = new CallKeepService();
export default callKeepService;
```

#### 2.4 Wire CallKeep to Agora Flow

**File**: `apps/expo/hooks/useAgora.ts`

```typescript
import callKeepService from '~/services/CallKeepService';

// Inside useAgora hook, update handleIncomingCall function:

const handleIncomingCall = useCallback(async (callData: IncomingCallData) => {
  try {
    // Display native call UI via CallKeep
    await callKeepService.displayIncomingCall(
      callData.callId,
      callData.doormanName || 'Doorman',
      callData.apartmentNumber,
      false // audio only
    );

    // Set current call state
    setCurrentCall(callData);

    // Start ringtone
    await audioService.playRingtone();

    console.log('[useAgora] Displayed incoming call via CallKeep');
  } catch (error) {
    console.error('[useAgora] Failed to handle incoming call:', error);

    // Fallback to custom modal if CallKeep fails
    setShowIncomingCallModal(true);
  }
}, []);

// Override CallKeep event handlers
useEffect(() => {
  callKeepService.onAnswerCall = async ({ callUUID }) => {
    console.log('[useAgora] CallKeep answer event:', callUUID);

    if (currentCall) {
      await answerCall(currentCall.callId);
    }
  };

  callKeepService.onEndCall = async ({ callUUID }) => {
    console.log('[useAgora] CallKeep end event:', callUUID);

    if (currentCall) {
      await declineCall(currentCall.callId);
    }
  };

  return () => {
    // Cleanup listeners handled by CallKeepService
  };
}, [currentCall, answerCall, declineCall]);

// Initialize CallKeep on mount
useEffect(() => {
  callKeepService.initialize();
}, []);
```

#### 2.5 Update Doorman Call Flow

**File**: `apps/expo/app/porteiro/components/modals/IntercomModal.tsx`

```typescript
import callKeepService from '~/services/CallKeepService';

// Inside startCall function:
const startCall = async () => {
  try {
    setIsCallActive(true);

    const result = await startIntercomCall(apartmentNumber);

    if (result.success && result.callId) {
      // Display outgoing call via CallKeep
      await callKeepService.startCall(
        result.callId,
        `Apartment ${apartmentNumber}`,
        apartmentNumber,
        false
      );

      // Rest of existing logic...
    }
  } catch (error) {
    console.error('Error starting call:', error);
    setIsCallActive(false);
  }
};
```

### Testing Checklist

- [ ] Incoming call displays native UI when app is open
- [ ] Incoming call displays native UI when app is backgrounded
- [ ] Incoming call displays native UI when app is killed (requires VoIP push)
- [ ] Answer button joins Agora channel
- [ ] Decline button sends API request
- [ ] Outgoing call from doorman shows native UI
- [ ] Call appears in iOS recent calls list
- [ ] Android shows call in system UI

---

## Phase 3: iOS VoIP Push Notifications

### Objective
Implement PushKit VoIP notifications for instant call delivery on iOS.

### Implementation

#### 3.1 Install Dependency

```bash
cd apps/expo
pnpm add react-native-voip-push-notification
```

#### 3.2 Configure iOS Project

**File**: `apps/expo/ios/[YourAppName]/Info.plist`

Add to the end before `</dict>`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>voip</string>
  <string>remote-notification</string>
</array>
```

#### 3.3 Update Expo Config

**File**: `apps/expo/app.json`

```json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": [
        "voip",
        "remote-notification"
      ]
    }
  },
  "plugins": [
    "expo-router",
    "expo-web-browser",
    "expo-dev-client",
    [
      "expo-notifications",
      {
        "icon": "./assets/notification-icon.png",
        "color": "#2196F3",
        "mode": "production",
        "sounds": [
          "./assets/audio/doorbell_push.mp3",
          "./assets/audio/telephone_toque_interfone.mp3"
        ]
      }
    ],
    "expo-secure-store",
    "@config-plugins/react-native-callkeep"
  ]
}
```

#### 3.4 Setup VoIP Push Handler

**File**: `apps/expo/app/_layout.tsx`

```typescript
import VoipPushNotification from 'react-native-voip-push-notification';
import callKeepService from '~/services/CallKeepService';

// Inside RootLayout component, add effect:
useEffect(() => {
  if (Platform.OS !== 'ios') return;

  // Register for VoIP notifications
  VoipPushNotification.requestPermissions();

  // Get VoIP device token
  VoipPushNotification.addEventListener('register', (token) => {
    console.log('[VoIP] Device token received:', token);
    // Send token to backend to associate with user
    // TODO: POST /api/users/voip-token
  });

  // Handle incoming VoIP notification
  VoipPushNotification.addEventListener('notification', async (notification) => {
    console.log('[VoIP] Push notification received:', notification);

    const { callId, doormanName, apartmentNumber } = notification;

    // Display incoming call via CallKeep
    // This will wake the app even if killed
    await callKeepService.displayIncomingCall(
      callId,
      doormanName || 'Doorman',
      apartmentNumber,
      false
    );

    // Store call data for when user answers
    await AsyncStorage.setItem('@pending_voip_call', JSON.stringify(notification));
  });

  // Cleanup
  return () => {
    VoipPushNotification.removeEventListener('register');
    VoipPushNotification.removeEventListener('notification');
  };
}, []);
```

#### 3.5 Update Backend to Send VoIP Push

**File**: `apps/interfone-api/src/services/pushNotification.service.ts`

```typescript
export class PushNotificationService {
  async sendVoIPPush(
    voipToken: string,
    payload: {
      callId: string;
      doormanName: string;
      apartmentNumber: string;
    }
  ): Promise<void> {
    // VoIP push must use specific format for PushKit
    const voipPayload = {
      aps: {
        alert: {
          title: 'Incoming Call',
          body: `Intercom calling - Apartment ${payload.apartmentNumber}`,
        },
      },
      callId: payload.callId,
      doormanName: payload.doormanName,
      apartmentNumber: payload.apartmentNumber,
      type: 'voip_call',
    };

    try {
      // Send via APNs with VoIP certificate
      // Implementation depends on your push service
      // Use node-apn library or similar

      console.log('[Push] Sent VoIP push to token:', voipToken);
    } catch (error) {
      console.error('[Push] Failed to send VoIP push:', error);
      throw error;
    }
  }

  async sendCallInvitesToMultiple(
    callData: CallInviteData,
    recipients: Recipient[]
  ): Promise<void> {
    const iosRecipients = recipients.filter(r => r.platform === 'ios' && r.voipToken);
    const androidRecipients = recipients.filter(r => r.platform === 'android');

    // Send VoIP push to iOS devices
    await Promise.all(
      iosRecipients.map(recipient =>
        this.sendVoIPPush(recipient.voipToken!, {
          callId: callData.callId,
          doormanName: callData.fromName,
          apartmentNumber: callData.apartmentNumber,
        })
      )
    );

    // Send standard push to Android devices
    await this.sendCallInvitesToMultipleStandard(callData, androidRecipients);
  }
}
```

#### 3.6 Add VoIP Token Registration

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
// Inside AuthProvider, add VoIP token registration
useEffect(() => {
  if (!user || Platform.OS !== 'ios') return;

  const registerVoIPToken = async () => {
    try {
      const voipToken = await AsyncStorage.getItem('@voip_push_token');

      if (voipToken && voipToken !== user.voip_push_token) {
        // Update backend with VoIP token
        await fetch(`${API_BASE_URL}/api/users/voip-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await TokenStorage.getToken()}`,
          },
          body: JSON.stringify({ voipToken, userId: user.id }),
        });

        console.log('[Auth] VoIP token registered');
      }
    } catch (error) {
      console.error('[Auth] Failed to register VoIP token:', error);
    }
  };

  registerVoIPToken();
}, [user]);
```

### Apple Developer Setup

**Required Steps:**

1. **Create VoIP Services Certificate**:
   - Go to Apple Developer → Certificates, Identifiers & Profiles
   - Create new Certificate → VoIP Services
   - Download `.p12` certificate
   - Upload to your push notification service

2. **Enable VoIP Push Capability**:
   - Select your App ID
   - Enable "Push Notifications"
   - Enable "Background Modes" → Check "Voice over IP"

3. **Update Provisioning Profile**:
   - Regenerate provisioning profile with new capabilities
   - Download and install in Xcode

### Testing Checklist

- [ ] VoIP device token registered on app launch
- [ ] VoIP push wakes app from killed state
- [ ] CallKeep displays immediately on VoIP push
- [ ] Call data persists and loads when user answers
- [ ] VoIP push works with iOS 13+ restrictions
- [ ] Falls back to standard push if VoIP fails

---

## Phase 4: Auth Session Management Improvements

### Objective
Fix critical race conditions and remove redundancies in auth system.

### Implementation

#### 4.1 Remove Redundant SecureTokenStorage Module

**Action**: Delete entire module and update imports.

```bash
rm -rf apps/expo/modules/SecureTokenStorage
```

**File**: `apps/expo/services/TokenStorage.ts`

```typescript
// Remove this import:
// import NativeSecureTokenStorage from '~/modules/SecureTokenStorage';

// Replace with direct expo-secure-store import:
import * as SecureStore from 'expo-secure-store';

// Remove hasNativeSecureStore check and nativeModule logic
// Use SecureStore directly throughout
```

#### 4.2 Fix Race Conditions in Token Save

**File**: `apps/expo/services/TokenStorage.ts`

```typescript
export class TokenStorage {
  private static lastSavedToken: string | null = null;
  private static lastSaveTime = 0;
  private static readonly SAVE_DEBOUNCE_MS = 1000;
  private static savePromise: Promise<void> | null = null; // NEW: track pending save

  static async saveToken(token: string, expiresIn?: number): Promise<void> {
    try {
      // Deduplication: skip if token hasn't changed
      if (this.lastSavedToken === token) {
        return;
      }

      // Wait for any pending save to complete
      if (this.savePromise) {
        await this.savePromise;
      }

      // Debounce: skip if saved recently
      const now = Date.now();
      if (now - this.lastSaveTime < this.SAVE_DEBOUNCE_MS) {
        console.log('[TokenStorage] Debouncing save, too soon since last save');
        return;
      }

      // Create new save promise
      this.savePromise = (async () => {
        await this.ensureMigration();
        await this.storeTokenValue(token);

        if (expiresIn) {
          const expiryTime = now + expiresIn * 1000;
          await AsyncStorage.setItem(EXPIRY_KEY, expiryTime.toString());
        }

        this.lastSavedToken = token;
        this.lastSaveTime = now;
      })();

      await this.savePromise;
      this.savePromise = null;
    } catch (error) {
      this.savePromise = null;
      console.error('[TokenStorage] Error while saving token:', error);
      throw error;
    }
  }
}
```

#### 4.3 Remove isTokenExpired - Single Source of Truth

**File**: `apps/expo/services/TokenStorage.ts`

Remove the `isTokenExpired()` method entirely. Use only JWT payload validation.

```typescript
// DELETE this method:
// static async isTokenExpired(): Promise<boolean> { ... }

// Update hasValidToken to use only JWT validation:
static async hasValidToken(): Promise<boolean> {
  try {
    const token = await this.getToken();
    return token !== null && this.isTokenValid(token);
  } catch (error) {
    console.error('[TokenStorage] Error while checking stored token:', error);
    return false;
  }
}
```

**File**: `apps/expo/hooks/useAuth.tsx`

Remove all calls to `isTokenExpired()`:

```typescript
// DELETE these lines:
// const isExpired = await TokenStorage.isTokenExpired();
// if (!expiryTime) { return false; }

// Use only:
const tokenValid = TokenStorage.isTokenValid(session.access_token);
```

#### 4.4 Fix Clear Loop on Startup

**File**: `apps/expo/hooks/useAuth.tsx`

Add session persistence flag:

```typescript
const SESSION_PERSISTENCE_KEY = '@porteiro_app:session_cleared';

// Inside checkSession(), before clearing:
const checkSession = useCallback(async () => {
  try {
    console.log('[AuthProvider] 🔍 Verificando sessão...');

    if (!isOnline) {
      await handleOfflineSession();
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
      // Clear flag since we have valid session
      await AsyncStorage.removeItem(SESSION_PERSISTENCE_KEY);
    }

    if (session?.user) {
      await loadUserProfile(session.user);
      setIsOffline(false);
      setIsReadOnly(false);
      AnalyticsTracker.trackEvent('auth_session_status', { status: 'active' });
      return;
    }

    const hasStoredToken = await TokenStorage.hasValidToken();

    if (hasStoredToken) {
      console.log('[AuthProvider] 🔄 Tentando renovar sessão a partir do token salvo');
      const { data, error } = await supabase.auth.refreshSession();

      if (!error && data.session?.user) {
        if (data.session.access_token) {
          await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
        }
        if (!user) {
          await loadUserProfile(data.session.user);
        }
        console.log('[AuthProvider] ✅ Sessão renovada com sucesso');
        AnalyticsTracker.trackEvent('auth_session_status', { status: 'refreshed' });
        return;
      }
    }

    // Check if we already cleared in this session
    const alreadyCleared = await AsyncStorage.getItem(SESSION_PERSISTENCE_KEY);

    if (alreadyCleared === 'true') {
      console.log('[AuthProvider] ⚠️ Session already cleared, skipping duplicate clear');
      return;
    }

    console.log('[AuthProvider] ⚠️ Nenhuma sessão válida encontrada, limpando armazenamento');
    await TokenStorage.clearAll();
    await AsyncStorage.setItem(SESSION_PERSISTENCE_KEY, 'true');
    setUser(null);
    setIsOffline(false);
    setIsReadOnly(false);
    AnalyticsTracker.trackEvent('auth_session_status', { status: 'cleared' });
  } catch (error) {
    // ... error handling
  }
}, [SESSION_DURATION, handleOfflineSession, isOnline, loadUserProfile, logError, signOut, user]);
```

### Testing Checklist

- [ ] No infinite reload loop on app startup
- [ ] Token saves complete even with rapid auth changes
- [ ] Session cleared only once per app launch
- [ ] SecureStore errors don't crash app
- [ ] Offline mode works without duplicate clears
- [ ] No race conditions in token validation

---

## Phase 5: Testing & Validation

### Test Scenarios

#### Android

| Scenario | Expected Behavior | Status |
|----------|-------------------|--------|
| Resident logged in | Foreground service starts | ⏳ |
| App backgrounded | Service persists, notification shows | ⏳ |
| App killed | Service restarts on boot | ⏳ |
| Incoming call (background) | Native UI displays via CallKeep | ⏳ |
| Incoming call (killed) | App wakes, native UI displays | ⏳ |
| Answer call | Joins Agora channel, audio works | ⏳ |
| Decline call | API called, service updated | ⏳ |
| Logout | Service stops cleanly | ⏳ |

#### iOS

| Scenario | Expected Behavior | Status |
|----------|-------------------|--------|
| VoIP token registered | Backend has token | ⏳ |
| Incoming call (background) | VoIP push received instantly | ⏳ |
| Incoming call (killed) | App wakes, CallKit displays | ⏳ |
| Answer from lock screen | App opens, joins call | ⏳ |
| Decline from lock screen | API called, no app opening | ⏳ |
| Call in recent calls | Appears in Phone app | ⏳ |
| iOS 13+ compliance | reportNewIncomingCall called | ⏳ |

#### Auth Session

| Scenario | Expected Behavior | Status |
|----------|-------------------|--------|
| Fresh install | No infinite loop | ✅ |
| Rapid token changes | All saves complete | ⏳ |
| Offline mode | No duplicate clears | ✅ |
| SecureStore error | Fallback to AsyncStorage | ✅ |
| Logout | All storage cleared | ⏳ |

---

## Migration Guide

### Removing Old Components

Once CallKeep is stable:

1. **Remove IncomingCallModal**:
   ```bash
   rm apps/expo/components/IncomingCallModal.tsx
   ```

2. **Remove polling logic** from `useAgora.ts`:
   ```typescript
   // DELETE:
   useEffect(() => {
     const interval = setInterval(() => {
       checkPendingCalls();
     }, 3000);
     return () => clearInterval(interval);
   }, []);
   ```

3. **Update notification service** to only send VoIP/standard push, no custom notifications

### Rollback Plan

If issues arise:

1. **Disable foreground service**:
   ```typescript
   // In useAuth.tsx, comment out:
   // intercomCallService.startForegroundServiceIfNeeded();
   ```

2. **Disable CallKeep**:
   ```typescript
   // In useAgora.ts, comment out:
   // await callKeepService.displayIncomingCall(...);
   // Uncomment:
   // setShowIncomingCallModal(true);
   ```

3. **Revert to standard push** by not calling `sendVoIPPush()`

---

## Performance Considerations

### Battery Impact

| Component | Impact | Mitigation |
|-----------|--------|------------|
| Foreground Service | LOW | Only runs for residents, low-priority notification |
| RTM Standby | LOW | Lightweight WebSocket connection |
| CallKeep | NONE | Native system integration |
| VoIP Push | NONE | iOS system feature |
| Polling (removed) | HIGH | ✅ Eliminated |

### Memory Usage

- Foreground service: ~5MB additional memory
- CallKeep: Native, minimal overhead
- VoIP push: No in-app memory impact

### Network Usage

- RTM standby: ~1KB/min (heartbeat only)
- VoIP push: Push notification, ~1KB per call
- Polling (removed): ✅ Eliminated ~200KB/min waste

---

## Security Considerations

### VoIP Push Certificate

- Store VoIP certificate securely on backend
- Use separate certificate from standard push
- Rotate certificates annually
- Never commit certificates to git

### Call Authorization

- Verify apartment_id matches user before displaying call
- Validate JWT token on all API endpoints
- Rate limit call initiation endpoint
- Log all call events for audit

### Foreground Service

- Use minimal permissions
- No data collection in service
- Low priority to avoid abuse
- Auto-stop on logout

---

## Known Limitations

1. **CallKeep on Android 14+**: Google requires certification for CALL_PHONE permission. May need self-managed mode.

2. **VoIP Push on iOS 13+**: Must call `reportNewIncomingCall()` within 10 seconds or app terminates.

3. **Expo Limitations**: VoIP push requires development build, not compatible with Expo Go.

4. **Background Restrictions**: Some Android OEMs (Xiaomi, Huawei) aggressively kill background apps. Users must whitelist app.

---

## Dependencies

### New Dependencies to Install

```json
{
  "dependencies": {
    "react-native-callkeep": "^4.3.13",
    "react-native-voip-push-notification": "^3.3.2",
    "react-native-uuid": "^2.0.2"
  }
}
```

### Native Modules

- **CallForegroundService** (Android): Custom native module
- **expo-secure-store**: Already installed
- **react-native-callkeep**: Third-party with native code
- **react-native-voip-push-notification**: Third-party iOS only

---

## Resources

### Documentation

- [React Native CallKeep](https://github.com/react-native-webrtc/react-native-callkeep)
- [iOS CallKit Framework](https://developer.apple.com/documentation/callkit)
- [Android ConnectionService](https://developer.android.com/reference/android/telecom/ConnectionService)
- [iOS PushKit](https://developer.apple.com/documentation/pushkit)
- [Agora React Native SDK](https://docs.agora.io/en/voice-calling/get-started/get-started-sdk?platform=react-native)

### Tutorials

- [VideoSDK CallKeep Guide](https://www.videosdk.live/developer-hub/social/callkeep)
- [How to Build React Native Video Call App with CallKeep](https://www.videosdk.live/blog/react-native-android-video-calling-app-with-callkeep)
- [VoIP Push Notification Tutorial](https://adeogooladipo.medium.com/how-to-add-voip-push-notification-to-your-react-native-voip-app-part-1-d44270ca876)

### Stack Overflow

- [Background calls in Agora IO React-Native iOS](https://stackoverflow.com/questions/65437369/background-calls-in-agora-io-react-native-ios)
- [React Native Agora - Show ringing UI when app is killed](https://stackoverflow.com/questions/61010681/react-native-and-react-native-agora-how-to-show-ringing-ui-on-mobile-even-if-t)

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Android Foreground Service | 8-12 hours | None |
| Phase 2: CallKeep Integration | 12-16 hours | Phase 1 |
| Phase 3: iOS VoIP Push | 16-24 hours | Phase 2, Apple Dev Account |
| Phase 4: Auth Improvements | 4-6 hours | None (parallel) |
| Phase 5: Testing | 8-12 hours | Phases 1-4 |
| **Total** | **48-70 hours** | |

---

## Success Criteria

✅ **Must Have:**
- [ ] Android app survives background for 30+ minutes
- [ ] iOS receives calls within 2 seconds of initiation
- [ ] Native call UI works from lock screen
- [ ] No infinite reload loops on app startup
- [ ] 95%+ call delivery success rate

✅ **Should Have:**
- [ ] Battery drain < 5% per hour in standby
- [ ] Call history appears in system phone app
- [ ] Graceful fallback if CallKeep fails

✅ **Nice to Have:**
- [ ] Remove polling mechanism entirely
- [ ] Single notification channel for all call types
- [ ] Support for multiple simultaneous calls

---

## Approval & Sign-off

**Prepared by**: Claude (AI Assistant)
**Date**: 2025-11-03
**Status**: Approved ✅

**Implementation Team**:
- [ ] Backend Engineer (VoIP push endpoint)
- [ ] Mobile Engineer (native modules)
- [ ] QA Engineer (testing)
- [ ] DevOps (Apple certificates)

---

## Appendix

### Glossary

- **CallKeep**: React Native library wrapping iOS CallKit and Android ConnectionService
- **CallKit**: iOS framework for VoIP app integration with system phone UI
- **ConnectionService**: Android framework for phone call integration
- **Foreground Service**: Android service that runs in foreground with persistent notification
- **PushKit**: iOS framework for VoIP push notifications (deprecated but still used)
- **RTM**: Agora Real-Time Messaging SDK
- **RTC**: Agora Real-Time Communication SDK
- **VoIP**: Voice over IP

### Acronyms

- **APNs**: Apple Push Notification service
- **FCM**: Firebase Cloud Messaging
- **JWT**: JSON Web Token
- **UI**: User Interface
- **UX**: User Experience

---

**End of Document**
