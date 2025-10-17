import { supabase } from '../utils/supabase';

interface VisitorArrivalData {
  visitorName: string;
  apartmentNumber: string;
  buildingId: string;
  visitorId?: string;
  purpose?: string;
  photo_url?: string;
  entry_type?: string;
}

interface NotificationResult {
  success: boolean;
  message: string;
  notificationId?: string;
  error?: string;
}

/**
 * Serviço para notificar moradores sobre chegada de visitantes
 */
export class NotifyResidentService {
  
  /**
   * Notifica moradores sobre a chegada de um visitante
   * @param visitorData - Dados do visitante que chegou
   * @returns Promise<NotificationResult>
   */
  static async notifyResidentOfVisitorArrival(visitorData: VisitorArrivalData): Promise<NotificationResult> {
    try {
      console.log('🔔 [NotifyResidentService] Iniciando notificação de chegada de visitante:', {
        visitorName: visitorData.visitorName,
        apartmentNumber: visitorData.apartmentNumber,
        buildingId: visitorData.buildingId,
        timestamp: new Date().toISOString()
      });

      // 1. Buscar moradores do apartamento
      const residents = await this.getApartmentResidents(visitorData.buildingId, visitorData.apartmentNumber);
      
      if (!residents || residents.length === 0) {
        console.warn('⚠️ [NotifyResidentService] Nenhum morador encontrado para o apartamento:', visitorData.apartmentNumber);
        return {
          success: false,
          message: 'Nenhum morador encontrado para notificar'
        };
      }

      console.log(`👥 [NotifyResidentService] Encontrados ${residents.length} moradores para notificar`);

      // 2. Preparar dados da notificação
      const notificationData = {
        title: 'Visitante Chegou',
        body: `${visitorData.visitorName} chegou ao seu apartamento (${visitorData.apartmentNumber})`,
        data: {
          type: 'visitor_arrival',
          visitor_name: visitorData.visitorName,
          apartment_number: visitorData.apartmentNumber,
          building_id: visitorData.buildingId,
          visitor_id: visitorData.visitorId,
          purpose: visitorData.purpose,
          photo_url: visitorData.photo_url,
          entry_type: visitorData.entry_type,
          timestamp: new Date().toISOString()
        }
      };

      // 3. Enviar notificações para todos os moradores do apartamento
      const notificationPromises = residents.map(resident => 
        this.sendNotificationToResident(resident.id, notificationData)
      );

      const results = await Promise.allSettled(notificationPromises);
      
      // 4. Processar resultados
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failureCount = results.filter(result => result.status === 'rejected').length;

      console.log(`📊 [NotifyResidentService] Resultados: ${successCount} sucessos, ${failureCount} falhas`);

      // 5. Registrar log da notificação
      await this.logNotificationAttempt(visitorData, residents, successCount, failureCount);

      return {
        success: successCount > 0,
        message: `Notificação enviada para ${successCount} de ${residents.length} moradores`,
        notificationId: `visitor_arrival_${Date.now()}`
      };

    } catch (error) {
      console.error('❌ [NotifyResidentService] Erro ao notificar moradores:', error);
      return {
        success: false,
        message: 'Erro interno ao enviar notificação',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Busca moradores de um apartamento específico
   */
  private static async getApartmentResidents(buildingId: string, apartmentNumber: string) {
    try {
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .select('id')
        .eq('building_id', buildingId)
        .eq('number', apartmentNumber)
        .single();

      if (apartmentError || !apartment) {
        console.error('❌ [NotifyResidentService] Erro ao buscar apartamento:', apartmentError);
        return [];
      }

      const { data: residents, error: residentsError } = await supabase
        .from('apartment_residents')
        .select(`
          user_id,
          profiles!inner(
            id,
            full_name,
            email
          )
        `)
        .eq('apartment_id', apartment.id)
        .eq('status', 'active');

      if (residentsError) {
        console.error('❌ [NotifyResidentService] Erro ao buscar moradores:', residentsError);
        return [];
      }

      return residents?.map(resident => ({
        id: resident.profiles.id,
        name: resident.profiles.full_name,
        email: resident.profiles.email
      })) || [];

    } catch (error) {
      console.error('❌ [NotifyResidentService] Erro ao buscar moradores do apartamento:', error);
      return [];
    }
  }

  /**
   * Envia notificação para um morador específico usando Edge Function
   */
  private static async sendNotificationToResident(residentId: string, notificationData: any) {
    try {
      console.log(`📤 [NotifyResidentService] Enviando notificação para morador: ${residentId}`);

      // Chamar Edge Function para enviar notificação
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          user_id: residentId,
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data,
          type: 'visitor_arrival'
        }
      });

      if (error) {
        console.error(`❌ [NotifyResidentService] Erro ao enviar notificação via Edge Function:`, error);
        throw error;
      }

      console.log(`✅ [NotifyResidentService] Notificação enviada com sucesso para: ${residentId}`);
      return data;

    } catch (error) {
      console.error(`❌ [NotifyResidentService] Falha ao enviar notificação para ${residentId}:`, error);
      throw error;
    }
  }

  /**
   * Registra tentativa de notificação no banco de dados
   */
  private static async logNotificationAttempt(
    visitorData: VisitorArrivalData, 
    residents: any[], 
    successCount: number, 
    failureCount: number
  ) {
    try {
      const logData = {
        notification_type: 'visitor_arrival',
        visitor_name: visitorData.visitorName,
        apartment_number: visitorData.apartmentNumber,
        building_id: visitorData.buildingId,
        residents_count: residents.length,
        success_count: successCount,
        failure_count: failureCount,
        timestamp: new Date().toISOString(),
        metadata: {
          visitor_id: visitorData.visitorId,
          purpose: visitorData.purpose,
          entry_type: visitorData.entry_type,
          residents_notified: residents.map(r => ({ id: r.id, name: r.name }))
        }
      };

      const { error } = await supabase
        .from('notification_logs')
        .insert(logData);

      if (error) {
        console.error('❌ [NotifyResidentService] Erro ao registrar log de notificação:', error);
      } else {
        console.log('📝 [NotifyResidentService] Log de notificação registrado com sucesso');
      }

    } catch (error) {
      console.error('❌ [NotifyResidentService] Erro ao registrar log:', error);
    }
  }

  /**
   * Método auxiliar para testar o serviço de notificação
   */
  static async testNotification(buildingId: string, apartmentNumber: string): Promise<NotificationResult> {
    const testData: VisitorArrivalData = {
      visitorName: 'Visitante Teste',
      apartmentNumber,
      buildingId,
      purpose: 'Teste do sistema de notificações',
      entry_type: 'test'
    };

    return await this.notifyResidentOfVisitorArrival(testData);
  }
}

// Função auxiliar para uso direto (compatibilidade)
export const notifyResidentOfVisitorArrival = (visitorData: VisitorArrivalData): Promise<NotificationResult> => {
  return NotifyResidentService.notifyResidentOfVisitorArrival(visitorData);
};

export default NotifyResidentService;