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
                await handleButtonResponse(buttonResponse, from, message.key.id);
            } else if (listResponse) {
                await processListResponse(from, listResponse, message.key.id);
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
    
    // Enviar confirmação detalhada ao morador
    const currentTime = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let confirmationMessage = '';
    if (response === '1') {
      confirmationMessage = `✅ *VISITA AUTORIZADA COM SUCESSO*\n\n` +
        `👤 *Visitante:* ${token.visitor_name}\n` +
        `🏠 *Apartamento:* ${token.apartment_number}\n` +
        `⏰ *Autorizado em:* ${currentTime}\n\n` +
        `🟢 *Status:* APROVADO\n` +
        `📋 *Ação realizada:* O porteiro foi notificado e o visitante está autorizado a subir ao seu apartamento.\n\n` +
        `ℹ️ *Próximos passos:*\n` +
        `• O visitante será direcionado ao seu apartamento\n` +
        `• Esta autorização foi registrada no sistema\n` +
        `• Você receberá uma notificação quando o visitante chegar`;
    } else {
      confirmationMessage = `❌ *VISITA RECUSADA*\n\n` +
        `👤 *Visitante:* ${token.visitor_name}\n` +
        `🏠 *Apartamento:* ${token.apartment_number}\n` +
        `⏰ *Recusado em:* ${currentTime}\n\n` +
        `🔴 *Status:* NEGADO\n` +
        `📋 *Ação realizada:* O porteiro foi informado que a visita não foi autorizada.\n\n` +
        `ℹ️ *Próximos passos:*\n` +
        `• O visitante será informado sobre a recusa\n` +
        `• Esta decisão foi registrada no sistema\n` +
        `• Caso mude de ideia, será necessário solicitar nova autorização`;
    }
    
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
    
    // Buscar dados do token com informações detalhadas do visitor_log
    const { data: tokenData, error: tokenError } = await supabase
      .from('visitor_authorization_tokens')
      .select(`
        *,
        visitor_logs (
          id,
          entry_type,
          guest_name,
          purpose,
          delivery_sender,
          delivery_description,
          delivery_tracking_code,
          license_plate,
          vehicle_model,
          vehicle_color,
          vehicle_brand,
          visitors (
            name,
            document,
            phone
          )
        )
      `)
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
    
    // Enviar confirmação detalhada para o usuário
    const currentTime = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Obter dados detalhados do visitor_log
    const visitorLog = tokenData.visitor_logs;
    const entryType = visitorLog?.entry_type || 'visitor';
    const guestName = visitorLog?.guest_name || visitorLog?.visitors?.name || tokenData.visitor_name || 'Visitante';
    
    let confirmationMessage = '';
    switch (action) {
      case 'approve':
        if (entryType === 'visitor') {
          const purpose = visitorLog?.purpose || 'Motivo não informado';
          const visitorPhone = visitorLog?.visitors?.phone || 'Não informado';
          const visitorDoc = visitorLog?.visitors?.document || 'Não informado';
          
          confirmationMessage = `✅ *VISITA AUTORIZADA COM SUCESSO*\n\n` +
            `👤 *Visitante:* ${guestName}\n` +
            `📋 *Motivo:* ${purpose}\n` +
            `📞 *Telefone:* ${visitorPhone}\n` +
            `🆔 *Documento:* ${visitorDoc}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Autorizado em:* ${currentTime}\n\n` +
            `🟢 *Status:* APROVADO\n` +
            `📋 *Ação realizada:* O porteiro foi notificado e o visitante está autorizado a subir ao seu apartamento.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• O visitante será direcionado ao seu apartamento\n` +
            `• Esta autorização foi registrada no sistema\n` +
            `• Você receberá uma notificação quando o visitante chegar`;
        } else if (entryType === 'vehicle') {
          const licensePlate = visitorLog?.license_plate || 'Não informada';
          const vehicleModel = visitorLog?.vehicle_model || 'Não informado';
          const vehicleColor = visitorLog?.vehicle_color || 'Não informada';
          const vehicleBrand = visitorLog?.vehicle_brand || 'Não informada';
          
          confirmationMessage = `✅ *ENTRADA DE VEÍCULO AUTORIZADA*\n\n` +
            `🚗 *Proprietário:* ${guestName}\n` +
            `🚙 *Veículo:* ${vehicleBrand} ${vehicleModel}\n` +
            `🎨 *Cor:* ${vehicleColor}\n` +
            `🔢 *Placa:* ${licensePlate}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Autorizado em:* ${currentTime}\n\n` +
            `🟢 *Status:* APROVADO\n` +
            `📋 *Ação realizada:* O porteiro foi notificado e o veículo está autorizado a entrar na garagem.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• O veículo será direcionado à vaga disponível\n` +
            `• Esta autorização foi registrada no sistema\n` +
            `• Lembre-se das regras de estacionamento do condomínio`;
        } else {
          confirmationMessage = `✅ *ENTRADA AUTORIZADA COM SUCESSO*\n\n` +
            `👤 *Nome:* ${guestName}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Autorizado em:* ${currentTime}\n\n` +
            `🟢 *Status:* APROVADO\n` +
            `📋 *Ação realizada:* O porteiro foi notificado e a entrada foi autorizada.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• A pessoa será direcionada ao seu apartamento\n` +
            `• Esta autorização foi registrada no sistema`;
        }
        break;
      case 'reject':
        if (entryType === 'visitor') {
          const purpose = visitorLog?.purpose || 'Motivo não informado';
          
          confirmationMessage = `❌ *VISITA RECUSADA*\n\n` +
            `👤 *Visitante:* ${guestName}\n` +
            `📋 *Motivo:* ${purpose}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Recusado em:* ${currentTime}\n\n` +
            `🔴 *Status:* NEGADO\n` +
            `📋 *Ação realizada:* O porteiro foi notificado e o visitante foi informado que não pode subir.\n\n` +
            `ℹ️ *Informações importantes:*\n` +
            `• O visitante permanecerá na portaria\n` +
            `• Esta decisão foi registrada no sistema\n` +
            `• Caso mude de ideia, entre em contato com a portaria`;
        } else if (entryType === 'vehicle') {
          const licensePlate = visitorLog?.license_plate || 'Não informada';
          
          confirmationMessage = `❌ *ENTRADA DE VEÍCULO RECUSADA*\n\n` +
            `🚗 *Proprietário:* ${guestName}\n` +
            `🔢 *Placa:* ${licensePlate}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Recusado em:* ${currentTime}\n\n` +
            `🔴 *Status:* NEGADO\n` +
            `📋 *Ação realizada:* O porteiro foi notificado e o veículo não foi autorizado a entrar.\n\n` +
            `ℹ️ *Informações importantes:*\n` +
            `• O veículo deve aguardar na entrada\n` +
            `• Esta decisão foi registrada no sistema\n` +
            `• Para autorizar posteriormente, entre em contato com a portaria`;
        } else {
          confirmationMessage = `❌ *ENTRADA RECUSADA*\n\n` +
            `👤 *Nome:* ${guestName}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Recusado em:* ${currentTime}\n\n` +
            `🔴 *Status:* NEGADO\n` +
            `📋 *Ação realizada:* O porteiro foi notificado e a entrada foi recusada.\n\n` +
            `ℹ️ *Informações importantes:*\n` +
            `• A pessoa deve aguardar na portaria\n` +
            `• Esta decisão foi registrada no sistema\n` +
            `• Caso mude de ideia, entre em contato com a portaria`;
        }
        break;
      case 'elevator':
        if (entryType === 'delivery' || entryType === 'package') {
          const deliverySender = visitorLog?.delivery_sender || guestName;
          const deliveryCompany = visitorLog?.delivery_company || 'Não informada';
          const deliveryDescription = visitorLog?.delivery_description || 'Encomenda';
          
          confirmationMessage = `🛗 *ENCOMENDA SERÁ ENVIADA PELO ELEVADOR*\n\n` +
            `📦 *Encomenda:* ${deliveryDescription}\n` +
            `🚚 *Remetente/Empresa:* ${deliverySender}\n` +
            `📋 *Transportadora:* ${deliveryCompany}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Confirmado em:* ${currentTime}\n\n` +
            `🟡 *Status:* ENVIO PELO ELEVADOR\n` +
            `📋 *Ação realizada:* O porteiro foi instruído a enviar a encomenda pelo elevador.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• A encomenda será enviada pelo elevador\n` +
            `• Aguarde a chegada em seu andar\n` +
            `• Esta instrução foi registrada no sistema`;
        } else {
          confirmationMessage = `🛗 *ENVIO PELO ELEVADOR CONFIRMADO*\n\n` +
            `👤 *Nome:* ${guestName}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Confirmado em:* ${currentTime}\n\n` +
            `🟡 *Status:* ENVIO PELO ELEVADOR\n` +
            `📋 *Ação realizada:* O porteiro foi instruído a enviar pelo elevador.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• O item será enviado pelo elevador\n` +
            `• Aguarde a chegada em seu andar\n` +
            `• Esta instrução foi registrada no sistema`;
        }
        break;
      case 'portaria':
        if (entryType === 'delivery' || entryType === 'package') {
          const deliverySender = visitorLog?.delivery_sender || guestName;
          const deliveryCompany = visitorLog?.delivery_company || 'Não informada';
          const deliveryDescription = visitorLog?.delivery_description || 'Encomenda';
          
          confirmationMessage = `🏢 *ENCOMENDA FICARÁ NA PORTARIA*\n\n` +
            `📦 *Encomenda:* ${deliveryDescription}\n` +
            `🚚 *Remetente/Empresa:* ${deliverySender}\n` +
            `📋 *Transportadora:* ${deliveryCompany}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Confirmado em:* ${currentTime}\n\n` +
            `🟠 *Status:* AGUARDANDO RETIRADA\n` +
            `📋 *Ação realizada:* A encomenda ficará disponível na portaria para retirada.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• Dirija-se à portaria para retirar a encomenda\n` +
            `• Leve um documento de identificação\n` +
            `• Horário de funcionamento: 24 horas\n` +
            `• Esta instrução foi registrada no sistema`;
        } else {
          confirmationMessage = `🏢 *AGUARDANDO NA PORTARIA*\n\n` +
            `👤 *Nome:* ${guestName}\n` +
            `🏠 *Apartamento:* ${tokenData.apartment_number}\n` +
            `⏰ *Confirmado em:* ${currentTime}\n\n` +
            `🟠 *Status:* AGUARDANDO RETIRADA\n` +
            `📋 *Ação realizada:* O item ficará disponível na portaria.\n\n` +
            `ℹ️ *Próximos passos:*\n` +
            `• Dirija-se à portaria para retirar\n` +
            `• Leve um documento de identificação\n` +
            `• Esta instrução foi registrada no sistema`;
        }
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