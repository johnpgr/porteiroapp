const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const WebRTCController = require('../controllers/webrtcController');
const {
  authenticateWebRTC,
  requireAdmin,
  requirePorteiro,
  requireMorador,
  rateLimitCalls,
  validateCallParams,
  validateIntercomParams,
  logIntercomCall,
  handleWebRTCErrors
} = require('../middleware/webrtcAuth');
const { getIceConfiguration, getMediaConfiguration, getEnvironmentConfig } = require('../config/webrtcConfig');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuração WebRTC - Servidores STUN/TURN gratuitos
const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// POST /api/webrtc/intercom - Endpoint específico para chamadas de interfone
router.post('/webrtc/intercom', 
  authenticateWebRTC,
  requirePorteiro,
  validateIntercomParams,
  logIntercomCall,
  rateLimitCalls,
  async (req, res, next) => {
    try {
      await WebRTCController.initiateIntercomCall(req, res);
    } catch (error) {
      handleWebRTCErrors(error, req, res, next);
    }
  }
);

// GET /api/webrtc/residents - Listar moradores disponíveis
router.get('/webrtc/residents', authenticateWebRTC, requirePorteiro, async (req, res) => {
  try {
    console.log('Buscando moradores disponíveis para WebRTC');

    const { data: residents, error } = await supabase
      .from('profiles')
      .select('id, full_name, user_type, is_online, is_available')
      .eq('user_type', 'morador')
      .eq('is_available', true)
      .order('full_name');

    if (error) {
      console.error('Erro ao buscar moradores:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar moradores disponíveis'
      });
    }

    res.json({
      success: true,
      residents: residents || [],
      total: residents ? residents.length : 0
    });

  } catch (error) {
    console.error('Erro interno ao buscar moradores:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/webrtc/call/initiate - Iniciar chamada WebRTC
router.post('/webrtc/call/initiate', authenticateWebRTC, rateLimitCalls, validateCallParams, async (req, res) => {
  try {
    console.log('Iniciando chamada WebRTC:', req.body);

    const { callerId, receiverId, callType = 'audio' } = req.body;

    if (!callerId || !receiverId) {
      return res.status(400).json({
        success: false,
        error: 'callerId e receiverId são obrigatórios'
      });
    }

    // Verificar se o receptor está disponível
    const { data: receiver, error: receiverError } = await supabase
      .from('profiles')
      .select('id, full_name, is_online, is_available')
      .eq('id', receiverId)
      .single();

    if (receiverError || !receiver) {
      return res.status(404).json({
        success: false,
        error: 'Usuário destinatário não encontrado'
      });
    }

    if (!receiver.is_available) {
      return res.status(400).json({
        success: false,
        error: 'Usuário destinatário não está disponível'
      });
    }

    // Criar registro da chamada
    const { data: call, error: callError } = await supabase
      .from('webrtc_calls')
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        status: 'initiated'
      })
      .select()
      .single();

    if (callError) {
      console.error('Erro ao criar chamada:', callError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao iniciar chamada'
      });
    }

    // Gerar sala WebSocket única
    const socketRoom = `call_${call.id}`;

    res.json({
      success: true,
      callId: call.id,
      socketRoom,
      iceServers: WEBRTC_CONFIG.iceServers,
      receiver: {
        id: receiver.id,
        name: receiver.name
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar chamada:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/webrtc/call/:callId/answer - Responder chamada
router.post('/webrtc/call/:callId/answer', authenticateWebRTC, async (req, res) => {
  try {
    const { callId } = req.params;
    const { userId } = req.body;

    console.log(`Respondendo chamada ${callId} pelo usuário ${userId}`);

    // Verificar se a chamada existe e está no status correto
    const { data: call, error: callError } = await supabase
      .from('webrtc_calls')
      .select('*')
      .eq('id', callId)
      .eq('receiver_id', userId)
      .in('status', ['initiated', 'ringing'])
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        error: 'Chamada não encontrada ou não pode ser respondida'
      });
    }

    // Atualizar status da chamada
    const { error: updateError } = await supabase
      .from('webrtc_calls')
      .update({
        status: 'answered',
        answered_at: new Date().toISOString()
      })
      .eq('id', callId);

    if (updateError) {
      console.error('Erro ao atualizar chamada:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao responder chamada'
      });
    }

    res.json({
      success: true,
      callId,
      status: 'answered',
      socketRoom: `call_${callId}`,
      iceServers: WEBRTC_CONFIG.iceServers
    });

  } catch (error) {
    console.error('Erro ao responder chamada:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/webrtc/call/:callId/end - Encerrar chamada
router.post('/webrtc/call/:callId/end', authenticateWebRTC, async (req, res) => {
  try {
    const { callId } = req.params;
    const { userId, endReason = 'user_ended' } = req.body;

    console.log(`Encerrando chamada ${callId} pelo usuário ${userId}`);

    // Buscar dados da chamada para calcular duração
    const { data: call, error: callError } = await supabase
      .from('webrtc_calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        error: 'Chamada não encontrada'
      });
    }

    // Calcular duração se a chamada foi respondida
    let durationSeconds = 0;
    if (call.answered_at) {
      const answeredTime = new Date(call.answered_at);
      const endTime = new Date();
      durationSeconds = Math.floor((endTime - answeredTime) / 1000);
    }

    // Atualizar status da chamada
    const { error: updateError } = await supabase
      .from('webrtc_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        end_reason: endReason
      })
      .eq('id', callId);

    if (updateError) {
      console.error('Erro ao encerrar chamada:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao encerrar chamada'
      });
    }

    res.json({
      success: true,
      callId,
      status: 'ended',
      duration: durationSeconds,
      endReason
    });

  } catch (error) {
    console.error('Erro ao encerrar chamada:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/webrtc/call/history - Histórico de chamadas
router.get('/webrtc/call/history', authenticateWebRTC, async (req, res) => {
  try {
    const { userId, limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    console.log(`Buscando histórico de chamadas para usuário ${userId}`);

    const { data: calls, error } = await supabase
      .from('webrtc_calls')
      .select(`
        id,
        status,
        initiated_at,
        answered_at,
        ended_at,
        duration_seconds,
        end_reason,
        caller:caller_id(id, name, user_type),
        receiver:receiver_id(id, name, user_type)
      `)
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('initiated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de chamadas'
      });
    }

    res.json({
      success: true,
      calls: calls || [],
      total: calls ? calls.length : 0
    });

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/webrtc/users/status - Status online/offline de usuários
router.get('/webrtc/users/status', authenticateWebRTC, async (req, res) => {
  try {
    const { userIds } = req.query;

    let query = supabase
      .from('profiles')
      .select('id, full_name, user_type, is_online, is_available, last_seen');

    if (userIds) {
      const ids = userIds.split(',');
      query = query.in('id', ids);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Erro ao buscar status dos usuários:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar status dos usuários'
      });
    }

    res.json({
      success: true,
      users: users || []
    });

  } catch (error) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter configurações WebRTC (STUN/TURN servers)
router.get('/config', authenticateWebRTC, async (req, res) => {
  try {
    const { quality = 'medium', audioOnly = false } = req.query;
    
    const config = {
      iceConfiguration: getIceConfiguration(),
      mediaConstraints: getMediaConfiguration(quality, audioOnly === 'true'),
      environment: getEnvironmentConfig(),
      userType: req.user.userType
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Erro ao obter configurações WebRTC:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/webrtc/users/status - Atualizar status do usuário
router.post('/webrtc/users/status', authenticateWebRTC, async (req, res) => {
  try {
    const { userId, isOnline, isAvailable } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    const updateData = {
      last_seen: new Date().toISOString()
    };

    if (typeof isOnline === 'boolean') {
      updateData.is_online = isOnline;
    }

    if (typeof isAvailable === 'boolean') {
      updateData.is_available = isAvailable;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status do usuário'
      });
    }

    res.json({
      success: true,
      message: 'Status atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;