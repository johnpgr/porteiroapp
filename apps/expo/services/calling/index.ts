export type {
  CallParticipantSnapshot,
  CallStartPayload,
  CallStartResponse,
  CallParticipantRole,
  CallParticipantStatus,
  RtmSignal,
  RtmSignalType,
  RtmInviteSignal,
  AgoraTokenBundle,
  PushFallbackTarget
} from '@porteiroapp/common/calling';

export type { CallLifecycleState } from './stateMachine';
export { CALL_STATE_MACHINE, deriveNextStateFromSignal, RTM_SIGNAL_TO_STATE } from './stateMachine';
