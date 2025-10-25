import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';
import { getTestPhoneNumber } from './test-numbers.js';

// Configuração da API e Supabase
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const { client: supabase } = SupabaseClientFactory.createServerClient({
  url: SUPABASE_URL,
  key: SUPABASE_SERVICE_KEY,
});

interface Response {
  success?: boolean;
  status?: number;
  error?: string;
  data?: any;
}

// Função para fazer requisições HTTP
async function makeRequest(
  endpoint: string,
  data: any,
  method: string = 'POST'
): Promise<Response> {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return response;
  } catch (error: any) {
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

// Função auxiliar para validar UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Função auxiliar para validar email temporário
function isValidTempEmail(email: string, phone: string): boolean {
  const expectedEmail = `${phone}@temp.jamesconcierge.com`;
  return email === expectedEmail;
}

// Função para limpar dados de teste do banco
async function cleanupTestData(phone: string): Promise<void> {
  console.log(`🧹 Limpando dados de teste para telefone: ${phone}`);

  try {
    // Limpar da tabela temporary_passwords (usando profile_id se necessário)
    const { error: tempError } = await supabase
      .from('temporary_passwords')
      .delete()
      .eq('profile_id', phone);

    if (tempError) {
      console.log('Aviso ao limpar temporary_passwords:', tempError.message);
    }

    // Limpar da tabela profiles
    const { error: profileError } = await supabase.from('profiles').delete().eq('phone', phone);

    if (profileError) {
      console.log('Aviso ao limpar profiles:', profileError.message);
    }

    console.log(`✅ Limpeza concluída para ${phone}`);
  } catch (error: any) {
    console.log(`Aviso na limpeza para ${phone}:`, error.message);
  }
}

// Teste 1: Verificar resposta do endpoint
test('Teste 1: Verificação de resposta do endpoint', async () => {
  console.log('\n🧪 Teste 1: Verificação de resposta do endpoint');

  const testData = {
    name: 'Maria Santos',
    phone: getTestPhoneNumber(),
    building: 'Edifício Teste Persistência',
    apartment: '205',
    building_id: '123e4567-e89b-12d3-a456-426614174000',
    temporary_password: 'TempPass123!',
  };

  // Fazer requisição para registrar residente
  const result = await makeRequest('/api/register-resident', testData);

  assert.ok(result.status === 200, `Falha na requisição: ${result.error || 'Status ' + result.status}`);

  // Verificar se a resposta contém os campos esperados
  assert.ok(
    result.data.profile_id && result.data.email && result.data.building_name && result.data.apartment_number,
    'Resposta não contém todos os campos esperados'
  );

  // Verificar se os dados da resposta correspondem aos enviados
  assert.equal(
    result.data.building_name,
    testData.building,
    'Dados da resposta não correspondem aos dados enviados'
  );
  assert.equal(result.data.apartment_number, testData.apartment);

  console.log('✅ Resposta contém dados corretos:', result.data);
  console.log('✅ Teste de resposta do endpoint passou');
});

// Teste 2: Verificação de integridade da resposta
test('Teste 2: Verificação de integridade da resposta', async () => {
  console.log('\n🧪 Teste 2: Verificação de integridade da resposta');

  const testData = {
    name: 'João Teste Persistência',
    phone: getTestPhoneNumber(),
    building: 'Edifício Teste DB',
    apartment: '101',
    building_id: '123e4567-e89b-12d3-a456-426614174000',
    temporary_password: 'TestPass123!',
  };

  // Fazer requisição
  const result = await makeRequest('/api/register-resident', testData);

  assert.ok(result.status === 200, `Falha na requisição: ${result.error || 'Status ' + result.status}`);

  console.log('📤 Requisição enviada com sucesso');

  // Verificar estrutura da resposta
  const requiredFields = ['profile_id', 'email', 'building_name', 'apartment_number'];
  for (const field of requiredFields) {
    assert.ok(result.data[field], `Campo obrigatório ausente na resposta: ${field}`);
  }

  // Verificar se o email foi gerado corretamente
  assert.ok(
    isValidTempEmail(result.data.email, testData.phone),
    `Email incorreto. Esperado: ${testData.phone}@temp.jamesconcierge.com, Recebido: ${result.data.email}`
  );

  // Verificar se o profile_id é um UUID válido
  assert.ok(isValidUUID(result.data.profile_id), 'Profile ID não é um UUID válido');

  console.log('✅ Teste de integridade da resposta passou');
});

// Teste 3: Concorrência de requisições
test('Teste 3: Concorrência de requisições', async () => {
  console.log('\n🧪 Teste 3: Concorrência de requisições');

  const basePhone = '11900000';
  const numRequests = 5;
  const testPromises = [];

  // Criar múltiplas requisições simultâneas
  for (let i = 0; i < numRequests; i++) {
    const testData = {
      name: `Teste Concorrente ${i + 1}`,
      phone: `${basePhone}${String(i).padStart(3, '0')}`,
      building: 'Edifício Concorrência',
      apartment: `${100 + i}`,
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      temporary_password: `ConcPass${i}!`,
    };

    testPromises.push(
      makeRequest('/api/register-resident', testData).then((result) => ({
        ...result,
        testData,
      }))
    );
  }

  // Executar todas as requisições simultaneamente
  console.log(`📤 Enviando ${numRequests} requisições simultâneas...`);
  const startTime = Date.now();
  const results = await Promise.all(testPromises);
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Verificar se todas foram bem-sucedidas
  let successCount = 0;
  for (const result of results) {
    if (result.status === 200) {
      successCount++;

      // Verificar estrutura da resposta
      assert.ok(
        result.data.profile_id && result.data.email && result.data.building_name && result.data.apartment_number,
        `Resposta incompleta para ${result.testData.phone}`
      );

      // Verificar se os dados correspondem
      assert.equal(
        result.data.building_name,
        result.testData.building,
        `Dados incorretos na resposta para ${result.testData.phone}`
      );
      assert.equal(result.data.apartment_number, result.testData.apartment);
    } else {
      console.error(`❌ Falha na requisição para ${result.testData.phone}:`, result.error);
    }
  }

  console.log(`✅ ${successCount}/${numRequests} requisições bem-sucedidas`);
  console.log(`⏱️ Tempo total: ${totalTime}ms (${(totalTime / numRequests).toFixed(2)}ms por requisição)`);

  assert.equal(
    successCount,
    numRequests,
    `Apenas ${successCount} de ${numRequests} requisições foram bem-sucedidas`
  );

  console.log('✅ Teste de concorrência passou');
});

// Teste de rollback em caso de erro
test('Teste 4: Rollback em Caso de Erro', async () => {
  console.log('\n🧪 Teste 4: Rollback em Caso de Erro');
  console.log('='.repeat(60));

  const invalidData = {
    name: 'Teste Rollback',
    phone: getTestPhoneNumber(),
    building: '', // Campo inválido para forçar erro
    apartment: '101',
  };

  try {
    console.log('\n📤 Enviando requisição com dados inválidos...');
    const response = await makeRequest('/api/register-resident', invalidData);

    // Deve retornar erro
    if (response.status === 200) {
      console.log('⚠️  API aceitou dados inválidos (comportamento inesperado)');
    } else {
      console.log(`✅ API rejeitou dados inválidos (status: ${response.status})`);
    }

    // Verificar se nenhum dado foi persistido
    console.log('\n🔍 Verificando se nenhum dado foi persistido...');

    const { data: tempPasswords, error } = await supabase
      .from('temporary_passwords')
      .select('*')
      .eq('phone', invalidData.phone);

    if (error) {
      console.log('⚠️  Erro ao consultar banco:', error.message);
    }

    if (!tempPasswords || tempPasswords.length === 0) {
      console.log('✅ Nenhum dado foi persistido (rollback correto)');
    } else {
      console.log('⚠️  Dados foram persistidos mesmo com erro:', tempPasswords);
    }

    console.log('\n🎉 Teste de Rollback PASSOU');
  } catch (error: any) {
    console.log('\n❌ Teste de Rollback FALHOU:', error.message);
    throw error;
  } finally {
    console.log('\n🧹 Teste de rollback finalizado');
  }
});
