# Incoming Call Lifecycle Diagram

## Complete Flow: Backend → Mobile → Answer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          1. BACKEND: Call Initiation                         │
│                    apps/interfone-api/src/controllers/call.controller.ts      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST /api/calls/start                                                      │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Validates apartment, doorman (lines 30-36)                              │
│  • Creates call record in DB (line 65)                                     │
│  • Generates channelName (lines 81-98)                                      │
│  • Fetches residents (line 103)                                             │
│  • Creates baseCallData (lines 261-272):                                   │
│    { callId, from, fromName, apartmentNumber,                              │
│      buildingName, channelName, metadata }                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          2. BACKEND: Push Notifications                     │
│                    apps/interfone-api/src/services/push.service.ts           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐      ┌───────────────────────┐
        │   Android (Expo Push) │      │   iOS (VoIP Push)      │
        │   sendCallInvite()     │      │   sendVoipPush()       │
        │   ──────────────────   │      │   ──────────────────   │
        │   • Data-only payload  │      │   • Data-only payload  │
        │   • type: 'intercom_   │      │   • type: 'intercom_   │
        │     call'              │      │     call'              │
        │   • callId, from,      │      │   • callId, from,      │
        │     channelName, etc.  │      │     channelName, etc.  │
        │   • High priority      │      │   • isVoip: true       │
        │   • contentAvailable:  │      │   • High priority      │
        │     true               │      │   • contentAvailable:  │
        │                        │      │     true               │
        │   Lines 68-203         │      │   Lines 235-342        │
        └───────────────────────┘      └───────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   3. MOBILE: Push Notification Received                      │
│                         (App State: Killed/Background/Foreground)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐      ┌───────────────────────┐
        │   ANDROID PATH        │      │   iOS PATH             │
        │                       │      │                       │
        │   Background Task     │      │   PushKit Delegate    │
        │   ──────────────────   │      │   ──────────────────   │
        │   apps/expo/services/ │      │   VoipCallKitHandler. │
        │   backgroundNotifica- │      │   mm                  │
        │   tionTask.ts         │      │                       │
        │                       │      │   didReceiveIncoming-  │
        │   TaskManager.define-  │      │   PushWithPayload     │
        │   Task()              │      │   (lines 60-120)      │
        │   (lines 53-204)      │      │                       │
        │                       │      │   1. Extract callId,  │
        │   1. Extract payload  │      │      callerName, etc │
        │      (lines 79-119)   │      │      (lines 68-75)    │
        │                       │      │                       │
        │   2. Setup CallKeep   │      │   2. Report to       │
        │      (lines 144-155)  │      │      CallKit         │
        │                       │      │      (lines 100-111) │
        │   3. Display incoming  │      │                       │
        │      call UI          │      │   3. Post NSNotifica-│
        │      (lines 158-172)   │      │      tion for JS     │
        │                       │      │      (lines 114-116)  │
        │   4. Call CallCoordi-  │      │                       │
        │      nator.handleIn-  │      │   4. Call completion()│
        │      comingPush()     │      │      (line 119)       │
        │      with source:      │      │                       │
        │      'background'     │      │                       │
        │      (lines 177-187)  │      │                       │
        └───────────────────────┘      └───────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   4. MOBILE: CallCoordinator Orchestration                   │
│              apps/expo/services/calling/CallCoordinator.ts                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  handleIncomingPush(data: VoipPushData)                                     │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Check for duplicate calls (lines 275-279)                                │
│  • Check for in-progress creation (lines 281-286)                           │
│  • Auto-decline if already in call (lines 288-293)                          │
│  • Create promise and call handleIncomingPushInternal() (lines 295-303)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  handleIncomingPushInternal(data: VoipPushData)                             │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Step 0: Ensure User Context (lines 312-338)                                │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Get Supabase session                                                      │
│  • Fetch morador profile                                                     │
│  • Set AgoraService current user                                            │
│                                                                              │
│  Step 1: Warmup RTM (lines 340-361)                                         │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Call warmupRTM() with 6s timeout                                         │
│  • If fails:                                                                 │
│    - Background: decline call + end CallKeep UI (lines 349-355)             │
│    - Foreground: show retry dialog (line 359)                                │
│                                                                              │
│  Step 2: Display CallKeep UI (if needed) (lines 365-377)                    │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Skip if source === 'background' (Android already showed UI)              │
│  • Skip if iOS (CallKit already shown by native handler)                    │
│  • Show UI for foreground RTM invites                                       │
│                                                                              │
│  Step 3: Fetch Call Details (lines 379-387)                                 │
│  ────────────────────────────────────────────────────────────────────────   │
│  • GET /api/calls/:callId/status                                             │
│  • Get channelName, participants, doormanName, etc.                         │
│                                                                              │
│  Step 4: Create CallSession (lines 398-412)                                 │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Instantiate CallSession with call data                                   │
│  • Call session.initialize()                                                │
│  • Set activeSession                                                         │
│  • Emit 'sessionCreated' event                                              │
│                                                                              │
│  Step 5: Setup Session Listeners (lines 418-440)                           │
│  ────────────────────────────────────────────────────────────────────────   │
│  • Listen for state changes (ending/ended/declined → end CallKeep UI)        │
│  • Listen for errors                                                         │
│  • Start remote hangup polling (detect if porteiro cancels)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   5. USER ACTION: Answer/Decline                             │
│                    (Native CallKeep UI - CallKit/ConnectionService)         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐      ┌───────────────────────┐
        │   User Taps Answer    │      │   User Taps Decline   │
        │                       │      │                       │
        │   CallKeepService     │      │   CallKeepService     │
        │   ──────────────────   │      │   ──────────────────   │
        │   • answerCall event  │      │   • endCall event     │
        │   • Normalize callId │      │   • Normalize callId  │
        │     (UUID mapping on │      │     (UUID mapping on  │
        │      iOS)            │      │      iOS)             │
        │   • Emit to          │      │   • Emit to           │
        │     CallCoordinator  │      │     CallCoordinator   │
        │                       │      │                       │
        │   Lines 230-238       │      │   Lines 241-249       │
        └───────────────────────┘      └───────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   6. CallCoordinator: Handle User Action                     │
