# React Native CallKeep Self-Managed Mode Plan (Expo CNG)

This document captures the implementation plan to enable **react-native-callkeep** in **self-managed mode** on Android, using Expo **Continuous Native Generation (CNG)**, with a fully functional incoming call UI built on `FullScreenCallUI`.

## 0. Goal

- **Android**: Use `react-native-callkeep` in **self-managed** mode with:
  - Expo CNG (prebuild, config plugins, no long-lived manual manifest edits).
  - A fully functional incoming call UI using the existing `FullScreenCallUI`.
- **iOS**: Keep the existing **CallKit** integration (no self-managed equivalent), while keeping UI decisions consistent with platform capabilities.

Relevant files:

- `apps/expo/services/calling/CallKeepService.ts`
- `apps/expo/services/calling/CallCoordinator.ts`
- `apps/expo/services/calling/CallSession.ts`
- `apps/expo/services/agora/AgoraService.ts`
- `apps/expo/services/backgroundNotificationTask.ts`
- `apps/expo/providers/CallManagerProvider.tsx`
- `apps/expo/plugins/withAndroidFullScreenIntent.js`
- `apps/expo/plugins/withCallKeepConnectionService.js`
- `apps/expo/index.js`

---

## 1. Android: Enable Self-Managed CallKeep With CNG

### 1.1. Turn on `selfManaged` in `CallKeepService`

**File**: `apps/expo/services/calling/CallKeepService.ts`

1. In `setup()`, update the Android options passed to `RNCallKeep.setup`:

   ```ts
   const options = {
     ios: {
       appName: 'James Avisa',
     },
     android: {
       alertTitle: 'Permissões necessárias',
       alertDescription: 'Este app precisa de acesso à conta telefônica',
       cancelButton: 'Cancelar',
       okButton: 'OK',
       additionalPermissions: [
         // Optional: explicit permissions (e.g., READ_CALL_LOG) if needed
         // 'android.permission.READ_CALL_LOG',
       ],
       selfManaged: true, // <-- key change
       foregroundService: {
         channelId: 'com.porteiroapp.callkeep',
         channelName: 'Serviço de Chamadas',
         notificationTitle: 'Chamada recebida',
         notificationIcon: 'ic_notification',
       },
     },
   };
   ```

2. After `await RNCallKeep.setup(options)`, on **Android** also call:

   ```ts
   await RNCallKeep.registerPhoneAccount(options);
   await RNCallKeep.registerAndroidEvents();
   ```

3. Keep using `this.setAvailable(true)` to mark availability (which already calls `RNCallKeep.setAvailable` on Android).

4. Preserve the emulator guard and retry behavior as is.

### 1.2. Extend existing config plugins for CNG

#### 1.2.1. Add `foregroundServiceType` to ConnectionService

**File**: `apps/expo/plugins/withCallKeepConnectionService.js`

- When pushing the `VoiceConnectionService` entry into `application.service`, ensure it has `android:foregroundServiceType` for Android 11+:

  ```js
  application.service.push({
    $: {
      'android:name': targetServiceName,
      'android:label': '@string/app_name',
      'android:exported': 'true',
      'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
      'android:foregroundServiceType': 'camera|microphone',
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.telecom.ConnectionService' } },
        ],
      },
    ],
  });
  ```

#### 1.2.2. Keep full-screen intent plugin as-is

**File**: `apps/expo/plugins/withAndroidFullScreenIntent.js`

- Ensure it continues to:
  - Add `android.permission.USE_FULL_SCREEN_INTENT`.
  - Set `android:showWhenLocked="true"` and `android:turnScreenOn="true"` on `.MainActivity`.

#### 1.2.3. Permissions strategy

- Short term: allow **manual** manifest edits for extra permissions (e.g. `READ_CALL_LOG`), as already done.
- Medium term: move remaining permissions into `ensurePermission` helpers in the plugin so everything is CNG-driven.

---

## 2. Centralize CallKeep Setup and Events in `CallKeepService`

### 2.1. Ensure `CallKeepService` is the single entrypoint

- All CallKeep operations should go through `CallKeepService`:
  - `setup`, retry logic.
  - `displayIncomingCall`, `endCall`, `reportEndCallWithUUID`, `setCurrentCall`, `backToForeground`.
- Update any direct `RNCallKeep` usage in:
  - `backgroundNotificationTask.ts`
  - `CallCoordinator.ts`
  - Other services/components (if any)

so they call the corresponding `CallKeepService` methods instead.

### 2.2. Add self-managed specific event listeners

Extend the event map:

