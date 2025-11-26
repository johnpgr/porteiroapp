import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIntercomCall } from '~/hooks/useIntercomCall';
import { useAuth } from '~/hooks/useAuth';
import { useUserApartment } from '~/hooks/useUserApartment';
import { supabase } from '~/utils/supabase';
import { IconSymbol } from '~/components/ui/IconSymbol';

interface OnDutyDoorman {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  shiftStatus?: string | null;
}

export default function MoradorIntercomScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { building, loading: apartmentLoading } = useUserApartment();
  const [doormen, setDoormen] = useState<OnDutyDoorman[]>([]);
  const [loadingDoormen, setLoadingDoormen] = useState(true);
  const [selectedDoorman, setSelectedDoorman] = useState<OnDutyDoorman | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Refs for call timer
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    callState,
    activeCall,
    isMuted,
    isSpeakerOn,
    error,
    callDoorman,
    endCall,
    toggleMute,
    toggleSpeaker,
  } = useIntercomCall(
    user?.id
      ? {
          id: user.id,
          userType: 'morador',
          displayName: user.email?.split('@')[0] || 'Morador',
        }
      : null
  );

  // Load on-duty doormen
  const loadOnDutyDoormen = useCallback(async () => {
    if (!building?.id) {
      setLoadingDoormen(false);
      return;
    }

    setLoadingDoormen(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, is_available')
        .eq('building_id', building.id)
        .eq('user_type', 'porteiro')
        .eq('is_available', true);

      if (error) {
        console.error('Error loading on-duty doormen:', error);
        setDoormen([]);
      } else {
        setDoormen(
          (data || []).map((d) => ({
            id: d.id,
            name: d.full_name,
            email: d.email,
            phone: d.phone,
            shiftStatus: d.is_available ? 'on_duty' : 'off_duty',
          }))
        );
      }
    } catch (err) {
      console.error('Error loading on-duty doormen:', err);
      setDoormen([]);
    } finally {
      setLoadingDoormen(false);
    }
  }, [building?.id]);

  useEffect(() => {
    if (!apartmentLoading && building?.id) {
      loadOnDutyDoormen();
    }
  }, [apartmentLoading, building?.id, loadOnDutyDoormen]);

  // Listen for call state changes
  useEffect(() => {
    if (callState === 'connected') {
      startCallTimer();
    }
  }, [callState]);

  // Start call timer
  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initiate call to selected doorman
  const initiateCall = async (doorman: OnDutyDoorman) => {
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!building?.id) {
      Alert.alert('Erro', 'Prédio não encontrado. Tente novamente.');
      return;
    }

    setSelectedDoorman(doorman);

    try {
      await callDoorman({
        doormanId: doorman.id,
        buildingId: building.id,
      });
    } catch (err) {
      const error = err as Error;
      const message = error?.message || 'Erro inesperado ao iniciar a chamada';
      console.warn('❌ Falha ao iniciar chamada:', message);
      Alert.alert('Erro', message);
      setSelectedDoorman(null);
    }
  };

  // End call
  const handleEndCall = async () => {
    try {
      await endCall('hangup');
      stopCallTimer();
      setCallDuration(0);
      setSelectedDoorman(null);

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      console.error('Erro ao encerrar chamada:', err);
      stopCallTimer();
      setCallDuration(0);
      setSelectedDoorman(null);
      router.back();
    }
  };

  // Handle close button
  const handleClose = () => {
    if (callState === 'idle') {
      router.back();
    } else {
      Alert.alert('Encerrar chamada?', 'Deseja encerrar a chamada e fechar o interfone?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: handleEndCall,
        },
      ]);
    }
  };

  // Handle mute toggle
  const handleToggleMute = async () => {
    try {
      await toggleMute();
    } catch (err) {
      console.error('Erro ao alternar microfone:', err);
      Alert.alert('Erro', 'Não foi possível alternar o microfone');
    }
  };

  // Handle speaker toggle
  const handleToggleSpeaker = async () => {
    try {
      await toggleSpeaker();
    } catch (err) {
      console.error('Erro ao alternar alto-falante:', err);
      Alert.alert('Erro', 'Não foi possível alternar o alto-falante');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallTimer();
    };
  }, []);

  // Render doorman list item
  const renderDoormanItem = ({ item }: { item: OnDutyDoorman }) => (
    <TouchableOpacity
      style={styles.doormanCard}
      onPress={() => initiateCall(item)}
      activeOpacity={0.7}>
      <View style={styles.doormanIconContainer}>
        <IconSymbol name="person.circle.fill" color="#4CAF50" size={40} />
      </View>
      <View style={styles.doormanInfo}>
        <Text style={styles.doormanName}>{item.name || 'Porteiro'}</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>De plantão</Text>
        </View>
      </View>
      <View style={styles.callIconContainer}>
        <IconSymbol name="phone.fill" color="#4CAF50" size={24} />
      </View>
    </TouchableOpacity>
  );

  // Render doorman selection screen
  const renderDoormanSelection = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.buildingTitle}>{building?.name || 'Seu Condomínio'}</Text>
      <Text style={styles.subtitle}>Selecione um porteiro de plantão para chamar</Text>

      {loadingDoormen ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Buscando porteiros...</Text>
        </View>
      ) : doormen.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="person.slash" color="#999" size={48} />
          <Text style={styles.emptyTitle}>Nenhum porteiro de plantão</Text>
          <Text style={styles.emptySubtitle}>
            Não há porteiros de plantão no momento. Tente novamente mais tarde.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadOnDutyDoormen}>
            <Text style={styles.refreshButtonText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={doormen}
          keyExtractor={(item) => item.id}
          renderItem={renderDoormanItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  // Render call interface
  const renderCallInterface = () => {
    const participants = activeCall?.participants || [];
    const participantCount = participants.length;

    return (
      <View style={styles.callContainer}>
        <View style={styles.callHeader}>
          <Text style={styles.callTitle}>
            {callState === 'dialing' && 'Chamando...'}
            {callState === 'ringing' && 'Tocando...'}
            {(callState === 'connecting' || callState === 'rtc_joining') && 'Conectando...'}
            {callState === 'connected' && 'Em chamada'}
            {callState === 'ending' && 'Encerrando...'}
            {callState === 'ended' && 'Chamada encerrada'}
          </Text>
          <Text style={styles.callSubtitle}>
            {selectedDoorman?.name || 'Porteiro'} - {building?.name || 'Condomínio'}
          </Text>

          {participantCount > 0 && (
            <Text style={styles.notificationFeedback}>
              👥 {participantCount} participante{participantCount > 1 ? 's' : ''}
            </Text>
          )}

          {error && <Text style={styles.errorMessage}>⚠️ {error}</Text>}

          {callState === 'connected' && (
            <Text style={styles.callDuration}>{formatCallDuration(callDuration)}</Text>
          )}
        </View>

        {(callState === 'dialing' ||
          callState === 'ringing' ||
          callState === 'connecting' ||
          callState === 'rtc_joining') && (
          <View style={styles.loadingCallContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <IconSymbol name="chevron.left" color="#fff" size={30} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={styles.title}>📞 Interfone</Text>
          <Text style={styles.headerSubtitle}>Chamar Portaria</Text>
        </View>
      </View>

      <View style={styles.content}>
        {callState === 'idle' ? renderDoormanSelection() : renderCallInterface()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    paddingHorizontal: 20,
    gap: 50,
    paddingVertical: 30,
    marginBottom: 10,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Selection screen
  selectionContainer: {
    flex: 1,
  },
  buildingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  doormanCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doormanIconContainer: {
    marginRight: 12,
  },
  doormanInfo: {
    flex: 1,
  },
  doormanName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
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
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  callIconContainer: {
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Call interface
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
  loadingCallContainer: {
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
});
