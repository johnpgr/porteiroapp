'use client';

import { useState, useCallback } from 'react';
import { useAdminFeedback } from '@/components/NotificationSystem';

// Tipos para as ações administrativas
export interface AdminActionOptions {
  showLoading?: boolean;
  successMessage?: string;
  errorMessage?: string;
  confirmAction?: {
    title: string;
    message: string;
  };
  onSuccess?: (data?: any) => void;
  onError?: (error?: any) => void;
}

// Hook para ações administrativas com feedback
export const useAdminActions = () => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const feedback = useAdminFeedback();

  // Função genérica para executar ações com feedback
  const executeAction = useCallback(async (
    actionKey: string,
    actionFn: () => Promise<any>,
    options: AdminActionOptions = {}
  ) => {
    const {
      showLoading = true,
      successMessage,
      errorMessage,
      confirmAction,
      onSuccess,
      onError
    } = options;

    // Se requer confirmação, mostrar primeiro
    if (confirmAction) {
      return new Promise<void>((resolve) => {
        feedback.confirm(
          confirmAction.title,
          confirmAction.message,
          async () => {
            await executeActionInternal();
            resolve();
          }
        );
      });
    } else {
      return executeActionInternal();
    }

    async function executeActionInternal() {
      try {
        if (showLoading) {
          setLoading(prev => ({ ...prev, [actionKey]: true }));
        }

        const result = await actionFn();

        if (successMessage) {
          feedback.success(successMessage);
        }

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error: any) {
        console.error(`Erro na ação ${actionKey}:`, error);
        
        const message = errorMessage || 
          error?.message || 
          'Ocorreu um erro inesperado';
        
        feedback.error('Erro na operação', message);
        
        if (onError) {
          onError(error);
        }
        
        throw error;
      } finally {
        if (showLoading) {
          setLoading(prev => ({ ...prev, [actionKey]: false }));
        }
      }
    }
  }, [feedback]);

  // Ações específicas para administradores
  const adminActions = {
    // Criar administrador
    createAdmin: useCallback(async (adminData: any, options?: AdminActionOptions) => {
      return executeAction(
        'createAdmin',
        async () => {
          const response = await fetch('/api/admin/admins', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(adminData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar administrador');
          }

          return response.json();
        },
        {
          successMessage: 'Administrador criado com sucesso',
          errorMessage: 'Erro ao criar administrador',
          ...options
        }
      );
    }, [executeAction]),

    // Atualizar administrador
    updateAdmin: useCallback(async (adminId: string, adminData: any, options?: AdminActionOptions) => {
      return executeAction(
        'updateAdmin',
        async () => {
          const response = await fetch(`/api/admin/admins?id=${adminId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(adminData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar administrador');
          }

          return response.json();
        },
        {
          successMessage: 'Administrador atualizado com sucesso',
          errorMessage: 'Erro ao atualizar administrador',
          ...options
        }
      );
    }, [executeAction]),

    // Deletar administrador
    deleteAdmin: useCallback(async (adminId: string, options?: AdminActionOptions) => {
      return executeAction(
        'deleteAdmin',
        async () => {
          const response = await fetch(`/api/admin/admins?id=${adminId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao deletar administrador');
          }

          return response.json();
        },
        {
          confirmAction: {
            title: 'Confirmar exclusão',
            message: 'Tem certeza que deseja excluir este administrador? Esta ação não pode ser desfeita.'
          },
          successMessage: 'Administrador excluído com sucesso',
          errorMessage: 'Erro ao excluir administrador',
          ...options
        }
      );
    }, [executeAction]),

    // Ativar/Desativar administrador
    toggleAdminStatus: useCallback(async (adminId: string, active: boolean, options?: AdminActionOptions) => {
      return executeAction(
        'toggleAdminStatus',
        async () => {
          const response = await fetch('/api/admin/access-control', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: adminId, active }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao alterar status do administrador');
          }

          return response.json();
        },
        {
          successMessage: `Administrador ${active ? 'ativado' : 'desativado'} com sucesso`,
          errorMessage: 'Erro ao alterar status do administrador',
          ...options
        }
      );
    }, [executeAction]),

    // Atualizar permissões
    updatePermissions: useCallback(async (userId: string, permissions: string[], options?: AdminActionOptions) => {
      return executeAction(
        'updatePermissions',
        async () => {
          const response = await fetch('/api/admin/access-control', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: userId, permissions }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar permissões');
          }

          return response.json();
        },
        {
          successMessage: 'Permissões atualizadas com sucesso',
          errorMessage: 'Erro ao atualizar permissões',
          ...options
        }
      );
    }, [executeAction]),

    // Limpar logs
    clearLogs: useCallback(async (logType: 'audit' | 'security' | 'system', days: number, options?: AdminActionOptions) => {
      return executeAction(
        'clearLogs',
        async () => {
          const endpoint = `/api/admin/${logType === 'audit' ? 'audit-logs' : logType === 'security' ? 'security-logs' : 'system-logs'}`;
          const response = await fetch(`${endpoint}?days=${days}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao limpar logs');
          }

          return response.json();
        },
        {
          confirmAction: {
            title: 'Confirmar limpeza de logs',
            message: `Tem certeza que deseja limpar logs de ${logType} com mais de ${days} dias? Esta ação não pode ser desfeita.`
          },
          successMessage: 'Logs limpos com sucesso',
          errorMessage: 'Erro ao limpar logs',
          ...options
        }
      );
    }, [executeAction]),

    // Exportar logs
    exportLogs: useCallback(async (logType: 'audit' | 'security' | 'system', filters?: any, options?: AdminActionOptions) => {
      return executeAction(
        'exportLogs',
        async () => {
          const endpoint = `/api/admin/${logType === 'audit' ? 'audit-logs' : logType === 'security' ? 'security-logs' : 'system-logs'}`;
          const params = new URLSearchParams({ export: 'true', ...filters });
          
          const response = await fetch(`${endpoint}?${params}`);

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao exportar logs');
          }

          // Download do arquivo CSV
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${logType}-logs-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          return { success: true };
        },
        {
          successMessage: 'Logs exportados com sucesso',
          errorMessage: 'Erro ao exportar logs',
          ...options
        }
      );
    }, [executeAction]),

    // Registrar evento personalizado
    logCustomEvent: useCallback(async (eventData: any, options?: AdminActionOptions) => {
      return executeAction(
        'logCustomEvent',
        async () => {
          const response = await fetch('/api/admin/audit-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar evento');
          }

          return response.json();
        },
        {
          successMessage: 'Evento registrado com sucesso',
          errorMessage: 'Erro ao registrar evento',
          ...options
        }
      );
    }, [executeAction])
  };

  // Função para verificar se uma ação está carregando
  const isLoading = useCallback((actionKey: string) => {
    return loading[actionKey] || false;
  }, [loading]);

  // Função para verificar se qualquer ação está carregando
  const isAnyLoading = useCallback(() => {
    return Object.values(loading).some(Boolean);
  }, [loading]);

  return {
    ...adminActions,
    executeAction,
    isLoading,
    isAnyLoading,
    loading
  };
};

// Hook para métricas do sistema
export const useSystemMetrics = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedback = useAdminFeedback();

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/metrics');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar métricas');
      }

      const data = await response.json();
      setMetrics(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar métricas do sistema';
      setError(errorMessage);
      feedback.error('Erro ao carregar métricas', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [feedback]);

  const refreshMetrics = useCallback(() => {
    return fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
    refreshMetrics
  };
};

// Hook para logs com paginação e filtros
export const useLogs = (logType: 'audit' | 'security' | 'system') => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const feedback = useAdminFeedback();

  const fetchLogs = useCallback(async (filters: any = {}, page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = `/api/admin/${logType === 'audit' ? 'audit-logs' : logType === 'security' ? 'security-logs' : 'system-logs'}`;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });

      const response = await fetch(`${endpoint}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination({
        ...pagination,
        page: data.pagination?.page || page,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      });
      
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar logs';
      setError(errorMessage);
      feedback.error('Erro ao carregar logs', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [logType, pagination.limit, feedback]);

  const refreshLogs = useCallback((filters?: any) => {
    return fetchLogs(filters, pagination.page);
  }, [fetchLogs, pagination.page]);

  const nextPage = useCallback((filters?: any) => {
    if (pagination.page < pagination.totalPages) {
      return fetchLogs(filters, pagination.page + 1);
    }
  }, [fetchLogs, pagination.page, pagination.totalPages]);

  const prevPage = useCallback((filters?: any) => {
    if (pagination.page > 1) {
      return fetchLogs(filters, pagination.page - 1);
    }
  }, [fetchLogs, pagination.page]);

  const goToPage = useCallback((page: number, filters?: any) => {
    if (page >= 1 && page <= pagination.totalPages) {
      return fetchLogs(filters, page);
    }
  }, [fetchLogs, pagination.totalPages]);

  return {
    logs,
    loading,
    error,
    pagination,
    fetchLogs,
    refreshLogs,
    nextPage,
    prevPage,
    goToPage
  };
};

export default useAdminActions;