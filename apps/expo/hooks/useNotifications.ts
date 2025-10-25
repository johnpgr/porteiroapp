import { useEffect, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

// Configurar como as notificações devem ser tratadas quando recebidas
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
}

export interface RealtimeNotificationData {
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

export const useNotifications = () => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [realtimeNotifications, setRealtimeNotifications] = useState<RealtimeNotificationData[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Solicitar permissões de notificação (memoizado)
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      setPermissionStatus(finalStatus);
      
      if (finalStatus !== 'granted') {
        console.log('Permissão de notificação negada');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      return false;
    }
  }, []);

  // Cancelar notificação específica (memoizado)
  const cancelNotification = useCallback(async (customId: string): Promise<void> => {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Encontrar notificações com o customId específico no data
      const notificationsToCancel = scheduledNotifications.filter(
        notification => notification.content.data?.customId === customId
      );

      // Cancelar todas as notificações encontradas
      for (const notification of notificationsToCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`Notificação cancelada: ${notification.identifier} (customId: ${customId})`);
      }
    } catch (error) {
      console.error('Erro ao cancelar notificação:', error);
    }
  }, []);

  // Agendar notificação local (memoizado)
  const scheduleNotification = useCallback(async ({
    id,
    title,
    body,
    triggerDate,
    data = {}
  }: {
    id: string;
    title: string;
    body: string;
    triggerDate: Date;
    data?: any;
  }): Promise<string | null> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Permissão de notificação não concedida');
      }

      // Cancelar notificação existente com o mesmo ID
      await cancelNotification(id);

      // Calcular segundos até a data de disparo
      const now = new Date();
      const secondsUntilTrigger = Math.max(1, Math.floor((triggerDate.getTime() - now.getTime()) / 1000));

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { ...data, customId: id },
          sound: true,
        },
        trigger: { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilTrigger 
        },
      });

      console.log(`Notificação agendada para ${triggerDate.toLocaleString()} com ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      return null;
    }
  }, [requestPermissions, cancelNotification]);

  // Cancelar todas as notificações (memoizado)
  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Todas as notificações foram canceladas');
    } catch (error) {
      console.error('Erro ao cancelar todas as notificações:', error);
    }
  }, []);

  // Listar notificações agendadas (memoizado)
  const getScheduledNotifications = useCallback(async (): Promise<Notifications.NotificationRequest[]> => {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Erro ao obter notificações agendadas:', error);
      return [];
    }
  }, []);

  // Função para buscar informações adicionais do visitante e apartamento
  const enrichNotificationData = async (notification: RealtimeNotificationData): Promise<RealtimeNotificationData> => {
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
        id: `${notification.visitor_log_id}_${notification.changed_at}`
      };
    } catch (error) {
      console.error('Erro ao enriquecer dados da notificação:', error);
      return {
        ...notification,
        visitor_name: 'Visitante não identificado',
        apartment_number: 'N/A',
        acknowledged: false,
        id: `${notification.visitor_log_id}_${notification.changed_at}`
      };
    }
  };

  // Função para parsing seguro de JSON
  const safeJsonParse = (jsonString: string): RealtimeNotificationData | null => {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        console.warn('🔍 [NOTIFICATION_PARSING] Payload inválido para parsing JSON:', {
          payload: jsonString,
          type: typeof jsonString,
          timestamp: new Date().toISOString()
        });
        return null;
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
      
      return parsed as RealtimeNotificationData;
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

  // Função para processar nova notificação em tempo real
  const handleNewRealtimeNotification = useCallback(async (payload: any) => {
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
      setRealtimeNotifications(prev => [enrichedNotification, ...prev.slice(0, 49)]); // Manter apenas 50 notificações
      
      // Opcionalmente, disparar uma notificação local do Expo
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${notificationData.tipo_log === 'IN' ? 'Entrada' : 'Saída'} de Visitante`,
          body: `${enrichedNotification.visitor_name} - Apt ${enrichedNotification.apartment_number}`,
          data: { ...notificationData },
          sound: true,
        },
        trigger: null, // Imediato
      });

    } catch (error) {
      console.error('Erro ao processar notificação:', error);
    }
  }, [user]);

  // Função para marcar notificação como lida
  const acknowledgeNotification = useCallback((notificationId: string) => {
    setRealtimeNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, acknowledged: true }
          : notification
      )
    );
  }, []);

  // Função para limpar todas as notificações em tempo real
  const clearAllRealtimeNotifications = useCallback(() => {
    setRealtimeNotifications([]);
  }, []);

  // Configurar listeners de notificação local (Expo)
  useEffect(() => {
    // Listener para notificações recebidas
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notificação recebida:', notification);
    });

    // Listener para quando o usuário toca na notificação
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuário interagiu com a notificação:', response);
      const customId = response.notification.request.content.data?.customId;
      if (customId) {
        // Aqui você pode navegar para uma tela específica baseada no customId
        console.log('ID customizado da notificação:', customId);
      }
    });

    // Solicitar permissões na inicialização
    requestPermissions();

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [requestPermissions]);

  // Configurar listener para notificações em tempo real (Supabase)
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
            handleNewRealtimeNotification
          )
          .on('broadcast', { event: 'notification_status_changed' }, handleNewRealtimeNotification)
          .subscribe((status: string) => {
            setIsRealtimeConnected(status === 'SUBSCRIBED');
          });

      } catch (error) {
        console.error('Erro ao configurar listener de notificações:', error);
        setIsRealtimeConnected(false);
      }
    };

    setupRealtimeListener();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, handleNewRealtimeNotification]);

  // Calcular número de notificações não lidas
  const unreadCount = realtimeNotifications.filter(n => !n.acknowledged).length;

  return {
    // Expo local notifications
    expoPushToken,
    notification,
    permissionStatus,
    requestPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    
    // Supabase realtime notifications
    realtimeNotifications,
    unreadCount,
    acknowledgeNotification,
    clearAllRealtimeNotifications,
    isRealtimeConnected,
  };
};