import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import IntercomCallService from '../services/intercomCallService';
import CallKeepService from '../services/CallKeepService';
import { useAuth } from './useAuth';

interface CallData {
  callId: string;
  apartmentNumber: string;
  doormanName?: string;
  buildingName?: string;
  doormanId: string;
  buildingId: string;
}

interface UseIntercomCallReturn {
  isCallActive: boolean;
  currentCall: CallData | null;
  showCallScreen: boolean;
  answerCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  dismissCallScreen: () => void;
}

export const useIntercomCall = (): UseIntercomCallReturn => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [showCallScreen, setShowCallScreen] = useState(false);
  const { user } = useAuth();

  // Inicializar serviços de chamadas
  useEffect(() => {
    const initializeCallServices = async () => {
      try {
        await IntercomCallService.initialize();
        await CallKeepService.initialize();
        console.log('✅ Serviços de chamadas inicializados');
      } catch (error) {
        console.error('❌ Erro ao inicializar serviços de chamadas:', error);
      }
    };

    initializeCallServices();

    // Cleanup ao desmontar
    return () => {
      IntercomCallService.cleanup();
      CallKeepService.cleanup();
    };
  }, []);

  // Listener para notificações de chamada recebidas
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        
        if (data?.type === 'intercom_call') {
          console.log('📞 Notificação de chamada recebida:', data);
          
          const callData: CallData = {
            callId: data.callId,
            apartmentNumber: data.apartmentNumber,
            doormanName: data.doormanName,
            buildingName: data.buildingName,
            doormanId: data.doormanId,
            buildingId: data.buildingId,
          };

          // Exibir chamada via CallKeep
          CallKeepService.displayIncomingCall(
            data.callId,
            `Interfone - Apt ${data.apartmentNumber}`,
            data.doormanName || 'Porteiro'
          );

          setCurrentCall(callData);
          setIsCallActive(true);
          setShowCallScreen(true);
        }
      }
    );

    // Listener para respostas às notificações
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        
        if (data?.type === 'intercom_call') {
          const callId = data.callId;
          const actionIdentifier = response.actionIdentifier;

          if (actionIdentifier === 'ANSWER_CALL' || 
              actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            await answerCall(callId);
          } else if (actionIdentifier === 'DECLINE_CALL') {
            await declineCall(callId);
          }
        }
      }
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Atender chamada
  const answerCall = useCallback(async (callId: string) => {
    try {
      console.log('✅ Atendendo chamada:', callId);

      // Reportar chamada como conectada no CallKeep
      CallKeepService.reportCallConnected(callId);

      // Fazer requisição para o backend
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/intercom/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call_id: callId,
          resident_id: user?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atender chamada no servidor');
      }

      // Limpar estado local
      setIsCallActive(false);
      setCurrentCall(null);
      setShowCallScreen(false);

      // Mostrar feedback de sucesso
      Alert.alert(
        'Chamada Atendida',
        'Você atendeu a chamada do interfone. O porteiro foi notificado.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ Erro ao atender chamada:', error);
      
      // Reportar erro no CallKeep
      CallKeepService.reportCallEnded(callId, 'failed');
      
      Alert.alert(
        'Erro',
        'Não foi possível atender a chamada. Tente novamente.',
        [{ text: 'OK' }]
      );
    }
  }, [user?.id]);

  // Recusar chamada
  const declineCall = useCallback(async (callId: string) => {
    try {
      console.log('❌ Recusando chamada:', callId);

      // Reportar chamada como finalizada no CallKeep
      CallKeepService.reportCallEnded(callId, 'rejected');

      // Fazer requisição para o backend
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/intercom/hangup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call_id: callId
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao recusar chamada no servidor');
      }

      // Limpar estado local
      setIsCallActive(false);
      setCurrentCall(null);
      setShowCallScreen(false);

      // Mostrar feedback
      Alert.alert(
        'Chamada Recusada',
        'Você recusou a chamada do interfone.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ Erro ao recusar chamada:', error);
      Alert.alert(
        'Erro',
        'Não foi possível recusar a chamada. Tente novamente.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // Dispensar tela de chamada (timeout ou manual)
  const dismissCallScreen = useCallback(() => {
    setShowCallScreen(false);
    setIsCallActive(false);
    setCurrentCall(null);
  }, []);

  // Listener para timeout de chamadas
  useEffect(() => {
    if (isCallActive && currentCall) {
      // Timeout automático após 45 segundos
      const timeoutId = setTimeout(() => {
        console.log('⏰ Timeout automático da chamada');
        dismissCallScreen();
      }, 45000);

      return () => clearTimeout(timeoutId);
    }
  }, [isCallActive, currentCall, dismissCallScreen]);

  return {
    isCallActive,
    currentCall,
    showCallScreen,
    answerCall,
    declineCall,
    dismissCallScreen,
  };
};