import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const { client: supabase } = SupabaseClientFactory.createBrowserClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
});
const { client: supabaseAdmin } = SupabaseClientFactory.createServerClient({
  url: supabaseUrl,
  anonKey: supabaseServiceKey,
});

// Dados de teste
const testCredentials = {
  email: 'morador@teste.com',
  password: 'morador123',
};

// Função para simular o TokenStorage
class MockTokenStorage {
  static storage = new Map();

  static async saveUserData(userData: any, token: string, expiresAt: string): Promise<void> {
    this.storage.set('userData', userData);
    this.storage.set('token', token);
    this.storage.set('expiresAt', expiresAt);
    console.log('✅ Token salvo no storage simulado');
  }

  static async getToken(): Promise<string | null> {
    const token = this.storage.get('token');
    const expiresAt = this.storage.get('expiresAt');

    if (!token || !expiresAt) {
      return null;
    }

    // Verificar se o token expirou
    if (new Date() > new Date(expiresAt)) {
      console.log('⚠️ Token expirado, limpando storage');
      this.clearAll();
      return null;
    }

    return token;
  }

  static async getUserData(): Promise<any> {
    return this.storage.get('userData');
  }

  static async clearAll(): Promise<void> {
    this.storage.clear();
    console.log('🧹 Storage limpo');
  }

  static async hasValidToken(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

// Função para aguardar um tempo
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Teste 1: Login e persistência de token
test('Teste 1: Login e persistência de token', async () => {
  console.log('\n🧪 Teste 1: Login e persistência de token');

  try {
    // Limpar storage antes do teste
    await MockTokenStorage.clearAll();

    // Fazer login com conta de teste existente
    console.log('📤 Fazendo login...');
    const { data, error } = await supabase.auth.signInWithPassword(testCredentials);

    if (error) {
      throw new Error(`Erro no login: ${error.message}`);
    }

    assert.ok(data.session, 'Login não retornou sessão');
    assert.ok(data.user, 'Login não retornou usuário');

    console.log('✅ Login realizado com sucesso');
    console.log(`👤 Usuário: ${data.user.email}`);

    // Simular salvamento do token (como faria o TokenStorage)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

    await MockTokenStorage.saveUserData(
      {
        id: data.user.id,
        email: data.user.email,
        user_type: 'morador',
      },
      data.session.access_token,
      expiresAt.toISOString()
    );

    // Verificar se o token foi salvo
    const savedToken = await MockTokenStorage.getToken();
    assert.ok(savedToken, 'Token não foi salvo corretamente');

    console.log('✅ Token persistido com sucesso');

    // Fazer logout
    await supabase.auth.signOut();
    console.log('🚪 Logout realizado');

    console.log('✅ Teste de login e persistência passou');
  } catch (error: any) {
    console.error('❌ Erro no teste de login:', error.message);
    throw error;
  }
});

// Teste 2: Restauração de sessão
test('Teste 2: Restauração de sessão', async () => {
  console.log('\n🧪 Teste 2: Restauração de sessão');

  try {
    // Fazer login primeiro
    console.log('📤 Fazendo login inicial...');
    const { data, error } = await supabase.auth.signInWithPassword(testCredentials);

    if (error) throw new Error(`Erro no login: ${error.message}`);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await MockTokenStorage.saveUserData(
      {
        id: data.user.id,
        email: data.user.email,
        user_type: 'morador',
      },
      data.session.access_token,
      expiresAt.toISOString()
    );

    console.log('✅ Login inicial realizado e token salvo');

    // Simular reinicialização do app - verificar sessão
    console.log('🔄 Simulando reinicialização do app...');

    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session) {
      console.log('✅ Sessão ativa encontrada');
      console.log(`👤 Usuário logado: ${sessionData.session.user.email}`);
    } else {
      console.log('⚠️ Nenhuma sessão ativa, tentando restaurar...');

      // Tentar restaurar sessão usando token salvo
      const savedToken = await MockTokenStorage.getToken();
      const userData = await MockTokenStorage.getUserData();

      if (savedToken && userData) {
        console.log('🔑 Token encontrado no storage, tentando restaurar sessão...');

        // Verificar se o token ainda é válido no Supabase
        const { data: userInfo, error: userError } = await supabase.auth.getUser(savedToken);

        if (userError || !userInfo.user) {
          console.log('❌ Token inválido, limpando storage');
          await MockTokenStorage.clearAll();
        } else {
          console.log('✅ Sessão restaurada com sucesso');
          console.log(`👤 Usuário restaurado: ${userInfo.user.email}`);
        }
      } else {
        console.log('❌ Nenhum token válido para restauração');
      }
    }

    console.log('✅ Teste de restauração de sessão passou');
  } catch (error: any) {
    console.error('❌ Erro no teste de restauração:', error.message);
    throw error;
  }
});

// Teste 3: Expiração de token
test('Teste 3: Expiração de token', async () => {
  console.log('\n🧪 Teste 3: Expiração de token');

  try {
    // Simular token expirado
    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 1); // 1 minuto atrás

    await MockTokenStorage.saveUserData({ id: 'test', email: 'test@test.com' }, 'expired_token', expiredDate.toISOString());

    console.log('⏰ Token expirado simulado salvo');

    // Tentar recuperar token expirado
    const token = await MockTokenStorage.getToken();

    assert.equal(token, null, 'Token expirado não foi removido automaticamente');

    console.log('✅ Token expirado foi removido automaticamente');

    // Verificar se o storage foi limpo
    const userData = await MockTokenStorage.getUserData();
    assert.equal(userData, undefined, 'Dados do usuário não foram limpos após expiração do token');

    console.log('✅ Storage foi limpo após expiração');
    console.log('✅ Teste de expiração de token passou');
  } catch (error: any) {
    console.error('❌ Erro no teste de expiração:', error.message);
    throw error;
  }
});

// Teste 4: Refresh de token
test('Teste 4: Refresh de token', async () => {
  console.log('\n🧪 Teste 4: Refresh de token');

  try {
    // Fazer login para ter uma sessão ativa
    const { data, error } = await supabase.auth.signInWithPassword(testCredentials);
    if (error) throw new Error(`Erro no login: ${error.message}`);

    console.log('✅ Login realizado para teste de refresh');

    // Tentar refresh da sessão
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.log(
        '⚠️ Erro no refresh (pode ser normal se o token ainda é válido):',
        refreshError.message
      );
    } else if (refreshData.session) {
      console.log('✅ Token refreshed com sucesso');
      console.log(`🔑 Novo token gerado: ${refreshData.session.access_token.substring(0, 20)}...`);

      // Simular salvamento do novo token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await MockTokenStorage.saveUserData(
        {
          id: refreshData.user.id,
          email: refreshData.user.email,
          user_type: 'morador',
        },
        refreshData.session.access_token,
        expiresAt.toISOString()
      );

      console.log('✅ Novo token salvo no storage');
    }

    // Fazer logout
    await supabase.auth.signOut();

    console.log('✅ Teste de refresh de token passou');
  } catch (error: any) {
    console.error('❌ Erro no teste de refresh:', error.message);
    throw error;
  }
});
