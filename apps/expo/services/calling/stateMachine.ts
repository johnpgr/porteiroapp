import type { CallLifecycleState, RtmSignalType } from '@porteiroapp/common/calling';

export const CALL_STATE_MACHINE: Record<CallLifecycleState, CallLifecycleState[]> = {
  idle: ['dialing', 'ringing'],
  dialing: ['ringing', 'failed', 'ended'],
  ringing: ['connecting', 'declined', 'missed', 'failed', 'ended'],
  connecting: ['connected', 'failed', 'ended'],
  connected: ['ending', 'ended', 'failed'],
  ending: ['ended'],
  ended: [],
  declined: [],
  failed: [],
  missed: []
};

export const RTM_SIGNAL_TO_STATE: Record<RtmSignalType, CallLifecycleState> = {
  INVITE: 'ringing',
  RINGING: 'ringing',
  ANSWER: 'connecting',
  DECLINE: 'declined',
  END: 'ended'
};

export const deriveNextStateFromSignal = (
  current: CallLifecycleState,
  signal: RtmSignalType
): CallLifecycleState => {
  const target = RTM_SIGNAL_TO_STATE[signal];

  if (!target) {
    return current;
  }

  const allowedTransitions = CALL_STATE_MACHINE[current] ?? [];

  if (allowedTransitions.includes(target)) {
    return target;
  }

  return current;
};
