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

  // FUNÇÃO PRINCIPAL: Processar chamada recebida
  const processIncomingCall = useCallback((data: any) => {
    console.log('📞 [PROCESSO] Processando chamada recebida:', data);
    
    if (data?.action === 'incoming_call' || data?.type === 'intercom_call') {
      const callData: CallData = {
        callId: data.callId,
        apartmentNumber: data.apartmentNumber,
        doormanName: data.doormanName,
        buildingName: data.buildingName,
        doormanId: data.doormanId,
        buildingId: data.buildingId,
      };

      console.log('📞 [PROCESSO] Dados da chamada:', callData);

      // Exibir chamada via CallKeep
      CallKeepService.displayIncomingCall(
        data.callId,
        `Interfone - Apt ${data.apartmentNumber}`,
        data.doormanName || 'Porteiro'
      );

      // FORÇAR exibição do modal IMEDIATAMENTE
      console.log('📞 [PROCESSO] FORÇANDO exibição do modal...');
      setCurrentCall(callData);
      setIsCallActive(true);
      setShowCallScreen(true);
      
      console.log('📞 [PROCESSO] Estados definidos - Modal deve aparecer AGORA!');
      
      // Garantir que o modal apareça mesmo se houver problemas de estado
      setTimeout(() => {
        console.log('📞 [TIMEOUT] Verificando se modal está visível...');
        setShowCallScreen(true);
        setIsCallActive(true);
      }, 100);
      
      return true;
    }
    
    return false;
  }, []);

  // LISTENER PRINCIPAL: Notificações recebidas (app em foreground)
  useEffect(() => {
    console.log('🔧 [SETUP] Configurando listener de notificações...');
    
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📨 [FOREGROUND] Notificação recebida:', notification);
        const data = notification.request.content.data;
        console.log('📨 [FOREGROUND] Dados:', data);
        
        const processed = processIncomingCall(data);
        if (processed) {
          console.log('📞 [FOREGROUND] Chamada processada com sucesso');
        }
      }
    );

    return () => {
      notificationListener.remove();
    };
  }, [processIncomingCall]);

  // LISTENER SECUNDÁRIO: Respostas de notificação (app em background/fechado)
  useEffect(() => {
    console.log('🔧 [SETUP] Configurando listener de respostas...');
    
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('📨 [BACKGROUND] Resposta de notificação:', response);
        const data = response.notification.request.content.data;
        console.log('📨 [BACKGROUND] Dados:', data);
        
        const processed = processIncomingCall(data);
        if (processed) {
          console.log('📞 [BACKGROUND] Chamada processada com sucesso');
        }
      }
    );

    return () => {
      responseListener.remove();
    };
  }, [processIncomingCall]);

  // LISTENER DE EMERGÊNCIA: Verificar notificações ao abrir o app
  useEffect(() => {
    const checkPendingNotifications = async () => {
      try {
        console.log('🔍 [STARTUP] Verificando notificações pendentes...');
        
        // Verificar se há notificações não lidas
        const notifications = await Notifications.getPresentedNotificationsAsync();
        console.log('🔍 [STARTUP] Notificações encontradas:', notifications.length);
        
        for (const notification of notifications) {
          const data = notification.request.content.data;
          if (data?.action === 'incoming_call' || data?.type === 'intercom_call') {
            console.log('🔍 [STARTUP] Chamada pendente encontrada:', data);
            processIncomingCall(data);
            break; // Processar apenas a primeira chamada encontrada
          }
        }
      } catch (error) {
        console.error('❌ [STARTUP] Erro ao verificar notificações:', error);
      }
    };

    checkPendingNotifications();
  }, [processIncomingCall]);

  // Configurar callbacks do CallKeep
  useEffect(() => {
    // Configurar callback para chamadas recebidas (modal)
    CallKeepService.setOnIncomingCall((callData) => {
      console.log('📞 CallKeep: Chamada recebida via modal', callData);
      
      const callInfo: CallData = {
        callId: callData.callUUID,
        apartmentNumber: callData.callerName.replace('Interfone - Apt ', ''),
        doormanName: callData.handle,
        buildingName: '',
        doormanId: '',
        buildingId: '',
      };

      setCurrentCall(callInfo);
      setIsCallActive(true);
      setShowCallScreen(true);
    });

    CallKeepService.setOnCallAnswered(async (callUUID: string) => {
      console.log('📞 CallKeep: Chamada atendida via modal', callUUID);
      if (currentCall?.callId === callUUID) {
        await answerCall(callUUID);
      }
    });

    CallKeepService.setOnCallEnded((callUUID: string) => {
      console.log('📞 CallKeep: Chamada encerrada via modal', callUUID);
      if (currentCall?.callId === callUUID) {
        declineCall(callUUID);
      }
    });
  }, [currentCall]);

  // Atender chamada
  const answerCall = useCallback(async (callId: string) => {
    try {
      console.log('✅ Atendendo chamada:', callId);

      // Fazer requisição para o backend para confirmar atendimento
      const response = await fetch(`${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL}/api/intercom/answer`, {
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

      const result = await response.json();
      console.log('✅ Resposta do servidor:', result);

      // Reportar chamada como conectada no CallKeep APÓS confirmação do servidor
      CallKeepService.reportCallConnected(callId);

      // Limpar estado local
      setIsCallActive(false);
      setCurrentCall(null);
      setShowCallScreen(false);

      // Mostrar feedback de sucesso
      Alert.alert(
        'Chamada Atendida',
        'Você atendeu a chamada do interfone. A conexão com o porteiro foi estabelecida.',
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
      const response = await fetch(`${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL}/api/intercom/hangup`, {
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