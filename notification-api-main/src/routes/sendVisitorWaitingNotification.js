const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { 
  sendWhatsApp, 
  sendWhatsAppWithButtons,
  generateVisitorAuthorizationMessageWithButtons 
} = require('../services/whatsappService');
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
    const { 
      visitor_name, 
      resident_phone, 
      resident_name, 
      building, 
      apartment, 
      visitor_log_id,
      use_interactive_buttons = false, // Por padrão não usar botões interativos
      visit_type = 'visitor' // Tipo de visita: visitor, delivery, service
    } = req.body;
    
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

    // Definir URL de regularização
    const regularizationUrl = `https://jamesavisa.jamesconcierge.com/login`;
    let whatsappResult;
    
    if (use_interactive_buttons) {
      // Gerar token único para esta notificação
      const tokenId = `${visitor_log_id}_${Date.now()}`;
      
      // Criar registro do token de autorização
      const { data: tokenData, error: tokenError } = await supabase
        .from('visitor_authorization_tokens')
        .insert({
          visitor_log_id: visitor_log_id,
          visitor_name: visitor_name,
          resident_phone: resident_phone,
          resident_name: resident_name,
          apartment_number: apartment,
          building: building,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
          used: false
        })
        .select()
        .single();
        
      if (tokenError) {
        console.warn('⚠️ Erro ao criar token de autorização:', tokenError);
        // Fallback para mensagem tradicional
        const messageTemplate = `📢 James Avisa\nPrezado(a) ${resident_name}, informamos que há um visitante aguardando na portaria.\n\nVisitante: ${visitor_name}\nPrédio: ${building}\nApartamento: ${apartment}\n\n👉 Acesse https://jamesavisa.jamesconcierge.com/login para verificar os detalhes e autorizar ou recusar a entrada.`;
        
        whatsappResult = await sendWhatsApp({
          to: resident_phone,
          message: messageTemplate
        });
      } else {
        // Gerar mensagem com botões interativos
        const { message, buttons } = generateVisitorAuthorizationMessageWithButtons(
          visitor_name,
          apartment,
          visit_type
        );
        
        console.log('📤 Enviando mensagem com botões interativos...');
        console.log('📱 Para:', resident_phone);
        console.log('💬 Mensagem:', message);
        console.log('🔘 Botões:', buttons);
        
        // Enviar mensagem com botões
        whatsappResult = await sendWhatsAppWithButtons(
          resident_phone,
          message,
          buttons,
          tokenData.id
        );
      }
    } else {
      // Usar mensagem tradicional sem botões
      const messageTemplate = `📢 James Avisa\nPrezado(a) ${resident_name}, informamos que há um visitante aguardando na portaria.\n\nVisitante: ${visitor_name}\nPrédio: ${building}\nApartamento: ${apartment}\n\n👉 Acesse https://jamesavisa.jamesconcierge.com/login para verificar os detalhes e autorizar ou recusar a entrada.`;
      
      console.log('📤 Enviando mensagem WhatsApp tradicional...');
      console.log('📱 Para:', resident_phone);
      console.log('💬 Mensagem:', messageTemplate);
      
      whatsappResult = await sendWhatsApp({
        to: resident_phone,
        message: messageTemplate
      });
    }

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
        regularization_url: 'https://jamesavisa.jamesconcierge.com/login'
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