/**
 * Utilitários para processamento de dados de visitantes do JamesAvisa
 * Funções para formatação, validação e geração de tokens
 */

const crypto = require('crypto');

/**
 * Formata CPF para exibição (xxx.xxx.xxx-xx)
 * @param {string} cpf - CPF sem formatação
 * @returns {string} CPF formatado
 */
function formatCPF(cpf) {
  const cleanCPF = cpf.replace(/[^\d]/g, '');
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata telefone brasileiro para exibição
 * @param {string} phone - Telefone sem formatação
 * @returns {string} Telefone formatado
 */
function formatBrazilianPhone(phone) {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  if (cleanPhone.length === 10) {
    // Telefone fixo: (xx) xxxx-xxxx
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 11) {
    // Celular: (xx) 9xxxx-xxxx
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
}

/**
 * Remove formatação de CPF
 * @param {string} cpf - CPF formatado
 * @returns {string} CPF apenas com números
 */
function cleanCPF(cpf) {
  return cpf.replace(/[^\d]/g, '');
}

/**
 * Remove formatação de telefone
 * @param {string} phone - Telefone formatado
 * @returns {string} Telefone apenas com números
 */
function cleanPhone(phone) {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Gera token único para visitante
 * @param {Object} visitorData - Dados do visitante
 * @returns {string} Token único
 */
function generateVisitorToken(visitorData) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const dataString = `${visitorData.cpf}-${visitorData.phone}-${timestamp}`;
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  
  return `VIS_${hash.substring(0, 16).toUpperCase()}_${randomBytes.toUpperCase()}`;
}

/**
 * Gera QR Code data para visitante
 * @param {Object} visitorData - Dados do visitante
 * @param {string} token - Token do visitante
 * @returns {Object} Dados para QR Code
 */
function generateVisitorQRData(visitorData, token) {
  return {
    type: 'visitor_registration',
    token: token,
    visitor_id: visitorData.id || null,
    name: visitorData.name,
    cpf: cleanCPF(visitorData.cpf),
    phone: cleanPhone(visitorData.phone),
    apartment_id: visitorData.apartment_id,
    building_id: visitorData.building_id,
    visitor_type: visitorData.visitor_type,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
  };
}

/**
 * Valida se o visitante pode finalizar cadastro
 * @param {Object} visitorData - Dados do visitante
 * @returns {Object} Resultado da validação
 */
function validateRegistrationCompletion(visitorData) {
  const requiredFields = ['name', 'cpf', 'phone', 'apartment_id', 'building_id'];
  const missingFields = requiredFields.filter(field => !visitorData[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      errors: [`Campos obrigatórios ausentes: ${missingFields.join(', ')}`]
    };
  }
  
  // Validações específicas
  const errors = [];
  
  // Validar se é visita pontual com data
  if (visitorData.visitor_type === 'pontual' && !visitorData.visit_date) {
    errors.push('Data de visita é obrigatória para visitas pontuais');
  }
  
  // Validar se é visita frequente com dias permitidos
  if (visitorData.visitor_type === 'frequente' && (!visitorData.allowed_days || visitorData.allowed_days.length === 0)) {
    errors.push('Dias permitidos são obrigatórios para visitas frequentes');
  }
  
  // Validar horários
  if (visitorData.visit_start_time && visitorData.visit_end_time) {
    const startTime = visitorData.visit_start_time.split(':').map(Number);
    const endTime = visitorData.visit_end_time.split(':').map(Number);
    const startMinutes = startTime[0] * 60 + startTime[1];
    const endMinutes = endTime[0] * 60 + endTime[1];
    
    if (startMinutes >= endMinutes) {
      errors.push('Horário de início deve ser anterior ao horário de fim');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitiza dados do visitante para armazenamento
 * @param {Object} visitorData - Dados do visitante
 * @returns {Object} Dados sanitizados
 */
function sanitizeVisitorData(visitorData) {
  return {
    ...visitorData,
    name: visitorData.name?.trim().replace(/\s+/g, ' '),
    cpf: cleanCPF(visitorData.cpf || ''),
    phone: cleanPhone(visitorData.phone || ''),
    email: visitorData.email?.trim().toLowerCase(),
    notes: visitorData.notes?.trim().substring(0, 500)
  };
}

/**
 * Gera mensagem de confirmação de cadastro
 * @param {Object} visitorData - Dados do visitante
 * @param {string} token - Token do visitante
 * @returns {string} Mensagem formatada
 */
function generateRegistrationConfirmationMessage(visitorData, token) {
  const formattedPhone = formatBrazilianPhone(visitorData.phone);
  const formattedCPF = formatCPF(visitorData.cpf);
  
  return `🎉 *Cadastro Finalizado com Sucesso!*\n\n` +
         `Olá *${visitorData.name}*!\n\n` +
         `Seu cadastro no JamesAvisa foi finalizado com sucesso.\n\n` +
         `📋 *Dados confirmados:*\n` +
         `👤 Nome: ${visitorData.name}\n` +
         `📱 Telefone: ${formattedPhone}\n` +
         `🆔 CPF: ${formattedCPF}\n` +
         `🏢 Tipo de visita: ${visitorData.visitor_type === 'pontual' ? 'Pontual' : 'Frequente'}\n\n` +
         `🔑 *Token de acesso:* \`${token}\`\n\n` +
         `✅ Agora você pode:\n` +
         `• Acessar o condomínio com seu token\n` +
         `• Receber notificações sobre suas visitas\n` +
         `• Acompanhar o status de suas autorizações\n\n` +
         `_Mensagem enviada automaticamente pelo JamesAvisa_`;
}

/**
 * Calcula tempo de expiração baseado no tipo de visita
 * @param {string} visitorType - Tipo de visita (pontual/frequente)
 * @param {string} visitDate - Data da visita (para pontuais)
 * @returns {Date} Data de expiração
 */
function calculateExpirationDate(visitorType, visitDate = null) {
  const now = new Date();
  
  if (visitorType === 'pontual' && visitDate) {
    // Para visitas pontuais, expira 1 dia após a data da visita
    const visit = new Date(visitDate);
    return new Date(visit.getTime() + 24 * 60 * 60 * 1000);
  } else if (visitorType === 'frequente') {
    // Para visitas frequentes, expira em 30 dias
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Default: 7 dias
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

module.exports = {
  formatCPF,
  formatBrazilianPhone,
  cleanCPF,
  cleanPhone,
  generateVisitorToken,
  generateVisitorQRData,
  validateRegistrationCompletion,
  sanitizeVisitorData,
  generateRegistrationConfirmationMessage,
  calculateExpirationDate
};