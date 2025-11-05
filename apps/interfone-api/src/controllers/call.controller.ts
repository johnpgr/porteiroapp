import type { Request, Response } from 'express';
import DatabaseService from '../services/db.service.ts';
import agoraService from '../services/agora.service.ts';
import pushService from '../services/push.service.ts';

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
      const {
        apartmentNumber,
        doormanId,
        buildingId,
        fromUserId,
        // toUserId,
        context,
        clientVersion,
        schemaVersion
      } = req.body;

      // Validação dos parâmetros obrigatórios
      if (!apartmentNumber || !buildingId || (!doormanId && !fromUserId)) {
        res.status(400).json({
          success: false,
          error: 'apartmentNumber, buildingId e doormanId/fromUserId são obrigatórios'
        });
        return;
      }

      const effectiveDoormanId = String(doormanId ?? fromUserId);

      console.log(
        `🔔 Iniciando chamada (iniciador ${effectiveDoormanId}) para apartamento ${apartmentNumber} no prédio ${buildingId}`
      );

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
      const doorman = await DatabaseService.getDoormanProfile(effectiveDoormanId);
      if (!doorman) {
        res.status(404).json({
          success: false,
          error: 'Porteiro não encontrado'
        });
        return;
      }

      // Criar chamada no banco de dados primeiro
      const call = await DatabaseService.createIntercomCall(apartment.id, effectiveDoormanId, {
        status: 'calling'
      });

      // Verificar se a chamada foi criada com sucesso
      if (!call || !call.id) {
        console.error('🔥 Erro: Chamada não foi criada corretamente');
        res.status(500).json({
          success: false,
          error: 'Erro ao criar chamada no banco de dados'
        });
        return;
      }

      const callId = call.id;

      let channelName =
        call.channel_name ??
        call.twilio_conference_sid ??
        `call-${callId}`;

      if (!call.twilio_conference_sid) {
        try {
          const updatedCall = await DatabaseService.updateCall(callId, {
            twilio_conference_sid: channelName
          });

          if (updatedCall?.twilio_conference_sid) {
            channelName = updatedCall.twilio_conference_sid;
          }
        } catch (channelError) {
          console.warn('⚠️ Não foi possível persistir o channelName da chamada', channelError);
        }
      }

      console.log(`✅ Chamada ${callId} criada com canal ${channelName}`);

      // Buscar moradores do apartamento
      const residents = await DatabaseService.getResidentsByApartment(apartment.id);

      if (!residents || residents.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Nenhum morador encontrado para este apartamento'
        });
        return;
      }

      const participants: any[] = [];
      const inviteTargets: string[] = [];

      // Gera tokens curtos para o iniciador (porteiro)
      const initiatorTokenBundle = agoraService.generateTokenPair({
        channelName,
        uid: String(effectiveDoormanId),
        role: 'publisher'
      });

      // Adicionar porteiro como participante
      await DatabaseService.addCallParticipant({
        call_id: callId,
        resident_id: effectiveDoormanId,
        status: 'answered',
        joined_at: new Date()
      });

      participants.push({
        user_id: String(effectiveDoormanId),
        user_type: 'doorman',
        role: 'caller',
        name: doorman.full_name,
        status: 'connected',
        rtcUid: String(effectiveDoormanId),
        rtmId: String(effectiveDoormanId)
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
          role: 'callee',
          name: resident.name,
          phone: resident.phone,
          status: 'ringing',
          rtcUid: String(resident.id),
          rtmId: String(resident.id),
          pushToken: resident.push_token ?? null,
          voipPushToken: resident.voip_push_token ?? null,
          notification_enabled: resident.notification_enabled ?? false
        });

        inviteTargets.push(String(resident.id));
      }

      console.log(`✅ Chamada ${callId} criada com ${participants.length} participantes`);

      const timestamp = Date.now();
      const parsedSchemaVersion =
        typeof schemaVersion === 'number'
          ? schemaVersion
          : typeof schemaVersion === 'string'
            ? Number.parseInt(schemaVersion, 10)
            : undefined;

      const payloadVersion =
        typeof parsedSchemaVersion === 'number' && Number.isFinite(parsedSchemaVersion)
          ? parsedSchemaVersion
          : 1;

      const invitePayload: Record<string, unknown> = {
        t: 'INVITE',
        v: payloadVersion,
        callId,
        from: String(effectiveDoormanId),
        channel: channelName,
        ts: timestamp
      };

      if (clientVersion) {
        invitePayload.clientVersion = clientVersion;
      }

      if (context) {
        invitePayload.context = context;
      }

      // Filter residents who can receive push notifications (need BOTH token AND enabled)
      const residentParticipants = participants.filter((p: any) => p.user_type === 'resident');
      const withTokens = residentParticipants.filter((p: any) => p.pushToken || p.voipPushToken);
      const withNotificationsEnabled = residentParticipants.filter((p: any) => p.notification_enabled);

      // Separate iOS (VoIP) and Android (regular) recipients
      const iosRecipients = residentParticipants.filter((p: any) => p.voipPushToken && p.notification_enabled);
      const androidRecipients = residentParticipants.filter((p: any) => p.pushToken && p.notification_enabled && !p.voipPushToken);
      const eligibleForNotifications = [...iosRecipients, ...androidRecipients];

      console.log(`📊 Resident notification eligibility:`);
      console.log(`   Total residents: ${residentParticipants.length}`);
      console.log(`   With push tokens: ${withTokens.length}`);
      console.log(`   With notifications enabled: ${withNotificationsEnabled.length}`);
      console.log(`   Eligible iOS (VoIP): ${iosRecipients.length}`);
      console.log(`   Eligible Android (regular): ${androidRecipients.length}`);
      console.log(`   Total eligible: ${eligibleForNotifications.length}`);

      const voipPushTargets = iosRecipients.map((participant: any) => ({
        userId: participant.user_id,
        voipToken: participant.voipPushToken,
        name: participant.name
      }));

      const pushFallbackTargets = androidRecipients.map((participant: any) => ({
        userId: participant.user_id,
        pushToken: participant.pushToken,
        name: participant.name
      }));

      const serializedParticipants = participants.map((participant: any) => {
        // Remover dados sensíveis (push tokens, voip tokens, notification settings) do payload público
        const { pushToken, voipPushToken, notification_enabled, ...rest } = participant;
        return rest;
      });

      // Warn if no residents can receive push notifications (RTM still works for open apps)
      if (eligibleForNotifications.length === 0 && residentParticipants.length > 0) {
        console.warn(`⚠️  No residents will receive push notifications (call will rely on RTM for open apps)`);
        console.warn(`   Total residents: ${residentParticipants.length}`);
        console.warn(`   With push tokens: ${withTokens.length}`);
        console.warn(`   With notifications enabled: ${withNotificationsEnabled.length}`);
        console.warn(`   Eligible iOS (VoIP): ${iosRecipients.length}`);
        console.warn(`   Eligible Android: ${androidRecipients.length}`);

        // Determine specific reason
        let reason: string;
        if (withTokens.length === 0) {
          reason = 'No residents have registered push tokens';
        } else if (withNotificationsEnabled.length === 0) {
          reason = 'All residents have notifications disabled';
        } else {
          reason = 'No residents have both push token and notifications enabled';
        }
        console.warn(`   Reason: ${reason}`);
        console.warn(`   ℹ️  Call will proceed - residents with app open will receive RTM invite`);
      }

      // Send push notifications as fallback for RTM invites
      let pushNotificationsSent = 0;
      let voipPushNotificationsSent = 0;

      if (pushService.isEnabled()) {
        const baseCallData = {
          callId,
          from: String(effectiveDoormanId),
          fromName: doorman.full_name || 'Porteiro',
          apartmentNumber,
          buildingName: apartment.building_name,
          channelName,
          metadata: {
            schemaVersion: payloadVersion,
            clientVersion: clientVersion ?? null
          }
        };

        // Send VoIP pushes to iOS devices
        if (voipPushTargets.length > 0) {
          console.log(`📱 [iOS] Sending ${voipPushTargets.length} VoIP push notifications...`);

          const voipResults = await pushService.sendVoipPushesToMultiple(
            baseCallData,
            voipPushTargets
          );

          voipPushNotificationsSent = voipResults.filter((result) => result.success).length;

          const failedVoipPushes = voipResults.filter((result) => !result.success);
          if (failedVoipPushes.length > 0) {
            console.warn(`⚠️ [iOS] ${failedVoipPushes.length} VoIP pushes failed:`,
              failedVoipPushes.map(f => ({ token: f.pushToken, error: f.error }))
            );
          }

          console.log(`✅ [iOS] ${voipPushNotificationsSent}/${voipPushTargets.length} VoIP pushes sent`);
        }

        // Send regular pushes to Android devices
        if (pushFallbackTargets.length > 0) {
          console.log(`📱 [Android] Sending ${pushFallbackTargets.length} regular push notifications...`);

          const pushResults = await pushService.sendCallInvitesToMultiple(
            baseCallData,
            pushFallbackTargets
          );

          pushNotificationsSent = pushResults.filter((result) => result.success).length;

          const failedPushes = pushResults.filter((result) => !result.success);
          if (failedPushes.length > 0) {
            console.warn(`⚠️ [Android] ${failedPushes.length} regular pushes failed:`,
              failedPushes.map(f => ({ token: f.pushToken, error: f.error }))
            );
          }

          console.log(`✅ [Android] ${pushNotificationsSent}/${pushFallbackTargets.length} regular pushes sent`);
        }
      }

      const totalPushNotificationsSent = pushNotificationsSent + voipPushNotificationsSent;

      // Retornar dados da chamada criada
      res.status(201).json({
        success: true,
        data: {
          call: {
            id: callId,
            channelName,
            apartmentNumber,
            buildingId,
            status: call.status ?? 'calling',
            startedAt: call.started_at,
            initiatorId: String(effectiveDoormanId),
            context: context ?? null
          },
          participants: serializedParticipants,
          tokens: {
            initiator: initiatorTokenBundle
          },
          signaling: {
            invite: invitePayload,
            targets: inviteTargets,
            pushFallback: pushFallbackTargets
          },
          apartment: {
            id: apartment.id,
            number: apartment.number,
            block: apartment.block
          },
          doorman: {
            id: doorman.id,
            name: doorman.full_name
          },
          notificationsSent: totalPushNotificationsSent, // Backward compatibility
          metadata: {
            schemaVersion: payloadVersion,
            clientVersion: clientVersion ?? null,
            pushNotificationsSent: totalPushNotificationsSent,
            iosPushNotificationsSent: voipPushNotificationsSent,
            androidPushNotificationsSent: pushNotificationsSent
          }
        },
        message: totalPushNotificationsSent > 0
          ? `Chamada iniciada. ${totalPushNotificationsSent} notificação${totalPushNotificationsSent > 1 ? 'ões' : ''} enviada${totalPushNotificationsSent > 1 ? 's' : ''} (iOS: ${voipPushNotificationsSent}, Android: ${pushNotificationsSent}).`
          : 'Chamada iniciada.'
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

      if (call.status !== 'calling') {
        res.status(400).json({
          success: false,
          error: 'Chamada não está disponível para atendimento'
        });
        return;
      }

      // Atualizar status da chamada para 'answered'
      await DatabaseService.updateCallStatus(callId, 'answered');

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

      // Generate token bundle for the answering user to eliminate extra round-trip
      const channelName = updatedCall?.channel_name ?? call.channel_name;
      const tokenBundle = channelName
        ? agoraService.generateTokenPair({
            channelName,
            uid: userId,
            role: 'publisher'
          })
        : null;

      console.log(`✅ Chamada ${callId} atendida por ${userId}${tokenBundle ? ' (tokens incluídos)' : ''}`);

      res.json({
        success: true,
        data: {
          call: {
            id: updatedCall?.id ?? callId,
            channelName: channelName ?? null,
            status: updatedCall?.status ?? 'answered',
            answeredBy: userId,
            answeredAt: updatedCall?.answered_at ?? new Date().toISOString()
          },
          participants,
          tokens: tokenBundle
            ? {
                channelName: tokenBundle.channelName,
                rtcToken: tokenBundle.rtcToken,
                rtmToken: tokenBundle.rtmToken,
                uid: tokenBundle.uid,
                rtcRole: tokenBundle.rtcRole,
                ttlSeconds: tokenBundle.ttlSeconds,
                expiresAt: tokenBundle.expiresAt,
                issuedAt: tokenBundle.issuedAt
              }
            : undefined
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
        await DatabaseService.updateCallStatus(callId, 'ended');
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

  /**
   * Busca chamadas pendentes para um usuário específico
   * GET /api/calls/pending?userId=xxx
   * Usado para polling quando push notifications estão desabilitadas
   */
  static async getPendingCalls(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;

      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'userId é obrigatório'
        });
        return;
      }

      console.log(`🔍 Buscando chamadas pendentes para userId (profileId): ${userId}`);

      // userId is actually the profile ID, not auth.user_id
      // Get apartment_id from apartment_residents table
      const apartmentId = await DatabaseService.getApartmentIdByProfileId(userId);

      console.log(`🏠 Apartment resident lookup:`, {
        found: !!apartmentId,
        apartmentId: apartmentId
      });

      if (!apartmentId) {
        console.log(`⚠️ No apartment found for userId ${userId}, returning empty calls array`);
        res.json({
          success: true,
          calls: []
        });
        return;
      }

      // Get pending calls for the apartment
      const calls = await DatabaseService.getPendingCallsForApartment(apartmentId);

      console.log(`📞 Encontradas ${calls?.length || 0} chamadas pendentes para usuário ${userId}`);

      res.json({
        success: true,
        calls: calls || []
      });

    } catch (error) {
      console.error('🔥 Erro ao buscar chamadas pendentes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

export default CallController;
