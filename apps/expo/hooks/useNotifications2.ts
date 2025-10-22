import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../utils/supabaseUnified';
import { useAuth } from '../../hooks/useAuth';

export interface NotificationData {
  visitor_log_id: string;
  visitor_id: string;
  apartment_id: string;
  building_id: string;
  old_status: string;
  new_status: string;
  log_time: string;
  tipo_log: 'IN' | 'OUT';
  purpose?: string;
  changed_at: string;
  visitor_name?: string;
  apartment_number?: string;
  acknowledged?: boolean;
  id?: string;
}

export interface UseNotificationsReturn {
  notifications: NotificationData[];
  unreadCount: number;
  acknowledgeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  isConnected: boolean;
}

export const useNotifications = (): UseNotificationsReturn => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Função para buscar informações adicionais do visitante e apartamento
  const enrichNotificationData = async (notification: NotificationData): Promise<NotificationData> => {
    try {
      // Buscar informações do visitante
      const { data: visitorData } = await supabase
        .from('visitors')
        .select('name')
        .eq('id', notification.visitor_id)
        .single();

      // Buscar informações do apartamento
      const { data: apartmentData } = await supabase
        .from('apartments')
        .select('number')
        .eq('id', notification.apartment_id)
        .single();

      return {
        ...notification,
        visitor_name: visitorData?.name || 'Visitante não identificado',
        apartment_number: apartmentData?.number || 'N/A',
        acknowledged: false,
        id: `${notification.visitor_log_id}_${Date.now()}`
      };
    } catch (error) {
      console.error('Erro ao enriquecer dados da notificação:', error);
      return {
        ...notification,
        visitor_name: 'Visitante não identificado',
        apartment_number: 'N/A',
        acknowledged: false,
        id: `${notification.visitor_log_id}_${Date.now()}`
      };
    }
  };

  // Função para parsing seguro de JSON
  const safeJsonParse = (jsonString: string): NotificationData | null => {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        console.warn('🔍 [NOTIFICATION_PARSING] Payload inválido para parsing JSON:', {
          payload: jsonString,
          type: typeof jsonString,
          timestamp: new Date().toISOString()
        });
        return null;
      }
      
      // Verificar se já é um objeto
      if (typeof jsonString === 'object') {
        console.log('✅ [NOTIFICATION_PARSING] Payload já é um objeto, usando diretamente');
        return jsonString as NotificationData;
      }
      
      // Tentar fazer o parse
      const parsed = JSON.parse(jsonString);
      
      // Validar se tem as propriedades essenciais
      if (!parsed.visitor_log_id || !parsed.building_id) {
        console.warn('⚠️ [NOTIFICATION_PARSING] Dados de notificação incompletos:', {
          parsed,
          missingFields: {
            visitor_log_id: !parsed.visitor_log_id,
            building_id: !parsed.building_id
          },
          timestamp: new Date().toISOString()
        });
        return null;
      }
      
      console.log('✅ [NOTIFICATION_PARSING] Parsing JSON bem-sucedido:', {
        visitor_log_id: parsed.visitor_log_id,
        building_id: parsed.building_id,
        timestamp: new Date().toISOString()
      });
      
      return parsed as NotificationData;
    } catch (error) {
      console.error('❌ [NOTIFICATION_PARSING] Erro no parsing JSON da notificação:', {
        error: error instanceof Error ? error.message : error,
        payload: jsonString,
        payloadLength: jsonString?.length || 0,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  };

  // Função para processar nova notificação
  const handleNewNotification = useCallback(async (payload: any) => {
    try {
      console.log('🔔 [NOTIFICATION_HANDLER] Nova notificação recebida:', {
        hasNew: !!payload.new,
        hasPayload: !!payload.payload,
        timestamp: new Date().toISOString()
      });
      
      const payloadString = payload.new?.payload || payload.payload;
      const notificationData = safeJsonParse(payloadString);
      
      if (!notificationData) {
        console.warn('⚠️ [NOTIFICATION_HANDLER] Notificação ignorada devido a payload inválido:', {
          originalPayload: payload,
          payloadString,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Verificar se é uma notificação relevante para o porteiro
      if (!user) return;

      // Buscar o building_id do porteiro para filtrar notificações
      const { data: profile } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();

      // Só processar notificações do mesmo prédio
      if (profile?.building_id !== notificationData.building_id) {
        return;
      }

      // Enriquecer dados da notificação
      const enrichedNotification = await enrichNotificationData(notificationData);
      
      // Adicionar à lista de notificações
      setNotifications(prev => [enrichedNotification, ...prev.slice(0, 49)]); // Manter apenas 50 notificações
      

    } catch (error) {
      console.error('Erro ao processar notificação:', error);
    }
  }, [user]);

  // Configurar listener para notificações em tempo real
  useEffect(() => {
    if (!user) return;

    let channel: any;

    const setupRealtimeListener = async () => {
      try {
        // Configurar listener para mudanças via PostgreSQL NOTIFY
        channel = supabase
          .channel('notification_status_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'visitor_logs',
              filter: 'notification_status=neq.null'
            },
            handleNewNotification
          )
          .subscribe((status) => {

            setIsConnected(status === 'SUBSCRIBED');
          });

        // Também escutar diretamente o canal de notificações PostgreSQL
        const notificationChannel = supabase
          .channel('notification_status_changed')
          .on('broadcast', { event: 'notification_status_changed' }, handleNewNotification)
          .subscribe();

      } catch (error) {
        console.error('Erro ao configurar listener de notificações:', error);
        setIsConnected(false);
      }
    };

    setupRealtimeListener();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, handleNewNotification]);

  // Função para marcar notificação como lida
  const acknowledgeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, acknowledged: true }
          : notification
      )
    );
  }, []);

  // Função para limpar todas as notificações
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Calcular número de notificações não lidas
  const unreadCount = notifications.filter(n => !n.acknowledged).length;

  return {
    notifications,
    unreadCount,
    acknowledgeNotification,
    clearAllNotifications,
    isConnected
  };
};