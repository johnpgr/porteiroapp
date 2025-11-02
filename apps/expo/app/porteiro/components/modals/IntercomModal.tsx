import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Modal } from '~/components/Modal';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import { audioService } from '~/services/audioService';
import { useAgora } from '~/hooks/useAgora';

const supabaseClient = supabase as any;

interface IntercomModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function IntercomModal({ visible, onClose }: IntercomModalProps) {
  const { user } = useAuth();
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [doormanName, setDoormanName] = useState<string>('Porteiro');
  const [callDuration, setCallDuration] = useState(0);

  // Refs for call timer
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize useAgora hook
  const {
    callState,
    activeCall,
    isMuted,
    isSpeakerOn,
    error,
    setCurrentUser,
    startIntercomCall,
    endActiveCall,
    toggleMute,
    toggleSpeaker,
  } = useAgora();

  // Listener para mudanças de estado da chamada para controlar áudio
  useEffect(() => {
    const handleCallStateChange = async () => {
      if (callState !== 'ringing') {
        await audioService.stopRingtone();
      }

      if (callState === 'connected') {
        startCallTimer();
      }
    };

    handleCallStateChange();
  }, [callState]);

  // Set current user for Agora hook
  useEffect(() => {
    if (user?.id) {
      setCurrentUser({
        id: user.id,
        userType: 'porteiro',
        displayName: doormanName || user.email?.split('@')[0] || 'Porteiro',
      });
    }
  }, [user?.id, user?.email, doormanName, setCurrentUser]);

  // Carregar informações do prédio do porteiro
  const loadBuildingInfo = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Buscar informações do prédio do porteiro
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select(
          `
          full_name,
          building_id,
          buildings!inner(
            name,
            address
          )
        `
        )
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
      if (profile.full_name) {
        setDoormanName(profile.full_name);
      } else if (user?.email) {
        setDoormanName(user.email.split('@')[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar informações do prédio:', error);
      setBuildingName('Prédio');
      setBuildingId(null);
    }
  }, [user?.email, user?.id]);

  // Iniciar chamada utilizando useAgora hook
  const initiateCall = async () => {
    const trimmedApartment = apartmentNumber.trim();

    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!trimmedApartment) {
      Alert.alert('Erro', 'Digite o número do apartamento');
      return;
    }

    if (!buildingId) {
      Alert.alert(
        'Aguardando dados',
        'Ainda estamos carregando as informações do prédio. Tente novamente em instantes.'
      );
      return;
    }

