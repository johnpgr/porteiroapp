import { NextRequest, NextResponse } from 'next/server';

// Rotas que requerem validação de token
const TOKEN_PROTECTED_ROUTES = [
  '/cadastro/morador/',
  '/cadastro/visitante/',
  '/visita/'
];

// Rotas da API que não precisam de middleware
const API_ROUTES = [
  '/api/validate-token',
  '/api/process-visit',
  '/api/complete-registration',
  '/api/get-visitor-details'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir todas as rotas da API passarem sem interceptação
  if (API_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verificar se é uma rota protegida por token
  const isTokenProtectedRoute = TOKEN_PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  );

  if (isTokenProtectedRoute) {
    // Extrair token da URL
    const pathSegments = pathname.split('/');
    const token = pathSegments[pathSegments.length - 1];

    // Verificar se o token existe na URL
    if (!token || token.length < 10) {
      // Redirecionar para página de erro se token inválido
      return NextResponse.redirect(new URL('/erro?tipo=token-invalido', request.url));
    }

    // Adicionar headers de cache para otimização
    const response = NextResponse.next();
    
    // Cache de 5 minutos para rotas com token válido
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    
    // Headers de segurança
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return response;
  }

  // Para todas as outras rotas, continuar normalmente
  return NextResponse.next();
}

// Configurar quais rotas o middleware deve interceptar
export const config = {
  matcher: [
    /*
     * Interceptar todas as rotas exceto:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - arquivos com extensão (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};