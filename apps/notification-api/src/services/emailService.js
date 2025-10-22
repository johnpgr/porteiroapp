const { Resend } = require('resend');
// Environment variables accessed via process.env

let resendInstance = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY não configurado');
  }
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const DEFAULT_FROM = process.env.RESEND_FROM || 'Digital Paisagismo <noreply@digitalpaisagismo.com>';

async function sendEmail({ to, subject, html, name }) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: [to],
    subject,
    html,
  });
  if (error) {
    throw new Error(error.message || 'Erro desconhecido do Resend');
  }
  return { success: true };
}

module.exports = { sendEmail }; 