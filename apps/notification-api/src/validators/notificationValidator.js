const { z } = require('zod');

const channelsSchema = z.object({
  email: z.boolean(),
  whatsapp: z.boolean(),
});

const recipientSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1, 'Nome do destinatário é obrigatório'),
  phone: z.string().optional(),
  building: z.string().min(1, 'Prédio é obrigatório'),
  apartment: z.string().min(1, 'Apartamento é obrigatório'),
});

const notificationSchema = z.object({
  recipient: recipientSchema,
  message: z.string().min(1, 'Mensagem é obrigatória'),
  subject: z.string().optional(),
  type: z.enum(['client', 'professional']),
  channels: channelsSchema,
  registrationUrl: z.string().url().optional().default('porteiroapp://login'),
}).refine((data) => data.channels.email || data.channels.whatsapp, {
  message: 'Pelo menos um canal deve estar ativo (email ou whatsapp)'
}).refine((data) => {
  if (data.channels.email) {
    return !!data.recipient.email;
  }
  return true;
}, {
  message: 'E-mail do destinatário é obrigatório quando canal email está ativo',
  path: ['recipient', 'email'],
}).refine((data) => {
  if (data.channels.whatsapp) {
    return !!data.recipient.phone;
  }
  return true;
}, {
  message: 'Telefone do destinatário é obrigatório quando canal whatsapp está ativo',
  path: ['recipient', 'phone'],
});

function validateNotification(data) {
  const result = notificationSchema.safeParse(data);
  if (!result.success) {
    const errs = result.error.errors.map((e) => e.message);
    return { success: false, errors: errs };
  }
  return { success: true, parsed: result.data };
}

// Esquema específico para notificações de moradores do JamesAvisa
const residentNotificationSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email deve ter um formato válido'),
  phone: z.string().optional(), // Telefone agora é opcional
  building: z.string().min(1, 'Prédio é obrigatório'),
  apartment: z.string().min(1, 'Apartamento é obrigatório'),
  registrationUrl: z.string().url().default('porteiroapp://login'),
  registrationLink: z.string().url().optional(), // Link completo com token (opcional)
  temporaryPassword: z.string().optional() // Senha temporária de 6 dígitos numéricos
});

function validateResidentNotification(data) {
  try {
    const parsed = residentNotificationSchema.parse(data);
    return { success: true, parsed, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, parsed: null, errors };
    }
    return { success: false, parsed: null, errors: ['Erro de validação desconhecido'] };
  }
}

// Esquema específico para notificações de visitantes com autorização
const visitorNotificationSchema = z.object({
  visitorLogId: z.string().min(1, 'ID do log do visitante é obrigatório'),
  visitorName: z.string().min(1, 'Nome do visitante é obrigatório'),
  residentEmail: z.string().email('Email do morador deve ter um formato válido'),
  residentPhone: z.string().optional(), // Telefone agora é opcional
  residentName: z.string().min(1, 'Nome do morador é obrigatório'),
  building: z.string().min(1, 'Prédio é obrigatório'),
  apartment: z.string().min(1, 'Apartamento é obrigatório')
});

function validateVisitorNotification(data) {
  try {
    const parsed = visitorNotificationSchema.parse(data);
    return { success: true, parsed, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, parsed: null, errors };
    }
    return { success: false, parsed: null, errors: ['Erro de validação desconhecido'] };
  }
}

// Esquema específico para autorização de visitantes
const visitorAuthorizationSchema = z.object({
  visitorName: z.string().min(1, 'Nome do visitante é obrigatório'),
  residentName: z.string().min(1, 'Nome do morador é obrigatório'),
  residentEmail: z.string().email('Email do morador deve ter um formato válido'),
  residentPhone: z.string().optional(), // Telefone agora é opcional
  building: z.string().min(1, 'Prédio é obrigatório'),
  apartment: z.string().min(1, 'Apartamento é obrigatório'),
  type: z.enum(['visitor', 'delivery']).optional().default('visitor') // Tipo da notificação
});

// Esquema específico para notificações de regularização
const regularizationNotificationSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email deve ter um formato válido'),
  phone: z.string().optional(), // Telefone agora é opcional
  building: z.string().min(1, 'Prédio é obrigatório'),
  apartment: z.string().min(1, 'Apartamento é obrigatório'),
  issueType: z.enum(['visitor', 'vehicle', 'package', 'other'], {
    errorMap: () => ({ message: 'Tipo de problema deve ser: visitor, vehicle, package ou other' })
  }),
  description: z.string().optional(),
  regularizationUrl: z.string().url().default('porteiroapp://login')
});

function validateVisitorAuthorization(data) {
  try {
    const parsed = visitorAuthorizationSchema.parse(data);
    return { success: true, parsed, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, parsed: null, errors };
    }
    return { success: false, parsed: null, errors: ['Erro de validação desconhecido'] };
  }
}

function validateRegularizationNotification(data) {
  try {
    const parsed = regularizationNotificationSchema.parse(data);
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
  validateNotification,
  validateResidentNotification,
  validateVisitorNotification,
  validateVisitorAuthorization,
  validateRegularizationNotification
};