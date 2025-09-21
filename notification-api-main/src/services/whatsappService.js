const axios = require('axios');

// Configurações da Evolution API
const EVOLUTION_API_CONFIG = {
  baseUrl: process.env.EVOLUTION_BASE_URL || process.env.EXPO_PUBLIC_EVOLUTION_API_URL || 'https://evolutionapi.atendimentoemagrecer.com.br',
  token: process.env.EVOLUTION_API_KEY || process.env.EXPO_PUBLIC_EVOLUTION_API_TOKEN || '09E5A1E9AA3C-495D-BEDF-50DCD30DE760',
  instance: process.env.EVOLUTION_INSTANCE || process.env.EXPO_PUBLIC_EVOLUTION_INSTANCE || 'desenvolvimento',
};

// Logs de debug para configuração
console.log('Evolution API Config:', {
  baseUrl: EVOLUTION_API_CONFIG.baseUrl,
  hasToken: !!EVOLUTION_API_CONFIG.token,
  tokenLength: EVOLUTION_API_CONFIG.token?.length || 0,
  instance: EVOLUTION_API_CONFIG.instance,
});

// DDDs válidos do Brasil
const VALID_DDDS = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99' // MA
];

/**
 * Valida se o número de telefone está no formato brasileiro correto
 * @param {string} phone - Número de telefone a ser validado
 * @returns {boolean} - true se válido, false caso contrário
 */
function validateBrazilianPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    console.warn('validateBrazilianPhone: Telefone inválido ou não fornecido:', phone);
    return false;
  }
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return false;
  }
  
  const ddd = parseInt(cleanPhone.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return false;
  }
  
  if (cleanPhone.length === 11 && cleanPhone[2] !== '9') {
    return false;
  }
  
  return true;
}

/**
 * Gera o link personalizado de cadastro com parâmetros
 * @param {Object} residentData - Dados do morador
 * @param {string} baseUrl - URL base do site de cadastro
 * @returns {string} - Link completo com parâmetros
 */
