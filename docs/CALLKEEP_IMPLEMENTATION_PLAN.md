# Complete CallKeep + VoIP Push Implementation Plan
**Expo 54 + Agora SDK + react-native-callkeep Integration (Expo-Managed Approach)**

---

## **PHASE 1: iOS Native Layer - AppDelegate CallKit Bridge**

### 1.1 Create iOS CallKit Config Plugin
**File:** `plugins/withCallKitAppDelegate.js`
- Inject Objective-C into AppDelegate.mm for iOS 13+ VoIP mandate
- Import RNCallKeep.h and RNVoipPushNotificationManager.h
- Implement `pushRegistry:didReceiveIncomingPushWithPayload:forType:withCompletionHandler:`
- **CRITICAL iOS 13+ requirement**: Immediately call `[RNCallKeep reportNewIncomingCall:uuid handle:localizedCallerName handleType:@"generic" hasVideo:NO payload:callKeepPayload completion:]`
- Extract callId, channelName, rtcToken, callerName from payload.dictionaryPayload
- Use callId as UUID directly
- Create callKeepPayload NSDictionary with all call data (data bridge)
- Call completion() handler to satisfy iOS
- Register plugin in app.json plugins array

### 1.2 Update app.json
- Add `"./plugins/withCallKitAppDelegate"` to plugins array
- Verify iOS UIBackgroundModes: ["voip", "audio", "remote-notification"]
- Keep existing expo-notifications plugin config

---

## **PHASE 2: Android Native Layer - Expo Task Manager Approach**

### 2.1 Enhance backgroundNotificationTask.ts (Expo Managed)
**File:** `apps/expo/services/backgroundNotificationTask.ts`

**Current structure (keep this):**
```typescript
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import RNCallKeep from 'react-native-callkeep';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  // Your existing task logic
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
```

**Add CallKeep integration:**
- Define callKeepOptions at module level (outside task):
  ```typescript
  const callKeepOptions = {
    ios: { appName: 'James Avisa' },
    android: {
      alertTitle: 'Permissions required',
      alertDescription: 'This app needs phone account access',
      cancelButton: 'Cancel',
      okButton: 'OK',
      foregroundService: {
        channelId: 'com.porteiroapp.callkeep',
        channelName: 'Incoming Call Service',
        notificationTitle: 'Incoming call',
        notificationIcon: 'ic_notification',
      },
    },
  };
  ```
- Inside task handler (after extracting call data):
  - Try `await RNCallKeep.setup(callKeepOptions)` first
  - On error: set flag, skip CallKeep, delegate to coordinator for fallback UI
  - Store call data: `await MyCallDataManager.storeCallData(callId, callData)`
  - Call `RNCallKeep.displayIncomingCall(callId, handle, callerName, 'generic', false)`
  - Delegate to CallCoordinator: `await callCoordinator.handleIncomingPush(pushData)`

**No Firebase SDK needed - uses existing Expo expo-notifications + expo-task-manager**

### 2.2 Verify index.js
**File:** `apps/expo/index.js`
- Keep minimal, just ensure backgroundNotificationTask is imported
- Expo notifications already registered via `Notifications.registerTaskAsync()`
- No Firebase messaging SDK import needed

---

## **PHASE 3: CallKeep Service Layer**

### 3.1 Create CallKeepService
**File:** `apps/expo/services/calling/CallKeepService.ts`
```typescript
import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import { EventEmitter } from 'events';

class CallKeepService {
  private isAvailable: boolean = false;
  private eventEmitter = new EventEmitter();
  private isSetup: boolean = false;

  async setup(): Promise<boolean> {
    // Configure CallKeep with platform-specific options
    // Return true if successful, false if unavailable
  }

  displayIncomingCall(callId: string, handle: string, callerName: string): void {
    // Show native incoming call UI
  }

  endCall(callId: string): void {
    // Dismiss native call UI
  }

  reportEndCallWithUUID(callId: string, reason: number): void {
    // Report call failure to OS
  }

  setAvailable(available: boolean): void {
    // Set availability flag
  }

  backToForeground(): void {
    // Android only - bring app to front
  }

  addEventListener(event: string, handler: Function): () => void {
    // Subscribe to CallKeep events
  }

  checkAvailability(): boolean {
    // Check if CallKeep is initialized
  }

  private setupEventListeners(): void {
    // Register RNCallKeep event listeners
    // Emit through local EventEmitter
  }
}

export const callKeepService = new CallKeepService();
```

