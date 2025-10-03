const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const webrtcNotificationService = require('./webrtcNotificationService');
const { authenticateSocket } = require('../middleware/webrtcAuth');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WebRTCSignalingService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> { socketId, userInfo }
    this.activeCalls = new Map(); // callId -> { caller, receiver, status }
  }

  initialize(server) {
    console.log('Inicializando serviço de sinalização WebRTC...');
    
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    // Aplicar middleware de autenticação
    this.io.use(authenticateSocket);

    this.setupEventHandlers();
    console.log('Serviço de sinalização WebRTC inicializado com sucesso');
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Usuário conectado: ${socket.id} - ${socket.user.name} (${socket.user.userType})`);
      
      // Registrar usuário conectado automaticamente após autenticação
      this.connectedUsers.set(socket.user.id, {
        socketId: socket.id,
        userInfo: socket.user,
        connectedAt: new Date()
      });

      // Evento: Usuário se conecta ao sistema WebRTC
      socket.on('webrtc:user:connect', async (data) => {
        try {
          const { userId, userInfo } = data;
          console.log(`Usuário ${userId} conectado ao WebRTC`);

          // Armazenar informações do usuário conectado
          this.connectedUsers.set(userId, {
            socketId: socket.id,
            userInfo,
            connectedAt: new Date()
          });

          // Atualizar status no banco de dados
          await this.updateUserStatus(userId, true, true);

          // Notificar outros usuários sobre a conexão
          socket.broadcast.emit('webrtc:user:online', {
            userId,
            userInfo
          });

          // Enviar lista de usuários online para o usuário recém-conectado
          const onlineUsers = await this.getOnlineUsers();
          socket.emit('webrtc:users:online', { users: onlineUsers });

        } catch (error) {
          console.error('Erro ao conectar usuário:', error);
          socket.emit('webrtc:error', {
            type: 'connection_error',
            message: 'Erro ao conectar ao sistema WebRTC'
          });
        }
      });

      // Evento: Iniciar chamada
      socket.on('webrtc:call:initiate', async (data) => {
        try {
          const { callId, callerId, receiverId, offer } = data;
          console.log(`Iniciando chamada ${callId} de ${callerId} para ${receiverId}`);

          const receiverConnection = this.connectedUsers.get(receiverId);
          
          // Armazenar informações da chamada ativa
          this.activeCalls.set(callId, {
            caller: callerId,
            receiver: receiverId,
            status: 'ringing',
            initiatedAt: new Date()
          });

          // Atualizar status da chamada no banco
          await this.updateCallStatus(callId, 'ringing');

          // Enviar oferta para o receptor se estiver conectado via WebSocket
          if (receiverConnection) {
            this.io.to(receiverConnection.socketId).emit('webrtc:call:incoming', {
              callId,
              callerId,
              offer,
              callerInfo: this.connectedUsers.get(callerId)?.userInfo
            });
          }

          // Sempre enviar notificação WhatsApp (independente do status online)
          try {
            let callerInfo = this.connectedUsers.get(callerId)?.userInfo;
            let receiverInfo = this.connectedUsers.get(receiverId)?.userInfo;
            
            // Se o caller não estiver conectado, buscar do banco
            if (!callerInfo) {
              callerInfo = await this.getUserFromDatabase(callerId);
            }
            
            // Se o receiver não estiver conectado, buscar do banco
            if (!receiverInfo) {
              receiverInfo = await this.getUserFromDatabase(receiverId);
            }
            
            // Só enviar notificação se conseguirmos os dados dos usuários
            if (callerInfo && receiverInfo) {
              await webrtcNotificationService.sendIncomingCallNotification({
                caller: callerInfo,
                receiver: receiverInfo,
                callId,
                callType: 'audio' // Sistema de interfone apenas com áudio
              });
            } else {
              console.warn(`Não foi possível enviar notificação - Caller: ${!!callerInfo}, Receiver: ${!!receiverInfo}`);
            }
          } catch (notificationError) {
            console.error('Erro ao enviar notificação de chamada:', notificationError);
          }

          // Confirmar para o caller que a chamada foi enviada
          socket.emit('webrtc:call:sent', { callId });

        } catch (error) {
          console.error('Erro ao iniciar chamada:', error);
          socket.emit('webrtc:error', {
            type: 'call_initiate_error',
            message: 'Erro ao iniciar chamada'
          });
        }
      });

      // Evento: Responder chamada
      socket.on('webrtc:call:answer', async (data) => {
        try {
          const { callId, answer } = data;
          console.log(`Respondendo chamada ${callId}`);

          const call = this.activeCalls.get(callId);
          if (!call) {
            socket.emit('webrtc:error', {
              type: 'call_not_found',
              message: 'Chamada não encontrada'
            });
            return;
          }

          // Atualizar status da chamada
          call.status = 'answered';
          call.answeredAt = new Date();
          this.activeCalls.set(callId, call);

          // Atualizar no banco de dados
          await this.updateCallStatus(callId, 'answered');

          // Enviar resposta para o caller
          const callerConnection = this.connectedUsers.get(call.caller);
          if (callerConnection) {
            this.io.to(callerConnection.socketId).emit('webrtc:call:answered', {
              callId,
              answer
            });
          }

        } catch (error) {
          console.error('Erro ao responder chamada:', error);
          socket.emit('webrtc:error', {
            type: 'call_answer_error',
            message: 'Erro ao responder chamada'
          });
        }
      });

      // Evento: Rejeitar chamada
      socket.on('webrtc:call:reject', async (data) => {
        try {
          const { callId } = data;
          console.log(`Rejeitando chamada ${callId}`);

          const call = this.activeCalls.get(callId);
          if (!call) {
            return;
          }

          // Atualizar status da chamada
          call.status = 'rejected';
          call.endedAt = new Date();
          this.activeCalls.set(callId, call);

          // Atualizar no banco de dados
          await this.updateCallStatus(callId, 'rejected', 'rejected_by_receiver');

          // Notificar o caller
          const callerConnection = this.connectedUsers.get(call.caller);
          if (callerConnection) {
            this.io.to(callerConnection.socketId).emit('webrtc:call:rejected', {
              callId
            });
          }

          // Enviar notificação WhatsApp de chamada perdida
          try {
            const callerInfo = this.connectedUsers.get(call.caller)?.userInfo;
            const receiverInfo = this.connectedUsers.get(call.receiver)?.userInfo;
            await webrtcNotificationService.sendMissedCallNotification({
              caller: callerInfo,
              receiver: receiverInfo,
              callId,
              callType: 'audio', // Sistema de interfone apenas com áudio
              duration: 0
            });
          } catch (notificationError) {
            console.error('Erro ao enviar notificação de chamada perdida:', notificationError);
          }

          // Remover chamada ativa
          this.activeCalls.delete(callId);

        } catch (error) {
          console.error('Erro ao rejeitar chamada:', error);
        }
      });

      // Evento: Encerrar chamada
      socket.on('webrtc:call:end', async (data) => {
        try {
          const { callId, userId } = data;
          console.log(`Encerrando chamada ${callId} pelo usuário ${userId}`);

          const call = this.activeCalls.get(callId);
          if (!call) {
            return;
          }

          // Calcular duração se a chamada foi respondida
          let durationSeconds = 0;
          if (call.answeredAt) {
            durationSeconds = Math.floor((new Date() - call.answeredAt) / 1000);
          }

          // Atualizar status da chamada
          call.status = 'ended';
          call.endedAt = new Date();
          call.duration = durationSeconds;
          this.activeCalls.set(callId, call);

          // Atualizar no banco de dados
          await this.updateCallStatus(callId, 'ended', 'user_ended', durationSeconds);

          // Notificar o outro participante
          const otherUserId = call.caller === userId ? call.receiver : call.caller;
          const otherConnection = this.connectedUsers.get(otherUserId);
          if (otherConnection) {
            this.io.to(otherConnection.socketId).emit('webrtc:call:ended', {
              callId,
              endedBy: userId,
              duration: durationSeconds
            });
          }

          // Remover chamada ativa
          this.activeCalls.delete(callId);

        } catch (error) {
          console.error('Erro ao encerrar chamada:', error);
        }
      });

      // Evento: Troca de candidatos ICE
      socket.on('webrtc:ice:candidate', (data) => {
        try {
          const { callId, candidate, targetUserId } = data;
          console.log(`Enviando candidato ICE para chamada ${callId}`);

          const targetConnection = this.connectedUsers.get(targetUserId);
          if (targetConnection) {
            this.io.to(targetConnection.socketId).emit('webrtc:ice:candidate', {
              callId,
              candidate
            });
          }

        } catch (error) {
          console.error('Erro ao enviar candidato ICE:', error);
        }
      });

      // Evento: Atualizar status de disponibilidade
      socket.on('webrtc:user:status', async (data) => {
        try {
          const { userId, isAvailable } = data;
          console.log(`Atualizando status do usuário ${userId}: ${isAvailable ? 'disponível' : 'ocupado'}`);

          // Atualizar no banco de dados
          await this.updateUserStatus(userId, true, isAvailable);

          // Notificar outros usuários
          socket.broadcast.emit('webrtc:user:status:changed', {
            userId,
            isAvailable
          });

        } catch (error) {
          console.error('Erro ao atualizar status:', error);
        }
      });

      // Evento: Desconexão
      socket.on('disconnect', async () => {
        try {
          console.log(`Desconexão WebSocket: ${socket.id}`);

          // Encontrar usuário pela socketId
          let disconnectedUserId = null;
          for (const [userId, connection] of this.connectedUsers.entries()) {
            if (connection.socketId === socket.id) {
              disconnectedUserId = userId;
              break;
            }
          }

          if (disconnectedUserId) {
            console.log(`Usuário ${disconnectedUserId} desconectado`);

            // Remover da lista de conectados
            this.connectedUsers.delete(disconnectedUserId);

            // Atualizar status no banco
            await this.updateUserStatus(disconnectedUserId, false, false);

            // Encerrar chamadas ativas do usuário
            for (const [callId, call] of this.activeCalls.entries()) {
              if (call.caller === disconnectedUserId || call.receiver === disconnectedUserId) {
                await this.endCallDueToDisconnection(callId, disconnectedUserId);
              }
            }

            // Notificar outros usuários
            socket.broadcast.emit('webrtc:user:offline', {
              userId: disconnectedUserId
            });
          }

        } catch (error) {
          console.error('Erro ao processar desconexão:', error);
        }
      });
    });
  }

  // Métodos auxiliares
  async updateUserStatus(userId, isOnline, isAvailable) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          is_available: isAvailable,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Erro ao atualizar status do usuário:', error);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  }

  async updateCallStatus(callId, status, endReason = null, duration = null) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'answered') {
        updateData.answered_at = new Date().toISOString();
      } else if (status === 'ended' || status === 'rejected') {
        updateData.ended_at = new Date().toISOString();
        if (endReason) updateData.end_reason = endReason;
        if (duration !== null) updateData.duration_seconds = duration;
      }

      const { error } = await supabase
        .from('webrtc_calls')
        .update(updateData)
        .eq('id', callId);

      if (error) {
        console.error('Erro ao atualizar status da chamada:', error);
      }
    } catch (error) {
      console.error('Erro ao atualizar chamada:', error);
    }
  }

  async getOnlineUsers() {
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, is_available')
        .eq('is_online', true);

      if (error) {
        console.error('Erro ao buscar usuários online:', error);
        return [];
      }

      return users || [];
    } catch (error) {
      console.error('Erro ao buscar usuários online:', error);
      return [];
    }
  }

  async endCallDueToDisconnection(callId, disconnectedUserId) {
    try {
      const call = this.activeCalls.get(callId);
      if (!call) return;

      // Calcular duração se a chamada foi respondida
      let durationSeconds = 0;
      if (call.answeredAt) {
        durationSeconds = Math.floor((new Date() - call.answeredAt) / 1000);
      }

      // Atualizar no banco
      await this.updateCallStatus(callId, 'ended', 'disconnection', durationSeconds);

      // Notificar o outro participante
      const otherUserId = call.caller === disconnectedUserId ? call.receiver : call.caller;
      const otherConnection = this.connectedUsers.get(otherUserId);
      if (otherConnection) {
        this.io.to(otherConnection.socketId).emit('webrtc:call:ended', {
          callId,
          endedBy: disconnectedUserId,
          reason: 'disconnection',
          duration: durationSeconds
        });
      }

      // Remover chamada ativa
      this.activeCalls.delete(callId);

    } catch (error) {
      console.error('Erro ao encerrar chamada por desconexão:', error);
    }
  }

  // Método para buscar usuário do banco de dados
  async getUserFromDatabase(userId) {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, phone, expo_push_token, is_online, is_available')
        .eq('id', userId)
        .single();

      if (error) {
        console.error(`Erro ao buscar usuário ${userId} do banco:`, error);
        return null;
      }

      // Mapear os campos para manter compatibilidade
      return {
        id: user.id,
        name: user.full_name,
        user_type: user.user_type,
        phone: user.phone,
        device_token: user.expo_push_token,
        is_online: user.is_online,
        is_available: user.is_available
      };
    } catch (error) {
      console.error(`Erro ao buscar usuário ${userId}:`, error);
      return null;
    }
  }

  // Método para enviar notificação de chamada perdida
  async sendMissedCallNotification(callId, callerId, receiverId) {
    try {
      // Buscar informações dos usuários
      const { data: caller } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', callerId)
        .single();

      const { data: receiver } = await supabase
        .from('profiles')
        .select('full_name, expo_push_token')
        .eq('id', receiverId)
        .single();

      if (caller && receiver && receiver.expo_push_token) {
        // Aqui você pode integrar com o sistema de notificações existente
        console.log(`Enviando notificação de chamada perdida para ${receiver.full_name}`);
        
        // Exemplo de integração com FCM (Firebase Cloud Messaging)
        // await this.sendFCMNotification(receiver.expo_push_token, {
        //   title: 'Chamada perdida',
        //   body: `Você perdeu uma chamada de ${caller.full_name}`,
        //   data: { callId, callerId, type: 'missed_call' }
        // });
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de chamada perdida:', error);
    }
  }

  // Método para obter estatísticas do sistema
  getSystemStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeCalls: this.activeCalls.size,
      uptime: process.uptime()
    };
  }
}

module.exports = new WebRTCSignalingService();