function generateRegistrationLink(residentData, baseUrl = 'porteiroapp://login') {
  const cleanPhone = residentData.phone.replace(/\D/g, '');
  
  const params = new URLSearchParams({
    telefone: cleanPhone,
    nome: residentData.name,
    apto: residentData.apartment,
    predio: residentData.building,
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Gera a mensagem personalizada para o WhatsApp
 * @param {Object} residentData - Dados do morador
 * @param {string} registrationLink - Link de cadastro gerado
 * @returns {string} - Mensagem formatada
 */
function generateWhatsAppMessage(residentData, registrationLink) {
  return `Olá, ${residentData.name}! 👋\n\nComplete seu cadastro no JamesAvisa clicando no link abaixo:\n\n${registrationLink}\n\nSeus dados já estão pré-preenchidos para facilitar o processo.\n\nQualquer dúvida, entre em contato conosco! 📱`;
}

async function sendWhatsApp({ to, message }) {
  // Se WhatsApp desabilitado, simula sucesso
  if (process.env.WHATSAPP_DISABLED === 'true') {
    console.log('WhatsApp desabilitado - simulando envio para:', to);
    return { success: true, messageId: 'disabled' };
  }

  // Validações
  if (!EVOLUTION_API_CONFIG.token) {
    throw new Error('Token da Evolution API não configurado');
  }
  if (!EVOLUTION_API_CONFIG.baseUrl) {
    throw new Error('URL base da Evolution API não configurada');
  }
  if (!EVOLUTION_API_CONFIG.instance) {
    throw new Error('Instância da Evolution API não configurada');
  }

  // Primeiro, verificar se a instância está conectada
  try {
    const statusCheck = await checkInstanceStatus();
    if (!statusCheck.connected) {
      throw new Error(`WhatsApp não conectado. Status: ${statusCheck.state || 'desconhecido'}. ${statusCheck.error || 'Verifique se o QR Code foi escaneado.'}`);
    }
  } catch (statusError) {
    console.error('Erro ao verificar status:', statusError.message);
    throw new Error(`Erro ao verificar conexão WhatsApp: ${statusError.message}`);
  }

  // Formatar número (remover caracteres especiais, manter apenas números)
  const cleanNumber = to.replace(/[^\d]/g, '');
  
  // Lógica para números brasileiros:
  let formattedNumber;
  
  if (cleanNumber.length === 11) {
    // Número com 11 dígitos: pode ser celular (DDD + 9 + 8 dígitos)
    const ddd = cleanNumber.substring(0, 2);
    const ninthDigit = cleanNumber.substring(2, 3);
    
    if (!VALID_DDDS.includes(ddd)) {
      throw new Error(`DDD inválido: ${ddd}. Número: ${to}`);
    }
    
    if (ninthDigit === '9') {
      // É um celular válido (DDD + 9 + 8 dígitos)
      formattedNumber = '55' + cleanNumber;
    } else {
      throw new Error(`Número celular inválido: ${to}. Números celulares devem ter 9 como terceiro dígito.`);
    }
  } else if (cleanNumber.length === 10) {
    // Número com 10 dígitos: telefone fixo (DDD + 8 dígitos)
    const ddd = cleanNumber.substring(0, 2);
    
    if (!VALID_DDDS.includes(ddd)) {
      throw new Error(`DDD inválido: ${ddd}. Número: ${to}`);
    }
    
    // Telefone fixo brasileiro
    formattedNumber = '55' + cleanNumber;
  } else if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
    // Já tem código do país (55)
    const ddd = cleanNumber.substring(2, 4);
    
    if (!VALID_DDDS.includes(ddd)) {
      throw new Error(`DDD inválido: ${ddd}. Número: ${to}`);
    }
    
    // Verificar se é celular ou fixo
    if (cleanNumber.length === 13) {
      const possibleNinthDigit = cleanNumber.substring(4, 5);
      if (possibleNinthDigit !== '9') {
        // Pode ser fixo com código do país
        if (cleanNumber.length !== 12) {
          // Se não é 12 (fixo), deve ser 13 (celular) e ter 9
          throw new Error(`Número inválido: ${to}. Celulares devem ter 9 como quinto dígito quando incluem código do país.`);
        }
      }
    }
    
    formattedNumber = cleanNumber;
  } else if (cleanNumber.length === 12 && cleanNumber.startsWith('55')) {
    // Número fixo com código do país (55 + DDD + 8 dígitos)
    const ddd = cleanNumber.substring(2, 4);
    
    if (!VALID_DDDS.includes(ddd)) {
      throw new Error(`DDD inválido: ${ddd}. Número: ${to}`);
    }
    
    formattedNumber = cleanNumber;
  } else {
    throw new Error(`Formato de número não suportado: ${to}. Formatos aceitos:
    - Celular: 11987654321 (DDD + 9 + 8 dígitos)
    - Fixo: 1133334444 (DDD + 8 dígitos)
    - Com código país: 5511987654321 ou 551133334444`);
  }
  
  console.log(`Número original: ${to} → Limpo: ${cleanNumber} → Formatado: ${formattedNumber}`);

  // Validação final: deve ter 12 ou 13 dígitos e começar com 55
  if ((formattedNumber.length !== 12 && formattedNumber.length !== 13) || !formattedNumber.startsWith('55')) {
    throw new Error(`Número inválido após formatação: ${formattedNumber}. Verifique o formato do número.`);
  }

  // Verificar se o DDD do número formatado é válido
  const finalDdd = formattedNumber.substring(2, 4);
  if (!VALID_DDDS.includes(finalDdd)) {
    throw new Error(`DDD inválido após formatação: ${finalDdd}. Número: ${formattedNumber}`);
  }

  // Verificar se o número existe no WhatsApp antes de tentar enviar
  const skipNumberCheck = process.env.WHATSAPP_SKIP_NUMBER_CHECK === 'true';
  
  if (!skipNumberCheck) {
    console.log(`Verificando se número ${formattedNumber} possui WhatsApp...`);
    const numberCheck = await checkWhatsAppNumber(formattedNumber);
    
    if (!numberCheck.exists) {
      throw new Error(`O número ${to} não possui WhatsApp ativo ou não foi encontrado. Verifique se o número está correto e se a pessoa tem WhatsApp instalado.`);
    }
    
    console.log(`✅ Número ${formattedNumber} confirmado no WhatsApp`);
  } else {
    console.log(`⚠️ Pulando verificação de número (WHATSAPP_SKIP_NUMBER_CHECK=true)`);
  }
  
  console.log(`Enviando WhatsApp para: ${formattedNumber} via ${EVOLUTION_API_CONFIG.baseUrl}`);

  try {
    const payload = {
      number: formattedNumber,
      textMessage: {
        text: message
      }
    };

    console.log('Payload Evolution API:', JSON.stringify(payload, null, 2));

    let response;
    
    // Tentar formato v1 primeiro (textMessage)
    try {
      response = await axios.post(
        `${EVOLUTION_API_CONFIG.baseUrl}/message/sendText/${EVOLUTION_API_CONFIG.instance}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_CONFIG.token
          },
          timeout: 30000
        }
      );
    } catch (firstError) {
      console.log('Tentativa 1 falhou, tentando formato alternativo...');
      
      // Tentar formato v2 (text direto)
      const alternativePayload = {
        number: formattedNumber,
        text: message
      };
      
      console.log('Payload alternativo:', JSON.stringify(alternativePayload, null, 2));
      
      response = await axios.post(
        `${EVOLUTION_API_CONFIG.baseUrl}/message/sendText/${EVOLUTION_API_CONFIG.instance}`,
        alternativePayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_CONFIG.token
          },
          timeout: 30000
        }
      );
    }

    if (response.data && response.data.key) {
      console.log('WhatsApp enviado com sucesso:', response.data.key.id);
      return {
        success: true,
        messageId: response.data.key.id,
        status: response.data.message?.status || 'sent'
      };
    }

    throw new Error('Resposta inválida da Evolution API');

  } catch (error) {
    console.error('Evolution API Error:', error.response?.data || error.message);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error('API Key inválida para Evolution API');
      }
      if (status === 404) {
        throw new Error(`Instância '${EVOLUTION_API_CONFIG.instance}' não encontrada na Evolution API. Verifique se a instância foi criada.`);
      }
      if (status === 400) {
        console.error('Detalhes do erro 400:', JSON.stringify(data, null, 2));
        
        // Tratar erros específicos da Evolution API
        if (data?.response?.message && Array.isArray(data.response.message)) {
          const errorDetails = data.response.message[0];
          
          if (errorDetails?.exists === false) {
            throw new Error(`Número ${errorDetails.number} não possui WhatsApp ativo ou não foi encontrado. Verifique se o número está correto e possui WhatsApp.`);
          }
          
          const messages = data.response.message.map(msg => 
            typeof msg === 'object' ? JSON.stringify(msg) : msg
          ).join(', ');
          throw new Error(`Erro de validação Evolution API: ${messages}`);
        }
        
        if (data?.message) {
          throw new Error(`Dados inválidos: ${data.message}`);
        }
        
        throw new Error(`Número ou formato de mensagem inválido. Verifique: número ${formattedNumber}, instância ${EVOLUTION_API_CONFIG.instance}`);
      }
      if (status === 500) {
        if (data?.response?.message === 'Connection Closed') {
          throw new Error('WhatsApp desconectado. Escaneie o QR Code novamente para reconectar.');
        }
        throw new Error(`Erro interno da Evolution API: ${data?.message || data?.response?.message || 'Erro desconhecido'}`);
      }
      
      throw new Error(`Erro Evolution API (${status}): ${data?.message || 'Erro desconhecido'}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Evolution API não está acessível em ${EVOLUTION_API_CONFIG.baseUrl}. Verifique se o serviço está rodando.`);
    }
    
    throw new Error(`Erro de conexão com Evolution API: ${error.message}`);
  }
}

// Função para verificar status da instância
async function checkInstanceStatus() {
  if (!EVOLUTION_API_CONFIG.token || !EVOLUTION_API_CONFIG.baseUrl) {
    return { connected: false, error: 'Configuração incompleta' };
  }

  try {
    const response = await axios.get(
      `${EVOLUTION_API_CONFIG.baseUrl}/instance/connectionState/${EVOLUTION_API_CONFIG.instance}`,
      {
        headers: { 'apikey': EVOLUTION_API_CONFIG.token },
        timeout: 10000
      }
    );

    const state = response.data?.instance?.state;
    return {
      connected: state === 'open',
      state: state,
      instance: EVOLUTION_API_CONFIG.instance,
      qrcode: state === 'connecting' ? 'Aguardando QR Code' : null
    };
  } catch (error) {
    console.error('Erro ao verificar status:', error.response?.data || error.message);
    return {
      connected: false,
      error: error.response?.data?.message || error.message,
      needsSetup: error.response?.status === 404
    };
  }
}

// Função para gerar QR Code
async function generateQRCode() {
  if (!EVOLUTION_API_CONFIG.token || !EVOLUTION_API_CONFIG.baseUrl) {
    throw new Error('Configuração incompleta');
  }

  try {
    const response = await axios.get(
      `${EVOLUTION_API_CONFIG.baseUrl}/instance/connect/${EVOLUTION_API_CONFIG.instance}`,
      {
        headers: { 'apikey': EVOLUTION_API_CONFIG.token },
        timeout: 15000
      }
    );

    return {
      qrcode: response.data?.qrcode,
      base64: response.data?.base64
    };
  } catch (error) {
    throw new Error(`Erro ao gerar QR Code: ${error.response?.data?.message || error.message}`);
  }
}

// Função para verificar se número existe no WhatsApp
async function checkWhatsAppNumber(number) {
  try {
    const response = await axios.post(
      `${EVOLUTION_API_CONFIG.baseUrl}/chat/whatsappNumbers/${EVOLUTION_API_CONFIG.instance}`,
      {
        numbers: [number]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_CONFIG.token
        },
        timeout: 15000
      }
    );

    if (response.data && Array.isArray(response.data)) {
      const numberInfo = response.data.find(item => item.number === number);
      return {
        exists: numberInfo?.exists || false,
        jid: numberInfo?.jid
      };
    }

    return { exists: false };
  } catch (error) {
    console.warn('Não foi possível verificar o número:', error.message);
    // Se a verificação falhar, assumimos que existe para tentar enviar
    return { exists: true };
  }
}

// Função para gerar mensagem de autorização de visitante
function generateVisitorAuthorizationMessage(visitorName, residentName, building, apartment, authorizationLink) {
  return `📢 James Avisa\n` +
         `Prezado(a) ${residentName}, informamos que há um visitante aguardando na portaria.\n\n` +
         `Visitante: ${visitorName}\n` +
         `Prédio: ${building}\n` +
         `Apartamento: ${apartment}\n\n` +
         `👉 Acesse https://jamesavisa.jamesconcierge.com/login para verificar os detalhes e autorizar ou recusar a entrada.`;
}

// Gerar mensagem de autorização com botões interativos
function generateVisitorAuthorizationMessageWithButtons(visitorName, apartmentNumber, visitType = 'visitor') {
  const typeText = {
    visitor: 'visitante',
    delivery: 'entrega',
    service: 'prestador de serviço'
  }[visitType] || 'visitante';
  
  const message = `🏢 *AUTORIZAÇÃO DE ${typeText.toUpperCase()}*\n\n` +
                 `👤 Nome: ${visitorName}\n` +
                 `🏠 Apartamento: ${apartmentNumber}\n\n` +
                 `Selecione uma opção:`;
  
  // Botões básicos para visitas/entregas gerais
  const basicButtons = [
    { id: 'accept', title: '✅ Aceitar' },
    { id: 'reject', title: '❌ Recusar' }
  ];
  
  // Botões específicos para entregas
  const deliveryButtons = [
    { id: 'elevator', title: '🛗 Enviar pelo elevador' },
    { id: 'reception', title: '🏢 Deixar na portaria' },
    { id: 'reject', title: '❌ Recusar' }
  ];
  
  return {
    message,
    buttons: visitType === 'delivery' ? deliveryButtons : basicButtons
  };
}

// Gerar mensagem de autorização com lista interativa (para mais opções)
function generateVisitorAuthorizationMessageWithList(visitorName, apartmentNumber, visitType = 'visitor') {
  const typeText = {
    visitor: 'visitante',
    delivery: 'entrega',
    service: 'prestador de serviço'
  }[visitType] || 'visitante';
  
  const message = `🏢 *AUTORIZAÇÃO DE ${typeText.toUpperCase()}*\n\n` +
                 `👤 Nome: ${visitorName}\n` +
                 `🏠 Apartamento: ${apartmentNumber}\n\n` +
                 `Selecione uma das opções abaixo:`;
  
  // Lista básica para visitas/entregas gerais
  const basicList = [
    { id: 'accept', title: '✅ Aceitar', description: 'Autorizar a visita/entrega' },
    { id: 'reject', title: '❌ Recusar', description: 'Negar a autorização' }
  ];
  
  // Lista específica para entregas
  const deliveryList = [
    { id: 'elevator', title: '🛗 Enviar pelo elevador', description: 'Autorizar e enviar diretamente ao apartamento' },
    { id: 'reception', title: '🏢 Deixar na portaria', description: 'Autorizar e deixar na recepção' },
    { id: 'reject', title: '❌ Recusar entrega', description: 'Negar a autorização da entrega' }
  ];
  
  return {
    message,
    listItems: visitType === 'delivery' ? deliveryList : basicList,
    title: visitType === 'delivery' ? 'Opções de Entrega' : 'Opções de Autorização'
  };
}

// Função específica para enviar autorização de visitante
async function sendVisitorAuthorization(residentPhone, visitorName, residentName, building, apartment, authorizationLink) {
  const message = generateVisitorAuthorizationMessage(visitorName, residentName, building, apartment, authorizationLink);
  
  console.log(`Enviando autorização de visitante para ${residentPhone}:`);
  console.log(`Visitante: ${visitorName}`);
  console.log(`Destino: ${building ? `${building} - ` : ''}Apto ${apartment}`);
  
  return await sendWhatsApp({ to: residentPhone, message });
}

// Enviar mensagem do WhatsApp com botões interativos
async function sendWhatsAppWithButtons(phoneNumber, message, buttons, tokenId) {
  try {
    console.log(`📤 Enviando mensagem com botões para ${phoneNumber}`);
    
    if (!WHATSAPP_ENABLED) {
      console.log('📵 WhatsApp desabilitado - simulando envio com botões');
      console.log('Mensagem:', message);
      console.log('Botões:', buttons);
      return { success: true, simulated: true };
    }
    
    // Validar número
    if (!isValidBrazilianNumber(phoneNumber)) {
      throw new Error('Número de telefone inválido');
    }
    
    // Verificar status da instância
    const instanceStatus = await checkInstanceStatus();
    if (!instanceStatus.connected) {
      throw new Error('Instância do WhatsApp não conectada');
    }
    
    // Formatar número para padrão brasileiro
    const formattedNumber = formatBrazilianNumber(phoneNumber);
    
    // Preparar botões com IDs únicos
    const interactiveButtons = buttons.map(button => ({
      type: 'reply',
      reply: {
        id: `${button.id}_${tokenId}`,
        title: button.title
      }
    }));
    
    // Payload para mensagem com botões
    const payload = {
      number: formattedNumber,
      options: {
        delay: 1200,
        presence: 'composing'
      },
      buttonMessage: {
        text: message,
        buttons: interactiveButtons,
        headerType: 1
      }
    };
    
    console.log('📋 Payload da mensagem com botões:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendButtons/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro na API do WhatsApp:', responseData);
      
      // Tratar diferentes tipos de erro
      if (response.status === 401) {
        throw new Error('Chave da API inválida');
      } else if (response.status === 404) {
        throw new Error('Instância não encontrada');
      } else if (response.status === 400) {
        throw new Error(`Erro na requisição: ${responseData.message || 'Dados inválidos'}`);
      } else if (response.status === 500) {
        throw new Error('Erro interno do servidor WhatsApp');
      }
      
      throw new Error(`Erro HTTP ${response.status}: ${responseData.message || 'Erro desconhecido'}`);
    }
    
    console.log('✅ Mensagem com botões enviada com sucesso:', responseData);
    return { success: true, data: responseData };
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem com botões:', error.message);
    throw error;
  }
}

// Enviar mensagem do WhatsApp com lista interativa
async function sendWhatsAppWithList(phoneNumber, message, listItems, tokenId, title = 'Selecione uma opção') {
  try {
    console.log(`📤 Enviando mensagem com lista para ${phoneNumber}`);
    
    if (!WHATSAPP_ENABLED) {
      console.log('📵 WhatsApp desabilitado - simulando envio com lista');
      console.log('Mensagem:', message);
      console.log('Lista:', listItems);
      return { success: true, simulated: true };
    }
    
    // Validar número
    if (!isValidBrazilianNumber(phoneNumber)) {
      throw new Error('Número de telefone inválido');
    }
    
    // Verificar status da instância
    const instanceStatus = await checkInstanceStatus();
    if (!instanceStatus.connected) {
      throw new Error('Instância do WhatsApp não conectada');
    }
    
    // Formatar número para padrão brasileiro
    const formattedNumber = formatBrazilianNumber(phoneNumber);
    
    // Preparar itens da lista com IDs únicos
    const rows = listItems.map(item => ({
      id: `${item.id}_${tokenId}`,
      title: item.title,
      description: item.description || ''
    }));
    
    // Payload para mensagem com lista
    const payload = {
      number: formattedNumber,
      options: {
        delay: 1200,
        presence: 'composing'
      },
      listMessage: {
        text: message,
        buttonText: 'Ver opções',
        sections: [{
          title: title,
          rows: rows
        }]
      }
    };
    
    console.log('📋 Payload da mensagem com lista:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendList/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro na API do WhatsApp:', responseData);
      
      // Tratar diferentes tipos de erro
      if (response.status === 401) {
        throw new Error('Chave da API inválida');
      } else if (response.status === 404) {
        throw new Error('Instância não encontrada');
      } else if (response.status === 400) {
        throw new Error(`Erro na requisição: ${responseData.message || 'Dados inválidos'}`);
      } else if (response.status === 500) {
        throw new Error('Erro interno do servidor WhatsApp');
      }
      
      throw new Error(`Erro HTTP ${response.status}: ${responseData.message || 'Erro desconhecido'}`);
    }
    
    console.log('✅ Mensagem com lista enviada com sucesso:', responseData);
    return { success: true, data: responseData };
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem com lista:', error.message);
    throw error;
  }
}

module.exports = {
  sendWhatsApp,
  sendWhatsAppWithButtons,
  sendWhatsAppWithList,
  checkInstanceStatus,
  generateQRCode,
  checkWhatsAppNumber,
  generateRegistrationLink,
  generateWhatsAppMessage,
  validateBrazilianPhone,
  generateVisitorAuthorizationMessage,
  generateVisitorAuthorizationMessageWithButtons,
  generateVisitorAuthorizationMessageWithList,
  sendVisitorAuthorization
};
