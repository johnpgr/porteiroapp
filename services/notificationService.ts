import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { sendWhatsAppMessage, ResidentData } from '../utils/whatsapp';

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

  /**
   * Inicia o serviço de notificações em tempo real
   * Escuta mudanças na tabela visitor_logs especificamente no campo notification_status
   */
  async startListening(): Promise<void> {
    if (this.isConnected) {
      console.log('🔔 Serviço de notificações já está ativo');
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
            console.log('🔔 Mudança detectada no notification_status:', payload);
            await this.handleNotificationChange(payload);
          }
        )
        .subscribe((status) => {
          console.log('🔔 Status da conexão:', status);
          this.isConnected = status === 'SUBSCRIBED';
        });

      console.log('🔔 Serviço de notificações iniciado com sucesso');
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
      console.log('🔔 Serviço de notificações parado');
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
          visitors!inner(name),
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
          visitors!inner(name),
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
        old_status: null, // Não temos histórico do status anterior
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

      console.log('✅ Notificação confirmada com sucesso:', visitorLogId);
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
    console.log('🚀 Iniciando envio de mensagem de regularização WhatsApp:', {
      name: residentData.name,
      phone: residentData.phone,
      apartment: residentData.apartment,
      building: residentData.building,
      situationType,
      description,
      regularizationUrl
    });

    try {
      // Configuração da API local
      const apiUrl = `${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'http://192.168.0.2:3001'}/api/send-regularization-whatsapp`;
      
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

      console.log('🌐 Fazendo chamada para API de regularização:', {
        url: apiUrl,
        phone: apiData.phone,
        name: apiData.name,
        situationType: apiData.situationType
      });

      // Fazer chamada para a API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      console.log('📡 Resposta da API de regularização:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
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
        console.log('✅ Resposta de sucesso da API de regularização:', responseData);
      } catch (parseError) {
        console.warn('⚠️ Não foi possível parsear resposta de sucesso:', parseError);
      }

      console.log('🎉 Mensagem de regularização enviada com sucesso!');
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