import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '@porteiroapp/supabase';

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

const DECISION_CHANNEL_TIMEOUT_MS = 7000;

async function waitForChannelSubscription(
  channel: RealtimeChannel,
  timeoutMs: number = DECISION_CHANNEL_TIMEOUT_MS
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tempo limite ao conectar ao canal de decisões'));
    }, timeoutMs);

    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        reject(
          error instanceof Error
            ? error
            : new Error(`Falha ao conectar ao canal de decisões (status: ${status})`)
        );
      }
    });
  });
}

/**
 * Broadcasts a resident decision to doorman app via Realtime channel
 *
 * TODO: PERFORMANCE OPTIMIZATION NEEDED
 * Current implementation creates a new channel for each broadcast, which:
 * - Adds connection overhead (~7s timeout wait)
 * - Could hit rate limits with many decisions
 * - Wastes resources by not reusing connections
 *
 * Recommended fixes (future):
 * 1. Reuse a single long-lived channel per building
 * 2. Switch to postgres_changes trigger pattern
 * 3. Use Supabase Edge Functions with webhooks
 *
 * See: STAGED_CHANGES_REVIEW.md section 3.1 issue #2
 */
async function broadcastDecisionUpdate(params: {
  supabase: TypedSupabaseClient;
  buildingId: string;
  payload: Record<string, any>;
}): Promise<void> {
  const { supabase, buildingId, payload } = params;
  const channelName = `porteiro-decisions-${buildingId}`;

  const channel = supabase.channel(channelName, {
    config: {
      broadcast: {
        self: false
      }
    }
  });

  try {
    await waitForChannelSubscription(channel);

    const sendResult = await channel.send({
      type: 'broadcast',
      event: 'visitor_decision_update',
      payload
    });

    if (sendResult !== 'ok') {
      throw new Error(`Envio de broadcast retornou status '${sendResult}'`);
    }
  } catch (error) {
    console.error('[usePendingNotificationsCore] Erro ao enviar broadcast de decisão:', error);
  } finally {
    try {
      await supabase.removeChannel(channel);
    } catch (removalError) {
      console.warn('[usePendingNotificationsCore] Falha ao remover canal de decisão:', removalError);
    }
  }
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

    let broadcastPayload: Record<string, any> | null = null;

    try {
      const { data: decisionRecord, error: fetchError } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          visitor_id,
          notification_status,
          resident_response_at,
          resident_response_by,
          visitors (name),
          apartments!inner (number, building_id)
        `)
        .eq('id', notificationId)
        .maybeSingle();

      if (fetchError) {
        console.warn(
          '[usePendingNotificationsCore] Erro ao buscar decisão atualizada para broadcast:',
          fetchError
        );
      }

      if (decisionRecord) {
        broadcastPayload = {
          decision: decisionRecord,
          source: 'resident_response',
          broadcasted_at: new Date().toISOString()
        };
      }
    } catch (fetchException) {
      console.warn(
        '[usePendingNotificationsCore] Exceção ao preparar payload de decisão para broadcast:',
        fetchException
      );
    }

    if (!broadcastPayload) {
      broadcastPayload = {
        visitorLogId: notificationId,
        status: updateData.notification_status,
        residentResponseBy: updateData.resident_response_by ?? null,
        residentResponseAt: updateData.resident_response_at,
        source: 'resident_response',
        broadcasted_at: new Date().toISOString()
      };
    }

    await broadcastDecisionUpdate({
      supabase,
      buildingId: logData.building_id,
      payload: broadcastPayload
    });

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