```ts
export type CallKeepEventMap = {
  answerCall: (payload: { callId: string }) => void;
  endCall: (payload: { callId: string }) => void;
  didLoadWithEvents: (events: any[]) => void;
  didActivateAudioSession: () => void;
  showIncomingCallUi: (payload: { callId: string; handle: string; name?: string }) => void;
  silenceIncomingCall: (payload: { callId: string; handle: string; name?: string }) => void;
  createIncomingConnectionFailed: (payload: { callId: string; handle: string; name?: string }) => void;
  onHasActiveCall: () => void;
};
```

In `setupEventListeners()` (Android only):

```ts
if (Platform.OS === 'android') {
  RNCallKeep.addEventListener('showIncomingCallUi', ({ callUUID, handle, name }) => {
    const callId = String(callUUID || handle);
    this.eventEmitter.emit('showIncomingCallUi', { callId, handle, name });
  });

  RNCallKeep.addEventListener('silenceIncomingCall', ({ callUUID, handle, name }) => {
    const callId = String(callUUID || handle);
    this.eventEmitter.emit('silenceIncomingCall', { callId, handle, name });
  });

  RNCallKeep.addEventListener('createIncomingConnectionFailed', ({ callUUID, handle, name }) => {
    const callId = String(callUUID || handle);
    this.eventEmitter.emit('createIncomingConnectionFailed', { callId, handle, name });
  });

  RNCallKeep.addEventListener('onHasActiveCall', () => {
    this.eventEmitter.emit('onHasActiveCall');
  });
}
```

`CallCoordinator` will subscribe to these events via `callKeepService.addEventListener(...)`.

---

## 3. Incoming Call UI: Self-Managed Behavior

Decisions:

- Use `showIncomingCallUi` to show the app's own `FullScreenCallUI` on Android.
- On failure, show a Toast/Alert.

### 3.1. Wire `showIncomingCallUi` into `CallCoordinator`

**File**: `apps/expo/services/calling/CallCoordinator.ts`

In `initialize()`:

```ts
this.callKeepAvailable = await callKeepService.setup();

callKeepService.addEventListener('showIncomingCallUi', ({ callId, handle, name }) => {
  void this.handleShowIncomingCallUi({ callId, handle, name });
});

callKeepService.addEventListener('silenceIncomingCall', ({ callId, handle, name }) => {
  void this.handleSilenceIncomingCall({ callId, handle, name });
});

callKeepService.addEventListener('createIncomingConnectionFailed', ({ callId, handle, name }) => {
  void this.handleIncomingConnectionFailed({ callId, handle, name });
});

callKeepService.addEventListener('onHasActiveCall', () => {
  void this.handleNativeCallActive();
});
```

New methods to implement (pseudo-contracts):

- `handleShowIncomingCallUi({ callId, handle, name })`:
  - Ensure a `CallSession` exists for `callId` (use `ensureSessionExists` or similar logic).
  - If no session, create one from persisted data / API.
  - When session is ready and `!session.isOutgoing`, `emit('sessionCreated', { session })` (reusing existing event paths).
  - This causes `CallManagerProvider` to set `incomingCall` and show `FullScreenCallUI`.

- `handleSilenceIncomingCall({ callId, handle, name })`:
  - Stop any custom ringtone/vibration the app is playing.

- `handleIncomingConnectionFailed({ callId, handle, name })`:
  - End or decline the session (e.g. `session?.end('drop')` or `session?.decline('failed')`).
  - Optionally call `callKeepService.reportEndCallWithUUID(callId, reason)`.
  - Show user feedback via `Alert.alert` (or Toast):

    ```ts
    Alert.alert('Chamada falhou', 'Não foi possível conectar a chamada. Tente novamente.');
    ```

- `handleNativeCallActive()`:
  - When a GSM call becomes active while a self-managed VoIP call is in progress, end the VoIP call:

    ```ts
    if (this.activeSession) {
      await this.activeSession.end('drop');
    }
    ```

### 3.2. Update `CallManagerProvider` / `CallUIWrapper` behavior

**File**: `apps/expo/providers/CallManagerProvider.tsx`

- Goal: On **Android self-managed**, `FullScreenCallUI` should be the main incoming UI. On **iOS**, CallKit handles the ringing UI; React UI is hidden during native ringing.

In `CallUIWrapper`:

```ts
const isAndroid = Platform.OS === 'android';
const isCallKeepAvailable = callKeepService.checkAvailability();
const isRinging = state === 'ringing' || state === 'rtm_ready';

const shouldHideForNativeUI =
  !isAndroid && isCallKeepAvailable && isRinging; // hide only on iOS when CallKit is handling ringing

if (shouldHideForNativeUI) {
  return null;
}

return (
  <FullScreenCallUI
    session={session}
    onAnswer={onAnswer}
    onDecline={onDecline}
  />
);
```

