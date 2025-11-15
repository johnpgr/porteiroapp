# Agora + CallKeep + Expo Notifications Implementation Plan  
### Twilio-Style Architecture for Incoming Intercom Calls (Android + iOS)

---

## 1. Context & Goals

This document defines a detailed implementation plan to integrate the Agora Voice SDK with:

- `react-native-callkeep` (CallKit / ConnectionService)
- Expo notifications (`expo-notifications` + `expo-task-manager`)
- VoIP push on iOS (PushKit + `react-native-voip-push-notification` + custom Obj‑C handler)

The architecture and call flows are explicitly modeled after the reference Twilio implementation in:

- `/Users/sandragreidinger/dev/react-native-twilio-phone`  
  (JS: `src/RNTwilioPhone.ts`, `src/index.ts`;  
  Android: `android/src/main/java/com/reactnativetwiliophone/TwilioPhoneModule.kt`;  
  iOS: `ios/TwilioPhone.swift` + example `AppDelegate.m`).

**Completion goal**  
For a _morador_ user, receiving an incoming intercom call should:

- Always show the native incoming call UI (CallKit on iOS, ConnectionService UI on Android).
- Work in all app states: foreground, background, and killed.
- Let the user answer/decline from the OS UI, with Agora audio reliably connected on answer.
- Use `expo-notifications` and Expo push tokens; backend sends notifications to tokens in DB.

The plan assumes the current Agora/calling stack:

- Mobile app: `apps/expo`
  - `services/agora/AgoraService.ts`
  - `services/calling/CallCoordinator.ts`
  - `services/calling/CallSession.ts`
  - `services/calling/CallKeepService.ts`
  - `services/backgroundNotificationTask.ts`
  - `services/notificationHandler.ts`
  - `utils/pushNotifications.ts`
  - `utils/voipPushNotifications.ts`
  - Config plugins:  
    - `plugins/withCallKeepConnectionService.js`  
    - `plugins/withVoipCallKit/*` (`VoipCallKitHandler.mm`).

- Backend API: `apps/interfone-api`
  - `src/controllers/call.controller.ts`
  - `src/services/push.service.ts`

---

## 2. Twilio Reference Architecture – Key Ideas to Mirror

This section extracts the critical design patterns from the Twilio reference implementation, to be adapted for Agora.

### 2.1 JS Orchestration: `RNTwilioPhone` & `TwilioPhone`

Key files:

- `react-native-twilio-phone/src/index.ts`
- `react-native-twilio-phone/src/RNTwilioPhone.ts`

**Concepts:**

- `TwilioPhone` (JS) is a thin wrapper around native modules:
  - `NativeModules.TwilioPhone` (Android/iOS).
  - Exposes methods such as `register`, `handleMessage`, `acceptCallInvite`, `startCall`, `toggleMuteCall`, etc.
  - Emits events via `twilioPhoneEmitter` (`NativeEventEmitter`).

- `RNTwilioPhone` is the high-level orchestrator:
  - Accepts CallKeep options and a `fetchAccessToken` callback.
  - Wires together:
    - CallKeep (`react-native-callkeep`).
    - Push handling:
      - Android: `@react-native-firebase/messaging` (FCM).
      - iOS: `react-native-voip-push-notification` (PushKit).
    - Twilio Voice events from native → CallKeep UI.
    - CallKeep actions from user → Twilio Voice commands.
  - Maintains an in-memory list of calls, mapping:
    - CallKeep UUIDs ↔ Twilio `callSid` (`twi_call_sid`).

**Initialization pattern (Twilio):**

- `RNTwilioPhone.initialize(callKeepOptions, fetchAccessToken, options)`:
  - Calls `initializeCallKeep(...)`:
    - iOS: `RNCallKeep.setup(...)` → `setAvailable(true)`.
    - Android: `registerPhoneAccount(...)`, `registerAndroidEvents()`, `setAvailable(true)`.
    - Subscribes to Twilio and CallKeep events (`listenTwilioPhone`, `listenCallKeep`).
  - Calls `registerAndroid()`:
    - Uses `messaging().getToken()` and `.onTokenRefresh(...)` to register/unregister Twilio with FCM.
    - Sets `messaging().onMessage(...)` to forward FCM payloads to Twilio.
  - Calls `registerIOS()`:
    - Uses `VoipPushNotification.addEventListener('register', ...)` to register Twilio with APNs VoIP.
    - Uses `'notification'` listener to forward VoIP payloads to Twilio.

**Background handling (Android):**

- `RNTwilioPhone.handleBackgroundState(callKeepOptions)`:
  - `messaging().setBackgroundMessageHandler(...)`:
    - Re-registers CallKeep and events.
    - Calls `TwilioPhone.handleMessage(remoteMessage.data)`.
  - This ensures:
    - FCM payloads are processed even when app is killed.
    - CallKeep UI can be displayed in background handler before JS UI mounts.

### 2.2 Native Android: FCM + Twilio + CallKeep

File: `react-native-twilio-phone/android/src/main/java/com/reactnativetwiliophone/TwilioPhoneModule.kt`

