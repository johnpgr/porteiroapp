const { z } = require('zod');

/**
 * Validação de CPF brasileiro
 * @param {string} cpf - CPF para validar
 * @returns {boolean} - True se válido
 */
function isValidCPF(cpf) {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');
  
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let remainder = sum % 11;
  let digit1 = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cpf[9]) !== digit1) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  remainder = sum % 11;
  let digit2 = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cpf[10]) === digit2;
}

/**
 * Validação de telefone brasileiro
 * @param {string} phone - Telefone para validar
 * @returns {boolean} - True se válido
 */
function isValidBrazilianPhone(phone) {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  // Verifica se tem 10 ou 11 dígitos (com DDD)
  if (cleanPhone.length < 10 || cleanPhone.length > 11) return false;
  
  // Verifica se o DDD é válido (11-99)
  const ddd = parseInt(cleanPhone.substring(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  
  // Para celular (11 dígitos), o terceiro dígito deve ser 9
  if (cleanPhone.length === 11 && cleanPhone[2] !== '9') return false;
  
  return true;
}

// Schema para validação de dados de finalização de cadastro de visitante
const visitorRegistrationSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
  
  cpf: z.string()
    .min(11, 'CPF deve ter 11 dígitos')
    .refine(isValidCPF, 'CPF inválido'),
  
  phone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .refine(isValidBrazilianPhone, 'Telefone brasileiro inválido'),
  
  email: z.string()
    .email('Email inválido')
    .optional(),
  
  photo_url: z.string()
    .url('URL da foto inválida')
    .optional(),
  
  document_type: z.enum(['cpf', 'rg', 'cnh', 'passport'])
    .default('cpf'),
  
  visitor_type: z.enum(['pontual', 'frequente'])
    .default('pontual'),
  
  apartment_id: z.string()
    .min(1, 'ID do apartamento é obrigatório'),
  
  building_id: z.string()
    .min(1, 'ID do prédio é obrigatório'),
  
  authorized_by: z.string()
    .min(1, 'ID do morador autorizador é obrigatório'),
  
  visit_date: z.string()
    .datetime('Data de visita deve estar no formato ISO')
    .optional(),
  
  visit_start_time: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário de início inválido (HH:MM)')
    .optional(),
  
  visit_end_time: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário de fim inválido (HH:MM)')
    .optional(),
  
  allowed_days: z.array(z.number().min(0).max(6))
    .optional(),
  
  max_simultaneous_visits: z.number()
    .min(1, 'Máximo de visitas simultâneas deve ser pelo menos 1')
    .max(10, 'Máximo de visitas simultâneas não pode exceder 10')
    .default(1),
  
  notes: z.string()
    .max(500, 'Observações devem ter no máximo 500 caracteres')
    .optional()
});

/**
 * Valida dados de finalização de cadastro de visitante
 * @param {Object} data - Dados do visitante
 * @returns {Object} Resultado da validação
 */
function validateVisitorRegistration(data) {
  try {
    const parsed = visitorRegistrationSchema.parse(data);
    return { success: true, parsed, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, parsed: null, errors };
    }
    return { success: false, parsed: null, errors: ['Erro de validação desconhecido'] };
  }
}

/**
 * Valida dados básicos de visitante (para pré-cadastro)
 * @param {Object} data - Dados básicos do visitante
 * @returns {Object} Resultado da validação
 */
function validateBasicVisitorData(data) {
  const basicSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    phone: z.string().refine(isValidBrazilianPhone, 'Telefone brasileiro inválido'),
    visitor_type: z.enum(['pontual', 'frequente']).default('pontual')
  });
  
  try {
    const parsed = basicSchema.parse(data);
    return { success: true, parsed, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, parsed: null, errors };
    }
    return { success: false, parsed: null, errors: ['Erro de validação desconhecido'] };
  }
}

module.exports = {
  validateVisitorRegistration,
  validateBasicVisitorData,
  isValidCPF,
  isValidBrazilianPhone
};