const { createClient } = require('@supabase/supabase-js');
const webrtcSignalingService = require('./webrtcSignalingService');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WebRTCService {
  constructor() {
    this.CALL_TIMEOUT = 30000; // 30 segundos para timeout de chamada
    this.MAX_CALL_DURATION = 3600000; // 1 hora máxima de chamada
  }

  // Registrar ou atualizar usuário WebRTC (usando tabela profiles)
  async registerUser(userData) {
    try {
      const {
        id,
        name,
        userType,
        buildingId = null,
        deviceToken = null
      } = userData;

      if (!id || !name || !userType) {
        throw new Error('ID, nome e tipo de usuário são obrigatórios');
      }

      // Verificar se o perfil já existe
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', id)
        .single();

      const profileData = {
        id,
        full_name: name,
        user_type: userType,
        building_id: buildingId,
        is_online: true,
        is_available: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let result;
      if (existingProfile) {
        // Atualizar perfil existente
        const { data, error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', id)
          .select()
          .single();
        
        result = { data, error };
      } else {
        // Criar novo perfil
        profileData.created_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single();
        
        result = { data, error };
      }

      // Gerenciar token do dispositivo se fornecido
      if (deviceToken && result.data) {
        await this.updateDeviceToken(result.data.id, deviceToken);
      }

      if (result.error) {
        throw new Error(`Erro ao registrar usuário: ${result.error.message}`);
      }

      console.log(`Usuário WebRTC ${existingProfile ? 'atualizado' : 'registrado'}: ${name} (${id})`);
      return result.data;

    } catch (error) {
      console.error('Erro ao registrar usuário WebRTC:', error);
      throw error;
    }
  }

  // Buscar usuário por ID (usando tabela profiles)
  async getUserById(userId) {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar usuário: ${error.message}`);
      }

      return user;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      throw error;
    }
  }

  // Buscar moradores de um apartamento específico (com tratamento de erros melhorado)
  async getApartmentResidents(apartmentNumber, buildingId) {
    try {
      console.log(`🔍 Buscando moradores do apartamento ${apartmentNumber} no prédio ${buildingId}`);
      
      // Validar parâmetros de entrada
      if (!apartmentNumber || typeof apartmentNumber !== 'string') {
        throw new Error('Número do apartamento é obrigatório e deve ser uma string');
      }
      
      if (!buildingId || typeof buildingId !== 'string') {
        throw new Error('ID do prédio é obrigatório e deve ser uma string');
      }

      const { data: residents, error } = await supabase
        .rpc('get_apartment_residents', {
          apartment_number: apartmentNumber.trim().toUpperCase(),
          building_id: buildingId.trim()
        });

      if (error) {
        console.error('❌ Erro na função RPC get_apartment_residents:', error);
        
        // Tratar erros específicos do Supabase
        if (error.code === 'PGRST116') {
          throw new Error(`Apartamento ${apartmentNumber} não encontrado no prédio especificado`);
        }
        
        if (error.code === 'PGRST301') {
          throw new Error(`Dados inválidos: apartamento "${apartmentNumber}" ou prédio "${buildingId}" não são válidos`);
        }
        
        throw new Error(`Erro ao buscar moradores do apartamento ${apartmentNumber}: ${error.message}`);
      }

      if (!residents || residents.length === 0) {
        console.log(`⚠️ Nenhum morador encontrado no apartamento ${apartmentNumber}`);
        throw new Error(`Apartamento ${apartmentNumber} não possui moradores cadastrados ou não existe`);
      }

      console.log(`✅ Encontrados ${residents.length} moradores no apartamento ${apartmentNumber}`);

      // Adicionar status de conexão em tempo real
      const residentsWithStatus = residents.map(resident => ({
        ...resident,
        isConnectedNow: webrtcSignalingService.connectedUsers.has(resident.profile_id),
        // Normalizar dados para compatibilidade
        id: resident.profile_id,
        name: resident.full_name,
        apartmentNumber: resident.apt_number,
        buildingName: resident.building_name
      }));

      return residentsWithStatus;
    } catch (error) {
      console.error('❌ Erro ao buscar moradores do apartamento:', error);
      
      // Re-throw com mensagem mais específica se necessário
      if (error.message.includes('apartamento não encontrado') || 
          error.message.includes('não possui moradores')) {
        throw error; // Manter mensagem específica
      }
      
      // Erro genérico
      throw new Error(`Falha ao buscar moradores do apartamento ${apartmentNumber}. Verifique se o apartamento existe e possui moradores cadastrados.`);
    }
  }

  // Buscar moradores disponíveis (método legado - mantido para compatibilidade)
  async getAvailableResidents(filters = {}) {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'morador')
        .eq('is_available', true);

      // Aplicar filtros opcionais
      if (filters.buildingId) {
        query = query.eq('building_id', filters.buildingId);
      }

      if (filters.onlineOnly) {
        query = query.eq('is_online', true);
      }

      const { data: residents, error } = await query.order('full_name');

      if (error) {
        throw new Error(`Erro ao buscar moradores: ${error.message}`);
      }

      // Adicionar status de conexão em tempo real
      const residentsWithStatus = residents.map(resident => ({
        ...resident,
        isConnectedNow: webrtcSignalingService.connectedUsers.has(resident.id)
      }));

      return residentsWithStatus;
    } catch (error) {
      console.error('Erro ao buscar moradores disponíveis:', error);
      throw error;
    }
  }

  // Validar se uma chamada pode ser iniciada
  async validateCallInitiation(callerId, receiverId) {
    try {
      // Verificar se os usuários existem
      const [caller, receiver] = await Promise.all([
        this.getUserById(callerId),
        this.getUserById(receiverId)
      ]);

      if (!caller) {
        throw new Error('Usuário chamador não encontrado');
      }

      if (!receiver) {
        throw new Error('Usuário destinatário não encontrado');
      }

      // Verificar se o receptor está disponível
      if (!receiver.is_available) {
        throw new Error('Usuário destinatário não está disponível');
      }

      // Verificar se já existe uma chamada ativa entre os usuários
      const { data: activeCalls, error } = await supabase
        .from('webrtc_calls')
        .select('id, status')
        .or(`and(caller_id.eq.${callerId},receiver_id.eq.${receiverId}),and(caller_id.eq.${receiverId},receiver_id.eq.${callerId})`)
        .in('status', ['initiated', 'ringing', 'answered']);

      if (error) {
        throw new Error(`Erro ao verificar chamadas ativas: ${error.message}`);
      }

      if (activeCalls && activeCalls.length > 0) {
        throw new Error('Já existe uma chamada ativa entre estes usuários');
      }

      return { caller, receiver, canInitiate: true };
    } catch (error) {
      console.error('Erro na validação da chamada:', error);
      throw error;
    }
  }

  // Criar uma nova chamada
  async createCall(callData) {
    try {
      const {
        callerId,
        receiverId,
        callType = 'audio'
      } = callData;

      // Validar a chamada
      const validation = await this.validateCallInitiation(callerId, receiverId);

      // Criar registro da chamada
      const { data: call, error } = await supabase
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

      if (error) {
        throw new Error(`Erro ao criar chamada: ${error.message}`);
      }

      // Registrar evento da chamada
      await this.logCallEvent(call.id, 'call_initiated', {
        caller_id: callerId,
        receiver_id: receiverId,
        call_type: callType
      });

      // Configurar timeout para a chamada
      this.setupCallTimeout(call.id);

      console.log(`Chamada criada: ${call.id} (${callerId} -> ${receiverId})`);
      return {
        call,
        caller: validation.caller,
        receiver: validation.receiver
      };

    } catch (error) {
      console.error('Erro ao criar chamada:', error);
      throw error;
    }
  }

  // Responder uma chamada
  async answerCall(callId, userId) {
    try {
      // Verificar se a chamada existe e pode ser respondida
      const { data: call, error: callError } = await supabase
        .from('webrtc_calls')
        .select('*')
        .eq('id', callId)
        .eq('receiver_id', userId)
        .in('status', ['initiated', 'ringing'])
        .single();

      if (callError || !call) {
        throw new Error('Chamada não encontrada ou não pode ser respondida');
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
        throw new Error(`Erro ao responder chamada: ${updateError.message}`);
      }

      // Registrar evento
      await this.logCallEvent(callId, 'call_answered', {
        answered_by: userId,
        answered_at: new Date().toISOString()
      });

      // Configurar timeout para duração máxima da chamada
      this.setupCallDurationTimeout(callId);

      console.log(`Chamada respondida: ${callId} por ${userId}`);
      return call;

    } catch (error) {
      console.error('Erro ao responder chamada:', error);
      throw error;
    }
  }

  // Encerrar uma chamada
  async endCall(callId, userId, endReason = 'user_ended') {
    try {
      // Buscar dados da chamada
      const { data: call, error: callError } = await supabase
        .from('webrtc_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (callError || !call) {
        throw new Error('Chamada não encontrada');
      }

      // Verificar permissão
      if (call.caller_id !== userId && call.receiver_id !== userId) {
        throw new Error('Usuário não tem permissão para encerrar esta chamada');
      }

      // Calcular duração
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
        throw new Error(`Erro ao encerrar chamada: ${updateError.message}`);
      }

      // Registrar evento
      await this.logCallEvent(callId, 'call_ended', {
        ended_by: userId,
        end_reason: endReason,
        duration_seconds: durationSeconds,
        ended_at: new Date().toISOString()
      });

      // Limpar timeouts
      this.clearCallTimeouts(callId);

      console.log(`Chamada encerrada: ${callId} por ${userId} (${durationSeconds}s)`);
      return {
        callId,
        duration: durationSeconds,
        endReason,
        endedBy: userId
      };

    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
      throw error;
    }
  }

  // Buscar histórico de chamadas
  async getCallHistory(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        status,
        callType,
        dateFrom,
        dateTo
      } = options;

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
        .range(offset, offset + limit - 1);

      // Aplicar filtros
      if (status) {
        query = query.eq('status', status);
      }

      if (callType) {
        query = query.eq('call_type', callType);
      }

      if (dateFrom) {
        query = query.gte('initiated_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('initiated_at', dateTo);
      }

      const { data: calls, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar histórico: ${error.message}`);
      }

      // Processar dados
      const processedCalls = calls.map(call => ({
        ...call,
        direction: call.caller.id === userId ? 'outgoing' : 'incoming',
        otherParty: call.caller.id === userId ? call.receiver : call.caller,
        formattedDuration: this.formatDuration(call.duration_seconds),
        wasAnswered: call.status === 'answered' || call.status === 'ended'
      }));

      return processedCalls;
    } catch (error) {
      console.error('Erro ao buscar histórico de chamadas:', error);
      throw error;
    }
  }

  // Atualizar status do usuário
  async updateUserStatus(userId, statusData) {
    try {
      const updateData = {
        last_seen: new Date().toISOString()
      };

      if (typeof statusData.isOnline === 'boolean') {
        updateData.is_online = statusData.isOnline;
      }

      if (typeof statusData.isAvailable === 'boolean') {
        updateData.is_available = statusData.isAvailable;
      }

      if (statusData.deviceToken) {
        updateData.device_token = statusData.deviceToken;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw new Error(`Erro ao atualizar status: ${error.message}`);
      }

      return updateData;
    } catch (error) {
      console.error('Erro ao atualizar status do usuário:', error);
      throw error;
    }
  }

  // Configurar timeout para chamada não respondida
  setupCallTimeout(callId) {
    setTimeout(async () => {
      try {
        const { data: call, error } = await supabase
          .from('webrtc_calls')
          .select('status')
          .eq('id', callId)
          .single();

        if (!error && call && ['initiated', 'ringing'].includes(call.status)) {
          await this.endCall(callId, null, 'timeout');
          console.log(`Chamada ${callId} encerrada por timeout`);
        }
      } catch (error) {
        console.error('Erro ao processar timeout da chamada:', error);
      }
    }, this.CALL_TIMEOUT);
  }

  // Configurar timeout para duração máxima da chamada
  setupCallDurationTimeout(callId) {
    setTimeout(async () => {
      try {
        const { data: call, error } = await supabase
          .from('webrtc_calls')
          .select('status')
          .eq('id', callId)
          .single();

        if (!error && call && call.status === 'answered') {
          await this.endCall(callId, null, 'max_duration_reached');
          console.log(`Chamada ${callId} encerrada por duração máxima`);
        }
      } catch (error) {
        console.error('Erro ao processar timeout de duração:', error);
      }
    }, this.MAX_CALL_DURATION);
  }

  // Limpar timeouts da chamada
  clearCallTimeouts(callId) {
    // Em uma implementação mais robusta, você manteria referências aos timeouts
    // e os limparia aqui. Por simplicidade, estamos apenas logando.
    console.log(`Timeouts limpos para chamada ${callId}`);
  }

  // Registrar evento da chamada
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

  // Obter estatísticas do sistema
  async getSystemStatistics() {
    try {
      const [totalUsers, onlineUsers, totalCalls, activeCalls, callsToday] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('webrtc_calls').select('id', { count: 'exact', head: true }),
        supabase.from('webrtc_calls').select('id', { count: 'exact', head: true }).in('status', ['initiated', 'ringing', 'answered']),
        supabase.from('webrtc_calls').select('id', { count: 'exact', head: true }).gte('initiated_at', new Date().toISOString().split('T')[0])
      ]);

      return {
        totalUsers: totalUsers.count || 0,
        onlineUsers: onlineUsers.count || 0,
        totalCalls: totalCalls.count || 0,
        activeCalls: activeCalls.count || 0,
        callsToday: callsToday.count || 0,
        realtime: webrtcSignalingService.getSystemStats()
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  // Métodos utilitários
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
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

  // Validar dados de entrada
  validateCallData(callData) {
    const { callerId, receiverId, callType } = callData;
    
    if (!callerId || !receiverId) {
      throw new Error('callerId e receiverId são obrigatórios');
    }
    
    if (callerId === receiverId) {
      throw new Error('Não é possível fazer chamada para si mesmo');
    }
    
    if (callType && !['audio', 'video'].includes(callType)) {
      throw new Error('Tipo de chamada deve ser "audio" ou "video"');
    }
    
    return true;
  }

  // Iniciar chamada para apartamento (método melhorado para interfone)
  async initiateApartmentCall(callerId, apartmentNumber, buildingId, options = {}) {
    try {
      console.log(`🏢 Iniciando chamada de interfone para apartamento ${apartmentNumber}`);
      
      // Buscar moradores do apartamento usando a função RPC melhorada
      const residents = await this.getApartmentResidents(apartmentNumber, buildingId);
      
      if (!residents || residents.length === 0) {
        throw new Error(`Nenhum morador encontrado no apartamento ${apartmentNumber}. Verifique se o apartamento existe e possui moradores cadastrados.`);
      }

      console.log(`👥 Encontrados ${residents.length} moradores no apartamento ${apartmentNumber}`);

      // INTERFONE REAL: Chamar TODOS os moradores, não apenas os disponíveis
      // Filtrar apenas moradores ativos (não excluir por disponibilidade)
      const activeResidents = residents.filter(resident => 
        resident.user_type === 'morador'
      );

      if (activeResidents.length === 0) {
        throw new Error(`Nenhum morador ativo encontrado no apartamento ${apartmentNumber}`);
      }

      // Buscar dados do apartamento (usar o apartment_id da função RPC)
      const apartmentId = residents[0].apartment_id;
      
      if (!apartmentId) {
        throw new Error(`Dados do apartamento ${apartmentNumber} não encontrados`);
      }

      // Gerar ID único para o grupo de chamadas do interfone
      const intercomGroupId = `intercom_${apartmentId}_${Date.now()}`;
      const timeout = options.timeout || 30000; // 30 segundos default

      console.log(`📞 Iniciando ${activeResidents.length} chamadas simultâneas para interfone`);

      // Criar chamadas para TODOS os moradores simultaneamente
      const callPromises = activeResidents.map(async (resident) => {
        try {
          // Criar registro da chamada no banco
          const { data: call, error: callError } = await supabase
            .from('webrtc_calls')
            .insert({
              caller_id: callerId,
              receiver_id: resident.profile_id,
              call_type: 'intercom',
              status: 'initiated',
              apartment_id: apartmentId,
              intercom_group_id: intercomGroupId,
              timeout_ms: timeout,
              metadata: {
                apartmentNumber,
                buildingId,
                residentName: resident.full_name,
                isPrimary: resident.is_primary,
                isOwner: resident.is_owner
              }
            })
            .select()
            .single();

          if (callError) {
            console.error(`❌ Erro ao criar chamada para ${resident.full_name}:`, callError);
            throw new Error(`Falha ao criar chamada para ${resident.full_name}`);
          }

          console.log(`✅ Chamada criada para ${resident.full_name} (ID: ${call.id})`);

          // Emitir evento via WebSocket para o morador
          webrtcSignalingService.emitToUser(resident.profile_id, 'incoming_intercom_call', {
            callId: call.id,
            callerId,
            callerName: 'Porteiro',
            apartmentNumber,
            buildingName: resident.building_name,
            intercomGroupId,
            timeout,
            callType: 'intercom'
          });

          return {
            ...call,
            resident: {
              id: resident.profile_id,
              name: resident.full_name,
              is_primary: resident.is_primary,
              is_owner: resident.is_owner,
              is_online: resident.is_online,
              is_available: resident.is_available
            }
          };
        } catch (error) {
          console.error(`❌ Erro ao processar chamada para ${resident.full_name}:`, error);
          return {
            error: error.message,
            resident: {
              id: resident.profile_id,
              name: resident.full_name
            }
          };
        }
      });

      // Aguardar todas as chamadas serem processadas
      const callResults = await Promise.allSettled(callPromises);
      
      // Separar sucessos e falhas
      const successfulCalls = callResults
        .filter(result => result.status === 'fulfilled' && !result.value.error)
        .map(result => result.value);
        
      const failedCalls = callResults
        .filter(result => result.status === 'rejected' || result.value?.error)
        .map(result => result.reason || result.value?.error);

      console.log(`📊 Resultado das chamadas: ${successfulCalls.length} sucessos, ${failedCalls.length} falhas`);

      // Enviar notificações push para fazer os telefones tocarem
      try {
        const pushNotificationService = require('./pushNotificationService');
        
        // Preparar notificações em lote para o método melhorado
        const batchNotifications = activeResidents.map(resident => ({
          userId: resident.profile_id,
          title: `🏠 Interfone - Apartamento ${apartmentNumber}`,
          body: `Alguém está chamando no interfone do seu apartamento`,
          data: {
            type: 'intercom_call',
            callId: intercomGroupId,
            apartmentNumber: apartmentNumber,
            intercomGroupId: intercomGroupId,
            buildingId: buildingId,
            timestamp: new Date().toISOString()
          },
          deviceTokens: resident.device_tokens || []
        }));

        // Enviar notificações usando o método melhorado
        const notificationResults = await pushNotificationService.sendBatchNotifications(batchNotifications);
        
        console.log(`📊 Resultado das notificações push:`, {
          total: notificationResults.total,
          successful: notificationResults.successful,
          failed: notificationResults.failed,
          details: notificationResults.details.map(detail => ({
            userId: detail.userId,
            sent: detail.sent,
            devicesTotal: detail.devicesTotal,
            devicesSuccessful: detail.devicesSuccessful,
            devicesFailed: detail.devicesFailed
          }))
        });

        // Atualizar estatísticas dos resultados das chamadas
        successfulCalls.forEach((call) => {
          const notificationDetail = notificationResults.details.find(
            detail => detail.userId === call.receiver_id
          );
          
          if (notificationDetail) {
            call.notification_sent = notificationDetail.sent;
            call.devices_notified = notificationDetail.devicesSuccessful || 0;
            call.devices_failed = notificationDetail.devicesFailed || 0;
          }
        });
      } catch (pushError) {
        console.error('❌ Erro ao enviar notificações push:', pushError);
        // Não falhar a chamada por causa das notificações
      }

      // Configurar timeout para chamadas não atendidas
      setTimeout(async () => {
        try {
          const { error: timeoutError } = await supabase
            .from('webrtc_calls')
            .update({ 
              status: 'timeout',
              ended_at: new Date().toISOString(),
              end_reason: 'timeout'
            })
            .eq('intercom_group_id', intercomGroupId)
            .eq('status', 'initiated');

          if (timeoutError) {
            console.error('❌ Erro ao aplicar timeout:', timeoutError);
          } else {
            console.log(`⏰ Timeout aplicado para chamadas do grupo ${intercomGroupId}`);
          }

          // Notificar via WebSocket sobre o timeout
          webrtcSignalingService.emitToRoom(`intercom_${intercomGroupId}`, 'intercom_timeout', {
            intercomGroupId,
            apartmentNumber,
            message: 'Chamada de interfone expirou'
          });
        } catch (error) {
          console.error('❌ Erro no timeout do interfone:', error);
        }
      }, timeout);

      // Retornar resultado consolidado
      return {
        success: true,
        message: `Chamada de interfone iniciada para ${successfulCalls.length} moradores do apartamento ${apartmentNumber}`,
        intercomGroupId,
        apartmentNumber,
        buildingId,
        apartmentId,
        totalResidents: residents.length,
        activeResidents: activeResidents.length,
        callsInitiated: successfulCalls.length,
        callsFailed: failedCalls.length,
        notificationsSent: activeResidents.length,
        timeout,
        calls: successfulCalls,
        errors: failedCalls.length > 0 ? failedCalls : undefined
      };

    } catch (error) {
      console.error('❌ Erro ao iniciar chamada de interfone:', error);
      
      // Melhorar mensagens de erro específicas
      if (error.message.includes('apartamento não encontrado') || 
          error.message.includes('Nenhum morador encontrado')) {
        throw error; // Manter mensagem específica
      }
      
      if (error.message.includes('obrigatórios')) {
        throw error; // Manter mensagem de validação
      }
      
      // Erro genérico com contexto
      throw new Error(`Falha ao iniciar chamada de interfone para apartamento ${apartmentNumber}: ${error.message}`);
    }
  }

  // Atualizar token do dispositivo
  async updateDeviceToken(profileId, token, platform = 'web') {
    try {
      // Desativar tokens antigos do mesmo usuário e plataforma
      await supabase
        .from('webrtc_device_tokens')
        .update({ is_active: false })
        .eq('profile_id', profileId)
        .eq('platform', platform);

      // Inserir novo token
      const { data, error } = await supabase
        .from('webrtc_device_tokens')
        .insert({
          profile_id: profileId,
          token: token,
          platform: platform,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar token do dispositivo: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao atualizar token do dispositivo:', error);
      throw error;
    }
  }

  // Buscar apartamentos de um prédio
  async getBuildingApartments(buildingId) {
    try {
      const { data: apartments, error } = await supabase
        .from('apartments')
        .select('id, number, floor')
        .eq('building_id', buildingId)
        .order('number');

      if (error) {
        throw new Error(`Erro ao buscar apartamentos: ${error.message}`);
      }

      return apartments;
    } catch (error) {
      console.error('Erro ao buscar apartamentos:', error);
      throw error;
    }
  }

  // Buscar prédios
  async getBuildings() {
    try {
      const { data: buildings, error } = await supabase
        .from('buildings')
        .select('id, name, address')
        .order('name');

      if (error) {
        throw new Error(`Erro ao buscar prédios: ${error.message}`);
      }

      return buildings;
    } catch (error) {
      console.error('Erro ao buscar prédios:', error);
      throw error;
    }
  }
}

module.exports = new WebRTCService();