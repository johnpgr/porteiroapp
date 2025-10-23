import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface VisitantePrecadastrado {
  id: string;
  nome: string;
  documento: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  tipo_acesso: 'unico' | 'recorrente' | 'permanente';
  data_inicio: string;
  data_fim?: string;
  dias_semana?: string[]; // ['segunda', 'terca', etc.]
  horario_inicio?: string;
  horario_fim?: string;
  observacoes?: string;
  qr_code: string;
  status: 'ativo' | 'inativo' | 'expirado';
  morador_id: string;
  condominium_id: string;
  building_id?: string;
  apartamento?: string;
  created_at: string;
  updated_at: string;
}

export interface VisitanteAcesso {
  id: string;
  visitante_id: string;
  data_acesso: string;
  tipo_entrada: 'qr_code' | 'manual' | 'reconhecimento';
  porteiro_id?: string;
  observacoes?: string;
  created_at: string;
}

export interface CreateVisitanteData {
  nome: string;
  documento: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  tipo_acesso: 'unico' | 'recorrente' | 'permanente';
  data_inicio: string;
  data_fim?: string;
  dias_semana?: string[];
  horario_inicio?: string;
  horario_fim?: string;
  observacoes?: string;
  apartamento?: string;
}

export interface UpdateVisitanteData {
  nome?: string;
  documento?: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  tipo_acesso?: 'unico' | 'recorrente' | 'permanente';
  data_inicio?: string;
  data_fim?: string;
  dias_semana?: string[];
  horario_inicio?: string;
  horario_fim?: string;
  observacoes?: string;
  status?: 'ativo' | 'inativo' | 'expirado';
  apartamento?: string;
}

