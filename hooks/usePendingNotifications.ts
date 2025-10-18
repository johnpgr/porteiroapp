import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { notificationApi } from '../services/notificationApi';
import * as Notifications from 'expo-notifications';
import { notifyPorteirosVisitorResponse } from '../services/pushNotificationService';

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

  // Função para disparar notificações automáticas
  const triggerAutomaticNotifications = useCallback(async (newLog: any) => {
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

      // 1. Push Notification agora é enviada pela Edge Function no momento do registro
      // Não precisamos mais disparar notificação local aqui para evitar duplicatas
      console.log('ℹ️ [usePendingNotifications] Notificação push será enviada pela Edge Function durante o registro');
      // A Edge Function send-push-notification já foi chamada em RegistrarVisitante/Encomenda/Veiculo

      // 2. Enviar WhatsApp se tiver telefone do morador
      if (residentPhone) {
        try {
          await notificationApi.sendVisitorWaitingNotification({
            visitor_name: visitorName,
            resident_phone: residentPhone,
            resident_name: residentName,
            building: buildingName,
            apartment: apartmentNumber,
            visitor_log_id: newLog.id
          });

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
            const newLog = payload.new as any;
            if (newLog.notification_status === 'pending' && 
                newLog.requires_resident_approval) {
              // Disparar notificações automáticas
              triggerAutomaticNotifications(newLog);
              // Adicionar nova notificação à lista
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
  }, [apartmentId, fetchPendingNotifications, triggerAutomaticNotifications]);

  // Função para notificar porteiros sobre resposta do morador
  const notifyDoorkeepers = useCallback(async (
    notificationId: string,
    response: NotificationResponse,
    buildingId: string
  ) => {
    try {
      // Buscar dados da notificação para criar mensagem personalizada
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

      // Preparar dados da mensagem
      const visitorName = logData.guest_name || logData.visitors?.name || 'Visitante';
      const apartmentNumber = logData.apartments?.number || 'N/A';

      console.log('📱 [notifyDoorkeepers] Enviando push notification para porteiros via Edge Function...');

      // Enviar push notification via Edge Function
      const pushResult = await notifyPorteirosVisitorResponse({
        buildingId,
        visitorName,
        apartmentNumber,
        status: response.action === 'approve' ? 'approved' : 'rejected',
        deliveryDestination: response.delivery_destination,
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
      // Buscar building_id antes de atualizar
      const { data: logData, error: logError } = await supabase
        .from('visitor_logs')
        .select('building_id')
        .eq('id', notificationId)
        .single();

      if (logError || !logData?.building_id) {
        console.error('Erro ao buscar building_id:', logError);
        throw new Error('Não foi possível identificar o prédio');
      }

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

      // Notificar porteiros sobre a resposta do morador
      await notifyDoorkeepers(notificationId, response, logData.building_id);
      
      // Remover da lista local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao responder notificação:', err);
      return { success: false, error: err.message };
    }
  }, [user?.id, notifyDoorkeepers]);

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