**Patterns:**

- Registration:
  - `register(accessToken, deviceToken)`:
    - `Voice.register(accessToken, Voice.RegistrationChannel.FCM, deviceToken, ...)`.
    - Emits `RegistrationSuccess` / `RegistrationFailure` events.

- Incoming message:
  - `handleMessage(payload: ReadableMap)`:
    - Converts payload to Android `Bundle`.
    - Calls `Voice.handleMessage(context, bundle, MessageListener)`.
    - In `MessageListener.onCallInvite(...)`:
      - Caches `CallInvite` in `activeCallInvites`.
      - Emits `CallInvite` event with `{ callSid, from }`.
    - In `onCancelledCallInvite(...)`:
      - Removes invite and emits `CancelledCallInvite`.

- Call control:
  - `acceptCallInvite`, `rejectCallInvite`, `disconnectCall`, `endCall`, `toggleMuteCall`, `toggleHoldCall`, `toggleSpeaker`, `sendDigits`, `startCall`, `unregister`.

**Twilio → CallKeep (Android):**

- JS `listenTwilioPhone()`:
  - On `CallInvite` (Android only):
    - Creates a `uuid` via `uuid-random`.
    - Stores `{ uuid, sid: callSid }` in a static calls list.
    - Calls `RNCallKeep.displayIncomingCall(uuid, from)`.
  - On `CallConnected`:
    - Maps `callSid` to `uuid` and calls `RNCallKeep.setCurrentCallActive(uuid)`.
  - On `CallDisconnected` / `CallDisconnectedError`:
    - Calls `RNCallKeep.reportEndCallWithUUID(uuid, reason)` and removes the call mapping.

**CallKeep → Twilio (platform-agnostic):**

- In `listenCallKeep()`:
  - `answerCall` → `TwilioPhone.acceptCallInvite(callSid)`.
  - `endCall` → `TwilioPhone.endCall(callSid)` + remove call.
  - `didPerformSetMutedCallAction` → `TwilioPhone.toggleMuteCall`.
  - `didToggleHoldCallAction` → `TwilioPhone.toggleHoldCall`.
  - `didPerformDTMFAction` → `TwilioPhone.sendDigits`.

### 2.3 Native iOS: PushKit + CallKit + Twilio

Files:

- `react-native-twilio-phone/ios/TwilioPhone.swift`
- `react-native-twilio-phone/example/ios/TwilioPhoneExample/AppDelegate.m`

**AppDelegate (Twilio example):**

- Implements `pushRegistry:didReceiveIncomingPushWithPayload:forType:withCompletionHandler:`:
  - Extracts:
    - `uuid` (`[[NSUUID UUID] UUIDString]`).
    - `callerName` from `twi_from`.
    - `handle` from `twi_to`.
  - Calls:
    - `[RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload ...]`.
    - `[RNCallKeep reportNewIncomingCall:uuid handle:handle ... payload:payload.dictionaryPayload ...]`.
  - Calls `completion()` afterwards (iOS 13+ requirement).

**Native Twilio module (iOS):**

- `TwilioPhone.register(accessToken, deviceToken)`:
  - Converts hex deviceToken → `Data` and calls `TwilioVoiceSDK.register`.
- `handleMessage(payload)`:
  - `TwilioVoiceSDK.handleNotification(payload, delegate:self)`.
- Implements `NotificationDelegate`:
  - `callInviteReceived` → caches invite + emits `"CallInvite"`.
  - `cancelledCallInviteReceived` → removes invite + emits `"CancelledCallInvite"`.
- Implements `CallDelegate`:
  - Emits Twilio events → JS for call state.

**CallKit ↔ Twilio mapping (iOS):**

- JS `listenCallKeep()`:
  - On `'didDisplayIncomingCall'`:
    - Reads `payload.twi_call_sid`.
    - Stores `{ uuid: callUUID, sid: payload.twi_call_sid, payload }`.
  - On `'answerCall'`:
    - Maps UUID → `callSid`.
    - Calls `TwilioPhone.acceptCallInvite(callSid)`.
  - On `'endCall'`:
    - Maps UUID → `callSid`.
    - Calls `TwilioPhone.endCall(callSid)` and removes mapping.

**Takeaways to mirror:**

- Strict separation of concerns:
  - Native Twilio modules: call/media logic + push decoding.
  - JS orchestrator: CallKeep + event mapping, generic call flows.
  - Push layer: FCM / PushKit integration, minimal logic.

- Background-safe patterns:
  - Android: FCM `setBackgroundMessageHandler` doing:
    - CallKeep re-init.
    - Twilio `handleMessage(...)`.
  - iOS: PushKit delegate reporting to CallKit immediately, then notifying JS.

---

## 3. Current Agora/Expo/CallKeep Architecture (Porteiro)

### 3.1 Backend (Express + Agora + Expo Push)

**File:** `apps/interfone-api/src/controllers/call.controller.ts`

