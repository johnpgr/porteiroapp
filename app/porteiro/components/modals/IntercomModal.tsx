import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

const { width, height } = Dimensions.get('window');

interface IntercomModalProps {
  visible: boolean;
  onClose: () => void;
}

type CallState = 'idle' | 'calling' | 'connecting' | 'connected' | 'ended';

export default function IntercomModal({ visible, onClose }: IntercomModalProps) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  
  // Refs para WebRTC
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  // Carregar informações do prédio do porteiro
  const loadBuildingInfo = async () => {
    if (!user?.id) return;
    
    try {
      // Buscar informações do prédio do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          building_id,
          buildings!inner(
            name,
            address
          )
        `)
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar informações do prédio:', profileError);
        setBuildingName('Prédio');
        return;
      }
      
      setBuildingName(profile.buildings?.name || 'Prédio');
    } catch (error) {
      console.error('Erro ao carregar informações do prédio:', error);
      setBuildingName('Prédio');
    }
  };

  // Iniciar chamada WebRTC
  const initiateCall = async () => {
    if (!user?.id || !apartmentNumber.trim()) {
      Alert.alert('Erro', 'Digite o número do apartamento');
      return;
    }
    
    try {
      setCallState('calling');
      
      // Buscar informações do prédio do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        throw new Error('Não foi possível identificar o prédio');
      }
      
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }
      
      // Primeiro: buscar moradores do apartamento
      console.log('🔍 Buscando moradores do apartamento:', apartmentNumber.trim());
      
      const apiUrl = process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://jamesavisaapi.jamesconcierge.com';
      
      const residentsResponse = await fetch(`${apiUrl}/api/webrtc/apartments/${apartmentNumber.trim()}/residents`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!residentsResponse.ok) {
        const errorData = await residentsResponse.json().catch(() => ({}));
        console.error('❌ Erro ao buscar moradores:', errorData);
        throw new Error(errorData.error || `Erro ${residentsResponse.status}: Não foi possível buscar moradores do apartamento`);
      }

      const residentsData = await residentsResponse.json();
      console.log('📋 Moradores encontrados:', residentsData);

      if (!residentsData.success || !residentsData.residents || residentsData.residents.length === 0) {
        throw new Error(`Apartamento ${apartmentNumber} não possui moradores cadastrados ou disponíveis`);
      }

      // Segundo: iniciar chamada com o primeiro morador disponível
      const firstResident = residentsData.residents[0];
      console.log('📞 Iniciando chamada para:', firstResident);

      const response = await fetch(`${apiUrl}/api/webrtc/call/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callerId: user.id,
          receiverId: firstResident.id,
          callType: 'audio'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro ao iniciar chamada:', errorData);
        throw new Error(errorData.error || `Erro ${response.status}: Não foi possível iniciar a chamada`);
      }

      const result = await response.json();
      console.log('✅ Chamada iniciada com sucesso:', result);
      
      if (result.success && result.callId) {
        // Usar o callId retornado pela API
        setCurrentCallId(result.callId);
        setCallState('connecting');
        
        // Conectar WebSocket para sinalização
        connectWebSocket(result.callId, session.access_token);
        
        // Simular processo de conexão (em implementação real, seria baseado em eventos WebSocket)
        setTimeout(() => {
          setCallState('connected');
          startCallTimer();
        }, 3000);
        
      } else {
        // Tratamento de erros específicos da API
        let errorMessage = 'Não foi possível iniciar a chamada';
        
        if (result.error) {
          errorMessage = result.error;
        } else if (!result.callId) {
          errorMessage = 'Resposta inválida da API - callId não encontrado';
        }
        
        console.error('❌ Erro na resposta da API:', result);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      Alert.alert('Erro', error.message || 'Não foi possível iniciar a chamada');
      setCallState('idle');
    }
  };

  // Conectar WebSocket para sinalização
  const connectWebSocket = (callId: string, token: string) => {
    try {
      // Em implementação real, conectaria ao WebSocket da API
      console.log('WebSocket conectado para chamada:', callId);
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
    }
  };

  // Iniciar timer da chamada
  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Parar timer da chamada
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Encerrar chamada
  const endCall = async () => {
    if (!currentCallId || !user?.id) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Para chamadas de interfone, o currentCallId é o intercomGroupId
      // Precisamos encerrar todas as chamadas do grupo
      try {
        // Encerrar a chamada usando a API de produção
        const endCallResponse = await fetch(`${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL}/api/webrtc/call/${currentCallId}/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            callerId: user.id,
            endReason: 'user_ended'
          })
        });

        if (!endCallResponse.ok) {
          const errorData = await endCallResponse.json().catch(() => ({}));
          console.error('❌ Erro ao encerrar chamada:', errorData);
        } else {
          const endResult = await endCallResponse.json();
          console.log('✅ Chamada encerrada com sucesso:', endResult);
        }
      } catch (apiError) {
        console.error('Erro ao encerrar chamadas via API:', apiError);
        // Continuar com limpeza local mesmo se a API falhar
      }
      
    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
    } finally {
      // Limpar estado da chamada
      stopCallTimer();
      setCallState('ended');
      setCurrentCallId(null);
      setCallDuration(0);
      setIsMuted(false);
      setIsSpeakerOn(false);
      
      // Fechar WebSocket
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
      
      // Fechar modal após 2 segundos
      setTimeout(() => {
        setCallState('idle');
        setApartmentNumber('');
        onClose();
      }, 2000);
    }
  };

  // Alternar mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Em implementação real, controlaria o áudio do WebRTC
  };

  // Alternar speaker
  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Em implementação real, controlaria o speaker do dispositivo
  };

  // Formatar duração da chamada
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Adicionar dígito ao número do apartamento
  const addDigit = (digit: string) => {
    if (apartmentNumber.length < 10) {
      setApartmentNumber(prev => prev + digit);
    }
  };

  // Remover último dígito
  const removeLastDigit = () => {
    setApartmentNumber(prev => prev.slice(0, -1));
  };

  // Renderizar botão do teclado numérico
  const renderKeypadButton = (digit: string) => (
    <TouchableOpacity
      key={digit}
      style={styles.keypadButton}
      onPress={() => addDigit(digit)}
      activeOpacity={0.7}
    >
      <Text style={styles.keypadButtonText}>{digit}</Text>
    </TouchableOpacity>
  );

  // Renderizar teclado numérico
  const renderKeypad = () => (
    <View style={styles.keypadContainer}>
      {/* Primeira linha: 1, 2, 3 */}
      <View style={styles.keypadRow}>
        {renderKeypadButton('1')}
        {renderKeypadButton('2')}
        {renderKeypadButton('3')}
      </View>
      
      {/* Segunda linha: 4, 5, 6 */}
      <View style={styles.keypadRow}>
        {renderKeypadButton('4')}
        {renderKeypadButton('5')}
        {renderKeypadButton('6')}
      </View>
      
      {/* Terceira linha: 7, 8, 9 */}
      <View style={styles.keypadRow}>
        {renderKeypadButton('7')}
        {renderKeypadButton('8')}
        {renderKeypadButton('9')}
      </View>
      
      {/* Quarta linha: 0 centralizado */}
      <View style={styles.keypadRow}>
        <View style={styles.keypadSpacer} />
        {renderKeypadButton('0')}
        <TouchableOpacity
          style={styles.backspaceButton}
          onPress={removeLastDigit}
          activeOpacity={0.7}
        >
          <Text style={styles.backspaceButtonText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizar interface de entrada do apartamento
  const renderApartmentInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.buildingTitle}>{buildingName}</Text>
      
      <View style={styles.apartmentInputSection}>
        <View style={styles.apartmentDisplay}>
          {apartmentNumber ? <Text style={styles.apartmentDisplayNumber}>
            {apartmentNumber}
          </Text> : <Text style={styles.apartmentDisplayText}>
            Digite o número do apto...
          </Text>}
        </View>
      </View>
      
      {renderKeypad()}
      
      <TouchableOpacity
        style={[
          styles.callButton,
          !apartmentNumber.trim() && styles.callButtonDisabled
        ]}
        onPress={initiateCall}
        disabled={!apartmentNumber.trim()}
      >
        <Text style={styles.callButtonText}>📞 Chamar</Text>
      </TouchableOpacity>
    </View>
  );

  // Renderizar interface da chamada
  const renderCallInterface = () => (
    <View style={styles.callContainer}>
      <View style={styles.callHeader}>
        <Text style={styles.callTitle}>
          {callState === 'calling' && 'Chamando...'}
          {callState === 'connecting' && 'Conectando...'}
          {callState === 'connected' && 'Em chamada'}
          {callState === 'ended' && 'Chamada encerrada'}
        </Text>
        <Text style={styles.callSubtitle}>
          Apartamento {apartmentNumber} - {buildingName}
        </Text>
        {callState === 'connected' && (
          <Text style={styles.callDuration}>
            {formatCallDuration(callDuration)}
          </Text>
        )}
      </View>

      {callState === 'calling' || callState === 'connecting' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : null}

      {callState === 'connected' && (
        <View style={styles.callControls}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
          >
            <Text style={styles.controlButtonText}>
              {isMuted ? '🔇' : '🎤'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
            onPress={toggleSpeaker}
          >
            <Text style={styles.controlButtonText}>
              {isSpeakerOn ? '🔊' : '🔈'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.endCallButton}
        onPress={endCall}
      >
        <Text style={styles.endCallButtonText}>
          {callState === 'ended' ? '✓ Encerrada' : '📞 Encerrar'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Effect para carregar informações quando modal abre
  useEffect(() => {
    if (visible && callState === 'idle') {
      loadBuildingInfo();
    }
  }, [visible, callState]);

  // Effect para limpeza quando modal fecha
  useEffect(() => {
    if (!visible) {
      // Limpar timers e conexões
      stopCallTimer();
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
      
      // Reset do estado
      setCallState('idle');
      setApartmentNumber('');
      setCurrentCallId(null);
      setCallDuration(0);
      setIsMuted(false);
      setIsSpeakerOn(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Interfone</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {callState === 'idle' ? renderApartmentInput() : renderCallInterface()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    marginTop: 28,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  
  // Estilos para entrada do apartamento
  inputContainer: {
    alignItems: 'center',
  },
  buildingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 18,
    textAlign: 'center',
  },
  apartmentInputSection: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  apartmentDisplay: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  apartmentDisplayNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  apartmentDisplayText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  callButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  callButtonDisabled: {
    backgroundColor: '#ccc',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Estilos para interface da chamada
  callContainer: {
    alignItems: 'center',
  },
  callHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  callTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  callSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  callDuration: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 16,
  },
  loadingContainer: {
    marginVertical: 48,
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 48,
    gap: 24,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  controlButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  controlButtonText: {
    fontSize: 24,
  },
  endCallButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  endCallButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Estilos para o teclado numérico
  keypadContainer: {
    marginVertical: 24,
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 20,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  keypadSpacer: {
    width: 70,
  },
  backspaceButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  backspaceButtonText: {
    fontSize: 24,
    color: '#666',
  },
});