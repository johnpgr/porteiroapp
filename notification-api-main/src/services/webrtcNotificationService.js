const whatsappService = require('./whatsappService');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WebRTCNotificationService {
  constructor() {
    this.notificationQueue = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 segundos
  }

  // Enviar notificação de chamada recebida
  async sendIncomingCallNotification(callData) {
    try {
      const { caller, receiver, callId, callType } = callData;
      
      // Buscar dados completos do receptor
      const receiverData = await this.getUserData(receiver.id);
      if (!receiverData || !receiverData.phone) {
        console.warn(`Receptor ${receiver.id} não possui telefone cadastrado`);
        return { success: false, reason: 'no_phone' };
      }

      // Verificar se o receptor está online
      const isOnline = await this.checkUserOnlineStatus(receiver.id);
      if (isOnline) {
        console.log(`Usuário ${receiver.id} está online, notificação via WebSocket será suficiente`);
        return { success: true, reason: 'user_online' };
      }

      // Gerar mensagem de notificação
      const message = this.generateIncomingCallMessage(caller, callType);
      
      // Enviar via WhatsApp
      const result = await whatsappService.sendWhatsApp({
        to: receiverData.phone,
        message: message
      });

      // Registrar notificação enviada
      await this.logNotification({
        callId,
        userId: receiver.id,
        type: 'incoming_call',
        channel: 'whatsapp',
        success: result.success,
        messageId: result.messageId
      });

      console.log(`Notificação de chamada enviada para ${receiver.name}: ${result.success}`);
      return result;

    } catch (error) {
      console.error('Erro ao enviar notificação de chamada:', error);
      return { success: false, error: error.message };
    }
  }

  // Enviar notificação de chamada perdida
  async sendMissedCallNotification(callData) {
    try {
      const { caller, receiver, callId, callType, duration = 0 } = callData;
      
      // Buscar dados completos do receptor
      const receiverData = await this.getUserData(receiver.id);
      if (!receiverData || !receiverData.phone) {
        console.warn(`Receptor ${receiver.id} não possui telefone cadastrado`);
        return { success: false, reason: 'no_phone' };
      }

      // Gerar mensagem de chamada perdida
      const message = this.generateMissedCallMessage(caller, callType, duration);
      
      // Enviar via WhatsApp
      const result = await whatsappService.sendWhatsApp({
        to: receiverData.phone,
        message: message
      });

      // Registrar notificação enviada
      await this.logNotification({
        callId,
        userId: receiver.id,
        type: 'missed_call',
        channel: 'whatsapp',
        success: result.success,
        messageId: result.messageId
      });

      console.log(`Notificação de chamada perdida enviada para ${receiver.name}: ${result.success}`);
      return result;

    } catch (error) {
      console.error('Erro ao enviar notificação de chamada perdida:', error);
      return { success: false, error: error.message };
    }
  }

  // Enviar notificação de sistema WebRTC
  async sendSystemNotification(userData, notificationType, data = {}) {
    try {
      const userInfo = await this.getUserData(userData.id);
      if (!userInfo || !userInfo.phone) {
        return { success: false, reason: 'no_phone' };
      }

      let message;
      switch (notificationType) {
        case 'webrtc_activated':
          message = this.generateWebRTCActivatedMessage(userInfo.name);
          break;
        case 'call_quality_issue':
          message = this.generateCallQualityMessage(userInfo.name, data);
          break;
        case 'system_maintenance':
          message = this.generateMaintenanceMessage(data);
          break;
        default:
          throw new Error(`Tipo de notificação não suportado: ${notificationType}`);
      }

      const result = await whatsappService.sendWhatsApp({
        to: userInfo.phone,
        message: message
      });

      await this.logNotification({
        userId: userData.id,
        type: notificationType,
        channel: 'whatsapp',
        success: result.success,
        messageId: result.messageId,
        data: data
      });

      return result;

    } catch (error) {
      console.error('Erro ao enviar notificação do sistema:', error);
      return { success: false, error: error.message };
    }
  }

  // Enviar notificação com retry
  async sendNotificationWithRetry(notificationData, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Tentativa ${attempt}/${maxRetries} de envio de notificação`);
        
        const result = await this.sendNotificationByType(notificationData);
        
        if (result.success) {
          console.log(`Notificação enviada com sucesso na tentativa ${attempt}`);
          return result;
        }
        
        lastError = result.error || 'Falha no envio';
        
      } catch (error) {
        lastError = error.message;
        console.error(`Tentativa ${attempt} falhou:`, error.message);
      }
      
      // Aguardar antes da próxima tentativa (exceto na última)
      if (attempt < maxRetries) {
        await this.delay(this.retryDelay * attempt);
      }
    }
    
    console.error(`Falha ao enviar notificação após ${maxRetries} tentativas:`, lastError);
    return { success: false, error: lastError };
  }

  // Enviar notificação baseada no tipo
  async sendNotificationByType(notificationData) {
    const { type } = notificationData;
    
    switch (type) {
      case 'incoming_call':
        return await this.sendIncomingCallNotification(notificationData);
      case 'missed_call':
        return await this.sendMissedCallNotification(notificationData);
      case 'system':
        return await this.sendSystemNotification(
          notificationData.userData,
          notificationData.notificationType,
          notificationData.data
        );
      default:
        throw new Error(`Tipo de notificação não suportado: ${type}`);
    }
  }

  // Buscar dados do usuário
  async getUserData(userId) {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, phone, expo_push_token, is_online, is_available')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        return null;
      }

      return {
        ...user,
        name: user.full_name // Add name alias for compatibility
      };
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }

  // Verificar se usuário está online
  async checkUserOnlineStatus(userId) {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('is_online, last_seen')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return false;
      }

      // Considerar online se marcado como online e visto nos últimos 2 minutos
      if (user.is_online && user.last_seen) {
        const lastSeen = new Date(user.last_seen);
        const now = new Date();
        const diffMinutes = (now - lastSeen) / (1000 * 60);
        return diffMinutes <= 2;
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar status online:', error);
      return false;
    }
  }

  // Registrar notificação enviada
  async logNotification(notificationData) {
    try {
      await supabase
        .from('webrtc_notifications')
        .insert({
          call_id: notificationData.callId || null,
          user_id: notificationData.userId,
          notification_type: notificationData.type,
          channel: notificationData.channel,
          success: notificationData.success,
          message_id: notificationData.messageId || null,
          error_message: notificationData.error || null,
          data: notificationData.data || null,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao registrar notificação:', error);
    }
  }

  // Gerar mensagem de chamada recebida
  generateIncomingCallMessage(caller, callType) {
    const typeText = callType === 'video' ? 'vídeo' : 'áudio';
    return `📞 *Chamada de ${typeText} recebida!*\n\n` +
           `👤 *De:* ${caller.name}\n` +
           `🏢 *Tipo:* ${this.getUserTypeText(caller.user_type)}\n\n` +
           `Você está recebendo uma chamada de ${typeText}. ` +
           `Abra o aplicativo James Avisa para atender.\n\n` +
           `⏰ *${new Date().toLocaleString('pt-BR')}*`;
  }

  // Gerar mensagem de chamada perdida
  generateMissedCallMessage(caller, callType, duration) {
    const typeText = callType === 'video' ? 'vídeo' : 'áudio';
    const durationText = duration > 0 ? ` (durou ${this.formatDuration(duration)})` : '';
    
    return `📵 *Chamada perdida*\n\n` +
           `👤 *De:* ${caller.name}\n` +
           `🏢 *Tipo:* ${this.getUserTypeText(caller.user_type)}\n` +
           `📞 *Modalidade:* Chamada de ${typeText}${durationText}\n\n` +
           `Você perdeu uma chamada de ${typeText}. ` +
           `Abra o aplicativo James Avisa para ver mais detalhes ou retornar a chamada.\n\n` +
           `⏰ *${new Date().toLocaleString('pt-BR')}*`;
  }

  // Gerar mensagem de ativação WebRTC
  generateWebRTCActivatedMessage(userName) {
    return `🎉 *WebRTC Ativado!*\n\n` +
           `Olá, ${userName}!\n\n` +
           `O sistema de chamadas de voz e vídeo do James Avisa foi ativado para você. ` +
           `Agora você pode fazer e receber chamadas diretamente pelo aplicativo.\n\n` +
           `📱 *Recursos disponíveis:*\n` +
           `• Chamadas de voz\n` +
           `• Chamadas de vídeo\n` +
           `• Histórico de chamadas\n` +
           `• Notificações em tempo real\n\n` +
           `Abra o aplicativo para começar a usar! 🚀`;
  }

  // Gerar mensagem de problema de qualidade
  generateCallQualityMessage(userName, data) {
    return `⚠️ *Problema de Qualidade Detectado*\n\n` +
           `Olá, ${userName}!\n\n` +
           `Detectamos problemas de qualidade em suas chamadas recentes. ` +
           `Isso pode afetar a experiência de comunicação.\n\n` +
           `💡 *Dicas para melhorar:*\n` +
           `• Verifique sua conexão com a internet\n` +
           `• Aproxime-se do roteador Wi-Fi\n` +
           `• Feche outros aplicativos que usam internet\n` +
           `• Reinicie o aplicativo se necessário\n\n` +
           `Se o problema persistir, entre em contato conosco.`;
  }

  // Gerar mensagem de manutenção
  generateMaintenanceMessage(data) {
    const { startTime, endTime, description } = data;
    return `🔧 *Manutenção Programada*\n\n` +
           `O sistema de chamadas do James Avisa passará por manutenção.\n\n` +
           `📅 *Período:* ${startTime} até ${endTime}\n` +
           `📝 *Motivo:* ${description || 'Melhorias no sistema'}\n\n` +
           `Durante este período, as chamadas podem ficar indisponíveis. ` +
           `Pedimos desculpas pelo inconveniente.\n\n` +
           `Obrigado pela compreensão! 🙏`;
  }

  // Obter texto do tipo de usuário
  getUserTypeText(userType) {
    const types = {
      'morador': 'Morador',
      'porteiro': 'Porteiro',
      'sindico': 'Síndico',
      'admin': 'Administrador',
      'visitante': 'Visitante'
    };
    return types[userType] || 'Usuário';
  }

  // Formatar duração
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    return `${remainingSeconds}s`;
  }

  // Delay helper
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Obter estatísticas de notificações
  async getNotificationStats(userId = null, period = '24h') {
    try {
      let query = supabase
        .from('webrtc_notifications')
        .select('notification_type, channel, success, created_at');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Filtrar por período
      const now = new Date();
      let startDate;
      switch (period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      query = query.gte('created_at', startDate.toISOString());

      const { data: notifications, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      // Processar estatísticas
      const stats = {
        total: notifications.length,
        successful: notifications.filter(n => n.success).length,
        failed: notifications.filter(n => !n.success).length,
        byType: {},
        byChannel: {},
        successRate: 0
      };

      // Agrupar por tipo
      notifications.forEach(notification => {
        const type = notification.notification_type;
        if (!stats.byType[type]) {
          stats.byType[type] = { total: 0, successful: 0, failed: 0 };
        }
        stats.byType[type].total++;
        if (notification.success) {
          stats.byType[type].successful++;
        } else {
          stats.byType[type].failed++;
        }
      });

      // Agrupar por canal
      notifications.forEach(notification => {
        const channel = notification.channel;
        if (!stats.byChannel[channel]) {
          stats.byChannel[channel] = { total: 0, successful: 0, failed: 0 };
        }
        stats.byChannel[channel].total++;
        if (notification.success) {
          stats.byChannel[channel].successful++;
        } else {
          stats.byChannel[channel].failed++;
        }
      });

      // Calcular taxa de sucesso
      if (stats.total > 0) {
        stats.successRate = Math.round((stats.successful / stats.total) * 100);
      }

      return stats;
    } catch (error) {
      console.error('Erro ao obter estatísticas de notificações:', error);
      throw error;
    }
  }
}

module.exports = new WebRTCNotificationService();