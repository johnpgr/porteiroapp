import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// GET - Listar logs de auditoria
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const action = searchParams.get('action') || '';
    const targetType = searchParams.get('target_type') || '';
    const severity = searchParams.get('severity') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const userId = searchParams.get('user_id') || '';

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        admin:admin_id(name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filtro por busca geral
    if (search) {
      query = query.or(`action.ilike.%${search}%,target_type.ilike.%${search}%,details->>description.ilike.%${search}%`);
    }

    // Filtro por ação
    if (action) {
      query = query.eq('action', action);
    }

    // Filtro por tipo de alvo
    if (targetType) {
      query = query.eq('target_type', targetType);
    }

    // Filtro por severidade
    if (severity) {
      query = query.eq('severity', severity);
    }

    // Filtro por usuário
    if (userId) {
      query = query.eq('admin_id', userId);
    }

    // Filtro por período
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Erro na API de logs de auditoria:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo log de auditoria
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, 
      target_type, 
      target_id, 
      admin_id, 
      details, 
      severity = 'info',
      ip_address,
      user_agent 
    } = body;

    // Validação dos dados obrigatórios
    if (!action || !target_type) {
      return NextResponse.json(
        { error: 'Ação e tipo de alvo são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar novo log de auditoria
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        action,
        target_type,
        target_id,
        admin_id,
        details: details || {},
        severity,
        ip_address,
        user_agent,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        admin:admin_id(name, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar log de auditoria:', error);
      return NextResponse.json(
        { error: 'Erro ao criar log de auditoria' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Erro na criação de log de auditoria:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Limpar logs antigos (apenas super-admin)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90');
    const confirm = searchParams.get('confirm') === 'true';

    if (!confirm) {
      return NextResponse.json(
        { error: 'Confirmação necessária para limpar logs' },
        { status: 400 }
      );
    }

    // Calcular data limite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Contar logs que serão removidos
    const { count } = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoffDate.toISOString());

    if (!count || count === 0) {
      return NextResponse.json({
        message: 'Nenhum log encontrado para remoção',
        removed: 0
      });
    }

    // Remover logs antigos
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Erro ao limpar logs:', error);
      return NextResponse.json(
        { error: 'Erro ao limpar logs' },
        { status: 500 }
      );
    }

    // Registrar a limpeza
    await supabase.from('audit_logs').insert({
      action: 'logs_cleanup',
      target_type: 'system',
      target_id: null,
      details: { 
        removed_count: count,
        cutoff_date: cutoffDate.toISOString(),
        days_retained: days
      },
      severity: 'info',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      message: `${count} logs removidos com sucesso`,
      removed: count
    });
  } catch (error) {
    console.error('Erro na limpeza de logs:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função auxiliar para exportar logs (não exportada como route handler)
async function exportLogs(filters: any) {
  try {
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        admin:admin_id(name, email)
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.target_type) {
      query = query.eq('target_type', filters.target_type);
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao exportar logs:', error);
    throw error;
  }
}