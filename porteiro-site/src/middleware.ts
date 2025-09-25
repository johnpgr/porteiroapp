import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, logSecurityEvent, verifyAuthToken, detectSuspiciousActivity } from './middleware/auth';

// Rotas que requerem autenticação
const protectedRoutes = [
  '/api/admin',
  '/super-admin'
];

// Rotas que requerem super admin
const superAdminRoutes = [
  '/api/admin/admins',
  '/api/admin/access-control',
  '/api/admin/metrics',
  '/api/admin/audit-logs',
  '/super-admin'
];

// Rotas públicas que não precisam de autenticação
const publicRoutes = [
  '/api/admin/auth',
  '/login',
  '/api/health'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Permitir rotas públicas
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verificar rate limiting para todas as rotas
  const rateLimitPassed = await checkRateLimit(request, 100, 60000); // 100 requests per minute
  if (!rateLimitPassed) {
    console.warn(`Rate limit exceeded for IP: ${request.ip}`);
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
      { status: 429 }
    );
  }

  // Verificar se é uma rota protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isSuperAdminRoute = superAdminRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute || isSuperAdminRoute) {
    try {
      // Verificar autenticação
      const authResult = await verifyAuthToken(request);
      
      if (authResult.error) {
        // Log tentativa de acesso não autorizado
        console.warn(`Unauthorized access attempt to ${pathname} from IP: ${request.ip}`);
        
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status || 401 }
        );
      }

      const admin = authResult.admin!;

      // Verificar se é rota de super admin
      if (isSuperAdminRoute && admin.role !== 'super_admin') {
        // Log tentativa de acesso não autorizado
        await logSecurityEvent(admin, 'unauthorized_access_attempt', {
          attempted_route: pathname,
          user_role: admin.role,
          required_role: 'super_admin'
        }, request);

        return NextResponse.json(
          { error: 'Acesso negado - Super Admin necessário' },
          { status: 403 }
        );
      }

      // Detectar atividade suspeita
      const isSuspicious = await detectSuspiciousActivity(admin, request);
      if (isSuspicious) {
        console.warn(`Suspicious activity detected for admin ${admin.id}`);
        // Não bloquear, apenas registrar
      }

      // Adicionar informações do admin aos headers para as rotas API
      if (pathname.startsWith('/api/')) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-admin-id', admin.id);
        requestHeaders.set('x-admin-email', admin.email);
        requestHeaders.set('x-admin-role', admin.role);
        requestHeaders.set('x-admin-permissions', JSON.stringify(admin.permissions));

        return NextResponse.next({
          request: {
            headers: requestHeaders
          }
        });
      }

      // Para rotas de página, verificar se o usuário tem acesso
      if (pathname.startsWith('/super-admin')) {
        if (admin.role !== 'super_admin') {
          return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
        }
      }

      return NextResponse.next();
    } catch (error) {
      console.error('Erro no middleware de autenticação:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }
  }

  return NextResponse.next();
}

// Configuração do middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

// Função auxiliar para extrair informações do admin dos headers (para uso nas APIs)
export function getAdminFromHeaders(request: NextRequest) {
  const adminId = request.headers.get('x-admin-id');
  const adminEmail = request.headers.get('x-admin-email');
  const adminRole = request.headers.get('x-admin-role');
  const adminPermissions = request.headers.get('x-admin-permissions');

  if (!adminId || !adminEmail || !adminRole) {
    return null;
  }

  return {
    id: adminId,
    email: adminEmail,
    role: adminRole,
    permissions: adminPermissions ? JSON.parse(adminPermissions) : [],
    status: 'active'
  };
}

// Função para validar CSRF token (para formulários)
export function validateCSRFToken(request: NextRequest): boolean {
  try {
    const csrfToken = request.headers.get('x-csrf-token');
    const sessionToken = request.cookies.get('csrf-token')?.value;
    
    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro na validação CSRF:', error);
    return false;
  }
}

// Função para gerar CSRF token
export function generateCSRFToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// Headers de segurança
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent XSS attacks
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // HTTPS enforcement
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}