Result:

- **Android self-managed**: `FullScreenCallUI` is shown when `showIncomingCallUi` fires and session enters ringing/rtm_ready.
- **iOS**: React ringing UI is hidden while CallKit displays the system incoming call screen; React UI appears primarily for active calls or fallback.

---

## 4. RTM Warmup & Failure UX

Decisions:

- Show incoming UI immediately (do not block on RTM warmup).
- Show a retry state in the UI on RTM failure.

### 4.1. Decouple incoming UI from RTM warmup

**Files**: `CallCoordinator.ts`, `backgroundNotificationTask.ts`, `CallSession.ts`

- In `CallCoordinator.handleIncomingPushInternal`:
  - Start `warmupRTM()` in the background, but **do not block** session creation or CallKeep UI.
  - The flow becomes:
    1. Create/persist `CallSession`.
    2. Invoke CallKeep (`displayIncomingCall`) promptly.
    3. Warm RTM concurrently.

- In `CallSession.initialize()`:
  - Instead of failing when `agoraService.getStatus() !== 'connected'`, treat this as a “connecting RTM” state:
    - Keep state at `rtm_warming` (or introduce `connecting_rtm`).
    - When RTM becomes `connected`, transition to `rtm_ready`.

### 4.2. Retry state on RTM failure

- When `warmupRTM()` fails in `CallCoordinator`:
  - Do **not** immediately destroy the `CallSession`.
  - Update the session state to a retryable error (e.g. `rtm_failed` in the state machine).
  - `FullScreenCallUI` reads `session.state` and:
    - Shows a message like: "Falha ao conectar. Tentar novamente?".
    - Offers buttons:
      - **Retry** → calls back into `CallCoordinator` to re-run `warmupRTM` / `initialize()`.
      - **Cancelar** → `callCoordinator.endActiveCall('decline')`.

- Additionally, show a quick `Alert` or Toast so the user gets immediate feedback.

---

## 5. Simplify Call Data Flow: Use `CallSession` as the Single Source of Truth

Decision:

- Remove the `MyCallDataManager` & `CallSession` redundancy. Move incoming call code & functions into `CallSession`.

### 5.1. Move incoming call data handling into `CallSession`

**File**: `apps/expo/services/calling/CallSession.ts`

1. Add static helpers to encapsulate incoming call creation & persistence, for example:

   - `CallSession.createFromIncomingPush(data: VoipPushData & extraPayload): Promise<CallSession>`.
   - Reuse/extend existing `save`, `load`, `clear` methods for persistence.

2. In `CallCoordinator.handleIncomingPushInternal`:

   - Replace usage of `MyCallDataManager` with `CallSession` helpers:

     ```ts
     const session = await CallSession.createFromIncomingPush({
       id: data.callId,
       channelName: data.channelName,
       callerName: data.callerName,
       apartmentNumber: data.apartmentNumber,
       // any extra fields needed
     });

     this.activeSession = session;
     await session.save();
     this.emit('sessionCreated', { session });
     ```

3. Keep `CallSession.load()` and `CallSession.clear()` as the sole persistence API for call state (crash recovery, rehydration).

### 5.2. Update `backgroundNotificationTask`

**File**: `apps/expo/services/backgroundNotificationTask.ts`

- After extracting `IncomingCallData` from the notification:

  1. Setup CallKeep via `callKeepService.setup()`.
  2. Create and persist the `CallSession` using `CallSession.createFromIncomingPush`.
  3. If Android & CallKeep available, call `callKeepService.displayIncomingCall` with `session.id` and caller info.

- This removes the need for a separate `MyCallDataManager`. `CallSession` becomes the single source of truth for:
  - `callId`, `channelName`, tokens, caller info.
  - Current lifecycle state.

---

## 6. CNG & Native Directories Strategy

Decisions:

- Treat `android/` and `ios/` as **ephemeral** long-term.
- Currently accept some **manual** manifest edits.

### 6.1. Short term

- Continue manual manifest edits where necessary (e.g. extra permissions like `READ_CALL_LOG`).
- Prefer adding new behaviors via **config plugins** (`with*`) whenever feasible.

### 6.2. Medium term

- Once self-managed mode is stable:
  - Use `npx patch-project` to capture any remaining manual tweaks to `android/` & `ios/` into patches.
  - Consider ignoring `apps/expo/android` and `apps/expo/ios` in `.gitignore` so they’re treated as generated artifacts.

---

## 7. iOS Behavior and Cross-Platform UI Consistency

Decisions:

- iOS must stick with CallKit; there is no self-managed alternative.
- Keep UI decisions consistent with platform implementations.

