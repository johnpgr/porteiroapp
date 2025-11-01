import {
  SupabaseClientFactory,
  type TypedSupabaseClient,
  UnifiedSupabaseClient,
} from "@porteiroapp/common/supabase";

/**
 * Valid status values for intercom_calls table
 * Based on CHECK constraint: status IN ('calling', 'answered', 'ended', 'missed')
 */
export type IntercomCallStatus = "calling" | "answered" | "ended" | "missed";

/**
 * Valid status values for call_participants table
 * Based on CHECK constraint (updated migration 20251021)
 */
export type CallParticipantStatus =
  | "notified"
  | "invited"
  | "ringing"
  | "answered"
  | "connected"
  | "declined"
  | "missed"
  | "disconnected";

/**
 * Serviço de conexão com Supabase
 * Utiliza o cliente JavaScript do Supabase em vez de conexão direta PostgreSQL
 */
class DatabaseService {
  private supabase: TypedSupabaseClient;
  private unified: UnifiedSupabaseClient;

  constructor() {
    // Initialize Supabase client with service role key
    const { client, unified } = SupabaseClientFactory.createServerClient({
      url: process.env.SUPABASE_URL!,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    });

    this.supabase = client;
    this.unified = unified;

    console.log("🔗 Cliente Supabase inicializado com service role key");
  }

  /**
   * Testa a conexão com o Supabase
   * @returns True se conectado com sucesso
   */
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("buildings")
        .select("id")
        .limit(1);

      if (error) {
        console.error("🔥 Erro ao testar conexão Supabase:", error);
        return false;
      }

