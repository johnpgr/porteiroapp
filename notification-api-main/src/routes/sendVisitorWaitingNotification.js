const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsApp } = require('../services/whatsappService');
const router = express.Router();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Endpoint para enviar notificação WhatsApp para morador quando visitante está aguardando
 * POST /api/send-visitor-waiting-notification
 */
router.post('/send-visitor-waiting-notification', async (req, res) => {
  try {
    console.log('📱 Recebida solicitação de notificação WhatsApp para morador:', req.body);
    
    // Validar dados de entrada
    const { visitor_name, resident_phone, resident_name, building, apartment, visitor_log_id } = req.body;
    
    if (!visitor_name || !resident_phone || !resident_name || !building || !apartment) {
      console.error('❌ Dados obrigatórios faltando');
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios: visitor_name, resident_phone, resident_name, building, apartment'
      });
    }

    // Validar formato do telefone (deve ter pelo menos 10 dígitos)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(resident_phone.replace(/\D/g, ''))) {
      console.error('❌ Formato de telefone inválido:', resident_phone);
      return res.status(400).json({
        success: false,
        error: 'Formato de telefone inválido'
      });
    }

    console.log('✅ Dados validados:', {
      visitor_name,
      resident_phone,
      resident_name,
      building,
      apartment,
      visitor_log_id
    });

    // Preparar URL de regularização
    const regularizationUrl = `https://jamesavisa.jamesconcierge.com/login`;

    // Preparar template de mensagem WhatsApp
    const messageTemplate = `📢 James Avisa
Prezado(a) ${resident_name}, informamos que há um visitante aguardando na portaria.

Visitante: ${visitor_name}
Prédio: ${building}
Apartamento: ${apartment}

👉 Acesse ${regularizationUrl} para verificar os detalhes e autorizar ou recusar a entrada.`;

    console.log('📤 Enviando mensagem WhatsApp...');
    console.log('📱 Para:', resident_phone);
    console.log('💬 Mensagem:', messageTemplate);

    // Enviar mensagem via WhatsApp
    const whatsappResult = await sendWhatsApp({
      to: resident_phone,
      message: messageTemplate
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

    // Opcional: Atualizar log do visitante com status de notificação enviada
    if (visitor_log_id) {
      try {
        const { error: updateError } = await supabase
          .from('visitor_logs')
          .update({ 
            whatsapp_notification_sent: true,
            whatsapp_notification_sent_at: new Date().toISOString(),
            whatsapp_message_id: whatsappResult.messageId
          })
          .eq('id', visitor_log_id);

        if (updateError) {
          console.warn('⚠️ Erro ao atualizar log do visitante:', updateError);
        } else {
          console.log('✅ Log do visitante atualizado com sucesso');
        }
      } catch (updateErr) {
        console.warn('⚠️ Erro ao atualizar log do visitante:', updateErr);
      }
    }

    // Retornar sucesso
    res.json({
      success: true,
      message: 'Notificação WhatsApp enviada com sucesso para o morador',
      data: {
        visitor_name,
        resident_name,
        resident_phone,
        building,
        apartment,
        message_id: whatsappResult.messageId,
        sent_at: new Date().toISOString(),
        regularization_url: regularizationUrl
      }
    });

  } catch (error) {
    console.error('❌ Erro interno no endpoint send-visitor-waiting-notification:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor: ' + error.message
    });
  }
});

module.exports = router;