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
const webrtcRoutes = require('./src/routes/webrtcRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
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
      webrtcResidents: 'GET /api/webrtc/residents',
      webrtcCallInitiate: 'POST /api/webrtc/call/initiate',
      webrtcCallAnswer: 'POST /api/webrtc/call/:callId/answer',
      webrtcCallEnd: 'POST /api/webrtc/call/:callId/end',
      webrtcBuildings: 'GET /api/webrtc/buildings',
      webrtcApartmentResidents: 'GET /api/webrtc/apartments/:number/residents'
    },
    version: '1.0.0'
  });
});

// Usar rotas de notificação
app.use('/api', sendNotificationRoutes);
app.use('/api', sendVisitorNotificationRoutes);
app.use('/api', sendVisitorWaitingNotificationRoutes);
app.use('/api', residentRegistrationRoutes);
app.use('/api', completeRegistrationRoutes);
app.use('/api', visitorAuthorizationRoutes);
app.use('/webhook', whatsappWebhookRoutes);
app.use('/api/interactive', interactiveNotificationsRoutes);
app.use('/api', webrtcRoutes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
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
      customList: 'POST /api/interactive/send-custom-list',
      webrtcResidents: 'GET /api/webrtc/residents',
      webrtcCallInitiate: 'POST /api/webrtc/call/initiate',
      webrtcCallAnswer: 'POST /api/webrtc/call/:callId/answer',
      webrtcCallEnd: 'POST /api/webrtc/call/:callId/end',
      webrtcBuildings: 'GET /api/webrtc/buildings',
      webrtcApartmentResidents: 'GET /api/webrtc/apartments/:number/residents'
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
  console.log(`📞 WebRTC Endpoints:`);
  console.log(`   - Moradores: http://127.0.0.1:${PORT}/api/webrtc/residents`);
  console.log(`   - Iniciar Chamada: http://127.0.0.1:${PORT}/api/webrtc/call/initiate`);
  console.log(`   - Responder Chamada: http://127.0.0.1:${PORT}/api/webrtc/call/:callId/answer`);
  console.log(`   - Encerrar Chamada: http://127.0.0.1:${PORT}/api/webrtc/call/:callId/end`);
  console.log(`   - Prédios: http://127.0.0.1:${PORT}/api/webrtc/buildings`);
  console.log(`   - Moradores do Apartamento: http://127.0.0.1:${PORT}/api/webrtc/apartments/:number/residents`);
  console.log(`\n⚡ Pronto para enviar mensagens WhatsApp e realizar chamadas WebRTC!\n`);
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