- `startCall`:
  - Validates apartment, doorman/initiator.
  - Creates call record (status `calling`) with:
    - `id` (string callId).
    - `channel_name` or `twilio_conference_sid` (legacy; used as `channelName`).
  - Generates Agora tokens for initiator via `agoraService.generateTokenPair`.
  - Inserts participants:
    - Doorman (caller).
    - Residents (callees) with:
      - `pushToken` (Expo) and `voipPushToken`.
      - `notification_enabled` flag.
  - Constructs `invitePayload` (RTM signal):
    - `{ t: 'INVITE', callId, from, channel, ts, ... }`.
  - Determines notification targets:
    - `iosRecipients` (have `voipPushToken`).
    - `androidRecipients` (have `pushToken` and not `voipPushToken`).
  - Calls `pushService.sendVoipPushesToMultiple(...)` for iOS.
  - Calls `pushService.sendCallInvitesToMultiple(...)` for Android.

**File:** `apps/interfone-api/src/services/push.service.ts`

- Uses Expo Push API (`https://exp.host/--/api/v2/push/send`).
- `sendCallInvite`:
  - Validates Expo push token format.
  - Sends data payload:
    - `type: 'intercom_call'`.
    - `callId`, `from`, `fromName`, `apartmentNumber`, `buildingName`, `channelName`, `timestamp`, `action: 'incoming_call'`.
  - Android:
    - Data-only, high priority, `contentAvailable: true`, channel `intercom_call`.
  - iOS:
    - Same `data`, plus `title`, `body`, `sound`, `channelId`.

- `sendVoipPush`:
  - Currently also uses Expo push (with `isVoip: true` flag) as a placeholder for real VoIP pushes.
  - Payload mirrors `sendCallInvite`.

### 3.2 Mobile – Agora + CallKeep + Notifications

**Calling core:**

- `apps/expo/services/agora/AgoraService.ts`:
  - Wraps `agora-react-native-rtm` and `react-native-agora`:
    - RTM:
      - `initializeStandby()`, `warmupRTM({ timeout })`, `ensureRtmEngine`, `loginRtm`.
      - Emits `rtmMessage`, `status`, `rtmConnection*` events via a small emitter.
    - RTC:
      - `ensureRtcEngine`, `joinChannelWithUserAccount`, `leaveRtcChannel`.
      - Emits `rtcUserJoined`, `rtcUserOffline`, `rtcError`, etc.
  - Uses `/api/tokens/standby` to get RTM token for “standby” connection (morador).

- `apps/expo/services/calling/CallSession.ts`:
  - Represents a single call session:
    - `id` = `callId`.
    - `channelName`, `participants`, `callerName`, `apartmentNumber`, `buildingId`.
  - Manages state machine (`CALL_STATE_MACHINE` from `stateMachine.ts`):
    - States: `idle`, `rtm_warming`, `rtm_ready`, `ringing`, `connecting`, `connected`, `ending`, `ended`, `declined`, `failed`, etc.
  - `initialize()`:
    - Verifies RTM is connected (`agoraService.getStatus()`).
    - Subscribes to RTC events.
  - `answer()`:
    - Calls `/api/calls/:callId/answer` to get `AgoraTokenBundle`.
    - Requests mic permission via `expo-av` (`Audio.requestPermissionsAsync()`).
    - `agoraService.joinChannelWithUserAccount(...)`.
    - Sends RTM `ANSWER` signal via `agoraService.sendPeerMessage`.
  - `end()`:
    - Sends RTM `END` signal.
    - Leaves RTC channel.
    - Calls `/api/calls/:callId/end`.
  - `decline()`:
    - Sends RTM `DECLINE` signal.
    - Calls `/api/calls/:callId/decline`.

- `apps/expo/services/calling/CallCoordinator.ts`:
  - Orchestrates:
    - RTM invites.
    - VoIP push / Expo push.
    - CallKeep integration.
    - Session lifecycle.
  - Core responsibilities:
    - `initialize()`:
      - Calls `callKeepService.setup()` and subscribes to:
        - `answerCall`, `endCall`, `didLoadWithEvents`, `didActivateAudioSession`.
      - Sets up RTM listener: `agoraService.on('rtmMessage', ...)`.
      - Attempts to recover persisted session (currently no-op).
    - `handleRtmMessage()`:
      - Parses RTM messages, filters by type (`INVITE`, `END`, `DECLINE`, etc.).
      - For `INVITE`:
        - Converts RTM payload into `VoipPushData` and calls `handleIncomingPush(data)`.
      - For `END`/`DECLINE`:
        - Ends active session and CallKeep UI if necessary.
    - `handleIncomingPush(VoipPushData)`:
      - Deduplicates calls via `activeSession` and `incomingPushPromises`.
      - Calls `handleIncomingPushInternal`.
    - `handleIncomingPushInternal(VoipPushData)`:
      - Step 0: Ensures morador user context from Supabase and sets `agoraService.setCurrentUser(...)`.
      - Step 1: `warmupRTM()` via AgoraService (RTM standby).
      - Optionally shows CallKeep incoming UI (currently duplicates background behaviour).
      - Step 2: `fetchCallDetails(callId)` from `/api/calls/:callId/status`.
      - Step 3: Instantiates `CallSession` and sets `activeSession`.
      - Step 4: `session.initialize()`.
    - `handleCallKeepAnswer(callId)`:
      - Brings app to foreground with `callKeepService.backToForeground()`.
      - Calls `ensureSessionExists(callId)` → `answerActiveCall()`.
    - `handleCallKeepEnd(callId)`:
      - Calls `endActiveCall('decline')`.

