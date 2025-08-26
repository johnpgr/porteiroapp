/**
 * Utilitários para formatação de mensagens do PorteiroApp
 * Funções para gerar links de cadastro e mensagens formatadas para WhatsApp
 */

/**
 * Gera um link de cadastro personalizado para o morador
 * @param {Object} residentData - Dados do morador
 * @param {string} residentData.name - Nome do morador
 * @param {string} residentData.phone - Telefone do morador
 * @param {string} residentData.building - Prédio
 * @param {string} residentData.apartment - Apartamento
 * @param {string} [baseUrl='https://cadastro.porteiroapp.com'] - URL base para cadastro
 * @returns {string} Link de cadastro personalizado
 */
function generateRegistrationLink(residentData, baseUrl = 'https://cadastro.porteiroapp.com') {
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
  return `🏢 *PorteiroApp - Cadastro de Morador*\n\n` +
         `Olá *${residentData.name}*!\n\n` +
         `Você foi convidado(a) para se cadastrar no PorteiroApp.\n\n` +
         `📍 *Dados do seu apartamento:*\n` +
         `🏢 Prédio: ${residentData.building}\n` +
         `🚪 Apartamento: ${residentData.apartment}\n\n` +
         `Para completar seu cadastro, clique no link abaixo:\n` +
         `${registrationLink}\n\n` +
         `Com o PorteiroApp você pode:\n` +
         `✅ Receber visitantes com mais segurança\n` +
         `✅ Autorizar entregas remotamente\n` +
         `✅ Comunicar-se diretamente com a portaria\n` +
         `✅ Acompanhar movimentações do seu apartamento\n\n` +
         `_Mensagem enviada automaticamente pelo sistema PorteiroApp_`;
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

module.exports = {
  generateRegistrationLink,
  generateWhatsAppMessage,
  validateResidentData
};