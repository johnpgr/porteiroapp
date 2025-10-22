import type { TypedSupabaseClient } from '../supabase/core/client';

export interface PendingNotification {
  id: string;
  entry_type: 'visitor' | 'delivery' | 'vehicle';
  notification_status: 'pending' | 'approved' | 'rejected' | 'expired';
  notification_sent_at: string;
  expires_at: string;
  apartment_id: string;
  guest_name?: string;
  purpose?: string;
  visitor_id?: string;
  photo_url?: string;
  delivery_sender?: string;
  delivery_description?: string;
  delivery_tracking_code?: string;
  license_plate?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_brand?: string;
  building_id: string;
  created_at: string;
  log_time: string;
  visitors?: {
    name: string;
    document: string;
    phone?: string;
  };
}

export interface NotificationResponse {
  action: 'approve' | 'reject';
  reason?: string;
  delivery_destination?: 'portaria' | 'elevador' | 'apartamento';
  delivery_code?: string;
}

export interface UsePendingNotificationsCoreDeps {
  supabase: TypedSupabaseClient;
  apartmentId: string | null;
  userId?: string;
}

/**
 * Fetch pending notifications for a given apartment
 */
export async function fetchPendingNotifications(
  deps: UsePendingNotificationsCoreDeps
): Promise<{ data: PendingNotification[] | null; error: string | null }> {
  const { supabase, apartmentId } = deps;
  
  if (!apartmentId) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('visitor_logs')
      .select(`
        id,
        entry_type,
        notification_status,
        notification_sent_at,
        expires_at,
        apartment_id,
        guest_name,
        purpose,
        visitor_id,
        photo_url,
        delivery_sender,
        delivery_description,
        delivery_tracking_code,
        license_plate,
        vehicle_model,
        vehicle_color,
        vehicle_brand,
        building_id,
        created_at,
        log_time,
        visitors (
          name,
          document,
          phone
        )
      `)
      .eq('apartment_id', apartmentId)
      .eq('notification_status', 'pending')
      .in('entry_type', ['visitor', 'delivery', 'vehicle'])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('notification_sent_at', { ascending: false });

    if (error) {
      console.error('[usePendingNotificationsCore] Error fetching notifications:', error);
      return { data: null, error: 'Erro ao carregar notificações' };
    }

    const mappedNotifications = (data as any[]).map(item => ({
      ...item,
      guest_name: item.guest_name || item.visitors?.name || 'Visitante não identificado'
    })) as PendingNotification[];

    return { data: mappedNotifications, error: null };
  } catch (err) {
    console.error('[usePendingNotificationsCore] Unexpected error:', err);
    return { data: null, error: 'Erro ao carregar notificações' };
  }
}

/**
 * Respond to a pending notification (approve or reject)
 */
export async function respondToNotification(
  deps: UsePendingNotificationsCoreDeps,
  notificationId: string,
  response: NotificationResponse
): Promise<{ success: boolean; error?: string; buildingId?: string }> {
  const { supabase, userId } = deps;

  try {
    // Fetch building_id before updating
    const { data: logData, error: logError } = await supabase
      .from('visitor_logs')
      .select('building_id')
      .eq('id', notificationId)
      .single();

    if (logError || !logData?.building_id) {
      console.error('[usePendingNotificationsCore] Error fetching building_id:', logError);
      return { success: false, error: 'Não foi possível identificar o prédio' };
    }

    const updateData: any = {
      notification_status: response.action === 'approve' ? 'approved' : 'rejected',
      resident_response_at: new Date().toISOString(),
      ...(userId && { resident_response_by: userId })
    };

    if (response.reason) {
      updateData.rejection_reason = response.reason;
    }

    if (response.delivery_destination) {
      updateData.delivery_destination = response.delivery_destination;
    }

    const { error } = await supabase
      .from('visitor_logs')
      .update(updateData)
      .eq('id', notificationId);

    if (error) {
      console.error('[usePendingNotificationsCore] Error updating notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, buildingId: logData.building_id };
  } catch (err: any) {
    console.error('[usePendingNotificationsCore] Unexpected error:', err);
    return { success: false, error: err.message || 'Erro ao processar resposta' };
  }
}

/**
 * Setup realtime subscription for pending notifications
 * Returns a cleanup function to unsubscribe
 */
export function subscribeToPendingNotifications(
  deps: UsePendingNotificationsCoreDeps,
  callbacks: {
    onInsert?: (notification: any) => void;
    onUpdate?: (notification: any) => void;
  }
): () => void {
  const { supabase, apartmentId } = deps;

  if (!apartmentId) {
    return () => {}; // No-op cleanup
  }

  const channel = supabase
    .channel(`pending-notifications-${apartmentId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'visitor_logs',
        filter: `apartment_id=eq.${apartmentId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const newLog = payload.new as any;
          if (newLog.notification_status === 'pending' && callbacks.onInsert) {
            callbacks.onInsert(newLog);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedLog = payload.new as any;
          if (callbacks.onUpdate) {
            callbacks.onUpdate(updatedLog);
          }
        }
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}
