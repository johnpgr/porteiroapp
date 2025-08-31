const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabaseClient');
const { sendWhatsApp } = require('../services/whatsappService');

// Webhook para receber mensagens do WhatsApp
router.post('/whatsapp-webhook', async (req, res) => {
  try {
    console.log('📨 Webhook recebido:', JSON.stringify(req.body, null, 2));
    
    const { data } = req.body;
    
    // Verificar se é uma mensagem de texto
    if (data && data.message && data.message.messageType === 'textMessage') {
      const { remoteJid, message } = data;
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
      const messageText = message.conversation || message.extendedTextMessage?.text || '';
      
      console.log(`📱 Mensagem recebida de ${phoneNumber}: ${messageText}`);
      
      // Processar apenas respostas "1" ou "2"
      if (messageText.trim() === '1' || messageText.trim() === '2') {
        await processVisitorResponse(phoneNumber, messageText.trim());
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Função para processar resposta do visitante
async function processVisitorResponse(phoneNumber, response) {
  try {
    // Buscar token ativo para este número de telefone
    const { data: tokens, error: tokenError } = await supabase
      .from('visitor_authorization_tokens')
      .select('*')
      .eq('resident_phone', phoneNumber)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (tokenError) {
      console.error('❌ Erro ao buscar token:', tokenError);
      return;
    }
    
    if (!tokens || tokens.length === 0) {
      console.log('⚠️ Nenhum token ativo encontrado para', phoneNumber);
      return;
    }
    
    const token = tokens[0];
    const action = response === '1' ? 'accept' : 'reject';
    const actionText = response === '1' ? 'AUTORIZADO' : 'RECUSADO';
    
    console.log(`🔄 Processando ${actionText} para visitante:`, token.visitor_name);
    
    // Marcar token como usado
    const { error: updateError } = await supabase
      .from('visitor_authorization_tokens')
      .update({ 
        used: true, 
        action: action,
        processed_at: new Date().toISOString()
      })
      .eq('id', token.id);
    
    if (updateError) {
      console.error('❌ Erro ao atualizar token:', updateError);
      return;
    }
    
    // Enviar confirmação ao morador
    const confirmationMessage = `✅ *Resposta registrada com sucesso!*\n\n` +
      `👤 *Visitante:* ${token.visitor_name}\n` +
      `🏠 *Apartamento:* ${token.apartment_number}\n` +
      `📋 *Decisão:* ${actionText}\n\n` +
      `${response === '1' ? '🟢 O visitante foi autorizado a entrar.' : '🔴 O acesso do visitante foi negado.'}`;
    
    await sendWhatsApp(phoneNumber, confirmationMessage);
    
    console.log(`✅ Confirmação enviada para ${phoneNumber}`);
    
  } catch (error) {
    console.error('❌ Erro ao processar resposta:', error);
  }
}

module.exports = router;