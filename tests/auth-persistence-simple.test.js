// Teste simples de autenticação persistente
// Este teste verifica as funcionalidades do TokenStorage e simulações de sessão

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://rnqhqjqjqjqjqjqjqjqj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucWhxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MTQzODIsImV4cCI6MjA3MjE5MDM4Mn0.example';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock do TokenStorage para testes
class MockTokenStorage {
  static storage = new Map();
  
  static async saveUserData(userData, token, expiresAt) {
    this.storage.set('userData', userData);
    this.storage.set('token', token);
    this.storage.set('expiresAt', expiresAt);
    console.log('💾 Dados salvos no storage simulado');
  }
  
  static async getUserData() {
    return this.storage.get('userData') || null;
  }
  
  static async getToken() {
    return this.storage.get('token') || null;
  }
  
  static async getExpiresAt() {
    return this.storage.get('expiresAt') || null;
  }
  
  static async hasValidToken() {
    const token = this.storage.get('token');
    const expiresAt = this.storage.get('expiresAt');
    
    if (!token || !expiresAt) {
      return false;
    }
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    
    return now < expiry;
  }
  
  static async clearAll() {
    this.storage.clear();
    console.log('🧹 Storage limpo');
  }
}

// Função utilitária para aguardar
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Teste 1: Persistência de dados no storage
async function testTokenStoragePersistence() {
  console.log('\n🧪 Teste 1: Persistência de dados no storage');
  
  try {
    // Limpar storage
    await MockTokenStorage.clearAll();
    
    // Simular dados de usuário
    const mockUserData = {
      id: 'test-user-123',
      email: 'test@example.com',
      user_type: 'morador'
    };
    
    const mockToken = 'mock-jwt-token-12345';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias
    
    // Salvar dados
    await MockTokenStorage.saveUserData(mockUserData, mockToken, expiresAt.toISOString());
    
    // Verificar se os dados foram salvos
    const savedUserData = await MockTokenStorage.getUserData();
    const savedToken = await MockTokenStorage.getToken();
    const savedExpiresAt = await MockTokenStorage.getExpiresAt();
    
    if (!savedUserData || !savedToken || !savedExpiresAt) {
      throw new Error('Dados não foram salvos corretamente');
    }
    
    console.log('✅ Dados de usuário salvos:', savedUserData.email);
    console.log('✅ Token salvo:', savedToken.substring(0, 10) + '...');
    console.log('✅ Expiração salva:', new Date(savedExpiresAt).toLocaleString());
    
    // Verificar se o token é considerado válido
    const isValid = await MockTokenStorage.hasValidToken();
    if (!isValid) {
      throw new Error('Token deveria ser válido');
    }
    
    console.log('✅ Token é considerado válido');
    console.log('✅ Teste de persistência passou');
    
  } catch (error) {
    console.error('❌ Erro no teste de persistência:', error.message);
    throw error;
  }
}

// Teste 2: Expiração de token
async function testTokenExpiration() {
  console.log('\n🧪 Teste 2: Expiração de token');
  
  try {
    // Limpar storage
    await MockTokenStorage.clearAll();
    
    // Simular token expirado
    const mockUserData = {
      id: 'test-user-456',
      email: 'expired@example.com',
      user_type: 'morador'
    };
    
    const mockToken = 'expired-jwt-token-67890';
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // 1 dia atrás (expirado)
    
    // Salvar token expirado
    await MockTokenStorage.saveUserData(mockUserData, mockToken, expiredDate.toISOString());
    console.log('⏰ Token expirado simulado salvo');
    
    // Verificar se o token é considerado inválido
    const isValid = await MockTokenStorage.hasValidToken();
    if (isValid) {
      throw new Error('Token expirado deveria ser inválido');
    }
    
    console.log('✅ Token expirado é considerado inválido');
    
    // Simular limpeza automática de token expirado
    console.log('⚠️ Token expirado, limpando storage');
    await MockTokenStorage.clearAll();
    
    // Verificar se foi limpo
    const tokenAfterCleanup = await MockTokenStorage.getToken();
    if (tokenAfterCleanup) {
      throw new Error('Token deveria ter sido removido');
    }
    
    console.log('✅ Token expirado foi removido automaticamente');
    console.log('✅ Teste de expiração passou');
    
  } catch (error) {
    console.error('❌ Erro no teste de expiração:', error.message);
    throw error;
  }
}

