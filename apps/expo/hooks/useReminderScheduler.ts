import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
// PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
// import { useNotifications } from './useNotifications';
// import { useNotificationLogger } from './useNotificationLogger';

interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  exactTime?: Date;
  beforeTime?: Date;
  data: any;
  registeredAt?: Date;
}

/**
 * Hook para verificação em tempo real e agendamento confiável de lembretes
 * Implementa sistema de fallback para garantir disparos pontuais
 */
export const useReminderScheduler = () => {
  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const { scheduleNotification, getScheduledNotifications } = useNotifications();
  // const { 
  //   logFallbackTriggered,
  //   stats,
  //   generateDebugReport 
  // } = useNotificationLogger();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scheduledReminders = useRef<Map<string, ScheduledReminder>>(new Map());
  const lastCheck = useRef<Date>(new Date());

  // Log de debug com timestamp
  const debugLog = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleString();
    console.log(`🕐 [SCHEDULER ${timestamp}] ${message}`, data || '');
  };

  // Verificar se uma notificação deve ser disparada agora
  const shouldTriggerNow = (targetTime: Date, tolerance: number = 15000): boolean => {
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    
    // Não disparar se o horário alvo ainda não chegou
    if (now < targetTime) {
      return false;
    }
    
    // Só disparar se estiver dentro da tolerância E o horário já passou
    return timeDiff <= tolerance && now >= targetTime;
  };

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const triggerImmediateNotification = async (reminder: ScheduledReminder, type: 'exact' | 'before') => {
  //   try {
  //     const title = `Lembrete: ${reminder.title}`;
  //     const body = reminder.body;

  //     await scheduleNotification({
  //       id: `immediate_${type}_${reminder.id}_${Date.now()}`,
  //       title,
  //       body,
  //       triggerDate: new Date(Date.now() + 1000), // 1 segundo no futuro
  //       data: { ...reminder.data, type, immediate: true }
  //     });

  //     debugLog(`✅ Notificação ${type} disparada imediatamente para: ${reminder.title}`);
  //   } catch (error) {
  //     debugLog(`❌ Erro ao disparar notificação imediata:`, error);
  //   }
  // };
  const triggerImmediateNotification = async (reminder: ScheduledReminder, type: 'exact' | 'before') => {
    // Função temporariamente desativada
    debugLog(`Notificação ${type} seria disparada para: ${reminder.title}`);
  };

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const checkPendingReminders = useCallback(async () => {
  //   const now = new Date();
  //   debugLog(`Verificando lembretes pendentes...`);

  //   try {
  //     // Verificar notificações agendadas no sistema
  //     const systemScheduled = await getScheduledNotifications();
  //     debugLog(`Notificações no sistema: ${systemScheduled.length}`);

  //     // Verificar cada lembrete registrado
  //     for (const [reminderId, reminder] of scheduledReminders.current) {
  //       let shouldRemove = false;
        
  //       // Verificar se o lembrete foi registrado há menos de 2 minutos (evitar disparo imediato)
  //       const registeredAt = reminder.registeredAt?.getTime() ?? now.getTime();
  //       const reminderAge = now.getTime() - registeredAt;
  //       if (reminderAge < 120000) { // 2 minutos
  //         debugLog(`⏳ Lembrete muito recente, aguardando: ${reminder.title}`);
  //         continue;
  //       }
        
  //       const customId = `lembrete_${reminder.id}`;
  //       const hasSystemScheduled = systemScheduled.some(req => (req as any)?.content?.data?.customId === customId);
        
  //       // Verificar notificação antecipada (se configurada)
  //       if (reminder.beforeTime && shouldTriggerNow(reminder.beforeTime)) {
  //         if (!hasSystemScheduled) {
  //           debugLog(`🚨 Disparando notificação antecipada (fallback) para: ${reminder.title}`);
  //           await triggerImmediateNotification(reminder, 'before');
  //           await logFallbackTriggered({
  //             lembreteId: reminder.id,
  //             type: 'before',
  //             title: reminder.title,
  //             body: reminder.body,
  //             originalScheduledTime: reminder.beforeTime
  //           });
  //         } else {
  //           debugLog(`⏭️ Sistema já possui notificação agendada para ${reminder.title} (antes). Evitando fallback.`);
  //         }
  //         shouldRemove = true;
  //       }
  //       // Verificar notificação no horário exato (apenas se não disparou antecipada)
  //       else if (reminder.exactTime && shouldTriggerNow(reminder.exactTime)) {
  //         if (!hasSystemScheduled) {
  //           debugLog(`🚨 Disparando notificação exata (fallback) para: ${reminder.title}`);
  //           await triggerImmediateNotification(reminder, 'exact');
  //           await logFallbackTriggered({
  //             lembreteId: reminder.id,
  //             type: 'exact',
  //             title: reminder.title,
  //             body: reminder.body,
  //             originalScheduledTime: reminder.exactTime
  //           });
  //         } else {
  //           debugLog(`⏭️ Sistema já possui notificação agendada para ${reminder.title} (exata). Evitando fallback.`);
  //         }
  //         shouldRemove = true;
  //       }
        
  //       // Remover lembrete após disparo ou decisão
  //       if (shouldRemove) {
  //         scheduledReminders.current.delete(reminderId);
  //       }

  //       // Remover lembretes muito antigos (mais de 1 hora passados)
  //       const baseTime = reminder.exactTime || reminder.beforeTime;
  //       if (baseTime && now.getTime() - baseTime.getTime() > 3600000) {
  //         scheduledReminders.current.delete(reminderId);
  //         debugLog(`🗑️ Removido lembrete expirado: ${reminder.title}`);
  //       }
  //     }

  //     lastCheck.current = now;
  //   } catch (error) {
  //     debugLog(`❌ Erro na verificação de lembretes:`, error);
  //   }
  // }, [getScheduledNotifications, scheduleNotification]);
  const checkPendingReminders = useCallback(async () => {
    // Função temporariamente desativada
    debugLog('Verificação de lembretes pendentes temporariamente desativada');
  }, []);

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const registerReminder = useCallback(async (reminder: ScheduledReminder) => {
  //   scheduledReminders.current.set(reminder.id, { ...reminder, registeredAt: new Date() });
    
  //   // Apenas registrar internamente para monitoramento; evitar duplicar logs aqui
  //   debugLog(`📝 Lembrete registrado para monitoramento:`, {
  //     id: reminder.id,
  //     title: reminder.title,
  //     exactTime: reminder.exactTime?.toLocaleString?.() || '—',
  //     beforeTime: reminder.beforeTime?.toLocaleString?.() || '—'
  //   });
  // }, []);
  const registerReminder = useCallback(async (reminder: ScheduledReminder) => {
    // Função temporariamente desativada
    debugLog(`Registro de lembrete temporariamente desativado: ${reminder.title}`);
  }, []);

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const unregisterReminder = useCallback((reminderId: string) => {
  //   const removed = scheduledReminders.current.delete(reminderId);
  //   if (removed) {
  //     debugLog(`🗑️ Lembrete removido do monitoramento: ${reminderId}`);
  //   }
  // }, []);
  const unregisterReminder = useCallback((reminderId: string) => {
    // Função temporariamente desativada
    debugLog(`Cancelamento de monitoramento temporariamente desativado: ${reminderId}`);
  }, []);

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const startRealTimeMonitoring = useCallback(() => {
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current);
  //   }

  //   debugLog('🚀 Iniciando monitoramento em tempo real (verificação a cada 30s)');
    
  //   // Verificação inicial
  //   checkPendingReminders();
    
  //   // Verificação periódica a cada 30 segundos
  //   intervalRef.current = setInterval(() => {
  //     checkPendingReminders();
  //   }, 30000);
  // }, [checkPendingReminders]);
  const startRealTimeMonitoring = useCallback(() => {
    // Função temporariamente desativada
    debugLog('Monitoramento em tempo real temporariamente desativado');
  }, []);

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // const stopRealTimeMonitoring = useCallback(() => {
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current);
  //     intervalRef.current = null;
  //     debugLog('⏹️ Monitoramento em tempo real parado');
  //   }
  // }, []);
  const stopRealTimeMonitoring = useCallback(() => {
    // Função temporariamente desativada
    debugLog('Parada de monitoramento temporariamente desativada');
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
        // Aguardar 5 segundos antes de verificar para evitar disparos imediatos
        setTimeout(() => {
          checkPendingReminders();
        }, 5000);
        intervalRef.current = setInterval(() => {
          checkPendingReminders();
        }, 30000);
      } else if (nextAppState === 'background') {
        debugLog('📱 App foi para segundo plano - mantendo monitoramento');
        // Manter monitoramento ativo mesmo em background
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Iniciar monitoramento quando o hook é montado (sem verificação imediata)
    debugLog('🚀 Iniciando monitoramento em tempo real (verificação a cada 30s)');
    // Aguardar 30 segundos antes da primeira verificação para evitar disparos imediatos
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