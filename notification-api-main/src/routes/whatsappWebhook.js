const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsApp, sendWhatsAppWithButtons } = require('../services/whatsappService');

const router = express.Router();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Webhook para receber mensagens do WhatsApp
router.post('/', async (req, res) => {
    try {
        console.log('Webhook recebido:', JSON.stringify(req.body, null, 2));
        
        const { data } = req.body;
        
        if (data && data.messages && data.messages.length > 0) {
            const message = data.messages[0];
            const from = message.key.remoteJid;
            
            // Processar mensagens de texto (compatibilidade com sistema antigo)
            const messageText = message.message?.conversation || 
                              message.message?.extendedTextMessage?.text || '';
            
            // Processar respostas de botões interativos
            const buttonResponse = message.message?.buttonsResponseMessage?.selectedButtonId;
            const listResponse = message.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
            
            console.log(`Mensagem recebida de ${from}:`, {
                text: messageText,
                buttonResponse,
                listResponse
            });
            
            // Processar resposta do visitante (texto ou botão)
            if (messageText === '1' || messageText === '2') {
                await processVisitorResponse(from, messageText);
            } else if (buttonResponse) {
                await handleButtonResponse(buttonResponse, from, messageId);
            } else if (listResponse) {
                await processListResponse(from, listResponse, messageId);
            }
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro no webhook:', error);
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

// Função para processar resposta de botão
async function handleButtonResponse(buttonId, from, messageId) {
  console.log('🔘 Processando resposta de botão:', { buttonId, from, messageId });
  
  try {
    // Extrair informações do buttonId
    const parts = buttonId.split('_');
    if (parts.length < 3) {
      console.error('❌ Formato de buttonId inválido:', buttonId);
      return;
    }
    
    const action = parts[0]; // approve, reject, elevator, portaria
    const tokenId = parts.slice(1).join('_'); // Resto é o token ID
    
    console.log('📋 Ação extraída:', { action, tokenId });
    
    // Buscar o token de autorização
    const { data: tokenData, error: tokenError } = await supabase
      .from('visitor_authorization_tokens')
      .select('*')
      .eq('id', tokenId)
      .eq('used', false)
      .single();
      
    if (tokenError || !tokenData) {
      console.error('❌ Token não encontrado ou já usado:', tokenError);
      // Enviar mensagem de erro
       await sendWhatsApp({
         to: from,
         message: '❌ Esta autorização não é mais válida ou já foi utilizada.'
       });
      return;
    }
    
    // Verificar se o token expirou
    if (new Date(tokenData.expires_at) < new Date()) {
      console.error('❌ Token expirado:', tokenData.expires_at);
      await sendWhatsApp({
         to: from,
         message: '⏰ Esta autorização expirou. Solicite uma nova notificação se necessário.'
       });
      return;
    }
    
    // Verificar se o número que respondeu é o mesmo do token
    const cleanFrom = from.replace(/\D/g, '');
    const cleanTokenPhone = tokenData.resident_phone.replace(/\D/g, '');
    
    if (!cleanFrom.endsWith(cleanTokenPhone.slice(-10))) {
      console.error('❌ Número não autorizado para este token:', { from, tokenPhone: tokenData.resident_phone });
      await sendWhatsApp({
         to: from,
         message: '🚫 Você não tem autorização para responder a esta notificação.'
       });
      return;
    }
    
    // Processar a ação
    let updateData = {
      used: true,
      updated_at: new Date().toISOString()
    };
    
    let visitorLogUpdate = {
      resident_response_at: new Date().toISOString()
    };
    
    switch (action) {
      case 'approve':
        visitorLogUpdate.notification_status = 'approved';
        break;
      case 'reject':
        visitorLogUpdate.notification_status = 'rejected';
        break;
      case 'elevator':
        visitorLogUpdate.delivery_destination = 'elevador';
        visitorLogUpdate.notification_status = 'approved';
        break;
      case 'portaria':
        visitorLogUpdate.delivery_destination = 'portaria';
        visitorLogUpdate.notification_status = 'approved';
        break;
      default:
        console.error('❌ Ação não reconhecida:', action);
        await sendWhatsApp({
           to: from,
           message: '❌ Ação não reconhecida. Tente novamente.'
         });
        return;
    }
    
    // Atualizar o token como usado
    const { error: updateTokenError } = await supabase
      .from('visitor_authorization_tokens')
      .update(updateData)
      .eq('id', tokenId);
      
    if (updateTokenError) {
      console.error('❌ Erro ao atualizar token:', updateTokenError);
      await sendWhatsApp({
         to: from,
         message: '❌ Erro interno. Tente novamente ou contate o suporte.'
       });
      return;
    }
    
    // Atualizar o visitor_log
    const { error: updateLogError } = await supabase
      .from('visitor_logs')
      .update(visitorLogUpdate)
      .eq('id', tokenData.visitor_log_id);
      
    if (updateLogError) {
      console.error('❌ Erro ao atualizar visitor_log:', updateLogError);
      await sendWhatsApp({
         to: from,
         message: '❌ Erro ao processar resposta. Contate o suporte.'
       });
      return;
    }
    
    console.log('✅ Resposta processada com sucesso:', {
      action,
      tokenId,
      visitorLogId: tokenData.visitor_log_id,
      updates: visitorLogUpdate
    });
    
    // Enviar confirmação para o usuário
    let confirmationMessage = '';
    switch (action) {
      case 'approve':
        confirmationMessage = `✅ Visita de ${tokenData.visitor_name} foi APROVADA.\n\nO porteiro foi notificado e o visitante pode subir.`;
        break;
      case 'reject':
        confirmationMessage = `❌ Visita de ${tokenData.visitor_name} foi RECUSADA.\n\nO porteiro foi notificado.`;
        break;
      case 'elevator':
        confirmationMessage = `📦 Encomenda será enviada pelo ELEVADOR.\n\nO porteiro foi instruído a enviar a encomenda.`;
        break;
      case 'portaria':
        confirmationMessage = `📦 Encomenda ficará na PORTARIA.\n\nVocê pode retirar quando desejar.`;
        break;
    }
    
    // Enviar mensagem de confirmação
     await sendWhatsApp({
       to: from,
       message: confirmationMessage
     });
    
  } catch (error) {
    console.error('❌ Erro ao processar resposta de botão:', error);
    // Enviar mensagem de erro genérica
     await sendWhatsApp({
       to: from,
       message: '❌ Ocorreu um erro ao processar sua resposta. Tente novamente ou contate o suporte.'
     });
  }
}

// Processar respostas de listas interativas
async function processListResponse(phoneNumber, selectedRowId, messageId) {
    try {
        console.log(`Processando resposta de lista de ${phoneNumber}: ${selectedRowId}`);
        
        // Redirecionar para processamento de botão (mesmo formato)
        await handleButtonResponse(selectedRowId, phoneNumber, messageId);
        
    } catch (error) {
        console.error('Erro ao processar resposta de lista:', error);
    }
}

module.exports = router;