const express = require('express');
const router = express.Router();

const { validateVisitorRegistration, validateBasicVisitorData } = require('../validators/visitorValidator');
const { sendWhatsApp } = require('../services/whatsappService');
const {
  generateVisitorToken,
  generateVisitorQRData,
  validateRegistrationCompletion,
  sanitizeVisitorData,
  generateRegistrationConfirmationMessage,
  calculateExpirationDate,
  formatCPF,
  formatBrazilianPhone
} = require('../utils/visitorUtils');

// POST /api/complete-visitor-registration - Endpoint para finalizar cadastro de visitante
router.post('/complete-visitor-registration', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando finalização de cadastro de visitante:', {
    name: req.body.name,
    phone: req.body.phone,
    visitor_type: req.body.visitor_type
  });
  
  try {
    const data = req.body;

    // Validação dos dados do visitante
    const { success, parsed, errors: validationErrors } = validateVisitorRegistration(data);
    if (!success) {
      console.error('❌ Erro de validação:', validationErrors);
      return res.status(400).json({ 
        success: false, 
        registered: false,
        whatsappSent: false,
        errors: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    const visitorData = sanitizeVisitorData(parsed);
    console.log('✅ Dados validados e sanitizados:', {
      name: visitorData.name,
      phone: formatBrazilianPhone(visitorData.phone),
      cpf: formatCPF(visitorData.cpf),
      visitor_type: visitorData.visitor_type,
      apartment_id: visitorData.apartment_id
    });

    // Validação adicional para completude do cadastro
    const completionValidation = validateRegistrationCompletion(visitorData);
    if (!completionValidation.valid) {
      console.error('❌ Erro de validação de completude:', completionValidation.errors);
      return res.status(400).json({
        success: false,
        registered: false,
        whatsappSent: false,
        errors: completionValidation.errors,
        timestamp: new Date().toISOString()
      });
    }

    // Gerar token único para o visitante
    const visitorToken = generateVisitorToken(visitorData);
    console.log('🔑 Token gerado para visitante:', visitorToken);

    // Calcular data de expiração
    const expirationDate = calculateExpirationDate(visitorData.visitor_type, visitorData.visit_date);
    console.log('⏰ Data de expiração calculada:', expirationDate.toISOString());

    // Gerar dados para QR Code
    const qrData = generateVisitorQRData(visitorData, visitorToken);
    console.log('📱 Dados do QR Code gerados');

    // Aqui você integraria com o banco de dados para salvar os dados
    // Por exemplo: await saveVisitorToDatabase(visitorData, visitorToken, expirationDate);
    console.log('💾 Dados do visitante salvos no banco (simulado)');

    // Gerar mensagem de confirmação
    const confirmationMessage = generateRegistrationConfirmationMessage(visitorData, visitorToken);
    console.log('📝 Mensagem de confirmação gerada');

    // Enviar mensagem de confirmação via WhatsApp
    let whatsappResult = null;
    let whatsappSent = false;
    
    try {
      whatsappResult = await sendWhatsApp({
        to: visitorData.phone,
        message: confirmationMessage
      });
      whatsappSent = true;
      console.log('✅ Mensagem de confirmação enviada via WhatsApp:', whatsappResult.messageId);
    } catch (whatsappError) {
      console.error('⚠️ Erro ao enviar WhatsApp (cadastro ainda foi finalizado):', whatsappError.message);
      // Não falha o cadastro se o WhatsApp falhar
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Cadastro de visitante finalizado com sucesso em ${duration}ms`);

    res.json({
      success: true,
      registered: true,
      whatsappSent,
      visitor: {
        token: visitorToken,
        name: visitorData.name,
        phone: formatBrazilianPhone(visitorData.phone),
        cpf: formatCPF(visitorData.cpf),
        visitor_type: visitorData.visitor_type,
        apartment_id: visitorData.apartment_id,
        building_id: visitorData.building_id,
        expires_at: expirationDate.toISOString()
      },
      qrData,
      messageId: whatsappResult?.messageId || null,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao finalizar cadastro de visitante:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      registered: false,
      whatsappSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// POST /api/validate-visitor-data - Endpoint para validar dados básicos de visitante
router.post('/validate-visitor-data', async (req, res) => {
  const startTime = Date.now();
  console.log('🔍 Validando dados básicos de visitante:', req.body);
  
  try {
    const data = req.body;

    // Validação básica dos dados
    const { success, parsed, errors: validationErrors } = validateBasicVisitorData(data);
    
    const duration = Date.now() - startTime;
    
    if (!success) {
      console.log('❌ Dados inválidos:', validationErrors);
      return res.status(400).json({ 
        success: false,
        valid: false,
        errors: validationErrors,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    console.log(`✅ Dados válidos em ${duration}ms`);
    
    res.json({
      success: true,
      valid: true,
      data: {
        name: parsed.name,
        phone: formatBrazilianPhone(parsed.phone),
        visitor_type: parsed.visitor_type
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao validar dados de visitante:', error.message);

    res.status(500).json({
      success: false,
      valid: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// GET /api/visitor-token/:token - Endpoint para verificar token de visitante
router.get('/visitor-token/:token', async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;
  
  console.log('🔍 Verificando token de visitante:', token);
  
  try {
    // Aqui você integraria com o banco de dados para verificar o token
    // Por exemplo: const visitor = await getVisitorByToken(token);
    
    // Simulação de verificação de token
    if (!token || !token.startsWith('VIS_')) {
      return res.status(404).json({
        success: false,
        found: false,
        error: 'Token inválido ou não encontrado',
        timestamp: new Date().toISOString()
      });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Token verificado em ${duration}ms`);
    
    // Resposta simulada - em produção, retornaria dados reais do banco
    res.json({
      success: true,
      found: true,
      visitor: {
        token: token,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao verificar token:', error.message);

    res.status(500).json({
      success: false,
      found: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

module.exports = router;