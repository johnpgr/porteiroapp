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
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [notificationsSent, setNotificationsSent] = useState(0);
  const [callMessage, setCallMessage] = useState('');
  
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
        setBuildingId(null);
        return;
      }
      
      setBuildingName(profile.buildings?.name || 'Prédio');
      setBuildingId(profile.building_id);
    } catch (error) {
      console.error('Erro ao carregar informações do prédio:', error);
      setBuildingName('Prédio');
      setBuildingId(null);
    }
  };

  // Validar se o apartamento existe no prédio
  const validateApartment = async (apartmentNum: string): Promise<{ valid: boolean; apartmentId?: string; error?: string }> => {
    if (!buildingId) {
      return { valid: false, error: 'Informações do prédio não carregadas' };
    }

    try {
      const { data: apartment, error } = await supabase
        .from('apartments')
        .select('id, number')
        .eq('building_id', buildingId)
        .eq('number', apartmentNum.trim())
        .single();

      if (error || !apartment) {
        return { valid: false, error: `Apartamento ${apartmentNum} não encontrado neste prédio` };
      }

      return { valid: true, apartmentId: apartment.id };
    } catch (error) {
      console.error('Erro ao validar apartamento:', error);
      return { valid: false, error: 'Erro ao validar apartamento' };
    }
  };

  // Buscar moradores do apartamento
  const getApartmentResidents = async (apartmentId: string): Promise<{ residents: any[]; error?: string }> => {
    try {
      const { data: residents, error } = await supabase
        .from('apartment_residents')
        .select(`
          id,
          profile_id,
          profiles!inner(
            id,
            full_name,
            notification_enabled
          )
        `)
        .eq('apartment_id', apartmentId)
        .eq('profiles.notification_enabled', true);

      if (error) {
        console.error('Erro ao buscar moradores:', error);
        return { residents: [], error: 'Erro ao buscar moradores do apartamento' };
      }

      if (!residents || residents.length === 0) {
        return { residents: [], error: 'Nenhum morador encontrado ou com notificações habilitadas' };
      }

      return { residents: residents || [] };
    } catch (error) {
      console.error('Erro ao buscar moradores:', error);
      return { residents: [], error: 'Erro ao buscar moradores do apartamento' };
    }
  };

  // Iniciar chamada WebRTC
  const initiateCall = async () => {
    if (!user?.id || !apartmentNumber.trim() || !buildingId) {
      Alert.alert('Erro', 'Digite o número do apartamento');
      return;
    }
    
    try {
      setCallState('calling');
      setCallMessage('Validando apartamento...');
      
      // Validar apartamento
      const validation = await validateApartment(apartmentNumber.trim());
      if (!validation.valid) {
        throw new Error(validation.error || 'Apartamento inválido');
      }

      // Buscar moradores
      setCallMessage('Buscando moradores...');
      const { residents, error: residentsError } = await getApartmentResidents(validation.apartmentId!);
      if (residentsError) {
        throw new Error(residentsError);
      }

      if (residents.length === 0) {
        throw new Error(`Apartamento ${apartmentNumber} não possui moradores cadastrados ou com notificações habilitadas`);
      }
      
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }
      
      console.log('🔍 Iniciando chamada para apartamento:', apartmentNumber.trim());
      setCallMessage(`Enviando notificações para ${residents.length} morador(es)...`);
      
      const apiUrl = process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://jamesavisaapi.jamesconcierge.com';
      
      // Usar o endpoint correto da API de interfone
      const response = await fetch(`${apiUrl}/api/intercom/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apartment_number: apartmentNumber.trim(),
          doorman_id: user.id,
          building_id: buildingId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro ao iniciar chamada:', errorData);
        
        // Tratamento específico de erros
        if (response.status === 404) {
          throw new Error(`Apartamento ${apartmentNumber} não encontrado ou sem moradores cadastrados`);
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Dados inválidos para a chamada');
        } else if (response.status === 403) {
          throw new Error('Acesso negado. Verifique se você tem permissão para realizar chamadas');
        } else {
          throw new Error(errorData.error || `Erro ${response.status}: Não foi possível iniciar a chamada`);
        }
      }

      const result = await response.json();
      console.log('✅ Chamada iniciada com sucesso:', result);
      
      if (result.success && result.callId) {
        // Usar o callId retornado pela API
        setCurrentCallId(result.callId);
        setNotificationsSent(result.notificationsSent || residents.length);
        setCallMessage(result.message || 'Chamada iniciada com sucesso');
        setCallState('connecting');
        
        // Mostrar feedback sobre notificações enviadas
        console.log(`📱 ${result.notificationsSent || residents.length} notificações enviadas para o apartamento ${apartmentNumber}`);
        
        // Simular processo de conexão (aguardando resposta dos moradores)
        setTimeout(() => {
          setCallState('connected');
          setCallMessage('Chamada em andamento');
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
      setCallMessage('');
      setNotificationsSent(0);
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
      
      setCallMessage('Encerrando chamada...');
      
      // Para chamadas de interfone, o currentCallId é o intercomGroupId
      // Precisamos encerrar todas as chamadas do grupo
      try {
        const apiUrl = process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://jamesavisaapi.jamesconcierge.com';
        
        // Encerrar a chamada usando a API de produção
        const endCallResponse = await fetch(`${apiUrl}/api/webrtc/call/${currentCallId}/end`, {
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
      setCallMessage('Chamada encerrada');
      
      // Fechar WebSocket
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
      
      // Fechar modal após 2 segundos
      setTimeout(() => {
        setCallState('idle');
        setApartmentNumber('');
        setNotificationsSent(0);
        setCallMessage('');
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
        
        {/* Mostrar feedback de notificações */}
        {notificationsSent > 0 && (
          <Text style={styles.notificationFeedback}>
            📱 {notificationsSent} notificação{notificationsSent > 1 ? 'ões' : ''} enviada{notificationsSent > 1 ? 's' : ''}
          </Text>
        )}
        
        {/* Mostrar mensagem da chamada */}
        {callMessage && (
          <Text style={styles.callMessage}>
            {callMessage}
          </Text>
        )}
        
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
      setNotificationsSent(0);
      setCallMessage('');
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
    marginBottom: 8,
  },
  notificationFeedback: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '600',
  },
  callMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
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