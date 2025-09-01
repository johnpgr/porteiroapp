import { supabase } from '../utils/supabase';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { RealtimeChannel } from '@supabase/supabase-js';
import { avisosNotificationService, AvisoNotificationData } from './avisosNotificationService';

/**
 * Serviço integrado de notificações que combina o sistema existente
 * com as melhorias implementadas seguindo as recomendações do documento técnico
 */
class IntegratedNotificationService {
  private isInitialized = false;
  private userBuildingId: string | null = null;
  private communicationsChannel: RealtimeChannel | null = null;
  private pollsChannel: RealtimeChannel | null = null;
  private isListening = false;
  private callbacks: {
    onNewNotification?: (notification: AvisoNotificationData) => void;
    onNotificationStatusUpdate?: (id: string, type: string, status: string) => void;
    onError?: (error: string) => void;
  } = {};

  /**
   * Inicializa o serviço integrado
   */
  async initialize(userId: string, buildingId?: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Inicializar o serviço base de notificações
      await avisosNotificationService.initialize();

      // Determinar building_id do usuário
      this.userBuildingId = await this.getUserBuildingId(userId, buildingId);
      
      if (!this.userBuildingId) {
        console.warn('⚠️ Usuário sem prédio vinculado - notificações desabilitadas');
        return;
      }

      // Configurar canais de notificação aprimorados
      await this.setupNotificationChannels();

      // Configurar listeners de notificação
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log('✅ Serviço integrado de notificações inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço integrado:', error);
      this.callbacks.onError?.('Erro ao inicializar notificações');
      throw error;
    }
  }

  /**
   * Obtém o building_id do usuário
   */
  private async getUserBuildingId(userId: string, providedBuildingId?: string): Promise<string | null> {
    if (providedBuildingId) {
      return providedBuildingId;
    }

    try {
      // Buscar através do apartment_residents
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return (data as any)?.apartments?.building_id || null;
    } catch (error) {
      console.error('Erro ao buscar building_id:', error);
      return null;
    }
  }

  /**
   * Configura canais de notificação aprimorados
   */
  private async setupNotificationChannels(): Promise<void> {
    if (!Device.isDevice || !Constants.platform?.android) return;

    // Canal para comunicados normais
    await Notifications.setNotificationChannelAsync('avisos-normal', {
      name: 'Comunicados',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#388E3C',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      description: 'Notificações de comunicados do condomínio'
    });

    // Canal para comunicados urgentes
    await Notifications.setNotificationChannelAsync('avisos-urgente', {
      name: 'Comunicados Urgentes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#F44336',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      description: 'Notificações urgentes que requerem confirmação'
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
      description: 'Notificações de novas enquetes'
    });
  }

  /**
   * Configura listeners de notificação
   */
  private setupNotificationListeners(): void {
    // Listener para notificações recebidas
    Notifications.addNotificationReceivedListener((notification) => {
      this.handleNotificationReceived(notification);
    });

    // Listener para respostas a notificações
    Notifications.addNotificationResponseReceivedListener((response) => {
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Processa notificação recebida
   */
  private async handleNotificationReceived(notification: Notifications.Notification): Promise<void> {
    const data = notification.request.content.data;
    
    if (data?.type === 'new_communication' || data?.type === 'new_poll') {
      // Atualizar status para 'delivered'
      await this.updateNotificationStatus(
        data.communication_id || data.poll_id,
        data.type === 'new_communication' ? 'communication' : 'poll',
        'delivered'
      );

      // Registrar entrega no sistema aprimorado
      await avisosNotificationService.updateDeliveryStatus(
        data.communication_id || data.poll_id,
        data.type === 'new_communication' ? 'communication' : 'poll',
        { push_status: 'delivered' }
      );
    }
  }

  /**
   * Processa resposta a notificação
   */
  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    const data = response.notification.request.content.data;
    
    if (data?.type === 'new_communication' || data?.type === 'new_poll') {
      const recordId = data.communication_id || data.poll_id;
      const recordType = data.type === 'new_communication' ? 'communication' : 'poll';
      
      // Atualizar status para 'read'
      await this.updateNotificationStatus(recordId, recordType, 'read');
      
      // Registrar leitura no sistema aprimorado
      await avisosNotificationService.updateDeliveryStatus(recordId, recordType, {
        read_status: 'read',
        read_at: new Date().toISOString()
      });

      // Callback para a aplicação
      this.callbacks.onNotificationStatusUpdate?.(recordId, recordType, 'read');
    }
  }

  /**
   * Inicia o monitoramento em tempo real
   */
  async startListening(): Promise<void> {
    if (!this.userBuildingId || this.isListening) return;
    
    console.log('🔄 Iniciando monitoramento integrado para building_id:', this.userBuildingId);
    this.isListening = true;

    // Subscription para comunicados
    this.communicationsChannel = supabase
      .channel('integrated_communications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communications'
        },
        (payload) => {
          this.handleNewCommunication(payload.new as any);
        }
      )
      .subscribe();

    // Subscription para enquetes
    this.pollsChannel = supabase
      .channel('integrated_polls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'polls'
        },
        (payload) => {
          this.handleNewPoll(payload.new as any);
        }
      )
      .subscribe();
  }

  /**
   * Para o monitoramento em tempo real
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) return;
    
    console.log('🔄 Parando monitoramento integrado');
    this.isListening = false;
    
    if (this.communicationsChannel) {
      supabase.removeChannel(this.communicationsChannel);
      this.communicationsChannel = null;
    }
    
    if (this.pollsChannel) {
      supabase.removeChannel(this.pollsChannel);
      this.pollsChannel = null;
    }
  }

  /**
   * Processa novo comunicado
   */
  private async handleNewCommunication(communication: any): Promise<void> {
    try {
      console.log('📢 Novo comunicado detectado:', communication);

      // Buscar dados completos
      const { data: commData, error } = await supabase
        .from('communications')
        .select(`
          id, title, content, type, priority, created_at
        `)
        .eq('id', communication.id)
        .single();

      if (error || !commData) {
        console.error('Erro ao buscar dados do comunicado:', error);
        return;
      }

      const buildingName = 'Condomínio';
      
      // Criar dados de notificação
      const notificationData: AvisoNotificationData = {
        id: (commData as any).id,
        type: 'communication',
        title: (commData as any).title,
        content: (commData as any).content,
        building_id: this.userBuildingId!,
        building_name: buildingName,
        priority: (commData as any).priority || 'normal',
        created_at: (commData as any).created_at,
        expires_at: null,
        notification_status: 'pending'
      };

      // Registrar no sistema aprimorado
      await avisosNotificationService.createDeliveryRecord(
        (commData as any).id,
        'communication',
        this.userBuildingId!,
        { push_status: 'pending' }
      );

      // Enviar notificação push
      await this.sendPushNotification(notificationData);

      // Atualizar status no banco
      await this.updateNotificationStatus((commData as any).id, 'communication', 'sent');

      // Callback para a aplicação
      this.callbacks.onNewNotification?.(notificationData);

    } catch (error) {
      console.error('❌ Erro ao processar novo comunicado:', error);
      this.callbacks.onError?.('Erro ao processar comunicado');
    }
  }

  /**
   * Processa nova enquete
   */
  private async handleNewPoll(poll: any): Promise<void> {
    try {
      console.log('🗳️ Nova enquete detectada:', poll);

      // Processar enquete

      // Buscar dados completos
      const { data: pollData, error } = await supabase
        .from('polls')
        .select(`
          id, title, description, created_at
        `)
        .eq('id', poll.id)
        .single();

      if (error || !pollData) {
        console.error('Erro ao buscar dados da enquete:', error);
        return;
      }

      const buildingName = 'Condomínio';
      
      // Criar dados de notificação
      const notificationData: AvisoNotificationData = {
        id: (pollData as any).id,
        type: 'poll',
        title: (pollData as any).title,
        content: (pollData as any).description,
        building_id: this.userBuildingId!,
        building_name: buildingName,
        priority: 'normal',
        created_at: (pollData as any).created_at,
        expires_at: undefined,
        notification_status: 'pending'
      };

      // Registrar no sistema aprimorado
      await avisosNotificationService.createDeliveryRecord(
        (pollData as any).id,
        'poll',
        this.userBuildingId!,
        { push_status: 'pending' }
      );

      // Enviar notificação push
      await this.sendPushNotification(notificationData);

      // Atualizar status no banco
      await this.updateNotificationStatus((pollData as any).id, 'poll', 'sent');

      // Callback para a aplicação
      this.callbacks.onNewNotification?.(notificationData);

    } catch (error) {
      console.error('❌ Erro ao processar nova enquete:', error);
      this.callbacks.onError?.('Erro ao processar enquete');
    }
  }

  /**
   * Envia notificação push
   */
  private async sendPushNotification(data: AvisoNotificationData): Promise<void> {
    try {
      const isUrgent = data.priority === 'high' || data.priority === 'urgent';
      const isPoll = data.type === 'poll';
      
      // Determinar canal e configurações
      let channelId = 'avisos-normal';
      if (isPoll) {
        channelId = 'enquetes';
      } else if (isUrgent) {
        channelId = 'avisos-urgente';
      }

      // Configurar notificação
      const notificationConfig: any = {
        content: {
          title: isPoll ? '🗳️ Nova Enquete' : (isUrgent ? '📢 Comunicado Urgente' : '📢 Novo Comunicado'),
          body: `${data.building_name}: ${data.title}`,
          data: {
            type: isPoll ? 'new_poll' : 'new_communication',
            [isPoll ? 'poll_id' : 'communication_id']: data.id,
            building_id: data.building_id,
            building_name: data.building_name,
            priority: data.priority
          },
          sound: 'default',
          priority: isUrgent ? 'high' : 'normal',
        },
        trigger: null,
      };

      // Configurações Android
      if (Device.isDevice && Constants.platform?.android) {
        notificationConfig.content.android = {
          channelId,
          priority: isUrgent ? 'high' : 'normal',
          vibrate: isUrgent ? [0, 500, 250, 500] : [0, 250, 250, 250],
          color: isPoll ? '#2196F3' : (isUrgent ? '#F44336' : '#388E3C'),
          sticky: isUrgent,
        };
      }

      // Configurações iOS
      if (Device.isDevice && Constants.platform?.ios) {
        notificationConfig.content.ios = {
          sound: 'default',
          badge: 1,
          critical: isUrgent,
          interruptionLevel: isUrgent ? 'critical' : 'active',
        };
      }

      await Notifications.scheduleNotificationAsync(notificationConfig);
      
      // Atualizar status de entrega
      await avisosNotificationService.updateDeliveryStatus(data.id, data.type, {
        push_status: 'sent',
        sent_at: new Date().toISOString()
      });

      console.log('✅ Notificação enviada com sucesso:', data.type, data.id);
    } catch (error) {
      console.error('❌ Erro ao enviar notificação push:', error);
      
      // Marcar como falha
      await this.updateNotificationStatus(data.id, data.type, 'failed');
      await avisosNotificationService.updateDeliveryStatus(data.id, data.type, {
        push_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Atualiza status de notificação no banco
   */
  private async updateNotificationStatus(
    recordId: string, 
    recordType: 'communication' | 'poll', 
    status: string,
    userId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_notification_status', {
        p_table_name: recordType === 'communication' ? 'communications' : 'polls',
        p_record_id: recordId,
        p_status: status,
        p_user_id: userId || null
      });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar status de notificação:', error);
    }
  }

  /**
   * Confirma notificação urgente
   */
  async confirmUrgentNotification(recordId: string, recordType: 'communication' | 'poll', userId: string): Promise<void> {
    try {
      // Atualizar no banco principal
      await this.updateNotificationStatus(recordId, recordType, 'confirmed', userId);
      
      // Atualizar no sistema aprimorado
      await avisosNotificationService.updateDeliveryStatus(recordId, recordType, {
        confirmation_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId
      });

      console.log('✅ Notificação confirmada:', recordType, recordId);
    } catch (error) {
      console.error('❌ Erro ao confirmar notificação:', error);
      throw error;
    }
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(recordId: string, recordType: 'communication' | 'poll', userId: string): Promise<void> {
    try {
      // Atualizar no banco principal
      await this.updateNotificationStatus(recordId, recordType, 'read', userId);
      
      // Atualizar no sistema aprimorado
      await avisosNotificationService.updateDeliveryStatus(recordId, recordType, {
        read_status: 'read',
        read_at: new Date().toISOString()
      });

      console.log('✅ Notificação marcada como lida:', recordType, recordId);
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de notificação
   */
  async getNotificationStats(buildingId?: string, daysBack: number = 30): Promise<any> {
    try {
      const targetBuildingId = buildingId || this.userBuildingId;
      if (!targetBuildingId) return null;

      const { data, error } = await supabase.rpc('get_notification_stats', {
        p_building_id: targetBuildingId,
        p_days_back: daysBack
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Define callbacks
   */
  setCallbacks(callbacks: {
    onNewNotification?: (notification: AvisoNotificationData) => void;
    onNotificationStatusUpdate?: (id: string, type: string, status: string) => void;
    onError?: (error: string) => void;
  }): void {
    this.callbacks = callbacks;
  }

  /**
   * Obtém status do serviço
   */
  getStatus(): {
    isInitialized: boolean;
    isListening: boolean;
    userBuildingId: string | null;
  } {
    return {
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      userBuildingId: this.userBuildingId
    };
  }

  /**
   * Limpa recursos
   */
  async cleanup(): Promise<void> {
    await this.stopListening();
    this.isInitialized = false;
    this.userBuildingId = null;
    this.callbacks = {};
  }
}

// Instância singleton
export const integratedNotificationService = new IntegratedNotificationService();
export default integratedNotificationService;