const { createClient } = require('@supabase/supabase-js');
const webrtcSignalingService = require('../services/webrtcSignalingService');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WebRTCController {
  // Endpoint específico para chamadas de interfone
  async initiateIntercomCall(req, res) {
    try {
      console.log('🏢 Iniciando chamada de interfone:', req.body);

      const { callerId, apartmentNumber, buildingId, timeout = 30000 } = req.body;

      // Validação de entrada
      if (!callerId) {
        return res.status(400).json({
          success: false,
          error: 'callerId é obrigatório',
          code: 'MISSING_CALLER_ID'
        });
      }

      if (!apartmentNumber) {
        return res.status(400).json({
          success: false,
          error: 'apartmentNumber é obrigatório',
          code: 'MISSING_APARTMENT_NUMBER'
        });
      }

      if (!buildingId) {
        return res.status(400).json({
          success: false,
          error: 'buildingId é obrigatório',
          code: 'MISSING_BUILDING_ID'
        });
      }

      // Verificar se o caller existe (porteiro)
      const { data: caller, error: callerError } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, building_id')
        .eq('id', callerId)
        .single();

      if (callerError || !caller) {
        console.error('❌ Porteiro não encontrado:', callerError);
        return res.status(404).json({
          success: false,
          error: 'Porteiro não encontrado',
          code: 'CALLER_NOT_FOUND'
        });
      }

      if (caller.user_type !== 'porteiro') {
        return res.status(403).json({
          success: false,
          error: 'Apenas porteiros podem fazer chamadas de interfone',
          code: 'UNAUTHORIZED_CALLER'
        });
      }

      // Verificar se o porteiro pertence ao prédio
      if (caller.building_id !== buildingId) {
        return res.status(403).json({
          success: false,
          error: 'Porteiro não autorizado para este prédio',
          code: 'UNAUTHORIZED_BUILDING'
        });
      }

      // Usar o serviço WebRTC para iniciar a chamada de interfone
      const webrtcService = require('../services/webrtcService');
      
      const result = await webrtcService.initiateApartmentCall(
        callerId, 
        apartmentNumber, 
        buildingId, 
        { timeout }
      );

      console.log(`✅ Chamada de interfone iniciada com sucesso: ${result.callsInitiated} moradores contactados`);

      res.json({
        success: true,
        message: result.message,
        data: {
          intercomGroupId: result.intercomGroupId,
          apartmentNumber: result.apartmentNumber,
          buildingId: result.buildingId,
          totalResidents: result.totalResidents,
          activeResidents: result.activeResidents,
          callsInitiated: result.callsInitiated,
          notificationsSent: result.notificationsSent,
          calls: result.calls.map(call => ({
            id: call.id,
            receiverId: call.receiver_id,
            residentName: call.resident.name,
            isPrimary: call.resident.is_primary,
            status: call.status
          })),
          timeout: timeout
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erro ao iniciar chamada de interfone:', error);
      
      // Tratamento específico de erros
      let errorCode = 'INTERNAL_ERROR';
      let statusCode = 500;
      
      if (error.message.includes('Nenhum morador encontrado')) {
        errorCode = 'APARTMENT_NOT_FOUND';
        statusCode = 404;
      } else if (error.message.includes('Nenhum morador ativo')) {
        errorCode = 'NO_ACTIVE_RESIDENTS';
        statusCode = 404;
      } else if (error.message.includes('Não foi possível iniciar chamadas')) {
        errorCode = 'CALL_INITIATION_FAILED';
        statusCode = 500;
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Listar moradores disponíveis para chamada
  async getAvailableResidents(req, res) {
    try {
      console.log('Buscando moradores disponíveis para WebRTC');

      const { data: residents, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          user_type,
          is_online,
          is_available,
          last_seen,
          user_type
        `)
        .eq('user_type', 'morador')
        .eq('is_available', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar moradores:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar moradores disponíveis',
          details: error.message
        });
      }

      // Adicionar informações de status em tempo real
      const residentsWithStatus = residents.map(resident => ({
        ...resident,
        isConnectedNow: webrtcSignalingService.connectedUsers.has(resident.id)
      }));

      res.json({
        success: true,
        residents: residentsWithStatus,
        total: residentsWithStatus.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro interno ao buscar moradores:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Iniciar uma nova chamada WebRTC
  async initiateCall(req, res) {
    try {
      console.log('Iniciando chamada WebRTC:', req.body);

      const { callerId, receiverId, callType = 'audio' } = req.body;

      // Validação de entrada
      if (!callerId || !receiverId) {
        return res.status(400).json({
          success: false,
          error: 'callerId e receiverId são obrigatórios'
        });
      }

      if (callerId === receiverId) {
        return res.status(400).json({
          success: false,
          error: 'Não é possível fazer chamada para si mesmo'
        });
      }

      // Verificar se o caller existe e está ativo
      const { data: caller, error: callerError } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, is_online, is_available')
        .eq('id', callerId)
        .single();

      if (callerError || !caller) {
        return res.status(404).json({
          success: false,
          error: 'Usuário chamador não encontrado'
        });
      }

      // Verificar se o receiver existe e está disponível
      const { data: receiver, error: receiverError } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, is_online, is_available')
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
          error: 'Usuário destinatário não está disponível para chamadas'
        });
      }

      // Verificar se já existe uma chamada ativa entre os usuários
      const { data: existingCall, error: existingCallError } = await supabase
        .from('webrtc_calls')
        .select('id, status')
        .or(`and(caller_id.eq.${callerId},receiver_id.eq.${receiverId}),and(caller_id.eq.${receiverId},receiver_id.eq.${callerId})`)
        .in('status', ['initiated', 'ringing', 'answered'])
        .limit(1);

      if (existingCall && existingCall.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Já existe uma chamada ativa entre estes usuários',
          existingCallId: existingCall[0].id
        });
      }

      // Criar registro da chamada no banco de dados
      const { data: call, error: callError } = await supabase
        .from('webrtc_calls')
        .insert({
          caller_id: callerId,
          receiver_id: receiverId,
          call_type: callType,
          status: 'initiated',
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (callError) {
        console.error('Erro ao criar chamada:', callError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao iniciar chamada',
          details: callError.message
        });
      }

      // Registrar evento da chamada
      await this.logCallEvent(call.id, 'call_initiated', {
        caller_id: callerId,
        receiver_id: receiverId,
        call_type: callType
      });

      // Gerar configurações WebRTC
      const webrtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      };

      // Gerar sala WebSocket única
      const socketRoom = `call_${call.id}`;

      res.status(201).json({
        success: true,
        call: {
          id: call.id,
          callerId,
          receiverId,
          callType,
          status: 'initiated',
          initiatedAt: call.initiated_at,
          socketRoom,
          webrtcConfig
        },
        caller: {
          id: caller.id,
          name: caller.name,
          userType: caller.user_type
        },
        receiver: {
          id: receiver.id,
          name: receiver.name,
          userType: receiver.user_type
        }
      });

    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Responder a uma chamada
  async answerCall(req, res) {
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
          error: 'Erro ao responder chamada',
          details: updateError.message
        });
      }

      // Registrar evento
      await this.logCallEvent(callId, 'call_answered', {
        answered_by: userId,
        answered_at: new Date().toISOString()
      });

      res.json({
        success: true,
        callId,
        status: 'answered',
        answeredAt: new Date().toISOString(),
        socketRoom: `call_${callId}`
      });

    } catch (error) {
      console.error('Erro ao responder chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Encerrar uma chamada
  async endCall(req, res) {
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

      // Verificar se o usuário tem permissão para encerrar a chamada
      if (call.caller_id !== userId && call.receiver_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Usuário não tem permissão para encerrar esta chamada'
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
          error: 'Erro ao encerrar chamada',
          details: updateError.message
        });
      }

      // Registrar evento
      await this.logCallEvent(callId, 'call_ended', {
        ended_by: userId,
        end_reason: endReason,
        duration_seconds: durationSeconds,
        ended_at: new Date().toISOString()
      });

      res.json({
        success: true,
        callId,
        status: 'ended',
        endedAt: new Date().toISOString(),
        duration: durationSeconds,
        endReason,
        endedBy: userId
      });

    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Obter histórico de chamadas
  async getCallHistory(req, res) {
    try {
      const { userId, limit = 50, offset = 0, status, callType } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId é obrigatório'
        });
      }

      console.log(`Buscando histórico de chamadas para usuário ${userId}`);

      let query = supabase
        .from('webrtc_calls')
        .select(`
          id,
          call_type,
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
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      // Filtros opcionais
      if (status) {
        query = query.eq('status', status);
      }

      if (callType) {
        query = query.eq('call_type', callType);
      }

      const { data: calls, error } = await query;

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar histórico de chamadas',
          details: error.message
        });
      }

      // Processar dados para incluir informações adicionais
      const processedCalls = calls.map(call => ({
        ...call,
        direction: call.caller.id === userId ? 'outgoing' : 'incoming',
        otherParty: call.caller.id === userId ? call.receiver : call.caller,
        formattedDuration: this.formatDuration(call.duration_seconds)
      }));

      res.json({
        success: true,
        calls: processedCalls,
        total: processedCalls.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: processedCalls.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Obter status de usuários
  async getUsersStatus(req, res) {
    try {
      const { userIds } = req.query;

      let query = supabase
        .from('profiles')
        .select('id, full_name, user_type, is_online, is_available, last_seen');

      if (userIds) {
        const ids = userIds.split(',').map(id => id.trim());
        query = query.in('id', ids);
      }

      const { data: users, error } = await query;

      if (error) {
        console.error('Erro ao buscar status dos usuários:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar status dos usuários',
          details: error.message
        });
      }

      // Adicionar informações de conexão em tempo real
      const usersWithRealTimeStatus = users.map(user => ({
        ...user,
        isConnectedNow: webrtcSignalingService.connectedUsers.has(user.id),
        lastSeenFormatted: this.formatLastSeen(user.last_seen)
      }));

      res.json({
        success: true,
        users: usersWithRealTimeStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao buscar status:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Atualizar status do usuário
  async updateUserStatus(req, res) {
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
          error: 'Erro ao atualizar status do usuário',
          details: error.message
        });
      }

      res.json({
        success: true,
        message: 'Status atualizado com sucesso',
        updatedFields: updateData
      });

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }

  // Obter estatísticas do sistema WebRTC
  async getSystemStats(req, res) {
    try {
      // Estatísticas do banco de dados
      const [totalUsersResult, onlineUsersResult, totalCallsResult, activeCallsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('webrtc_calls').select('id', { count: 'exact', head: true }),
        supabase.from('webrtc_calls').select('id', { count: 'exact', head: true }).in('status', ['initiated', 'ringing', 'answered'])
      ]);

      // Estatísticas em tempo real do serviço de sinalização
      const realtimeStats = webrtcSignalingService.getSystemStats();

      res.json({
        success: true,
        stats: {
          database: {
            totalUsers: totalUsersResult.count || 0,
            onlineUsers: onlineUsersResult.count || 0,
            totalCalls: totalCallsResult.count || 0,
            activeCalls: activeCallsResult.count || 0
          },
          realtime: realtimeStats,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar estatísticas do sistema',
        details: error.message
      });
    }
  }

  // Métodos auxiliares
  async logCallEvent(callId, eventType, eventData) {
    try {
      await supabase
        .from('webrtc_call_events')
        .insert({
          call_id: callId,
          event_type: eventType,
          event_data: eventData,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao registrar evento da chamada:', error);
    }
  }

  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Nunca';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dias atrás`;
  }
}

module.exports = new WebRTCController();