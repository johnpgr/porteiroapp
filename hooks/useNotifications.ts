import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, NotificationData, NotificationCallback } from '../services/notificationService';

export interface UseNotificationsOptions {
  /** Se deve iniciar automaticamente o serviço ao montar o componente */
  autoStart?: boolean;
  /** Número máximo de notificações a manter no histórico local */
  maxNotifications?: number;
  /** Se deve buscar notificações recentes ao iniciar */
  loadRecentOnStart?: boolean;
}

export interface UseNotificationsReturn {
  /** Lista de notificações recebidas */
  notifications: NotificationData[];
  /** Se o serviço está conectado */
  isConnected: boolean;
  /** Se está carregando */
  isLoading: boolean;
  /** Último erro ocorrido */
  error: string | null;
  /** Inicia o serviço de notificações */
  startListening: () => Promise<void>;
  /** Para o serviço de notificações */
  stopListening: () => Promise<void>;
  /** Limpa todas as notificações do estado local */
  clearNotifications: () => void;
  /** Marca uma notificação como lida */
  markAsRead: (notificationId: string) => void;
  /** Confirma uma notificação (para porteiros) */
  confirmNotification: (visitorLogId: string, porteirId: string) => Promise<boolean>;
  /** Busca notificações recentes */
  loadRecentNotifications: () => Promise<void>;
  /** Número de notificações não lidas */
  unreadCount: number;
}

/**
 * Hook para gerenciar notificações em tempo real
 * Utiliza o NotificationService para escutar mudanças no notification_status
 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    autoStart = false,
    maxNotifications = 50,
    loadRecentOnStart = true
  } = options;

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  
  const callbackRef = useRef<NotificationCallback | null>(null);

  // Callback para processar novas notificações
  const handleNewNotification = useCallback((notification: NotificationData) => {

    
    setNotifications(prev => {
      // Evitar duplicatas
      const exists = prev.some(n => n.visitor_log_id === notification.visitor_log_id);
      if (exists) {
        return prev;
      }
      
      // Adicionar nova notificação no início da lista
      const updated = [notification, ...prev];
      
      // Limitar o número máximo de notificações
      return updated.slice(0, maxNotifications);
    });
  }, [maxNotifications]);

  // Iniciar serviço de notificações
  const startListening = useCallback(async () => {
    if (isConnected) {

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Registrar callback
      callbackRef.current = handleNewNotification;
      notificationService.addCallback(handleNewNotification);
      
      // Iniciar serviço
      await notificationService.startListening();
      setIsConnected(true);
      
      // Carregar notificações recentes se solicitado
      if (loadRecentOnStart) {
        await loadRecentNotifications();
      }
      

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('❌ Erro ao iniciar serviço de notificações:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, handleNewNotification, loadRecentOnStart]);

  // Parar serviço de notificações
  const stopListening = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    try {
      // Remover callback
      if (callbackRef.current) {
        notificationService.removeCallback(callbackRef.current);
        callbackRef.current = null;
      }
      
      await notificationService.stopListening();
      setIsConnected(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('❌ Erro ao parar serviço de notificações:', err);
    }
  }, [isConnected]);

  // Carregar notificações recentes
  const loadRecentNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const recentNotifications = await notificationService.getRecentNotifications(maxNotifications);
      setNotifications(recentNotifications);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar notificações';
      setError(errorMessage);
      console.error('❌ Erro ao carregar notificações recentes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [maxNotifications]);

  // Limpar notificações
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setReadNotifications(new Set());
  }, []);

  // Marcar como lida
  const markAsRead = useCallback((notificationId: string) => {
    setReadNotifications(prev => new Set([...prev, notificationId]));
  }, []);

  // Confirmar notificação
  const confirmNotification = useCallback(async (visitorLogId: string, porteirId: string): Promise<boolean> => {
    try {
      const success = await notificationService.confirmNotification(visitorLogId, porteirId);
      if (success) {
        // Marcar como lida automaticamente após confirmação
        markAsRead(visitorLogId);
      }
      return success;
    } catch (err) {
      console.error('❌ Erro ao confirmar notificação:', err);
      return false;
    }
  }, [markAsRead]);

  // Calcular notificações não lidas
  const unreadCount = notifications.filter(n => !readNotifications.has(n.visitor_log_id)).length;

  // Efeito para auto-start
  useEffect(() => {
    if (autoStart) {
      startListening();
    }

    // Cleanup ao desmontar
    return () => {
      if (callbackRef.current) {
        notificationService.removeCallback(callbackRef.current);
      }
    };
  }, [autoStart, startListening]);

  // Monitorar status de conexão do serviço
  useEffect(() => {
    const checkConnection = () => {
      const serviceConnected = notificationService.isServiceConnected();
      if (serviceConnected !== isConnected) {
        setIsConnected(serviceConnected);
      }
    };

    const interval = setInterval(checkConnection, 5000); // Verificar a cada 5 segundos
    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    notifications,
    isConnected,
    isLoading,
    error,
    startListening,
    stopListening,
    clearNotifications,
    markAsRead,
    confirmNotification,
    loadRecentNotifications,
    unreadCount
  };
}

/**
 * Hook simplificado para apenas escutar notificações
 * Útil quando você só precisa reagir a novas notificações sem gerenciar estado
 */
export function useNotificationListener(callback: NotificationCallback, autoStart: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef<NotificationCallback | null>(null);

  useEffect(() => {
    if (!autoStart) return;

    const startService = async () => {
      try {
        callbackRef.current = callback;
        notificationService.addCallback(callback);
        await notificationService.startListening();
        setIsConnected(true);
      } catch (error) {
        console.error('❌ Erro ao iniciar listener de notificações:', error);
      }
    };

    startService();

    return () => {
      if (callbackRef.current) {
        notificationService.removeCallback(callbackRef.current);
      }
    };
  }, [callback, autoStart]);

  return { isConnected };
}