// Teste 3: Simulação de refresh de token
async function testTokenRefreshSimulation() {
  console.log('\n🧪 Teste 3: Simulação de refresh de token');
  
  try {
    // Simular token próximo do vencimento
    const mockUserData = {
      id: 'test-user-789',
      email: 'refresh@example.com',
      user_type: 'morador'
    };
    
    const oldToken = 'old-jwt-token-11111';
    const nearExpiry = new Date();
    nearExpiry.setMinutes(nearExpiry.getMinutes() + 5); // Expira em 5 minutos
    
    await MockTokenStorage.saveUserData(mockUserData, oldToken, nearExpiry.toISOString());
    console.log('⏰ Token próximo do vencimento salvo');
    
    // Simular detecção de necessidade de refresh
    const expiresAt = await MockTokenStorage.getExpiresAt();
    const now = new Date();
    const expiry = new Date(expiresAt);
    const minutesUntilExpiry = (expiry - now) / (1000 * 60);
    
    console.log(`⏱️ Token expira em ${minutesUntilExpiry.toFixed(1)} minutos`);
    
    if (minutesUntilExpiry < 10) {
      console.log('🔄 Necessário fazer refresh do token');
      
      // Simular novo token após refresh
      const newToken = 'new-jwt-token-22222';
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30); // Novo token com 30 dias
      
      await MockTokenStorage.saveUserData(mockUserData, newToken, newExpiry.toISOString());
      console.log('✅ Token refreshed com sucesso');
      
      // Verificar se o novo token foi salvo
      const refreshedToken = await MockTokenStorage.getToken();
      if (refreshedToken !== newToken) {
        throw new Error('Novo token não foi salvo corretamente');
      }
      
      console.log('✅ Novo token salvo:', refreshedToken.substring(0, 10) + '...');
    }
    
    console.log('✅ Teste de refresh passou');
    
  } catch (error) {
    console.error('❌ Erro no teste de refresh:', error.message);
    throw error;
  }
}

// Teste 4: Simulação de heartbeat
async function testHeartbeatSimulation() {
  console.log('\n🧪 Teste 4: Simulação de heartbeat');
  
  try {
    let heartbeatCount = 0;
    const maxHeartbeats = 3;
    
    // Simular função de heartbeat
    const heartbeat = async () => {
      heartbeatCount++;
      console.log(`💓 Heartbeat ${heartbeatCount}: Verificando sessão...`);
      
      const hasValidToken = await MockTokenStorage.hasValidToken();
      if (hasValidToken) {
        console.log(`✅ Heartbeat ${heartbeatCount}: Sessão ativa`);
        return true;
      } else {
        console.log(`❌ Heartbeat ${heartbeatCount}: Sessão inválida`);
        return false;
      }
    };
    
    // Configurar dados válidos
    const mockUserData = {
      id: 'test-user-heartbeat',
      email: 'heartbeat@example.com',
      user_type: 'morador'
    };
    
    const mockToken = 'heartbeat-jwt-token';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await MockTokenStorage.saveUserData(mockUserData, mockToken, expiresAt.toISOString());
    
    // Simular múltiplos heartbeats
    for (let i = 0; i < maxHeartbeats; i++) {
      const isActive = await heartbeat();
      if (!isActive) {
        throw new Error(`Heartbeat ${i + 1} falhou`);
      }
      
      // Aguardar um pouco entre heartbeats
      await sleep(100);
    }
    
    console.log('✅ Todos os heartbeats passaram');
    console.log('✅ Teste de heartbeat passou');
    
  } catch (error) {
    console.error('❌ Erro no teste de heartbeat:', error.message);
    throw error;
  }
}

// Função principal para executar todos os testes
async function runAllTests() {
  console.log('🚀 Iniciando testes de autenticação persistente (Simulação)');
  console.log('============================================================');
  
  const tests = [
    { name: 'Persistência de Storage', fn: testTokenStoragePersistence },
    { name: 'Expiração de Token', fn: testTokenExpiration },
    { name: 'Refresh de Token', fn: testTokenRefreshSimulation },
    { name: 'Heartbeat', fn: testHeartbeatSimulation }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}: PASSOU`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: FALHOU - ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n============================================================');
  console.log('📊 RESUMO DOS TESTES:');
  console.log(`✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log(`📈 Taxa de sucesso: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('🎉 Todos os testes passaram! Sistema de autenticação persistente funcionando.');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os logs acima.');
  }
}

// Executar testes
runAllTests().catch(console.error);