**Features:**
- Singleton pattern
- setup() with iOS/Android options (appName: 'James Avisa', default ringtone)
- Graceful failure handling (sets isAvailable = false on error)
- Event forwarding: 'answerCall', 'endCall', 'didLoadWithEvents', 'didActivateAudioSession'
- Platform.OS checks for iOS/Android differences
- Uses CallKeep default system ringtone

### 3.2 Create MyCallDataManager
**File:** `apps/expo/services/calling/MyCallDataManager.ts`
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALL_DATA_PREFIX = 'call_data_';
const CURRENT_CALL_KEY = 'current_call_id';

interface CallData {
  channelName: string;
  rtcToken: string;
  callerName: string;
  apartmentNumber?: string;
  from: string;
  callId: string;
}

export const MyCallDataManager = {
  async storeCallData(callId: string, data: CallData): Promise<void> {
    await AsyncStorage.setItem(CALL_DATA_PREFIX + callId, JSON.stringify(data));
  },

  async getCallData(callId: string): Promise<CallData | null> {
    const json = await AsyncStorage.getItem(CALL_DATA_PREFIX + callId);
    return json ? JSON.parse(json) : null;
  },

  async clearCallData(callId: string): Promise<void> {
    await AsyncStorage.removeItem(CALL_DATA_PREFIX + callId);
  },

  async setCurrentCallId(callId: string): Promise<void> {
    await AsyncStorage.setItem(CURRENT_CALL_KEY, callId);
  },

  async getCurrentCallId(): Promise<string | null> {
    return await AsyncStorage.getItem(CURRENT_CALL_KEY);
  },

  async clearCurrentCallId(): Promise<void> {
    await AsyncStorage.removeItem(CURRENT_CALL_KEY);
  },
};
```

---

## **PHASE 4: CallCoordinator Integration**

### 4.1 Update CallCoordinator.ts
**File:** `apps/expo/services/calling/CallCoordinator.ts`

**Imports to add:**
```typescript
import { callKeepService } from './CallKeepService';
import { MyCallDataManager } from './MyCallDataManager';
```

**Properties to add:**
```typescript
private callKeepAvailable: boolean = false;
```

**In `initialize()` method (around line 58):**
```typescript
// After existing initialization
this.callKeepAvailable = await callKeepService.setup();

// Subscribe to CallKeep events
callKeepService.addEventListener('answerCall', ({ callId }) => {
  void this.handleCallKeepAnswer(callId);
});

callKeepService.addEventListener('endCall', ({ callId }) => {
  void this.handleCallKeepEnd(callId);
});

callKeepService.addEventListener('didLoadWithEvents', (events) => {
  void this.handleEarlyEvents(events);
});
```

**In `handleIncomingPush()` method (around line 231):**
```typescript
// After Step 0 (user context setup), before Step 1 (RTM warmup):

// NEW: Store call data for CallKeep
await MyCallDataManager.storeCallData(data.callId, {
  channelName: data.channelName,
  rtcToken: '', // Will be fetched from API
  callerName: data.callerName || 'Porteiro',
  apartmentNumber: data.apartmentNumber,
  from: data.from,
  callId: data.callId,
});
await MyCallDataManager.setCurrentCallId(data.callId);

// NEW: Display CallKeep UI if available
if (this.callKeepAvailable) {
  callKeepService.displayIncomingCall(
    data.callId,
    data.from,
    data.callerName || 'Porteiro'
  );
  console.log('[CallCoordinator] ✅ CallKeep incoming call UI displayed');
}

