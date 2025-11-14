import type { CallLifecycleState as BaseCallLifecycleState, RtmSignalType } from '@porteiroapp/common/calling';

/**
 * Extended CallLifecycleState with intermediate states for CallKeep integration
 *
 * New states added:
 * - rtm_warming: Pre-connecting RTM before showing CallKeep UI
 * - rtm_ready: RTM connected, CallKeep UI showing, waiting for user answer
 * - native_answered: User clicked answer in CallKeep UI
 * - token_fetching: Fetching Agora tokens from API
 * - rtc_joining: Joining Agora RTC voice channel
 */
export type CallLifecycleState =
  | BaseCallLifecycleState
  | 'rtm_warming'
  | 'rtm_ready'
  | 'native_answered'
  | 'token_fetching'
  | 'rtc_joining';

export const CALL_STATE_MACHINE: Record<CallLifecycleState, CallLifecycleState[]> = {
  idle: ['rtm_warming', 'dialing'],
  rtm_warming: ['rtm_ready', 'failed'],
  rtm_ready: ['native_answered', 'declined', 'missed', 'ending', 'ended'],
  native_answered: ['token_fetching', 'failed'],
  token_fetching: ['rtc_joining', 'failed'],
  rtc_joining: ['connecting', 'failed'],
  dialing: ['ringing', 'failed', 'ended'],
  ringing: ['connecting', 'declined', 'missed', 'failed', 'ending', 'ended'],
  connecting: ['connected', 'failed', 'ended'],
  connected: ['ending', 'ended', 'failed'],
  ending: ['ended'],
  ended: ['idle'], // Allow transition back to idle for next call
  declined: ['idle'],
  failed: ['idle'],
  missed: ['idle']
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
