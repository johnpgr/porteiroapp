import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchPendingNotifications as fetchCore,
  respondToNotification as respondCore,
  subscribeToPendingNotifications,
  type PendingNotification,
  type NotificationResponse
} from '@porteiroapp/hooks';

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

  // Buscar notificações pendentes usando o core compartilhado
  const fetchPendingNotifications = useCallback(async () => {
    if (!apartmentId) {
      setNotifications([]);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await fetchCore({
        supabase,
        apartmentId
      });
      
      if (result.error) {
        setError(result.error);
      } else {
        setNotifications(result.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  // Responder a uma notificação usando o core compartilhado
  const respondToNotification = useCallback(async (
    notificationId: string, 
    response: NotificationResponse
  ) => {
    try {
      setError(null);
      
      const result = await respondCore(
        {
          supabase,
          apartmentId: apartmentId || null
        },
        notificationId,
        response
      );
      
      if (!result.success) {
        setError(result.error || 'Erro ao processar resposta');
        throw new Error(result.error);
      }
      
      // Remover a notificação da lista local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
    } catch (err) {
      console.error('Erro ao responder notificação:', err);
      setError('Erro ao processar resposta');
      throw err;
    }
  }, [apartmentId]);

  // Configurar subscription para atualizações em tempo real
  useEffect(() => {
    if (!apartmentId) return;

    const cleanup = subscribeToPendingNotifications(
      { supabase, apartmentId },
      {
        onInsert: (newLog) => {
          console.log('Mudança detectada:', newLog);
          if (newLog.notification_status === 'pending' && newLog.requires_resident_approval) {
            // Buscar dados completos da nova notificação
            fetchPendingNotifications();
          }
        },
        onUpdate: (updatedLog) => {
          if (updatedLog.notification_status !== 'pending') {
            // Remover da lista se não for mais pendente
            setNotifications(prev => prev.filter(n => n.id !== updatedLog.id));
          }
        }
      }
    );

    return cleanup;
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