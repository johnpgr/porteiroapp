const ExpoPushService = require('./expoPushService');

class IntercomCallService {
  constructor() {
    this.activeCalls = new Map();
    this.expoPushService = new ExpoPushService();
  }

  /**
   * Inicia uma chamada contínua
   * @param {Object} callData - Dados da chamada
   * @param {Function} callback - Callback para envio de notificações
   */
  async startCall(callData, callback) {
    console.log('📞 Iniciando chamada contínua:', callData.callId);

    // Parar chamada existente se houver
    if (this.activeCalls.has(callData.callId)) {
      this.stopCall(callData.callId);
    }

    // Enviar primeira notificação imediatamente
    await this.sendCallNotification(callData, callback);

    // Configurar intervalo para notificações repetidas (a cada 2 segundos)
    const interval = setInterval(async () => {
      try {
        await this.sendCallNotification(callData, callback);
      } catch (error) {
        console.error('❌ Erro ao enviar notificação repetida:', error);
      }
    }, 2000);

    // Configurar timeout da chamada (45 segundos)
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout da chamada:', callData.callId);
      this.stopCall(callData.callId);
      this.handleCallTimeout(callData);
    }, 45000);

    // Armazenar dados da chamada ativa
    this.activeCalls.set(callData.callId, {
      interval,
      timeout,
      data: callData,
      callback,
      startTime: Date.now()
    });

    console.log(`✅ Chamada contínua iniciada: ${callData.callId}`);
  }

  /**
   * Para uma chamada contínua
   * @param {string} callId - ID da chamada
   */
  stopCall(callId) {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) {
      console.log(`⚠️ Chamada não encontrada para parar: ${callId}`);
      return;
    }

    console.log('🛑 Parando chamada contínua:', callId);

    // Limpar interval e timeout
    clearInterval(activeCall.interval);
    clearTimeout(activeCall.timeout);

    // Remover da lista de chamadas ativas
    this.activeCalls.delete(callId);

    const duration = Math.round((Date.now() - activeCall.startTime) / 1000);
    console.log(`✅ Chamada parada: ${callId} (duração: ${duration}s)`);
  }

  /**
   * Envia notificação de chamada para todos os moradores usando Expo Push
   * @param {Object} callData - Dados da chamada
   * @param {Function} callback - Callback para envio (mantido para compatibilidade)
   */
  async sendCallNotification(callData, callback) {
    try {
      // Enviar notificação para cada morador com token ativo
      if (callData.deviceTokens && callData.deviceTokens.length > 0) {
        for (const resident of callData.residents) {
          if (resident.notificationEnabled) {
            const residentTokens = callData.deviceTokens.filter(
              token => token.profile_id === resident.id
            );

            for (const deviceToken of residentTokens) {
              // Verificar se é um token Expo válido
              if (this.expoPushService.isValidExpoPushToken(deviceToken.token)) {
                // Usar Expo Push Service
                const callData_notification = {
                  type: 'intercom_call',
                  callId: callData.callId,
                  apartmentNumber: callData.apartmentNumber,
                  doormanId: callData.doormanId,
                  doormanName: callData.doormanName,
                  buildingId: callData.buildingId,
                  buildingName: callData.buildingName,
                  action: 'incoming_call',
                  timestamp: new Date().toISOString(),
                  userId: resident.id
                };

                const options = {
                  sound: 'default',
                  badge: 1,
                  priority: 'high',
                  channelId: 'intercom_calls'
                };

                const result = await this.expoPushService.sendIntercomCallNotification(
                  deviceToken.token,
                  callData.apartmentNumber,
                  callData.doormanName || 'Porteiro',
                  callData_notification
                );

                if (result.success) {
                  console.log(`✅ Notificação Expo enviada para ${resident.id}`);
                } else {
                  console.error(`❌ Erro ao enviar notificação Expo: ${result.error}`);
                }
              } else {
                // Fallback para o método antigo se não for token Expo
                const notification = {
                  userId: resident.id,
                  title: 'Chamada do Interfone',
                  body: `Porteiro chamando para o apartamento ${callData.apartmentNumber}`,
                  data: {
                    type: 'intercom_call',
                    callId: callData.callId,
                    apartmentNumber: callData.apartmentNumber,
                    doormanId: callData.doormanId,
                    doormanName: callData.doormanName,
                    buildingId: callData.buildingId,
                    buildingName: callData.buildingName,
                    action: 'incoming_call',
                    timestamp: new Date().toISOString()
                  },
                  deviceToken: deviceToken.token,
                  platform: deviceToken.platform,
                  priority: 'high',
                  sound: 'default',
                  badge: 1
                };

                // Enviar via callback (sendNotificationService) para tokens não-Expo
                if (callback) {
                  await callback(notification);
                }
              }
            }
          }
        }
      }

      console.log(`📱 Notificações de chamada enviadas: ${callData.callId}`);

    } catch (error) {
      console.error('❌ Erro ao enviar notificação de chamada:', error);
    }
  }

  /**
   * Manipula timeout de chamada
   * @param {Object} callData - Dados da chamada
   */
  async handleCallTimeout(callData) {
    console.log('⏰ Chamada expirou por timeout:', callData.callId);

    try {
      // Aqui você pode adicionar lógica adicional para timeout
      // Como atualizar o banco de dados, enviar notificação de timeout, etc.
      
      // Exemplo: Notificar porteiro sobre timeout
      const timeoutNotification = {
        title: 'Chamada não atendida',
        body: `Apartamento ${callData.apartmentNumber} não atendeu a chamada`,
        data: {
          type: 'call_timeout',
          callId: callData.callId,
          apartmentNumber: callData.apartmentNumber
        }
      };

      console.log('📢 Timeout processado:', timeoutNotification);

    } catch (error) {
      console.error('❌ Erro ao processar timeout:', error);
    }
  }

  /**
   * Obtém chamadas ativas
   * @returns {Array} Lista de IDs das chamadas ativas
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.keys());
  }

  /**
   * Verifica se há chamada ativa
   * @param {string} callId - ID da chamada (opcional)
   * @returns {boolean}
   */
  hasActiveCall(callId) {
    if (callId) {
      return this.activeCalls.has(callId);
    }
    return this.activeCalls.size > 0;
  }

  /**
   * Obtém informações de uma chamada ativa
   * @param {string} callId - ID da chamada
   * @returns {Object|null}
   */
  getCallInfo(callId) {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) return null;

    return {
      callId,
      startTime: activeCall.startTime,
      duration: Math.round((Date.now() - activeCall.startTime) / 1000),
      data: activeCall.data
    };
  }

  /**
   * Para todas as chamadas ativas
   */
  stopAllCalls() {
    console.log('🛑 Parando todas as chamadas ativas...');
    
    for (const callId of this.activeCalls.keys()) {
      this.stopCall(callId);
    }
    
    console.log('✅ Todas as chamadas foram paradas');
  }

  /**
   * Limpa recursos do serviço
   */
  cleanup() {
    this.stopAllCalls();
    console.log('🧹 Serviço de chamadas limpo');
  }
}

module.exports = IntercomCallService;