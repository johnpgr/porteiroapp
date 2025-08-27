const express = require('express');
const router = express.Router();

const { sendVisitorAuthorization } = require('../services/whatsappService');
const { validateVisitorNotification } = require('../validators/notificationValidator');
const { 
  generateAuthorizationToken, 
  validateAuthorizationToken, 
  generateAuthorizationLink 
} = require('../utils/tokenUtils');

// POST /api/send-visitor-notification - Enviar notificação de visitante com token
router.post('/send-visitor-notification', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando envio de notificação de visitante:', req.body);
  
  try {
    const data = req.body;

    // Validação dos dados
    const { success, parsed, errors: validationErrors } = validateVisitorNotification(data);
    if (!success) {
      console.error('❌ Erro de validação:', validationErrors);
      return res.status(400).json({ 
        success: false, 
        errors: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    const visitorData = parsed;
    console.log('✅ Dados validados:', {
      visitorName: visitorData.visitorName,
      residentPhone: visitorData.residentPhone,
      residentName: visitorData.residentName,
      building: visitorData.building,
      apartment: visitorData.apartment
    });

    // Gerar token JWT com validade de 30 minutos
    const tokenData = generateAuthorizationToken({
      visitorLogId: visitorData.visitorLogId,
      visitorName: visitorData.visitorName,
      residentPhone: visitorData.residentPhone,
      residentName: visitorData.residentName,
      building: visitorData.building,
      apartment: visitorData.apartment
    });

    // Gerar link de autorização
    const authorizationLink = generateAuthorizationLink(tokenData.token);
    console.log('🔗 Link de autorização gerado:', authorizationLink);

    // Gerar mensagem WhatsApp personalizada
    const whatsappMessage = `🏢 *JamesAvisa - Autorização de Visitante*\n\n` +
      `Olá *${visitorData.residentName}*!\n\n` +
      `O visitante *${visitorData.visitorName}* está aguardando autorização para acessar o prédio.\n\n` +
      `📍 *Destino:* ${visitorData.building} - Apt ${visitorData.apartment}\n` +
      `⏰ *Solicitado em:* ${new Date().toLocaleString('pt-BR')}\n\n` +
      `Para autorizar ou recusar o acesso, clique no link abaixo:\n` +
      `${authorizationLink}\n\n` +
      `⚠️ *Este link expira em 30 minutos*\n\n` +
      `_Mensagem automática do JamesAvisa_`;

    console.log('📝 Mensagem formatada:', whatsappMessage.substring(0, 100) + '...');

    // Enviar mensagem WhatsApp com link de autorização
    const whatsappResult = await sendVisitorAuthorization(
      visitorData.residentPhone,
      visitorData.visitorName,
      visitorData.residentName,
      visitorData.building,
      visitorData.apartment,
      authorizationLink
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Notificação enviada com sucesso em ${duration}ms para:`, visitorData.residentPhone);

    res.json({
      success: true,
      token: tokenData.token,
      authorizationLink,
      messageId: whatsappResult.messageId,
      expiresAt: tokenData.expiresAt,
      recipient: {
        name: visitorData.residentName,
        phone: visitorData.residentPhone,
        building: visitorData.building,
        apartment: visitorData.apartment
      },
      visitor: {
        name: visitorData.visitorName,
        logId: visitorData.visitorLogId
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao enviar notificação de visitante:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// GET /api/validate-token/:token - Validar token de autorização
router.get('/validate-token/:token', async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;
  
  console.log('🔍 Validando token de autorização');
  
  try {
    // Verificar e decodificar o token
    const decoded = validateAuthorizationToken(token);
    console.log('✅ Token válido:', {
      visitorName: decoded.visitorName,
      residentName: decoded.residentName,
      building: decoded.building,
      apartment: decoded.apartment
    });

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      valid: true,
      data: {
        visitorLogId: decoded.visitorLogId,
        visitorName: decoded.visitorName,
        residentPhone: decoded.residentPhone,
        residentName: decoded.residentName,
        building: decoded.building,
        apartment: decoded.apartment,
        createdAt: decoded.createdAt,
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Token inválido ou expirado:', error.message);

    let errorMessage = 'Token inválido';
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expirado';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Token malformado';
    }

    res.status(401).json({
      success: false,
      valid: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// POST /api/process-authorization - Processar resposta de autorização
router.post('/process-authorization', async (req, res) => {
  const startTime = Date.now();
  console.log('🔄 Processando resposta de autorização:', req.body);
  
  try {
    const { token, action, notes } = req.body;

    // Validar parâmetros obrigatórios
    if (!token || !action) {
      return res.status(400).json({
        success: false,
        error: 'Token e ação são obrigatórios',
        timestamp: new Date().toISOString()
      });
    }

    // Validar ação
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Ação deve ser "accept" ou "reject"',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar e decodificar o token
    const decoded = validateAuthorizationToken(token);
    console.log('✅ Token válido para processamento:', {
      visitorName: decoded.visitorName,
      residentName: decoded.residentName,
      action: action
    });

    // Aqui seria feita a atualização no banco de dados
    // Por enquanto, apenas simulamos o processamento
    const authorizationResult = {
      visitorLogId: decoded.visitorLogId,
      action: action,
      authorizedBy: decoded.residentName,
      authorizedAt: new Date().toISOString(),
      notes: notes || null
    };

    console.log(`✅ Autorização ${action === 'accept' ? 'ACEITA' : 'RECUSADA'} para visitante:`, decoded.visitorName);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      processed: true,
      result: authorizationResult,
      visitor: {
        name: decoded.visitorName,
        logId: decoded.visitorLogId
      },
      resident: {
        name: decoded.residentName,
        phone: decoded.residentPhone,
        building: decoded.building,
        apartment: decoded.apartment
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao processar autorização:', error.message);

    let errorMessage = 'Erro interno do servidor';
    let statusCode = 500;

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expirado';
      statusCode = 401;
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Token inválido';
      statusCode = 401;
    }

    res.status(statusCode).json({
      success: false,
      processed: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

module.exports = router;