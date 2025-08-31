/**
 * Validador para dados de visitante WhatsApp
 * @param {Object} data - Dados a serem validados
 * @returns {Object} - Resultado da validação
 */
function validateVisitorWhatsAppData(data) {
  const errors = [];
  
  // Campos obrigatórios para visitantes
  const requiredFields = ['name', 'phone', 'building', 'apartment'];
  
  // Verificar campos obrigatórios
  requiredFields.forEach(field => {
    if (!data[field] || typeof data[field] !== 'string' || data[field].trim() === '') {
      errors.push(`Campo obrigatório: ${field}`);
    }
  });
  
  // Validar formato do telefone (básico)
  if (data.phone) {
    const cleanPhone = data.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      errors.push('Formato de telefone inválido');
    }
  }
  
  // Validar nome (mínimo 2 caracteres)
  if (data.name && data.name.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  validateVisitorWhatsAppData
};