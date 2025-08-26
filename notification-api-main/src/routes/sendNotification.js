const express = require('express');
const router = express.Router();

const { validateResidentNotification } = require('../validators/notificationValidator');
const { sendWhatsApp } = require('../services/whatsappService');
const { generateRegistrationLink, generateWhatsAppMessage } = require('../utils/messageFormatter');

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

    // Gerar link de cadastro personalizado
    const registrationLink = generateRegistrationLink(residentData, residentData.registrationUrl);
    console.log('🔗 Link de cadastro gerado:', registrationLink);

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

module.exports = router;