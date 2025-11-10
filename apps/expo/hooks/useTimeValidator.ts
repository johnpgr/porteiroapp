import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationLogger } from './useNotificationLogger';

interface ValidationRule {
  id: string; // deve corresponder ao identificador da notificação agendada
  lembreteId: string;
  type: 'exact' | 'before_15min';
  scheduledTime: Date;
  title: string;
  body: string;
  data?: any;
}

interface ValidationStats {
  totalRules: number;
  validatedCount: number;
  missedCount: number;
  emergencyTriggered: number;
  lastValidation: Date | null;
}

export function useTimeValidator() {
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [validationStats, setValidationStats] = useState<ValidationStats>({
    totalRules: 0,
    validatedCount: 0,
    missedCount: 0,
    emergencyTriggered: 0,
    lastValidation: null,
  });
  const [isValidating, setIsValidating] = useState(false);
  const validationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  
  const { logMissed, logFallbackTriggered } = useNotificationLogger();

  const addValidationRule = useCallback((rule: ValidationRule) => {
    setValidationRules(prev => {
      const filtered = prev.filter(r => r.id !== rule.id);
      return [...filtered, rule];
    });
    setValidationStats(prev => ({ ...prev, totalRules: prev.totalRules + 1 }));
  }, []);

  const removeValidationRule = useCallback((ruleId: string) => {
    setValidationRules(prev => prev.filter(r => r.id !== ruleId));
  }, []);

  const removeRulesByLembrete = useCallback((lembreteId: string) => {
    setValidationRules(prev => prev.filter(r => r.lembreteId !== lembreteId));
  }, []);

  // Validação crítica inline para evitar dependências instáveis
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (validationRules.length > 0) {
      const validate = async () => {
        if (validationRules.length === 0) return;
        
        const now = new Date();
        const criticalWindow = 2 * 60 * 1000; // 2 minutos
        
        for (const rule of validationRules) {
          const timeDiff = rule.scheduledTime.getTime() - now.getTime();
          
          // Considera como perdida se já passou de 1 minuto
          if (timeDiff < -60000) {
            await logMissed(rule.id, `missed_by_validator: scheduled=${rule.scheduledTime.toISOString()} now=${now.toISOString()}`);
            setValidationStats(prev => ({ ...prev, missedCount: prev.missedCount + 1 }));
            setValidationRules(prev => prev.filter(r => r.id !== rule.id));
            continue;
          }
          
          // Janela crítica: entre -1min e +2min
          if (timeDiff <= criticalWindow && timeDiff > -60000) {
            try {
              const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
              // Checar por customId usado no agendamento
              const hasScheduled = scheduledNotifications.some(req => (req as any)?.content?.data?.customId === rule.id);
              
              if (!hasScheduled) {
                // Agendar notificação de emergência (fallback)
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `⚠️ ${rule.title}`,
                    body: `${rule.body} (Disparo de emergência)`,
                    sound: true,
                    data: { ...(rule.data || {}), customId: rule.id, fallback: true },
                  },
                  trigger: { seconds: 1 } as any,
                });
                
                await logFallbackTriggered({
                  lembreteId: rule.lembreteId,
                  type: rule.type,
                  title: rule.title,
                  body: rule.body,
                  originalScheduledTime: rule.scheduledTime,
                });
                setValidationStats(prev => ({ ...prev, emergencyTriggered: prev.emergencyTriggered + 1 }));
              }
            } catch (e) {
              // Melhor esforço: apenas registra erro no console
              console.warn('Erro ao verificar/agendar fallback de validação:', e);
            }
          }
        }
        
        setValidationStats(prev => ({ ...prev, validatedCount: prev.validatedCount + 1, lastValidation: now }));
      };

      interval = setInterval(validate, 30000);
      setIsValidating(true);
    } else {
      setIsValidating(false);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [validationRules.length, logMissed, logFallbackTriggered]);

  return {
    stats: validationStats,
    validationStats,
    isValidating,
    addValidationRule,
    removeValidationRule,
    removeRulesByLembrete,
  };
}