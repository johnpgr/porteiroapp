import type { CallLifecycleState as BaseCallLifecycleState, RtmSignalType } from '~/types/calling';

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
  idle: ['rtm_warming', 'dialing', 'ringing'], // Added 'ringing' for lightweight flow
  rtm_warming: ['rtm_ready', 'token_fetching', 'failed'],
  rtm_ready: ['native_answered', 'token_fetching', 'declined', 'missed', 'ending', 'ended', 'failed'],
  native_answered: ['token_fetching', 'rtm_warming', 'failed'], // Added rtm_warming for deferred warmup
  token_fetching: ['rtc_joining', 'failed'],
  rtc_joining: ['connecting', 'failed'],
  dialing: ['ringing', 'rtc_joining', 'connecting', 'failed', 'ended'],
  ringing: ['connecting', 'declined', 'missed', 'failed', 'ending', 'ended', 'native_answered', 'rtm_warming'], // Added native_answered & rtm_warming for answer flow
  connecting: ['connected', 'failed', 'ended'],
  connected: ['ending', 'ended', 'failed'],
  ending: ['ended', 'declined', 'failed'],
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

export function deriveNextStateFromSignal(
  current: CallLifecycleState,
  signal: RtmSignalType
): CallLifecycleState {
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