export function useVisitantesPrecadastrados() {
  const { user } = useAuth();
  const [visitantes, setVisitantes] = useState<VisitantePrecadastrado[]>([]);
  const [acessos, setAcessos] = useState<VisitanteAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para logs apenas de erros críticos
  const logError = (message: string, error?: any) => {
    if (__DEV__) {
      console.error(`[useVisitantesPrecadastrados] ${message}`, error || '');
    }
  };

  // Gerar QR Code único
  const generateQRCode = useCallback((): string => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    return `VIS_${timestamp}_${random}`.toUpperCase();
  }, []);

  // Carregar visitantes (diferente para cada tipo de usuário)
  const loadVisitantes = useCallback(async () => {
    if (!user) {
      setVisitantes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('visitantes_precadastrados')
        .select('*')
        .eq('condominium_id', user.condominium_id);

      // Filtrar por usuário se for morador
      if (user.user_type === 'morador') {
        query = query.eq('morador_id', user.id);
      }

      // Filtrar por prédio se for porteiro
      if (user.user_type === 'porteiro' && user.building_id) {
        query = query.eq('building_id', user.building_id);
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setVisitantes(data || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar visitantes';
      setError(errorMessage);
      logError('Erro ao carregar visitantes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Carregar acessos de visitantes
  const loadAcessos = useCallback(async (visitanteId?: string) => {
    if (!user) {
      setAcessos([]);
      return;
    }

    try {
      let query = supabase
        .from('visitante_acessos')
        .select(`
          *,
          visitantes_precadastrados!inner(
            nome,
            documento,
            condominium_id,
            morador_id,
            building_id
          )
        `)
        .eq('visitantes_precadastrados.condominium_id', user.condominium_id);

      // Filtrar por visitante específico se fornecido
      if (visitanteId) {
        query = query.eq('visitante_id', visitanteId);
      }

      // Filtrar por usuário se for morador
      if (user.user_type === 'morador') {
        query = query.eq('visitantes_precadastrados.morador_id', user.id);
      }

      // Filtrar por prédio se for porteiro
      if (user.user_type === 'porteiro' && user.building_id) {
        query = query.eq('visitantes_precadastrados.building_id', user.building_id);
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .limit(100); // Limitar a 100 registros mais recentes

      if (fetchError) {
        throw fetchError;
      }

      setAcessos(data || []);
    } catch (err: any) {
      logError('Erro ao carregar acessos:', err);
    }
  }, [user]);

  // Criar visitante
  const createVisitante = useCallback(async (data: CreateVisitanteData): Promise<{ success: boolean; error?: string; visitante?: VisitantePrecadastrado }> => {
    if (!user || user.user_type !== 'morador') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const qrCode = generateQRCode();
      
      const visitanteData = {
        ...data,
        qr_code: qrCode,
        status: 'ativo' as const,
        morador_id: user.id,
        condominium_id: user.condominium_id!,
        building_id: user.building_id
      };

      const { data: newVisitante, error: createError } = await supabase
        .from('visitantes_precadastrados')
        .insert([visitanteData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Atualizar lista local
      setVisitantes(prev => [newVisitante, ...prev]);

      return { success: true, visitante: newVisitante };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar visitante';
      logError('Erro ao criar visitante:', err);
      return { success: false, error: errorMessage };
    }
  }, [user, generateQRCode]);

  // Atualizar visitante
  const updateVisitante = useCallback(async (id: string, data: UpdateVisitanteData): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'morador') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { data: updatedVisitante, error: updateError } = await supabase
        .from('visitantes_precadastrados')
        .update(data)
        .eq('id', id)
        .eq('morador_id', user.id)
        .eq('condominium_id', user.condominium_id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Atualizar lista local
      setVisitantes(prev => 
        prev.map(visitante => 
          visitante.id === id ? updatedVisitante : visitante
        )
      );

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao atualizar visitante';
      logError('Erro ao atualizar visitante:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Deletar visitante
  const deleteVisitante = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'morador') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('visitantes_precadastrados')
        .delete()
        .eq('id', id)
        .eq('morador_id', user.id)
        .eq('condominium_id', user.condominium_id);

      if (deleteError) {
        throw deleteError;
      }

      // Remover da lista local
      setVisitantes(prev => prev.filter(visitante => visitante.id !== id));

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao deletar visitante';
      logError('Erro ao deletar visitante:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Obter visitante por ID
  const getVisitanteById = useCallback(async (id: string): Promise<{ success: boolean; visitante?: VisitantePrecadastrado; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      let query = supabase
        .from('visitantes_precadastrados')
        .select('*')
        .eq('id', id)
        .eq('condominium_id', user.condominium_id);

      // Filtrar por usuário se for morador
      if (user.user_type === 'morador') {
        query = query.eq('morador_id', user.id);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, visitante: data };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao buscar visitante';
      logError('Erro ao buscar visitante:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Registrar acesso de visitante (para porteiros)
  const registrarAcesso = useCallback(async (visitanteId: string, tipoEntrada: 'qr_code' | 'manual' | 'reconhecimento', observacoes?: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'porteiro') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const acessoData = {
        visitante_id: visitanteId,
        data_acesso: new Date().toISOString(),
        tipo_entrada: tipoEntrada,
        porteiro_id: user.id,
        observacoes
      };

      const { data: newAcesso, error: createError } = await supabase
        .from('visitante_acessos')
        .insert([acessoData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Atualizar lista local de acessos
      setAcessos(prev => [newAcesso, ...prev]);

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao registrar acesso';
      logError('Erro ao registrar acesso:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Buscar visitante por QR Code
  const getVisitanteByQRCode = useCallback(async (qrCode: string): Promise<{ success: boolean; visitante?: VisitantePrecadastrado; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('visitantes_precadastrados')
        .select('*')
        .eq('qr_code', qrCode)
        .eq('condominium_id', user.condominium_id)
        .eq('status', 'ativo')
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Verificar se o acesso é válido baseado nas regras
      const agora = new Date();
      const dataInicio = new Date(data.data_inicio);
      const dataFim = data.data_fim ? new Date(data.data_fim) : null;

      // Verificar se está dentro do período
      if (agora < dataInicio || (dataFim && agora > dataFim)) {
        return { success: false, error: 'Acesso fora do período permitido' };
      }

      // Verificar horário se definido
      if (data.horario_inicio && data.horario_fim) {
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const [horaIni, minIni] = data.horario_inicio.split(':').map(Number);
        const [horaFim, minFim] = data.horario_fim.split(':').map(Number);
        const horarioInicio = horaIni * 60 + minIni;
        const horarioFim = horaFim * 60 + minFim;

        if (horaAtual < horarioInicio || horaAtual > horarioFim) {
          return { success: false, error: 'Acesso fora do horário permitido' };
        }
      }

      // Verificar dias da semana se for recorrente
      if (data.tipo_acesso === 'recorrente' && data.dias_semana && data.dias_semana.length > 0) {
        const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const diaAtual = diasSemana[agora.getDay()];
        
        if (!data.dias_semana.includes(diaAtual)) {
          return { success: false, error: 'Acesso não permitido neste dia da semana' };
        }
      }

      return { success: true, visitante: data };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao buscar visitante por QR Code';
      logError('Erro ao buscar visitante por QR Code:', err);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // Filtrar visitantes por status
  const getVisitantesByStatus = useCallback((status: 'ativo' | 'inativo' | 'expirado') => {
    return visitantes.filter(visitante => visitante.status === status);
  }, [visitantes]);

  // Filtrar visitantes por tipo de acesso
  const getVisitantesByTipo = useCallback((tipo: 'unico' | 'recorrente' | 'permanente') => {
    return visitantes.filter(visitante => visitante.tipo_acesso === tipo);
  }, [visitantes]);

  // Obter visitantes que expiram em breve
  const getVisitantesExpirandoEmBreve = useCallback((dias: number = 7) => {
    const agora = new Date();
    const limite = new Date();
    limite.setDate(agora.getDate() + dias);

    return visitantes.filter(visitante => {
      if (!visitante.data_fim || visitante.status !== 'ativo') return false;
      
      const dataFim = new Date(visitante.data_fim);
      return dataFim >= agora && dataFim <= limite;
    });
  }, [visitantes]);

  // Carregar dados quando o usuário muda
  useEffect(() => {
    loadVisitantes();
    loadAcessos();
  }, [loadVisitantes, loadAcessos]);

  // Subscription para atualizações em tempo real
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('visitantes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitantes_precadastrados',
          filter: `condominium_id=eq.${user.condominium_id}`
        },
        () => {
          loadVisitantes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitante_acessos'
        },
        () => {
          loadAcessos();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, loadVisitantes, loadAcessos]);

  return {
    visitantes,
    acessos,
    loading,
    error,
    createVisitante,
    updateVisitante,
    deleteVisitante,
    getVisitanteById,
    registrarAcesso,
    getVisitanteByQRCode,
    getVisitantesByStatus,
    getVisitantesByTipo,
    getVisitantesExpirandoEmBreve,
    refreshVisitantes: loadVisitantes,
    refreshAcessos: loadAcessos
  };
}