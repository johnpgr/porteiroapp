import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireSuperAdmin, validateInput, sanitizeInput } from '@/middleware/auth';

// GET - Listar logs de segurança
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
    const adminId = searchParams.get('admin');
    const severity = searchParams.get('severity');
    const event = searchParams.get('event');
    const search = searchParams.get('search');
    const export_format = searchParams.get('export');

    // Construir query
    let query = supabase
      .from('security_logs')
      .select(`
        id,
        admin_id,
        admin:admins(email),
        event,
        details,
        severity,
        created_at
      `);

    // Aplicar filtros
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (adminId) {
      query = query.eq('admin_id', adminId);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (event) {
      query = query.ilike('event', `%${event}%`);
    }
    if (search) {
      query = query.or(`event.ilike.%${search}%,details->>message.ilike.%${search}%`);
    }

    // Ordenar por data (mais recente primeiro)
    query = query.order('created_at', { ascending: false });

    // Se for exportação, não aplicar paginação
    if (!export_format) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar logs de segurança:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar logs de segurança' },
        { status: 500 }
      );
    }

    // Formatar dados
    const formattedLogs = logs?.map(log => ({
      id: log.id,
      admin_id: log.admin_id,
      admin_email: log.admin?.email || 'Sistema',
      event: log.event,
      details: log.details,
      severity: log.severity,
      created_at: log.created_at
    })) || [];

    // Se for exportação, retornar CSV
    if (export_format === 'true') {
      const csv = generateCSV(formattedLogs);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="security-logs-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Registrar acesso aos logs
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'view_security_logs',
      resource: 'security_logs',
      details: {
        filters: { dateFrom, dateTo, adminId, severity, event, search },
        results_count: formattedLogs.length
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Erro na API de logs de segurança:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo log de segurança
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
      event: { required: true, type: 'string', minLength: 1, maxLength: 100 },
      severity: { required: true, type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      details: { required: false, type: 'object' }
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.errors },
        { status: 400 }
      );
    }

    // Criar log de segurança
    const { data: securityLog, error } = await supabase
      .from('security_logs')
      .insert({
        admin_id: admin.id,
        event: sanitizedData.event,
        severity: sanitizedData.severity,
        details: sanitizedData.details || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar log de segurança:', error);
      return NextResponse.json(
        { error: 'Erro ao criar log de segurança' },
        { status: 500 }
      );
    }

    // Registrar ação
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'create_security_log',
      resource: 'security_logs',
      details: {
        security_log_id: securityLog.id,
        event: sanitizedData.event,
        severity: sanitizedData.severity
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      message: 'Log de segurança criado com sucesso',
      log: securityLog
    }, { status: 201 });
  } catch (error) {
    console.error('Erro na criação de log de segurança:', error);
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
    const days = parseInt(searchParams.get('days') || '90');
    
    // Validar parâmetro
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Período deve estar entre 1 e 365 dias' },
        { status: 400 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Contar logs que serão removidos
    const { count: logsToDelete } = await supabase
      .from('security_logs')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoffDate.toISOString());

    // Remover logs antigos
    const { error } = await supabase
      .from('security_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Erro ao limpar logs de segurança:', error);
      return NextResponse.json(
        { error: 'Erro ao limpar logs de segurança' },
        { status: 500 }
      );
    }

    // Registrar ação
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'cleanup_security_logs',
      resource: 'security_logs',
      details: {
        days_kept: days,
        logs_deleted: logsToDelete || 0,
        cutoff_date: cutoffDate.toISOString()
      },
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success'
    });

    return NextResponse.json({
      message: 'Logs de segurança limpos com sucesso',
      deleted_count: logsToDelete || 0
    });
  } catch (error) {
    console.error('Erro na limpeza de logs de segurança:', error);
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

  const headers = ['ID', 'Admin', 'Evento', 'Severidade', 'Detalhes', 'Data/Hora'];
  const rows = logs.map(log => [
    log.id,
    log.admin_email,
    log.event,
    log.severity,
    JSON.stringify(log.details),
    new Date(log.created_at).toLocaleString('pt-BR')
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}