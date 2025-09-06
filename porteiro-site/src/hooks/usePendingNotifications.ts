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
          apartment_id,
          purpose,
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
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Tipagem dos itens retornados com base no schema real
      interface DbLog {
        id: string;
        apartment_id: string;
        purpose?: string | null;
        building_id: string;
        created_at: string;
        log_time: string;
        visitors?: { name: string; document: string; phone?: string } | null;
      }

      const rows = (data ?? []) as DbLog[];
      const mappedNotifications: PendingNotification[] = rows.map((item) => ({
        id: item.id,
        entry_type: 'visitor',
        notification_status: 'pending',
        // Usar created_at como horário de envio; fallback para log_time
        notification_sent_at: item.created_at || item.log_time,
        // Sem coluna de expiração no schema atual; usar created_at como placeholder
        expires_at: item.created_at,
        apartment_id: item.apartment_id,
        guest_name: item.visitors?.name || 'Visitante não identificado',
        purpose: item.purpose || undefined,
        building_id: item.building_id,
        created_at: item.created_at,
        log_time: item.log_time,
        visitors: item.visitors
          ? { name: item.visitors.name, document: item.visitors.document, phone: item.visitors.phone }
          : undefined,
      }));
      
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
        .update(updateData as unknown as Record<string, unknown>)
        .eq('id', notificationId);
      
      if (error) throw error;
      
      // Atualizar lista local removendo a notificação processada
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
        () => {
          // Em qualquer mudança relevante, recarregar a lista
          fetchPendingNotifications();
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