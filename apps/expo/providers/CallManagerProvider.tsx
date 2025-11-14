import { useEffect, useState } from 'react';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import { callKeepService } from '~/services/calling/CallKeepService';
import type { CallSession } from '~/services/calling/CallSession';
import { initializeNotificationHandler } from '../services/notificationHandler';
import { registerBackgroundNotificationTask } from '../services/backgroundNotificationTask';
import FullScreenCallUI from '~/components/FullScreenCallUI';

/**
 * Provider that manages call system initialization, events, and UI.
 * Initializes notification system and call coordinator.
 * Listens for incoming calls and renders custom UI when CallKeep unavailable.
 */
export function CallManagerProvider() {
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  // CRITICAL: Subscribe to events BEFORE initializing callCoordinator
  // This ensures sessionCreated events from recoverPersistedSession() are caught
  useEffect(() => {
    // 1. Define event handlers
    const onSessionCreated = ({ session }: { session: CallSession }) => {
      console.log('[CallManagerProvider] Incoming call session created');
      if (!session.isOutgoing) {
        // Only show custom UI if CallKeep unavailable
        if (!callKeepService.checkAvailability()) {
          setIncomingCall(session);
        }
        // Otherwise, CallKeep native UI is already showing
      }
    };

    const onSessionEnded = () => {
      console.log('[CallManagerProvider] Call session ended');
      setIncomingCall(null);
    };

    // 2. Subscribe to events FIRST (before initialization)
    const unsubCreated = callCoordinator.on('sessionCreated', onSessionCreated);
    const unsubEnded = callCoordinator.on('sessionEnded', onSessionEnded);

    // 3. Initialize notification system and callCoordinator SECOND
    // This guarantees listeners are ready when recoverPersistedSession() fires sessionCreated
    (async () => {
      try {
        console.log('[CallManagerProvider] 🚀 Initializing notification system and call coordinator...');

        // Initialize notification handler first (sets up handler + channels)
        await initializeNotificationHandler();

        // Register background notification task
        await registerBackgroundNotificationTask();

        // Defer CallKeep and CallCoordinator initialization until user login
        // CallKeep and CallCoordinator are initialized in morador/_layout.tsx after authentication

        console.log(
          '[CallManagerProvider] ✅ Notification system initialized (CallKeep/Coordinator deferred until login)'
        );
      } catch (error) {
        console.error('[CallManagerProvider] ❌ Failed to initialize:', error);
      }
    })();

    // 4. Cleanup subscriptions on unmount
    return () => {
      unsubCreated();
      unsubEnded();
    };
  }, []); // Run once on mount

  // Render custom call UI overlay when there's an incoming call (and CallKeep unavailable)
  return (
    <>
      {incomingCall && (
        <FullScreenCallUI
          session={incomingCall}
          onAnswer={() => {
            console.log('[CallManagerProvider] User tapped Answer');
            callCoordinator.answerActiveCall();
          }}
          onDecline={() => {
            console.log('[CallManagerProvider] User tapped Decline');
            callCoordinator.endActiveCall('decline');
          }}
        />
      )}
    </>
  );
}