**CallKeep service:**

- `apps/expo/services/calling/CallKeepService.ts`:
  - Wraps `react-native-callkeep` with a small service:
    - `setup()`:
      - iOS: `RNCallKeep.setup({ ios: { appName: 'James Avisa' } })`.
      - Android: same config plus `foregroundService` (channel for background audio).
      - Skips setup on emulators.
      - Registers RNCallKeep event listeners:
        - `answerCall`, `endCall`, `didLoadWithEvents`, `didActivateAudioSession`.
      - Emits normalized events via an `EventEmitter` (`expo-modules-core`).
    - `displayIncomingCall(callId, handle, callerName, hasVideo)`:
      - Calls `RNCallKeep.displayIncomingCall(...)` if `isAvailable`.
    - `endCall`, `reportEndCallWithUUID`, `setAvailable`, `backToForeground`, `setCurrentCall`.
    - `addEventListener` (JS subscription API).

**Notifications & background handling (Android + iOS):**

- `apps/expo/index.js`:
  - On Android:
    - Creates the CallKeep notification channel `com.porteiroapp.callkeep` via `Notifications.setNotificationChannelAsync`.
  - Imports:
    - `./services/backgroundNotificationTask` (registers background task).
    - `./services/calling/earlyInit` (initializes `CallCoordinator` early).
  - Boots Expo Router entry (`expo-router/entry`).

- `apps/expo/services/backgroundNotificationTask.ts`:
  - Declares `BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK'`.
  - Defines `callKeepOptions` at module level (mirroring `CallKeepService` options).
  - `TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => { ... })`:
    - Extracts notification payload from the various Expo shapes.
    - If `notificationData.type === 'intercom_call'`:
      - Builds `IncomingCallData` with `callId`, `callerName`, `apartmentNumber`, `channelName`, `from`, `timestamp`.
      - On Android:
        - Calls `RNCallKeep.setup(callKeepOptions)` and `RNCallKeep.setAvailable(true)` inside the task.
        - Calls `RNCallKeep.displayIncomingCall(callId, from, callerName, 'generic', false)`.
      - Builds `VoipPushData` and calls `callCoordinator.handleIncomingPush(pushData)` in background.
  - Provides helpers:
    - `registerBackgroundNotificationTask()`, `isBackgroundTaskRegistered()`, `unregisterBackgroundNotificationTask()`.

- `apps/expo/services/notificationHandler.ts`:
  - Single `Notifications.setNotificationHandler`:
    - For `data.type === 'intercom_call'`:
      - Shows alert/banner, no sound, high priority (Android).
    - For other types: standard behaviour with sound.
  - Configures Android channels (`default`, `visitor`, `delivery`, `emergency`, `intercom_call`, `call`).
  - iOS categories for call actions (answer/decline).
  - Push token change listener:
    - Updates `profiles.push_token` or `admin_profiles.push_token`.

**VoIP push (iOS):**

- `apps/expo/plugins/withVoipCallKit/*`:
  - `VoipCallKitHandler.mm`:
    - Implements `PKPushRegistryDelegate`.
    - On `didUpdatePushCredentials`:
      - Posts `voipPushTokenUpdated` NSNotification with hex token.
    - On `didReceiveIncomingPushWithPayload`:
      - Extracts `callId`, `callerName`, `channelName`, `from`, `apartmentNumber`.
      - Builds `callKeepPayload`.
      - Generates `uuid` (uses `callId` if valid UUID, otherwise random).
      - Calls `RNCallKeep.reportNewIncomingCall(uuid, handle:from, payload:callKeepPayload, ...)`.
      - Posts `voipPushReceived` notification with payload.
      - Calls `completion()`.

- `apps/expo/utils/voipPushNotifications.ts`:
  - Uses `react-native-voip-push-notification` (iOS only):
    - `initialize(userId, userType)`:
      - Calls `VoipPushNotification.registerVoipToken()`.
      - Sets up listeners:
        - `'register'` → saves `voip_push_token` to DB (`profiles` / `admin_profiles`).
        - `'notification'` → parses payload into `VoipPushData` and calls `callCoordinator.handleIncomingPush(...)`.

---

## 4. Design Principles for the New Implementation

1. **Single source of truth per responsibility:**
   - Backend:
     - Responsible for call creation, Agora tokens, and sending push payloads.
   - Mobile JS (CallCoordinator/CallSession/AgoraService):
     - Responsible for RTM/RTC, session lifecycle, and mapping OS/CallKeep events to call actions.
   - CallKeep:
     - Only responsible for:
       - Native incoming call UI.
       - Surfacing answer/decline actions and audio session lifecycle.
   - Notifications:
     - `expo-notifications` is the only push transport.
     - `expo-task-manager` is the only background entry point on Android.
     - VoIP push plugin + `react-native-voip-push-notification` is the only PushKit integration on iOS.

