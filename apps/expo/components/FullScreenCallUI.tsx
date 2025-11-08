import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Phone, PhoneOff } from 'lucide-react-native';
import agoraAudioService from '~/services/audioService';
import type { CallSession } from '~/services/calling/CallSession';

const { width } = Dimensions.get('window');

interface FullScreenCallUIProps {
  session: CallSession;
  onAnswer: () => void;
  onDecline: () => void;
}

const FullScreenCallUI: React.FC<FullScreenCallUIProps> = ({ session, onAnswer, onDecline }) => {
  // Play ringtone when component mounts
  useEffect(() => {
    agoraAudioService.playIntercomRingtone();

    // Stop ringtone when component unmounts
    return () => {
      agoraAudioService.stopIntercomRingtone();
    };
  }, []);

  const handleAnswer = () => {
    agoraAudioService.stopIntercomRingtone();  // Stop immediately
    onAnswer();                                // Trigger coordinator
    // Keep UI open - transitions to in-call controls
  };

  const handleDecline = () => {
    agoraAudioService.stopIntercomRingtone();  // Stop immediately
    onDecline();                               // Trigger coordinator
    // UI closes via state change
  };

  // Show in-call controls if call has been answered
  const showActiveCall = session.state !== 'ringing' && session.state !== 'rtm_ready';

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {showActiveCall ? 'Em Chamada' : 'Chamada de Interfone'}
          </Text>
          <Text style={styles.statusText}>
            {session.state === 'ringing' && 'Recebendo...'}
            {session.state === 'rtm_ready' && 'Recebendo...'}
            {session.state === 'connecting' && 'Conectando...'}
            {session.state === 'connected' && 'Conectado'}
            {session.state === 'native_answered' && 'Atendendo...'}
            {session.state === 'token_fetching' && 'Conectando...'}
            {session.state === 'rtc_joining' && 'Conectando...'}
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

        {showActiveCall ? (
          // Active call controls
          <>
            <TouchableOpacity
              style={[styles.endCallButton]}
              onPress={handleDecline}
            >
              <PhoneOff size={24} color="#fff" />
              <Text style={styles.buttonLabel}>Encerrar</Text>
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
              onPress={handleAnswer}
            >
              <Phone size={30} color="#fff" />
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
});

export default FullScreenCallUI;
