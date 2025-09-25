import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import os from 'os';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função para obter métricas do sistema
function getSystemMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;

  const cpus = os.cpus();
  const loadAverage = os.loadavg();
  
  // Simular uso de CPU (em produção, usar bibliotecas específicas)
  const cpuUsage = Math.min(loadAverage[0] * 10, 100);

  return {
    cpu: {
      usage: Math.round(cpuUsage * 100) / 100,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
    },
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usage: Math.round(memoryUsage * 100) / 100
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
      hostname: os.hostname()
    }
  };
}

// Função para obter estatísticas do banco de dados
async function getDatabaseStats() {
  try {
    const [buildingsResult, residentsResult, visitorsResult, adminsResult] = await Promise.all([
      supabase.from('buildings').select('id', { count: 'exact', head: true }),
      supabase.from('residents').select('id', { count: 'exact', head: true }),
      supabase.from('visitors').select('id', { count: 'exact', head: true }),
      supabase.from('admins').select('id', { count: 'exact', head: true })
    ]);

    // Estatísticas de visitantes por período
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayVisits, weekVisits, monthVisits] = await Promise.all([
      supabase
        .from('visitor_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString().split('T')[0]),
      supabase
        .from('visitor_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString()),
      supabase
        .from('visitor_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
    ]);

    return {
      buildings: buildingsResult.count || 0,
      residents: residentsResult.count || 0,
      visitors: visitorsResult.count || 0,
      admins: adminsResult.count || 0,
      visits: {
        today: todayVisits.count || 0,
        week: weekVisits.count || 0,
        month: monthVisits.count || 0
      }
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas do banco:', error);
    return {
      buildings: 0,
      residents: 0,
      visitors: 0,
      admins: 0,
      visits: { today: 0, week: 0, month: 0 }
    };
  }
}

// Função para obter logs de auditoria recentes
async function getRecentAuditLogs(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao obter logs de auditoria:', error);
    return [];
  }
}

// Função para obter métricas de performance
async function getPerformanceMetrics() {
  try {
    // Tempo de resposta médio das consultas (simulado)
    const queryResponseTime = Math.random() * 100 + 50; // 50-150ms
    
    // Número de conexões ativas (simulado)
    const activeConnections = Math.floor(Math.random() * 20) + 5;
    
    // Taxa de erro (simulado)
    const errorRate = Math.random() * 2; // 0-2%
    
    // Throughput (simulado)
    const throughput = Math.floor(Math.random() * 1000) + 500; // 500-1500 req/min

    return {
      queryResponseTime: Math.round(queryResponseTime * 100) / 100,
      activeConnections,
      errorRate: Math.round(errorRate * 100) / 100,
      throughput,
      uptime: process.uptime()
    };
  } catch (error) {
    console.error('Erro ao obter métricas de performance:', error);
    return {
      queryResponseTime: 0,
      activeConnections: 0,
      errorRate: 0,
      throughput: 0,
      uptime: 0
    };
  }
}

// GET - Obter métricas do sistema
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let response: any = {};

    switch (type) {
      case 'system':
        response = { system: getSystemMetrics() };
        break;
      
      case 'database':
        response = { database: await getDatabaseStats() };
        break;
      
      case 'performance':
        response = { performance: await getPerformanceMetrics() };
        break;
      
      case 'audit':
        response = { audit: await getRecentAuditLogs() };
        break;
      
      case 'all':
      default:
        const [systemMetrics, databaseStats, performanceMetrics, auditLogs] = await Promise.all([
          Promise.resolve(getSystemMetrics()),
          getDatabaseStats(),
          getPerformanceMetrics(),
          getRecentAuditLogs()
        ]);

        response = {
          system: systemMetrics,
          database: databaseStats,
          performance: performanceMetrics,
          audit: auditLogs,
          timestamp: new Date().toISOString()
        };
        break;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro na API de métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Registrar evento personalizado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, data, severity = 'info' } = body;

    if (!event) {
      return NextResponse.json(
        { error: 'Evento é obrigatório' },
        { status: 400 }
      );
    }

    // Registrar evento no log de auditoria
    const { data: logEntry, error } = await supabase
      .from('audit_logs')
      .insert({
        action: 'custom_event',
        target_type: 'system',
        target_id: null,
        details: { event, data, severity },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar evento:', error);
      return NextResponse.json(
        { error: 'Erro ao registrar evento' },
        { status: 500 }
      );
    }

    return NextResponse.json(logEntry, { status: 201 });
  } catch (error) {
    console.error('Erro no registro de evento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}