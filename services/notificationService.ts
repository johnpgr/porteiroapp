import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { sendWhatsAppMessage, ResidentData } from '../utils/whatsapp';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface NotificationData {
  visitor_log_id: string;
  visitor_id: string;
  apartment_id: string;
  building_id: string;
  old_status: string | null;
  new_status: string;
  log_time: string;
  tipo_log: string;
  purpose: string | null;
  changed_at: string;
  visitor_name?: string;
  apartment_number?: string;
}

export interface NotificationCallback {
  (notification: NotificationData): void;
}

class NotificationService {
  private channel: RealtimeChannel | null = null;
  private callbacks: NotificationCallback[] = [];
  private isConnected = false;
  private notificationListener: any = null;
  private responseListener: any = null;

  /**
   * Inicia o serviço de notificações em tempo real
   * Escuta mudanças na tabela visitor_logs especificamente no campo notification_status
   */
  async startListening(): Promise<void> {
    if (this.isConnected) {

      return;
    }

    try {
      // Criar canal para escutar mudanças na tabela visitor_logs
      this.channel = supabase
        .channel('visitor-notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'visitor_logs',
            filter: 'notification_status=neq.null'
          },
          async (payload) => {

            await this.handleNotificationChange(payload);
          }
        )
        .subscribe((status) => {

          this.isConnected = status === 'SUBSCRIBED';
        });


    } catch (error) {
      console.error('❌ Erro ao iniciar serviço de notificações:', error);
      throw error;
    }
  }

  /**
   * Para o serviço de notificações
   */
  async stopListening(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
      this.isConnected = false;

    }

    // Remover listeners de notificações push se existirem
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Adiciona um callback para ser executado quando uma notificação for recebida
   */
  addCallback(callback: NotificationCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove um callback específico
   */
  removeCallback(callback: NotificationCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Remove todos os callbacks
   */
  clearCallbacks(): void {
    this.callbacks = [];
  }

  /**
   * Verifica se o serviço está conectado
   */
  isServiceConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Configura os listeners de notificações push usando expo-notifications
   * Este método é chamado pelo _layout.tsx para inicializar o sistema de notificações
   */
  async setupNotificationListeners(): Promise<void> {
    try {


      // Configurar como as notificações devem ser tratadas quando recebidas
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldSetBadge: true,
        }),
      });

      // Solicitar permissões de notificação
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('⚠️ Permissão de notificação não concedida');
        return;
      }

      // Configurar canal de notificação para Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('porteiro-notifications', {
          name: 'Notificações do Porteiro',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      // Listener para notificações recebidas enquanto o app está em primeiro plano
      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        // Aqui você pode processar a notificação recebida
        this.handlePushNotification(notification);
      });

      // Listener para quando o usuário toca na notificação
      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        // Aqui você pode navegar para uma tela específica ou executar uma ação
        this.handleNotificationResponse(response);
      });

      // Iniciar o serviço de escuta em tempo real do Supabase
      await this.startListening();



      // Armazenar referências dos listeners para cleanup posterior se necessário
      this.notificationListener = notificationListener;
      this.responseListener = responseListener;

    } catch (error) {
      console.error('❌ Erro ao configurar listeners de notificações:', error);
      throw error;
    }
  }

  /**
   * Processa notificações push recebidas
   */
  private handlePushNotification(notification: any): void {
    try {

      
      // Extrair dados da notificação
      const { title, body, data } = notification.request.content;
      
      // Se houver dados específicos na notificação, processar
      if (data && data.visitor_log_id) {
        const notificationData: Partial<NotificationData> = {
          visitor_log_id: data.visitor_log_id,
          visitor_id: data.visitor_id,
          apartment_id: data.apartment_id,
          building_id: data.building_id,
          new_status: data.status,
          tipo_log: data.tipo_log,
          purpose: data.purpose,
          changed_at: new Date().toISOString(),
          visitor_name: data.visitor_name,
          apartment_number: data.apartment_number
        };
        
        // Executar callbacks com os dados da notificação
        this.callbacks.forEach(callback => {
          try {
            callback(notificationData as NotificationData);
          } catch (error) {
            console.error('❌ Erro ao executar callback de notificação push:', error);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar notificação push:', error);
    }
  }

  /**
   * Processa resposta do usuário à notificação (quando toca na notificação)
   */
  private handleNotificationResponse(response: any): void {
    try {

      
      const { notification } = response;
      const { data } = notification.request.content;
      
      // Aqui você pode implementar navegação específica baseada no tipo de notificação
      if (data && data.action) {
        switch (data.action) {
          case 'view_visitor':

            // Implementar navegação para tela de detalhes do visitante
            break;
          case 'approve_visit':

            // Implementar aprovação rápida
            break;
          case 'view_notifications':

            // Implementar navegação para tela de notificações
            break;
          default:

            break;
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar resposta à notificação:', error);
    }
  }

   /**
    * Processa mudanças no notification_status e enriquece os dados
    */
  private async handleNotificationChange(payload: any): Promise<void> {
    try {
      const { new: newRecord, old: oldRecord } = payload;
      
      // Verificar se realmente houve mudança no notification_status
      if (oldRecord?.notification_status === newRecord?.notification_status) {
        return;
      }

      // Buscar dados adicionais do visitante e apartamento
      const { data: enrichedData, error } = await supabase
        .from('visitor_logs')
        .select(`
          *,
          visitors(name),
          apartments!inner(number)
        `)
        .eq('id', newRecord.id)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar dados enriquecidos:', error);
        return;
      }

      const notificationData: NotificationData = {
        visitor_log_id: newRecord.id,
        visitor_id: newRecord.visitor_id,
        apartment_id: newRecord.apartment_id,
        building_id: newRecord.building_id,
        old_status: oldRecord?.notification_status || null,
        new_status: newRecord.notification_status,
        log_time: newRecord.log_time,
        tipo_log: newRecord.tipo_log,
        purpose: newRecord.purpose,
        changed_at: new Date().toISOString(),
        visitor_name: enrichedData.visitors?.name,
        apartment_number: enrichedData.apartments?.number
      };

      // Executar todos os callbacks registrados
      this.callbacks.forEach(callback => {
        try {
          callback(notificationData);
        } catch (error) {
          console.error('❌ Erro ao executar callback de notificação:', error);
        }
      });

    } catch (error) {
      console.error('❌ Erro ao processar mudança de notificação:', error);
    }
  }

  /**
   * Busca notificações recentes (últimas 50)
   */
  async getRecentNotifications(limit: number = 50): Promise<NotificationData[]> {
    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select(`
          *,
          visitors(name),
          apartments!inner(number)
        `)
        .not('notification_status', 'is', null)
        .order('log_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Erro ao buscar notificações recentes:', error);
        return [];
      }

      return data.map(record => ({
        visitor_log_id: record.id,
        visitor_id: record.visitor_id,
        apartment_id: record.apartment_id,
        building_id: record.building_id,
        old_status: null,
        new_status: record.notification_status,
        log_time: record.log_time,
        tipo_log: record.tipo_log,
        purpose: record.purpose,
        changed_at: record.updated_at || record.log_time,
        visitor_name: record.visitors?.name,
        apartment_number: record.apartments?.number
      }));

    } catch (error) {
      console.error('❌ Erro ao buscar notificações recentes:', error);
      return [];
    }
  }

  /**
   * Marca uma notificação como confirmada pelo porteiro
   */
  async confirmNotification(visitorLogId: string, porteirId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('visitor_logs')
        .update({
          confirmed_by: porteirId,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', visitorLogId);

      if (error) {
        console.error('❌ Erro ao confirmar notificação:', error);
        return false;
      }


      return true;

    } catch (error) {
      console.error('❌ Erro ao confirmar notificação:', error);
      return false;
    }
  }

  /**
   * Envia mensagem WhatsApp para morador usando a API local configurada dinamicamente
   */
  async sendResidentWhatsApp(
    residentData: ResidentData,
    baseUrl?: string
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      return await sendWhatsAppMessage(residentData, baseUrl);
    } catch (error) {
      console.error('❌ Erro ao enviar WhatsApp via notificationService:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Envia mensagem WhatsApp para visitante usando a API de residentes (temporário)
   */
  async sendVisitorWhatsApp(
    visitorData: {
      name: string;
      phone: string;
      building: string;
      apartment: string;
      url?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {


    try {
      // Configuração da API - usando endpoint de visitantes
      const apiUrl = `${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://notification-api-james-1.onrender.com'}/api/send-visitor-whatsapp`;
      
      // Preparar dados para a API - usando endpoint de visitantes
      const apiData = {
        name: visitorData.name,
        phone: visitorData.phone.replace(/\D/g, ''), // Remove caracteres não numéricos
        building: visitorData.building,
        apartment: visitorData.apartment,
        profile_id: 'visitor-temp-' + Date.now() // ID temporário para visitantes
      };



      // Fazer chamada para a API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });



      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
          console.error('❌ Detalhes do erro na API de visitante:', errorData);
        } catch (parseError) {
          console.error('❌ Erro ao parsear resposta de erro:', parseError);
        }
        
        const errorMessage = errorData.message || errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          error: errorMessage,
        };
      }

      let responseData: any = {};
      try {
        responseData = await response.json();

      } catch (parseError) {
        console.warn('⚠️ Não foi possível parsear resposta de sucesso:', parseError);
      }


      return {
        success: true,
        message: 'Mensagem para visitante enviada com sucesso!',
      };

    } catch (error) {
      console.error('💥 Erro inesperado ao enviar mensagem para visitante:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        success: false,
        error: `Erro de conexão: ${errorMessage}`,
      };
    }
  }

  /**
   * Envia mensagem WhatsApp de regularização para morador
   */
  async sendRegularizationWhatsApp(
    residentData: ResidentData,
    situationType: string,
    description: string,
    regularizationUrl?: string
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {


    try {
      // Configuração da API
      const apiUrl = `${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://notification-api-james-1.onrender.com'}/api/send-regularization-whatsapp`;
      
      // Preparar dados para a API
      const apiData = {
        name: residentData.name,
        phone: residentData.phone.replace(/\D/g, ''), // Remove caracteres não numéricos
        building: residentData.building,
        apartment: residentData.apartment,
        situationType,
        description,
        regularizationUrl: regularizationUrl || 'https://regularizacao.JamesAvisa.com'
      };



      // Fazer chamada para a API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });



      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
          console.error('❌ Erro detalhado da API de regularização:', errorData);
        } catch (parseError) {
          console.error('❌ Erro ao parsear resposta de erro:', parseError);
        }
        
        const errorMessage = errorData.message || errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          error: errorMessage,
        };
      }

      let responseData: any = {};
      try {
        responseData = await response.json();

      } catch (parseError) {
        console.warn('⚠️ Não foi possível parsear resposta de sucesso:', parseError);
      }


      return {
        success: true,
        message: 'Mensagem de regularização enviada com sucesso!',
      };

    } catch (error) {
      console.error('💥 Erro inesperado ao enviar mensagem de regularização:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        success: false,
        error: `Erro de conexão: ${errorMessage}`,
      };
    }
  }
}

// Instância singleton do serviço
export const notificationService = new NotificationService();

// Tipos de status para facilitar o uso
export const NotificationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
} as const;

export type NotificationStatusType = typeof NotificationStatus[keyof typeof NotificationStatus];