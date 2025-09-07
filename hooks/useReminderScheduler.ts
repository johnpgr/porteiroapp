import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useNotifications } from './useNotifications';
import { useNotificationLogger } from './useNotificationLogger';

interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  exactTime: Date;
  beforeTime: Date;
  data: any;
}

/**
 * Hook para verificação em tempo real e agendamento confiável de lembretes
 * Implementa sistema de fallback para garantir disparos pontuais
 */
export const useReminderScheduler = () => {
  const { scheduleNotification, getScheduledNotifications } = useNotifications();
  const { 
    logFallbackTriggered,
    stats,
    generateDebugReport 
  } = useNotificationLogger();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scheduledReminders = useRef<Map<string, ScheduledReminder>>(new Map());
  const lastCheck = useRef<Date>(new Date());

  // Log de debug com timestamp
  const debugLog = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleString();
    console.log(`🕐 [SCHEDULER ${timestamp}] ${message}`, data || '');
  };

  // Verificar se uma notificação deve ser disparada agora
  const shouldTriggerNow = (targetTime: Date, tolerance: number = 30000): boolean => {
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    return timeDiff <= tolerance && now >= targetTime;
  };

  // Disparar notificação imediatamente (fallback)
  const triggerImmediateNotification = async (reminder: ScheduledReminder, type: 'exact' | 'before') => {
    try {
      const title = type === 'exact' 
        ? `🔔 LEMBRETE: ${reminder.title}`
        : `⏰ LEMBRETE EM 15 MIN: ${reminder.title}`;
      
      const body = type === 'exact'
        ? reminder.body
        : `Em 15 minutos: ${reminder.body}`;

      await scheduleNotification({
        id: `immediate_${type}_${reminder.id}_${Date.now()}`,
        title,
        body,
        triggerDate: new Date(Date.now() + 1000), // 1 segundo no futuro
        data: { ...reminder.data, type, immediate: true }
      });

      debugLog(`✅ Notificação ${type} disparada imediatamente para: ${reminder.title}`);
    } catch (error) {
      debugLog(`❌ Erro ao disparar notificação imediata:`, error);
    }
  };

  // Verificar lembretes pendentes e disparar se necessário
  const checkPendingReminders = useCallback(async () => {
    const now = new Date();
    debugLog(`Verificando lembretes pendentes...`);

    try {
      // Verificar notificações agendadas no sistema
      const systemScheduled = await getScheduledNotifications();
      debugLog(`Notificações no sistema: ${systemScheduled.length}`);

      // Verificar cada lembrete registrado
      for (const [reminderId, reminder] of scheduledReminders.current) {
        // Verificar notificação 15 minutos antes
        if (shouldTriggerNow(reminder.beforeTime)) {
          debugLog(`🚨 Disparando notificação 15min antes para: ${reminder.title}`);
          await triggerImmediateNotification(reminder, 'before');
          
          // Log do fallback
          await logFallbackTriggered({
            lembreteId: reminder.id,
            type: 'before_15min',
            title: reminder.title,
            body: reminder.body,
            originalScheduledTime: reminder.beforeTime
          });
        }

        // Verificar notificação no horário exato
        if (shouldTriggerNow(reminder.exactTime)) {
          debugLog(`🚨 Disparando notificação exata para: ${reminder.title}`);
          await triggerImmediateNotification(reminder, 'exact');
          
          // Log do fallback
          await logFallbackTriggered({
            lembreteId: reminder.id,
            type: 'exact',
            title: reminder.title,
            body: reminder.body,
            originalScheduledTime: reminder.exactTime
          });
          
          // Remover lembrete após disparo final
          scheduledReminders.current.delete(reminderId);
        }

        // Remover lembretes muito antigos (mais de 1 hora passados)
        if (now.getTime() - reminder.exactTime.getTime() > 3600000) {
          scheduledReminders.current.delete(reminderId);
          debugLog(`🗑️ Removido lembrete expirado: ${reminder.title}`);
        }
      }

      lastCheck.current = now;
    } catch (error) {
      debugLog(`❌ Erro na verificação de lembretes:`, error);
    }
  }, [getScheduledNotifications, scheduleNotification]);

  // Registrar um novo lembrete para monitoramento
  const registerReminder = useCallback(async (reminder: ScheduledReminder) => {
    scheduledReminders.current.set(reminder.id, reminder);
    
    // Apenas registrar internamente para monitoramento; evitar duplicar logs aqui
    debugLog(`📝 Lembrete registrado para monitoramento:`, {
      id: reminder.id,
      title: reminder.title,
      exactTime: reminder.exactTime.toLocaleString(),
      beforeTime: reminder.beforeTime.toLocaleString()
    });
  }, []);

  // Remover lembrete do monitoramento
  const unregisterReminder = useCallback((reminderId: string) => {
    const removed = scheduledReminders.current.delete(reminderId);
    if (removed) {
      debugLog(`🗑️ Lembrete removido do monitoramento: ${reminderId}`);
    }
  }, []);

  // Iniciar monitoramento em tempo real
  const startRealTimeMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    debugLog('🚀 Iniciando monitoramento em tempo real (verificação a cada 30s)');
    
    // Verificação inicial
    checkPendingReminders();
    
    // Verificação periódica a cada 30 segundos
    intervalRef.current = setInterval(() => {
      checkPendingReminders();
    }, 30000);
  }, [checkPendingReminders]);

  // Parar monitoramento
  const stopRealTimeMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      debugLog('⏹️ Monitoramento em tempo real parado');
    }
  }, []);

  // Obter estatísticas do scheduler
  const getSchedulerStats = useCallback(() => {
    return {
      activeReminders: scheduledReminders.current.size,
      lastCheck: lastCheck.current,
      isMonitoring: intervalRef.current !== null,
      reminders: Array.from(scheduledReminders.current.values())
    };
  }, []);

  // Configurar listeners para mudanças de estado do app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        debugLog('📱 App voltou ao primeiro plano - reiniciando monitoramento');
        // Usar ref para evitar dependência instável
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        checkPendingReminders();
        intervalRef.current = setInterval(() => {
          checkPendingReminders();
        }, 30000);
      } else if (nextAppState === 'background') {
        debugLog('📱 App foi para segundo plano - mantendo monitoramento');
        // Manter monitoramento ativo mesmo em background
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Iniciar monitoramento quando o hook é montado
    debugLog('🚀 Iniciando monitoramento em tempo real (verificação a cada 30s)');
    checkPendingReminders();
    intervalRef.current = setInterval(() => {
      checkPendingReminders();
    }, 30000);

    return () => {
      subscription?.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        debugLog('⏹️ Monitoramento em tempo real parado');
      }
    };
  }, []); // Array vazio - só executa uma vez

  return {
    registerReminder,
    unregisterReminder,
    startRealTimeMonitoring,
    stopRealTimeMonitoring,
    getSchedulerStats,
    checkPendingReminders,
    loggerStats: stats,
    generateDebugReport
  };
};