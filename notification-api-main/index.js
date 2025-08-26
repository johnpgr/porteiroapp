const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Importar rotas
const sendNotificationRoutes = require('./src/routes/sendNotification');

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
    service: 'PorteiroApp WhatsApp API',
    version: '1.0.0'
  });
});

// Rota principal
app.get('/', (req, res) => {
  res.json({
    message: 'PorteiroApp WhatsApp API',
    description: 'API responsável pelo envio de mensagens WhatsApp para moradores',
    endpoints: {
      health: 'GET /health',
      sendWhatsApp: 'POST /api/send-resident-whatsapp'
    },
    version: '1.0.0'
  });
});

// Usar rotas de notificação
app.use('/api', sendNotificationRoutes);

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
      sendWhatsApp: 'POST /api/send-resident-whatsapp'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 PorteiroApp WhatsApp API iniciada!`);
  console.log(`📡 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📋 Health Check: http://localhost:${PORT}/health`);
  console.log(`📱 WhatsApp Endpoint: http://localhost:${PORT}/api/send-resident-whatsapp`);
  console.log(`\n⚡ Pronto para enviar mensagens WhatsApp para moradores!\n`);
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