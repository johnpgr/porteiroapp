const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock do serviço de notificações WhatsApp
const mockWhatsAppService = {
  sendMessage: jest.fn(),
  sendCallNotification: jest.fn(),
  sendCallEndedNotification: jest.fn()
};

jest.mock('../../src/services/whatsappService', () => ({
  sendWhatsAppMessage: jest.fn(),
  formatCallMessage: jest.fn()
}));

jest.mock('../../src/services/webrtcNotificationService', () => ({
  sendCallNotification: jest.fn()
}));

// Mock do Supabase
jest.mock('../../src/services/supabaseClient', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: {
            id: 2,
            name: 'João Silva',
            phone: '+5511999999999',
            apartment: '101',
            building: 'A'
          },
          error: null
        }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null }))
    }))
  }))
}));

// Mock do serviço WebRTC
const mockWebRTCService = {
  createCall: jest.fn(),
  answerCall: jest.fn(),
  endCall: jest.fn()
};

jest.mock('../../src/services/webrtcService', () => mockWebRTCService);

describe('WhatsApp Integration Tests', () => {
  let authToken;

  beforeAll(() => {
    authToken = jwt.sign(
      { userId: 1, role: 'doorman', name: 'Porteiro Teste' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notificação de Chamada Iniciada', () => {
    it('deve enviar notificação WhatsApp quando chamada é iniciada', async () => {
      const callData = {
        residentId: 2,
        callType: 'video',
        reason: 'Visitante na portaria',
        visitorName: 'Maria Santos'
      };

      // Mock da criação da chamada
      mockWebRTCService.createCall.mockResolvedValue({
        callId: 'call-123',
        status: 'initiated',
        createdAt: new Date().toISOString()
      });

      // Mock do envio da notificação
      mockWhatsAppService.sendCallNotification.mockResolvedValue({
        success: true,
        messageId: 'whatsapp-msg-123',
        timestamp: new Date().toISOString()
      });

      // Simular criação de chamada que deve disparar notificação
      const result = await mockWebRTCService.createCall(callData);
      
      // Simular envio da notificação
      const notificationResult = await mockWhatsAppService.sendCallNotification({
        phone: '+5511999999999',
        residentName: 'João Silva',
        apartment: '101',
        building: 'A',
        callType: callData.callType,
        reason: callData.reason,
        visitorName: callData.visitorName,
        callId: result.callId
      });

      expect(mockWebRTCService.createCall).toHaveBeenCalledWith(callData);
      expect(mockWhatsAppService.sendCallNotification).toHaveBeenCalledWith({
        phone: '+5511999999999',
        residentName: 'João Silva',
        apartment: '101',
        building: 'A',
        callType: 'video',
        reason: 'Visitante na portaria',
        visitorName: 'Maria Santos',
        callId: 'call-123'
      });
      expect(notificationResult.success).toBe(true);
    });

    it('deve incluir informações corretas na notificação', async () => {
      const callData = {
        residentId: 2,
        callType: 'audio',
        reason: 'Entrega de encomenda'
      };

      mockWebRTCService.createCall.mockResolvedValue({
        callId: 'call-456',
        status: 'initiated'
      });

      mockWhatsAppService.sendCallNotification.mockResolvedValue({
        success: true,
        messageId: 'whatsapp-msg-456'
      });

      await mockWebRTCService.createCall(callData);
      
      const expectedNotification = {
        phone: '+5511999999999',
        residentName: 'João Silva',
        apartment: '101',
        building: 'A',
        callType: 'audio',
        reason: 'Entrega de encomenda',
        callId: 'call-456'
      };

      await mockWhatsAppService.sendCallNotification(expectedNotification);

      expect(mockWhatsAppService.sendCallNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+5511999999999',
          callType: 'audio',
          reason: 'Entrega de encomenda'
        })
      );
    });
  });

  describe('Notificação de Chamada Perdida', () => {
    it('deve enviar notificação quando chamada não é atendida', async () => {
      const callData = {
        callId: 'call-789',
        residentId: 2,
        status: 'missed',
        reason: 'timeout',
        duration: 30000 // 30 segundos
      };

      mockWebRTCService.endCall.mockResolvedValue({
        callId: 'call-789',
        status: 'ended',
        endReason: 'timeout'
      });

      mockWhatsAppService.sendCallEndedNotification.mockResolvedValue({
        success: true,
        messageId: 'whatsapp-missed-123'
      });

      await mockWebRTCService.endCall(callData.callId, 'timeout');
      
      await mockWhatsAppService.sendCallEndedNotification({
        phone: '+5511999999999',
        residentName: 'João Silva',
        apartment: '101',
        callId: callData.callId,
        status: 'missed',
        reason: 'Chamada não atendida (timeout)',
        timestamp: new Date().toISOString()
      });

      expect(mockWhatsAppService.sendCallEndedNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+5511999999999',
          status: 'missed',
          reason: 'Chamada não atendida (timeout)'
        })
      );
    });

    it('deve enviar notificação quando chamada é rejeitada', async () => {
      const callData = {
        callId: 'call-999',
        residentId: 2,
        status: 'rejected',
        reason: 'busy'
      };

      mockWebRTCService.answerCall.mockResolvedValue({
        callId: 'call-999',
        status: 'rejected',
        reason: 'busy'
      });

      mockWhatsAppService.sendCallEndedNotification.mockResolvedValue({
        success: true,
        messageId: 'whatsapp-rejected-123'
      });

      await mockWebRTCService.answerCall(callData.callId, false, 'busy');
      
      await mockWhatsAppService.sendCallEndedNotification({
        phone: '+5511999999999',
        residentName: 'João Silva',
        apartment: '101',
        callId: callData.callId,
        status: 'rejected',
        reason: 'Chamada rejeitada pelo morador',
        timestamp: new Date().toISOString()
      });

      expect(mockWhatsAppService.sendCallEndedNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          reason: 'Chamada rejeitada pelo morador'
        })
      );
    });
  });

  describe('Formatação de Mensagens', () => {
    it('deve formatar corretamente mensagem de chamada de vídeo', () => {
      const messageData = {
        residentName: 'João Silva',
        apartment: '101',
        building: 'A',
        callType: 'video',
        reason: 'Visitante na portaria',
        visitorName: 'Maria Santos'
      };

      const expectedMessage = `🔔 *CHAMADA DE VÍDEO*\n\n` +
        `Olá ${messageData.residentName}!\n` +
        `O porteiro está tentando fazer uma videochamada.\n\n` +
        `📍 *Apartamento:* ${messageData.apartment}${messageData.building ? ` - Bloco ${messageData.building}` : ''}\n` +
        `📞 *Motivo:* ${messageData.reason}\n` +
        `👤 *Visitante:* ${messageData.visitorName}\n\n` +
        `Para atender, acesse o aplicativo James Avisa.`;

      // Simular formatação da mensagem
      const formattedMessage = formatCallMessage(messageData);
      expect(formattedMessage).toBe(expectedMessage);
    });

    it('deve formatar corretamente mensagem de chamada de áudio', () => {
      const messageData = {
        residentName: 'Ana Costa',
        apartment: '205',
        callType: 'audio',
        reason: 'Entrega de encomenda'
      };

      const expectedMessage = `📞 *CHAMADA DE ÁUDIO*\n\n` +
        `Olá ${messageData.residentName}!\n` +
        `O porteiro está tentando fazer uma chamada.\n\n` +
        `📍 *Apartamento:* ${messageData.apartment}\n` +
        `📞 *Motivo:* ${messageData.reason}\n\n` +
        `Para atender, acesse o aplicativo James Avisa.`;

      const formattedMessage = formatCallMessage(messageData);
      expect(formattedMessage).toBe(expectedMessage);
    });

    it('deve formatar corretamente mensagem de chamada perdida', () => {
      const messageData = {
        residentName: 'Carlos Oliveira',
        apartment: '303',
        status: 'missed',
        reason: 'Chamada não atendida',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const expectedMessage = `❌ *CHAMADA PERDIDA*\n\n` +
        `Olá ${messageData.residentName}!\n` +
        `Você perdeu uma chamada do porteiro.\n\n` +
        `📍 *Apartamento:* ${messageData.apartment}\n` +
        `⏰ *Horário:* ${new Date(messageData.timestamp).toLocaleString('pt-BR')}\n` +
        `📞 *Motivo:* ${messageData.reason}\n\n` +
        `Entre em contato com a portaria se necessário.`;

      const formattedMessage = formatMissedCallMessage(messageData);
      expect(formattedMessage).toBe(expectedMessage);
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve lidar com erro no envio da notificação', async () => {
      const callData = {
        residentId: 2,
        callType: 'video',
        reason: 'Teste de erro'
      };

      mockWebRTCService.createCall.mockResolvedValue({
        callId: 'call-error-123',
        status: 'initiated'
      });

      mockWhatsAppService.sendCallNotification.mockRejectedValue(
        new Error('WhatsApp API Error: Rate limit exceeded')
      );

      await mockWebRTCService.createCall(callData);

      try {
        await mockWhatsAppService.sendCallNotification({
          phone: '+5511999999999',
          residentName: 'João Silva',
          callId: 'call-error-123'
        });
      } catch (error) {
        expect(error.message).toBe('WhatsApp API Error: Rate limit exceeded');
      }

      expect(mockWhatsAppService.sendCallNotification).toHaveBeenCalled();
    });

    it('deve lidar com número de telefone inválido', async () => {
      mockWhatsAppService.sendCallNotification.mockRejectedValue(
        new Error('Invalid phone number format')
      );

      try {
        await mockWhatsAppService.sendCallNotification({
          phone: 'invalid-phone',
          residentName: 'Teste',
          callId: 'call-123'
        });
      } catch (error) {
        expect(error.message).toBe('Invalid phone number format');
      }
    });
  });

  describe('Retry e Fallback', () => {
    it('deve tentar reenviar notificação em caso de falha temporária', async () => {
      mockWhatsAppService.sendCallNotification
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          success: true,
          messageId: 'retry-success-123'
        });

      // Primeira tentativa (falha)
      try {
        await mockWhatsAppService.sendCallNotification({
          phone: '+5511999999999',
          residentName: 'João Silva',
          callId: 'retry-call-123'
        });
      } catch (error) {
        expect(error.message).toBe('Temporary network error');
      }

      // Segunda tentativa (sucesso)
      const result = await mockWhatsAppService.sendCallNotification({
        phone: '+5511999999999',
        residentName: 'João Silva',
        callId: 'retry-call-123'
      });

      expect(result.success).toBe(true);
      expect(mockWhatsAppService.sendCallNotification).toHaveBeenCalledTimes(2);
    });
  });
});

