const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const sendNotificationService = require('../services/sendNotificationService');
const twilioService = require('../services/twilioService');

const router = express.Router();

// Environment variables accessed via process.env

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Endpoint para gerar token de acesso Twilio
 * POST /api/intercom/token
 */
router.post('/intercom/token', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: 'user_id é obrigatório'
      });
    }

    const token = twilioService.generateAccessToken(user_id);

    res.json({
      success: true,
      token
    });

  } catch (error) {
    console.error('Erro ao gerar token:', error);
    res.status(500).json({
      error: 'Erro ao gerar token de acesso'
    });
  }
});

/**
 * Endpoint para iniciar uma chamada de interfone app-to-app
 * POST /api/intercom/call
 */
router.post('/intercom/call', async (req, res) => {
  try {
    const { apartment_number, doorman_id, building_id } = req.body;

    if (!apartment_number || !doorman_id || !building_id) {
      return res.status(400).json({
        error: 'apartment_number, doorman_id e building_id são obrigatórios'
      });
    }

    // Buscar apartamento
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('id, number, building_id')
      .eq('number', apartment_number)
      .eq('building_id', building_id)
      .single();

    if (apartmentError || !apartment) {
      return res.status(404).json({
        error: 'Apartamento não encontrado'
      });
    }

    // Buscar moradores do apartamento com tokens de dispositivo
    const { data: residents, error: residentsError } = await supabase
      .from('apartment_residents')
      .select(`
        id,
        profile_id,
        profiles:profile_id (
          id,
          full_name,
          phone,
          notification_enabled
        )
      `)
      .eq('apartment_id', apartment.id);

    if (residentsError) {
      console.error('Erro ao buscar moradores:', residentsError);
      return res.status(500).json({
        error: 'Erro ao buscar moradores do apartamento'
      });
    }

    if (!residents || residents.length === 0) {
      return res.status(404).json({
        error: 'Nenhum morador encontrado para este apartamento'
      });
    }

    // Criar identidade única para o apartamento
    const apartmentIdentity = `apt-${apartment.id}`;

    // Buscar tokens de dispositivo dos moradores
    const residentIds = residents.map(r => r.profiles.id);
    const { data: deviceTokens, error: tokensError } = await supabase
      .from('user_notification_tokens')
      .select('user_id, notification_token, device_type')
      .in('user_id', residentIds)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Erro ao buscar tokens de dispositivo:', tokensError);
    }

    // Criar registro da chamada SEM Twilio ainda - aguardar confirmação
    const { data: callRecord, error: callError } = await supabase
      .from('intercom_calls')
      .insert({
        apartment_id: apartment.id,
        doorman_id,
        status: 'ringing', // Status inicial: tocando/aguardando
        started_at: new Date().toISOString(),
        twilio_call_sid: null // Será preenchido após confirmação
      })
      .select()
      .single();

    if (callError) {
      console.error('Erro ao criar chamada:', callError);
      return res.status(500).json({
        error: 'Erro ao criar registro da chamada'
      });
    }

    // Criar registros dos participantes
    const participants = residents.map(resident => ({
      call_id: callRecord.id,
      resident_id: resident.profile_id,
      status: 'invited'
    }));

    const { error: participantsError } = await supabase
      .from('call_participants')
      .insert(participants);

    if (participantsError) {
      console.error('Erro ao criar participantes:', participantsError);
    }

    // Enviar notificações push para moradores
    const notifications = [];
    
    if (deviceTokens && deviceTokens.length > 0) {
      for (const resident of residents) {
        if (resident.profiles.notification_enabled) {
          const residentTokens = deviceTokens.filter(token => token.user_id === resident.profiles.id);
          
          for (const deviceToken of residentTokens) {
            try {
              const notification = {
                userId: resident.profiles.id,
                title: 'Chamada do Interfone',
                body: `Porteiro chamando para o apartamento ${apartment_number}`,
                data: {
                  type: 'intercom_call',
                  callId: callRecord.id,
                  apartmentNumber: apartment_number,
                  doormanId: doorman_id,
                  buildingId: building_id,
                  action: 'incoming_call',
                  apartmentIdentity: apartmentIdentity
                },
                deviceToken: deviceToken.notification_token,
                platform: deviceToken.device_type
              };

              await sendNotificationService.sendNotification(notification);
              notifications.push(notification);
            } catch (notificationError) {
              console.error('Erro ao enviar notificação:', notificationError);
            }
          }
        }
      }
    }

    // Iniciar sistema de chamada contínua
    const IntercomCallService = require('../services/intercomCallService');
    const callService = new IntercomCallService();

    // Preparar dados da chamada para o sistema contínuo
    const callData = {
      callId: callRecord.id,
      apartmentNumber: apartment_number,
      doormanId: doorman_id,
      buildingId: building_id,
      apartmentIdentity: apartmentIdentity,
      residents: residents.map(resident => ({
        id: resident.profiles.id,
        name: resident.profiles.full_name,
        phone: resident.profiles.phone,
        notificationEnabled: resident.profiles.notification_enabled
      })),
      deviceTokens: deviceTokens || []
    };

    // Iniciar chamada contínua
    await callService.startCall(callData, async (notification) => {
      try {
        await sendNotificationService.sendNotification(notification);
      } catch (error) {
        console.error('Erro ao enviar notificação contínua:', error);
      }
    });

    res.json({
      success: true,
      call_id: callRecord.id,
      status: 'ringing', // Indica que está tocando, aguardando resposta
      apartment_identity: apartmentIdentity,
      apartment: {
        id: apartment.id,
        number: apartment.number
      },
      residents_count: residents.length,
      notifications_sent: notifications.length
    });

  } catch (error) {
    console.error('Erro no endpoint de chamada:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * Endpoint TwiML para chamadas de saída (outgoing)
 * POST /api/intercom/twiml/outgoing
 */
router.post('/intercom/twiml/outgoing', (req, res) => {
  try {
    const { To } = req.body;
    
    if (!To) {
      return res.status(400).send('Parâmetro To é obrigatório');
    }

    // Extrair identidade do cliente (formato: client:apt-123)
    const targetIdentity = To.replace('client:', '');
    const twiml = twilioService.generateConnectTwiML(targetIdentity);
    
    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    console.error('Erro ao gerar TwiML de saída:', error);
    const errorTwiml = twilioService.generateNoAnswerTwiML();
    res.type('text/xml');
    res.send(errorTwiml);
  }
});

/**
 * Endpoint TwiML para chamadas de entrada (incoming)
 * POST /api/intercom/twiml/incoming
 */
router.post('/intercom/twiml/incoming', (req, res) => {
  try {
    const { From } = req.body;
    
    if (!From) {
      return res.status(400).send('Parâmetro From é obrigatório');
    }

    // Para chamadas de entrada, conectar com o porteiro
    const twiml = twilioService.generateConnectTwiML('porteiro');
    
    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    console.error('Erro ao gerar TwiML de entrada:', error);
    const errorTwiml = twilioService.generateNoAnswerTwiML();
    res.type('text/xml');
    res.send(errorTwiml);
  }
});

/**
 * Webhook para status das chamadas Twilio
 * POST /api/intercom/webhook/status
 */
router.post('/intercom/webhook/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, Duration } = req.body;

    console.log('Webhook Twilio:', { CallSid, CallStatus, Duration });

    // Buscar chamada pelo SID do Twilio
    const { data: call, error: callError } = await supabase
      .from('intercom_calls')
      .select('id, status')
      .eq('twilio_call_sid', CallSid)
      .single();

    if (callError || !call) {
      console.error('Chamada não encontrada:', CallSid);
      return res.status(200).send('OK');
    }

    // Mapear status do Twilio para nosso sistema
    let newStatus = call.status;
    let updateData = {};

    switch (CallStatus) {
      case 'ringing':
        newStatus = 'ringing';
        break;
      case 'answered':
        newStatus = 'answered';
        updateData.answered_at = new Date().toISOString();
        break;
      case 'completed':
      case 'busy':
      case 'no-answer':
      case 'failed':
        newStatus = 'ended';
        updateData.ended_at = new Date().toISOString();
        if (Duration) {
          updateData.duration = parseInt(Duration);
        }
        break;
    }

    // Atualizar status da chamada
    if (newStatus !== call.status) {
      updateData.status = newStatus;
      
      await supabase
        .from('intercom_calls')
        .update(updateData)
        .eq('id', call.id);
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(200).send('OK');
  }
});

/**
 * Endpoint para responder uma chamada
 * POST /api/intercom/answer
 */
router.post('/intercom/answer', async (req, res) => {
  try {
    const { call_id, resident_id } = req.body;

    if (!call_id || !resident_id) {
      return res.status(400).json({
        error: 'call_id e resident_id são obrigatórios'
      });
    }

    // Parar chamada contínua
    const IntercomCallService = require('../services/intercomCallService');
    const callService = new IntercomCallService();
    callService.stopCall(call_id);

    // Buscar informações da chamada para conectar Twilio
    const { data: callData, error: fetchError } = await supabase
      .from('intercom_calls')
      .select('*')
      .eq('id', call_id)
      .single();

    if (fetchError || !callData) {
      console.error('Erro ao buscar chamada:', fetchError);
      return res.status(404).json({
        error: 'Chamada não encontrada'
      });
    }

    // Agora que o morador atendeu, conectar via Twilio
    let twilioCallSid = null;
    try {
      const twilioCall = await twilioService.makeCall(
        callData.apartment_identity,
        callData.doorman_id
      );
      twilioCallSid = twilioCall.sid;
      console.log('✅ Chamada Twilio conectada:', twilioCallSid);
    } catch (twilioError) {
      console.error('❌ Erro ao conectar Twilio:', twilioError);
      // Continuar mesmo se Twilio falhar, para não bloquear o fluxo
    }

    // Atualizar status da chamada com SID do Twilio
    const { error: callError } = await supabase
      .from('intercom_calls')
      .update({
        status: 'answered',
        answered_at: new Date().toISOString(),
        twilio_call_sid: twilioCallSid
      })
      .eq('id', call_id);

    if (callError) {
      console.error('Erro ao atualizar chamada:', callError);
      return res.status(500).json({
        error: 'Erro ao atualizar status da chamada'
      });
    }

    // Atualizar status do participante
    const { error: participantError } = await supabase
      .from('call_participants')
      .update({
        status: 'answered',
        answered_at: new Date().toISOString()
      })
      .eq('call_id', call_id)
      .eq('resident_id', resident_id);

    if (participantError) {
      console.error('Erro ao atualizar participante:', participantError);
    }

    res.json({
      success: true,
      message: 'Chamada respondida com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint de resposta:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * Endpoint para encerrar uma chamada
 * POST /api/intercom/hangup
 */
router.post('/intercom/hangup', async (req, res) => {
  try {
    const { call_id } = req.body;

    if (!call_id) {
      return res.status(400).json({
        error: 'call_id é obrigatório'
      });
    }

    // Parar chamada contínua
    const IntercomCallService = require('../services/intercomCallService');
    const callService = new IntercomCallService();
    callService.stopCall(call_id);

    // Buscar chamada com SID do Twilio
    const { data: call, error: fetchError } = await supabase
      .from('intercom_calls')
      .select('twilio_call_sid')
      .eq('id', call_id)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar chamada:', fetchError);
    }

    // Encerrar chamada no Twilio se existir SID
    if (call?.twilio_call_sid) {
      try {
        await twilioService.hangupCall(call.twilio_call_sid);
      } catch (twilioError) {
        console.error('Erro ao encerrar chamada Twilio:', twilioError);
      }
    }

    // Atualizar status da chamada
    const { error: callError } = await supabase
      .from('intercom_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', call_id);

    if (callError) {
      console.error('Erro ao encerrar chamada:', callError);
      return res.status(500).json({
        error: 'Erro ao encerrar chamada'
      });
    }

    res.json({
      success: true,
      message: 'Chamada encerrada com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint de encerramento:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * Endpoint para buscar histórico de chamadas
 * GET /api/intercom/history
 */
router.get('/intercom/history', async (req, res) => {
  try {
    const { building_id, limit = 50 } = req.query;

    let query = supabase
      .from('intercom_calls')
      .select(`
        id,
        status,
        started_at,
        answered_at,
        ended_at,
        duration,
        apartments:apartment_id (
          number,
          building_id
        ),
        profiles:doorman_id (
          full_name
        )
      `)
      .order('started_at', { ascending: false })
      .limit(parseInt(limit));

    if (building_id) {
      query = query.eq('apartments.building_id', building_id);
    }

    const { data: calls, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return res.status(500).json({
        error: 'Erro ao buscar histórico de chamadas'
      });
    }

    res.json({
      success: true,
      calls: calls || []
    });

  } catch (error) {
    console.error('Erro no endpoint de histórico:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;