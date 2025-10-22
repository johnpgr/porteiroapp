import type { Request, Response, Router } from 'express';
import express from 'express';
import TokenController from '../controllers/token.controller.ts';

const router: Router = express.Router();

/**
 * Rotas para gerenciamento de tokens RTC da Agora
 * Todas as rotas são prefixadas com /api/tokens
 */

/**
 * POST /api/tokens/generate
 * Gera um token RTC para um usuário específico
 * Body: { channelName, uid, role? }
 */
router.post('/generate', TokenController.generateToken);

/**
 * POST /api/tokens/generate-multiple
 * Gera tokens para múltiplos usuários (útil para chamadas em grupo)
 * Body: { channelName, users: [{ uid, role? }] }
 */
router.post('/generate-multiple', TokenController.generateMultipleTokens);

/**
 * POST /api/tokens/validate
 * Valida se um token ainda é válido
 * Body: { token, channelName, uid }
 */
router.post('/validate', TokenController.validateToken);

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
      'POST /api/tokens/validate': 'Validar token'
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
      appId: process.env.AGORA_APP_ID || null,
      configured: !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE),
      tokenExpirationHours: 24
    }
  });
});

export default router;
