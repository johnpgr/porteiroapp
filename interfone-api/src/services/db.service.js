const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Serviço de conexão com Supabase
 * Utiliza o cliente JavaScript do Supabase em vez de conexão direta PostgreSQL
 */
class DatabaseService {
  constructor() {
    // Inicializar cliente Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log('🔗 Cliente Supabase inicializado');
  }

  /**
   * Testa a conexão com o Supabase
   * @returns {Promise<boolean>} True se conectado com sucesso
   */
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('buildings')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('🔥 Erro ao testar conexão Supabase:', error);
        return false;
      }
      
      console.log('✅ Conexão com Supabase estabelecida com sucesso');
      return true;
    } catch (error) {
      console.error('🔥 Erro ao testar conexão:', error);
      return false;
    }
  }

  /**
   * Busca apartamento por número e building_id
   * @param {string} apartmentNumber - Número do apartamento
   * @param {string} buildingId - ID do prédio
   * @returns {Promise<Object|null>} Dados do apartamento ou null
   */
  async getApartmentByNumber(apartmentNumber, buildingId) {
    try {
      const { data, error } = await this.supabase
        .from('apartments')
        .select('id, number, building_id')
        .eq('number', apartmentNumber)
        .eq('building_id', buildingId)
        .single();
      
      if (error) {
        console.error('🔍 Erro ao buscar apartamento:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao buscar apartamento:', error);
      return null;
    }
  }

  /**
   * Busca moradores ativos de um apartamento
   * @param {string} apartmentId - ID do apartamento
   * @returns {Promise<Array>} Lista de moradores
   */
  async getActiveResidentsByApartment(apartmentId) {
    try {
      const { data, error } = await this.supabase
        .from('apartment_residents')
        .select(`
          profiles!inner(
            id,
            full_name,
            user_type
          )
        `)
        .eq('apartment_id', apartmentId)
        .eq('is_active', true)
        .eq('profiles.user_type', 'morador');
      
      if (error) {
        console.error('🔍 Erro ao buscar moradores:', error);
        return [];
      }
      
      return data.map(item => item.profiles);
    } catch (error) {
      console.error('🔥 Erro ao buscar moradores:', error);
      return [];
    }
  }

  /**
   * Cria uma nova chamada de interfone
   * @param {string} apartmentId - ID do apartamento
   * @param {string} doormanId - ID do porteiro
   * @returns {Promise<Object>} Dados da chamada criada
   */
  async createIntercomCall(apartmentId, doormanId) {
    try {
      const callId = require('crypto').randomUUID();
      
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .insert({
          apartment_id: apartmentId,
          doorman_id: doormanId,
          status: 'calling',
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('🔥 Erro ao criar chamada:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao criar chamada de interfone:', error);
      throw error;
    }
  }

  /**
   * Adiciona participantes à chamada
   * @param {string} callId - ID da chamada
   * @param {Array} residentIds - IDs dos moradores
   * @returns {Promise<Array>} Participantes criados
   */
  async addCallParticipants(callId, residentIds) {
    try {
      const participants = [];
      
      for (const residentId of residentIds) {
        const { data, error } = await this.supabase
          .from('call_participants')
          .insert({
            call_id: callId,
            resident_id: residentId,
            status: 'notified'
          })
          .select()
          .single();
        
        if (error) {
          console.error('🔥 Erro ao adicionar participante:', error);
          continue;
        }
        
        participants.push(data);
      }
      
      return participants;
    } catch (error) {
      console.error('🔥 Erro ao adicionar participantes:', error);
      return [];
    }
  }

  /**
   * Busca chamada por ID com informações completas
   * @param {string} callId - ID da chamada
   * @returns {Promise<Object|null>} Dados da chamada ou null
   */
  async getCallById(callId) {
    try {
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .select(`
          *,
          apartments!inner(number, building_id, buildings(name)),
          profiles!inner(full_name)
        `)
        .eq('id', callId)
        .single();
      
      if (error) {
        console.error('🔍 Erro ao buscar chamada:', error);
        return null;
      }
      
      return {
        ...data,
        apartment_number: data.apartments?.number,
        building_id: data.apartments?.building_id,
        building_name: data.apartments?.buildings?.name,
        doorman_name: data.profiles?.full_name
      };
    } catch (error) {
      console.error('🔥 Erro ao buscar chamada:', error);
      return null;
    }
  }

  /**
   * Atualiza status da chamada para "answered"
   * @param {string} callId - ID da chamada
   * @param {string} residentId - ID do morador que atendeu
   * @returns {Promise<Object>} Chamada atualizada
   */
  async answerCall(callId, residentId) {
    try {
      // Verifica se a chamada ainda está no status 'calling'
      const { data: currentCall, error: checkError } = await this.supabase
        .from('intercom_calls')
        .select('status')
        .eq('id', callId)
        .single();
      
      if (checkError || !currentCall || currentCall.status !== 'calling') {
        throw new Error('Chamada não está mais disponível para ser atendida');
      }
      
      // Atualiza a chamada para 'answered'
      const { data: updatedCall, error: updateError } = await this.supabase
        .from('intercom_calls')
        .update({ 
          status: 'answered', 
          answered_at: new Date().toISOString() 
        })
        .eq('id', callId)
        .select()
        .single();
      
      if (updateError) {
        throw updateError;
      }
      
      // Atualiza o participante que atendeu
      await this.supabase
        .from('call_participants')
        .update({ 
          status: 'answered', 
          joined_at: new Date().toISOString() 
        })
        .eq('call_id', callId)
        .eq('resident_id', residentId);
      
      // Marca outros participantes como 'missed'
      await this.supabase
        .from('call_participants')
        .update({ status: 'missed' })
        .eq('call_id', callId)
        .neq('resident_id', residentId)
        .eq('status', 'notified');
      
      return updatedCall;
      
    } catch (error) {
      console.error('🔥 Erro ao atender chamada:', error);
      throw error;
    }
  }

  /**
   * Recusa uma chamada
   * @param {string} callId - ID da chamada
   * @param {string} residentId - ID do morador que recusou
   * @returns {Promise<Object>} Participante atualizado
   */
  async declineCall(callId, residentId) {
    try {
      const { data, error } = await this.supabase
        .from('call_participants')
        .update({ status: 'declined' })
        .eq('call_id', callId)
        .eq('resident_id', residentId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao recusar chamada:', error);
      throw error;
    }
  }

  /**
   * Encerra uma chamada
   * @param {string} callId - ID da chamada
   * @returns {Promise<Object>} Chamada atualizada
   */
  async endCall(callId) {
    try {
      // Primeiro busca a chamada atual para calcular duração
      const { data: currentCall, error: fetchError } = await this.supabase
        .from('intercom_calls')
        .select('answered_at')
        .eq('id', callId)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Calcula duração se foi atendida
      let duration = 0;
      if (currentCall?.answered_at) {
        const answeredTime = new Date(currentCall.answered_at);
        const now = new Date();
        duration = Math.floor((now - answeredTime) / 1000); // em segundos
      }
      
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString(),
          duration: duration
        })
        .eq('id', callId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao encerrar chamada:', error);
      throw error;
    }
  }

  /**
   * Busca perfil do porteiro por ID
   * @param {string} doormanId - ID do porteiro
   * @returns {Promise<Object|null>} Dados do porteiro
   */
  async getDoormanProfile(doormanId) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id, full_name, building_id, user_type')
        .eq('id', doormanId)
        .eq('user_type', 'porteiro')
        .single();
      
      if (error) {
        console.error('🔍 Erro ao buscar perfil do porteiro:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao buscar perfil do porteiro:', error);
      return null;
    }
  }

  /**
   * Busca moradores de um apartamento
   * @param {string} apartmentId - ID do apartamento
   * @returns {Promise<Array>} Lista de moradores do apartamento
   */
  async getResidentsByApartment(apartmentId) {
    try {
      const { data, error } = await this.supabase
        .from('apartment_residents')
        .select(`
          profile_id,
          relationship,
          is_primary,
          profiles!inner(
            id,
            full_name,
            email,
            phone,
            user_type,
            notification_enabled,
            push_token
          )
        `)
        .eq('apartment_id', apartmentId);
      
      if (error) {
        console.error('🔍 Erro ao buscar moradores do apartamento:', error);
        throw error;
      }
      
      console.log('🔍 Dados brutos dos moradores:', JSON.stringify(data, null, 2));
      
      // Mapear dados para formato mais limpo
      return data.map(resident => ({
        id: resident.profiles.id,
        name: resident.profiles.full_name,
        email: resident.profiles.email,
        phone: resident.profiles.phone,
        user_type: resident.profiles.user_type,
        relationship: resident.relationship,
        is_primary: resident.is_primary,
        notification_enabled: resident.profiles.notification_enabled,
        push_token: resident.profiles.push_token
      }));
    } catch (error) {
      console.error('🔥 Erro ao buscar moradores do apartamento:', error);
      throw error;
    }
  }

  /**
   * Busca histórico de chamadas de um apartamento
   * @param {string} apartmentId - ID do apartamento
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Histórico de chamadas
   */
  async getCallHistory(apartmentId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .select(`
          *,
          profiles!inner(full_name),
          apartments!inner(number)
        `)
        .eq('apartment_id', apartmentId)
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw error;
      }
      
      return data.map(call => ({
        ...call,
        doorman_name: call.profiles?.full_name,
        apartment_number: call.apartments?.number
      }));
    } catch (error) {
      console.error('🔥 Erro ao buscar histórico de chamadas:', error);
      return [];
    }
  }

  // Método já implementado acima

  /**
   * Adiciona um participante individual à chamada
   * @param {Object} participantData - Dados do participante
   * @returns {Promise<Object>} Participante criado
   */
  async addCallParticipant(participantData) {
    try {
      const { data, error } = await this.supabase
        .from('call_participants')
        .insert(participantData)
        .select()
        .single();
      
      if (error) {
        console.error('🔥 Erro ao adicionar participante:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao adicionar participante:', error);
      throw error;
    }
  }

  /**
   * Atualiza status da chamada
   * @param {string} callId - ID da chamada
   * @param {string} status - Novo status
   * @returns {Promise<Object>} Chamada atualizada
   */
  async updateCallStatus(callId, status) {
    try {
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .update({ status })
        .eq('id', callId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao atualizar status da chamada:', error);
      throw error;
    }
  }

  /**
   * Atualiza participante da chamada
   * @param {string} callId - ID da chamada
   * @param {string} userId - ID do usuário
   * @param {Object} updateData - Dados para atualizar
   * @returns {Promise<Object>} Participante atualizado
   */
  async updateCallParticipant(callId, userId, updateData) {
    try {
      const { data, error } = await this.supabase
        .from('call_participants')
        .update(updateData)
        .eq('call_id', callId)
        .eq('resident_id', userId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao atualizar participante:', error);
      throw error;
    }
  }

  /**
   * Marca outros moradores como perderam a chamada
   * @param {string} callId - ID da chamada
   * @param {string} answeredUserId - ID do usuário que atendeu
   * @returns {Promise<Array>} Participantes atualizados
   */
  async markOtherResidentsAsMissed(callId, answeredUserId) {
    try {
      const { data, error } = await this.supabase
        .from('call_participants')
        .update({ status: 'missed' })
        .eq('call_id', callId)
        .neq('resident_id', answeredUserId)
        .in('status', ['invited', 'ringing', 'notified'])
        .select();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao marcar participantes como perdidos:', error);
      throw error;
    }
  }

  /**
   * Busca participantes de uma chamada
   * @param {string} callId - ID da chamada
   * @returns {Promise<Array>} Lista de participantes
   */
  async getCallParticipants(callId) {
    try {
      const { data, error } = await this.supabase
        .from('call_participants')
        .select(`
          id,
          call_id,
          resident_id,
          status,
          joined_at,
          left_at,
          created_at,
          profiles:profiles!call_participants_resident_id_fkey(
            id,
            full_name,
            name,
            phone,
            user_type
          )
        `)
        .eq('call_id', callId);
      
      if (error) {
        throw error;
      }

      const participants = (data || []).map(participant => {
        const profile = participant.profiles || {};
        const rawUserType = profile.user_type || null;

        // Normaliza tipos para manter compatibilidade com camadas superiores
        let normalizedType = rawUserType;
        if (rawUserType === 'morador') {
          normalizedType = 'resident';
        } else if (rawUserType === 'porteiro') {
          normalizedType = 'doorman';
        }

        return {
          id: participant.id,
          call_id: participant.call_id,
          resident_id: participant.resident_id,
          user_id: participant.resident_id,
          status: participant.status,
          joined_at: participant.joined_at,
          left_at: participant.left_at,
          created_at: participant.created_at,
          user_type: normalizedType,
          raw_user_type: rawUserType,
          name: profile.full_name || profile.name || null,
          phone: profile.phone || null,
        };
      });

      return participants;
    } catch (error) {
      console.error('🔥 Erro ao buscar participantes:', error);
      return [];
    }
  }

  /**
   * Atualiza dados da chamada
   * @param {string} callId - ID da chamada
   * @param {Object} updateData - Dados para atualizar
   * @returns {Promise<Object>} Chamada atualizada
   */
  async updateCall(callId, updateData) {
    try {
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .update(updateData)
        .eq('id', callId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao atualizar chamada:', error);
      throw error;
    }
  }

  /**
   * Desconecta participantes ativos (exceto o especificado)
   * @param {string} callId - ID da chamada
   * @param {string} keepUserId - ID do usuário para manter conectado
   * @returns {Promise<Array>} Participantes desconectados
   */
  async disconnectActiveParticipants(callId, keepUserId) {
    try {
      const { data, error } = await this.supabase
        .from('call_participants')
        .update({ 
          status: 'disconnected',
          left_at: new Date().toISOString()
        })
        .eq('call_id', callId)
        .neq('resident_id', keepUserId)
        .in('status', ['connected', 'ringing'])
        .select();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('🔥 Erro ao desconectar participantes:', error);
      throw error;
    }
  }

  /**
   * Busca chamadas ativas de um prédio
   * @param {string} buildingId - ID do prédio
   * @returns {Promise<Array>} Lista de chamadas ativas
   */
  async getActiveCalls(buildingId) {
    try {
      const { data, error } = await this.supabase
        .from('intercom_calls')
        .select(`
          *,
          apartments!inner(number, building_id),
          profiles!inner(full_name)
        `)
        .eq('apartments.building_id', buildingId)
        .in('status', ['calling', 'ringing', 'active'])
        .order('started_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data.map(call => ({
        ...call,
        apartment_number: call.apartments?.number,
        doorman_name: call.profiles?.full_name
      }));
    } catch (error) {
      console.error('🔥 Erro ao buscar chamadas ativas:', error);
      return [];
    }
  }

  /**
   * Fecha conexão (não necessário com Supabase client)
   */
  async close() {
    console.log('🔒 Conexão Supabase não precisa ser fechada manualmente');
  }
}

// Singleton instance
const dbService = new DatabaseService();

module.exports = dbService;