2. **ID invariants:**
   - `callId` is the canonical identifier across:
     - Backend DB (`calls.id`).
     - Push payload (`data.callId`).
     - RTM signals (`callId` field).
     - `CallSession.id`.
     - CallKeep call identifier:
       - Android: use `callId` as `callUUID`.
       - iOS: prefer `callId` as UUID; otherwise map `callId` ↔ CallKit `uuid` via payload.

3. **Background-safe behaviour:**
   - All background work (Android):
     - Runs inside `BACKGROUND-NOTIFICATION-TASK`.
     - Must avoid UI primitives (`Alert`) and rely only on logging and backend calls.
   - iOS VoIP:
     - CallKit reporting must happen inside PushKit delegate (Objective‑C) before `completion()` (mirroring Twilio).
   - Any errors in RTM/RTC warmup when app is not active:
     - Must degrade gracefully (auto decline and end CallKeep UI), not crash.

4. **Parity with Twilio flows:**
   - Use the Twilio flows as a checklist:
     - App killed:
       - Push arrives → OS-specific mechanism (FCM/PushKit) →
       - Background handler shows native UI →
       - JS session created lazily when app starts.
     - Answer:
       - Native UI triggers event (`answerCall`) →
       - JS ensures session exists → answers via Agora.
     - End:
       - Native UI triggers event (`endCall`) or remote end signal →
       - JS ends session and dismisses native UI.

---

## 5. Detailed Implementation Plan

### 5.1 Backend: Payload & Token Consistency

**Goals:**

- Ensure push payloads contain everything the mobile app needs without extra APIs where possible.
- Keep call-related metadata consistent across RTM, Expo push, and iOS VoIP payloads.

**Steps:**

1. **Enforce canonical payload shape in `startCall`:**
   - In `call.controller.ts`:
     - Ensure `baseCallData` (used for push) is built once and reused:
       ```ts
       const baseCallData = {
         callId,
         from: String(effectiveDoormanId),
         fromName: doorman.full_name || 'Porteiro',
         apartmentNumber,
         buildingName: apartment.building_name,
         channelName,
         metadata: {
           schemaVersion: payloadVersion,
           clientVersion: clientVersion ?? null,
         },
       };
       ```
     - Use `baseCallData` for:
       - RTM `invitePayload.context` (optional mirror).
       - `pushService.sendCallInvitesToMultiple(baseCallData, ...)`.
       - `pushService.sendVoipPushesToMultiple(baseCallData, ...)`.

2. **Keep Expo push payload aligned with mobile expectations:**
   - In `push.service.ts::sendCallInvite` and `sendVoipPush`:
     - Ensure `data` entries:
       - `type: 'intercom_call'`.
       - `callId`, `from`, `fromName`, `apartmentNumber`, `buildingName`, `channelName`.
       - `timestamp: Date.now().toString()`.
       - Optional `metadata` if needed for schema versioning.

3. **Token hygiene:**
   - Ensure `registerPushTokenAfterLogin(...)` (mobile) is called on each successful login and:
     - Saves Expo token into `profiles.push_token` / `admin_profiles.push_token`.
     - Enables `notification_enabled`.
   - Ensure `voipPushNotifications.initialize(...)`:
     - Saves `voip_push_token` for iOS.
   - Server already filters by `notification_enabled` and presence of tokens; keep that logic.

### 5.2 Expo Notifications + Background Task Lifecycle

**Goals:**

- Single, predictable notification handling path.
- Ensure background task is registered exactly once and before any push is received.

**Steps:**

1. **Enforce single notification handler:**
   - Confirm no other `Notifications.setNotificationHandler` calls exist (beyond `notificationHandler.ts`).
   - For `type === 'intercom_call'` in `notificationHandler.ts`:
     - Keep `shouldShowAlert: true`, `shouldPlaySound: false` (ringtone handled later).
     - Keep Android priority as `MAX`.

2. **Guarantee background task registration:**
   - In a top-level bootstrap (e.g. app layout/provider, not inside screens), ensure:
     ```ts
     import { initializeNotificationHandler } from '~/services/notificationHandler';
     import { registerBackgroundNotificationTask } from '~/services/backgroundNotificationTask';

     useEffect(() => {
       void (async () => {
         await initializeNotificationHandler();
         await registerBackgroundNotificationTask();
       })();
     }, []);
     ```
   - Ensure this runs only once per app process and before user might receive a call (init on login / app start).

3. **Index bootstrap:**
   - Keep `apps/expo/index.js`:
     - Android: CallKeep notification channel (`com.porteiroapp.callkeep`).
     - Import `backgroundNotificationTask` and `calling/earlyInit` at module scope to:
       - Register the task.
       - Initialize `CallCoordinator` early in the main app process.

### 5.3 CallKeep Integration – Android (Twilio-style)

