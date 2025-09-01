import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import avisosNotificationService, { 
  AvisoNotificationData, 
  AvisoNotificationCallback,
  NotificationDeliveryStatus 
} from '../services/avisosNotificationService';
import { supabase } from '../utils/supabase';
import { Alert } from 'react-native';

export interface UseEnhancedAvisosNotificationsReturn {
  // Estado das notificações
  notifications: AvisoNotificationData[];
  unreadCount: number;
  isLoading: boolean;
  isListening: boolean;
  error: string | null;
  
  // Estatísticas de entrega
  deliveryStats: {
    communications: {
      total: number;
      delivered: number;
      read: number;
      confirmed: number;
      deliveryRate: number;
      readRate: number;
    };
    polls: {
      total: number;
      delivered: number;
      read: number;
      deliveryRate: number;
      readRate: number;
    };
  } | null;
  
  // Ações
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string, type: 'communication' | 'poll') => Promise<void>;
  confirmUrgentNotification: (notificationId: string, type: 'communication' | 'poll') => Promise<void>;
  getDeliveryStatus: (notificationId: string, type: 'communication' | 'poll') => Promise<NotificationDeliveryStatus | null>;
  loadDeliveryStats: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook aprimorado para gerenciar notificações de avisos e enquetes
 * Implementa as recomendações do documento técnico
 */
