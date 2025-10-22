import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import DatabaseService from '../services/db.service.ts';

/**
 * Controlador para gerenciar chamadas de interfone
 * Implementa todos os endpoints para o ciclo de vida das chamadas
 * Versão simplificada sem notificações FCM
 */
class CallController {
  /**
   * Inicia uma nova chamada de interfone
   * POST /api/calls/start
   */
  static async startCall(req: Request, res: Response): Promise<void> {
    try {
      const { apartmentNumber, doormanId, buildingId } = req.body;

      // Validação dos parâmetros obrigatórios
      if (!apartmentNumber || !doormanId || !buildingId) {
        res.status(400).json({
          success: false,
          error: 'apartmentNumber, doormanId e buildingId são obrigatórios'
        });
        return;
      }

      console.log(`🔔 Iniciando chamada para apartamento ${apartmentNumber} no prédio ${buildingId}`);

      // Buscar dados do apartamento e moradores
      const apartment = await DatabaseService.getApartmentByNumber(apartmentNumber, buildingId);
      if (!apartment) {
        res.status(404).json({
          success: false,
          error: 'Apartamento não encontrado'
        });
        return;
      }

      // Buscar dados do porteiro
      const doorman = await DatabaseService.getDoormanProfile(doormanId);
      if (!doorman) {
        res.status(404).json({
          success: false,
          error: 'Porteiro não encontrado'
        });
        return;
      }

      // Gerar canal único no Agora para a chamada
      const channelName = `intercom_${randomUUID()}`;

      // Criar chamada no banco de dados primeiro
      const call = await DatabaseService.createIntercomCall(apartment.id, doormanId);

      // Verificar se a chamada foi criada com sucesso
      if (!call || !call.id) {
        console.error('🔥 Erro: Chamada não foi criada corretamente');
        res.status(500).json({
          success: false,
          error: 'Erro ao criar chamada no banco de dados'
        });
        return;
      }

      console.log('✅ Chamada criada com sucesso:', call);

      // Buscar moradores do apartamento
      const residents = await DatabaseService.getResidentsByApartment(apartment.id);
      
      if (!residents || residents.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Nenhum morador encontrado para este apartamento'
        });
        return;
      }

      // Salvar o ID da chamada antes de qualquer operação
      const callId = call.id;

      // Criar participantes da chamada (porteiro + moradores)
      const participants = [];
      
      // Adicionar porteiro como participante
      await DatabaseService.addCallParticipant({
        call_id: callId,
        resident_id: doormanId,
        status: 'answered',
        joined_at: new Date()
      });

      participants.push({
        user_id: doormanId,
        user_type: 'doorman',
        name: doorman.full_name,
        status: 'connected'
      });

      // Adicionar moradores como participantes
      for (const resident of residents) {
        await DatabaseService.addCallParticipant({
          call_id: callId,
          resident_id: resident.id,
          status: 'invited'
        });

        participants.push({
          user_id: resident.id,
          user_type: 'resident',
          name: resident.name,
          phone: resident.phone,
          status: 'ringing'
        });
      }

      console.log(`✅ Chamada ${callId} criada com ${participants.length} participantes`);

