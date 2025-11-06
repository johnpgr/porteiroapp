# Changelog

## 2025-01-06 - CallKeep + Agora Integration Refactor

### Major Architectural Changes

**Problem**: Cold start call failures (~85% success), 5-8s answer delays, state desync between CallKeep native UI, React state, and Agora connection state.

**Solution**: Implemented Wazo-style architecture with single source of truth (CallSession) + coordinator pattern (CallCoordinator).

### New Architecture

**Before**:
```
VoIP Push → CallKeep UI → useAgora hook → AgoraService → Agora SDK
(4 separate state systems, async coordination gaps)
```

**After**:
```
VoIP Push → CallCoordinator → CallSession (single state) → CallKeep UI + Agora SDK
```

### Files Created

1. **`apps/expo/services/calling/CallSession.ts`** (~450 lines)
   - Single source of truth for call state
   - Manages lifecycle: initialize → answer → end
   - Persists to AsyncStorage for crash recovery
   - Emits events for state changes
   - Syncs native CallKeep state with Agora state

2. **`apps/expo/services/calling/CallCoordinator.ts`** (~400 lines)
   - Orchestrates call flow from VoIP push → answer
   - Pre-warms RTM connection (3s timeout) before showing CallKeep UI
   - Shows retry dialog on RTM failure
   - Registers CallKeep handlers ONCE (prevents re-registration)
   - Recovers persisted sessions on app restart

### Files Modified

#### Major Refactors

- **`apps/expo/services/CallKeepService.ts`**
  - Removed external handler pattern (setOnAnswer/setOnEnd/setOnToggleMute)
  - Added event emitter with type-safe events
  - Prevents handler re-registration and stale closures

- **`apps/expo/hooks/useAgora.ts`**
  - Removed ~170 lines of CallKeep handler registration
  - Handlers now in CallCoordinator (registered once)
  - Simplified call flow

#### Service Updates

- **`apps/expo/services/agora/AgoraService.ts`**
  - Added `warmupRTM({ timeout })` method
  - Races RTM connection vs timeout

- **`apps/expo/services/calling/stateMachine.ts`**
  - Added intermediate states:
    - `rtm_warming` - Connecting RTM before showing UI
    - `rtm_ready` - RTM connected, CallKeep UI showing
    - `native_answered` - User clicked answer
    - `token_fetching` - Getting Agora tokens
    - `rtc_joining` - Joining voice channel
  - Terminal states now transition back to `idle`

- **`apps/expo/utils/voipPushNotifications.ts`**
  - Delegates to CallCoordinator
  - Removed direct CallKeep display logic

- **`apps/expo/app/morador/_layout.tsx`**
  - Initializes CallCoordinator after CallKeep
  - Sets AgoraService user context
  - Removed separate RTM standby init (now on-demand)

#### UI Updates

- **`apps/expo/components/IncomingCallModal.tsx`**
  - Added compatibility note for useAgora
  - Interface unchanged (compatible during transition)

- **`apps/expo/app/morador/callkeep-status.tsx`**
  - Enhanced with comprehensive diagnostics:
    - CallKeep status (permissions, active call, UUID)
    - CallCoordinator status (initialized, has session)
    - CallSession state (if exists): state, native state, RTM ready, RTC joined
    - Agora RTM status
    - Persistence status (saved session)
    - State consistency checks

### Key Improvements

#### Event Emitter Pattern
- Handlers registered ONCE on initialization
- No re-registration on re-renders
- No stale closures
- Type-safe event payloads

#### Coordinator Pattern
- Single orchestration point for call flow
- RTM warmup before showing UI (user decision: 3s timeout)
- Retry dialog on RTM failure (user decision: show error + retry)
- Session persistence for crash recovery (user decision: yes, persist)

#### State Consistency
- CallSession is single source of truth
- Native state, RTM state, React state synchronized
- Consistency validation: `session.isConsistent()`

### New Call Flow

```
1. VoIP Push arrives
2. voipPushNotifications → CallCoordinator.handleIncomingPush()
3. CallCoordinator warms up RTM (3s timeout)
4. If RTM fails → Show retry dialog
5. If RTM ready → Create CallSession
6. Persist CallSession to storage
7. Display CallKeep UI
8. User answers (CallKeep native UI)
9. CallKeepService emits "answer" event
10. CallCoordinator.handleAnswer()
11. CallSession.answer()
    - Fetch Agora tokens
    - Join RTC channel
    - Update CallKeep UI to "connected"
```

### Benefits

- **Reliability**: 85% → 99% target answer success rate
- **Performance**: 5-8s → <2s target cold start answer time
- **State sync**: 70% → 100% target state consistency
- **Debugging**: Comprehensive debug screen with all states visible
- **Recovery**: Crash recovery via session persistence
- **Architecture**: Clean separation of concerns, easier to test

### Testing Status

Ready for Phase 4 testing:
- [ ] Cold start: App killed → VoIP push → Answer → Audio works
- [ ] Warm start: App open → Call arrives → Answer works
- [ ] RTM timeout: Slow network → Retry dialog → Success
- [ ] Crash recovery: Kill mid-call → Restart → Session restored
- [ ] State sync: CallKeep UI matches Agora state

### Migration Notes

- Old CallKeep handler registration removed from useAgora
- CallCoordinator handles all CallKeep events
- No breaking changes to IncomingCallModal API
- Debug screen enhanced for troubleshooting

### Breaking Changes

None. Architecture is backwards compatible during transition.

### Permission Flow Consolidation

**File**: `apps/expo/utils/pushNotifications.ts`

- CallKeep permissions now requested during initial login flow
- Consolidated with notification permissions for better UX
- User sees single permissions prompt instead of two separate ones
- Android: Phone account registered during login
- iOS: CallKit capability automatically granted

**Flow**:
```
User logs in
  ↓
registerPushTokenAfterLogin()
  ↓
1. Request Expo push notification permissions
2. Initialize CallKeep (morador only)
3. Request CallKeep permissions (Android only)
4. Register push token
  ↓
User navigates to morador layout
  ↓
CallKeep already initialized ✅
```

**File**: `apps/expo/app/morador/_layout.tsx`

- Added idempotency checks for CallKeep initialization
- Safe to call `initialize()` multiple times
- Permissions request is no-op if already granted

### Next Steps

1. End-to-end testing
2. Performance validation
3. User acceptance testing
4. Gradual rollout with feature flag
