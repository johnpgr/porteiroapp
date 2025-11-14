import React, { useEffect, useState } from 'react';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import { callKeepService } from '~/services/calling/CallKeepService';
import type { CallSession } from '~/services/calling/CallSession';
import { initializeNotificationHandler } from '../services/notificationHandler';
import { registerBackgroundNotificationTask } from '../services/backgroundNotificationTask';
import FullScreenCallUI from '~/components/FullScreenCallUI';
import type { CallLifecycleState } from '~/services/calling/stateMachine';

export function CallManagerProvider() {
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  useEffect(() => {
    // 1. Define event handlers
    const onSessionCreated = ({ session }: { session: CallSession }) => {
      console.log('[CallManagerProvider] Incoming call session created');
      // ✅ FIX: Always track the session, regardless of CallKeep availability.
      // We will handle "what to show" in the render logic.
      if (!session.isOutgoing) {
        setIncomingCall(session);
      }
    };

    const onSessionEnded = () => {
      console.log('[CallManagerProvider] Call session ended');
      setIncomingCall(null);
    };

    // 2. Subscribe to events
    const unsubCreated = callCoordinator.on('sessionCreated', onSessionCreated);
    const unsubEnded = callCoordinator.on('sessionEnded', onSessionEnded);

    // Check for existing session on mount (recovery)
    const active = callCoordinator.getActiveSession();
    if (active && !active.isOutgoing) {
      setIncomingCall(active);
    }

    // 3. Initialize services
    (async () => {
      try {
        await initializeNotificationHandler();
        await registerBackgroundNotificationTask();
      } catch (error) {
        console.error('[CallManagerProvider] Init failed:', error);
      }
    })();

    return () => {
      unsubCreated();
      unsubEnded();
    };
  }, []);

  return (
    <>
      {incomingCall && (
        <CallUIWrapper
          session={incomingCall}
          onAnswer={() => callCoordinator.answerActiveCall()}
          onDecline={() => callCoordinator.endActiveCall('decline')}
        />
      )}
    </>
  );
}

// ✅ NEW: Wrapper component to handle visibility logic
// This component listens to state changes to decide if it should be visible
const CallUIWrapper = ({
  session,
  onAnswer,
  onDecline,
}: {
  session: CallSession;
  onAnswer: () => void;
  onDecline: () => void;
}) => {
  const [state, setState] = useState<CallLifecycleState>(session.state);

  useEffect(() => {
    const unsub = session.on('stateChanged', ({ newState }) => setState(newState));
    return unsub;
  }, [session]);

  const isCallKeepAvailable = callKeepService.checkAvailability();

  // Logic: Should we show the React UI?
  // 1. If state is RINGING and CallKeep IS available -> NO (Native UI handles ringing)
  // 2. If state is ANSWERED/CONNECTED -> YES (Native UI is gone, we need App UI)
  // 3. If CallKeep IS NOT available -> YES (We need React UI for ringing)

  const isRinging = state === 'ringing' || state === 'rtm_ready';
  const shouldHideForNativeUI = isCallKeepAvailable && isRinging;

  if (shouldHideForNativeUI) {
    return null; // Render nothing, let Android Native Screen do the work
  }

  return <FullScreenCallUI session={session} onAnswer={onAnswer} onDecline={onDecline} />;
};