// Continue with existing RTM warmup logic (Step 1)...
```

**Add new method `handleCallKeepAnswer()`:**
```typescript
private async handleCallKeepAnswer(callId: string): Promise<void> {
  console.log(`[CallCoordinator] CallKeep answer event: ${callId}`);

  try {
    // Retrieve stored call data
    const callData = await MyCallDataManager.getCallData(callId);
    if (!callData) {
      console.error('[CallCoordinator] No call data found for CallKeep answer');
      return;
    }

    // Call existing answer logic
    await this.answerActiveCall();

    // Android: bring app to foreground
    if (Platform.OS === 'android') {
      callKeepService.backToForeground();
    }
  } catch (error) {
    console.error('[CallCoordinator] CallKeep answer error:', error);
  }
}
```

**Add new method `handleCallKeepEnd()`:**
```typescript
private async handleCallKeepEnd(callId: string): Promise<void> {
  console.log(`[CallCoordinator] CallKeep end event: ${callId}`);

  try {
    await this.endActiveCall('decline');
    await MyCallDataManager.clearCallData(callId);
    await MyCallDataManager.clearCurrentCallId();
  } catch (error) {
    console.error('[CallCoordinator] CallKeep end error:', error);
  }
}
```

**Add new method `handleEarlyEvents()`:**
```typescript
private async handleEarlyEvents(events: any[]): Promise<void> {
  console.log('[CallCoordinator] Handling early CallKeep events:', events.length);

  for (const event of events) {
    if (event.name === 'RNCallKeepPerformAnswerCallAction') {
      await this.handleCallKeepAnswer(event.data.callId);
    } else if (event.name === 'RNCallKeepPerformEndCallAction') {
      await this.handleCallKeepEnd(event.data.callId);
    }
  }
}
```

**In `endActiveCall()` method (around line 489):**
```typescript
// Before leaving channel, end CallKeep if available
if (this.callKeepAvailable && this.activeSession?.id) {
  callKeepService.endCall(this.activeSession.id);
}

// Continue with existing logic...
```

**In remote hangup polling (around line 385):**
```typescript
// When remote hangup detected:
if (this.callKeepAvailable) {
  callKeepService.endCall(callId);
}
await this.activeSession.end('drop');
```

**In RTM END handler (around line 140):**
```typescript
// When RTM END received:
if (this.callKeepAvailable && this.activeSession?.id) {
  callKeepService.endCall(this.activeSession.id);
}
await this.activeSession.end('drop');
```

---

## **PHASE 5: iOS VoIP Push Handler**

### 5.1 Simplify voipPushNotifications.ts
**File:** `apps/expo/utils/voipPushNotifications.ts`

**Keep:** VoIP token registration logic (lines 1-100)

**Modify:** Push received handler (around line 160):
```typescript
// Remove direct UI manipulation
// Just extract data and delegate to CallCoordinator
const pushData: VoipPushData = {
  callId: notification.callId,
  from: notification.from,
  callerName: notification.callerName || notification.fromName,
  apartmentNumber: notification.apartmentNumber,
  channelName: notification.channelName || notification.channel,
};