      // Retornar dados da chamada criada
      res.status(201).json({
        success: true,
        data: {
          call: {
            id: callId,
            channelName,
            apartmentNumber,
            buildingId,
            status: 'ringing',
            startedAt: call.started_at
          },
          participants,
          apartment: {
            id: apartment.id,
            number: apartment.number,
            block: apartment.block
          },
          doorman: {
            id: doorman.id,
            name: doorman.full_name
          }
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao iniciar chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Atende uma chamada
   * POST /api/calls/:callId/answer
   */
  static async answerCall(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const { userId, userType } = req.body;

      if (!userId || !userType) {
        res.status(400).json({
          success: false,
          error: 'userId e userType são obrigatórios'
        });
        return;
      }

      console.log(`📞 Usuário ${userId} (${userType}) atendendo chamada ${callId}`);

      // Verificar se a chamada existe e está ativa
      const call = await DatabaseService.getCallById(callId);
      if (!call) {
        res.status(404).json({
          success: false,
          error: 'Chamada não encontrada'
        });
        return;
      }

      if (call.status !== 'ringing') {
        res.status(400).json({
          success: false,
          error: 'Chamada não está disponível para atendimento'
        });
        return;
      }

      // Atualizar status da chamada para 'active'
      await DatabaseService.updateCallStatus(callId, 'active');

      // Atualizar participante que atendeu
      await DatabaseService.updateCallParticipant(callId, userId, {
        status: 'connected',
        joined_at: new Date()
      });

      // Marcar outros moradores como 'missed' (apenas se for morador atendendo)
      if (userType === 'resident') {
        await DatabaseService.markOtherResidentsAsMissed(callId, userId);
      }

      // Buscar dados atualizados da chamada
      const updatedCall = await DatabaseService.getCallById(callId);
      const participants = await DatabaseService.getCallParticipants(callId);

      console.log(`✅ Chamada ${callId} atendida por ${userId}`);

      res.json({
        success: true,
        data: {
          call: {
            id: updatedCall?.id ?? callId,
            channelName: updatedCall?.channel_name ?? call.channel_name ?? null,
            status: updatedCall?.status ?? 'active',
            answeredBy: userId,
            answeredAt: updatedCall?.answered_at ?? new Date().toISOString()
          },
          participants
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao atender chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Recusa uma chamada
   * POST /api/calls/:callId/decline
   */
  static async declineCall(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const { userId, userType } = req.body;

      if (!userId || !userType) {
        res.status(400).json({
          success: false,
          error: 'userId e userType são obrigatórios'
        });
        return;
      }

      console.log(`❌ Usuário ${userId} (${userType}) recusando chamada ${callId}`);

      // Verificar se a chamada existe
      const call = await DatabaseService.getCallById(callId);
      if (!call) {
        res.status(404).json({
          success: false,
          error: 'Chamada não encontrada'
        });
        return;
      }

      // Atualizar participante que recusou
      await DatabaseService.updateCallParticipant(callId, userId, {
        status: 'declined',
        left_at: new Date()
      });

      // Verificar se todos os moradores recusaram
      const participants = await DatabaseService.getCallParticipants(callId);
      const residents = participants.filter((p: any) => p.user_type === 'resident');
      const allDeclined = residents.every((r: any) => r.status === 'declined');

      if (allDeclined) {
        // Se todos recusaram, encerrar a chamada
        await DatabaseService.updateCallStatus(callId, 'declined');
        console.log(`📵 Chamada ${callId} encerrada - todos os moradores recusaram`);
      }

      res.json({
        success: true,
        data: {
          call: {
            id: callId,
            status: allDeclined ? 'declined' : call.status,
            declinedBy: userId
          },
          allDeclined
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao recusar chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Encerra uma chamada
   * POST /api/calls/:callId/end
   */
  static async endCall(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const { userId, userType } = req.body;

      console.log(`🔚 Usuário ${userId} (${userType}) encerrando chamada ${callId}`);

      // Verificar se a chamada existe
      const call = await DatabaseService.getCallById(callId);
      if (!call) {
        res.status(404).json({
          success: false,
          error: 'Chamada não encontrada'
        });
        return;
      }

      const endTime = new Date();

      // Calcular duração da chamada
      const duration = Math.floor((endTime.getTime() - new Date(call.started_at).getTime()) / 1000);

      // Atualizar chamada como encerrada
      await DatabaseService.updateCall(callId, {
        status: 'ended',
        ended_at: endTime,
        duration_seconds: duration
      });

      // Atualizar participante que encerrou
      await DatabaseService.updateCallParticipant(callId, userId, {
        status: 'disconnected',
        left_at: endTime
      });

      // Desconectar outros participantes ativos
      await DatabaseService.disconnectActiveParticipants(callId, userId);

      console.log(`✅ Chamada ${callId} encerrada após ${duration} segundos`);

      res.json({
        success: true,
        data: {
          call: {
            id: callId,
            status: 'ended',
            endedBy: userId,
            endedAt: endTime,
            duration: duration
          }
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao encerrar chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca o status atual de uma chamada
   * GET /api/calls/:callId/status
   */
  static async getCallStatus(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;

      const call = await DatabaseService.getCallById(callId);
      if (!call) {
        res.status(404).json({
          success: false,
          error: 'Chamada não encontrada'
        });
        return;
      }

      const participants = await DatabaseService.getCallParticipants(callId);

      res.json({
        success: true,
        data: {
          call: {
            id: call.id,
            channelName: call.channel_name,
            status: call.status,
            startedAt: call.started_at,
            endedAt: call.ended_at,
            duration: call.duration_seconds,
            apartmentId: call.apartment_id,
            apartmentNumber: call.apartment_number,
            buildingId: call.building_id,
            buildingName: call.building_name,
            doormanId: call.doorman_id,
            doormanName: call.doorman_name
          },
          participants
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao buscar status da chamada:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Lista o histórico de chamadas
   * GET /api/calls/history
   */
  static async getCallHistory(req: Request, res: Response): Promise<void> {
    try {
      const { buildingId, userId, userType, limit = '50', offset = '0' } = req.query;

      if (!buildingId || typeof buildingId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'buildingId é obrigatório'
        });
        return;
      }

      const calls = await DatabaseService.getCallHistory({
        buildingId: buildingId as string,
        userId: userId ? (userId as string) : undefined,
        userType: userType ? (userType as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: {
          calls,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: calls.length
          }
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao buscar histórico de chamadas:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca chamadas ativas no prédio
   * GET /api/calls/active
   */
  static async getActiveCalls(req: Request, res: Response): Promise<void> {
    try {
      const { buildingId } = req.query;

      if (!buildingId) {
        res.status(400).json({
          success: false,
          error: 'buildingId é obrigatório'
        });
        return;
      }

      const activeCalls = await DatabaseService.getActiveCalls(buildingId as string);

      res.json({
        success: true,
        data: {
          activeCalls,
          count: activeCalls.length
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao buscar chamadas ativas:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

export default CallController;
