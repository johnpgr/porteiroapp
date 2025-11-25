import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallParticipantSnapshot } from '~/types/calling';
import type { CallLifecycleState } from '~/services/calling/stateMachine';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import type { CallSession } from '~/services/calling/CallSession';
import { agoraService } from '~/services/agora/AgoraService';

interface IntercomUser {
  id: string;
  displayName?: string | null;
  userType: 'porteiro' | 'morador';
}

interface ActiveCallContext {
  callId: string;
  channelName: string;
  participants: CallParticipantSnapshot[];
  isOutgoing: boolean;
  apartmentNumber?: string | null;
  buildingId?: string | null;
}

interface StartCallParams {
  apartmentNumber: string;
  buildingId: string;
}

interface UseIntercomCallReturn {
  callState: CallLifecycleState | 'idle';
  activeCall: ActiveCallContext | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  error: string | null;
  startCall: (params: StartCallParams) => Promise<void>;
  endCall: (reason?: 'decline' | 'hangup') => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
}

export function useIntercomCall(user?: IntercomUser | null): UseIntercomCallReturn {
  const [session, setSession] = useState<CallSession | null>(callCoordinator.getActiveSession());
  const [callState, setCallState] = useState<CallLifecycleState | 'idle'>(
    callCoordinator.getActiveSession()?.state ?? 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const stateUnsubRef = useRef<(() => void) | null>(null);

  // Keep current user wired into coordinator + Agora service
  useEffect(() => {
    if (user?.id) {
      callCoordinator.setCurrentUser({
        id: user.id,
        userType: user.userType,
        displayName: user.displayName ?? null,
      });
    }
  }, [user?.id, user?.displayName, user?.userType]);

  // Attach to current session state changes
  const attachSession = useCallback((nextSession: CallSession | null) => {
    if (stateUnsubRef.current) {
      stateUnsubRef.current();
      stateUnsubRef.current = null;
    }

    setSession(nextSession);
    if (!nextSession) {
      setCallState('idle');
      setIsMuted(false);
      setIsSpeakerOn(true);
      return;
    }

    setCallState(nextSession.state);
    stateUnsubRef.current = nextSession.on('stateChanged', ({ newState }) => {
      setCallState(newState);
      if (newState === 'ended' || newState === 'declined' || newState === 'failed') {
        setIsMuted(false);
        setIsSpeakerOn(true);
      }
    });
  }, []);

  // Listen to coordinator events
  useEffect(() => {
    const onSessionCreated = ({ session: created }: { session: CallSession }) => {
      attachSession(created);
    };
    const onSessionEnded = () => {
      attachSession(null);
    };
    const onError = ({ error: err }: { error: any }) => {
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erro de chamada';
      setError(message);
    };

    const unsubCreated = callCoordinator.on('sessionCreated', onSessionCreated);
    const unsubEnded = callCoordinator.on('sessionEnded', onSessionEnded);
    const unsubError = callCoordinator.on('error', onError);

    const active = callCoordinator.getActiveSession();
    if (active) {
      attachSession(active);
    }

    return () => {
      unsubCreated();
      unsubEnded();
      unsubError();
      if (stateUnsubRef.current) stateUnsubRef.current();
    };
  }, [attachSession]);

  const startCall = useCallback(
    async (params: StartCallParams): Promise<void> => {
      setError(null);
      await callCoordinator.startOutgoingCall({
        apartmentNumber: params.apartmentNumber,
        buildingId: params.buildingId,
        callerName: user?.displayName ?? null,
      });
    },
    [user?.displayName]
  );

  const endCall = useCallback(
    async (reason: 'decline' | 'hangup' = 'hangup'): Promise<void> => {
      await callCoordinator.endActiveCall(reason);
    },
    []
  );

  const toggleMute = useCallback(async (): Promise<void> => {
    const next = !isMuted;
    await agoraService.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleSpeaker = useCallback(async (): Promise<void> => {
    const next = !isSpeakerOn;
    await agoraService.setSpeakerphoneOn(next);
    setIsSpeakerOn(next);
  }, [isSpeakerOn]);

  const activeCall: ActiveCallContext | null = session
    ? {
        callId: session.id,
        channelName: session.channelName,
        participants: session.participants,
        isOutgoing: session.isOutgoing,
        apartmentNumber: session.apartmentNumber,
        buildingId: session.buildingId,
      }
    : null;

  return {
    callState,
    activeCall,
    isMuted,
    isSpeakerOn,
    error,
    startCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
