import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Phone, PhoneOff } from 'lucide-react-native';
import AgoraCallComponent from './AgoraCallComponent';

interface IntercomCallModalProps {
  visible: boolean;
  onClose: () => void;
  doormanId?: string;
  buildingId?: string;
}

const { width } = Dimensions.get('window');

export const IntercomCallModal: React.FC<IntercomCallModalProps> = ({
  visible,
  onClose,
  doormanId,
  buildingId,
}) => {
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [callData, setCallData] = useState<{
    callId: string;
    channelName: string;
    uid: number;
  } | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setCallState('idle');
      setCallData(null);
      setApartmentNumber('');
    }
  }, [visible]);

  // Iniciar chamada para apartamento
  const handleStartCall = async () => {
    if (!apartmentNumber.trim()) {
      Alert.alert('Erro', 'Digite o número do apartamento');
      return;
    }

    if (!doormanId || !buildingId) {
      Alert.alert('Erro', 'Dados do porteiro não encontrados');
      return;
    }

    try {
      setCallState('calling');
      
      console.log('🚀 Iniciando chamada para apartamento:', apartmentNumber);
      
      // Chamar API para iniciar chamada
      const response = await fetch('http://localhost:3001/api/calls/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apartmentNumber: apartmentNumber.trim(),
          doormanId,
          buildingId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('✅ Chamada iniciada:', data);
      
      // Configurar dados da chamada para o componente Agora
      setCallData({
        callId: data.callId,
        channelName: data.channelName || data.callId,
        uid: parseInt(doormanId) || Math.floor(Math.random() * 10000),
      });
      
    } catch (error) {
      console.error('❌ Erro ao iniciar chamada:', error);
      Alert.alert(
        'Erro na Chamada',
        error instanceof Error ? error.message : 'Erro desconhecido',
        [{ text: 'OK', onPress: () => setCallState('idle') }]
      );
      setCallState('idle');
    }
  };

  // Encerrar chamada
  const handleEndCall = () => {
    console.log('📞 Encerrando chamada...');
    setCallState('idle');
    setCallData(null);
    onClose();
  };

  // Callback quando chamada conecta
  const handleCallConnected = () => {
    console.log('✅ Chamada conectada');
    setCallState('connected');
  };

  // Callback quando chamada falha
  const handleCallFailed = (error: string) => {
    console.error('❌ Chamada falhou:', error);
    Alert.alert('Erro na Chamada', error, [
      { text: 'OK', onPress: () => setCallState('idle') }
    ]);
    setCallState('idle');
  };

  // Renderizar componente de chamada se estiver chamando ou conectado
  if (callState !== 'idle' && callData) {
    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={handleEndCall}
      >
        <AgoraCallComponent
          channelName={callData.channelName}
          uid={callData.uid}
          callerName={`Apartamento ${apartmentNumber}`}
          onEndCall={handleEndCall}
          onCallConnected={handleCallConnected}
          onCallFailed={handleCallFailed}
          isVisible={true}
        />
      </Modal>
    );
  }

  // Tela inicial para digitar número do apartamento
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Interfone</Text>
            <Text style={styles.statusText}>Ligar para Apartamento</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Número do Apartamento</Text>
            <TextInput
              style={styles.input}
              value={apartmentNumber}
              onChangeText={setApartmentNumber}
              placeholder="Ex: 101, 205, 1504..."
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={10}
              autoFocus
            />
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.closeButton]}
              onPress={onClose}
            >
              <PhoneOff size={30} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.callButton,
                !apartmentNumber.trim() && styles.disabledButton
              ]}
              onPress={handleStartCall}
              disabled={!apartmentNumber.trim()}
            >
              <Phone size={30} color="#fff" />
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
  statusText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
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
  closeButton: {
    backgroundColor: '#666',
  },
  callButton: {
    backgroundColor: '#22c55e',
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
});

export default IntercomCallModal;