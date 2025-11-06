import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { notificationApi } from '../services/notificationApi';
import * as Notifications from 'expo-notifications';
import { notifyPorteirosVisitorResponse } from '../services/pushNotificationService';
import { respondToNotification as respondCore } from '@porteiroapp/common/hooks';

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
  photo_url?: string;
  
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
  delivery_code?: string;
}

export const usePendingNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<PendingNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);

  // Buscar apartment_id do usuário
  const fetchApartmentId = useCallback(async () => {
    if (!user?.id || !user?.profile_id) return;
    
    try {
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.profile_id)
        .maybeSingle();
      
      if (error) throw error;
      if (data?.apartment_id) {
        setApartmentId(data.apartment_id);
      } else {
        // Usuário sem apartamento vinculado: não é erro; apenas não há notificações a buscar
        setApartmentId(null);
      }
    } catch (err) {
      console.error('Erro ao buscar apartment_id:', err);
      setError('Erro ao identificar apartamento');
    }
  }, [user?.id, user?.profile_id]);

  // Buscar notificações pendentes
  const fetchPendingNotifications = useCallback(async () => {
    if (!apartmentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 [usePendingNotifications] Buscando notificações para apartmentId:', apartmentId);
      
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
      
      if (error) throw error;
      
      console.log('🔍 [usePendingNotifications] Dados brutos do Supabase:', {
        count: data?.length || 0,
        data: data?.map(item => ({
          id: item.id,
          entry_type: item.entry_type,
          notification_status: item.notification_status,
          guest_name: item.guest_name,
          delivery_sender: item.delivery_sender,
          delivery_description: item.delivery_description,
          purpose: item.purpose
        }))
      });
      
      // Filter and map notifications, ensuring type safety
      const mappedNotifications: PendingNotification[] = data
        .filter((item): item is typeof item & { entry_type: 'visitor' | 'delivery' | 'vehicle'; notification_status: 'pending' } => {
          // Filter out items with invalid entry_type or notification_status
          return (
            item.entry_type !== null &&
            ['visitor', 'delivery', 'vehicle'].includes(item.entry_type) &&
            item.notification_status === 'pending'
          );
        })
        .map(item => ({
          id: item.id,
          entry_type: item.entry_type as 'visitor' | 'delivery' | 'vehicle',
          notification_status: item.notification_status as 'pending',
          notification_sent_at: item.notification_sent_at || '',
          expires_at: item.expires_at || '',
          apartment_id: item.apartment_id,
          guest_name: item.guest_name || item.visitors?.name || 'Visitante não identificado',
          purpose: item.purpose || undefined,
          visitor_id: item.visitor_id || undefined,
          photo_url: item.photo_url || undefined,
          delivery_sender: item.delivery_sender || undefined,
          delivery_description: item.delivery_description || undefined,
          delivery_tracking_code: item.delivery_tracking_code || undefined,
          license_plate: item.license_plate || undefined,
          vehicle_model: item.vehicle_model || undefined,
          vehicle_color: item.vehicle_color || undefined,
          vehicle_brand: item.vehicle_brand || undefined,
          building_id: item.building_id,
          created_at: item.created_at,
          log_time: item.log_time,
          visitors: item.visitors && item.visitors.document ? {
            name: item.visitors.name,
            document: item.visitors.document,
            phone: item.visitors.phone || undefined
          } : undefined
        }));
      
      console.log('🔍 [usePendingNotifications] Notificações mapeadas:', {
        count: mappedNotifications.length,
        notifications: mappedNotifications.map(n => ({
          id: n.id,
          entry_type: n.entry_type,
          guest_name: n.guest_name,
          delivery_sender: n.delivery_sender,
          purpose: n.purpose
        }))
      });
      
      setNotifications(mappedNotifications);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  // Função para disparar notificações automáticas
  const triggerAutomaticNotifications = useCallback(async (newLog: {
    id: string;
    guest_name?: string | null;
    apartment_id: string;
    building_id: string;
    notification_status?: string | null;
    requires_resident_approval?: boolean | null;
  }) => {
    try {
      // Buscar dados completos do visitante e morador
      const { data: logData, error: logError } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          guest_name,
          apartment_id,
          building_id,
          visitors (
            name,
            phone
          ),
          apartments (
            number,
            buildings (
              name
            ),
            apartment_residents!inner (
              profiles (
                full_name,
                phone
              )
            )
          )
        `)
        .eq('id', newLog.id)
        .single();

      if (logError || !logData) {
        console.error('Erro ao buscar dados para notificação automática:', logError);
        return;
      }

      const resident = logData.apartments?.apartment_residents?.[0]?.profiles;
      const building = logData.apartments?.buildings;
      const visitorName = logData.guest_name || logData.visitors?.name || 'Visitante';
      const residentName = resident?.full_name || 'Morador';
      const residentPhone = resident?.phone;
      const buildingName = building?.name || 'Edifício';
      const apartmentNumber = logData.apartments?.number || 'N/A';

      console.log('ℹ️ [usePendingNotifications] Notificação push será enviada pela Edge Function durante o registro');

      if (residentPhone) {
        // Check if WhatsApp already sent via notification_sent_at
        const { data: logCheck } = await supabase
          .from('visitor_logs')
          .select('notification_sent_at')
          .eq('id', newLog.id)
          .single();

        if (logCheck?.notification_sent_at) {
          console.log('🚫 [usePendingNotifications] WhatsApp já enviado - subscription ignorando');
          return;
        }

        try {
          await notificationApi.sendVisitorWaitingNotification({
            visitor_name: visitorName,
            resident_phone: residentPhone,
            resident_name: residentName,
            building: buildingName,
            apartment: apartmentNumber,
            visitor_log_id: newLog.id
          });

          // Mark as sent by setting notification_sent_at timestamp
          await supabase
            .from('visitor_logs')
            .update({ notification_sent_at: new Date().toISOString() })
            .eq('id', newLog.id);

          console.log('✅ [usePendingNotifications] WhatsApp enviado e notification_sent_at atualizado');

        } catch (whatsappError) {
          console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
        }
      } else {
        console.warn('⚠️ Telefone do morador não encontrado - WhatsApp não enviado');
      }

    } catch (error) {
      console.error('❌ Erro geral ao disparar notificações automáticas:', error);
    }
  }, []);

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
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as {
              id: string;
              guest_name?: string | null;
              apartment_id: string;
              building_id: string;
              notification_status?: string | null;
              requires_resident_approval?: boolean | null;
            };
            if (newLog.notification_status === 'pending' && 
                newLog.requires_resident_approval) {
              triggerAutomaticNotifications(newLog);
              fetchPendingNotifications();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedLog = payload.new as {
              id: string;
              notification_status?: string | null;
            };
            if (updatedLog.notification_status !== 'pending') {
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
  }, [apartmentId, fetchPendingNotifications, triggerAutomaticNotifications]);

  const notifyDoorkeepers = useCallback(async (
    notificationId: string,
    response: NotificationResponse,
    buildingId: string
  ) => {
    try {
      const { data: logData, error: logError } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          guest_name,
          entry_type,
          delivery_destination,
          visitors (name),
          apartments (
            number,
            buildings (name)
          )
        `)
        .eq('id', notificationId)
        .single();

      if (logError || !logData) {
        console.error('❌ [notifyDoorkeepers] Erro ao buscar dados da notificação:', logError);
        return;
      }

      const visitorName = logData.guest_name || logData.visitors?.name || 'Visitante';
      const apartmentNumber = logData.apartments?.number || 'N/A';

      console.log('📱 [notifyDoorkeepers] Enviando push notification para porteiros via Edge Function...');

      // Map delivery_destination: 'apartamento' is not valid for notifyPorteirosVisitorResponse
      // Only 'portaria' and 'elevador' are valid, so filter out 'apartamento'
      const deliveryDestination = response.delivery_destination === 'apartamento' 
        ? undefined 
        : response.delivery_destination;

      const pushResult = await notifyPorteirosVisitorResponse({
        buildingId,
        visitorName,
        apartmentNumber,
        status: response.action === 'approve' ? 'approved' : 'rejected',
        deliveryDestination,
        reason: response.reason
      });

      if (pushResult.success) {
        console.log('✅ [notifyDoorkeepers] Push notification enviada:', `${pushResult.sent} porteiro(s) notificado(s)`);
      } else {
        console.warn('⚠️ [notifyDoorkeepers] Falha ao enviar push:', pushResult.message);
      }

    } catch (error) {
      console.error('❌ [notifyDoorkeepers] Erro geral ao notificar porteiros:', error);
    }
  }, []);

  // Responder à notificação
  const respondToNotification = useCallback(async (
    notificationId: string, 
    response: NotificationResponse
  ) => {
    try {
      const result = await respondCore(
        {
          supabase,
          apartmentId: apartmentId ?? null,
          userId: user?.id
        },
        notificationId,
        response
      );

      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar resposta');
      }

      if (result.buildingId) {
        await notifyDoorkeepers(notificationId, response, result.buildingId);
      } else {
        console.warn('[usePendingNotifications] Building ID ausente após resposta, push não enviado');
      }
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao responder notificação:', err);
      return { success: false, error: errorMessage };
    }
  }, [apartmentId, notifyDoorkeepers, user?.id]);

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
