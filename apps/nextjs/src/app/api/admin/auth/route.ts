import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClientFactory } from '@porteiroapp/supabase';
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Database } from '@porteiroapp/supabase';

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type Admin = Tables<'admin_profiles'>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

const { client: supabase } = SupabaseClientFactory.createServerClient({
  url: supabaseUrl,
  key: supabaseServiceKey,
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
});

// Função para gerar hash da senha
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Função para verificar senha
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Função para gerar JWT
function generateToken(admin: Admin): string {
  return sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

// Função para registrar tentativa de login
async function logLoginAttempt(email: string, success: boolean, ip: string, userAgent: string) {
  try {
    await supabase.from('login_attempts').insert({
      email,
      success,
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao registrar tentativa de login:', error);
  }
}

// Função para verificar rate limiting
async function checkRateLimit(email: string, ip: string): Promise<boolean> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Verificar tentativas por email
    const { count: emailAttempts } = await supabase
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('success', false)
      .gte('created_at', fiveMinutesAgo);

    // Verificar tentativas por IP
    const { count: ipAttempts } = await supabase
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .eq('success', false)
      .gte('created_at', fiveMinutesAgo);

    // Limite: 5 tentativas por email ou 10 por IP em 5 minutos
    return (emailAttempts || 0) < 5 && (ipAttempts || 0) < 10;
  } catch (error) {
    console.error('Erro ao verificar rate limit:', error);
    return true; // Em caso de erro, permitir tentativa
  }
}

// POST - Login de super-admin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action = 'login' } = body;
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (action === 'login') {
      // Validação dos dados
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email e senha são obrigatórios' },
          { status: 400 }
        );
      }

      // Verificar rate limiting
      const canAttempt = await checkRateLimit(email, ip);
      if (!canAttempt) {
        await logLoginAttempt(email, false, ip, userAgent);
        return NextResponse.json(
          { error: 'Muitas tentativas de login. Tente novamente em 5 minutos.' },
          { status: 429 }
        );
      }

      // Buscar administrador
      const { data: admin, error } = await supabase
        .from('admins')
        .select(`
          *,
          role:roles(*),
          user_permissions(
            permission:permissions(*)
          )
        `)
        .eq('email', email)
        .eq('status', 'active')
        .single();

      if (error || !admin) {
        await logLoginAttempt(email, false, ip, userAgent);
        return NextResponse.json(
          { error: 'Credenciais inválidas' },
          { status: 401 }
        );
      }

      // Verificar se é super-admin
      if (admin.role?.name !== 'super_admin') {
        await logLoginAttempt(email, false, ip, userAgent);
        return NextResponse.json(
          { error: 'Acesso negado - Super Admin necessário' },
          { status: 403 }
        );
      }

      // Verificar senha
      const isValidPassword = await verifyPassword(password, admin.password_hash);
      if (!isValidPassword) {
        await logLoginAttempt(email, false, ip, userAgent);
        return NextResponse.json(
          { error: 'Credenciais inválidas' },
          { status: 401 }
        );
      }

      // Gerar token
      const token = generateToken(admin);

      // Atualizar último login
      await supabase
        .from('admins')
        .update({ 
          last_login: new Date().toISOString(),
          login_count: (admin.login_count || 0) + 1
        })
        .eq('id', admin.id);

      // Registrar login bem-sucedido
      await logLoginAttempt(email, true, ip, userAgent);

      // Log de auditoria
      await supabase.from('audit_logs').insert({
        action: 'super_admin_login',
        target_type: 'admin',
        target_id: admin.id,
        admin_id: admin.id,
        details: { ip_address: ip, user_agent: userAgent },
        created_at: new Date().toISOString()
      });

      // Remover dados sensíveis
      const { password_hash, ...adminData } = admin;

      return NextResponse.json({
        token,
        admin: adminData,
        expiresIn: jwtExpiresIn
      });
    }

    if (action === 'refresh') {
      const { token } = body;

      if (!token) {
        return NextResponse.json(
          { error: 'Token é obrigatório' },
          { status: 400 }
        );
      }

      try {
        const decoded = verify(token, jwtSecret) as any;
        
        // Buscar admin atualizado
        const { data: admin, error } = await supabase
          .from('admins')
          .select(`
            *,
            role:roles(*),
            user_permissions(
              permission:permissions(*)
            )
          `)
          .eq('id', decoded.id)
          .eq('status', 'active')
          .single();

        if (error || !admin) {
          return NextResponse.json(
            { error: 'Token inválido' },
            { status: 401 }
          );
        }

        // Gerar novo token
        const newToken = generateToken(admin);
        const { password_hash, ...adminData } = admin;

        return NextResponse.json({
          token: newToken,
          admin: adminData,
          expiresIn: jwtExpiresIn
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Ação inválida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET - Verificar token e obter dados do usuário
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verify(token, jwtSecret) as any;
      
      // Buscar admin atualizado
      const { data: admin, error } = await supabase
        .from('admins')
        .select(`
          *,
          role:roles(*),
          user_permissions(
            permission:permissions(*)
          )
        `)
        .eq('id', decoded.id)
        .eq('status', 'active')
        .single();

      if (error || !admin) {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        );
      }

      // Verificar se ainda é super-admin
      if (admin.role?.name !== 'super_admin') {
        return NextResponse.json(
          { error: 'Acesso negado - Super Admin necessário' },
          { status: 403 }
        );
      }

      const { password_hash, ...adminData } = admin;

      return NextResponse.json({
        valid: true,
        admin: adminData
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Erro na verificação de token:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Logout
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verify(token, jwtSecret) as any;
      
      // Log de auditoria
      await supabase.from('audit_logs').insert({
        action: 'super_admin_logout',
        target_type: 'admin',
        target_id: decoded.id,
        admin_id: decoded.id,
        details: { 
          ip_address: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown'
        },
        created_at: new Date().toISOString()
      });

      return NextResponse.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Erro no logout:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
