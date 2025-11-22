/**
 * Push Notification Service - Invokes Supabase Edge Functions
 *
 * This service provides a clean interface to send push notifications
 * by invoking the Supabase Edge Function 'send-push-notification'
 */

import { supabase } from '~/utils/supabase';

export interface PushNotificationParams {
  // Target specification (use one of these)
  userIds?: string[];           // Specific user profile IDs
  pushTokens?: string[];        // Direct push tokens
  userType?: 'porteiro' | 'morador';  // All users of this type
  buildingId?: string;          // Filter by building
  apartmentIds?: string[];      // Filter moradores by apartments

  // Notification content
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  data?: Record<string, any>;
}

export interface PushNotificationResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  message?: string;
  errors?: any[];
}

/**
 * Sends push notifications by invoking the send-push-notification Edge Function
 */
export async function sendPushNotification(
  params: PushNotificationParams
): Promise<PushNotificationResult> {
  try {
    console.log('🔔 [pushNotificationService] Invoking send-push-notification Edge Function:', {
      title: params.title,
      type: params.type,
      hasUserIds: !!params.userIds,
      hasTokens: !!params.pushTokens,
      userType: params.userType,
      buildingId: params.buildingId,
      timestamp: new Date().toISOString()
    });

    // Invoke the Edge Function
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds: params.userIds,
        pushTokens: params.pushTokens,
        userType: params.userType,
        buildingId: params.buildingId,
        apartmentIds: params.apartmentIds,
        title: params.title,
        message: params.message,
        type: params.type,
        data: params.data || {}
      }
    });

    if (error) {
      console.error('❌ [pushNotificationService] Edge Function error:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: error.message || 'Failed to invoke push notification function',
        errors: [error]
      };
    }

    console.log('✅ [pushNotificationService] Edge Function response:', data);

    return {
      success: data.success !== false,
      sent: data.sent || 0,
      failed: data.failed || 0,
      total: data.total || 0,
      message: data.message,
      errors: data.errors
    };

  } catch (error) {
    console.error('❌ [pushNotificationService] Unexpected error:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      total: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
      errors: [error]
    };
  }
}

/**
 * Notifies all residents of an apartment about a visitor arrival
 */
export async function notifyResidentsVisitorArrival(params: {
  apartmentIds: string[];
  visitorName: string;
  apartmentNumber: string;
  purpose?: string;
  photoUrl?: string;
}): Promise<PushNotificationResult> {
  return sendPushNotification({
    apartmentIds: params.apartmentIds,
    userType: 'morador',
    title: '🔔 Visitante na Portaria [EDGE FUNCTION]',
    message: `${params.visitorName} chegou para o apartamento ${params.apartmentNumber}`,
    type: 'visitor',
    data: {
      visitor_name: params.visitorName,
      apartment_number: params.apartmentNumber,
      purpose: params.purpose,
      photo_url: params.photoUrl,
      action_type: 'visitor_arrival'
    }
  });
}

/**
 * Notifies all doorkeepers (porteiros) of a building about visitor response
 */
export async function notifyPorteirosVisitorResponse(params: {
  buildingId: string;
  visitorName: string;
  apartmentNumber: string;
  status: 'approved' | 'rejected';
  deliveryDestination?: 'portaria' | 'elevador';
  reason?: string;
}): Promise<PushNotificationResult> {
  const isApproved = params.status === 'approved';
  const isDelivery = !!params.deliveryDestination;

  let title: string;
  let message: string;

  if (isApproved) {
    if (isDelivery) {
      const dest = params.deliveryDestination === 'portaria' ? 'na portaria' : 'no elevador';
      title = '✅ Entrega Autorizada [EDGE FUNCTION]';
      message = `Apt ${params.apartmentNumber} autorizou deixar entrega de ${params.visitorName} ${dest}`;
    } else {
      title = '✅ Visitante Aprovado [EDGE FUNCTION]';
      message = `Apt ${params.apartmentNumber} autorizou entrada de ${params.visitorName}`;
    }
  } else {
    title = isDelivery ? '❌ Entrega Recusada [EDGE FUNCTION]' : '❌ Visitante Recusado [EDGE FUNCTION]';
    const reasonText = params.reason ? ` Motivo: ${params.reason}` : '';
    message = `Morador do apt ${params.apartmentNumber} recusou ${isDelivery ? 'entrega de' : 'entrada de'} ${params.visitorName}.${reasonText}`;
  }

  return sendPushNotification({
    buildingId: params.buildingId,
    userType: 'porteiro',
    title,
    message,
    type: isDelivery ? 'delivery' : 'visitor',
    data: {
      visitor_name: params.visitorName,
      apartment_number: params.apartmentNumber,
      status: params.status,
      delivery_destination: params.deliveryDestination,
      reason: params.reason,
      action_type: 'resident_response'
    }
  });
}

/**
 * Notifies specific doorkeeper(s) about a delivery
 */
export async function notifyPorteirosDelivery(params: {
  buildingId: string;
  recipientName: string;
  apartmentNumber: string;
  senderCompany?: string;
}): Promise<PushNotificationResult> {
  return sendPushNotification({
    buildingId: params.buildingId,
    userType: 'porteiro',
    title: '📦 Nova Encomenda [EDGE FUNCTION]',
    message: `Encomenda para ${params.recipientName} - Apt ${params.apartmentNumber}`,
    type: 'delivery',
    data: {
      recipient_name: params.recipientName,
      apartment_number: params.apartmentNumber,
      sender_company: params.senderCompany,
      action_type: 'new_delivery'
    }
  });
}

/**
 * Sends emergency notification to all porteiros and moradores
 */
export async function notifyEmergency(params: {
  buildingId: string;
  title: string;
  message: string;
  emergencyType?: string;
}): Promise<PushNotificationResult> {
  return sendPushNotification({
    buildingId: params.buildingId,
    title: `${params.title} [EDGE FUNCTION]`,
    message: params.message,
    type: 'emergency',
    data: {
      emergency_type: params.emergencyType,
      action_type: 'emergency_alert'
    }
  });
}