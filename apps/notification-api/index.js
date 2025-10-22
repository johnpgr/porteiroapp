// Carregar variáveis de ambiente
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Importar rotas
const sendNotificationRoutes = require('./src/routes/sendNotification');
const sendVisitorNotificationRoutes = require('./src/routes/sendVisitorNotification');
const sendVisitorWaitingNotificationRoutes = require('./src/routes/sendVisitorWaitingNotification');
const residentRegistrationRoutes = require('./src/routes/residentRegistration');
const completeRegistrationRoutes = require('./src/routes/completeRegistration');
const visitorAuthorizationRoutes = require('./src/routes/visitorAuthorization');
const whatsappWebhookRoutes = require('./src/routes/whatsappWebhook');
const interactiveNotificationsRoutes = require('./src/routes/interactiveNotifications');
const intercomRoutes = require('./src/routes/intercom');
// Environment variables accessed via process.env

const app = express();
const PORT = process.env.PORT;

// Middleware de logging
app.use(morgan('combined'));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuração de CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Servir arquivos estáticos da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Middleware de log personalizado para requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] ${req.method} ${req.path}`);
  
  // Log especial para endpoints do Twilio
  if (req.path.includes('/intercom') || req.path.includes('/twilio')) {
    console.log('🎯 TWILIO ENDPOINT DETECTED');
    console.log('📍 Path:', req.path);
    console.log('🔧 Method:', req.method);
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    }
    if (req.query && Object.keys(req.query).length > 0) {
      console.log('🔍 Query:', JSON.stringify(req.query, null, 2));
    }
    console.log('🎯 ================================');
  } else {
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'JamesAvisa WhatsApp API',
    version: '1.0.0'
  });
});

// Rota principal
app.get('/', (req, res) => {
  res.json({
    message: 'JamesAvisa WhatsApp API',
    description: 'API responsável pelo envio de mensagens WhatsApp para moradores',
    endpoints: {
      health: 'GET /health',
      sendWhatsApp: 'POST /api/send-resident-whatsapp',
      sendVisitorWhatsApp: 'POST /api/send-visitor-whatsapp',
      sendVisitorWaitingNotification: 'POST /api/send-visitor-waiting-notification',
      registerResident: 'POST /api/register-resident',
      completeProfile: 'POST /api/complete-profile',
      interactiveNotifications: 'POST /api/interactive/send-interactive-notification',
      customButtons: 'POST /api/interactive/send-custom-buttons',
      customList: 'POST /api/interactive/send-custom-list',
      intercomToken: 'POST /api/intercom/token',
      intercomCall: 'POST /api/intercom/call',
      intercomAnswer: 'POST /api/intercom/answer',
      intercomHangup: 'POST /api/intercom/hangup',
      intercomHistory: 'GET /api/intercom/history',
      intercomTwiml: 'GET /api/intercom/twiml/connect',
      intercomWebhook: 'POST /api/intercom/webhook/status',

    },
    version: '1.0.0'
  });
});

app.use('/api', sendNotificationRoutes);
app.use('/api', sendVisitorNotificationRoutes);
app.use('/api', sendVisitorWaitingNotificationRoutes);
app.use('/api', residentRegistrationRoutes);
app.use('/api', completeRegistrationRoutes);
app.use('/api', visitorAuthorizationRoutes);
app.use('/webhook', whatsappWebhookRoutes);
app.use('/api/interactive', interactiveNotificationsRoutes);
app.use('/api', intercomRoutes);

app.use((err, res) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    availableEndpoints: {
      health: 'GET /health',
      sendWhatsApp: 'POST /api/send-resident-whatsapp',
      sendVisitorWhatsApp: 'POST /api/send-visitor-whatsapp',
      sendVisitorWaitingNotification: 'POST /api/send-visitor-waiting-notification',
      registerResident: 'POST /api/register-resident',
      completeProfile: 'POST /api/complete-profile',
      interactiveNotifications: 'POST /api/interactive/send-interactive-notification',
      customButtons: 'POST /api/interactive/send-custom-buttons',
      customList: 'POST /api/interactive/send-custom-list'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 JamesAvisa WhatsApp API iniciada!`);
  console.log(`📡 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: http://127.0.0.1:${PORT}`);
  console.log(`📋 Health Check: http://127.0.0.1:${PORT}/health`);
  console.log(`📱 WhatsApp Endpoint: http://127.0.0.1:${PORT}/api/send-resident-whatsapp`);
  console.log(`\n⚡ Pronto para enviar mensagens WhatsApp e notificações!\n`);
});

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT, encerrando servidor...');
  process.exit(0);
});

module.exports = app;
