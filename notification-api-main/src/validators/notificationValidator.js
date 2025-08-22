const { z } = require('zod');

const channelsSchema = z.object({
  email: z.boolean(),
  whatsapp: z.boolean(),
});

const recipientSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1, 'Nome do destinatário é obrigatório'),
  phone: z.string().optional(),
});

const notificationSchema = z.object({
  recipient: recipientSchema,
  message: z.string().min(1, 'Mensagem é obrigatória'),
  subject: z.string().optional(),
  type: z.enum(['client', 'professional']),
  channels: channelsSchema,
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

module.exports = { validateNotification }; 