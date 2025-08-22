const express = require('express');
const router = express.Router();

const { validateNotification } = require('../validators/notificationValidator');
const { sendEmail } = require('../services/emailService');
const { sendWhatsApp, checkInstanceStatus, generateQRCode } = require('../services/whatsappService');
const renderTemplate = require('../utils/renderTemplate');

// POST /api/send-notification
router.post('/send-notification', async (req, res) => {
  const data = req.body;

  // Validação
  const { success, parsed, errors: validationErrors } = validateNotification(data);
  if (!success) {
    return res.status(400).json({ success: false, emailSent: false, whatsappSent: false, errors: validationErrors });
  }

  const notification = parsed; // objeto validado
  const results = {
    emailSent: false,
    whatsappSent: false,
    errors: []
  };

  // Envia e-mail
  if (notification.channels.email) {
    try {
      // Dados extras para o template
      const templateData = {
        subject: notification.subject,
        clientName: notification.recipient.name,
        status: notification.status || 'em_andamento',
        professionalName: notification.professionalName || 'Equipe Digital Paisagismo',
        estimatedTime: notification.estimatedTime || '15 dias'
      };
      
      const html = renderTemplate(notification.message, notification.type, templateData);
      await sendEmail({
        to: notification.recipient.email,
        name: notification.recipient.name,
        subject: notification.subject || 'Notificação',
        html
      });
      results.emailSent = true;
      console.log('✅ E-mail enviado para:', notification.recipient.email);
    } catch (err) {
      console.error('❌ Email error:', err.message);
      results.errors.push(`E-mail: ${err.message}`);
    }
  }

  // Envia WhatsApp
  if (notification.channels.whatsapp) {
    try {
      await sendWhatsApp({
        to: notification.recipient.phone,
        message: notification.message
      });
      results.whatsappSent = true;
      console.log('✅ WhatsApp enviado para:', notification.recipient.phone);
    } catch (err) {
      console.error('❌ WhatsApp error:', err.message);
      results.errors.push(`WhatsApp: ${err.message}`);
    }
  }

  const successFlag = results.emailSent || results.whatsappSent;

  res.json({ success: successFlag, ...results });
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