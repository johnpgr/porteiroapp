import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { Alert, Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '~/hooks/useAuth';
import { registerForPushNotificationsAsync, savePushToken } from '~/services/notificationService';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { supabase } from '~/utils/supabase';
import { audioService } from '~/services/audioService';
import {
  answerIntercomCall,
  declineIntercomCall,
  getIntercomCallStatus,
} from '~/services/intercomService';

interface IntercomCallData {
  callId: string;
  apartmentNumber?: string;
  apartmentId?: string | null;
  doormanId: string;
  doormanName?: string;
  buildingId?: string | null;
  buildingName?: string;
  status?: string;
}

type CallParticipantRecord = {
  call_id: string;
  resident_id: string | null;
  user_id?: string | null;
  status: string;
  created_at: string;
};

export default function MoradorLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user } = useAuth();

  // Estados para chamada de interfone
  const [incomingCall, setIncomingCall] = useState<IntercomCallData | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callStatusMessage, setCallStatusMessage] = useState('');

  const incomingCallRef = useRef<IntercomCallData | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const callActionRef = useRef<'answered' | 'declined' | null>(null);
  const ringtonePlayingRef = useRef(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Refs para listeners
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  const updateIncomingCall = useCallback((data: IntercomCallData | null) => {
    incomingCallRef.current = data;
    setIncomingCall(data);
  }, []);

  useEffect(() => {
    audioService.initialize().catch((error: unknown) => {
      console.warn('⚠️ [MoradorLayout] Falha ao inicializar áudio do interfone:', error);
    });
  }, []);

  const startIncomingCallTone = useCallback(async () => {
    if (ringtonePlayingRef.current) {
      return;
    }

    try {
      await audioService.initialize();
      await audioService.loadRingtone();
      await audioService.playRingtone();
      ringtonePlayingRef.current = true;
    } catch (error) {
      console.error('❌ [MoradorLayout] Erro ao iniciar ringtone do interfone:', error);
    }
  }, []);

  const stopIncomingCallTone = useCallback(async () => {
    if (!ringtonePlayingRef.current) {
      return;
    }

    try {
      await audioService.stopRingtone();
    } catch (error) {
      console.error('❌ [MoradorLayout] Erro ao parar ringtone do interfone:', error);
    } finally {
      ringtonePlayingRef.current = false;
    }
  }, []);

  const resetIncomingCall = useCallback(async () => {
    await stopIncomingCallTone();
    setShowCallModal(false);
    setCallStatusMessage('');
    updateIncomingCall(null);
    activeCallIdRef.current = null;
    callActionRef.current = null;
  }, [stopIncomingCallTone, updateIncomingCall]);

  const handleAnswerCall = useCallback(
    async (callData: IntercomCallData) => {
      if (!user?.id) {
        Alert.alert('Sessão expirada', 'Faça login novamente para atender a chamada.');
        return;
      }

      callActionRef.current = 'answered';
      activeCallIdRef.current = callData.callId;

      try {
        setCallStatusMessage('Conectando com o porteiro...');
        await stopIncomingCallTone();

        const response = await answerIntercomCall({
          callId: callData.callId,
          userId: user.id,
          userType: 'resident',
        });

        if (!response.success) {
          callActionRef.current = null;
          Alert.alert('Erro', response.error || 'Não foi possível atender a chamada');
          await startIncomingCallTone();
          setShowCallModal(true);
          return;
        }

        console.log('✅ [MoradorLayout] Chamada aceita com sucesso');
        await resetIncomingCall();
      } catch (error) {
        callActionRef.current = null;
        console.error('❌ [MoradorLayout] Erro ao aceitar chamada:', error);
        Alert.alert('Erro', 'Não foi possível aceitar a chamada');
        await startIncomingCallTone();
        setShowCallModal(true);
      }
    },
    [resetIncomingCall, startIncomingCallTone, stopIncomingCallTone, user?.id]
  );

  const handleDeclineCall = useCallback(
    async (callData: IntercomCallData) => {
      if (!user?.id) {
        await resetIncomingCall();
        return;
      }

      callActionRef.current = 'declined';
      activeCallIdRef.current = callData.callId;

      try {
        setCallStatusMessage('Encerrando chamada...');
        await stopIncomingCallTone();
        const response = await declineIntercomCall({
          callId: callData.callId,
          userId: user.id,
          userType: 'resident',
          reason: 'declined',
        });

        if (!response.success) {
          console.warn('⚠️ [MoradorLayout] Falha ao recusar chamada:', response.error);
        }
      } catch (error) {
        console.error('❌ [MoradorLayout] Erro ao recusar chamada:', error);
      } finally {
        await resetIncomingCall();
      }
    },
    [resetIncomingCall, stopIncomingCallTone, user?.id]
  );

  const handleRealtimeParticipantChange = useCallback(
    async (participant: Record<string, any> | null) => {
      if (!participant) {
        return;
      }

      const participantUserId = participant.user_id ?? participant.resident_id;
      if (!participantUserId || participantUserId !== user?.id) {
        return;
      }

      const callId: string | undefined = participant.call_id;
      const status: string | undefined = participant.status;

      if (!callId || !status) {
        return;
      }

      const incomingStatuses = new Set(['invited', 'notified', 'ringing']);

      if (incomingStatuses.has(status)) {
        if (activeCallIdRef.current === callId && incomingCallRef.current?.callId === callId) {
          return;
        }

        activeCallIdRef.current = callId;
        callActionRef.current = null;
        setCallStatusMessage('Porteiro chamando...');
        setShowCallModal(true);
        await startIncomingCallTone();

        const minimalCallData: IntercomCallData = {
          callId,
          doormanId: typeof participant.doorman_id === 'string' ? participant.doorman_id : '',
          doormanName:
            typeof participant.doorman_name === 'string' && participant.doorman_name.length > 0
              ? participant.doorman_name
              : 'Porteiro',
          apartmentNumber:
            typeof participant.apartment_number === 'string'
              ? participant.apartment_number
              : undefined,
          buildingId:
            typeof participant.building_id === 'string' ? participant.building_id : undefined,
          buildingName:
            typeof participant.building_name === 'string' ? participant.building_name : undefined,
          status,
        };

        updateIncomingCall(minimalCallData);

        // Buscar detalhes completos da chamada em paralelo para preencher informações na UI
        const statusResponse = await getIntercomCallStatus(callId);
        if (!statusResponse.success || !statusResponse.data?.call) {
          console.warn(
            '⚠️ [MoradorLayout] Não foi possível obter detalhes da chamada:',
            statusResponse.error
          );
          return;
        }

        if (activeCallIdRef.current !== callId) {
          return;
        }

        const callInfo = statusResponse.data.call;
        const callInfoAny = callInfo as Record<string, any>;
        const enrichedCallData: IntercomCallData = {
          callId: callInfo.id,
          apartmentNumber:
            callInfo.apartmentNumber ??
            (typeof callInfoAny.apartment_number === 'string'
              ? callInfoAny.apartment_number
              : undefined) ??
            minimalCallData.apartmentNumber,
          apartmentId:
            callInfo.apartmentId ??
            (typeof callInfoAny.apartment_id === 'string' ? callInfoAny.apartment_id : null) ??
            minimalCallData.apartmentId ??
            null,
          doormanId:
            callInfo.doormanId ??
            (typeof callInfoAny.doorman_id === 'string' ? callInfoAny.doorman_id : undefined) ??
            minimalCallData.doormanId,
          doormanName:
            callInfo.doormanName ??
            (typeof callInfoAny.doorman_name === 'string' ? callInfoAny.doorman_name : undefined) ??
            minimalCallData.doormanName ??
            'Porteiro',
          buildingId:
            callInfo.buildingId ??
            (typeof callInfoAny.building_id === 'string' ? callInfoAny.building_id : null) ??
            minimalCallData.buildingId ??
            null,
          buildingName:
            callInfo.buildingName ??
            (typeof callInfoAny.building_name === 'string'
              ? callInfoAny.building_name
              : undefined) ??
            minimalCallData.buildingName,
          status: callInfo.status ?? status,
        };

        updateIncomingCall(enrichedCallData);
        return;
      }

      if (!activeCallIdRef.current || activeCallIdRef.current !== callId) {
        return;
      }

      if (status === 'connected') {
        await stopIncomingCallTone();
        setCallStatusMessage('Conectando com o porteiro...');
        return;
      }

      if (status === 'declined') {
        if (callActionRef.current !== 'declined') {
          Alert.alert('Chamada recusada', 'A chamada foi encerrada.');
        }
        await resetIncomingCall();
        return;
      }

      if (status === 'missed') {
        if (!callActionRef.current) {
          Alert.alert('Chamada perdida', 'A chamada foi atendida por outro morador ou expirou.');
        }
        await resetIncomingCall();
        return;
      }

      if (status === 'disconnected' || status === 'ended') {
        if (!callActionRef.current) {
          Alert.alert('Chamada encerrada', 'O porteiro finalizou a chamada.');
        }
        await resetIncomingCall();
      }
    },
    [resetIncomingCall, startIncomingCallTone, stopIncomingCallTone, updateIncomingCall, user?.id]
  );

  const parseNotificationCallData = useCallback(
    (payload: Record<string, unknown> | null | undefined): IntercomCallData | null => {
      if (!payload) {
        return null;
      }

      const callId = payload.callId ?? (payload as Record<string, unknown>).call_id;
      const doormanId = payload.doormanId ?? (payload as Record<string, unknown>).doorman_id;

      if (typeof callId !== 'string' || callId.length === 0) {
        return null;
      }

      const toStringIfString = (value: unknown): string | undefined =>
        typeof value === 'string' && value.length > 0 ? value : undefined;

      return {
        callId,
        apartmentNumber:
          toStringIfString(payload.apartmentNumber) ??
          toStringIfString((payload as Record<string, unknown>).apartment_number),
        apartmentId:
          toStringIfString(payload.apartmentId) ??
          toStringIfString((payload as Record<string, unknown>).apartment_id) ??
          null,
        doormanId: toStringIfString(doormanId) ?? '',
        doormanName:
          toStringIfString(payload.doormanName) ??
          toStringIfString((payload as Record<string, unknown>).doorman_name) ??
          'Porteiro',
        buildingId:
          toStringIfString(payload.buildingId) ??
          toStringIfString((payload as Record<string, unknown>).building_id),
        buildingName:
          toStringIfString(payload.buildingName) ??
          toStringIfString((payload as Record<string, unknown>).building_name),
        status: toStringIfString(payload.status),
      };
    },
    []
  );

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // 🔔 REGISTRAR PUSH TOKEN para notificações do morador
  useEffect(() => {
    const registerPushToken = async () => {
      if (!user?.id) return;

      try {
        console.log('🔔 [MoradorLayout] Registrando push token para morador:', user.id);
        const pushToken = await registerForPushNotificationsAsync();

        if (pushToken) {
          const saved = await savePushToken(user.id, pushToken);

          if (saved) {
            console.log('✅ [MoradorLayout] Push token registrado com sucesso');
          } else {
            console.warn('⚠️ [MoradorLayout] Falha ao salvar push token no banco');
          }
        } else {
          console.warn('⚠️ [MoradorLayout] Push token não obtido (emulador ou permissão negada)');
        }
      } catch (pushError) {
        console.error('❌ [MoradorLayout] Erro ao registrar push token:', pushError);
        // Não bloquear o layout por erro de push token
      }
    };

    registerPushToken();
  }, [user?.id]);

  // 📞 CONFIGURAR LISTENERS PARA CHAMADAS DE INTERFONE
  useEffect(() => {
    if (!user?.id) {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      return;
    }

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const payload = notification.request.content.data as Record<string, unknown>;
      if (payload?.type !== 'intercom_call') {
        return;
      }

      const callData = parseNotificationCallData(payload);
      if (!callData) {
        return;
      }

      console.log('📞 [MoradorLayout] Chamada de interfone recebida:', callData);

      callActionRef.current = null;
      updateIncomingCall(callData);
      activeCallIdRef.current = callData.callId;
      setCallStatusMessage('Porteiro chamando...');
      setShowCallModal(true);
      void startIncomingCallTone();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = response.notification.request.content.data as Record<string, unknown>;
      if (payload?.type !== 'intercom_call') {
        return;
      }

      const callData = parseNotificationCallData(payload);
      if (!callData) {
        return;
      }

      console.log(
        '📞 [MoradorLayout] Resposta à notificação de chamada:',
        response.actionIdentifier
      );

      if (
        response.actionIdentifier === 'ANSWER_CALL' ||
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        void handleAnswerCall(callData);
      } else if (response.actionIdentifier === 'DECLINE_CALL') {
        void handleDeclineCall(callData);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [
    handleAnswerCall,
    handleDeclineCall,
    parseNotificationCallData,
    startIncomingCallTone,
    updateIncomingCall,
    user?.id,
  ]);

  // ⏱️ Fallback: verifica periodicamente se há chamadas pendentes
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isMounted = true;

    const checkPendingInvites = async () => {
      if (!isMounted) {
        return;
      }

      // Evita consultas redundantes se já temos uma chamada em andamento
      if (incomingCallRef.current) {
        return;
      }

      const { data, error } = await (supabase.from('call_participants') as any)
        .select('call_id, status, resident_id, created_at, user_id')
        .eq('resident_id', user.id)
        .in('status', ['invited', 'notified', 'ringing'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('⚠️ [MoradorLayout] Erro ao verificar chamadas pendentes:', error);
        return;
      }

      const participants = (data ?? []) as CallParticipantRecord[];

      if (participants.length > 0) {
        const participant = participants[0];
        await handleRealtimeParticipantChange(participant as Record<string, any>);
      }
    };

    const intervalId = setInterval(checkPendingInvites, 5000);
    checkPendingInvites();

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [handleRealtimeParticipantChange, user?.id]);

  // 🔴 INSCRIÇÃO EM TEMPO REAL PARA PARTICIPAÇÕES DE CHAMADA
  useEffect(() => {
    if (!user?.id) {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`resident-intercom-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_participants',
          filter: `resident_id=eq.${user.id}`,
        },
        (payload) => {
          void handleRealtimeParticipantChange(payload.new as Record<string, any>);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_participants',
          filter: `resident_id=eq.${user.id}`,
        },
        (payload) => {
          void handleRealtimeParticipantChange(payload.new as Record<string, any>);
        }
      );

    channel.subscribe((status) => {
      console.log('📡 [MoradorLayout] Canal realtime interfone:', status);
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [handleRealtimeParticipantChange, user?.id]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="authorize" />
        <Stack.Screen name="token-authorize" />
        <Stack.Screen name="preregister" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="emergency" />
        <Stack.Screen name="avisos" />
        <Stack.Screen name="visitantes/novo" />
        <Stack.Screen name="visitantes/nome" />
        <Stack.Screen name="visitantes/cpf" />
        <Stack.Screen name="visitantes/foto" />
        <Stack.Screen name="visitantes/periodo" />
        <Stack.Screen name="visitantes/observacoes" />
        <Stack.Screen name="visitantes/confirmacao" />
        <Stack.Screen name="cadastro/novo" />
        <Stack.Screen name="cadastro/relacionamento" />
        <Stack.Screen name="cadastro/telefone" />
        <Stack.Screen name="cadastro/placa" />
        <Stack.Screen name="cadastro/acesso" />
        <Stack.Screen name="cadastro/foto" />
        <Stack.Screen name="cadastro/dias" />
        <Stack.Screen name="cadastro/horarios" />
        <Stack.Screen name="testes" />
      </Stack>

      {/* 📞 MODAL DE CHAMADA DE INTERFONE */}
      <Modal
        visible={showCallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (incomingCallRef.current) {
            void handleDeclineCall(incomingCallRef.current);
          } else {
            void resetIncomingCall();
          }
        }}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.callModal}>
            <View style={styles.callHeader}>
              <Text style={styles.callTitle}>📞 Chamada do Interfone</Text>
              <Text style={styles.callSubtitle}>
                {incomingCall?.doormanName || 'Porteiro'} está chamando
              </Text>
              <Text style={styles.apartmentText}>
                Apartamento {incomingCall?.apartmentNumber ?? '—'}
              </Text>
              {incomingCall?.buildingName ? (
                <Text style={styles.buildingText}>{incomingCall.buildingName}</Text>
              ) : null}
            </View>

            <View style={styles.callBody}>
              <View style={styles.ringingIndicator}>
                <View style={styles.ringingDot} />
              </View>
              {callStatusMessage ? (
                <Text style={styles.callStatusText}>{callStatusMessage}</Text>
              ) : null}
            </View>

            <View style={styles.callActions}>
              <TouchableOpacity
                style={[styles.callButton, styles.declineButton]}
                onPress={() => incomingCall && void handleDeclineCall(incomingCall)}>
                <Text style={styles.buttonText}>❌ Recusar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callButton, styles.answerButton]}
                onPress={() => incomingCall && void handleAnswerCall(incomingCall)}>
                <Text style={styles.buttonText}>✅ Atender</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 15, 0.92)',
  },
  callModal: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  callHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  callTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  callSubtitle: {
    fontSize: 18,
    color: '#CBD5F5',
  },
  apartmentText: {
    fontSize: 16,
    color: '#A5B4FC',
  },
  buildingText: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  callBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  ringingIndicator: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 3,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ringingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#38BDF8',
  },
  callStatusText: {
    color: '#E2E8F0',
    fontSize: 16,
    textAlign: 'center',
  },
  callActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  callButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  answerButton: {
    backgroundColor: '#22C55E',
  },
  buttonText: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '600',
  },
});
