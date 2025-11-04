import { supabase } from '../utils/supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getCurrentUser } from '~/hooks/useAuth';

// Interfaces para tipagem
export interface IntercomCallData {
  callId: string;
  apartmentNumber: string;
  doormanId: string;
  doormanName?: string;
  buildingId: string;
  buildingName?: string;
  residents: {
    id: string;
    name: string;
    phone?: string;
    notificationEnabled: boolean;
  }[];
  deviceTokens: {
    profile_id: string;
    token: string;
    platform: string;
  }[];
}

export interface CallNotificationCallback {
  (notification: any): Promise<void>;
}

class IntercomCallService {
  private activeCalls: Map<string, {
    interval: NodeJS.Timeout;
    timeout: NodeJS.Timeout;
    data: IntercomCallData;
    callback: CallNotificationCallback;
  }> = new Map();

  private notificationListener: any = null;
  private responseListener: any = null;
  private isInitialized = false;

  constructor() {
    this.setupNotificationHandler();
  }

  /**
   * Configura o handler de notificações para chamadas
   */
  private setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // Sempre mostrar notificações de chamada com alta prioridade
        if (notification.request.content.data?.type === 'intercom_call') {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          };
        }
        
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });
  }

  /**
   * Inicializa o serviço
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.setupCallNotificationChannel();
    await this.setupPushNotificationListeners();
    this.isInitialized = true;
  }

  /**
   * Configura canal específico para chamadas de interfone
   */
  private async setupCallNotificationChannel(): Promise<void> {
    if (Device.isDevice && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('intercom-call', {
        name: 'Chamadas do Interfone',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000],
        lightColor: '#FF0000',
        sound: 'telephone_toque_interfone.mp3', // Custom intercom ringtone from assets
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }

  /**
   * Configura listeners para notificações push
   */
  private async setupPushNotificationListeners(): Promise<void> {
    try {
      // Solicitar permissões
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('⚠️ Permissão de notificação não concedida para chamadas');
        return;
      }

      // Listener para notificações recebidas
      this.notificationListener = Notifications.addNotificationReceivedListener(
        this.handleCallNotificationReceived.bind(this)
      );

      // Listener para respostas às notificações
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        this.handleCallNotificationResponse.bind(this)
      );

    } catch (error) {
      console.error('❌ Erro ao configurar listeners de chamadas:', error);
    }
  }

  /**
   * Inicia uma chamada contínua
   */
  async startCall(callData: IntercomCallData, callback: CallNotificationCallback): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('📞 Iniciando chamada contínua:', callData.callId);

    // Parar chamada existente se houver
    if (this.activeCalls.has(callData.callId)) {
      this.stopCall(callData.callId);
    }

    // Enviar primeira notificação imediatamente
    await this.sendCallNotification(callData, callback);

    // Configurar intervalo para notificações repetidas (a cada 2 segundos)
    const interval = setInterval(async () => {
      await this.sendCallNotification(callData, callback);
    }, 2000);

    // Configurar timeout da chamada (45 segundos)
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout da chamada:', callData.callId);
      this.stopCall(callData.callId);
      this.handleCallTimeout(callData);
    }, 45000);

    // Armazenar dados da chamada ativa
    this.activeCalls.set(callData.callId, {
      interval,
      timeout,
      data: callData,
      callback
    });
  }

  /**
   * Para uma chamada contínua
   */
  stopCall(callId: string): void {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) return;

    console.log('🛑 Parando chamada contínua:', callId);

    // Limpar interval e timeout
    clearInterval(activeCall.interval);
    clearTimeout(activeCall.timeout);

    // Remover da lista de chamadas ativas
    this.activeCalls.delete(callId);

    // Cancelar notificações pendentes
    this.cancelCallNotifications(callId);
  }

  /**
   * Envia notificação de chamada
   */
  private async sendCallNotification(callData: IntercomCallData, callback: CallNotificationCallback): Promise<void> {
    try {
      const notificationPayload = {
        userId: callData.residents[0]?.id,
        title: 'Chamada do Interfone',
        body: `Porteiro chamando para o apartamento ${callData.apartmentNumber}`,
        data: {
          type: 'intercom_call',
          callId: callData.callId,
          apartmentNumber: callData.apartmentNumber,
          doormanId: callData.doormanId,
          doormanName: callData.doormanName,
          buildingId: callData.buildingId,
          buildingName: callData.buildingName,
          action: 'incoming_call'
        }
      };

      // Enviar via callback (para backend)
      await callback(notificationPayload);

      // Enviar notificação local também
      await this.sendLocalCallNotification(callData);

    } catch (error) {
      console.error('❌ Erro ao enviar notificação de chamada:', error);
    }
  }

  /**
   * Envia notificação local de chamada
   */
  private async sendLocalCallNotification(callData: IntercomCallData): Promise<void> {
    const notificationConfig: any = {
      content: {
        title: 'Chamada do Interfone',
        body: `Porteiro chamando para o apartamento ${callData.apartmentNumber}`,
        data: {
          type: 'intercom_call',
          callId: callData.callId,
          apartmentNumber: callData.apartmentNumber,
          doormanId: callData.doormanId,
          buildingId: callData.buildingId,
          action: 'incoming_call'
        },
        sound: 'telephone_toque_interfone.mp3', // Custom intercom ringtone from assets
        priority: 'max',
        categoryIdentifier: 'CALL_CATEGORY',
      },
      trigger: null,
    };

    // Configurações específicas para Android
    if (Device.isDevice && Platform.OS === 'android') {
      notificationConfig.content.android = {
        channelId: 'intercom-call',
        priority: 'max',
        vibrate: [0, 1000, 500, 1000],
        color: '#FF0000',
        sticky: true,
        autoCancel: false,
        fullScreenIntent: true,
        category: 'call',
        sound: 'telephone_toque_interfone.mp3', // Custom intercom ringtone from assets
        actions: [
          {
            identifier: 'ANSWER_CALL',
            buttonTitle: 'Atender',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'DECLINE_CALL',
            buttonTitle: 'Recusar',
            options: {
              opensAppToForeground: false,
            },
          },
        ],
      };
    }

    // Configurações específicas para iOS
    if (Device.isDevice && Platform.OS === 'ios') {
      notificationConfig.content.ios = {
        sound: 'telephone_toque_interfone.mp3', // Custom intercom ringtone from assets
        badge: 1,
        critical: true,
        interruptionLevel: 'critical',
        categoryIdentifier: 'CALL_CATEGORY',
      };
    }

    await Notifications.scheduleNotificationAsync(notificationConfig);
  }

  /**
   * Manipula notificação de chamada recebida
   */
  private handleCallNotificationReceived(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    
    if (data?.type === 'intercom_call') {
      console.log('📞 Notificação de chamada recebida:', data);
      
      // Aqui você pode adicionar lógica adicional, como:
      // - Mostrar interface de chamada em tela cheia
      // - Reproduzir som personalizado
      // - Vibrar continuamente
    }
  }

  /**
   * Manipula resposta à notificação de chamada
   */
  private async handleCallNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    const data = response.notification.request.content.data;
    
    if (data?.type === 'intercom_call') {
      const callId = data.callId;
      const actionIdentifier = response.actionIdentifier;

      console.log('📞 Resposta à chamada:', { callId, actionIdentifier });

      if (actionIdentifier === 'ANSWER_CALL' || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        await this.answerCall(callId);
      } else if (actionIdentifier === 'DECLINE_CALL') {
        await this.declineCall(callId);
      }
    }
  }

  /**
   * Atende uma chamada
   */
  private async answerCall(callId: string): Promise<void> {
    console.log('✅ Chamada atendida:', callId);
    
    // Parar chamada contínua
    this.stopCall(callId);

    // Notificar backend que chamada foi atendida
    try {
      const currentUser = getCurrentUser();
      if (!currentUser?.id) {
        console.error('[IntercomCall] Unable to answer call without authenticated user');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/intercom/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call_id: callId,
          resident_id: currentUser.id
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao notificar backend sobre chamada atendida');
      }

    } catch (error) {
      console.error('❌ Erro ao atender chamada:', error);
    }
  }

  /**
   * Recusa uma chamada
   */
  private async declineCall(callId: string): Promise<void> {
    console.log('❌ Chamada recusada:', callId);
    
    // Parar chamada contínua
    this.stopCall(callId);

    // Notificar backend que chamada foi recusada
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/intercom/hangup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call_id: callId
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao notificar backend sobre chamada recusada');
      }

    } catch (error) {
      console.error('❌ Erro ao recusar chamada:', error);
    }
  }

  /**
   * Manipula timeout de chamada
   */
  private async handleCallTimeout(callData: IntercomCallData): Promise<void> {
    console.log('⏰ Chamada expirou por timeout:', callData.callId);

    // Notificar backend sobre timeout
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/intercom/hangup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call_id: callData.callId
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao notificar backend sobre timeout');
      }

    } catch (error) {
      console.error('❌ Erro ao processar timeout:', error);
    }
  }

  /**
   * Cancela notificações pendentes de uma chamada
   */
  private async cancelCallNotifications(callId: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        const data = notification.content.data;
        if (data?.type === 'intercom_call' && data?.callId === callId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao cancelar notificações:', error);
    }
  }

  /**
   * Limpa todos os recursos
   */
  async cleanup(): Promise<void> {
    // Parar todas as chamadas ativas
    for (const callId of this.activeCalls.keys()) {
      this.stopCall(callId);
    }

    // Remover listeners
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }

    this.isInitialized = false;
  }

  /**
   * Obtém chamadas ativas
   */
  getActiveCalls(): string[] {
    return Array.from(this.activeCalls.keys());
  }

  /**
   * Verifica se há chamada ativa
   */
  hasActiveCall(callId?: string): boolean {
    if (callId) {
      return this.activeCalls.has(callId);
    }
    return this.activeCalls.size > 0;
  }
}

export default new IntercomCallService();