    try {
      // Initialize and play ringtone
      try {
        await audioService.initialize();
        await audioService.loadRingtone();
        await audioService.playRingtone();
      } catch (audioError) {
        console.warn('⚠️ Erro ao inicializar áudio:', audioError);
      }

      // Start the call using the useAgora hook
      await startIntercomCall({
        apartmentNumber: trimmedApartment,
        buildingId,
      });
    } catch (error) {
      const err = error as Error;
      const message = err?.message || 'Erro inesperado ao iniciar a chamada';

      console.warn('❌ Falha ao iniciar chamada:', message);
      Alert.alert('Erro', message);

      try {
        await audioService.stopRingtone();
      } catch (audioError) {
        console.error('❌ Erro ao parar som de chamada:', audioError);
      }
    }
  };

  // Iniciar timer da chamada
  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Parar timer da chamada
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Encerrar chamada usando useAgora hook
  const handleEndCall = async () => {
    try {
      // Stop ringtone
      await audioService.stopRingtone();

      // End the call using useAgora
      await endActiveCall('hangup');

      // Stop timer
      stopCallTimer();
      setCallDuration(0);

      // Reset UI state after a short delay
      setTimeout(() => {
        setApartmentNumber('');
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);

      // Even if there's an error, clean up
      await audioService.stopRingtone();
      stopCallTimer();
      setCallDuration(0);
      setApartmentNumber('');
      onClose();
    }
  };

  // Handle mute toggle
  const handleToggleMute = async () => {
    try {
      await toggleMute();
    } catch (error) {
      console.error('Erro ao alternar microfone:', error);
      Alert.alert('Erro', 'Não foi possível alternar o microfone');
    }
  };

  // Handle speaker toggle
  const handleToggleSpeaker = async () => {
    try {
      await toggleSpeaker();
    } catch (error) {
      console.error('Erro ao alternar alto-falante:', error);
      Alert.alert('Erro', 'Não foi possível alternar o alto-falante');
    }
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
      setApartmentNumber((prev) => prev + digit);
    }
  };

  // Remover último dígito
  const removeLastDigit = () => {
    setApartmentNumber((prev) => prev.slice(0, -1));
  };

  // Renderizar botão do teclado numérico
  const renderKeypadButton = (digit: string) => (
    <TouchableOpacity
      key={digit}
      style={styles.keypadButton}
      onPress={() => addDigit(digit)}
      activeOpacity={0.7}>
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
          activeOpacity={0.7}>
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
          {apartmentNumber ? (
            <Text style={styles.apartmentDisplayNumber}>{apartmentNumber}</Text>
          ) : (
            <Text style={styles.apartmentDisplayText}>Digite o número do apto...</Text>
          )}
        </View>
      </View>

      {renderKeypad()}

      <TouchableOpacity
        style={[styles.callButton, !apartmentNumber.trim() && styles.callButtonDisabled]}
        onPress={initiateCall}
        disabled={!apartmentNumber.trim()}>
        <Text style={styles.callButtonText}>📞 Chamar</Text>
      </TouchableOpacity>
    </View>
  );

  // Renderizar interface da chamada
  const renderCallInterface = () => {
    const participants = activeCall?.participants || [];
    const participantCount = participants.length;

    return (
      <View style={styles.callContainer}>
        <View style={styles.callHeader}>
          <Text style={styles.callTitle}>
            {callState === 'dialing' && 'Chamando...'}
            {callState === 'ringing' && 'Tocando...'}
            {callState === 'connecting' && 'Conectando...'}
            {callState === 'connected' && 'Em chamada'}
            {callState === 'ending' && 'Encerrando...'}
            {callState === 'ended' && 'Chamada encerrada'}
          </Text>
          <Text style={styles.callSubtitle}>
            Apartamento {apartmentNumber} - {buildingName}
          </Text>

          {/* Show participant count */}
          {participantCount > 0 && (
            <Text style={styles.notificationFeedback}>
              👥 {participantCount} participante{participantCount > 1 ? 's' : ''}
            </Text>
          )}

          {/* Show error if any */}
          {error && <Text style={styles.errorMessage}>⚠️ {error}</Text>}

          {callState === 'connected' && (
            <Text style={styles.callDuration}>{formatCallDuration(callDuration)}</Text>
          )}
        </View>

        {(callState === 'dialing' || callState === 'ringing' || callState === 'connecting') && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            {callState === 'ringing' && (
              <Text style={styles.ringingText}>🔊 Som de chamada tocando</Text>
            )}
          </View>
        )}

        {callState === 'connected' && (
          <View style={styles.callControls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={handleToggleMute}>
              <Text style={styles.controlButtonText}>{isMuted ? '🔇' : '🎤'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
              onPress={handleToggleSpeaker}>
              <Text style={styles.controlButtonText}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
          disabled={callState === 'ending' || callState === 'ended'}>
          <Text style={styles.endCallButtonText}>
            {callState === 'ended'
              ? '✓ Encerrada'
              : callState === 'ending'
                ? 'Encerrando...'
                : '📞 Encerrar'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Effect para carregar informações quando modal abre
  useEffect(() => {
    if (visible && callState === 'idle') {
      loadBuildingInfo();
    }
  }, [visible, callState, loadBuildingInfo]);

  // Effect para limpeza quando modal fecha
  useEffect(() => {
    if (!visible) {
      // Limpar timers
      stopCallTimer();

      // Parar som de chamada
      audioService.stopRingtone().catch((error) => {
        console.error('Erro ao parar ringtone durante cleanup:', error);
      });

      // Reset apartment number
      setApartmentNumber('');
      setCallDuration(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Interfone</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {callState === 'idle' ? renderApartmentInput() : renderCallInterface()}
        </View>
      </View>
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
  errorMessage: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
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
  ringingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
});
