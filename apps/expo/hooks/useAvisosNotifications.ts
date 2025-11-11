import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { isRegularUser } from '~/types/auth.types';
// Removed old notification services - using Edge Functions for push notifications
import { AvisoNotificationData } from './useEnhancedAvisosNotifications';
import { supabase } from '../utils/supabase';

interface AvisoNotification {
  id: string;
  type: 'communication' | 'poll';
  title: string;
  content?: string;
  description?: string;
  building_id: string;
  building_name?: string;
  priority?: string;
  created_at: string;
  // expires_at removed - doesn't exist in communications table
  notification_status?: string;
}

/**
 * Hook simplificado para notificações de avisos - removido serviço antigo
 * Agora usa apenas Edge Functions para push notifications
 */
export const useAvisosNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AvisoNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userBuildingId, setUserBuildingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Buscar building_id do usuário
  const fetchUserBuildingId = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Primeiro tentar pelo building_id direto no perfil (only for regular users)
      if (isRegularUser(user) && user.building_id) {
        setUserBuildingId(user.building_id);
        return;
      }

      // Se não tiver, buscar através do apartment_residents
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      if ((data as any)?.apartments?.building_id) {
        setUserBuildingId((data as any).apartments.building_id);
      } else {
        // Usuário sem prédio vinculado: não é erro; apenas não há notificações a buscar
        setUserBuildingId(null);
      }
    } catch (err) {
      console.error('Erro ao buscar building_id:', err);
      setError('Erro ao identificar prédio do usuário');
    }
  }, [user?.id]);

  // Carregar notificações do banco de dados
  const loadNotifications = useCallback(async () => {
    if (!userBuildingId) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar comunicados
      const { data: communications, error: commError } = await supabase
        .from('communications')
        .select('*')
        .eq('building_id', userBuildingId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Buscar enquetes
      const { data: polls, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('building_id', userBuildingId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (commError) throw commError;
      if (pollError) throw pollError;

      // Combinar e formatar notificações
      const allNotifications: AvisoNotification[] = [
        ...(communications || []).map(comm => ({
          id: comm.id,
          type: 'communication' as const,
          title: comm.title,
          content: comm.content,
          building_id: comm.building_id,
          priority: comm.priority || 'normal',
          created_at: comm.created_at,
          // expires_at removed - doesn't exist in communications table
          notification_status: 'delivered'
        })),
        ...(polls || []).map(poll => ({
          id: poll.id,
          type: 'poll' as const,
          title: poll.title,
          description: poll.description ?? undefined,
          building_id: poll.building_id ?? '',
          priority: 'normal', // priority doesn't exist in polls table
          created_at: poll.created_at ?? new Date().toISOString(),
          // expires_at exists in polls
          notification_status: 'delivered'
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
      setLoading(false);
    }
  }, [userBuildingId]);

  // Iniciar escuta (simplificado)
  const startListening = useCallback(async () => {
    setIsListening(true);
    await loadNotifications();
  }, [loadNotifications]);

  // Parar escuta
  const stopListening = useCallback(async () => {
    setIsListening(false);
  }, []);

  // Marcar como lida
  const markAsRead = useCallback(async (recordId: string, recordType: 'communication' | 'poll', userId: string) => {
    // Implementação simplificada - apenas remove do contador local
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Confirmar notificação urgente
  const confirmUrgentNotification = useCallback(async (recordId: string, recordType: 'communication' | 'poll', userId: string) => {
    try {
      await markAsRead(recordId, recordType, userId);
      Alert.alert('Confirmado', 'Recebimento confirmado com sucesso!');
    } catch (err) {
      console.error('❌ Erro ao confirmar notificação:', err);
      Alert.alert('Erro', 'Falha ao confirmar recebimento');
    }
  }, [markAsRead]);

  // Obter estatísticas
  const getNotificationStats = useCallback(async (buildingId?: string, daysBack: number = 30) => {
    const targetBuildingId = buildingId || userBuildingId;
    if (!targetBuildingId) return null;

    try {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const { data: communications } = await supabase
        .from('communications')
        .select('id')
        .eq('building_id', targetBuildingId)
        .gte('created_at', since);

      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .eq('building_id', targetBuildingId)
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
  }, [userBuildingId]);

  // Efeitos
  useEffect(() => {
    if (user?.id) {
      fetchUserBuildingId();
    }
  }, [user?.id, fetchUserBuildingId]);

  useEffect(() => {
    if (userBuildingId) {
      loadNotifications();
    }
  }, [userBuildingId, loadNotifications]);

  return {
    notifications,
    loading,
    error,
    userBuildingId,
    isListening,
    unreadCount,
    startListening,
    stopListening,
    markAsRead,
    confirmUrgentNotification,
    getNotificationStats,
    refreshNotifications: loadNotifications,
  };
};

export type { AvisoNotification };