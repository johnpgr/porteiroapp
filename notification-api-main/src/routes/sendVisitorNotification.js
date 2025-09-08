const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsApp } = require('../services/whatsappService');
const { validateVisitorWhatsAppData } = require('../validators/visitorValidator');
const router = express.Router();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    // Buscar visitante na tabela visitor_temporary_passwords
    console.log('🔍 Buscando visitante na tabela visitor_temporary_passwords...');
    const { data: visitorData, error: visitorError } = await supabase
      .from('visitor_temporary_passwords')
      .select('*, plain_password')
      .eq('visitor_name', name)
      .eq('visitor_phone', phone)
      .eq('status', 'active')
      .single();

    if (visitorError) {
      console.error('❌ Erro ao buscar visitante:', visitorError);
      return res.status(404).json({
        success: false,
        error: 'Visitante não encontrado ou senha temporária inválida'
      });
    }

    if (!visitorData) {
      console.log('❌ Visitante não encontrado');
      return res.status(404).json({
        success: false,
        error: 'Visitante não encontrado'
      });
    }

    console.log('✅ Visitante encontrado:', {
      id: visitorData.id,
      name: visitorData.visitor_name,
      phone: visitorData.visitor_phone,
      has_password: !!visitorData.plain_password,
      created_at: visitorData.created_at
    });

    // Preparar template de mensagem WhatsApp
    const registrationLink = `porteiroapp://login`;
    const messageTemplate = `Olá, ${name} ! 👋  
 
Seu acesso de visitante foi autorizado, mas é necessário completar seu cadastro para liberar a entrada.  
 
**Prédio:** ${building}   
**Apartamento:** ${apartment}   
 
**Credenciais temporárias:**  
📱 Celular: ${phone}   
🔑 Senha: ${visitorData.plain_password}  (válida por 24h)  
 
👉 [Clique aqui]( ${registrationLink} ) para finalizar seu cadastro e ativar o acesso.  
 
Qualquer dúvida, entre em contato conosco! 📞  
 
---  
**Acesso liberado via sistema PorteiroApp**`;

    const message = messageTemplate;

    console.log('📤 Enviando mensagem WhatsApp...');
    console.log('📱 Para:', phone);
    console.log('💬 Mensagem:', message);

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
        visitor_name: visitorData.visitor_name,
        visitor_phone: visitorData.visitor_phone,
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