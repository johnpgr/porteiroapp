import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { NotificationService as NewNotificationService } from '../utils/notificationService';

// Interface para dados do morador para WhatsApp
interface ResidentData {
  name: string;
  phone: string;
  building: string;
  apartment: string;
}

// Interface para resposta da API de notificação
interface WhatsAppApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Configurar como as notificações devem ser tratadas quando recebidas
// Evitar registrar handler na Web para prevenir problemas de symbolication
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export interface PushNotificationData {
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  title: string;
  message: string;
  data?: any;
}

// Interfaces para notificações

// Tipo de visita para compatibilidade com RegistrarVisitante
export type TipoVisita = 'social' | 'prestador' | 'entrega';

class NotificationService {
  private expoPushToken: string | null = null;
  private newNotificationService: NewNotificationService;

  constructor() {
    this.newNotificationService = new NewNotificationService();
  }

  /**
   * Registra o dispositivo para receber notificações push
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async registerForPushNotifications(): Promise<string | null> {
    console.warn('Push notifications estão desabilitadas temporariamente');
    return null;
    /*
    // CÓDIGO ORIGINAL COMENTADO TEMPORARIAMENTE
    let token = null;

    // Evitar tentativa de registrar na Web, onde não é suportado via Expo Go
    if (Platform.OS === 'web') {
      console.warn(
        '[expo-notifications] Registro de push não é suportado no ambiente web (Expo Go).'
      );
      return null;
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Permissão para notificações negada');
        return null;
      }

      try {
        // Verificar se temos um projectId válido
        const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
        if (!projectId || projectId === 'your-project-id') {
          console.warn('EXPO_PUBLIC_PROJECT_ID não configurado. Push notifications não funcionarão.');
          return null;
        }

        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          })
        ).data;

        this.expoPushToken = token;
        console.log('Push token obtido:', token);
      } catch (error) {
        console.error('Erro ao obter push token:', error);
        // Em desenvolvimento, não é crítico falhar aqui
        if (__DEV__) {
          console.warn('Push notifications não funcionarão em desenvolvimento sem configuração adequada.');
        }
        return null;
      }
    } else {
      console.log('Deve usar um dispositivo físico para notificações push');
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      // Canal para visitantes
      await Notifications.setNotificationChannelAsync('visitor', {
        name: 'Visitantes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2196F3',
        sound: 'default',
      });

      // Canal para entregas
      await Notifications.setNotificationChannelAsync('delivery', {
        name: 'Encomendas',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#4CAF50',
      });

      // Canal para emergências
      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergências',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000],
        lightColor: '#F44336',
        sound: 'default',
      });
    }

    return token;
    */
  }

  /**
   * Salva o token push no banco de dados para o usuário atual
   * TEMPORARIAMENTE DESABILITADO
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    console.warn('savePushToken está desabilitado temporariamente');
    return;

    // CÓDIGO ORIGINAL COMENTADO
    // try {
    //   const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
    //
    //   if (error) {
    //     console.error('Erro ao salvar push token:', error);
    //   } else {
    //     console.log('Push token salvo com sucesso');
    //   }
    // } catch (error) {
    //   console.error('Erro ao salvar push token:', error);
    // }
  }

  /**
   * Envia uma notificação local
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async sendLocalNotification(data: PushNotificationData): Promise<void> {
    console.warn('Notificações locais estão desabilitadas temporariamente');
    return;
    /*
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: data.title,
          body: data.message,
          data: data.data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Enviar imediatamente
      });
    } catch (error) {
      console.error('Erro ao enviar notificação local:', error);
    }
    */
  }

  /**
   * Envia notificação push para um usuário específico
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async sendPushNotification(pushToken: string, data: PushNotificationData): Promise<boolean> {
    console.warn('Push notifications estão desabilitadas temporariamente');
    return false;
    /*
    try {
      if (Platform.OS === 'web') {
        console.warn('Envio de push via Expo não é suportado na Web.');
        return false;
      }

      const message = {
        to: pushToken,
        sound: 'default',
        title: data.title,
        body: data.message,
        data: data.data || {},
        channelId: data.type,
        priority: data.type === 'emergency' ? 'high' : 'default',
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();

      if (result.data && result.data[0] && result.data[0].status === 'ok') {
        console.log('Notificação push enviada com sucesso');
        return true;
      } else {
        console.error('Erro ao enviar notificação push:', result);
        return false;
      }
    } catch (error) {
      console.error('Erro ao enviar notificação push:', error);
      return false;
    }
    */
  }

  /**
   * Envia notificação para múltiplos usuários
   */
  async sendBulkNotifications(tokens: string[], data: PushNotificationData): Promise<void> {
    if (Platform.OS === 'web') {
      console.warn('Envio de push em lote não é suportado na Web.');
      return;
    }
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: data.title,
      body: data.message,
      data: data.data || {},
      channelId: data.type,
      priority: data.type === 'emergency' ? 'high' : 'default',
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log('Notificações em lote enviadas:', result);
    } catch (error) {
      console.error('Erro ao enviar notificações em lote:', error);
    }
  }

  /**
   * Busca tokens push dos usuários alvo
   */
  async getUserPushTokens(
    userType?: 'admin' | 'porteiro' | 'morador',
    apartmentNumber?: string
  ): Promise<string[]> {
    try {
      let query = supabase.from('users').select('push_token').not('push_token', 'is', null);

      if (userType) {
        query = query.eq('user_type', userType);
      }

      if (apartmentNumber && userType === 'morador') {
        query = query.eq('apartment_number', apartmentNumber);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar push tokens:', error);
        return [];
      }

      return data.filter((user) => user.push_token).map((user) => user.push_token);
    } catch (error) {
      console.error('Erro ao buscar push tokens:', error);
      return [];
    }
  }

  /**
   * Notifica sobre novo visitante
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async notifyNewVisitor(
    visitorName: string,
    apartmentNumber: string,
    document: string
  ): Promise<void> {
    console.warn('Notificações de visitantes estão desabilitadas temporariamente');
    return;
    /*
    // Notificar morador
    const moradorTokens = await this.getUserPushTokens('morador', apartmentNumber);
    if (moradorTokens.length > 0) {
      await this.sendBulkNotifications(moradorTokens, {
        type: 'visitor',
        title: '🚪 Novo Visitante',
        message: `${visitorName} deseja visitá-lo. Doc: ${document}`,
        data: { type: 'visitor', apartmentNumber, visitorName },
      });
    }

    // Notificar porteiro
    const porteiroTokens = await this.getUserPushTokens('porteiro');
    if (porteiroTokens.length > 0) {
      await this.sendBulkNotifications(porteiroTokens, {
        type: 'visitor',
        title: '👤 Visitante Aguardando',
        message: `${visitorName} para apt. ${apartmentNumber}`,
        data: { type: 'visitor', apartmentNumber, visitorName },
      });
    }
    */
  }

  /**
   * Notifica sobre nova encomenda
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async notifyNewDelivery(
    recipientName: string,
    apartmentNumber: string,
    sender: string
  ): Promise<void> {
    console.warn('Notificações de entregas estão desabilitadas temporariamente');
    return;
    /*
    const moradorTokens = await this.getUserPushTokens('morador', apartmentNumber);
    if (moradorTokens.length > 0) {
      await this.sendBulkNotifications(moradorTokens, {
        type: 'delivery',
        title: '📦 Nova Encomenda',
        message: `Encomenda de ${sender} para ${recipientName}`,
        data: { type: 'delivery', apartmentNumber, sender },
      });
    }
    */
  }

  /**
   * Notifica sobre emergência
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async notifyEmergency(message: string, apartmentNumber?: string): Promise<void> {
    console.warn('Notificações de emergência estão desabilitadas temporariamente');
    return;
    /*
    let tokens: string[] = [];

    if (apartmentNumber) {
      // Notificar morador específico
      tokens = await this.getUserPushTokens('morador', apartmentNumber);
    } else {
      // Notificar todos os usuários
      const adminTokens = await this.getUserPushTokens('admin');
      const porteiroTokens = await this.getUserPushTokens('porteiro');
      tokens = [...adminTokens, ...porteiroTokens];
    }

    if (tokens.length > 0) {
      await this.sendBulkNotifications(tokens, {
        type: 'emergency',
        title: '🚨 EMERGÊNCIA',
        message: message,
        data: { type: 'emergency', apartmentNumber },
      });
    }
    */
  }

  /**
   * Envia notificações push em lote
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async sendBulkPushNotifications(
    pushTokens: string[],
    data: PushNotificationData
  ): Promise<{ success: number; failed: number }> {
    console.warn('Notificações em lote estão desabilitadas temporariamente');
    return { success: 0, failed: 0 };
    /*
    const results = { success: 0, failed: 0 };

    for (const token of pushTokens) {
      const sent = await this.sendPushNotification(token, data);
      if (sent) {
        results.success++;
      } else {
        results.failed++;
      }
    }

    return results;
    */
  }

  /**
   * Obtém o push token de um usuário específico
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async getUserPushToken(userId: string): Promise<string | null> {
    console.warn('Busca de push tokens está desabilitada temporariamente');
    return null;
    /*
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar push token:', error);
        return null;
      }

      return data?.push_token || null;
    } catch (error) {
      console.error('Erro ao buscar push token:', error);
      return null;
    }
    */
  }

  /**
   * Limpa todas as notificações
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  async clearAllNotifications(): Promise<void> {
    console.warn('Limpeza de notificações está desabilitada temporariamente');
    return;
    /*
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
    }
    */
  }

  /**
   * Obtém o token push atual
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Configura listeners para notificações
   * FUNÇÃO DESABILITADA TEMPORARIAMENTE
   */
  setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    console.warn('Listeners de notificação estão desabilitados temporariamente');
    return;
    /*
    if (Platform.OS === 'web') {
      // Evitar registrar listeners na Web (não suportado)
      return;
    }

    Notifications.addNotificationReceivedListener((notification) => {
      onNotificationReceived?.(notification);
    });

    Notifications.addNotificationResponseReceivedListener((response) => {
      onNotificationResponse?.(response);
    });
    */
  }

  /**
   * Cria notificação para morador após registro de visitante
   */
  async createNotificationForResident(
    apartmentId: string,
    visitorLogId: string,
    visitorData: {
      name: string;
      type: TipoVisita;
      company?: string;
      purpose?: string;
    }
  ): Promise<boolean> {
    try {
      // Calcular tempo de expiração (24 horas)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Determinar entry_type baseado no tipo de visita
      let entryType = 'visitor';
      if (visitorData.type === 'entrega') entryType = 'delivery';
      if (visitorData.type === 'prestador') entryType = 'service';

      // Atualizar o visitor_log com dados de notificação
      const { error: updateError } = await supabase
        .from('visitor_logs')
        .update({
          notification_status: 'pending',
          notification_sent_at: new Date().toISOString(),
          requires_resident_approval: true,
          expires_at: expiresAt.toISOString(),
          entry_type: entryType,
          guest_name: visitorData.name,
          // Campos específicos por tipo
          ...(visitorData.company && { delivery_sender: visitorData.company }),
          ...(visitorData.purpose && { purpose: visitorData.purpose })
        })
        .eq('id', visitorLogId);

      if (updateError) {
        console.error('Erro ao atualizar visitor_log para notificação:', updateError);
        return false;
      }

      // Buscar moradores do apartamento para enviar push notifications
      const { data: residents, error: residentsError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('apartment_id', apartmentId)
        .eq('user_type', 'morador');

      if (residentsError) {
        console.error('Erro ao buscar moradores:', residentsError);
      } else if (residents && residents.length > 0) {
        // Enviar push notification via Edge Function
        for (const resident of residents) {
          try {
            const notificationTitle = this.formatNotificationTitle(visitorData.type);
            const notificationMessage = this.formatNotificationMessage(
              visitorData.name,
              visitorData.type,
              visitorData.company
            );

            await this.newNotificationService.sendNotification(
              resident.user_id,
              notificationTitle,
              notificationMessage,
              {
                type: 'visitor',
                visitorLogId,
                apartmentId,
                visitorName: visitorData.name,
                visitorType: visitorData.type,
                company: visitorData.company,
                purpose: visitorData.purpose
              }
            );
          } catch (pushError) {
            console.error('Erro ao enviar push notification:', pushError);
            // Não bloquear o fluxo se a push notification falhar
          }
        }
      }

      console.log('Notificação criada para morador do apartamento:', apartmentId);
      return true;
    } catch (error) {
      console.error('Erro ao criar notificação para morador:', error);
      return false;
    }
  }

  /**
   * Cria notificação com sistema de retry
   */
  async createNotificationWithRetry(
    apartmentId: string,
    visitorLogId: string,
    visitorData: {
      name: string;
      type: TipoVisita;
      company?: string;
      purpose?: string;
    },
    maxRetries: number = 3
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const success = await this.createNotificationForResident(apartmentId, visitorLogId, visitorData);
      
      if (success) {
        return true;
      }
      
      if (attempt < maxRetries) {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        console.log(`Tentativa ${attempt} falhou, tentando novamente...`);
      }
    }
    
    console.error(`Falha ao criar notificação após ${maxRetries} tentativas`);
    return false;
  }

  /**
   * Formata título da notificação baseado no tipo de visita
   */
  formatNotificationTitle(visitorType: string): string {
    switch (visitorType) {
      case 'entrega':
        return '📦 Nova Encomenda';
      case 'prestador':
        return '🔧 Prestador de Serviço';
      default:
        return '🚪 Novo Visitante';
    }
  }

  /**
   * Formata mensagem de notificação baseada no tipo de visita
   */
  formatNotificationMessage(
    visitorName: string,
    visitorType: string,
    company?: string
  ): string {
    switch (visitorType) {
      case 'entrega':
        return `📦 Encomenda de ${company || 'remetente desconhecido'} chegou`;
      case 'prestador':
        return `🔧 Prestador de serviço ${company ? `(${company})` : ''} - ${visitorName}`;
      default:
        return `👤 ${visitorName} quer subir`;
    }
  }

  /**
   * Log estruturado para eventos de notificação
   */
  logNotificationEvent(event: string, data: any): void {
    console.log(`[NOTIFICATION] ${event}:`, {
      timestamp: new Date().toISOString(),
      apartmentId: data.apartmentId,
      visitorName: data.visitorName,
      success: data.success,
      error: data.error
    });
  }

  /**
   * Envia mensagem WhatsApp para morador via API de notificação
   */
  async sendResidentWhatsApp(
    residentData: ResidentData,
    registrationUrl?: string
  ): Promise<WhatsAppApiResponse> {
    console.log('📱 [DEBUG] sendResidentWhatsApp iniciado');
    console.log('📱 [DEBUG] residentData:', residentData);
    console.log('📱 [DEBUG] registrationUrl:', registrationUrl);

    try {
      const payload = {
        name: residentData.name,
        phone: residentData.phone,
        building: residentData.building,
        apartment: residentData.apartment,
        registrationUrl: registrationUrl || undefined,
      };

      console.log('📱 [DEBUG] Payload para API:', payload);
      console.log('📱 [DEBUG] Chamando API: http://192.168.0.2:3001/api/send-resident-whatsapp');

      const response = await fetch('http://192.168.0.2:3001/api/send-resident-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📱 [DEBUG] Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('📱 [DEBUG] Erro da API:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result: WhatsAppApiResponse = await response.json();
      console.log('📱 [DEBUG] Resultado da API:', result);

      return result;
    } catch (error) {
      console.error('📱 [DEBUG] Erro ao chamar API de notificação:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar WhatsApp',
      };
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
