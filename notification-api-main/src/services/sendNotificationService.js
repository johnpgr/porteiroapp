const pushNotificationService = require('./pushNotificationService');

class SendNotificationService {
  /**
   * Enviar notificação push para um usuário
   * @param {Object} notification - Dados da notificação
   * @param {string} notification.userId - ID do usuário
   * @param {string} notification.title - Título da notificação
   * @param {string} notification.body - Corpo da notificação
   * @param {Object} notification.data - Dados extras da notificação
   * @param {string} notification.fcmToken - Token FCM (Android/Web)
   * @param {string} notification.apnsToken - Token APNS (iOS)
   */
  async sendNotification(notification) {
    try {
      const { userId, title, body, data, fcmToken, apnsToken } = notification;

      if (!userId || !title || !body) {
        throw new Error('userId, title e body são obrigatórios');
      }

      const payload = {
        title,
        body,
        type: data?.type || 'notification',
        callId: data?.call_id || '',
        apartmentNumber: data?.apartment_number || '',
        ...data
      };

      const results = [];

      // Enviar para Android/Web se houver token FCM
      if (fcmToken) {
        const fcmResult = await pushNotificationService.sendNotification(
          fcmToken,
          'android',
          payload
        );
        results.push(fcmResult);
      }

      // Enviar para iOS se houver token APNS
      if (apnsToken) {
        const apnsResult = await pushNotificationService.sendNotification(
          apnsToken,
          'ios',
          payload
        );
        results.push(apnsResult);
      }

      if (results.length === 0) {
        console.warn(`⚠️ Nenhum token de notificação encontrado para usuário ${userId}`);
        return {
          success: false,
          error: 'Nenhum token de notificação disponível'
        };
      }

      const successCount = results.filter(r => r.sent).length;
      const success = successCount > 0;

      console.log(`📱 Notificação enviada para usuário ${userId}: ${successCount}/${results.length} tokens`);

      return {
        success,
        results,
        successCount,
        totalTokens: results.length
      };

    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar notificações em lote para múltiplos usuários
   * @param {Array} notifications - Array de notificações
   */
  async sendBatchNotifications(notifications) {
    try {
      if (!Array.isArray(notifications) || notifications.length === 0) {
        throw new Error('Array de notificações é obrigatório');
      }

      console.log(`📱 Enviando ${notifications.length} notificações em lote`);

      const results = await Promise.allSettled(
        notifications.map(notification => this.sendNotification(notification))
      );

      const successful = results.filter(
        result => result.status === 'fulfilled' && result.value.success
      ).length;

      const failed = results.filter(
        result => result.status === 'rejected' || !result.value.success
      ).length;

      console.log(`📊 Resultado do lote: ${successful}/${notifications.length} notificações enviadas com sucesso`);

      return {
        total: notifications.length,
        successful,
        failed,
        results: results.map((result, index) => ({
          index,
          userId: notifications[index].userId,
          success: result.status === 'fulfilled' && result.value.success,
          error: result.status === 'rejected' ? result.reason : result.value.error
        }))
      };

    } catch (error) {
      console.error('❌ Erro ao enviar notificações em lote:', error);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        error: error.message
      };
    }
  }
}

module.exports = new SendNotificationService();