import React, { useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Phone, PhoneOff } from 'lucide-react-native';
import type { UseAgoraReturn } from '~/hooks/useAgora';
import agoraAudioService from '~/services/audioService';

const { width } = Dimensions.get('window');

interface IncomingCallModalProps {
  visible?: boolean;
  onClose?: () => void;
  agoraContext?: UseAgoraReturn | null;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ visible, onClose, agoraContext }) => {
  const {
    incomingInvite,
    activeCall,
    callState,
    answerIncomingCall,
    declineIncomingCall,
    endActiveCall,
    isConnecting,
    isMuted,
    isSpeakerOn,
    toggleMute,
    toggleSpeaker
  } = agoraContext ?? {};

  const isVisible = useMemo(() => {
    if (typeof visible === 'boolean') {
      return visible;
    }

    // Show modal for incoming calls
    if (incomingInvite) {
      return true;
    }

    // Show modal for active calls only if in an active state
    if (activeCall) {
      const activeStates = ['dialing', 'ringing', 'connecting', 'connected', 'ending', 'ended'];
      const shouldShow = activeStates.includes(callState || '');
      return shouldShow;
    }

    return false;
  }, [visible, incomingInvite, activeCall, callState]);

  const apartmentNumber = useMemo(
    () => incomingInvite?.callSummary?.apartmentNumber ?? null,
    [incomingInvite]
  );
  const buildingId = useMemo(() => incomingInvite?.callSummary?.buildingId ?? null, [incomingInvite]);

  useEffect(() => {
    const run = async () => {
      if (isVisible) {
        await agoraAudioService.playRingtone();
      } else {
        await agoraAudioService.stopRingtone();
      }
    };
    run().catch(() => undefined);

    return () => {
      void agoraAudioService.stopRingtone();
    };
  }, [isVisible]);

  if (!agoraContext) {
    return null;
  }

  const handleAccept = async () => {
    try {
      await agoraAudioService.stopRingtone();
      await answerIncomingCall?.();
      // Don't close modal - it will transition to active call UI
    } catch {
      // no-op; useAgora will set error state
    }
  };

  const handleDecline = async () => {
    try {
      await agoraAudioService.stopRingtone();
      await declineIncomingCall?.('declined');
      onClose?.();
    } catch {
      // no-op
    }
  };

  const handleEndCall = async () => {
    try {
      await agoraAudioService.stopRingtone();
      await endActiveCall?.('hangup');
      // Modal will auto-hide when activeCall becomes null
    } catch {
      // no-op
    }
  };

  const handleToggleMute = async () => {
    try {
      await toggleMute?.();
    } catch {
      // no-op
    }
  };

  const handleToggleSpeaker = async () => {
    try {
      await toggleSpeaker?.();
    } catch {
      // no-op
    }
  };

  if (!isVisible) {
    return null;
  }

  // Show active call interface if user is in call
  const showActiveCall = !!activeCall && !incomingInvite;

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>
              {showActiveCall ? 'Em Chamada' : 'Chamada de Interfone'}
            </Text>
            <Text style={styles.statusText}>
              {callState === 'ringing' && 'Recebendo...'}
              {callState === 'dialing' && 'Chamando...'}
              {callState === 'connecting' && 'Conectando...'}
              {callState === 'connected' && 'Conectado'}
              {callState === 'ending' && 'Encerrando...'}
              {callState === 'ended' && 'Chamada encerrada'}
            </Text>
          </View>

          <View style={styles.infoBox}>
            {apartmentNumber ? (
              <Text style={styles.infoText}>Apartamento {apartmentNumber}</Text>
            ) : null}
            {buildingId ? <Text style={styles.infoSubText}>Prédio {buildingId}</Text> : null}
          </View>

          {showActiveCall ? (
            // Active call controls
            <>
              {callState === 'connected' && (
                <View style={styles.controlsContainer}>
                  <TouchableOpacity
                    style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                    onPress={handleToggleMute}
                  >
                    <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
                    <Text style={styles.controlLabel}>{isMuted ? 'Ativar' : 'Silenciar'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                    onPress={handleToggleSpeaker}
                  >
                    <Text style={styles.controlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
                    <Text style={styles.controlLabel}>Alto-falante</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.endCallButton]}
                onPress={handleEndCall}
                disabled={callState === 'ending' || callState === 'ended'}
              >
                <PhoneOff size={24} color="#fff" />
                <Text style={styles.buttonLabel}>
                  {callState === 'ended' ? 'Encerrada' : callState === 'ending' ? 'Encerrando...' : 'Encerrar'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // Incoming call actions
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={handleDecline}>
                <PhoneOff size={30} color="#fff" />
                <Text style={styles.buttonLabel}>Recusar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
                disabled={isConnecting}
              >
                <Phone size={30} color="#fff" />
                <Text style={styles.buttonLabel}>{isConnecting ? 'Conectando...' : 'Atender'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
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
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    minWidth: 100,
  },
  controlButtonActive: {
    backgroundColor: '#22c55e',
  },
  controlIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default IncomingCallModal;
