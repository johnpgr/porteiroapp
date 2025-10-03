// Configuração global para os testes
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

// Configurações globais de timeout para testes
jest.setTimeout(30000);

// Mock do console para testes mais limpos
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Configuração de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.WHATSAPP_API_URL = 'https://test-whatsapp-api.com';
process.env.WHATSAPP_API_TOKEN = 'test-whatsapp-token';

// Helper para criar servidor de teste
global.createTestServer = () => {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  return { httpServer, io };
};

// Helper para criar cliente de teste
global.createTestClient = (serverPort) => {
  return new Client(`http://localhost:${serverPort}`);
};

// Cleanup após cada teste
afterEach(() => {
  jest.clearAllMocks();
});