// Trust that AppDelegate already reported to CallKit (via plugin)
// Just pass data to coordinator
await callCoordinator.handleIncomingPush(pushData);
```

---

## **PHASE 6: UI Coordination - Native + Fallback**

### 6.1 Update morador/_layout.tsx
**File:** `apps/expo/app/morador/_layout.tsx`

**In call system initialization effect (around line 115):**
```typescript
// Initialize CallKeep before CallCoordinator
await callKeepService.setup();
callCoordinator.initialize();
```

**In sessionCreated handler (around line 302):**
```typescript
const onSessionCreated = ({ session }: { session: CallSession }) => {
  console.log('[_layout] Incoming call session created');
  if (!session.isOutgoing) {
    // Only show custom UI if CallKeep unavailable
    if (!callKeepService.checkAvailability()) {
      setIncomingCall(session);
    }
    // Otherwise, CallKeep native UI is already showing
  }
};
```

### 6.2 FullScreenCallUI Remains Unchanged
**File:** `apps/expo/components/FullScreenCallUI.tsx`
- Keep as-is for fallback scenario
- Only shown when CallKeep unavailable

---

## **PHASE 7: Audio Session Management**

### 7.1 CallKeep Audio Handling
**In CallCoordinator initialize():**
```typescript
callKeepService.addEventListener('didActivateAudioSession', () => {
  console.log('[CallCoordinator] CallKit audio session activated');
  // Audio session ready, Agora already handling audio
});
```

**No conflicts:** Agora RTC and CallKeep coexist - CallKeep manages system audio session, Agora manages RTC audio

---

## **PHASE 8: Backend Push Verification**

### 8.1 Verify push.service.ts Payloads
**File:** `apps/interfone-api/src/services/push.service.ts`

**iOS VoIP Push (sendVoipPush, lines 214-321):**
- Ensure payload includes: callId, channelName, rtcToken, callerName, apartmentNumber, from
- Verify _contentAvailable: true
- Verify priority: 'high'

**Android Data Push (sendCallInvite, lines 66-182):**
- Data-only message (no notification field)
- priority: "high"
- Same complete payload

### 8.2 No Changes to call.controller.ts
**File:** `apps/interfone-api/src/controllers/call.controller.ts`
- Existing startCall() logic already correct
- Already sends appropriate pushes per platform

---

## **PHASE 9: Ensure callId is Valid UUID**

### 9.1 Verify Backend Call ID Format
**Check:** `apps/interfone-api` call creation
- Ensure callId generated as valid UUID v4
- Lowercase with hyphens (e.g., `a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8`)

---

## **PHASE 10: Permissions & Config**

### 10.1 iOS - Already Configured ✅
- UIBackgroundModes: ["voip", "audio", "remote-notification"] in app.json
- Microphone/Camera permissions in Info.plist
- VoIP entitlement added by withVoipPush.js plugin

### 10.2 Android - Config Plugin Handles It
- @config-plugins/react-native-callkeep modifies AndroidManifest
- Adds: BIND_TELECOM_CONNECTION_SERVICE, FOREGROUND_SERVICE, READ_PHONE_STATE
- Runtime permission request in CallKeepService.setup()

### 10.3 Permission Denial Fallback
- CallKeepService.setup() returns false on permission denial
- CallCoordinator checks availability
- Falls back to FullScreenCallUI when unavailable

---

## **PHASE 11: State Synchronization**

### 11.1 Remote Disconnect (User Offline)
**In AgoraManager UserOffline handler:**
```typescript
const currentCallId = await MyCallDataManager.getCurrentCallId();
if (currentCallId && callKeepService.checkAvailability()) {
  callKeepService.endCall(currentCallId);
}
```

### 11.2 Remote Cancellation (RTM Cancel)
**In RTM RemoteInvitationCanceled handler:**
```typescript
if (callKeepService.checkAvailability()) {
  callKeepService.endCall(callId);
}
await MyCallDataManager.clearCallData(callId);
```

### 11.3 Connection Failures
**On RTM timeout or RTC join failure:**
```typescript
if (callKeepService.checkAvailability()) {
  callKeepService.reportEndCallWithUUID(callId, END_CALL_REASONS.FAILED);
}
```

---

## **PHASE 12: Apple VoIP Certificate**

### 12.1 Generate Certificate
- Apple Developer Portal → Certificates → VoIP Services
- Download .p8 key file
- Store securely (environment variable)

### 12.2 Backend Configuration
**Apps/interfone-api:**
- Configure APNs with VoIP certificate
- Expo push API should use VoIP cert for iOS pushes
- Test with apns-push-type: voip header

---

## **PHASE 13: Testing Protocol**

### 13.1 Device Requirements
- **Physical iOS device** (VoIP push doesn't work on simulator)
- **Physical Android device** (push notifications unreliable on emulator)
- **NO Chrome debugger** (breaks CallKeep event listeners)

### 13.2 Test Scenarios
1. **iOS killed**: VoIP push → CallKit UI → Answer → Audio
2. **iOS background**: VoIP push → CallKit banner
3. **iOS foreground**: VoIP push → CallKit overlay
4. **iOS early tap**: User taps answer before JS loads → didLoadWithEvents
5. **Android killed**: Expo data push → task runs → ConnectionService UI
6. **Android background**: Data push → ConnectionService
7. **Android foreground**: Data push → ConnectionService
8. **Permission denial**: Graceful fallback to FullScreenCallUI
9. **CallKeep setup failure**: Full fallback to existing UI
10. **Remote hangup (ringing)**: Native UI dismisses cleanly
11. **Remote hangup (connected)**: Call ends, UI dismisses
12. **Connection failure**: Proper error via CallKeep

### 13.3 Debug Tools
- Xcode Console (iOS native logs)
- Android Logcat (Android native logs)
- Metro bundler console.log output
- Test with poor network, airplane mode

---

## **FILES TO CREATE:**

### 1. `plugins/withCallKitAppDelegate.js` (~200 lines)
iOS AppDelegate.mm Objective-C injection for CallKit compliance

### 2. `apps/expo/services/calling/CallKeepService.ts` (~300 lines)
CallKeep wrapper singleton with event forwarding

### 3. `apps/expo/services/calling/MyCallDataManager.ts` (~100 lines)
AsyncStorage persistence for call data bridging

---

## **FILES TO MODIFY:**

### 1. `apps/expo/services/calling/CallCoordinator.ts` (~150 lines added)
- Import CallKeep services
- Add callKeepAvailable property
- Add CallKeep event handlers (answer, end, earlyEvents)
- Modify handleIncomingPush to store data and display CallKeep UI
- Modify endActiveCall to dismiss CallKeep UI
- Add CallKeep end calls to remote hangup handlers

### 2. `apps/expo/services/backgroundNotificationTask.ts` (~50 lines modified)
- Add callKeepOptions constant
- Add CallKeep.setup() in task handler
- Add MyCallDataManager.storeCallData()
- Add RNCallKeep.displayIncomingCall()
- Fallback handling if CallKeep unavailable

### 3. `apps/expo/utils/voipPushNotifications.ts` (~20 lines simplified)
- Remove direct UI calls
- Simplify to just data extraction and delegation

### 4. `apps/expo/app/morador/_layout.tsx` (~20 lines modified)
- Add callKeepService.setup() before callCoordinator.initialize()
- Conditional FullScreenCallUI rendering based on availability

### 5. `apps/expo/app.json` (~1 line added)
- Add `"./plugins/withCallKitAppDelegate"` to plugins array

---

## **NO PACKAGE CHANGES NEEDED:**
✅ All dependencies already installed
✅ No Firebase SDK required
✅ Expo-managed notifications already working
✅ react-native-callkeep already in package.json
✅ react-native-voip-push-notification already in package.json

---

## **IMPLEMENTATION ORDER:**

1. MyCallDataManager (simplest, no dependencies)
2. CallKeepService (wraps RNCallKeep)
3. withCallKitAppDelegate plugin (iOS native)
4. Update app.json (add plugin)
5. Update CallCoordinator (integrate services)
6. Update backgroundNotificationTask (Android CallKeep)
7. Update voipPushNotifications (simplify iOS)
8. Update morador/_layout (initialization)
9. Apple VoIP certificate setup
10. Comprehensive testing on physical devices

---

## **SUCCESS CRITERIA:**

✅ Native incoming call UI (CallKit/ConnectionService)
✅ Works from killed/background/foreground
✅ Graceful fallback when CallKeep unavailable
✅ Expo-managed push notifications (no Firebase SDK)
✅ Audio works after answering via CallKeep
✅ Remote hangup dismisses native UI properly
✅ iOS recent calls integration
✅ Android ConnectionService integration
✅ All test scenarios pass
