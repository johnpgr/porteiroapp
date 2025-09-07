import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { useNotifications } from './useNotifications';
import { useReminderScheduler } from './useReminderScheduler';
import { useNotificationLogger } from './useNotificationLogger';
import { useTimeValidator } from './useTimeValidator';

export interface Lembrete {
  id: string;
  titulo: string;
  descricao?: string;
  data_vencimento: string;
  categoria: 'reuniao' | 'manutencao' | 'pagamento' | 'assembleia' | 'outros';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'concluido' | 'cancelado';
  antecedencia_alerta: number;
  sindico_id: string;
  created_at: string;
  updated_at: string;
}

export interface LembreteHistorico {
  id: string;
  lembrete_id: string;
  acao: 'criado' | 'editado' | 'concluido' | 'cancelado' | 'notificado';
  detalhes?: string;
  sindico_id: string;
  created_at: string;
}

export interface CreateLembreteData {
  titulo: string;
  descricao?: string;
  data_vencimento: string;
  categoria: 'reuniao' | 'manutencao' | 'pagamento' | 'assembleia' | 'outros';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  antecedencia_alerta?: number;
}

export interface UpdateLembreteData {
  titulo?: string;
  descricao?: string;
  data_vencimento?: string;
  categoria?: 'reuniao' | 'manutencao' | 'pagamento' | 'assembleia' | 'outros';
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
  status?: 'pendente' | 'concluido' | 'cancelado';
  antecedencia_alerta?: number;
}

