import type { Request, Response, Router } from 'express';
import express from 'express';
import CallController from '../controllers/call.controller.ts';

const router: Router = express.Router();

/**
 * Rotas para gerenciamento de chamadas de interfone
 * Todas as rotas são prefixadas com /api/calls
 */

/**
 * POST /api/calls/start
 * Inicia uma nova chamada de interfone
 * Body: { apartmentNumber, doormanId, buildingId }
 */
router.post('/start', CallController.startCall);

/**
 * POST /api/calls/:callId/answer
 * Atende uma chamada específica
 * Body: { userId, userType }
 */
router.post('/:callId/answer', CallController.answerCall);

/**
 * POST /api/calls/:callId/decline
 * Recusa uma chamada específica
 * Body: { userId, userType }
 */
router.post('/:callId/decline', CallController.declineCall);

/**
 * POST /api/calls/:callId/end
 * Encerra uma chamada específica
 * Body: { userId, userType }
 */
router.post('/:callId/end', CallController.endCall);

/**
 * GET /api/calls/:callId/status
 * Busca o status atual de uma chamada
 */
router.get('/:callId/status', CallController.getCallStatus);

/**
 * GET /api/calls/history
 * Lista o histórico de chamadas
 * Query params: buildingId, userId, userType, limit, offset
 */
router.get('/history', CallController.getCallHistory);

/**
 * GET /api/calls/active
 * Busca chamadas ativas no prédio
 * Query params: buildingId
 */
router.get('/active', CallController.getActiveCalls);

/**
 * GET /api/calls/test
 * Endpoint de teste para verificar se a API está funcionando
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API de chamadas funcionando',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /api/calls/start': 'Iniciar chamada',
      'POST /api/calls/:callId/answer': 'Atender chamada',
      'POST /api/calls/:callId/decline': 'Recusar chamada',
      'POST /api/calls/:callId/end': 'Encerrar chamada',
      'GET /api/calls/:callId/status': 'Status da chamada',
      'GET /api/calls/history': 'Histórico de chamadas',
      'GET /api/calls/active': 'Chamadas ativas'
    }
  });
});

export default router;
