import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Interfaces para tipagem
export interface AvisoNotificationData {
  id: string;
  type: 'communication' | 'poll';
  title: string;
  content?: string;
  description?: string;
  building_id: string;
  building_name?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  expires_at?: string;
  notification_status?: 'sent' | 'delivered' | 'read' | 'failed';
  delivery_attempts?: number;
  last_attempt_at?: string;
}

export interface NotificationDeliveryStatus {
  notification_id: string;
  user_id: string;
  building_id: string;
  notification_type: 'communication' | 'poll';
  content_id: string;
  push_status: 'pending' | 'sent' | 'delivered' | 'failed';
  whatsapp_status?: 'pending' | 'sent' | 'delivered' | 'failed';
  read_status: 'unread' | 'read';
  confirmation_status?: 'pending' | 'confirmed' | 'ignored';
  created_at: string;
  delivered_at?: string;
  read_at?: string;
  confirmed_at?: string;
  delivery_attempts: number;
  last_attempt_at?: string;
  error_message?: string;
}

export interface AvisoNotificationCallback {
  (notification: AvisoNotificationData): void;
}

class AvisosNotificationService {
  private communicationsChannel: RealtimeChannel | null = null;
  private pollsChannel: RealtimeChannel | null = null;
  private callbacks: AvisoNotificationCallback[] = [];
  private isListening = false;
  private userBuildingId: string | null = null;
  private userId: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  constructor() {
    this.setupNotificationHandler();
  }

