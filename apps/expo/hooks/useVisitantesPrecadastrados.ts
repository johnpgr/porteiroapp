import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { isRegularUser } from '~/types/auth.types';
import { useUserApartment } from './useUserApartment';
import type { Database } from '~/../../packages/common/supabase/types/database';

type Visitor = Database['public']['Tables']['visitors']['Row'];
type VisitorInsert = Database['public']['Tables']['visitors']['Insert'];
type VisitorUpdate = Database['public']['Tables']['visitors']['Update'];
type VisitorLogRow = Database['public']['Tables']['visitor_logs']['Row'];

export interface VisitanteAcesso {
  id: string;
  visitante_id: string | null;
  data_acesso: string;
  tipo_entrada: 'visitante' | 'entrega' | 'veiculo';
  porteiro_id?: string;
  observacoes?: string | null;
  created_at: string;
}

export interface CreateVisitanteData {
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  tipo_acesso: 'direto' | 'com_aprovacao';
  data_inicio?: string;
  data_fim?: string;
  dias_semana?: string[];
  horario_inicio?: string;
  horario_fim?: string;
  observacoes?: string;
  apartment_id?: string;
}

export interface UpdateVisitanteData {
  nome?: string;
  documento?: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  tipo_acesso?: 'direto' | 'com_aprovacao';
  data_inicio?: string;
  data_fim?: string;
  dias_semana?: string[];
  horario_inicio?: string;
  horario_fim?: string;
  observacoes?: string;
  status?: string;
  apartment_id?: string;
}