**Goals:**

- Use CallKeep as the native UI for incoming calls on Android.
- Ensure background `expo-task-manager` handler is the only background entry point (like Twilio’s FCM handler).

**Steps:**

1. **Unify CallKeep configuration:**
   - Ensure `callKeepOptions` in `backgroundNotificationTask.ts` and `CallKeepService.setup()` use the same configuration:
     - `foregroundService.channelId` = `'com.porteiroapp.callkeep'`.
     - Same `channelName` / `notificationTitle` as defined in `index.js`.
   - If necessary, extract `callKeepOptions` into a shared module imported by both files for consistency.

2. **Background task: show CallKeep UI (app killed/background):**
   - In `BACKGROUND-NOTIFICATION-TASK`:
     - After extracting `notificationData`:
       - Only handle `notificationData.type === 'intercom_call'`.
     - Build `IncomingCallData` as already done.
     - Android branch:
       ```ts
       let callKeepAvailable = false;
       if (Platform.OS === 'android') {
         try {
           await RNCallKeep.setup(callKeepOptions);
           RNCallKeep.setAvailable(true);
           callKeepAvailable = true;
         } catch (e) {
           callKeepAvailable = false;
         }
       }
       if (callKeepAvailable && Platform.OS === 'android') {
         try {
           RNCallKeep.displayIncomingCall(callData.callId, callData.from, callData.callerName, 'generic', false);
         } catch (e) {
           callKeepAvailable = false;
         }
       }
       ```
     - Always call `callCoordinator.handleIncomingPush(pushData)` after the CallKeep logic.
       - This mirrors Twilio’s pattern: background handler both invokes CallKeep and forwards payload to the JS call orchestrator.

3. **Main app process: CallKeepService → CallCoordinator:**
   - `CallCoordinator.initialize()` (triggered by `earlyInit`) already:
     - Calls `callKeepService.setup()`:
       - On Android: will call `RNCallKeep.setup` again if needed (idempotent) and register listeners:
         - `answerCall`, `endCall`, `didLoadWithEvents`, `didActivateAudioSession`.
     - Subscribes to CallKeep events to:
       - Answer: `handleCallKeepAnswer(callId)`.
       - End: `handleCallKeepEnd(callId)`.
       - Early events: `handleEarlyEvents(events)`.
   - Ensure `CallKeepService.setup()`:
     - Treats repeated setup calls gracefully (no crash on already-registered account).
     - Does not assume `CallCoordinator` is already initialized (since `earlyInit` ensures it is).

4. **Eliminate duplicate `displayIncomingCall` calls on Android:**
   - Today:
     - Background task displays CallKeep UI.
     - `CallCoordinator.handleIncomingPushInternal` also calls `callKeepService.displayIncomingCall(...)` after RTM warmup.
   - To avoid duplicate UI:
     - Introduce a flag or parameter:
       - E.g. include `source: 'background' | 'foreground'` in `VoipPushData`.
       - When `handleIncomingPush` is called from the background task, set `source: 'background'`.
     - In `handleIncomingPushInternal`:
       - Only call `callKeepService.displayIncomingCall` if `source !== 'background'`.

5. **ID mapping on Android:**
   - Use `callId` as the CallKeep `callUUID`:
     - Background task: `displayIncomingCall(callId, ...)`.
     - `CallKeepService` normalizes:
       - `payload.callUUID || payload.callId || payload.uuid || payload.id`.
     - `CallCoordinator.handleCallKeepAnswer(callId)` and `.handleCallKeepEnd(callId)` then use `callId` directly to look up `activeSession`.

### 5.4 Android Incoming Call Flows – End-to-End

#### 5.4.1 App killed

1. Backend sends Expo push (`type: 'intercom_call'`, `callId`, `channelName`, etc.) to resident.
2. OS delivers push:
   - Expo invokes `BACKGROUND-NOTIFICATION-TASK`.
3. `BACKGROUND-NOTIFICATION-TASK`:
   - Extracts data → builds `IncomingCallData`.
   - Android:
     - `RNCallKeep.setup(callKeepOptions)` + `setAvailable(true)`.
     - `displayIncomingCall(callId, from, callerName, ...)`.
   - Calls `callCoordinator.handleIncomingPush(pushData)`:
     - This runs in a headless context; `handleIncomingPush`:
       - Warmups RTM (if possible).
       - Fetches call details.
       - Creates `CallSession` (`activeSession`).
4. User sees OS incoming call UI (CallKeep).
5. On answer:
   - System launches main app process (if not running).
   - `apps/expo/index.js`:
     - Imports `backgroundNotificationTask` (already defined) and `earlyInit`.
   - `earlyInit` calls `callCoordinator.initialize()`:
     - `callKeepService.setup()` attaches `answerCall`/`endCall` listeners.