const useEnhancedAvisosNotifications = () => {
  const { user } = useAuth();
  // TODO: Integrar com BuildingContext quando disponível
  const selectedBuilding = { id: 'default' };  
  // Estados
  const [notifications, setNotifications] = useState<AvisoNotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryStats, setDeliveryStats] = useState<any>(null);
  
  // Refs para controle
  const callbackRef = useRef<AvisoNotificationCallback | null>(null);
  const isInitializedRef = useRef(false);
  const lastBuildingIdRef = useRef<string | null>(null);



  /**
   * Callback para processar novas notificações
   */
  const handleNewNotification = useCallback((notification: AvisoNotificationData) => {
    console.log('🔔 Nova notificação recebida:', notification);
    
    setNotifications(prev => {
      // Evitar duplicatas
      const exists = prev.some(n => n.id === notification.id && n.type === notification.type);
      if (exists) return prev;
      
      // Adicionar nova notificação no início
      const updated = [notification, ...prev];
      
      // Limitar a 50 notificações para performance
      return updated.slice(0, 50);
    });
    
    // Atualizar contador de não lidas
    setUnreadCount(prev => prev + 1);
    
    // Mostrar alerta para notificações urgentes
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      showUrgentNotificationAlert(notification);
    }
  }, [showUrgentNotificationAlert]);

  /**
   * Mostra alerta para notificações urgentes
   */
  const showUrgentNotificationAlert = useCallback((notification: AvisoNotificationData) => {
    const title = notification.type === 'poll' ? 'Nova Enquete Urgente' : 'Comunicado Urgente';
    const message = `${notification.building_name || 'Condomínio'}: ${notification.title}`;
    
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Confirmar Recebimento',
          onPress: () => confirmUrgentNotification(notification.id, notification.type),
          style: 'default'
        },
        {
          text: 'Ver Depois',
          style: 'cancel'
        }
      ],
      { cancelable: false }
    );
  }, []);

  /**
   * Inicializa o serviço de notificações
   */
  const initializeService = useCallback(async () => {
    if (!user?.id || !selectedBuilding?.id || isInitializedRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 Inicializando serviço de notificações aprimorado');
      
      // Inicializar serviço
      await avisosNotificationService.initialize(user.id, selectedBuilding.id);
      
      // Configurar callback
      if (callbackRef.current) {
        avisosNotificationService.removeCallback(callbackRef.current);
      }
      
      callbackRef.current = handleNewNotification;
      avisosNotificationService.addCallback(callbackRef.current);
      
      // Carregar notificações recentes
      await refreshNotifications();
      
      isInitializedRef.current = true;
      lastBuildingIdRef.current = selectedBuilding.id;
      
      console.log('✅ Serviço de notificações inicializado com sucesso');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao inicializar notificações';
      console.error('❌ Erro ao inicializar serviço:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, selectedBuilding?.id, handleNewNotification]);

  /**
   * Inicia o monitoramento de notificações
   */
  const startListening = useCallback(async () => {
    if (!isInitializedRef.current) {
      await initializeService();
    }
    
    if (isListening) return;
    
    try {
      setError(null);
      await avisosNotificationService.startListening();
      setIsListening(true);
      console.log('🎧 Monitoramento de notificações iniciado');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao iniciar monitoramento';
      console.error('❌ Erro ao iniciar monitoramento:', err);
      setError(errorMessage);
    }
  }, [isListening, initializeService]);

  /**
   * Para o monitoramento de notificações
   */
  const stopListening = useCallback(async () => {
    if (!isListening) return;
    
    try {
      await avisosNotificationService.stopListening();
      setIsListening(false);
      console.log('🔇 Monitoramento de notificações parado');
    } catch (err) {
      console.error('❌ Erro ao parar monitoramento:', err);
    }
  }, [isListening]);

  /**
   * Atualiza a lista de notificações
   */
  const refreshNotifications = useCallback(async () => {
    if (!isInitializedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const recentNotifications = await avisosNotificationService.getRecentNotifications(50);
      setNotifications(recentNotifications);
      
      // Calcular não lidas (simulação - em produção viria do banco)
      const unread = recentNotifications.filter(n => 
        n.notification_status !== 'read'
      ).length;
      setUnreadCount(unread);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar notificações';
      console.error('❌ Erro ao carregar notificações:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Marca notificação como lida
   */
  const markAsRead = useCallback(async (
    notificationId: string, 
    type: 'communication' | 'poll'
  ) => {
    if (!user?.id) return;
    
    try {
      // Atualizar no banco via serviço
      const deliveryId = `${type}_${notificationId}_${user.id}`;
      
      const { error } = await supabase
        .from('notification_delivery_status')
        .update({
          read_status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('notification_id', deliveryId);
      
      if (error) {
        console.error('❌ Erro ao marcar como lida:', error);
        return;
      }
      
      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId && n.type === type
            ? { ...n, notification_status: 'read' }
            : n
        )
      );
      
      // Decrementar contador
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      console.log('✅ Notificação marcada como lida:', notificationId);
      
    } catch (err) {
      console.error('❌ Erro ao marcar notificação como lida:', err);
    }
  }, [user?.id]);

  /**
   * Confirma recebimento de notificação urgente
   */
  const confirmUrgentNotification = useCallback(async (
    notificationId: string, 
    type: 'communication' | 'poll'
  ) => {
    try {
      const success = await avisosNotificationService.confirmUrgentNotification(notificationId, type);
      
      if (success) {
        // Atualizar estado local
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId && n.type === type
              ? { ...n, notification_status: 'confirmed' }
              : n
          )
        );
        
        console.log('✅ Notificação urgente confirmada:', notificationId);
      }
    } catch (err) {
      console.error('❌ Erro ao confirmar notificação urgente:', err);
    }
  }, []);

  /**
   * Obtém status de entrega de uma notificação
   */
  const getDeliveryStatus = useCallback(async (
    notificationId: string, 
    type: 'communication' | 'poll'
  ): Promise<NotificationDeliveryStatus | null> => {
    if (!user?.id) return null;
    
    try {
      const deliveryId = `${type}_${notificationId}_${user.id}`;
      
      const { data, error } = await supabase
        .from('notification_delivery_status')
        .select('*')
        .eq('notification_id', deliveryId)
        .single();
      
      if (error || !data) {
        console.error('❌ Erro ao buscar status de entrega:', error);
        return null;
      }
      
      return data as NotificationDeliveryStatus;
      
    } catch (err) {
      console.error('❌ Erro ao buscar status de entrega:', err);
      return null;
    }
  }, [user?.id]);

  /**
   * Carrega estatísticas de entrega
   */
  const loadDeliveryStats = useCallback(async () => {
    if (!selectedBuilding?.id) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_notification_delivery_stats', {
          p_building_id: selectedBuilding.id
        });
      
      if (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
        return;
      }
      
      // Processar dados
      const stats = {
        communications: {
          total: 0,
          delivered: 0,
          read: 0,
          confirmed: 0,
          deliveryRate: 0,
          readRate: 0
        },
        polls: {
          total: 0,
          delivered: 0,
          read: 0,
          deliveryRate: 0,
          readRate: 0
        }
      };
      
      if (data) {
        data.forEach((row: any) => {
          if (row.notification_type === 'communication') {
            stats.communications = {
              total: row.total_sent || 0,
              delivered: row.total_delivered || 0,
              read: row.total_read || 0,
              confirmed: row.total_confirmed || 0,
              deliveryRate: row.delivery_rate || 0,
              readRate: row.read_rate || 0
            };
          } else if (row.notification_type === 'poll') {
            stats.polls = {
              total: row.total_sent || 0,
              delivered: row.total_delivered || 0,
              read: row.total_read || 0,
              deliveryRate: row.delivery_rate || 0,
              readRate: row.read_rate || 0
            };
          }
        });
      }
      
      setDeliveryStats(stats);
      
    } catch (err) {
      console.error('❌ Erro ao carregar estatísticas de entrega:', err);
    }
  }, [selectedBuilding?.id]);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Efeito para inicialização
  useEffect(() => {
    if (user?.id && selectedBuilding?.id) {
      // Reinicializar se mudou o prédio
      if (lastBuildingIdRef.current !== selectedBuilding.id) {
        isInitializedRef.current = false;
        setNotifications([]);
        setUnreadCount(0);
      }
      
      initializeService();
    }
  }, [user?.id, selectedBuilding?.id, initializeService]);

  // Efeito para limpeza
  useEffect(() => {
    return () => {
      if (callbackRef.current) {
        avisosNotificationService.removeCallback(callbackRef.current);
      }
      avisosNotificationService.stopListening();
    };
  }, []);

  // Auto-iniciar monitoramento quando inicializado
  useEffect(() => {
    if (isInitializedRef.current && !isListening) {
      startListening();
    }
  }, [isListening, startListening]);

  return {
    // Estado
    notifications,
    unreadCount,
    isLoading,
    isListening: isListening && avisosNotificationService.isServiceListening(),
    error,
    deliveryStats,
    
    // Ações
    startListening,
    stopListening,
    refreshNotifications,
    markAsRead,
    confirmUrgentNotification,
    getDeliveryStatus,
    loadDeliveryStats,
    clearError
  };
};

export { useEnhancedAvisosNotifications };
export default useEnhancedAvisosNotifications;