export function useVisitantesPrecadastrados() {
  const { user } = useAuth();
  const { apartment } = useUserApartment();
  const [visitantes, setVisitantes] = useState<Visitor[]>([]);
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

      // Filtrar por apartamento se for morador
      if (user.user_type === 'morador' && apartment?.id) {
        const { data, error: fetchError } = await supabase
          .from('visitors')
          .select('*')
          .eq('apartment_id', apartment.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setVisitantes(data || []);
        return;
      }

      // Filtrar por prédio se for porteiro
      if (user.user_type === 'porteiro' && isRegularUser(user) && user.building_id) {
        const { data, error: fetchError } = await supabase
          .from('visitors')
          .select(`
            *,
            apartments!inner(building_id)
          `)
          .eq('apartments.building_id', user.building_id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setVisitantes(data || []);
        return;
      }

      // Default: load all visitors (for admin or when no filter applies)
      const { data, error: fetchError } = await supabase
        .from('visitors')
        .select('*')
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
  }, [user, apartment]);

  // Helper to convert VisitorLogRow to VisitanteAcesso
  const convertLogToAcesso = (log: VisitorLogRow): VisitanteAcesso => ({
    id: log.id,
    visitante_id: log.visitor_id,
    data_acesso: log.log_time,
    tipo_entrada: (log.entry_type as 'visitante' | 'entrega' | 'veiculo') || 'visitante',
    observacoes: log.purpose,
    created_at: log.created_at,
  });

  // Carregar acessos de visitantes
  const loadAcessos = useCallback(async (visitanteId?: string) => {
    if (!user) {
      setAcessos([]);
      return;
    }

    try {
      let query = supabase
        .from('visitor_logs')
        .select('*');

      // Filtrar por visitante específico se fornecido
      if (visitanteId) {
        query = query.eq('visitor_id', visitanteId);
      }

      // Filtrar por apartamento se for morador
      if (user.user_type === 'morador' && apartment?.id) {
        query = query.eq('apartment_id', apartment.id);
      }

      // Filtrar por prédio se for porteiro
      if (user.user_type === 'porteiro' && isRegularUser(user) && user.building_id) {
        query = query.eq('building_id', user.building_id);
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .limit(100); // Limitar a 100 registros mais recentes

      if (fetchError) {
        throw fetchError;
      }

      const acessos = (data || []).map(convertLogToAcesso);
      setAcessos(acessos);
    } catch (err: any) {
      logError('Erro ao carregar acessos:', err);
    }
  }, [user, apartment]);

  // Criar visitante
  const createVisitante = useCallback(async (data: CreateVisitanteData): Promise<{ success: boolean; error?: string; visitante?: Visitor }> => {
    if (!user || user.user_type !== 'morador') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const qrCode = generateQRCode();
      
      const visitanteData: VisitorInsert = {
        name: data.nome,
        document: data.documento || null,
        phone: data.telefone || null,
        photo_url: data.foto_url || null,
        access_type: data.tipo_acesso,
        visit_date: data.data_inicio || null,
        allowed_days: data.dias_semana || null,
        visit_start_time: data.horario_inicio || null,
        visit_end_time: data.horario_fim || null,
        registration_token: qrCode,
        status: 'aprovado',
        apartment_id: data.apartment_id || apartment?.id || null,
        is_active: true,
      };

      const { data: newVisitor, error: createError } = await supabase
        .from('visitors')
        .insert([visitanteData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Atualizar lista local
      setVisitantes(prev => [newVisitor, ...prev]);

      return { success: true, visitante: newVisitor };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar visitante';
      logError('Erro ao criar visitante:', err);
      return { success: false, error: errorMessage };
    }
  }, [user, apartment, generateQRCode]);

  // Atualizar visitante
  const updateVisitante = useCallback(async (id: string, data: UpdateVisitanteData): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'morador') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const updateData: VisitorUpdate = {
        name: data.nome,
        document: data.documento,
        phone: data.telefone,
        photo_url: data.foto_url,
        access_type: data.tipo_acesso,
        visit_date: data.data_inicio,
        allowed_days: data.dias_semana,
        visit_start_time: data.horario_inicio,
        visit_end_time: data.horario_fim,
        status: data.status,
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof VisitorUpdate] === undefined) {
          delete updateData[key as keyof VisitorUpdate];
        }
      });

      const { data: updatedVisitor, error: updateError } = await supabase
        .from('visitors')
        .update(updateData)
        .eq('id', id)
        .eq('apartment_id', apartment?.id || '')
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Atualizar lista local
      setVisitantes(prev => 
        prev.map(visitante => 
          visitante.id === id ? updatedVisitor : visitante
        )
      );

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao atualizar visitante';
      logError('Erro ao atualizar visitante:', err);
      return { success: false, error: errorMessage };
    }
  }, [user, apartment]);

  // Deletar visitante
  const deleteVisitante = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'morador') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('visitors')
        .delete()
        .eq('id', id)
        .eq('apartment_id', apartment?.id || '');

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
  }, [user, apartment]);

  // Obter visitante por ID
  const getVisitanteById = useCallback(async (id: string): Promise<{ success: boolean; visitante?: Visitor; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      let query = supabase
        .from('visitors')
        .select('*')
        .eq('id', id);

      // Filtrar por apartamento se for morador
      if (user.user_type === 'morador' && apartment?.id) {
        query = query.eq('apartment_id', apartment.id);
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
  }, [user, apartment]);

  // Registrar acesso de visitante (para porteiros)
  const registrarAcesso = useCallback(async (visitanteId: string, tipoEntrada: 'qr_code' | 'manual' | 'reconhecimento', observacoes?: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.user_type !== 'porteiro') {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      // First get visitor to get apartment_id and building_id
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .select('*, apartments!inner(building_id)')
        .eq('id', visitanteId)
        .single();

      if (visitorError || !visitor) {
        throw new Error('Visitante não encontrado');
      }

      const logData = {
        visitor_id: visitanteId,
        apartment_id: visitor.apartment_id!,
        building_id: (isRegularUser(user) && user.building_id) || '',
        tipo_log: 'entrada',
        entry_type: 'visitante',
        log_time: new Date().toISOString(),
        notification_status: 'acknowledged',
        purpose: observacoes,
      };

      const { data: newLog, error: createError } = await supabase
        .from('visitor_logs')
        .insert([logData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      const newAcesso = convertLogToAcesso(newLog);

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
  const getVisitanteByQRCode = useCallback(async (qrCode: string): Promise<{ success: boolean; visitante?: Visitor; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autorizado' };
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('visitors')
        .select('*')
        .eq('registration_token', qrCode)
        .eq('status', 'aprovado')
        .eq('is_active', true)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Verificar se o acesso é válido baseado nas regras
      const agora = new Date();
      const dataInicio = data.visit_date ? new Date(data.visit_date) : null;

      // Verificar se está dentro do período
      if (dataInicio && agora < dataInicio) {
        return { success: false, error: 'Acesso fora do período permitido' };
      }

      // Verificar horário se definido
      if (data.visit_start_time && data.visit_end_time) {
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const [horaIni, minIni] = data.visit_start_time.split(':').map(Number);
        const [horaFim, minFim] = data.visit_end_time.split(':').map(Number);
        const horarioInicio = horaIni * 60 + minIni;
        const horarioFim = horaFim * 60 + minFim;

        if (horaAtual < horarioInicio || horaAtual > horarioFim) {
          return { success: false, error: 'Acesso fora do horário permitido' };
        }
      }

      // Verificar dias da semana se houver restrição
      if (data.allowed_days && data.allowed_days.length > 0) {
        const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const diaAtual = diasSemana[agora.getDay()];
        
        if (!data.allowed_days.includes(diaAtual)) {
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
  const getVisitantesByTipo = useCallback((tipo: 'direto' | 'com_aprovacao') => {
    return visitantes.filter(visitante => visitante.access_type === tipo);
  }, [visitantes]);

  // Obter visitantes que expiram em breve
  const getVisitantesExpirandoEmBreve = useCallback((dias: number = 7) => {
    const agora = new Date();
    const limite = new Date();
    limite.setDate(agora.getDate() + dias);

    return visitantes.filter(visitante => {
      if (!visitante.visit_date || visitante.status !== 'aprovado') return false;
      
      const dataFim = new Date(visitante.visit_date);
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
          table: 'visitors',
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
          table: 'visitor_logs'
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