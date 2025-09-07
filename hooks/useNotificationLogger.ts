import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationLog {
  id: string;
  lembreteId: string;
  type: 'exact' | 'before_15min' | 'fallback';
  scheduledTime: Date;
  actualTriggerTime?: Date;
  status: 'scheduled' | 'triggered' | 'missed' | 'cancelled';
  title: string;
  body: string;
  error?: string;
  deviceInfo?: {
    appState: string;
    batteryOptimized?: boolean;
    notificationPermission: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStats {
  total: number;
  triggered: number;
  missed: number;
  cancelled: number;
  successRate: number;
  missedInLast24h: number;
}

const STORAGE_KEY = 'notification_logs';
const MAX_LOGS = 1000; // Manter apenas os últimos 1000 logs

export function useNotificationLogger() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const logsRef = useRef<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    triggered: 0,
    missed: 0,
    cancelled: 0,
    successRate: 0,
    missedInLast24h: 0
  });

  // manter ref sincronizada
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Carregar logs do storage
  const calculateStats = useCallback((logList: NotificationLog[]) => {
    const now = new Date();
    const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const total = logList.length;
    const triggered = logList.filter(log => log.status === 'triggered').length;
    const missed = logList.filter(log => log.status === 'missed').length;
    const cancelled = logList.filter(log => log.status === 'cancelled').length;
    const missedInLast24h = logList.filter(log => 
      log.status === 'missed' && log.updatedAt > last24h
    ).length;
    
    const successRate = total > 0 ? (triggered / (total - cancelled || 1)) * 100 : 0;
    
    setStats({
      total,
      triggered,
      missed,
      cancelled,
      successRate: Math.round(successRate * 100) / 100,
      missedInLast24h
    });
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const storedLogs = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedLogs) {
        const parsedLogs: NotificationLog[] = JSON.parse(storedLogs).map((log: any) => ({
          ...log,
          scheduledTime: new Date(log.scheduledTime),
          actualTriggerTime: log.actualTriggerTime ? new Date(log.actualTriggerTime) : undefined,
          createdAt: new Date(log.createdAt),
          updatedAt: new Date(log.updatedAt)
        }));
        setLogs(parsedLogs);
        calculateStats(parsedLogs);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar logs de notificação:', error);
    }
  }, [calculateStats]);

  // Salvar logs no storage
  const saveLogs = useCallback(async (newLogs: NotificationLog[]) => {
    try {
      const logsToSave = newLogs.slice(-MAX_LOGS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logsToSave));
    } catch (error) {
      console.error('❌ Erro ao salvar logs de notificação:', error);
    }
  }, []);

  // Registrar agendamento de notificação (estável)
  const logScheduled = useCallback(async ({
    id,
    lembreteId,
    type,
    scheduledTime,
    title,
    body
  }: {
    id: string;
    lembreteId: string;
    type: 'exact' | 'before_15min';
    scheduledTime: Date;
    title: string;
    body: string;
  }) => {
    const newLog: NotificationLog = {
      id,
      lembreteId,
      type,
      scheduledTime,
      status: 'scheduled',
      title,
      body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedLogs = [...logsRef.current, newLog];
    setLogs(updatedLogs);
    calculateStats(updatedLogs);
    await saveLogs(updatedLogs);

    console.log(`📝 LOG: Notificação agendada - ${type} para ${lembreteId} em ${scheduledTime.toLocaleString()}`);
  }, [saveLogs, calculateStats]);

  // Registrar disparo de notificação (estável)
  const logTriggered = useCallback(async (notificationId: string) => {
    const updatedLogs = logsRef.current.map(log => {
      if (log.id === notificationId) {
        return {
          ...log,
          status: 'triggered' as const,
          actualTriggerTime: new Date(),
          updatedAt: new Date()
        };
      }
      return log;
    });

    setLogs(updatedLogs);
    calculateStats(updatedLogs);
    await saveLogs(updatedLogs);

    console.log(`✅ LOG: Notificação disparada - ${notificationId}`);
  }, [saveLogs, calculateStats]);

  // Registrar notificação perdida (estável)
  const logMissed = useCallback(async (notificationId: string, error?: string) => {
    const updatedLogs = logsRef.current.map(log => {
      if (log.id === notificationId) {
        return {
          ...log,
          status: 'missed' as const,
          error,
          updatedAt: new Date()
        };
      }
      return log;
    });

    setLogs(updatedLogs);
    calculateStats(updatedLogs);
    await saveLogs(updatedLogs);

    console.warn(`⚠️ LOG: Notificação perdida - ${notificationId}${error ? `: ${error}` : ''}`);
  }, [saveLogs, calculateStats]);

  // Registrar cancelamento (estável)
  const logCancelled = useCallback(async (lembreteId: string) => {
    const updatedLogs = logsRef.current.map(log => {
      if (log.lembreteId === lembreteId && log.status === 'scheduled') {
        return {
          ...log,
          status: 'cancelled' as const,
          updatedAt: new Date()
        };
      }
      return log;
    });

    setLogs(updatedLogs);
    calculateStats(updatedLogs);
    await saveLogs(updatedLogs);

    console.log(`🚫 LOG: Notificações canceladas para lembrete ${lembreteId}`);
  }, [saveLogs, calculateStats]);

  // Registrar disparo de fallback (estável)
  const logFallbackTriggered = useCallback(async ({
    lembreteId,
    type,
    title,
    body,
    originalScheduledTime
  }: {
    lembreteId: string;
    type: 'exact' | 'before_15min';
    title: string;
    body: string;
    originalScheduledTime: Date;
  }) => {
    const fallbackLog: NotificationLog = {
      id: `fallback_${type}_${lembreteId}_${Date.now()}`,
      lembreteId,
      type: 'fallback',
      scheduledTime: originalScheduledTime,
      actualTriggerTime: new Date(),
      status: 'triggered',
      title: `[FALLBACK] ${title}`,
      body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedLogs = [...logsRef.current, fallbackLog];
    setLogs(updatedLogs);
    calculateStats(updatedLogs);
    await saveLogs(updatedLogs);

    console.log(`🔄 LOG: Fallback disparado para ${lembreteId} - ${type}`);
  }, [saveLogs, calculateStats]);

  // Obter logs de um lembrete específico
  const getLogsByLembrete = useCallback((lembreteId: string) => {
    return logs.filter(log => log.lembreteId === lembreteId);
  }, [logs]);

  // Obter logs perdidos nas últimas 24h
  const getMissedLogsLast24h = useCallback(() => {
    const last24h = new Date(Date.now() - (24 * 60 * 60 * 1000));
    return logs.filter(log => 
      log.status === 'missed' && log.updatedAt > last24h
    );
  }, [logs]);

  // Limpar logs antigos
  const clearOldLogs = useCallback(async (daysToKeep: number = 30) => {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    const filteredLogs = logsRef.current.filter(log => log.createdAt > cutoffDate);
    
    setLogs(filteredLogs);
    calculateStats(filteredLogs);
    await saveLogs(filteredLogs);
    
    console.log(`🧹 LOG: Logs antigos removidos. Mantidos ${filteredLogs.length} logs dos últimos ${daysToKeep} dias`);
  }, [saveLogs, calculateStats]);

  // Exportar relatório de debug
  const generateDebugReport = useCallback(() => {
    const report = {
      stats,
      last10Logs: logs.slice(-10),
    };
    console.log('📊 RELATÓRIO DE DEBUG:', JSON.stringify(report, null, 2));
    return report;
  }, [logs, stats]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return {
    logs,
    stats,
    loggerStats: stats,
    logScheduled,
    logTriggered,
    logMissed,
    logCancelled,
    logFallbackTriggered,
    getLogsByLembrete,
    getMissedLogsLast24h,
    clearOldLogs,
    generateDebugReport
  };
}