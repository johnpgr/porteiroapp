import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from './useAuth';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  user_id: string;
  apartment_id?: string;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      subscribeToNotifications();
    }
  }, [user, fetchNotifications, subscribeToNotifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // Buscar apartamentos do usuário se for morador
      let apartmentIds: string[] = [];
      if (user.user_type === 'morador') {
        const { data: apartmentData } = await supabase
          .from('apartment_residents')
          .select('apartment_id')
          .eq('user_id', user.id);

        apartmentIds = apartmentData?.map((item) => item.apartment_id) || [];
      }

      // Construir filtro baseado no tipo de usuário
      let filter = `user_id.eq.${user.id}`;
      if (apartmentIds.length > 0) {
        const apartmentFilter = apartmentIds.map((id) => `apartment_id.eq.${id}`).join(',');
        filter = `user_id.eq.${user.id},${apartmentFilter}`;
      }

      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .or(filter)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedNotifications =
        data?.map((item) => ({
          id: item.id,
          title: item.title || 'Nova notificação',
          message: item.message,
          type: item.type || 'communication',
          user_id: item.user_id,
          apartment_id: item.apartment_id,
          read: item.read || false,
          created_at: item.created_at,
        })) || [];

      setNotifications(formattedNotifications);
      setUnreadCount(formattedNotifications.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const subscribeToNotifications = useCallback(() => {
    if (!user) return;

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = {
            id: payload.new.id,
            title: payload.new.title || 'Nova notificação',
            message: payload.new.message,
            type: payload.new.type || 'communication',
            user_id: payload.new.user_id,
            apartment_id: payload.new.apartment_id,
            read: false,
            created_at: payload.new.created_at,
          };

          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('communications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // Buscar apartamentos do usuário se for morador
      let apartmentIds: string[] = [];
      if (user.user_type === 'morador') {
        const { data: apartmentData } = await supabase
          .from('apartment_residents')
          .select('apartment_id')
          .eq('user_id', user.id);

        apartmentIds = apartmentData?.map((item) => item.apartment_id) || [];
      }

      // Construir filtro baseado no tipo de usuário
      let filter = `user_id.eq.${user.id}`;
      if (apartmentIds.length > 0) {
        const apartmentFilter = apartmentIds.map((id) => `apartment_id.eq.${id}`).join(',');
        filter = `user_id.eq.${user.id},${apartmentFilter}`;
      }

      const { error } = await supabase
        .from('communications')
        .update({ read: true })
        .or(filter)
        .eq('read', false);

      if (error) throw error;

      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
    }
  };

  const createNotification = async (
    title: string,
    message: string,
    type: 'visitor' | 'delivery' | 'communication' | 'emergency',
    targetUserId?: string,
    targetApartmentId?: string
  ) => {
    try {
      const { error } = await supabase.from('communications').insert({
        title,
        message,
        type,
        user_id: targetUserId,
        apartment_id: targetApartmentId,
        sender_id: user?.id,
        read: false,
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      return { success: false, error };
    }
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    createNotification,
    refresh: fetchNotifications,
  };
}
