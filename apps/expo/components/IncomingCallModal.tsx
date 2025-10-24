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
  const { incomingInvite, callState, answerIncomingCall, declineIncomingCall, isConnecting } = agoraContext ?? {};

  const isVisible = useMemo(() => {
    if (typeof visible === 'boolean') return visible;
    return !!incomingInvite;
  }, [visible, incomingInvite]);

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
      onClose?.();
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

  if (!isVisible) return null;

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Chamada de Interfone</Text>
            <Text style={styles.statusText}>
              {callState === 'ringing' || callState === 'dialing' ? 'Chamando...' : 'Conectando...'}
            </Text>
          </View>

          <View style={styles.infoBox}>
            {apartmentNumber ? (
              <Text style={styles.infoText}>Apartamento {apartmentNumber}</Text>
            ) : null}
            {buildingId ? <Text style={styles.infoSubText}>Prédio {buildingId}</Text> : null}
          </View>

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
  buttonLabel: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default IncomingCallModal;
