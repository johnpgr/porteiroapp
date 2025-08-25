import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { NotificationService } from '../utils/notificationService';
import { useAuth } from './useAuth';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  data?: any;
  status: 'pending' | 'delivered' | 'read' | 'failed';
  created_at: string;
  updated_at: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  pending: number;
  delivered: number;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    pending: 0,
    delivered: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  
  const notificationService = new NotificationService();

  const initializeNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      const hasPermission = await notificationService.requestPermissions();
      setIsPermissionGranted(hasPermission);

      if (hasPermission) {
        await notificationService.registerToken(user.id);
        const listeners = notificationService.setupNotificationListeners();

        return () => {
          listeners.foregroundSubscription.remove();
          listeners.responseSubscription.remove();
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao inicializar notificações');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      
      const total = data?.length || 0;
      const unread = data?.filter(n => n.status !== 'read').length || 0;
      const pending = data?.filter(n => n.status === 'pending').length || 0;
      const delivered = data?.filter(n => n.status === 'delivered').length || 0;

      setStats({ total, unread, pending, delivered });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar notificações');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, status: 'read' } : n
        )
      );

      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao marcar como lida');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('user_id', user.id)
        .neq('status', 'read');

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, status: 'read' }))
      );

      setStats(prev => ({ ...prev, unread: 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao marcar todas como lidas');
    }
  }, [user?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      setStats(prev => ({
        total: prev.total - 1,
        unread: notification?.status !== 'read' ? prev.unread - 1 : prev.unread,
        pending: notification?.status === 'pending' ? prev.pending - 1 : prev.pending,
        delivered: notification?.status === 'delivered' ? prev.delivered - 1 : prev.delivered
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar notificação');
    }
  }, [notifications]);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!user?.id) return;

    try {
      await notificationService.updateTokenStatus(user.id, enabled);
      
      if (enabled) {
        await initializeNotifications();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar configuração');
    }
  }, [user?.id, initializeNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time notification update:', payload);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
    if (user?.id) {
      initializeNotifications();
      fetchNotifications();
    }
  }, [user?.id, initializeNotifications, fetchNotifications]);

  return {
    notifications,
    stats,
    isLoading,
    error,
    isPermissionGranted,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleNotifications,
    initializeNotifications
  };
};