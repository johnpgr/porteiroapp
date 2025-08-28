const express = require('express');
const router = express.Router();

const { validateResidentNotification, validateRegularizationNotification, validateVisitorAuthorization } = require('../validators/notificationValidator');
const { sendWhatsApp } = require('../services/whatsappService');
const { generateRegistrationLink, generateWhatsAppMessage, generateRegularizationLink, generateRegularizationMessage, generateVisitorAuthorizationLink, generateVisitorAuthorizationMessage } = require('../utils/messageFormatter');

// POST /api/send-resident-whatsapp - Endpoint específico para envio de mensagens WhatsApp para moradores
router.post('/send-resident-whatsapp', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando envio de mensagem WhatsApp para morador:', req.body);
  
  try {
    const data = req.body;

    // Validação dos dados do morador
    const { success, parsed, errors: validationErrors } = validateResidentNotification(data);
    if (!success) {
      console.error('❌ Erro de validação:', validationErrors);
      return res.status(400).json({ 
        success: false, 
        whatsappSent: false, 
        errors: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    const residentData = parsed;
    console.log('✅ Dados validados:', {
      name: residentData.name,
      phone: residentData.phone,
      building: residentData.building,
      apartment: residentData.apartment
    });

    // Usar link de cadastro fornecido ou gerar um novo (compatibilidade)
    let registrationLink;
    if (residentData.registrationLink) {
      // Se o link já vem pronto (com token), usar diretamente
      registrationLink = residentData.registrationLink;
      console.log('🔗 Link de cadastro recebido (com token):', registrationLink);
    } else {
      // Compatibilidade: gerar link com parâmetros de query string
      registrationLink = generateRegistrationLink(residentData, residentData.registrationUrl);
      console.log('🔗 Link de cadastro gerado (formato antigo):', registrationLink);
    }

    // Gerar mensagem formatada
    const whatsappMessage = generateWhatsAppMessage(residentData, registrationLink);
    console.log('📝 Mensagem formatada:', whatsappMessage.substring(0, 100) + '...');

    // Enviar mensagem via WhatsApp
    const whatsappResult = await sendWhatsApp({
      to: residentData.phone,
      message: whatsappMessage
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Mensagem WhatsApp enviada com sucesso em ${duration}ms para:`, residentData.phone);

    res.json({
      success: true,
      whatsappSent: true,
      messageId: whatsappResult.messageId,
      registrationLink,
      recipient: {
        name: residentData.name,
        phone: residentData.phone,
        building: residentData.building,
        apartment: residentData.apartment
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      whatsappSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// GET /api/whatsapp-status - Verificar status da instância WhatsApp
router.get('/whatsapp-status', async (req, res) => {
  try {
    const status = await checkInstanceStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: 'Erro ao verificar status da instância'
    });
  }
});

// GET /api/whatsapp-qr - Gerar QR Code para conectar WhatsApp
router.get('/whatsapp-qr', async (req, res) => {
  try {
    const qrData = await generateQRCode();
    res.json(qrData);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// POST /api/send-regularization-whatsapp - Endpoint para envio de mensagens de regularização para moradores
router.post('/send-regularization-whatsapp', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando envio de mensagem de regularização WhatsApp para morador:', req.body);
  
  try {
    // Validar dados usando o validator
    const validation = validateRegularizationNotification(req.body);
    if (!validation.success) {
      console.error('❌ Dados inválidos:', validation.errors);
      return res.status(400).json({ 
        success: false, 
        whatsappSent: false, 
        error: 'Dados inválidos',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const regularizationData = validation.parsed;
    regularizationData.phone = regularizationData.phone.replace(/\D/g, ''); // Remove caracteres não numéricos

    console.log('✅ Dados de regularização validados:', {
      name: regularizationData.name,
      phone: regularizationData.phone,
      building: regularizationData.building,
      apartment: regularizationData.apartment,
      issueType: regularizationData.issueType
    });

    // Gerar link de regularização personalizado
    const regularizationLink = generateRegularizationLink(regularizationData, regularizationData.regularizationUrl);
    console.log('🔗 Link de regularização gerado:', regularizationLink);

    // Gerar mensagem formatada
    const whatsappMessage = generateRegularizationMessage(regularizationData, regularizationLink);
    console.log('📝 Mensagem de regularização formatada:', whatsappMessage.substring(0, 100) + '...');

    // Enviar mensagem via WhatsApp
    const whatsappResult = await sendWhatsApp({
      to: regularizationData.phone,
      message: whatsappMessage
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Mensagem de regularização WhatsApp enviada com sucesso em ${duration}ms para:`, regularizationData.phone);

    res.json({
      success: true,
      whatsappSent: true,
      messageId: whatsappResult.messageId,
      regularizationLink,
      recipient: {
        name: regularizationData.name,
        phone: regularizationData.phone,
        building: regularizationData.building,
        apartment: regularizationData.apartment,
        issueType: regularizationData.issueType
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao enviar mensagem de regularização WhatsApp:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      whatsappSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// POST /api/send-visitor-authorization-whatsapp - Endpoint para envio de mensagens de autorização de visitante
router.post('/send-visitor-authorization-whatsapp', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando envio de mensagem de autorização de visitante WhatsApp:', req.body);
  
  try {
    // Validar dados usando o validator
    const validation = validateVisitorAuthorization(req.body);
    if (!validation.success) {
      console.error('❌ Dados inválidos:', validation.errors);
      return res.status(400).json({ 
        success: false, 
        whatsappSent: false, 
        error: 'Dados inválidos',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const authorizationData = validation.parsed;
    authorizationData.residentPhone = authorizationData.residentPhone.replace(/\D/g, ''); // Remove caracteres não numéricos

    console.log('✅ Dados de autorização de visitante validados:', {
      visitorName: authorizationData.visitorName,
      residentName: authorizationData.residentName,
      residentPhone: authorizationData.residentPhone,
      building: authorizationData.building,
      apartment: authorizationData.apartment
    });

    // Gerar link de autorização personalizado
    const authorizationLink = generateVisitorAuthorizationLink(authorizationData);
    console.log('🔗 Link de autorização gerado:', authorizationLink);

    // Gerar mensagem formatada
    const whatsappMessage = generateVisitorAuthorizationMessage(authorizationData, authorizationLink);
    console.log('📝 Mensagem de autorização formatada:', whatsappMessage);

    // Enviar mensagem via WhatsApp
    const whatsappResult = await sendWhatsApp({
      to: authorizationData.residentPhone,
      message: whatsappMessage
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Mensagem de autorização WhatsApp enviada com sucesso em ${duration}ms para:`, authorizationData.residentPhone);

    res.json({
      success: true,
      whatsappSent: true,
      messageId: whatsappResult.messageId,
      authorizationLink,
      recipient: {
        visitorName: authorizationData.visitorName,
        residentName: authorizationData.residentName,
        residentPhone: authorizationData.residentPhone,
        building: authorizationData.building,
        apartment: authorizationData.apartment
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao enviar mensagem de autorização WhatsApp:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      whatsappSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

module.exports = router;