6. CallKeep `'answerCall'` event:
   - `CallKeepService` normalizes call ID and emits `answerCall({ callId })`.
   - `CallCoordinator.handleCallKeepAnswer(callId)`:
     - `callKeepService.backToForeground()` & `setCurrentCall(callId)`.
     - Calls `ensureSessionExists(callId)`:
       - Waits for `activeSession` (which may have been created in background).
     - Calls `answerActiveCall()` → `CallSession.answer()`:
       - `/api/calls/:callId/answer` → Agora tokens.
       - `agoraService.joinChannelWithUserAccount`.
       - RTM `ANSWER` signals.
7. On end (user or remote):
   - `CallCoordinator.endActiveCall(...)`:
     - Ends CallKeep UI via `callKeepService.endCall(callId)` and completes session → backend `/end`.

#### 5.4.2 App in background

The flow is identical to the killed case:

- Background task still runs when the push arrives.
- CallKeep UI is shown even though app process is already alive.
- Answer triggers the same `answerCall` event; `CallCoordinator` and `CallSession` are already initialized in memory, so `ensureSessionExists(callId)` resolves quickly.

#### 5.4.3 App in foreground

1. Push arrives:
   - `notificationHandler` shows a banner; no background task is required for simple foreground behaviour.
2. RTM `INVITE` (if the app is connected via standby) triggers:
   - `CallCoordinator.handleRtmMessage(...)`:
     - Converts RTM invite → `VoipPushData` and calls `handleIncomingPush`.
3. `handleIncomingPushInternal`:
   - Warmups RTM (likely already connected).
   - Fetches call details.
   - Creates `CallSession`.
   - Optionally shows CallKeep incoming UI for foreground (or uses `FullScreenCallUI` exclusively, depending on UX decision).

### 5.5 iOS – VoIP Push + CallKit + Agora

**Goals:**

- Primary path: VoIP push (PushKit) → CallKit (via `VoipCallKitHandler.mm`) → JS `CallCoordinator` → Agora.
- Secondary path: Expo push used only for non-call notifications or as fallback.

**Steps:**

1. **VoIP token registration:**
   - `voipPushNotifications.initialize(userId, userType)` (called inside `registerPushTokenAfterLogin`) should:
     - Register VoIP token via `VoipPushNotification.registerVoipToken()`.
     - Save the token to DB as `voip_push_token`.
   - Backend `startCall` already reads `voip_push_token` and builds iOS recipients.

2. **VoIP payload shape:**
   - `push.service.ts::sendVoipPush`:
     - Ensure `data` includes:
       - `type: 'intercom_call'`.
       - `callId`, `from`, `fromName`, `apartmentNumber`, `buildingName`, `channelName`, `timestamp`, `isVoip: true`.

3. **CallKit reporting (already implemented):**
   - `VoipCallKitHandler.mm`:
     - On `didReceiveIncomingPushWithPayload`:
       - Extracts `callId`, `callerName`, `channelName`, `from`, `apartmentNumber`.
       - Builds `callKeepPayload`.
       - Generates `uuid`:
         - Uses `callId` if it’s a valid UUID.
         - Else generates random `NSUUID`.
       - Reports new incoming call via `RNCallKeep.reportNewIncomingCall` with `callKeepPayload`.
       - Posts `voipPushReceived` for JS.
       - Calls `completion()`.

4. **JS handling of VoIP push:**

There are two overlapping mechanisms:

- `voipPushNotifications.ts` (JS `react-native-voip-push-notification`).
- `VoipCallKitHandler.mm` (native PushKit + RNCallKeep).

To align with Twilio:

1. **Let Obj‑C be responsible for CallKit**:
   - Keep CallKit reporting in `VoipCallKitHandler.mm`.
2. **Let JS be responsible for Agora + session**:
   - When VoIP push arrives:
     - Either rely on `react-native-voip-push-notification` `'notification'` event:
       - It receives the original payload; `voipPushNotifications.handleIncomingVoipPush` already extracts `callId`, `callerName`, `channelName`, etc., and calls `callCoordinator.handleIncomingPush(pushData)`.
     - Or add a bridge for the `voipPushReceived` NSNotification to JS (if needed) and call `CallCoordinator` from there.
   - Keep logic in `handleIncomingVoipPush`:
     - Exactly parallel to Android’s `handleIncomingPushInternal`:
       - Ensure user context.
       - Warmup RTM.
       - Fetch call details.
       - Create `CallSession`.

5. **ID mapping between CallKit and `CallSession`:**

On iOS, CallKeep events provide:

- `callUUID` (the UUID used in `reportNewIncomingCall`).
- Potentially a `payload` (if RNCallKeep forwards `payload` from `reportNewIncomingCall`).

To mirror Twilio’s `didDisplayIncomingCall` logic:

1. **Enhance `CallKeepService` iOS event handling:**
   - Add `RNCallKeep.addEventListener('didDisplayIncomingCall', ...)` inside `setupEventListeners` (iOS only):
     - Extract `callUUID` and `payload.callId` from event.
     - Store mapping in a small map:
       - `uuidToCallId[callUUID] = payload.callId`.
   - Adjust `answerCall`/`endCall` payload normalization:
     - When normalizing `callId`, check:
       - `payload.callId` (if present).
       - Else use `payload.callUUID`/`uuid`/`id`.
     - Optionally, look up `uuidToCallId[payload.callUUID]` to get the canonical `callId`.
   - Emit normalized `{ callId }` to `CallCoordinator`.