Plan:

1. Keep `CallKeepService.setup()` unchanged for iOS (no `selfManaged` flag).
2. Maintain current iOS behavior in `CallCoordinator` & `CallManagerProvider`:
   - CallKit handles the native incoming call UI while ringing.
   - React `FullScreenCallUI` is primarily for active calls, or fallback if CallKit is unavailable.
3. The adjusted `CallUIWrapper` logic (hide only when `!android && isRinging && isCallKeepAvailable`) ensures:
   - iOS: Hide React ringing UI while CallKit is showing native UI.
   - Android self-managed: Show React `FullScreenCallUI` as the primary incoming UI.

---

## 8. Testing & Tooling

Decisions:

- Add a manual “call debug” surface.
- Use manual testing for now.

### 8.1. Debug screen (optional but recommended)

Create a small debug view (for internal builds) that shows:

- `callCoordinator.getDebugInfo()`.
- `agoraService.getStatus()` (RTM state).
- `callKeepService.checkAvailability()`.
- Buttons to:
  - Trigger a fake incoming call flow (bypassing the backend).
  - Re-run `callKeepService.retrySetup()`.

### 8.2. Manual test scenarios

**Android**:

1. App killed → send intercom push:
   - Background task logs show call detection.
   - CallKeep incoming (self-managed) event fires; `showIncomingCallUi` wired to `CallCoordinator`.
   - `FullScreenCallUI` appears (incoming call UI).
   - Answer → Agora connects; `CallSession.state` transitions to `connected`.
   - Hang up from UI and from native; both paths cleanly end the session.

2. RTM failure:
   - Simulate network issues.
   - Verify retry UI state in `FullScreenCallUI` and Toast/Alert.

3. GSM call during VoIP:
   - Take a GSM call while VoIP call is active.
   - Ensure `onHasActiveCall` handling ends/drops VoIP call per policy.

**iOS**:

- Confirm CallKit integration behaves as before:
  - Incoming CallKit screen appears.
  - React UI appears for active calls and follows the adjusted logic.

---

## 9. Final Ordered Checklist

1. **CallKeepService**
  - [x] Add `selfManaged: true` and verify Android foreground service options.
  - [x] Call `registerPhoneAccount` and `registerAndroidEvents` on Android after setup.
  - [x] Add listeners for `showIncomingCallUi`, `silenceIncomingCall`, `createIncomingConnectionFailed`, `onHasActiveCall` and forward via `EventEmitter`.

2. **Config Plugins (CNG)**
  - [x] Update `withCallKeepConnectionService` to set `android:foregroundServiceType="camera|microphone"`.
  - [x] Ensure `withAndroidFullScreenIntent` is applied and working.
   - [ ] Optionally move remaining permissions (e.g. `READ_CALL_LOG`) into plugin helpers.

3. **Centralization**
  - [x] Replace direct `RNCallKeep` calls in other files with `CallKeepService` methods.
  - [x] Ensure `backgroundNotificationTask` uses `callKeepService.setup()` and `displayIncomingCall`.

4. **CallCoordinator**
  - [x] Subscribe to the new CallKeep events via `callKeepService.addEventListener`.
  - [x] Implement `handleShowIncomingCallUi`, `handleSilenceIncomingCall`, `handleIncomingConnectionFailed`, `handleNativeCallActive` and integrate them with `ensureSessionExists` and `activeSession`.

5. **CallSession**
  - [x] Implement `createFromIncomingPush` (or equivalent) to build/persist sessions from incoming notifications.
  - [x] Ensure `save/load/clear` remain the only persistence API.
  - [x] Relax RTM strictness in `initialize()` to support connecting and retry states.

6. **BackgroundNotificationTask**
  - [x] Use `callKeepService` for setup and `displayIncomingCall`.
  - [x] Create/persist `CallSession` using the new static helpers instead of `MyCallDataManager`.

7. **CallManagerProvider / UI**
  - [x] Adjust `CallUIWrapper` logic so that only iOS hides React UI during ringing when CallKit is active; Android self-managed always shows React `FullScreenCallUI` on `showIncomingCallUi`.

8. **Failure UX**
  - [x] Implement a retryable RTM failure state in `CallSession`/`CallCoordinator` and expose it to `FullScreenCallUI`.
  - [x] Show a Toast/Alert on critical errors (e.g. `createIncomingConnectionFailed`).

9. **Testing**
   - [ ] Run `expo prebuild --clean` and verify generated `AndroidManifest.xml` & services.
   - [ ] Validate end-to-end flows on Android (push → incoming UI → answer → end, RTM failure, GSM interop).
   - [ ] Validate iOS CallKit behavior remains correct.
