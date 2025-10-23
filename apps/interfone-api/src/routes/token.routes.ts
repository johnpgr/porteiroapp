import type { Request, Response, Router, NextFunction } from 'express';
import express from 'express';
import TokenController from '../controllers/token.controller.ts';
import agoraService from '../services/agora.service.ts';
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

const router: Router = express.Router();

// Simple auth middleware using Supabase access token
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    const { client } = SupabaseClientFactory.createServerClient({
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    });
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    (req as any).authUser = data.user;
    next();
  } catch (e) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

// Helper to extract client IP securely (prevents spoofing)
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  // Use leftmost IP from x-forwarded-for to prevent spoofing
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(',')[0]?.trim() || 'unknown';
  }
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || 'unknown';
}

// Simple in-memory rate limiter (per IP)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 req/min
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

// Cleanup expired rate limit buckets to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateBuckets.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const key = `${ip}`;
  const now = Date.now();

  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ success: false, error: 'Too Many Requests' });
    return;
  }

  bucket.count += 1;
  return next();
}

/**
 * Rotas para gerenciamento de tokens RTC da Agora
 * Todas as rotas são prefixadas com /api/tokens
 */

// Apply rate limiting to all token routes
router.use(rateLimit);

/**
 * POST /api/tokens/generate
 * Gera um token RTC para um usuário específico
 * Body: { channelName, uid, role? }
 */
router.post('/generate', requireAuth, TokenController.generateToken);

/**
 * POST /api/tokens/generate-multiple
 * Gera tokens para múltiplos usuários (útil para chamadas em grupo)
 * Body: { channelName, participants: [{ uid, role? }] }
 */
router.post('/generate-multiple', requireAuth, TokenController.generateMultipleTokens);

/**
 * POST /api/tokens/for-call
 * Gera token vinculado a uma chamada existente
 * Body: { callId, uid, role? }
 */
router.post('/for-call', requireAuth, TokenController.generateTokenForCall);

/**
 * POST /api/tokens/validate
 * Valida se um token ainda é válido
 * Body: { token, channelName, uid }
 */
router.post('/validate', requireAuth, TokenController.validateToken);

/**
 * GET /api/tokens/test
 * Endpoint de teste para verificar se a API de tokens está funcionando
 */
router.get('/test', (req: Request, res: Response) => {
  const agoraConfigured = !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
  
  res.json({
    success: true,
    message: 'API de tokens funcionando',
    timestamp: new Date().toISOString(),
    configuration: {
      agoraConfigured,
      appId: process.env.AGORA_APP_ID ? 'Configurado' : 'Não configurado',
      appCertificate: process.env.AGORA_APP_CERTIFICATE ? 'Configurado' : 'Não configurado'
    },
    endpoints: {
      'POST /api/tokens/generate': 'Gerar token individual',
      'POST /api/tokens/generate-multiple': 'Gerar múltiplos tokens',
      'POST /api/tokens/validate': 'Validar token',
      'POST /api/tokens/for-call': 'Gerar token vinculado a chamada'
    }
  });
});

/**
 * GET /api/tokens/config
 * Retorna informações de configuração da Agora (sem expor credenciais)
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      appId: agoraService.getAppId(),
      configured: !!agoraService.getAppId(),
      defaultTtlSeconds: agoraService.getDefaultTtlSeconds()
    }
  });
});

export default router;
