import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
// Removed old notification service - using Edge Functions for push notifications
import { useAuth } from '../hooks/useAuth';
import { isRegularUser } from '~/types/auth.types';
import { supabase } from '../utils/supabase';

// Interfaces moved here since service was removed
export interface AvisoNotificationData {
  id: string;
  type: 'communication' | 'poll';
  title: string;
  content?: string;
  description?: string;
  building_id: string;
  building_name?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  // expires_at removed - doesn't exist in communications table
  notification_status?: 'sent' | 'delivered' | 'read' | 'failed';
  delivery_attempts?: number;
  last_attempt_at?: string;
}

export interface UseEnhancedAvisosNotificationsReturn {
  notifications: AvisoNotificationData[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isListening: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string, type: 'communication' | 'poll') => Promise<void>;
  confirmUrgentNotification: (notificationId: string, type: 'communication' | 'poll') => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  getNotificationStats: (daysBack?: number) => Promise<any>;
}

/**
 * Hook simplificado para notificações - removido serviço antigo
 * Agora usa apenas Edge Functions para push notifications
 */
const useEnhancedAvisosNotifications = () => {
  const { user } = useAuth();
  
  // Estados
  const [notifications, setNotifications] = useState<AvisoNotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega notificações do banco de dados
   */
  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    // Get building_id from user profile or apartment_residents
    let buildingId: string | null = null;
    
    if (isRegularUser(user) && user.building_id) {
      buildingId = user.building_id;
    } else {
      // Try to get from apartment_residents
      const { data } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (data && (data as any)?.apartments?.building_id) {
        buildingId = (data as any).apartments.building_id;
      }
    }
    
    if (!buildingId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Buscar comunicados
      const { data: communications, error: commError } = await supabase
        .from('communications')
        .select('*')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false })
        .limit(25);

      // Buscar enquetes
      const { data: polls, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (commError) throw commError;
      if (pollError) throw pollError;

      // Combinar e formatar notificações
      const allNotifications: AvisoNotificationData[] = [
        ...(communications || []).map(comm => ({
          id: comm.id,
          type: 'communication' as const,
          title: comm.title,
          content: comm.content,
          building_id: comm.building_id,
          priority: (comm.priority as 'low' | 'normal' | 'high' | 'urgent' | undefined) || 'normal',
          created_at: comm.created_at,
          // expires_at removed - doesn't exist in communications table
        })),
        ...(polls || []).map(poll => ({
          id: poll.id,
          type: 'poll' as const,
          title: poll.title,
          description: poll.description ?? undefined,
          building_id: poll.building_id ?? '',
          priority: 'normal' as const, // priority doesn't exist in polls table
          created_at: poll.created_at ?? new Date().toISOString(),
          // expires_at exists in polls
        }))
      ];

      // Ordenar por data
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
      
      // Calcular não lidas (simplificado)
      const unread = allNotifications.filter(n => 
        new Date(n.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24h
      ).length;
      
      setUnreadCount(unread);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar notificações';
      console.error('❌ Erro ao carregar notificações:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Marca notificação como lida
   */
  const markAsRead = useCallback(async (notificationId: string, type: 'communication' | 'poll') => {
    // Implementação simplificada - apenas remove do contador local
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  /**
   * Confirma notificação urgente
   */
  const confirmUrgentNotification = useCallback(async (notificationId: string, type: 'communication' | 'poll') => {
    try {
      // Implementação simplificada
      await markAsRead(notificationId, type);
      Alert.alert('Confirmado', 'Recebimento confirmado com sucesso!');
    } catch (err) {
      console.error('❌ Erro ao confirmar notificação:', err);
      Alert.alert('Erro', 'Falha ao confirmar recebimento');
    }
  }, [markAsRead]);

  /**
   * Inicia escuta de notificações (simplificado)
   */
  const startListening = useCallback(async () => {
    setIsListening(true);
    await refreshNotifications();
  }, [refreshNotifications]);

  /**
   * Para escuta de notificações
   */
  const stopListening = useCallback(async () => {
    setIsListening(false);
  }, []);

  /**
   * Obtém estatísticas de notificações
   */
  const getNotificationStats = useCallback(async (daysBack: number = 30) => {
    if (!user?.id) return null;
    
    // Get building_id from user profile or apartment_residents
    let buildingId: string | null = null;
    
    if (isRegularUser(user) && user.building_id) {
      buildingId = user.building_id;
    } else {
      // Try to get from apartment_residents
      const { data } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (data && (data as any)?.apartments?.building_id) {
        buildingId = (data as any).apartments.building_id;
      }
    }
    
    if (!buildingId) return null;

    try {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const { data: communications } = await supabase
        .from('communications')
        .select('id')
        .eq('building_id', buildingId)
        .gte('created_at', since);

      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .eq('building_id', buildingId)
        .gte('created_at', since);

      return {
        communications: communications?.length || 0,
        polls: polls?.length || 0,
        total: (communications?.length || 0) + (polls?.length || 0)
      };
    } catch (err) {
      console.error('❌ Erro ao obter estatísticas:', err);
      return null;
    }
  }, [user?.id]);

  // Efeito para inicialização
  useEffect(() => {
    if (user?.id) {
      refreshNotifications();
    }
  }, [user?.id, refreshNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    isListening,
    refreshNotifications,
    markAsRead,
    confirmUrgentNotification,
    startListening,
    stopListening,
    getNotificationStats,
  };
};

export { useEnhancedAvisosNotifications };
export default useEnhancedAvisosNotifications;