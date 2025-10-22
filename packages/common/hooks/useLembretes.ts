import { useState, useEffect, useCallback } from "react";
import type { TypedSupabaseClient } from "../supabase/core/client.ts";
// PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
// import { useNotifications } from './useNotifications';
// import { useReminderScheduler } from './useReminderScheduler';
// import { useNotificationLogger } from './useNotificationLogger';
// import { useTimeValidator } from './useTimeValidator';

//TODO: Fix the type issues in this file and use proper 'Lembrete' type from supabase types

export interface UseLembretesUser {
  id: string;
  user_type?: string;
}

export interface UseLembretesDeps {
  supabase: TypedSupabaseClient;
  getUser: () => UseLembretesUser | null;
}

export interface Lembrete {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_vencimento: string;
  categoria: "reuniao" | "manutencao" | "pagamento" | "assembleia" | "outros";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  status: "pendente" | "concluido" | "cancelado";
  antecedencia_alerta: number | null;
  sindico_id: string | null;
  building_admin_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LembreteHistorico {
  id: string;
  lembrete_id: string;
  acao: "criado" | "editado" | "concluido" | "cancelado" | "notificado";
  detalhes?: string | null;
  sindico_id: string | null;
  created_at: string | null;
}

export interface CreateLembreteData {
  titulo: string;
  descricao?: string | null;
  data_vencimento: string;
  categoria: "reuniao" | "manutencao" | "pagamento" | "assembleia" | "outros";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  antecedencia_alerta?: number | null;
  building_admin_id: string | null;
}

export interface UpdateLembreteData {
  titulo?: string;
  descricao?: string | null;
  data_vencimento?: string | null;
  categoria?: "reuniao" | "manutencao" | "pagamento" | "assembleia" | "outros";
  prioridade?: "baixa" | "media" | "alta" | "urgente";
  status?: "pendente" | "concluido" | "cancelado";
  antecedencia_alerta?: number | null;
}

/**
 * Factory function to create a useLembretes hook with injected dependencies
 * This allows the hook to work across different platforms (Expo, Next.js)
 * without coupling to platform-specific implementations
 */
export function createUseLembretes(deps: UseLembretesDeps) {
  return function useLembretes() {
    const user = deps.getUser();
    // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
    // const { scheduleNotification, cancelNotification } = useNotifications();
    // const { registerReminder, unregisterReminder, getSchedulerStats } = useReminderScheduler();
    // const { logScheduled, logCancelled, loggerStats, generateDebugReport } = useNotificationLogger();
    // const { addValidationRule, removeRulesByLembrete, stats: validationStats } = useTimeValidator();
    const [lembretes, setLembretes] = useState<Lembrete[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Função para logs apenas de erros críticos
    const logError = useCallback((message: string, error?: any) => {
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV === "development"
      ) {
        console.error(`[useLembretes] ${message}`, error || "");
      }
    }, []);

    // Calcular data de notificação baseada na antecedência
    const calculateNotificationDate = (
      dataVencimento: string,
      antecedenciaHoras: number,
    ): Date => {
      const vencimento = new Date(dataVencimento);
      const notificationDate = new Date(
        vencimento.getTime() - antecedenciaHoras * 60 * 60 * 1000,
      );
      return notificationDate;
    };

    // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
    // const scheduleReminderNotification = useCallback(async (lembrete: Lembrete): Promise<void> => {
    //   try {
    //     const now = new Date();
    //     const dataVencimento = new Date(lembrete.data_vencimento);

    //     // Calcular horário da notificação baseado na antecedência (em minutos)
    //     const antecedenciaMs = lembrete.antecedencia_alerta * 60 * 1000;
    //     const notificationTime = lembrete.antecedencia_alerta > 0
    //       ? new Date(dataVencimento.getTime() - antecedenciaMs)
    //       : dataVencimento;

    //     const notificationType = lembrete.antecedencia_alerta > 0 ? 'before' : 'exact';

    //     // Só agendar se a notificação for no futuro
    //     if (notificationTime > now) {
    //       // Registrar no scheduler para monitoramento em tempo real
    //       registerReminder({
    //         id: lembrete.id,
    //         title: lembrete.titulo,
    //         body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`,
    //         exactTime: notificationType === 'exact' ? dataVencimento : undefined,
    //         beforeTime: notificationType === 'before' ? notificationTime : undefined,
    //         data: {
    //           lembreteId: lembrete.id,
    //           categoria: lembrete.categoria,
    //           prioridade: lembrete.prioridade
    //         }
    //       });

    //       await scheduleNotification({
    //         id: `lembrete_${lembrete.id}`,
    //         title: `Lembrete: ${lembrete.titulo}`,
    //         body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`,
    //         triggerDate: notificationTime,
    //         data: {
    //           lembreteId: lembrete.id,
    //           categoria: lembrete.categoria,
    //           prioridade: lembrete.prioridade,
    //           type: notificationType
    //         }
    //       });

    //       // Log da notificação agendada
    //       await logScheduled({
    //         id: `lembrete_${lembrete.id}`,
    //         lembreteId: lembrete.id,
    //         type: notificationType,
    //         scheduledTime: notificationTime,
    //         title: lembrete.titulo,
    //         body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`
    //       });

    //       // Adicionar regra de validação
    //       addValidationRule({
    //         id: `lembrete_${lembrete.id}`,
    //         lembreteId: lembrete.id,
    //         type: notificationType,
    //         scheduledTime: notificationTime,
    //         title: lembrete.titulo,
    //         body: lembrete.descricao || `Categoria: ${lembrete.categoria} | Prioridade: ${lembrete.prioridade}`,
    //         data: {
    //           lembreteId: lembrete.id,
    //           categoria: lembrete.categoria,
    //           prioridade: lembrete.prioridade,
    //           type: notificationType
    //         }
    //       });

    //       console.log(`✅ Notificação agendada para ${lembrete.titulo} em ${notificationTime.toLocaleString()} (${notificationType})`);
    //     }
    //   } catch (error) {
    //     logError('Erro ao agendar notificação:', error);
    //   }
    // }, [registerReminder, scheduleNotification, logScheduled, addValidationRule]);
    const scheduleReminderNotification = useCallback(
      async (lembrete: Lembrete): Promise<void> => {
        // Função temporariamente desativada
        console.log(`Notificação seria agendada para: ${lembrete.titulo}`);
      },
      [],
    );

    // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
    // const cancelReminderNotification = useCallback(async (lembreteId: string): Promise<void> => {
    //   try {
    //     // Remover do scheduler
    //     unregisterReminder(lembreteId);
    //
    //     // Remover regras de validação
    //     removeRulesByLembrete(lembreteId);
    //
    //     // Cancelar notificação agendada
    //     await cancelNotification(`lembrete_${lembreteId}`);
    //
    //     // Log do cancelamento
    //     await logCancelled(lembreteId);
    //
    //     console.log(`✅ Notificação cancelada para lembrete ${lembreteId}`);
    //   } catch (error) {
    //     logError('Erro ao cancelar notificação:', error);
    //   }
    // }, [unregisterReminder, removeRulesByLembrete, cancelNotification, logCancelled]);
    const cancelReminderNotification = useCallback(
      async (lembreteId: string): Promise<void> => {
        // Função temporariamente desativada
        console.log(`Notificação seria cancelada para lembrete: ${lembreteId}`);
      },
      [],
    );

    // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
    // const rescheduleNotifications = useCallback(async (lembretes: Lembrete[]): Promise<void> => {
    //   try {
    //     const lembretesPendentes = lembretes.filter(lembrete => lembrete.status === 'pendente');
    //
    //     for (const lembrete of lembretesPendentes) {
    //       await scheduleReminderNotification(lembrete);
    //     }
    //
    //     console.log(`${lembretesPendentes.length} notificações reagendadas`);
    //   } catch (error) {
    //     logError('Erro ao reagendar notificações:', error);
    //   }
    // }, [scheduleReminderNotification]);
    const rescheduleNotifications = useCallback(
      async (lembretes: Lembrete[]): Promise<void> => {
        // Função temporariamente desativada
        console.log("Reagendamento de notificações temporariamente desativado");
      },
      [],
    );

    // Carregar lembretes
    const loadLembretes = useCallback(async () => {
      if (!user || user.user_type !== "admin") {
        setLembretes([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await deps.supabase
          .from("lembretes")
          .select("*")
          .eq("sindico_id", user.id)
          .order("data_vencimento", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        const lembretes = data || [];
        //@ts-expect-error fine for now
        setLembretes(lembretes);

        // Reagendar notificações para lembretes pendentes
        //@ts-expect-error fine for now
        await rescheduleNotifications(lembretes);
      } catch (err: any) {
        const errorMessage = err.message || "Erro ao carregar Notas";
        setError(errorMessage);
        logError("Erro ao carregar Notas:", err);
      } finally {
        setLoading(false);
      }
    }, [user, rescheduleNotifications]);

    // Criar lembrete
    const createLembrete = useCallback(
      async (
        data: CreateLembreteData,
      ): Promise<{ success: boolean; error?: string; lembrete?: Lembrete }> => {
        if (!user || user.user_type !== "admin") {
          return { success: false, error: "Usuário não autorizado" };
        }

        try {
          const lembreteData = {
            ...data,
            sindico_id: user.id,
            status: "pendente" as const,
            antecedencia_alerta: data.antecedencia_alerta || 24,
          };

          const { data: newLembrete, error: createError } = await deps.supabase
            .from("lembretes")
            .insert([lembreteData])
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          // Adicionar ao histórico
          await deps.supabase.from("lembrete_historico").insert({
            lembrete_id: newLembrete.id,
            acao: "criado",
            detalhes: `Lembrete "${data.titulo}" criado`,
            sindico_id: user.id,
          });

          // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
          // await scheduleReminderNotification(newLembrete);

          // Atualizar lista local
          //@ts-expect-error fine for now
          setLembretes((prev) =>
            [...prev, newLembrete].sort(
              (a, b) =>
                new Date(a.data_vencimento).getTime() -
                new Date(b.data_vencimento).getTime(),
            ),
          );

          //@ts-expect-error fine for now
          return { success: true, lembrete: newLembrete };
        } catch (err: any) {
          const errorMessage = err.message || "Erro ao criar lembrete";
          logError("Erro ao criar lembrete:", err);
          return { success: false, error: errorMessage };
        }
      },
      [user, cancelReminderNotification, scheduleReminderNotification],
    );

    // Atualizar lembrete
    const updateLembrete = useCallback(
      async (
        id: string,
        data: UpdateLembreteData,
      ): Promise<{ success: boolean; error?: string }> => {
        if (!user || user.user_type !== "admin") {
          return { success: false, error: "Usuário não autorizado" };
        }

        try {
          const { data: updatedLembrete, error: updateError } =
            await deps.supabase
              .from("lembretes")
              //@ts-expect-error fine for now
              .update(data)
              .eq("id", id)
              .eq("sindico_id", user.id)
              .select()
              .single();

          if (updateError) {
            throw updateError;
          }

          // Adicionar ao histórico
          const acao =
            data.status === "concluido"
              ? "concluido"
              : data.status === "cancelado"
                ? "cancelado"
                : "editado";

          await deps.supabase.from("lembrete_historico").insert({
            lembrete_id: id,
            acao,
            detalhes: `Nota atualizada`,
            sindico_id: user.id,
          });

          // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
          // await cancelReminderNotification(id);

          // Se o lembrete ainda está pendente, reagendar notificação
          // if (updatedLembrete.status === 'pendente') {
          //   await scheduleReminderNotification(updatedLembrete);
          // }

          // Atualizar lista local
          //@ts-expect-error fine for now
          setLembretes((prev) =>
            prev
              .map((lembrete) =>
                lembrete.id === id ? updatedLembrete : lembrete,
              )
              .sort(
                (a, b) =>
                  new Date(a.data_vencimento).getTime() -
                  new Date(b.data_vencimento).getTime(),
              ),
          );

          return { success: true };
        } catch (err: any) {
          const errorMessage = err.message || "Erro ao atualizar lembrete";
          logError("Erro ao atualizar lembrete:", err);
          return { success: false, error: errorMessage };
        }
      },
      [user],
    ); // cancelReminderNotification removido temporariamente

    // Deletar lembrete
    const deleteLembrete = useCallback(
      async (id: string): Promise<{ success: boolean; error?: string }> => {
        if (!user || user.user_type !== "admin") {
          return { success: false, error: "Usuário não autorizado" };
        }

        try {
          const { error: deleteError } = await deps.supabase
            .from("lembretes")
            .delete()
            .eq("id", id)
            .eq("sindico_id", user.id);

          if (deleteError) {
            throw deleteError;
          }

          // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
          // await cancelReminderNotification(id);

          // Remover da lista local
          setLembretes((prev) => prev.filter((lembrete) => lembrete.id !== id));

          return { success: true };
        } catch (err: any) {
          const errorMessage = err.message || "Erro ao deletar lembrete";
          logError("Erro ao deletar lembrete:", err);
          return { success: false, error: errorMessage };
        }
      },
      [user],
    );

    // Obter lembrete por ID
    const getLembreteById = useCallback(
      async (
        id: string,
      ): Promise<{ success: boolean; lembrete?: Lembrete; error?: string }> => {
        if (!user || user.user_type !== "admin") {
          return { success: false, error: "Usuário não autorizado" };
        }

        try {
          const { data, error: fetchError } = await deps.supabase
            .from("lembretes")
            .select("*")
            .eq("id", id)
            .eq("sindico_id", user.id)
            .single();

          if (fetchError) {
            throw fetchError;
          }

          //@ts-expect-error fine for now
          return { success: true, lembrete: data };
        } catch (err: any) {
          const errorMessage = err.message || "Erro ao buscar lembrete";
          logError("Erro ao buscar lembrete:", err);
          return { success: false, error: errorMessage };
        }
      },
      [user],
    );

    // Obter histórico de um lembrete
    const getLembreteHistorico = useCallback(
      async (
        lembreteId: string,
      ): Promise<{
        success: boolean;
        historico?: LembreteHistorico[];
        error?: string;
      }> => {
        if (!user || user.user_type !== "admin") {
          return { success: false, error: "Usuário não autorizado" };
        }

        try {
          const { data, error: fetchError } = await deps.supabase
            .from("lembrete_historico")
            .select("*")
            .eq("lembrete_id", lembreteId)
            .order("data_acao", { ascending: false });

          if (fetchError) {
            throw fetchError;
          }

          //@ts-expect-error fine for now
          return { success: true, historico: data || [] };
        } catch (err: any) {
          const errorMessage = err.message || "Erro ao buscar histórico";
          logError("Erro ao buscar histórico:", err);
          return { success: false, error: errorMessage };
        }
      },
      [user],
    );

    // Filtrar lembretes por status
    const getLembretesByStatus = useCallback(
      (status: "pendente" | "concluido" | "cancelado") => {
        return lembretes.filter((lembrete) => lembrete.status === status);
      },
      [lembretes],
    );

    // Filtrar lembretes por prioridade
    const getLembretesByPrioridade = useCallback(
      (prioridade: "baixa" | "media" | "alta" | "urgente") => {
        return lembretes.filter(
          (lembrete) => lembrete.prioridade === prioridade,
        );
      },
      [lembretes],
    );

    // Filtrar lembretes por categoria
    const getLembretesByCategoria = useCallback(
      (
        categoria:
          | "reuniao"
          | "manutencao"
          | "pagamento"
          | "assembleia"
          | "outros",
      ) => {
        return lembretes.filter((lembrete) => lembrete.categoria === categoria);
      },
      [lembretes],
    );

    // Obter lembretes próximos (próximos 7 dias)
    const getLembretesProximos = useCallback(() => {
      const agora = new Date();
      const proximosSete = new Date();
      proximosSete.setDate(agora.getDate() + 7);

      return lembretes.filter((lembrete) => {
        const dataVencimento = new Date(lembrete.data_vencimento);
        return (
          dataVencimento >= agora &&
          dataVencimento <= proximosSete &&
          lembrete.status === "pendente"
        );
      });
    }, [lembretes]);

    // Carregar lembretes quando o usuário muda
    useEffect(() => {
      loadLembretes();
    }, [loadLembretes]);

    // Subscription para atualizações em tempo real
    useEffect(() => {
      if (!user || user.user_type !== "admin") return;

      const subscription = deps.supabase
        .channel("lembretes_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lembretes",
            filter: `sindico_id=eq.${user.id}`,
          },
          () => {
            // Recarregar lembretes quando houver mudanças
            loadLembretes();
          },
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
      refreshLembretes: loadLembretes,
      rescheduleNotifications,
      // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
      // notificationStats: loggerStats,
      // validationStats,
      // generateNotificationReport: generateDebugReport
    };
  };
}