  /**
   * Configura o handler de notificações
   */
  private setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
      }),
    });
  }

  /**
   * Inicializa o serviço com dados do usuário
   */
  async initialize(userId: string, buildingId: string): Promise<void> {
    this.userId = userId;
    this.userBuildingId = buildingId;
    
    await this.setupNotificationChannels();
    await this.setupPushNotificationListeners();
  }

  /**
   * Configura canais de notificação para Android
   */
  private async setupNotificationChannels(): Promise<void> {
    if (Device.isDevice && Platform.OS === 'android') {
      // Canal para avisos normais
      await Notifications.setNotificationChannelAsync('avisos-normal', {
        name: 'Avisos Normais',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#388E3C',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Canal para avisos urgentes
      await Notifications.setNotificationChannelAsync('avisos-urgent', {
        name: 'Avisos Urgentes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#F44336',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Canal para enquetes
      await Notifications.setNotificationChannelAsync('enquetes', {
        name: 'Enquetes',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2196F3',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
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
        console.warn('⚠️ Permissão de notificação não concedida para avisos');
        return;
      }

      // Listener para notificações recebidas
      this.notificationListener = Notifications.addNotificationReceivedListener(
        this.handlePushNotificationReceived.bind(this)
      );

      // Listener para respostas às notificações
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        this.handleNotificationResponse.bind(this)
      );

    } catch (error) {
      console.error('❌ Erro ao configurar listeners de push notifications:', error);
    }
  }

  /**
   * Inicia o monitoramento em tempo real
   */
  async startListening(): Promise<void> {
    if (!this.userBuildingId || this.isListening) {
      return;
    }

    console.log('🔄 Iniciando monitoramento de avisos para building_id:', this.userBuildingId);
    this.isListening = true;

    try {
      // Canal para comunicados
      this.communicationsChannel = supabase
        .channel('communications_enhanced')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'communications',
            filter: `building_id=eq.${this.userBuildingId}`
          },
          (payload) => this.handleNewCommunication(payload.new as any)
        )
        .subscribe();

      // Canal para enquetes
      this.pollsChannel = supabase
        .channel('polls_enhanced')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'polls',
            filter: `building_id=eq.${this.userBuildingId}`
          },
          (payload) => this.handleNewPoll(payload.new as any)
        )
        .subscribe();

    } catch (error) {
      console.error('❌ Erro ao iniciar monitoramento de avisos:', error);
      this.isListening = false;
    }
  }

  /**
   * Para o monitoramento
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    console.log('🔄 Parando monitoramento de avisos');
    this.isListening = false;

    if (this.communicationsChannel) {
      await supabase.removeChannel(this.communicationsChannel);
      this.communicationsChannel = null;
    }

    if (this.pollsChannel) {
      await supabase.removeChannel(this.pollsChannel);
      this.pollsChannel = null;
    }

    // Remover listeners de push notifications
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Processa novo comunicado
   */
  private async handleNewCommunication(communication: any): Promise<void> {
    try {
      console.log('📢 Novo comunicado detectado:', communication);

      // Buscar dados completos do comunicado
      const { data: commData, error } = await supabase
        .from('communications')
        .select(`
          id,
          title,
          content,
          type,
          priority,
          building_id,
          created_at,
          buildings (name)
        `)
        .eq('id', communication.id)
        .single();

      if (error || !commData) {
        console.error('❌ Erro ao buscar dados do comunicado:', error);
        return;
      }

      const notificationData: AvisoNotificationData = {
        id: commData.id,
        type: 'communication',
        title: commData.title,
        content: commData.content,
        building_id: commData.building_id,
        building_name: (commData as any).buildings?.name || 'Condomínio',
        priority: commData.priority || 'normal',
        created_at: commData.created_at,
        notification_status: 'sent'
      };

      // Registrar tentativa de entrega
      await this.createDeliveryRecord(notificationData, 'communication');

      // Enviar notificação push
      await this.sendPushNotification(notificationData);

      // Executar callbacks
      this.executeCallbacks(notificationData);

    } catch (error) {
      console.error('❌ Erro ao processar novo comunicado:', error);
    }
  }

  /**
   * Processa nova enquete
   */
  private async handleNewPoll(poll: any): Promise<void> {
    try {
      console.log('🗳️ Nova enquete detectada:', poll);

      // Verificar se a enquete não expirou
      const isExpired = poll.expires_at && new Date(poll.expires_at) < new Date();
      if (isExpired) {
        return;
      }

      // Buscar dados completos da enquete
      const { data: pollData, error } = await supabase
        .from('polls')
        .select(`
          id,
          title,
          description,
          created_at
        `)
        .eq('id', poll.id)
        .single();

      if (error || !pollData) {
        console.error('❌ Erro ao buscar dados da enquete:', error);
        return;
      }

      const notificationData: AvisoNotificationData = {
        id: pollData.id,
        type: 'poll',
        title: pollData.title,
        description: pollData.description,
        building_id: this.userBuildingId,
        building_name: 'Condomínio',
        priority: 'normal',
        created_at: pollData.created_at,
        expires_at: undefined,
        notification_status: 'sent'
      };

      // Registrar tentativa de entrega
      await this.createDeliveryRecord(notificationData, 'poll');

      // Enviar notificação push
      await this.sendPushNotification(notificationData);

      // Executar callbacks
      this.executeCallbacks(notificationData);

    } catch (error) {
      console.error('❌ Erro ao processar nova enquete:', error);
    }
  }

  /**
   * Envia notificação push com configurações aprimoradas
   */
  private async sendPushNotification(notification: AvisoNotificationData): Promise<boolean> {
    try {
      const isUrgent = notification.priority === 'high' || notification.priority === 'urgent';
      const channelId = notification.type === 'poll' ? 'enquetes' : 
                       isUrgent ? 'avisos-urgent' : 'avisos-normal';

      const notificationConfig: any = {
        content: {
          title: this.getNotificationTitle(notification),
          body: this.getNotificationBody(notification),
          data: {
            type: notification.type,
            content_id: notification.id,
            building_id: notification.building_id,
            building_name: notification.building_name,
            priority: notification.priority,
            action: notification.type === 'poll' ? 'view_poll' : 'view_communication'
          },
          sound: 'default',
          priority: isUrgent ? 'high' : 'normal',
        },
        trigger: null,
      };

      // Configurações específicas para Android
      if (Device.isDevice && Platform.OS === 'android') {
        notificationConfig.content.android = {
          channelId,
          priority: isUrgent ? 'max' : 'default',
          vibrate: isUrgent ? [0, 500, 250, 500] : [0, 250, 250, 250],
          color: notification.type === 'poll' ? '#2196F3' : 
                 isUrgent ? '#F44336' : '#388E3C',
          sticky: isUrgent,
          autoCancel: !isUrgent,
        };
      }

      // Configurações específicas para iOS
      if (Device.isDevice && Platform.OS === 'ios') {
        notificationConfig.content.ios = {
          sound: 'default',
          badge: 1,
          critical: isUrgent,
          interruptionLevel: isUrgent ? 'critical' : 'active',
        };
      }

      await Notifications.scheduleNotificationAsync(notificationConfig);
      
      // Atualizar status de entrega
      await this.updateDeliveryStatus(notification.id, notification.type, {
        push_status: 'sent',
        last_attempt_at: new Date().toISOString()
      });

      console.log(`✅ Notificação push enviada: ${notification.type} - ${notification.title}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao enviar notificação push:', error);
      
      // Registrar falha
      await this.updateDeliveryStatus(notification.id, notification.type, {
        push_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        last_attempt_at: new Date().toISOString()
      });
      
      return false;
    }
  }

  /**
   * Gera título da notificação
   */
  private getNotificationTitle(notification: AvisoNotificationData): string {
    const urgentPrefix = notification.priority === 'high' || notification.priority === 'urgent' ? '[URGENTE] ' : '';
    
    if (notification.type === 'poll') {
      return `${urgentPrefix}🗳️ Nova Enquete Disponível`;
    } else {
      return `${urgentPrefix}📢 Novo Comunicado`;
    }
  }

  /**
   * Gera corpo da notificação
   */
  private getNotificationBody(notification: AvisoNotificationData): string {
    const buildingName = notification.building_name || 'Condomínio';
    
    if (notification.type === 'poll') {
      const expiresText = notification.expires_at ? 
        ` (Expira em ${new Date(notification.expires_at).toLocaleDateString('pt-BR')})` : '';
      return `${buildingName}: ${notification.title}${expiresText}`;
    } else {
      return `${buildingName}: ${notification.title}`;
    }
  }

  /**
   * Cria registro de entrega
   */
  private async createDeliveryRecord(
    notification: AvisoNotificationData, 
    type: 'communication' | 'poll'
  ): Promise<void> {
    if (!this.userId) return;

    try {
      const deliveryRecord: Partial<NotificationDeliveryStatus> = {
        notification_id: `${type}_${notification.id}_${this.userId}`,
        user_id: this.userId,
        building_id: notification.building_id,
        notification_type: type,
        content_id: notification.id,
        push_status: 'pending',
        read_status: 'unread',
        confirmation_status: notification.priority === 'high' || notification.priority === 'urgent' ? 'pending' : undefined,
        created_at: new Date().toISOString(),
        delivery_attempts: 0
      };

      const { error } = await supabase
        .from('notification_delivery_status')
        .insert(deliveryRecord);

      if (error) {
        console.error('❌ Erro ao criar registro de entrega:', error);
      }
    } catch (error) {
      console.error('❌ Erro ao criar registro de entrega:', error);
    }
  }

  /**
   * Atualiza status de entrega
   */
  private async updateDeliveryStatus(
    contentId: string,
    type: 'communication' | 'poll',
    updates: Partial<NotificationDeliveryStatus>
  ): Promise<void> {
    if (!this.userId) return;

    try {
      const notificationId = `${type}_${contentId}_${this.userId}`;
      
      const { error } = await supabase
        .from('notification_delivery_status')
        .update({
          ...updates,
          delivery_attempts: supabase.rpc('increment_delivery_attempts', { notification_id: notificationId })
        })
        .eq('notification_id', notificationId);

      if (error) {
        console.error('❌ Erro ao atualizar status de entrega:', error);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar status de entrega:', error);
    }
  }

  /**
   * Processa notificação push recebida
   */
  private handlePushNotificationReceived(notification: any): void {
    try {
      console.log('📱 Notificação push recebida:', notification);
      
      const { data } = notification.request.content;
      
      if (data && data.content_id && data.type) {
        // Marcar como entregue
        this.updateDeliveryStatus(data.content_id, data.type, {
          push_status: 'delivered',
          delivered_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Erro ao processar notificação recebida:', error);
    }
  }

  /**
   * Processa resposta à notificação
   */
  private handleNotificationResponse(response: any): void {
    try {
      console.log('👆 Resposta à notificação:', response);
      
      const { data } = response.notification.request.content;
      
      if (data && data.content_id && data.type) {
        // Marcar como lida
        this.updateDeliveryStatus(data.content_id, data.type, {
          read_status: 'read',
          read_at: new Date().toISOString()
        });
        
        // Executar ação baseada no tipo
        this.handleNotificationAction(data);
      }
    } catch (error) {
      console.error('❌ Erro ao processar resposta à notificação:', error);
    }
  }

  /**
   * Executa ação baseada na notificação
   */
  private handleNotificationAction(data: any): void {
    // Implementar navegação ou ações específicas
    console.log('🎯 Executando ação:', data.action, 'para:', data.type);
    
    // Aqui você pode implementar navegação específica
    // Por exemplo, navegar para a tela de comunicados ou enquetes
  }

  /**
   * Executa callbacks registrados
   */
  private executeCallbacks(notification: AvisoNotificationData): void {
    this.callbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('❌ Erro ao executar callback:', error);
      }
    });
  }

  /**
   * Adiciona callback
   */
  addCallback(callback: AvisoNotificationCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback
   */
  removeCallback(callback: AvisoNotificationCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Limpa todos os callbacks
   */
  clearCallbacks(): void {
    this.callbacks = [];
  }

  /**
   * Verifica se está ouvindo
   */
  isServiceListening(): boolean {
    return this.isListening;
  }

  /**
   * Busca notificações recentes
   */
  async getRecentNotifications(limit: number = 20): Promise<AvisoNotificationData[]> {
    if (!this.userBuildingId) return [];

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Buscar comunicados
      const { data: communications } = await supabase
        .from('communications')
        .select(`
          id, title, content, type, priority, building_id, created_at,
          buildings (name)
        `)
        .eq('building_id', this.userBuildingId)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Buscar enquetes
      const { data: polls } = await supabase
        .from('polls')
        .select(`
          id, title, description, created_at
        `)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(limit);

      const notifications: AvisoNotificationData[] = [];

      // Processar comunicados
      if (communications) {
        communications.forEach(comm => {
          notifications.push({
            id: comm.id,
            type: 'communication',
            title: comm.title,
            content: comm.content,
            building_id: comm.building_id,
            building_name: (comm as any).buildings?.name,
            priority: comm.priority,
            created_at: comm.created_at
          });
        });
      }

      // Processar enquetes
      if (polls) {
        polls.forEach(poll => {
          notifications.push({
            id: poll.id,
            type: 'poll',
            title: poll.title,
            description: poll.description,
            building_id: this.userBuildingId,
            building_name: undefined,
            priority: 'normal',
            created_at: poll.created_at,
            expires_at: undefined
          });
        });
      }

      // Ordenar por data
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return notifications.slice(0, limit);

    } catch (error) {
      console.error('❌ Erro ao buscar notificações recentes:', error);
      return [];
    }
  }

  /**
   * Confirma recebimento de notificação urgente
   */
  async confirmUrgentNotification(
    contentId: string, 
    type: 'communication' | 'poll'
  ): Promise<boolean> {
    if (!this.userId) return false;

    try {
      const { error } = await this.updateDeliveryStatus(contentId, type, {
        confirmation_status: 'confirmed',
        confirmed_at: new Date().toISOString()
      });

      return !error;
    } catch (error) {
      console.error('❌ Erro ao confirmar notificação urgente:', error);
      return false;
    }
  }
}

// Instância singleton
export const avisosNotificationService = new AvisosNotificationService();
export default avisosNotificationService;