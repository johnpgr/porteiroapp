import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface PendingNotification {
  id: string;
  entry_type: 'visitor' | 'delivery' | 'vehicle';
  notification_status: 'pending' | 'approved' | 'rejected' | 'expired';
  notification_sent_at: string;
  expires_at: string;
  apartment_id: string;
  guest_name?: string;
  purpose?: string;
  visitor_id?: string;
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

interface NotificationResponse {
  action: 'approve' | 'reject';
  reason?: string;
  delivery_destination?: 'portaria' | 'elevador' | 'apartamento';
}

interface UsePendingNotificationsReturn {
  notifications: PendingNotification[];
  loading: boolean;
  error: string | null;
  fetchPendingNotifications: () => Promise<void>;
  respondToNotification: (notificationId: string, response: NotificationResponse) => Promise<void>;
}

export const usePendingNotifications = (apartmentId?: string): UsePendingNotificationsReturn => {
  const [notifications, setNotifications] = useState<PendingNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar notificações pendentes
  const fetchPendingNotifications = useCallback(async () => {
    if (!apartmentId) {
      setNotifications([]);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
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
        .eq('requires_resident_approval', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('notification_sent_at', { ascending: false });
      
      if (error) throw error;
      
      const mappedNotifications = (data as unknown as Record<string, unknown>[]).map(item => ({
        id: item.id,
        entry_type: item.entry_type,
        notification_status: item.notification_status,
        notification_sent_at: item.notification_sent_at,
        expires_at: item.expires_at,
        apartment_id: item.apartment_id,
        guest_name: item.guest_name || 'Visitante não identificado',
        purpose: item.purpose,
        visitor_id: item.visitor_id,
        delivery_sender: item.delivery_sender,
        delivery_description: item.delivery_description,
        delivery_tracking_code: item.delivery_tracking_code,
        license_plate: item.license_plate,
        vehicle_model: item.vehicle_model,
        vehicle_color: item.vehicle_color,
        vehicle_brand: item.vehicle_brand,
        building_id: item.building_id,
        created_at: item.created_at,
        log_time: item.log_time,
        visitors: item.visitors
      } as PendingNotification));
      
      setNotifications(mappedNotifications);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  // Responder a uma notificação
  const respondToNotification = useCallback(async (
    notificationId: string, 
    response: NotificationResponse
  ) => {
    try {
      setError(null);
      
      const updateData: {
        notification_status: 'approved' | 'rejected';
        resident_response_at: string;
        rejection_reason?: string;
        delivery_destination?: 'portaria' | 'elevador' | 'apartamento';
      } = {
        notification_status: response.action === 'approve' ? 'approved' : 'rejected',
        resident_response_at: new Date().toISOString(),
      };
      
      if (response.reason) {
        updateData.rejection_reason = response.reason;
      }
      
      if (response.delivery_destination) {
        updateData.delivery_destination = response.delivery_destination;
      }
      
      const { error } = await supabase
        .from('visitor_logs')
        .update(updateData as Record<string, unknown>)
        .eq('id', notificationId);
      
      if (error) throw error;
      
      // Remover a notificação da lista local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
    } catch (err) {
      console.error('Erro ao responder notificação:', err);
      setError('Erro ao processar resposta');
      throw err;
    }
  }, []);

  // Configurar subscription para atualizações em tempo real
  useEffect(() => {
    if (!apartmentId) return;

    const channel = supabase
      .channel(`pending-notifications-${apartmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `apartment_id=eq.${apartmentId}`,
        },
        (payload) => {
          console.log('Mudança detectada:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as Record<string, unknown>;
            if (newLog.notification_status === 'pending' && newLog.requires_resident_approval) {
              // Buscar dados completos da nova notificação
              fetchPendingNotifications();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedLog = payload.new as Record<string, unknown>;
            if (updatedLog.notification_status !== 'pending') {
              // Remover da lista se não for mais pendente
              setNotifications(prev => prev.filter(n => n.id !== updatedLog.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [apartmentId, fetchPendingNotifications]);

  // Buscar notificações quando o apartmentId mudar
  useEffect(() => {
    fetchPendingNotifications();
  }, [fetchPendingNotifications]);

  return {
    notifications,
    loading,
    error,
    fetchPendingNotifications,
    respondToNotification,
  };
};

export type { PendingNotification, NotificationResponse };