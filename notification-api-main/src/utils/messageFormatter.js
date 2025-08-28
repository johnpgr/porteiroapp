/**
 * Utilitários para formatação de mensagens do JamesAvisa
 * Funções para gerar links de cadastro e mensagens formatadas para WhatsApp
 */

/**
 * Gera um link de cadastro personalizado para o morador
 * Agora aceita tanto tokens únicos quanto dados do morador para compatibilidade
 * @param {Object|string} residentDataOrToken - Dados do morador ou token único
 * @param {string} [baseUrl='https://jamesavisa.jamesconcierge.com/'] - URL base para cadastro
 * @returns {string} Link de cadastro personalizado
 */
function generateRegistrationLink(residentDataOrToken, baseUrl = 'https://jamesavisa.jamesconcierge.com/') {
  // Se o primeiro parâmetro é uma string, é um token
  if (typeof residentDataOrToken === 'string') {
    // Link com token: https://jamesavisa.jamesconcierge.com/cadastro/morador/{token}
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}/cadastro/morador/${residentDataOrToken}`;
  }
  
  // Compatibilidade com o formato antigo (parâmetros de query string)
  const residentData = residentDataOrToken;
  const params = new URLSearchParams({
    name: residentData.name,
    phone: residentData.phone,
    building: residentData.building,
    apartment: residentData.apartment
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Gera uma mensagem formatada para WhatsApp com informações do morador
 * @param {Object} residentData - Dados do morador
 * @param {string} residentData.name - Nome do morador
 * @param {string} residentData.building - Prédio
 * @param {string} residentData.apartment - Apartamento
 * @param {string} registrationLink - Link de cadastro personalizado
 * @returns {string} Mensagem formatada para WhatsApp
 */
function generateWhatsAppMessage(residentData, registrationLink) {
  return `🏢 *JamesAvisa - Cadastro de Morador*\n\n` +
         `Olá *${residentData.name}*!\n\n` +
         `Você foi convidado(a) para se cadastrar no JamesAvisa.\n\n` +
         `📍 *Dados do seu apartamento:*\n` +
         `🏢 Prédio: ${residentData.building}\n` +
         `🚪 Apartamento: ${residentData.apartment}\n\n` +
         `Para completar seu cadastro, clique no link abaixo:\n` +
         `${registrationLink}\n\n` +
         `Com o JamesAvisa você pode:\n` +
         `✅ Receber visitantes com mais segurança\n` +
         `✅ Autorizar entregas remotamente\n` +
         `✅ Comunicar-se diretamente com a portaria\n` +
         `✅ Acompanhar movimentações do seu apartamento\n\n` +
         `_Mensagem enviada automaticamente pelo sistema JamesAvisa_`;
}

/**
 * Valida se os dados do morador estão completos para gerar a mensagem
 * @param {Object} residentData - Dados do morador
 * @returns {Object} Resultado da validação
 */
function validateResidentData(residentData) {
  const requiredFields = ['name', 'phone', 'building', 'apartment'];
  const missingFields = requiredFields.filter(field => !residentData[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      errors: [`Campos obrigatórios ausentes: ${missingFields.join(', ')}`]
    };
  }
  
  return { valid: true, errors: [] };
}

/**
 * Gera um link de regularização personalizado para o morador
 * @param {Object} regularizationData - Dados da regularização
 * @param {string} regularizationData.name - Nome do morador
 * @param {string} regularizationData.phone - Telefone do morador
 * @param {string} regularizationData.building - Prédio
 * @param {string} regularizationData.apartment - Apartamento
 * @param {string} regularizationData.issueType - Tipo do problema
 * @param {string} [baseUrl='https://regularizacao.JamesAvisa.com'] - URL base para regularização
 * @returns {string} Link de regularização personalizado
 */
function generateRegularizationLink(regularizationData, baseUrl = 'https://jamesavisa.jamesconcierge.com/regularizacao') {
  const params = new URLSearchParams({
    name: regularizationData.name,
    phone: regularizationData.phone,
    building: regularizationData.building,
    apartment: regularizationData.apartment,
    issue: regularizationData.issueType
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Gera uma mensagem formatada para WhatsApp sobre regularização
 * @param {Object} regularizationData - Dados da regularização
 * @param {string} regularizationData.name - Nome do morador
 * @param {string} regularizationData.building - Prédio
 * @param {string} regularizationData.apartment - Apartamento
 * @param {string} regularizationData.issueType - Tipo do problema
 * @param {string} regularizationLink - Link de regularização personalizado
 * @returns {string} Mensagem formatada para WhatsApp
 */
function generateRegularizationMessage(regularizationData, regularizationLink) {
  const issueTypeMap = {
    'visitor': 'Visitante não autorizado',
    'vehicle': 'Veículo não registrado',
    'package': 'Encomenda não autorizada',
    'other': 'Situação irregular'
  };
  
  const issueDescription = issueTypeMap[regularizationData.issueType] || regularizationData.issueType;
  
  return `🚨 *JamesAvisa - Regularização Necessária*\n\n` +
         `Olá *${regularizationData.name}*!\n\n` +
         `Identificamos uma situação que precisa ser regularizada em seu apartamento.\n\n` +
         `📍 *Dados do apartamento:*\n` +
         `🏢 Prédio: ${regularizationData.building}\n` +
         `🚪 Apartamento: ${regularizationData.apartment}\n` +
         `⚠️ Situação: ${issueDescription}\n\n` +
         `Para regularizar esta situação, clique no link abaixo:\n` +
         `${regularizationLink}\n\n` +
         `📋 *O que você pode fazer:*\n` +
         `✅ Autorizar a entrada retroativamente\n` +
         `✅ Registrar informações adicionais\n` +
         `✅ Comunicar-se com a portaria\n` +
         `✅ Evitar futuras ocorrências\n\n` +
         `_Mensagem enviada automaticamente pelo sistema JamesAvisa_`;
}

/**
 * Valida se os dados de regularização estão completos
 * @param {Object} regularizationData - Dados da regularização
 * @returns {Object} Resultado da validação
 */
function validateRegularizationData(regularizationData) {
  const requiredFields = ['name', 'phone', 'building', 'apartment', 'issueType'];
  const missingFields = requiredFields.filter(field => !regularizationData[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      errors: [`Campos obrigatórios ausentes: ${missingFields.join(', ')}`]
    };
  }
  
  return { valid: true, errors: [] };
}

module.exports = {
  generateRegistrationLink,
  generateWhatsAppMessage,
  validateResidentData,
  generateRegularizationLink,
  generateRegularizationMessage,
  validateRegularizationData
};