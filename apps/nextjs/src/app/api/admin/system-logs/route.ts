import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireSuperAdmin, validateInput, sanitizeInput } from '@/middleware/auth';

// GET - Listar logs do sistema
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação de super admin
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { admin } = authResult;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    
    // Filtros
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const level = searchParams.get('level');
    const component = searchParams.get('component');
    const search = searchParams.get('search');
    const export_format = searchParams.get('export');

    // Construir query
    let query = supabase
      .from('system_logs')
      .select(`
        id,
        level,
        message,
        component,
        details,
        created_at
      `);

    // Aplicar filtros
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (level) {
      query = query.eq('level', level);
    }
    if (component) {
      query = query.ilike('component', `%${component}%`);
    }
    if (search) {
      query = query.or(`message.ilike.%${search}%,component.ilike.%${search}%,details->>error.ilike.%${search}%`);
    }

    // Ordenar por data (mais recente primeiro)
    query = query.order('created_at', { ascending: false });

    // Se for exportação, não aplicar paginação
    if (!export_format) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar logs do sistema:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar logs do sistema' },
        { status: 500 }
      );
    }

    // Se for exportação, retornar CSV
    if (export_format === 'true') {
      const csv = generateCSV(logs || []);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="system-logs-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Registrar acesso aos logs
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'view_system_logs',
      resource: 'system_logs',
      details: {
        filters: { dateFrom, dateTo, level, component, search },
        results_count: logs?.length || 0
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Erro na API de logs do sistema:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo log do sistema
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação de super admin
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { admin } = authResult;

    const body = await request.json();
    const sanitizedData = sanitizeInput(body);

    // Validar dados
    const validation = validateInput(sanitizedData, {
      level: { required: true, type: 'string', enum: ['info', 'warn', 'error', 'debug'] },
      message: { required: true, type: 'string', minLength: 1, maxLength: 500 },
      component: { required: true, type: 'string', minLength: 1, maxLength: 100 },
      details: { required: false, type: 'object' }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.errors },
        { status: 400 }
      );
    }

    // Criar log do sistema
    const { data: systemLog, error } = await supabase
      .from('system_logs')
      .insert({
        level: sanitizedData.level,
        message: sanitizedData.message,
        component: sanitizedData.component,
        details: sanitizedData.details || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar log do sistema:', error);
      return NextResponse.json(
        { error: 'Erro ao criar log do sistema' },
        { status: 500 }
      );
    }

    // Registrar ação
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'create_system_log',
      resource: 'system_logs',
      details: {
        system_log_id: systemLog.id,
        level: sanitizedData.level,
        component: sanitizedData.component
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      message: 'Log do sistema criado com sucesso',
      log: systemLog
    }, { status: 201 });
  } catch (error) {
    console.error('Erro na criação de log do sistema:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Limpar logs antigos
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação de super admin
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { admin } = authResult;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const level = searchParams.get('level'); // Opcional: limpar apenas logs de um nível específico
    
    // Validar parâmetro
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Período deve estar entre 1 e 365 dias' },
        { status: 400 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Construir query de contagem
    let countQuery = supabase
      .from('system_logs')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoffDate.toISOString());

    if (level) {
      countQuery = countQuery.eq('level', level);
    }

    const { count: logsToDelete } = await countQuery;

    // Construir query de remoção
    let deleteQuery = supabase
      .from('system_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (level) {
      deleteQuery = deleteQuery.eq('level', level);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Erro ao limpar logs do sistema:', error);
      return NextResponse.json(
        { error: 'Erro ao limpar logs do sistema' },
        { status: 500 }
      );
    }

    // Registrar ação
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'cleanup_system_logs',
      resource: 'system_logs',
      details: {
        days_kept: days,
        level_filter: level || 'all',
        logs_deleted: logsToDelete || 0,
        cutoff_date: cutoffDate.toISOString()
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      message: 'Logs do sistema limpos com sucesso',
      deleted_count: logsToDelete || 0
    });
  } catch (error) {
    console.error('Erro na limpeza de logs do sistema:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Configurar retenção automática de logs
export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação de super admin
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { admin } = authResult;

    const body = await request.json();
    const sanitizedData = sanitizeInput(body);

    // Validar dados
    const validation = validateInput(sanitizedData, {
      retention_days: { required: true, type: 'number' },
      auto_cleanup: { required: true, type: 'boolean' },
      cleanup_schedule: { required: false, type: 'string' }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.errors },
        { status: 400 }
      );
    }

    if (sanitizedData.retention_days < 1 || sanitizedData.retention_days > 365) {
      return NextResponse.json(
        { error: 'Período de retenção deve estar entre 1 e 365 dias' },
        { status: 400 }
      );
    }

    // Salvar configuração (usando uma tabela de configurações do sistema)
    const { data: config, error } = await supabase
      .from('system_config')
      .upsert({
        key: 'log_retention',
        value: {
          retention_days: sanitizedData.retention_days,
          auto_cleanup: sanitizedData.auto_cleanup,
          cleanup_schedule: sanitizedData.cleanup_schedule || 'daily',
          updated_by: admin.id,
          updated_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar configuração de retenção:', error);
      return NextResponse.json(
        { error: 'Erro ao salvar configuração' },
        { status: 500 }
      );
    }

    // Registrar ação
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'update_log_retention_config',
      resource: 'system_config',
      details: {
        retention_days: sanitizedData.retention_days,
        auto_cleanup: sanitizedData.auto_cleanup,
        cleanup_schedule: sanitizedData.cleanup_schedule
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      message: 'Configuração de retenção atualizada com sucesso',
      config: config.value
    });
  } catch (error) {
    console.error('Erro na configuração de retenção:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função auxiliar para gerar CSV
function generateCSV(logs: any[]): string {
  if (logs.length === 0) {
    return 'Nenhum dado para exportar';
  }

  const headers = ['ID', 'Nível', 'Componente', 'Mensagem', 'Detalhes', 'Data/Hora'];
  const rows = logs.map(log => [
    log.id,
    log.level,
    log.component,
    log.message,
    JSON.stringify(log.details),
    new Date(log.created_at).toLocaleString('pt-BR')
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

// Função auxiliar para criar log do sistema (para uso interno, não exportada como route handler)
async function createSystemLog(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  component: string,
  details?: any
) {
  try {
    await supabase.from('system_logs').insert({
      level,
      message,
      component,
      details: details || {},
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao criar log do sistema:', error);
  }
}