export function useLembretes() {
  const { user } = useAuth();
  const { scheduleNotification, cancelNotification } = useNotifications();
  const { registerReminder, unregisterReminder, getSchedulerStats } = useReminderScheduler();
  const { logScheduled, logCancelled, loggerStats, generateDebugReport } = useNotificationLogger();
  const { addValidationRule, removeRulesByLembrete, stats: validationStats } = useTimeValidator();
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para logs apenas de erros críticos
  const logError = useCallback((message: string, error?: any) => {
    if (__DEV__) {
      console.error(`[useLembretes] ${message}`, error || '');
    }
  }, []);

  // Calcular data de notificação baseada na antecedência
  const calculateNotificationDate = (dataVencimento: string, antecedenciaHoras: number): Date => {
    const vencimento = new Date(dataVencimento);
    const notificationDate = new Date(vencimento.getTime() - (antecedenciaHoras * 60 * 60 * 1000));
    return notificationDate;
  };

  // Agendar notificações duplas para um lembrete (horário exato + 15 min antes)
  const scheduleReminderNotification = useCallback(async (lembrete: Lembrete): Promise<void> => {
    try {
      const now = new Date();
      const dataVencimento = new Date(lembrete.data_vencimento);
      const notificationBefore = new Date(dataVencimento.getTime() - (15 * 60 * 1000));
      
      // Registrar no scheduler para monitoramento em tempo real
      registerReminder({
        id: lembrete.id,
        title: lembrete.titulo,
        body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`,
        exactTime: dataVencimento,
        beforeTime: notificationBefore,
        data: {
          lembreteId: lembrete.id,
          categoria: lembrete.categoria,
          prioridade: lembrete.prioridade
        }
      });
      
      // Notificação no horário exato
      if (dataVencimento > now) {
        await scheduleNotification({
          id: `lembrete_exact_${lembrete.id}`,
          title: `🔔 LEMBRETE: ${lembrete.titulo}`,
          body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`,
          triggerDate: dataVencimento,
          data: {
            lembreteId: lembrete.id,
            categoria: lembrete.categoria,
            prioridade: lembrete.prioridade,
            type: 'exact'
          }
        });
        
        // Log da notificação agendada
        await logScheduled({
          id: `lembrete_exact_${lembrete.id}`,
          lembreteId: lembrete.id,
          type: 'exact',
          scheduledTime: dataVencimento,
          title: lembrete.titulo,
          body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`
        });
        
        // Adicionar regra de validação
        addValidationRule({
          id: `lembrete_exact_${lembrete.id}`,
          lembreteId: lembrete.id,
          type: 'exact',
          scheduledTime: dataVencimento,
          title: lembrete.titulo,
          body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`,
          data: {
            lembreteId: lembrete.id,
            categoria: lembrete.categoria,
            prioridade: lembrete.prioridade,
            type: 'exact'
          }
        });
        
        console.log(`✅ Notificação EXATA agendada para ${lembrete.titulo} em ${dataVencimento.toLocaleString()}`);
      }

      // Notificação 15 minutos antes
      if (notificationBefore > now) {
        await scheduleNotification({
          id: `lembrete_before_${lembrete.id}`,
          title: `⏰ LEMBRETE EM 15 MIN: ${lembrete.titulo}`,
          body: `Em 15 minutos: ${lembrete.descricao || lembrete.categoria}`,
          triggerDate: notificationBefore,
          data: {
            lembreteId: lembrete.id,
            categoria: lembrete.categoria,
            prioridade: lembrete.prioridade,
            type: 'before_15min'
          }
        });
        
        // Log da notificação agendada
        await logScheduled({
          id: `lembrete_before_${lembrete.id}`,
          lembreteId: lembrete.id,
          type: 'before_15min',
          scheduledTime: notificationBefore,
          title: lembrete.titulo,
          body: `Em 15 minutos: ${lembrete.descricao || lembrete.categoria}`
        });
        
        // Adicionar regra de validação
        addValidationRule({
          id: `lembrete_before_${lembrete.id}`,
          lembreteId: lembrete.id,
          type: 'before_15min',
          scheduledTime: notificationBefore,
          title: lembrete.titulo,
          body: `Em 15 minutos: ${lembrete.descricao || lembrete.categoria}`,
          data: {
            lembreteId: lembrete.id,
            categoria: lembrete.categoria,
            prioridade: lembrete.prioridade,
            type: 'before_15min'
          }
        });
        
        console.log(`✅ Notificação 15MIN ANTES agendada para ${lembrete.titulo} em ${notificationBefore.toLocaleString()}`);
      }

      // Log de debug para o caso específico 12h35
      if (lembrete.titulo.includes('12:35') || lembrete.data_vencimento.includes('12:35')) {
        console.log(`🐛 DEBUG - Lembrete 12:35 detectado:`);
        console.log(`   - Data vencimento: ${dataVencimento.toLocaleString()}`);
        console.log(`   - Notificação 15min antes: ${notificationBefore.toLocaleString()}`);
        console.log(`   - Agora: ${now.toLocaleString()}`);
        console.log(`   - Notificação antes é futura: ${notificationBefore > now}`);
        console.log(`   - Registrado no scheduler para monitoramento em tempo real`);
      }
    } catch (error) {
      logError('Erro ao agendar notificações duplas:', error);
    }
  }, [registerReminder, scheduleNotification, logScheduled, addValidationRule]);

  // Cancelar ambas as notificações de um lembrete
  const cancelReminderNotification = useCallback(async (lembreteId: string): Promise<void> => {
    try {
      // Remover do scheduler
      unregisterReminder(lembreteId);
      
      // Remover regras de validação
      removeRulesByLembrete(lembreteId);
      
      // Cancelar notificações agendadas
      await cancelNotification(`lembrete_exact_${lembreteId}`);
      await cancelNotification(`lembrete_before_${lembreteId}`);
      
      // Log do cancelamento
      await logCancelled(lembreteId);
      
      console.log(`✅ Notificações canceladas para lembrete ${lembreteId} (exata + 15min antes + scheduler + validação)`);
    } catch (error) {
      logError('Erro ao cancelar notificações:', error);
    }
  }, [unregisterReminder, removeRulesByLembrete, cancelNotification, logCancelled]);

  // Reagendar notificações para lembretes pendentes
  const rescheduleNotifications = useCallback(async (lembretes: Lembrete[]): Promise<void> => {
    try {
      const lembretesPendentes = lembretes.filter(lembrete => lembrete.status === 'pendente');
      
      for (const lembrete of lembretesPendentes) {
        await scheduleReminderNotification(lembrete);
      }
      
      console.log(`${lembretesPendentes.length} notificações reagendadas`);
    } catch (error) {
      logError('Erro ao reagendar notificações:', error);
    }
  }, [scheduleReminderNotification]);

  // Carregar lembretes
  const loadLembretes = useCallback(async () => {
    if (!user || user.user_type !== 'admin') {
      setLembretes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('lembretes')
        .select('*')
        .eq('sindico_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const lembretes = data || [];
      setLembretes(lembretes);
      
      // Reagendar notificações para lembretes pendentes
      await rescheduleNotifications(lembretes);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar lembretes';
      setError(errorMessage);
      logError('Erro ao carregar lembretes:', err);
    } finally {
      setLoading(false);
    }
  }, [user, rescheduleNotifications]);

  // Criar lembrete
  const createLembrete = useCallback(async (data: CreateLembreteData): Promise<{ success: boolean; error?: string; lembrete?: Lembrete }> => {
    if (!user || user.user_type !== 'admin') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const lembreteData = {
        ...data,
        sindico_id: user.id,
        status: 'pendente' as const,
        antecedencia_alerta: data.antecedencia_alerta || 24
      };

      const { data: newLembrete, error: createError } = await supabase
        .from('lembretes')
        .insert([lembreteData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Adicionar ao histórico
      await supabase
        .from('lembrete_historico')
        .insert({
          lembrete_id: newLembrete.id,
          acao: 'criado',
          detalhes: `Lembrete "${data.titulo}" criado`,
          sindico_id: user.id
        });

      // Agendar notificação para o novo lembrete
      await scheduleReminderNotification(newLembrete);

      // Atualizar lista local
      setLembretes(prev => [...prev, newLembrete].sort((a, b) => 
        new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
      ));

      return { success: true, lembrete: newLembrete };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar lembrete';
      logError('Erro ao criar lembrete:', err);
      return { success: false, error: errorMessage };
    }
  }, [user, cancelReminderNotification, scheduleReminderNotification]);

  // Atualizar lembrete
  const updateLembrete = useCallback(async (id: string, data: UpdateLembreteData): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'admin') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { data: updatedLembrete, error: updateError } = await supabase
        .from('lembretes')
        .update(data)
        .eq('id', id)
        .eq('sindico_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Adicionar ao histórico
      const acao = data.status === 'concluido' ? 'concluido' : 
                   data.status === 'cancelado' ? 'cancelado' : 'editado';
      
      await supabase
        .from('lembrete_historico')
        .insert({
          lembrete_id: id,
          acao,
          detalhes: `Lembrete atualizado`,
          sindico_id: user.id
        });

      // Cancelar notificação anterior e agendar nova se necessário
      await cancelReminderNotification(id);
      
      // Se o lembrete ainda está pendente, reagendar notificação
      if (updatedLembrete.status === 'pendente') {
        await scheduleReminderNotification(updatedLembrete);
      }

      // Atualizar lista local
      setLembretes(prev => 
        prev.map(lembrete => 
          lembrete.id === id ? updatedLembrete : lembrete
        ).sort((a, b) => 
          new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
        )
      );

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao atualizar lembrete';
      logError('Erro ao atualizar lembrete:', err);
      return { success: false, error: errorMessage };
    }
  }, [user, cancelReminderNotification]);

  // Deletar lembrete
  const deleteLembrete = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'admin') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('lembretes')
        .delete()
        .eq('id', id)
        .eq('sindico_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      // Cancelar notificação do lembrete deletado
      await cancelReminderNotification(id);

      // Remover da lista local
      setLembretes(prev => prev.filter(lembrete => lembrete.id !== id));

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao deletar lembrete';
      logError('Erro ao deletar lembrete:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Obter lembrete por ID
  const getLembreteById = useCallback(async (id: string): Promise<{ success: boolean; lembrete?: Lembrete; error?: string }> => {
    if (!user || user.user_type !== 'admin') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('lembretes')
        .select('*')
        .eq('id', id)
        .eq('sindico_id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, lembrete: data };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao buscar lembrete';
      logError('Erro ao buscar lembrete:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Obter histórico de um lembrete
  const getLembreteHistorico = useCallback(async (lembreteId: string): Promise<{ success: boolean; historico?: LembreteHistorico[]; error?: string }> => {
    if (!user || user.user_type !== 'admin') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('lembrete_historico')
        .select('*')
        .eq('lembrete_id', lembreteId)
        .order('data_acao', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, historico: data || [] };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao buscar histórico';
      logError('Erro ao buscar histórico:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Filtrar lembretes por status
  const getLembretesByStatus = useCallback((status: 'pendente' | 'concluido' | 'cancelado') => {
    return lembretes.filter(lembrete => lembrete.status === status);
  }, [lembretes]);

  // Filtrar lembretes por prioridade
  const getLembretesByPrioridade = useCallback((prioridade: 'baixa' | 'media' | 'alta' | 'urgente') => {
    return lembretes.filter(lembrete => lembrete.prioridade === prioridade);
  }, [lembretes]);

  // Filtrar lembretes por categoria
  const getLembretesByCategoria = useCallback((categoria: 'reuniao' | 'manutencao' | 'pagamento' | 'assembleia' | 'outros') => {
    return lembretes.filter(lembrete => lembrete.categoria === categoria);
  }, [lembretes]);

  // Obter lembretes próximos (próximos 7 dias)
  const getLembretesProximos = useCallback(() => {
    const agora = new Date();
    const proximosSete = new Date();
    proximosSete.setDate(agora.getDate() + 7);

    return lembretes.filter(lembrete => {
      const dataVencimento = new Date(lembrete.data_vencimento);
      return dataVencimento >= agora && dataVencimento <= proximosSete && lembrete.status === 'pendente';
    });
  }, [lembretes]);

  // Carregar lembretes quando o usuário muda
  useEffect(() => {
    loadLembretes();
  }, [loadLembretes]);

  // Subscription para atualizações em tempo real
  useEffect(() => {
    if (!user || user.user_type !== 'admin') return;

    const subscription = supabase
      .channel('lembretes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lembretes',
          filter: `sindico_id=eq.${user.id}`
        },
        () => {
          // Recarregar lembretes quando houver mudanças
          loadLembretes();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, loadLembretes]);

  return {
    lembretes,
    loading,
    error,
    createLembrete,
    updateLembrete,
    deleteLembrete,
    getLembreteById,
    getLembreteHistorico,
    getLembretesByStatus,
    getLembretesByPrioridade,
    getLembretesByCategoria,
    getLembretesProximos,
    refreshLembretes: loadLembretes,rescheduleNotifications,
    // Estatísticas e debug
    notificationStats: loggerStats,
    validationStats,
    generateNotificationReport: generateDebugReport
  };
}