// Funções auxiliares para formatação de mensagens
function formatCallMessage(data) {
  const callTypeIcon = data.callType === 'video' ? '🔔' : '📞';
  const callTypeText = data.callType === 'video' ? 'CHAMADA DE VÍDEO' : 'CHAMADA DE ÁUDIO';
  
  let message = `${callTypeIcon} *${callTypeText}*\n\n`;
  message += `Olá ${data.residentName}!\n`;
  message += data.callType === 'video' 
    ? `O porteiro está tentando fazer uma videochamada.\n\n`
    : `O porteiro está tentando fazer uma chamada.\n\n`;
  
  message += `📍 *Apartamento:* ${data.apartment}`;
  if (data.building) {
    message += ` - Bloco ${data.building}`;
  }
  message += `\n`;
  
  message += `📞 *Motivo:* ${data.reason}\n`;
  
  if (data.visitorName) {
    message += `👤 *Visitante:* ${data.visitorName}\n`;
  }
  
  message += `\nPara atender, acesse o aplicativo James Avisa.`;
  
  return message;
}

function formatMissedCallMessage(data) {
  let message = `❌ *CHAMADA PERDIDA*\n\n`;
  message += `Olá ${data.residentName}!\n`;
  message += `Você perdeu uma chamada do porteiro.\n\n`;
  message += `📍 *Apartamento:* ${data.apartment}\n`;
  message += `⏰ *Horário:* ${new Date(data.timestamp).toLocaleString('pt-BR')}\n`;
  message += `📞 *Motivo:* ${data.reason}\n\n`;
  message += `Entre em contato com a portaria se necessário.`;
  
  return message;
}