      console.log("✅ Conexão com Supabase estabelecida com sucesso");
      return true;
    } catch (error) {
      console.error("🔥 Erro ao testar conexão:", error);
      return false;
    }
  }

  /**
   * Busca apartamento por número e building_id
   * @param apartmentNumber - Número do apartamento
   * @param buildingId - ID do prédio
   * @returns Dados do apartamento ou null
   */
  async getApartmentByNumber(
    apartmentNumber: string,
    buildingId: string,
  ): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from("apartments")
        .select("id, number, building_id")
        .eq("number", apartmentNumber)
        .eq("building_id", buildingId)
        .single();

      if (error) {
        console.error("🔍 Erro ao buscar apartamento:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao buscar apartamento:", error);
      return null;
    }
  }

  /**
   * Busca moradores ativos de um apartamento
   * @param apartmentId - ID do apartamento
   * @returns Lista de moradores
   */
  async getActiveResidentsByApartment(apartmentId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("apartment_residents")
        .select(
          `
          profiles!inner(
            id,
            full_name,
            user_type
          )
        `,
        )
        .eq("apartment_id", apartmentId)
        .eq("is_active", true)
        .eq("profiles.user_type", "morador");

      if (error) {
        console.error("🔍 Erro ao buscar moradores:", error);
        return [];
      }

      return data.map((item: any) => item.profiles);
    } catch (error) {
      console.error("🔥 Erro ao buscar moradores:", error);
      return [];
    }
  }

  /**
   * Cria uma nova chamada de interfone
   * @param apartmentId - ID do apartamento
   * @param doormanId - ID do porteiro
   * @param options - Opções da chamada
   * @returns Dados da chamada criada
   */
  async createIntercomCall(
    apartmentId: string,
    doormanId: string,
    options?: {
      channelName?: string | null;
      status?: IntercomCallStatus;
      startedAt?: string;
    },
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("intercom_calls")
        .insert({
          apartment_id: apartmentId,
          doorman_id: doormanId,
          status: options?.status ?? "calling",
          started_at: options?.startedAt ?? new Date().toISOString(),
          twilio_conference_sid: options?.channelName ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error("🔥 Erro ao criar chamada:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao criar chamada de interfone:", error);
      throw error;
    }
  }

  /**
   * Adiciona participantes à chamada
   * @param callId - ID da chamada
   * @param residentIds - IDs dos moradores
   * @returns Participantes criados
   */
  async addCallParticipants(
    callId: string,
    residentIds: string[],
  ): Promise<any[]> {
    try {
      const participants = [];

      for (const residentId of residentIds) {
        const { data, error } = await this.supabase
          .from("call_participants")
          .insert({
            call_id: callId,
            resident_id: residentId,
            status: "notified",
          })
          .select()
          .single();

        if (error) {
          console.error("🔥 Erro ao adicionar participante:", error);
          continue;
        }

        participants.push(data);
      }

      return participants;
    } catch (error) {
      console.error("🔥 Erro ao adicionar participantes:", error);
      return [];
    }
  }

  /**
   * Busca chamada por ID com informações completas
   * @param callId - ID da chamada
   * @returns Dados da chamada ou null
   */
  async getCallById(callId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from("intercom_calls")
        .select(
          `
          *,
          apartments!inner(number, building_id, buildings(name)),
          profiles!inner(full_name)
        `,
        )
        .eq("id", callId)
        .single();

      if (error) {
        console.error("🔍 Erro ao buscar chamada:", error);
        return null;
      }

      return {
        ...data,
        channel_name:
          data.twilio_conference_sid ?? data.twilio_call_sid ?? null,
        apartment_number: data.apartments?.number,
        building_id: data.apartments?.building_id,
        building_name: data.apartments?.buildings?.name,
        doorman_name: data.profiles?.full_name,
      };
    } catch (error) {
      console.error("🔥 Erro ao buscar chamada:", error);
      return null;
    }
  }

  /**
   * Atualiza status da chamada para "answered"
   * @param callId - ID da chamada
   * @param residentId - ID do morador que atendeu
   * @returns Chamada atualizada
   */
  async answerCall(callId: string, residentId: string): Promise<any> {
    try {
      // Verifica se a chamada ainda está no status 'calling'
      const { data: currentCall, error: checkError } = await this.supabase
        .from("intercom_calls")
        .select("status")
        .eq("id", callId)
        .single();

      if (checkError || !currentCall || currentCall.status !== "calling") {
        throw new Error("Chamada não está mais disponível para ser atendida");
      }

      // Atualiza a chamada para 'answered'
      const { data: updatedCall, error: updateError } = await this.supabase
        .from("intercom_calls")
        .update({
          status: "answered",
          answered_at: new Date().toISOString(),
        })
        .eq("id", callId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Atualiza o participante que atendeu
      await this.supabase
        .from("call_participants")
        .update({
          status: "answered",
          joined_at: new Date().toISOString(),
        })
        .eq("call_id", callId)
        .eq("resident_id", residentId);

      // Marca outros participantes como 'missed'
      await this.supabase
        .from("call_participants")
        .update({ status: "missed" })
        .eq("call_id", callId)
        .neq("resident_id", residentId)
        .eq("status", "notified");

      return updatedCall;
    } catch (error) {
      console.error("🔥 Erro ao atender chamada:", error);
      throw error;
    }
  }

  /**
   * Recusa uma chamada
   * @param callId - ID da chamada
   * @param residentId - ID do morador que recusou
   * @returns Participante atualizado
   */
  async declineCall(callId: string, residentId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("call_participants")
        .update({ status: "declined" })
        .eq("call_id", callId)
        .eq("resident_id", residentId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao recusar chamada:", error);
      throw error;
    }
  }

  /**
   * Encerra uma chamada
   * @param callId - ID da chamada
   * @returns Chamada atualizada
   */
  async endCall(callId: string): Promise<any> {
    try {
      // Primeiro busca a chamada atual para calcular duração
      const { data: currentCall, error: fetchError } = await this.supabase
        .from("intercom_calls")
        .select("answered_at")
        .eq("id", callId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Calcula duração se foi atendida
      let duration = 0;
      if (currentCall?.answered_at) {
        const answeredTime = new Date(currentCall.answered_at);
        const now = new Date();
        duration = Math.floor((now.getTime() - answeredTime.getTime()) / 1000); // em segundos
      }

      const { data, error } = await this.supabase
        .from("intercom_calls")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          duration: duration,
        })
        .eq("id", callId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao encerrar chamada:", error);
      throw error;
    }
  }

  /**
   * Busca perfil do porteiro por ID
   * @param doormanId - ID do porteiro
   * @returns Dados do porteiro
   */
  async getDoormanProfile(doormanId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from("profiles")
        .select("id, full_name, building_id, user_type")
        .eq("id", doormanId)
        .eq("user_type", "porteiro")
        .single();

      if (error) {
        console.error("🔍 Erro ao buscar perfil do porteiro:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao buscar perfil do porteiro:", error);
      return null;
    }
  }

  /**
   * Busca moradores de um apartamento
   * @param apartmentId - ID do apartamento
   * @returns Lista de moradores do apartamento
   */
  async getResidentsByApartment(apartmentId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("apartment_residents")
        .select(
          `
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
        `,
        )
        .eq("apartment_id", apartmentId);

      if (error) {
        console.error("🔍 Erro ao buscar moradores do apartamento:", error);
        throw error;
      }

      console.log(
        "🔍 Dados brutos dos moradores:",
        JSON.stringify(data, null, 2),
      );

      // Mapear dados para formato mais limpo
      return data.map((resident: any) => ({
        id: resident.profiles.id,
        name: resident.profiles.full_name,
        email: resident.profiles.email,
        phone: resident.profiles.phone,
        user_type: resident.profiles.user_type,
        relationship: resident.relationship,
        is_primary: resident.is_primary,
        notification_enabled: resident.profiles.notification_enabled,
        push_token: resident.profiles.push_token,
      }));
    } catch (error) {
      console.error("🔥 Erro ao buscar moradores do apartamento:", error);
      throw error;
    }
  }

  /**
   * Busca histórico de chamadas com filtros opcionais
   * @param params - Parâmetros de busca
   * @returns Histórico de chamadas
   */
  async getCallHistory(params: {
    buildingId: string;
    userId?: string;
    userType?: string;
    limit: number;
    offset: number;
  }): Promise<any[]> {
    try {
      let query = this.supabase
        .from("intercom_calls")
        .select(
          `
          *,
          profiles!inner(full_name),
          apartments!inner(number, building_id)
        `,
        )
        .eq("apartments.building_id", params.buildingId)
        .order("started_at", { ascending: false })
        .range(params.offset, params.offset + params.limit - 1);

      // Filtros opcionais
      if (params.userId) {
        query = query.eq("doorman_id", params.userId);
      }

      if (params.userType) {
        // Adicionar lógica de filtro por tipo de usuário se necessário
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map((call: any) => ({
        ...call,
        doorman_name: call.profiles?.full_name,
        apartment_number: call.apartments?.number,
      }));
    } catch (error) {
      console.error("🔥 Erro ao buscar histórico de chamadas:", error);
      return [];
    }
  }

  /**
   * Adiciona um participante individual à chamada
   * @param participantData - Dados do participante
   * @returns Participante criado
   */
  async addCallParticipant(participantData: any): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("call_participants")
        .insert(participantData)
        .select()
        .single();

      if (error) {
        console.error("🔥 Erro ao adicionar participante:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao adicionar participante:", error);
      throw error;
    }
  }

  /**
   * Atualiza status da chamada
   * @param callId - ID da chamada
   * @param status - Novo status ('calling' | 'answered' | 'ended' | 'missed')
   * @returns Chamada atualizada
   */
  async updateCallStatus(
    callId: string,
    status: IntercomCallStatus,
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("intercom_calls")
        .update({ status })
        .eq("id", callId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao atualizar status da chamada:", error);
      throw error;
    }
  }

  /**
   * Atualiza participante da chamada
   * @param callId - ID da chamada
   * @param userId - ID do usuário
   * @param updateData - Dados para atualizar
   * @returns Participante atualizado
   */
  async updateCallParticipant(
    callId: string,
    userId: string,
    updateData: any,
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("call_participants")
        .update(updateData)
        .eq("call_id", callId)
        .eq("resident_id", userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao atualizar participante:", error);
      throw error;
    }
  }

  /**
   * Marca outros moradores como perderam a chamada
   * @param callId - ID da chamada
   * @param answeredUserId - ID do usuário que atendeu
   * @returns Participantes atualizados
   */
  async markOtherResidentsAsMissed(
    callId: string,
    answeredUserId: string,
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("call_participants")
        .update({ status: "missed" })
        .eq("call_id", callId)
        .neq("resident_id", answeredUserId)
        .in("status", ["invited", "ringing", "notified"])
        .select();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao marcar participantes como perdidos:", error);
      throw error;
    }
  }

  /**
   * Busca participantes de uma chamada
   * @param callId - ID da chamada
   * @returns Lista de participantes
   */
  async getCallParticipants(callId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("call_participants")
        .select(
          `
            id,
            call_id,
            resident_id,
            status,
            joined_at,
            left_at,
            created_at,
            profiles!call_participants_resident_id_fkey(id, full_name, phone, user_type)
          `,
        )
        .eq("call_id", callId);

      if (error) {
        throw error;
      }

      const participants = (data || []).map((participant: any) => {
        const profile = participant.profiles || {};
        const rawUserType = profile.user_type || null;

        // Normaliza tipos para manter compatibilidade com camadas superiores
        let normalizedType = rawUserType;
        if (rawUserType === "morador") {
          normalizedType = "resident";
        } else if (rawUserType === "porteiro") {
          normalizedType = "doorman";
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
          name: profile.full_name || null,
          phone: profile.phone || null,
        };
      });

      return participants;
    } catch (error) {
      console.error("🔥 Erro ao buscar participantes:", error);
      return [];
    }
  }

  /**
   * Atualiza dados da chamada
   * @param callId - ID da chamada
   * @param updateData - Dados para atualizar
   * @returns Chamada atualizada
   */
  async updateCall(callId: string, updateData: any): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("intercom_calls")
        .update(updateData)
        .eq("id", callId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao atualizar chamada:", error);
      throw error;
    }
  }

  /**
   * Desconecta participantes ativos (exceto o especificado)
   * @param callId - ID da chamada
   * @param keepUserId - ID do usuário para manter conectado
   * @returns Participantes desconectados
   */
  async disconnectActiveParticipants(
    callId: string,
    keepUserId: string,
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("call_participants")
        .update({
          status: "disconnected",
          left_at: new Date().toISOString(),
        })
        .eq("call_id", callId)
        .neq("resident_id", keepUserId)
        .in("status", ["connected", "ringing"])
        .select();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error("🔥 Erro ao desconectar participantes:", error);
      throw error;
    }
  }

  /**
   * Busca chamadas ativas de um prédio
   * @param buildingId - ID do prédio
   * @returns Lista de chamadas ativas
   */
  async getActiveCalls(buildingId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("intercom_calls")
        .select(
          `
          *,
          apartments!inner(number, building_id),
          profiles!inner(full_name)
        `,
        )
        .eq("apartments.building_id", buildingId)
        .in("status", ["calling", "answered"])
        .order("started_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data.map((call: any) => ({
        ...call,
        apartment_number: call.apartments?.number,
        doorman_name: call.profiles?.full_name,
      }));
    } catch (error) {
      console.error("🔥 Erro ao buscar chamadas ativas:", error);
      return [];
    }
  }

  /**
   * Busca o apartment_id de um perfil através da tabela apartment_residents
   * @param profileId - ID do perfil do usuário
   * @returns apartment_id ou null
   */
  async getApartmentIdByProfileId(profileId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("apartment_residents")
        .select("apartment_id")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("🔥 Erro ao buscar apartment_id:", error);
        return null;
      }

      return data?.apartment_id || null;
    } catch (error) {
      console.error("🔥 Erro ao buscar apartment_id:", error);
      return null;
    }
  }

  /**
   * Busca chamadas pendentes para um apartamento
   * @param apartmentId - ID do apartamento
   * @returns Array de chamadas pendentes
   */
  async getPendingCallsForApartment(apartmentId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("intercom_calls")
        .select(`
          id,
          status,
          started_at,
          apartment_id,
          doorman_id
        `)
        .eq("apartment_id", apartmentId)
        .in("status", ["calling", "connecting"])
        .order("started_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("🔥 Erro ao buscar chamadas pendentes:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("🔥 Erro ao buscar chamadas pendentes:", error);
      return [];
    }
  }

  /**
   * Fecha conexão (não necessário com Supabase client)
   */
  async close(): Promise<void> {
    console.log("🔒 Conexão Supabase não precisa ser fechada manualmente");
  }
}

// Singleton instance
const dbService = new DatabaseService();

export default dbService;
