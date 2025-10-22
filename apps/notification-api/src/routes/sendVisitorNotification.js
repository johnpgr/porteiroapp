const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsApp } = require('../services/whatsappService');
const { validateVisitorWhatsAppData } = require('../validators/visitorValidator');
// Environment variables accessed via process.env
const router = express.Router();

// Configuração do Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

/**
 * Endpoint para enviar mensagem WhatsApp para visitantes
 * POST /api/send-visitor-whatsapp
 */
router.post('/send-visitor-whatsapp', async (req, res) => {
  try {
    console.log('📱 Recebida solicitação de envio WhatsApp para visitante:', req.body);
    
    // Validar dados de entrada
    const validation = validateVisitorWhatsAppData(req.body);
    if (!validation.isValid) {
      console.error('❌ Dados inválidos:', validation.errors);
      return res.status(400).json({
        success: false,
        error: validation.errors.join(', ')
      });
    }

    const { name, phone, building, apartment, url } = req.body;
    
    // Funcionalidade de busca de senhas temporárias removida
    console.log('✅ Processando notificação para visitante:', {
      name: name,
      phone: phone,
      building: building,
      apartment: apartment
    });

    const messageTemplate = `Olá, ${name} 👋

Sua visita ao morador do ${building}, apartamento ${apartment} está confirmada.

Identifique-se na portaria para liberar o acesso.

✅ James Avisa — cuidando da sua segurança, com praticidade.
`;

    const message = messageTemplate;

    // Enviar mensagem via WhatsApp
    const whatsappResult = await sendWhatsApp({
      to: phone,
      message: message
    });

    if (!whatsappResult.success) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao enviar mensagem WhatsApp: ' + whatsappResult.error
      });
    }

    console.log('✅ Mensagem WhatsApp enviada com sucesso!');
    console.log('📊 ID da mensagem:', whatsappResult.messageId);

    // Retornar sucesso
    res.json({
      success: true,
      message: 'Mensagem WhatsApp enviada com sucesso para o visitante',
      data: {
        visitor_name: name,
        visitor_phone: phone,
        message_id: whatsappResult.messageId,
        sent_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro interno no endpoint send-visitor-whatsapp:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor: ' + error.message
    });
  }
});

module.exports = router;