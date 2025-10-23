import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Interface para dados do admin
interface AdminData {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
}

// Função para extrair e verificar token JWT
export async function verifyAuthToken(request: NextRequest): Promise<{ admin?: AdminData; error?: string; status?: number }> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Token de autenticação necessário', status: 401 };
    }

    const token = authHeader.substring(7);
    
    // Verificar se o token está na blacklist
    const { data: blacklistedToken } = await supabase
      .from('token_blacklist')
      .select('id')
      .eq('token_hash', hashToken(token))
      .single();

    if (blacklistedToken) {
      return { error: 'Token inválido', status: 401 };
    }

    // Verificar e decodificar token
    const decoded = verify(token, process.env.JWT_SECRET || 'your-jwt-secret') as any;
    
    // Buscar dados atualizados do admin
    const { data: admin, error } = await supabase
      .from('admins')
      .select(`
        id,
        email,
        status,
        role:roles(name, hierarchy_level),
        user_permissions(
          permission:permissions(name, resource, action)
        )
      `)
      .eq('id', decoded.id)
      .single();

    if (error || !admin) {
      return { error: 'Token inválido', status: 401 };
    }

    // Verificar se a conta está ativa
    if (admin.status !== 'active') {
      return { error: 'Conta desativada', status: 403 };
    }

    // Extrair permissões
    const permissions = admin.user_permissions?.map((up: any) => up.permission.name) || [];
    
    return {
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role?.name || 'user',
        permissions,
        status: admin.status
      }
    };
  } catch (error) {
    console.error('Erro na verificação de token:', error);
    return { error: 'Token inválido', status: 401 };
  }
}

// Função para verificar se o usuário tem uma permissão específica
export function hasPermission(admin: AdminData, resource: string, action: string): boolean {
  // Super admin tem todas as permissões
  if (admin.role === 'super_admin') {
    return true;
  }

  // Verificar permissão específica
  const permissionName = `${resource}:${action}`;
  return admin.permissions.includes(permissionName);
}

// Função para verificar se o usuário tem um role específico
export function hasRole(admin: AdminData, requiredRole: string): boolean {
  return admin.role === requiredRole;
}

// Função para verificar se o usuário tem pelo menos um dos roles
export function hasAnyRole(admin: AdminData, roles: string[]): boolean {
  return roles.includes(admin.role);
}

// Middleware para rotas que requerem autenticação
export async function requireAuth(request: NextRequest): Promise<NextResponse | { admin: AdminData }> {
  const authResult = await verifyAuthToken(request);
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  return { admin: authResult.admin! };
}

// Middleware para rotas que requerem super admin
export async function requireSuperAdmin(request: NextRequest): Promise<NextResponse | { admin: AdminData }> {
  const authResult = await verifyAuthToken(request);
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  if (!hasRole(authResult.admin!, 'super_admin')) {
    return NextResponse.json(
      { error: 'Acesso negado - Super Admin necessário' },
      { status: 403 }
    );
  }

  return { admin: authResult.admin! };
}

// Middleware para rotas que requerem permissão específica
export async function requirePermission(request: NextRequest, resource: string, action: string): Promise<NextResponse | { admin: AdminData }> {
  const authResult = await verifyAuthToken(request);
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  if (!hasPermission(authResult.admin!, resource, action)) {
    return NextResponse.json(
      { error: `Acesso negado - Permissão necessária: ${resource}:${action}` },
      { status: 403 }
    );
  }

  return { admin: authResult.admin! };
}

// Função para registrar atividade de segurança
export async function logSecurityEvent(admin: AdminData, event: string, details: any, request: NextRequest) {
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await supabase.from('security_logs').insert({
      admin_id: admin.id,
      event,
      details: {
        ...details,
        ip_address: ip,
        user_agent: userAgent,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao registrar evento de segurança:', error);
  }
}

// Função para validar entrada de dados
export function validateInput(data: any, rules: { [key: string]: any }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    // Verificar se é obrigatório
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors.push(`${field} é obrigatório`);
      continue;
    }

    // Verificar tipo
    if (value && rule.type && typeof value !== rule.type) {
      errors.push(`${field} deve ser do tipo ${rule.type}`);
    }

    // Verificar tamanho mínimo
    if (value && rule.minLength && value.length < rule.minLength) {
      errors.push(`${field} deve ter pelo menos ${rule.minLength} caracteres`);
    }

    // Verificar tamanho máximo
    if (value && rule.maxLength && value.length > rule.maxLength) {
      errors.push(`${field} deve ter no máximo ${rule.maxLength} caracteres`);
    }

    // Verificar padrão regex
    if (value && rule.pattern && !rule.pattern.test(value)) {
      errors.push(`${field} tem formato inválido`);
    }

    // Verificar valores permitidos
    if (value && rule.enum && !rule.enum.includes(value)) {
      errors.push(`${field} deve ser um dos valores: ${rule.enum.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Função para sanitizar entrada de dados
export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return data.trim().replace(/<script[^>]*>.*?<\/script>/gi, '');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Função para gerar hash de token (para blacklist)
function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Função para rate limiting por IP
export async function checkRateLimit(request: NextRequest, maxRequests = 100, windowMs = 60000): Promise<boolean> {
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    const { count } = await supabase
      .from('rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', windowStart);

    if ((count || 0) >= maxRequests) {
      return false;
    }

    // Registrar requisição
    await supabase.from('rate_limit_log').insert({
      ip_address: ip,
      created_at: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Erro no rate limiting:', error);
    return true; // Em caso de erro, permitir requisição
  }
}

// Função para detectar atividade suspeita
export async function detectSuspiciousActivity(admin: AdminData, request: NextRequest): Promise<boolean> {
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Verificar múltiplos IPs para o mesmo usuário
    const { data: recentIPs } = await supabase
      .from('security_logs')
      .select('details')
      .eq('admin_id', admin.id)
      .gte('created_at', oneHourAgo)
      .limit(10);

    if (recentIPs && recentIPs.length > 0) {
      const uniqueIPs = new Set(recentIPs.map(log => log.details?.ip_address).filter(Boolean));
      if (uniqueIPs.size > 3) {
        await logSecurityEvent(admin, 'suspicious_multiple_ips', {
          unique_ips: Array.from(uniqueIPs),
          count: uniqueIPs.size
        }, request);
        return true;
      }
    }

    // Verificar tentativas de acesso a recursos não autorizados
    const { count: unauthorizedAttempts } = await supabase
      .from('security_logs')
      .select('id', { count: 'exact', head: true })
      .eq('admin_id', admin.id)
      .eq('event', 'unauthorized_access_attempt')
      .gte('created_at', oneHourAgo);

    if ((unauthorizedAttempts || 0) > 5) {
      await logSecurityEvent(admin, 'suspicious_unauthorized_attempts', {
        attempts_count: unauthorizedAttempts
      }, request);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Erro na detecção de atividade suspeita:', error);
    return false;
  }
}