│              apps/expo/services/calling/CallCoordinator.ts                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐      ┌───────────────────────┐
        │   handleCallKeepAnswer│      │   handleCallKeepEnd   │
        │   (lines 826-844)     │      │   (lines 849-857)     │
        │   ──────────────────   │      │   ──────────────────   │
        │   1. Bring app to     │      │   1. Call endActive-  │
        │      foreground       │      │      Call('decline')   │
        │   2. Set current call │      │   2. Session.decline()│
        │   3. Ensure session   │      │   3. End CallKeep UI  │
        │      exists (wait if  │      │   4. Call backend     │
        │      still creating)  │      │      /api/calls/:id/  │
        │   4. Call answerActive│      │      decline          │
        │      Call()           │      │                       │
        └───────────────────────┘      └───────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   7. CallSession: Answer Flow                               │
│              apps/expo/services/calling/CallSession.ts                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  answer() method                                                            │
│  ────────────────────────────────────────────────────────────────────────   │
│  1. POST /api/calls/:callId/answer                                          │
│     • Get Agora token bundle                                                │
│  2. Request mic permission (expo-av)                                       │
│  3. Join Agora RTC channel                                                  │
│     • agoraService.joinChannelWithUserAccount()                             │
│  4. Send RTM ANSWER signal                                                  │
│  5. Transition state: ringing → connecting → connected                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   8. CALL CONNECTED                                         │
│                                                                              │
│  • Agora RTC audio stream active                                            │
│  • CallKeep UI shows "Connected" state                                      │
│  • CallSession state: 'connected'                                           │
│  • Remote hangup polling stops (user answered)                             │
│  • CallKeepService.setCurrentCallActive() called                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   9. CALL ENDING                                            │
│                                                                              │
│  User or Remote Ends Call:                                                   │
│  ────────────────────────────────────────────────────────────────────────   │
│  • CallCoordinator.endActiveCall()                                          │
│  • CallSession.end() or .decline()                                          │
│  • Send RTM END signal                                                      │
│  • Leave Agora RTC channel                                                  │
│  • POST /api/calls/:callId/end                                              │
│  • CallKeepService.endCall() - dismiss native UI                           │
│  • Clear activeSession                                                      │
│  • Cleanup UUID mapping (iOS)                                              │
│  • Emit 'sessionEnded' event                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Code References

### Backend
- **Call Initiation**: `apps/interfone-api/src/controllers/call.controller.ts:16-372`
- **Push Service**: `apps/interfone-api/src/services/push.service.ts:68-365`
- **Payload Structure**: `call.controller.ts:261-272` (baseCallData)

### Mobile - Android Path
- **Background Task**: `apps/expo/services/backgroundNotificationTask.ts:53-204`
- **CallKeep Setup**: `backgroundNotificationTask.ts:144-155`
- **Display UI**: `backgroundNotificationTask.ts:158-172`
- **CallCoordinator Call**: `backgroundNotificationTask.ts:177-187`

### Mobile - iOS Path
- **VoIP Handler**: `apps/expo/plugins/withVoipCallKit/ios/VoipCallKitHandler.mm:60-120`
- **CallKit Report**: `VoipCallKitHandler.mm:100-111`
- **UUID Mapping**: `apps/expo/services/calling/CallKeepService.ts:214-234`

### Mobile - Common Flow
- **CallCoordinator Entry**: `apps/expo/services/calling/CallCoordinator.ts:272-304`
- **Internal Handler**: `CallCoordinator.ts:310-446`
- **RTM Warmup**: `CallCoordinator.ts:494-512`
- **Session Creation**: `CallCoordinator.ts:398-412`
- **Answer Handler**: `CallCoordinator.ts:826-844`
- **End Handler**: `CallCoordinator.ts:849-857`

### CallKeep Service
- **Setup**: `apps/expo/services/calling/CallKeepService.ts:35-88`
- **Event Listeners**: `CallKeepService.ts:213-264`
- **UUID Mapping**: `CallKeepService.ts:214-234, 271-289`

## State Transitions

```
CallSession States (from stateMachine.ts):
idle → rtm_warming → rtm_ready → ringing → connecting → connected
                                                      ↓
                                              ending → ended
                                                      ↓
                                              declined
                                                      ↓
                                              failed
```

## Critical Timing Points

1. **iOS VoIP Push**: Must report to CallKit within completion handler (line 119)
2. **Android Background**: CallKeep UI shown before JS session creation
3. **RTM Warmup**: 6 second timeout, must complete before answer
4. **Session Creation**: Can happen in background, answer waits via `ensureSessionExists()`
5. **UUID Mapping**: iOS maps CallKit UUID → callId on `didDisplayIncomingCall`

## Error Handling

- **Background RTM Failure**: Auto-decline + end CallKeep UI (no Alert)
- **Foreground RTM Failure**: Show retry dialog
- **Duplicate Calls**: Auto-decline with 'busy' reason
- **Remote Hangup**: Polling detects via `/api/calls/:id/status`


