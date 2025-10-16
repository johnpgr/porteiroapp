import { supabase } from './supabase';

export interface SendPushNotificationParams {
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  data?: Record<string, any>;
  // Opções de destinatários (usar apenas uma)
  userIds?: string[];
  pushTokens?: string[];
  userType?: 'admin' | 'porteiro' | 'morador';
  buildingId?: string;
  apartmentIds?: string[];
}

/**
 * Envia notificação push através da Supabase Edge Function
 * Funciona mesmo com app fechado ou em segundo plano
 *
 * @example
 * // Notificar morador de apartamento específico sobre visitante
 * await sendPushNotification({
 *   title: '🚪 Visitante Aguardando',
 *   message: 'João Silva está na portaria',
 *   type: 'visitor',
 *   apartmentIds: ['apartment-id'],
 *   data: { visitorId: 'visitor-123', apartmentNumber: '101' }
 * });
 *
 * @example
 * // Notificar todos os porteiros
 * await sendPushNotification({
 *   title: '📦 Nova Encomenda',
 *   message: 'Encomenda registrada para apt 205',
 *   type: 'delivery',
 *   userType: 'porteiro',
 *   buildingId: 'building-id'
 * });
 */
export async function sendPushNotification(
  params: SendPushNotificationParams
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: params,
    });

    if (error) {
      console.error('🔔 Erro ao chamar edge function:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        error: error.message,
      };
    }

    console.log('🔔 Notificações enviadas:', data);
    return data;
  } catch (error) {
    console.error('🔔 Erro ao enviar notificação push:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Notifica morador sobre novo visitante
 */
export async function notifyNewVisitor(params: {
  visitorName: string;
  visitorDocument: string;
  apartmentIds: string[];
  apartmentNumber?: string;
  visitorId?: string;
}) {
  return sendPushNotification({
    title: '🚪 Novo Visitante',
    message: `${params.visitorName} está aguardando autorização para entrar`,
    type: 'visitor',
    apartmentIds: params.apartmentIds,
    data: {
      type: 'visitor',
      visitorId: params.visitorId,
      apartmentNumber: params.apartmentNumber,
      visitorName: params.visitorName,
    },
  });
}

/**
 * Notifica porteiro sobre visitante autorizado
 */
export async function notifyPorteiroVisitorAuthorized(params: {
  visitorName: string;
  apartmentNumber: string;
  buildingId: string;
  visitorId?: string;
}) {
  return sendPushNotification({
    title: '✅ Visitante Autorizado',
    message: `${params.visitorName} foi autorizado para apt ${params.apartmentNumber}`,
    type: 'visitor',
    userType: 'porteiro',
    buildingId: params.buildingId,
    data: {
      type: 'visitor_authorized',
      visitorId: params.visitorId,
      apartmentNumber: params.apartmentNumber,
      visitorName: params.visitorName,
    },
  });
}

/**
 * Notifica morador sobre nova encomenda
 */
export async function notifyNewDelivery(params: {
  recipientName: string;
  apartmentIds: string[];
  apartmentNumber?: string;
  sender?: string;
  deliveryId?: string;
}) {
  return sendPushNotification({
    title: '📦 Nova Encomenda',
    message: `Encomenda de ${params.sender || 'remetente desconhecido'} para ${params.recipientName}`,
    type: 'delivery',
    apartmentIds: params.apartmentIds,
    data: {
      type: 'delivery',
      deliveryId: params.deliveryId,
      apartmentNumber: params.apartmentNumber,
      sender: params.sender,
    },
  });
}

/**
 * Envia comunicado para todo o prédio
 */
export async function sendBuildingCommunication(params: {
  title: string;
  message: string;
  buildingId: string;
  communicationId?: string;
}) {
  return sendPushNotification({
    title: params.title,
    message: params.message,
    type: 'communication',
    buildingId: params.buildingId,
    data: {
      type: 'communication',
      communicationId: params.communicationId,
      buildingId: params.buildingId,
    },
  });
}

/**
 * Envia alerta de emergência
 */
export async function sendEmergencyAlert(params: {
  message: string;
  buildingId?: string;
  apartmentNumber?: string;
  emergencyId?: string;
}) {
  return sendPushNotification({
    title: '🚨 EMERGÊNCIA',
    message: params.message,
    type: 'emergency',
    buildingId: params.buildingId,
    userType: params.buildingId ? undefined : 'admin', // Se não tem building, notifica admins
    data: {
      type: 'emergency',
      emergencyId: params.emergencyId,
      apartmentNumber: params.apartmentNumber,
      buildingId: params.buildingId,
    },
  });
}
