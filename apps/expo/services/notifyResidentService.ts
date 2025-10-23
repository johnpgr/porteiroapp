import { supabase } from '../utils/supabase';
import { notifyResidentsVisitorArrival } from './pushNotificationService';

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

      // 1. Buscar apartamento ID
      const apartmentId = await this.getApartmentId(visitorData.buildingId, visitorData.apartmentNumber);

      if (!apartmentId) {
        console.warn('⚠️ [NotifyResidentService] Apartamento não encontrado:', visitorData.apartmentNumber);
        return {
          success: false,
          message: 'Apartamento não encontrado'
        };
      }

      // 2. Enviar notificação push usando Edge Function
      const result = await notifyResidentsVisitorArrival({
        apartmentIds: [apartmentId],
        visitorName: visitorData.visitorName,
        apartmentNumber: visitorData.apartmentNumber,
        purpose: visitorData.purpose,
        photoUrl: visitorData.photo_url,
      });

      if (result.success && result.sent > 0) {
        console.log('✅ [NotifyResidentService] Push notification enviada:', `${result.sent} morador(es) notificado(s)`);
        // 3. Registrar log da notificação
        await this.logNotificationAttempt(visitorData, apartmentId, true);

        return {
          success: true,
          message: `Notificação enviada com sucesso para ${result.sent} morador(es)`,
          notificationId: `visitor_arrival_${Date.now()}`
        };
      } else {
        console.warn('⚠️ [NotifyResidentService] Falha ao enviar notificação:', result.message);
        await this.logNotificationAttempt(visitorData, apartmentId, false);

        return {
          success: false,
          message: result.message || 'Nenhum morador pôde ser notificado (sem tokens cadastrados)',
        };
      }

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
   * Busca o ID do apartamento
   */
  private static async getApartmentId(buildingId: string, apartmentNumber: string): Promise<string | null> {
    try {
      const { data: apartment, error } = await supabase
        .from('apartments')
        .select('id')
        .eq('building_id', buildingId)
        .eq('number', apartmentNumber)
        .single();

      if (error || !apartment) {
        console.error('❌ [NotifyResidentService] Erro ao buscar apartamento:', error);
        return null;
      }

      return apartment.id;

    } catch (error) {
      console.error('❌ [NotifyResidentService] Erro ao buscar ID do apartamento:', error);
      return null;
    }
  }

  /**
   * Registra tentativa de notificação no banco de dados
   */
  private static async logNotificationAttempt(
    visitorData: VisitorArrivalData,
    apartmentId: string,
    success: boolean
  ) {
    try {
      const logData = {
        notification_type: 'visitor_arrival',
        visitor_name: visitorData.visitorName,
        apartment_number: visitorData.apartmentNumber,
        building_id: visitorData.buildingId,
        success: success,
        timestamp: new Date().toISOString(),
        metadata: {
          visitor_id: visitorData.visitorId,
          purpose: visitorData.purpose,
          entry_type: visitorData.entry_type,
          apartment_id: apartmentId,
        }
      };

      const { error } = await supabase
        .from('notification_logs')
        .insert(logData);

      if (error) {
        console.warn('⚠️ [NotifyResidentService] Erro ao registrar log de notificação:', error);
        // Não bloqueia o fluxo se falhar o log
      } else {
        console.log('📝 [NotifyResidentService] Log de notificação registrado');
      }

    } catch (error) {
      console.error('❌ [NotifyResidentService] Erro ao registrar log:', error);
      // Não bloqueia o fluxo se falhar o log
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
