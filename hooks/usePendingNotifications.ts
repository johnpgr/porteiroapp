import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from './useAuth';

interface PendingNotification {
  id: string;
  entry_type: 'visitor' | 'delivery' | 'vehicle';
  notification_status: 'pending' | 'approved' | 'rejected' | 'expired';
  notification_sent_at: string;
  expires_at: string;
  apartment_id: string;
  
  // Dados do visitante
  guest_name?: string;
  purpose?: string;
  visitor_id?: string;
  
  // Dados da encomenda
  delivery_sender?: string;
  delivery_description?: string;
  delivery_tracking_code?: string;
  
  // Dados do veículo
  license_plate?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_brand?: string;
  
  // Metadados
  building_id: string;
  created_at: string;
  log_time: string;
  
  // Dados do visitante relacionado
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

export const usePendingNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<PendingNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);

  // Buscar apartment_id do usuário
  const fetchApartmentId = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .single();
      
      if (error) throw error;
      setApartmentId(data.apartment_id);
    } catch (err) {
      console.error('Erro ao buscar apartment_id:', err);
      setError('Erro ao identificar apartamento');
    }
  }, [user?.id]);

  // Buscar notificações pendentes
  const fetchPendingNotifications = useCallback(async () => {
    if (!apartmentId) return;
    
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
      
      const mappedNotifications = data.map(item => ({
        ...item,
        guest_name: item.guest_name || item.visitors?.name || 'Visitante não identificado'
      }));
      
      setNotifications(mappedNotifications);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  // Configurar Realtime subscription
  useEffect(() => {
    if (!apartmentId) return;
    
    const channel = supabase
      .channel('visitor_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `apartment_id=eq.${apartmentId}`
        },
        (payload) => {
          console.log('Realtime notification:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as any;
            if (newLog.notification_status === 'pending' && 
                newLog.requires_resident_approval) {
              // Adicionar nova notificação
              fetchPendingNotifications();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedLog = payload.new as any;
            if (updatedLog.notification_status !== 'pending') {
              // Remover notificação respondida
              setNotifications(prev => 
                prev.filter(n => n.id !== updatedLog.id)
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [apartmentId, fetchPendingNotifications]);

  // Responder à notificação
  const respondToNotification = useCallback(async (
    notificationId: string, 
    response: NotificationResponse
  ) => {
    try {
      const updateData: any = {
        notification_status: response.action === 'approve' ? 'approved' : 'rejected',
        resident_response_at: new Date().toISOString(),
        resident_response_by: user?.id,
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
      
      if (error) throw error;
      
      // Remover da lista local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao responder notificação:', err);
      return { success: false, error: err.message };
    }
  }, [user?.id]);

  // Inicializar
  useEffect(() => {
    fetchApartmentId();
  }, [fetchApartmentId]);

  useEffect(() => {
    if (apartmentId) {
      fetchPendingNotifications();
    }
  }, [apartmentId, fetchPendingNotifications]);

  return {
    notifications,
    loading,
    error,
    respondToNotification,
    refreshNotifications: fetchPendingNotifications
  };
};

export type { PendingNotification, NotificationResponse };