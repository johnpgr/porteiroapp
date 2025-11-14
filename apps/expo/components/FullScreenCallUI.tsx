import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { IconSymbol } from '~/components/ui/IconSymbol';
import agoraAudioService from '~/services/audioService';
import { agoraService } from '~/services/agora/AgoraService';
import type { CallSession } from '~/services/calling/CallSession';
import type { CallLifecycleState } from '~/services/calling/stateMachine';

const { width } = Dimensions.get('window');

interface FullScreenCallUIProps {
  session: CallSession;
  onAnswer: () => void;
  onDecline: () => void;
}

const FullScreenCallUI: React.FC<FullScreenCallUIProps> = ({ session, onAnswer, onDecline }) => {
  // Track session state changes to trigger re-renders
  const [sessionState, setSessionState] = useState<CallLifecycleState>(session.state);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const isEnding = sessionState === 'ending';

  // Subscribe to session state changes
  useEffect(() => {
    const unsubscribe = session.on('stateChanged', ({ newState }) => {
      console.log('[FullScreenCallUI] Session state changed:', newState);
      setSessionState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [session]);

  // Play ringtone when component mounts
  useEffect(() => {
    agoraAudioService.playIntercomRingtone();

    // Stop ringtone when component unmounts
    return () => {
      agoraAudioService.stopIntercomRingtone();
    };
  }, []);

  const handleAnswer = () => {
    if (isEnding) return;
    agoraAudioService.stopIntercomRingtone();  // Stop immediately
    onAnswer();                                // Trigger coordinator
    // Keep UI open - transitions to in-call controls
  };

  const handleDecline = () => {
    if (isEnding) return;
    agoraAudioService.stopIntercomRingtone();  // Stop immediately
    onDecline();                               // Trigger coordinator
    // UI closes via state change
  };

  const handleToggleMute = async () => {
    try {
      const rtcEngine = await agoraService.ensureRtcEngine();
      const newMutedState = !isMuted;
      rtcEngine.muteLocalAudioStream(newMutedState);
      setIsMuted(newMutedState);
      console.log(`[FullScreenCallUI] Mute toggled: ${newMutedState}`);
    } catch (error) {
      console.error('[FullScreenCallUI] Failed to toggle mute:', error);
    }
  };

  const handleToggleSpeaker = async () => {
    try {
      const rtcEngine = await agoraService.ensureRtcEngine();
      const newSpeakerState = !isSpeakerOn;
      rtcEngine.setEnableSpeakerphone(newSpeakerState);
      setIsSpeakerOn(newSpeakerState);
      console.log(`[FullScreenCallUI] Speaker toggled: ${newSpeakerState}`);
    } catch (error) {
      console.error('[FullScreenCallUI] Failed to toggle speaker:', error);
    }
  };

  // Consider "active/answered flow" only after the user taps Answer
  const answeredFlowStates: CallLifecycleState[] = [
    'native_answered',
    'token_fetching',
    'rtc_joining',
    'connecting',
    'connected',
  ];
  const showAnsweredFlow = answeredFlowStates.includes(sessionState);

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {showAnsweredFlow ? 'Em Chamada' : 'Chamada de Interfone'}
          </Text>
          <Text style={styles.statusText}>
            {sessionState === 'ringing' && 'Recebendo...'}
            {sessionState === 'rtm_ready' && 'Recebendo...'}
            {sessionState === 'connecting' && 'Conectando...'}
            {sessionState === 'connected' && 'Conectado'}
            {sessionState === 'native_answered' && 'Atendendo...'}
            {sessionState === 'token_fetching' && 'Conectando...'}
            {sessionState === 'rtc_joining' && 'Conectando...'}
            {sessionState === 'ending' && 'Encerrando...'}
            {sessionState === 'ended' && 'Encerrada'}
            {sessionState === 'declined' && 'Recusada'}
            {sessionState === 'failed' && 'Falhou'}
        </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {session.callerName || 'Porteiro'}
          </Text>
          {session.apartmentNumber && (
            <Text style={styles.infoSubText}>
              Apt {session.apartmentNumber}
            </Text>
          )}
        </View>

        {showAnsweredFlow ? (
          // Active call controls
          <>
            {sessionState === 'connected' && (
              <View style={styles.callControls}>
                <TouchableOpacity
                  disabled={isEnding}
                  style={[styles.controlButton, isMuted && styles.controlButtonActive, isEnding && styles.buttonDisabled]}
                  onPress={handleToggleMute}
                >
                  {isMuted ? (
                    <IconSymbol name="mic.slash.fill" size={24} color="#fff" />
                  ) : (
                    <IconSymbol name="mic" size={24} color="#666" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isEnding}
                  style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive, isEnding && styles.buttonDisabled]}
                  onPress={handleToggleSpeaker}
                >
                  {isSpeakerOn ? (
                    <IconSymbol name="speaker.wave.3.fill" size={24} color="#fff" />
                  ) : (
                    <IconSymbol name="speaker.slash.fill" size={24} color="#666" />
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              disabled={isEnding}
              style={[styles.endCallButton, isEnding && styles.buttonDisabled]}
              onPress={handleDecline}
            >
              <IconSymbol name="phone.down.fill" size={24} color="#fff" />
              <Text style={styles.buttonLabel}>Encerrar</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Incoming call actions
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              disabled={isEnding}
              style={[styles.actionButton, styles.declineButton, isEnding && styles.buttonDisabled]}
              onPress={handleDecline}
            >
              <IconSymbol name="phone.down.fill" size={30} color="#fff" />
              <Text style={styles.buttonLabel}>Recusar</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={isEnding} style={[styles.actionButton, styles.acceptButton, isEnding && styles.buttonDisabled]} onPress={handleAnswer}>
              <IconSymbol name="phone.fill" size={30} color="#fff" />
              <Text style={styles.buttonLabel}>Atender</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    maxWidth: 420,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusText: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  infoBox: {
    alignItems: 'center',
    marginVertical: 24,
  },
  infoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  infoSubText: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 6,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  declineButton: {
    backgroundColor: '#ef4444',
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 24,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3a3a3a',
  },
  controlButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
    width: '100%',
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  buttonLabel: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default FullScreenCallUI;
