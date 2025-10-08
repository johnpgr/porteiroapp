const { Expo } = require('expo-server-sdk');

class ExpoPushService {
  constructor() {
    this.expo = new Expo();
  }

  /**
   * Valida se um token Expo é válido
   * @param {string} pushToken - Token Expo para validar
   * @returns {boolean} - True se o token é válido
   */
  isValidExpoPushToken(pushToken) {
    return Expo.isExpoPushToken(pushToken);
  }

  /**
   * Envia notificação push para um único dispositivo
   * @param {string} pushToken - Token Expo do dispositivo
   * @param {string} title - Título da notificação
   * @param {string} body - Corpo da notificação
   * @param {Object} data - Dados adicionais (opcional)
   * @param {Object} options - Opções adicionais (sound, badge, etc.)
   * @returns {Promise<Object>} - Resultado do envio
   */
  async sendPushNotification(pushToken, title, body, data = {}, options = {}) {
    try {
      // Valida o token
      if (!this.isValidExpoPushToken(pushToken)) {
        throw new Error(`Token Expo inválido: ${pushToken}`);
      }

      // Monta a mensagem
      const message = {
        to: pushToken,
        title,
        body,
        data,
        sound: options.sound || 'default',
        badge: options.badge || 1,
        priority: options.priority || 'high',
        channelId: options.channelId || 'default',
        ...options
      };

      // Envia a notificação
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Erro ao enviar chunk de notificações:', error);
          throw error;
        }
      }

      return {
        success: true,
        tickets,
        message: 'Notificação enviada com sucesso'
      };

    } catch (error) {
      console.error('Erro no ExpoPushService.sendPushNotification:', error);
      return {
        success: false,
        error: error.message,
        tickets: []
      };
    }
  }

  /**
   * Envia notificações push para múltiplos dispositivos
   * @param {Array} notifications - Array de objetos com {pushToken, title, body, data, options}
   * @returns {Promise<Object>} - Resultado do envio em lote
   */
  async sendBulkPushNotifications(notifications) {
    try {
      const messages = [];

      // Valida e monta as mensagens
      for (const notification of notifications) {
        const { pushToken, title, body, data = {}, options = {} } = notification;

        if (!this.isValidExpoPushToken(pushToken)) {
          console.warn(`Token Expo inválido ignorado: ${pushToken}`);
          continue;
        }

        messages.push({
          to: pushToken,
          title,
          body,
          data,
          sound: options.sound || 'default',
          badge: options.badge || 1,
          priority: options.priority || 'high',
          channelId: options.channelId || 'default',
          ...options
        });
      }

      if (messages.length === 0) {
        return {
          success: false,
          error: 'Nenhuma mensagem válida para enviar',
          tickets: []
        };
      }

      // Envia as notificações em chunks
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Erro ao enviar chunk de notificações:', error);
        }
      }

      return {
        success: true,
        tickets,
        totalSent: messages.length,
        message: `${messages.length} notificações enviadas com sucesso`
      };

    } catch (error) {
      console.error('Erro no ExpoPushService.sendBulkPushNotifications:', error);
      return {
        success: false,
        error: error.message,
        tickets: []
      };
    }
  }

  /**
   * Envia notificação de chamada de interfone
   * @param {string} pushToken - Token Expo do morador
   * @param {string} apartmentNumber - Número do apartamento
   * @param {string} doormanName - Nome do porteiro (opcional)
   * @param {Object} callData - Dados da chamada (callId, etc.)
   * @returns {Promise<Object>} - Resultado do envio
   */
  async sendIntercomCallNotification(pushToken, apartmentNumber, doormanName = 'Porteiro', callData = {}) {
    const title = '📞 Chamada do Interfone';
    const body = `${doormanName} está chamando o apartamento ${apartmentNumber}`;
    
    const data = {
      type: 'intercom_call',
      apartmentNumber,
      doormanName,
      timestamp: new Date().toISOString(),
      ...callData
    };

    const options = {
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'intercom_calls',
      categoryId: 'call'
    };

    return await this.sendPushNotification(pushToken, title, body, data, options);
  }

  /**
   * Verifica o status dos tickets de notificação
   * @param {Array} tickets - Array de tickets retornados pelo envio
   * @returns {Promise<Object>} - Status dos tickets
   */
  async checkTicketStatus(tickets) {
    try {
      const receiptIds = tickets
        .filter(ticket => ticket.status === 'ok')
        .map(ticket => ticket.id);

      if (receiptIds.length === 0) {
        return {
          success: false,
          message: 'Nenhum ticket válido para verificar'
        };
      }

      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      const receipts = [];

      for (const chunk of receiptIdChunks) {
        try {
          const receiptChunk = await this.expo.getPushNotificationReceiptsAsync(chunk);
          receipts.push(receiptChunk);
        } catch (error) {
          console.error('Erro ao verificar receipts:', error);
        }
      }

      return {
        success: true,
        receipts,
        message: 'Status verificado com sucesso'
      };

    } catch (error) {
      console.error('Erro no ExpoPushService.checkTicketStatus:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia notificação de teste
   * @param {string} pushToken - Token Expo para teste
   * @returns {Promise<Object>} - Resultado do teste
   */
  async sendTestNotification(pushToken) {
    const title = '🧪 Notificação de Teste';
    const body = 'Esta é uma notificação de teste do sistema de interfone';
    
    const data = {
      type: 'test',
      timestamp: new Date().toISOString()
    };

    return await this.sendPushNotification(pushToken, title, body, data);
  }
}

module.exports = ExpoPushService;