2. **`CallCoordinator.handleCallKeepAnswer(callId)` on iOS:**
   - Same logic as Android:
     - `callKeepService.backToForeground()` is Android-only; skip for iOS.
     - `ensureSessionExists(callId)` then `answerActiveCall()`.

6. **Foreground iOS behaviour:**

When app is foreground:

- VoIP push still arrives via PushKit and CallKit; there’s no concept of a “foreground-only” path — call is always reported to CallKit.
- Keep handling:
  - VoIP push → CallKit UI (via Obj‑C).
  - JS `voipPushNotifications.handleIncomingVoipPush` → `CallCoordinator.handleIncomingPush`.
  - Answering from CallKit triggers same `answerCall` flow as on Android.

### 5.6 Error Handling, Race Conditions, and Observability

**Race conditions to guard against:**

- Background session creation vs. answer:
  - `CallCoordinator.ensureSessionExists(callId)` already:
    - Waits for `incomingPushPromises` or `sessionCreated` events.
  - Ensure it’s called for both Android and iOS `handleCallKeepAnswer`.

- Duplicate calls:
  - `handleIncomingPush`:
    - Ensures only one `Promise` per `callId` in `incomingPushPromises`.
    - Returns early if `activeSession.id === callId`.

- RTM warmup failures:
  - In `handleIncomingPushInternal`:
    - If `warmupRTM()` returns false:
      - In foreground: show retry Alert.
      - In background/headless:
        - Skip Alert; instead:
          - Call `declineCall(callId, 'connection_failed')`.
          - End CallKeep UI (`callKeepService.endCall(callId)` on Android; `RNCallKeep.endCall` equivalent on iOS if needed).

**Logging and observability:**

- Maintain clear logs in all critical paths:
  - Background task: `[BackgroundTask]`, with `callId`, `channelName`, `from`.
  - CallCoordinator: `[CallCoordinator]`, `handleIncomingPush`, `warmupRTM`, `handleCallKeepAnswer`, etc.
  - CallSession: `[CallSession]`, state transitions, Agora join, API calls.
  - AgoraService: `[AgoraService]`, RTM/RTC status logs, token renewal.
  - Backend: `startCall`, `answerCall`, `endCall`, `declineCall`, push sending.

---

## 6. Summary Checklist

**Backend**

- [ ] Ensure `baseCallData` is consistent across RTM, Android Expo push, and iOS VoIP push.
- [ ] Confirm `callId` is stable and unique (prefer UUID).
- [ ] Ensure residents have up-to-date `push_token` and `voip_push_token`.

**Mobile – Cross-cutting**

- [ ] Use only `notificationHandler.ts` for `setNotificationHandler`.
- [ ] Initialize `notificationHandler` and `backgroundNotificationTask` exactly once at bootstrap.
- [ ] Keep `callId` as canonical ID everywhere.

**Android**

- [ ] `BACKGROUND-NOTIFICATION-TASK`:
  - [ ] Extract `intercom_call` payload reliably.
  - [ ] `RNCallKeep.setup` + `setAvailable` + `displayIncomingCall(callId, ...)`.
  - [ ] Call `callCoordinator.handleIncomingPush(pushData)` after showing UI.
- [ ] `CallKeepService.setup`:
  - [ ] Idempotent CallKeep setup.
  - [ ] Event listeners: `answerCall`, `endCall`, `didLoadWithEvents`, `didActivateAudioSession`.
- [ ] `CallCoordinator`:
  - [ ] Avoid double `displayIncomingCall` when called from background.
  - [ ] Ensure `handleCallKeepAnswer` uses `ensureSessionExists` + `answerActiveCall`.
  - [ ] Ensure `handleCallKeepEnd` calls `endActiveCall('decline')`.

**iOS**

- [ ] VoIP push:
  - [ ] `voipPushNotifications.initialize` invoked on login.
  - [ ] `voip_push_token` stored server-side.
  - [ ] Backend sends `sendVoipPush` with `type: 'intercom_call'`.
- [ ] `VoipCallKitHandler.mm`:
  - [ ] Correct extraction of `callId`, `callerName`, `channelName`.
  - [ ] `RNCallKeep.reportNewIncomingCall` called inside PushKit callback.
  - [ ] `completion()` always called.
- [ ] `CallKeepService`:
  - [ ] Add `didDisplayIncomingCall` listener to map `callUUID` ↔ `callId`.
  - [ ] Normalize `answerCall`/`endCall` payloads to canonical `callId`.
- [ ] `CallCoordinator`:
  - [ ] `handleCallKeepAnswer(callId)` and `handleCallKeepEnd(callId)` wired for iOS as well.

Implementing the above will give Porteiro’s Agora-based call stack the same robustness and UX guarantees as the Twilio reference (`react-native-twilio-phone`), while staying fully aligned with Expo’s notification and background execution model.

