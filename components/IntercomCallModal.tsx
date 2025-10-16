import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncomingCallData } from '../services/CallKeepService';

interface IntercomCallModalProps {
  visible: boolean;
  callData: IncomingCallData | null;
  onAnswer: () => void;
  onReject: () => void;
}

const { width, height } = Dimensions.get('window');

export const IntercomCallModal: React.FC<IntercomCallModalProps> = ({
  visible,
  callData,
  onAnswer,
  onReject,
}) => {
  console.log('🔧 [DEBUG] IntercomCallModal renderizado - visible:', visible, 'callData:', callData);
  
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(height));

  useEffect(() => {
    if (visible) {
      // Vibrar quando a chamada chegar
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 500, 200, 500], true);
      } else {
        Vibration.vibrate([500, 200, 500, 200], true);
      }

      // Animação de entrada
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Animação de pulso para o botão de aceitar
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
        Vibration.cancel();
      };
    } else {
      // Animação de saída
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      Vibration.cancel();
    }
  }, [visible]);

  const handleAnswer = () => {
    Vibration.cancel();
    onAnswer();
  };

  const handleReject = () => {
    Vibration.cancel();
    onReject();
  };

  if (!visible || !callData) {
    console.log('🔧 [DEBUG] Modal não será exibido - visible:', visible, 'callData:', callData);
    return null;
  }
  
  console.log('🔧 [DEBUG] Modal será exibido!');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Chamada do Interfone</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Recebendo...</Text>
            </View>
          </View>

          {/* Caller Info */}
          <View style={styles.callerInfo}>
            <View style={styles.avatarContainer}>
              <Ionicons name="home" size={60} color="#fff" />
            </View>
            <Text style={styles.callerName}>{callData.callerName}</Text>
            <Text style={styles.callerHandle}>{callData.handle}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {/* Reject Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={32} color="#fff" style={styles.rejectIcon} />
            </TouchableOpacity>

            {/* Answer Button */}
            <Animated.View
              style={[
                styles.answerButtonContainer,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.actionButton, styles.answerButton]}
                onPress={handleAnswer}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={32} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Additional Actions */}
          <View style={styles.additionalActions}>
            <TouchableOpacity style={styles.additionalButton}>
              <Ionicons name="chatbubble" size={20} color="#666" />
              <Text style={styles.additionalButtonText}>Mensagem</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.additionalButton}>
              <Ionicons name="person-add" size={20} color="#666" />
              <Text style={styles.additionalButtonText}>Contato</Text>
            </TouchableOpacity>
          </View>

          {/* Call UUID (for debugging) */}
          {__DEV__ && (
            <Text style={styles.debugText}>
              UUID: {callData.callUUID.substring(0, 8)}...
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 48,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#388E3C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#388E3C',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  callerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  callerHandle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  rejectIcon: {
    transform: [{ rotate: '135deg' }],
  },
  answerButtonContainer: {
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 15,
  },
  answerButton: {
    backgroundColor: '#4CAF50',
  },
  additionalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  additionalButton: {
    alignItems: 'center',
    padding: 12,
  },
  additionalButtonText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    marginTop: 16,
    fontFamily: 'monospace',
  },
});

export default IntercomCallModal;