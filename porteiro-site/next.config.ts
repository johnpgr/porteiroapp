import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // Otimizações para rotas dinâmicas
  experimental: {
    // Melhor performance para rotas dinâmicas
    optimizePackageImports: ['lucide-react'],
  },
  
  // Define a raiz de rastreamento de arquivos para monorepo, evitando warning de múltiplos lockfiles
  outputFileTracingRoot: path.join(__dirname, '..'),
  
  // Configurações de headers para segurança e performance
  async headers() {
    return [
      {
        // Aplicar headers de segurança para todas as rotas
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
        ],
      },
      {
        // Headers específicos para rotas de token (cache otimizado)
        source: '/(cadastro|visita)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=60'
          },
        ],
      },
    ];
  },

  // Configurações de redirecionamento para melhorar UX
  async redirects() {
    return [
      {
        // Redirecionar rotas de cadastro sem token para página inicial
        source: '/cadastro/:type(morador|visitante)',
        destination: '/',
        permanent: false,
      },
      {
        // Redirecionar rota de visita sem token para página inicial
        source: '/visita',
        destination: '/',
        permanent: false,
      },
    ];
  },

  // Configurações de build para produção
  compress: true,
  poweredByHeader: false,
  
  // Otimizações de imagem
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
