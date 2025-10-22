const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const DatabaseService = require('./src/services/db.service');

// Carregar variáveis de ambiente
dotenv.config();

// Importar rotas
const callRoutes = require('./src/routes/call.routes');
const tokenRoutes = require('./src/routes/token.routes');

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 ${timestamp} - ${req.method} ${req.path}`);
  
  // Log do body para requests POST/PUT (exceto dados sensíveis)
  if (['POST', 'PUT'].includes(req.method) && req.body) {
    const logBody = { ...req.body };
    // Remover dados sensíveis do log
    if (logBody.password) logBody.password = '[REDACTED]';
    if (logBody.token) logBody.token = '[REDACTED]';
    console.log(`📝 Body:`, logBody);
  }
  
  next();
});

// Middleware de tratamento de resposta
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Armazenar dados da resposta para uso em middlewares
    if (typeof data === 'string') {
      try {
        req.body.responseData = JSON.parse(data);
      } catch (e) {
        // Ignorar se não for JSON válido
      }
    } else {
      req.body.responseData = data;
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Rota de health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Interfone API está funcionando',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'PostgreSQL (Supabase)',
      voiceSDK: 'Agora Voice SDK',
      notifications: 'Firebase Cloud Messaging'
    }
  });
});

// Rota de status dos serviços
app.get('/api/status', async (req, res) => {
  try {
    // Testar conexão com banco de dados
    const dbStatus = await DatabaseService.testConnection();
    
    // Verificar configurações da Agora
    const agoraConfigured = !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus ? 'connected' : 'disconnected',
          type: 'PostgreSQL (Supabase)'
        },
        agora: {
          status: agoraConfigured ? 'configured' : 'not_configured',
          appId: process.env.AGORA_APP_ID ? 'set' : 'not_set'
        },
        pushNotifications: {
          status: 'disabled',
          provider: 'Removed - Focus on calls only'
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT
      }
    });
  } catch (error) {
    console.error('🔥 Erro ao verificar status dos serviços:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar status dos serviços',
      timestamp: new Date().toISOString()
    });
  }
});

// Registrar rotas da API
app.use('/api/calls', callRoutes);
app.use('/api/tokens', tokenRoutes);

// Middleware de tratamento de rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: {
      'GET /': 'Health check',
      'GET /api/status': 'Status dos serviços',
      'POST /api/calls/start': 'Iniciar chamada',
      'POST /api/calls/:callId/answer': 'Atender chamada',
      'POST /api/calls/:callId/decline': 'Recusar chamada',
      'POST /api/calls/:callId/end': 'Encerrar chamada',
      'GET /api/calls/:callId/status': 'Status da chamada',
      'GET /api/calls/history': 'Histórico de chamadas',
      'GET /api/calls/active': 'Chamadas ativas',
      'POST /api/tokens/generate': 'Gerar token RTC',
      'POST /api/tokens/generate-multiple': 'Gerar múltiplos tokens',
      'POST /api/tokens/validate': 'Validar token'
    }
  });
});

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
  console.error('🔥 Erro não tratado:', error);
  
  // Não expor detalhes do erro em produção
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(error.status || 500).json({
    success: false,
    error: isDevelopment ? error.message : 'Erro interno do servidor',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: error.stack })
  });
});

// Função para inicializar o servidor
async function startServer() {
  try {
    console.log('🚀 Iniciando Interfone API...');
    
    // Testar conexão com banco de dados
    console.log('🔍 Testando conexão com banco de dados...');
    const dbConnected = await DatabaseService.testConnection();
    
    if (dbConnected) {
      console.log('✅ Conexão com banco de dados estabelecida');
    } else {
      console.warn('⚠️ Não foi possível conectar ao banco de dados');
    }
    
    // Verificar configurações
    console.log('🔧 Verificando configurações...');
    
    const agoraConfigured = !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
    console.log(`📡 Agora SDK: ${agoraConfigured ? '✅ Configurado' : '❌ Não configurado'}`);
    
    console.log(`📱 Push Notifications: ❌ Removido (foco apenas em chamadas)`);
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log('🎉 Interfone API iniciada com sucesso!');
      console.log(`📍 Servidor rodando em: http://localhost:${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log('📋 Rotas disponíveis:');
      console.log('   GET  / - Health check');
      console.log('   GET  /api/status - Status dos serviços');
      console.log('   POST /api/calls/start - Iniciar chamada');
      console.log('   POST /api/calls/:callId/answer - Atender chamada');
      console.log('   POST /api/calls/:callId/decline - Recusar chamada');
      console.log('   POST /api/calls/:callId/end - Encerrar chamada');
      console.log('   GET  /api/calls/:callId/status - Status da chamada');
      console.log('   GET  /api/calls/history - Histórico de chamadas');
      console.log('   GET  /api/calls/active - Chamadas ativas');
      console.log('   POST /api/tokens/generate - Gerar token RTC');
      console.log('   POST /api/tokens/generate-multiple - Gerar múltiplos tokens');
      console.log('   POST /api/tokens/validate - Validar token');
      console.log('');
      console.log('🔗 Para testar: curl http://localhost:' + PORT);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 Recebido SIGTERM, encerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor encerrado graciosamente');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('📴 Recebido SIGINT, encerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor encerrado graciosamente');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('🔥 Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor apenas se este arquivo for executado diretamente
if (require.main === module) {
  startServer();
}

module.exports = app;