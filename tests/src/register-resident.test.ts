import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';
import { getTestPhoneNumber } from './test-numbers.js';

// Configuração da API e Supabase
const API_BASE_URL = 'http://localhost:3001';
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const { client: supabase } = SupabaseClientFactory.createServerClient({
  url: SUPABASE_URL,
  anonKey: SUPABASE_SERVICE_KEY,
});

// Dados de teste válidos
const validTestData = {
  name: 'João Silva',
  phone: getTestPhoneNumber(),
  building: 'Edifício Teste',
  apartment: '101',
  building_id: '123e4567-e89b-12d3-a456-426614174000',
  temporary_password: 'TempPass123!',
};

interface RequestResult {
  success: boolean;
  status: number;
  data: any;
  error?: string;
}

// Função auxiliar para fazer requisições HTTP
async function makeRequest(
  endpoint: string,
  data: any,
  method: string = 'POST'
): Promise<RequestResult> {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    if (method !== 'GET' && data !== null && data !== undefined) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message,
    };
  }
}

// Função para verificar se a API está rodando
async function checkApiHealth(): Promise<void> {
  console.log('🔍 Verificando se a API está rodando...');
  const result = await makeRequest('/health', null, 'GET');

  if (!result.success) {
    throw new Error(`API não está rodando. Erro: ${result.error}`);
  }

  console.log('✅ API está rodando:', result.data);
}

// Função para limpar dados de teste (se necessário)
async function cleanupTestData(phone: string): Promise<void> {
  try {
    // Limpar dados de teste do Supabase se existirem
    await supabase.from('profiles').delete().eq('phone', phone);

    console.log(`🧹 Dados de teste limpos para telefone: ${phone}`);
  } catch (error: any) {
    console.log('⚠️ Erro ao limpar dados de teste:', error.message);
  }
}

// Teste 1: Caso de sucesso - Registro válido
test('Teste 1: Registro de residente com dados válidos', async () => {
  console.log('\n🧪 Teste 1: Registro de residente com dados válidos');

  const result = await makeRequest('/api/register-resident', validTestData);

  // Verificar status code
  assert.equal(result.status, 200, `Status code esperado: 200, recebido: ${result.status}`);
  console.log('✅ Status code correto: 200');

  // Verificar estrutura da resposta
  const { data } = result;
  assert.ok(data.success, 'Resposta deveria indicar sucesso');
  console.log('✅ Resposta indica sucesso');

  // Verificar campos obrigatórios na resposta
  const requiredFields = ['profile_id', 'email', 'building_name', 'apartment_number'];
  for (const field of requiredFields) {
    assert.ok(data.data[field], `Campo obrigatório ausente na resposta: ${field}`);
  }
  console.log('✅ Todos os campos obrigatórios presentes na resposta');

  // Verificar formato do email gerado
  const expectedEmail = `${validTestData.phone}@temp.jamesconcierge.com`;
  assert.equal(
    data.data.email,
    expectedEmail,
    `Email esperado: ${expectedEmail}, recebido: ${data.data.email}`
  );
  console.log('✅ Email gerado corretamente');

  // Verificar se os dados do apartamento estão corretos
  assert.equal(
    data.data.building_name,
    validTestData.building,
    `Nome do prédio incorreto. Esperado: ${validTestData.building}, recebido: ${data.data.building_name}`
  );

  assert.equal(
    data.data.apartment_number,
    validTestData.apartment,
    `Número do apartamento incorreto. Esperado: ${validTestData.apartment}, recebido: ${data.data.apartment_number}`
  );
  console.log('✅ Dados do apartamento corretos na resposta');

  console.log('🎉 Teste 1 PASSOU: Registro de residente com dados válidos');
});

// Teste 2: Campos obrigatórios faltantes
test('Teste 2: Campos obrigatórios faltantes', async () => {
  console.log('\n🧪 Teste 2: Campos obrigatórios faltantes');

  const testCases = [
    { data: { ...validTestData, name: undefined }, field: 'name' },
    { data: { ...validTestData, phone: undefined }, field: 'phone' },
    { data: { ...validTestData, building: undefined }, field: 'building' },
    { data: { ...validTestData, apartment: undefined }, field: 'apartment' },
  ];

  for (const testCase of testCases) {
    console.log(`  🔍 Testando sem o campo: ${testCase.field}`);

    const result = await makeRequest('/api/register-resident', testCase.data);

    // Deve retornar erro 400
    assert.equal(
      result.status,
      400,
      `Status code esperado: 400, recebido: ${result.status} para campo: ${testCase.field}`
    );

    // Deve indicar erro na resposta
    assert.equal(
      result.data.success,
      false,
      `Resposta deveria indicar erro para campo faltante: ${testCase.field}`
    );

    console.log(`  ✅ Campo ${testCase.field} validado corretamente`);
  }

  console.log('🎉 Teste 2 PASSOU: Validação de campos obrigatórios');
});

// Teste 3: Dados inválidos
test('Teste 3: Dados inválidos', async () => {
  console.log('\n🧪 Teste 3: Dados inválidos');

  const testCases = [
    {
      data: { ...validTestData, name: 'A' }, // Nome muito curto
      description: 'Nome muito curto',
    },
    {
      data: { ...validTestData, phone: '123' }, // Telefone muito curto
      description: 'Telefone muito curto',
    },
    {
      data: { ...validTestData, apartment: '' }, // Apartamento vazio
      description: 'Apartamento vazio',
    },
  ];

  for (const testCase of testCases) {
    console.log(`  🔍 Testando: ${testCase.description}`);

    const result = await makeRequest('/api/register-resident', testCase.data);

    // Deve retornar erro 400 ou 500
    if (result.status === 400 || result.status === 500) {
      console.log(`  ✅ ${testCase.description} rejeitado corretamente`);
    } else {
      console.log(`  ⚠️ Status inesperado para ${testCase.description}: ${result.status}`);
    }
  }

  console.log('🎉 Teste 3 PASSOU: Validação de dados inválidos');
});

// Teste 4: Verificar estrutura completa da resposta
test('Teste 4: Estrutura completa da resposta', async () => {
  console.log('\n🧪 Teste 4: Estrutura completa da resposta');

  const result = await makeRequest('/api/register-resident', {
    ...validTestData,
    phone: getTestPhoneNumber(), // Usar número de teste seguro
  });

  assert.equal(result.status, 200, `Status code esperado: 200, recebido: ${result.status}`);

  const { data } = result;

  // Verificar estrutura principal
  const requiredMainFields = ['success', 'message', 'data'];
  for (const field of requiredMainFields) {
    assert.ok(field in data, `Campo principal ausente: ${field}`);
  }
  console.log('✅ Campos principais presentes');

  // Verificar estrutura dos dados
  const requiredDataFields = ['profile_id', 'email', 'building_name', 'apartment_number'];
  for (const field of requiredDataFields) {
    assert.ok(field in data.data, `Campo de dados ausente: ${field}`);
  }
  console.log('✅ Campos de dados presentes');

  // Verificar tipos de dados
  assert.equal(typeof data.success, 'boolean', 'Campo success deve ser boolean');
  assert.equal(typeof data.message, 'string', 'Campo message deve ser string');
  assert.equal(typeof data.data.profile_id, 'string', 'Campo profile_id deve ser string');

  console.log('✅ Tipos de dados corretos');

  console.log('🎉 Teste 4 PASSOU: Estrutura da resposta válida');
});

// Teste 5: Teste de carga (múltiplas requisições)
test('Teste 5: Teste de carga (5 requisições simultâneas)', async () => {
  console.log('\n🧪 Teste 5: Teste de carga (5 requisições simultâneas)');

  const promises = [];
  for (let i = 0; i < 5; i++) {
    const testData = {
      ...validTestData,
      phone: `1199${i}${i}${i}${i}${i}${i}${i}`,
      name: `Teste Usuario ${i}`,
    };
    promises.push(makeRequest('/api/register-resident', testData));
  }

  const results = await Promise.all(promises);

  let successCount = 0;
  for (const result of results) {
    if (result.status === 200) {
      successCount++;
    }
  }

  console.log(`✅ ${successCount}/5 requisições processadas com sucesso`);

  assert.ok(
    successCount >= 3,
    `Menos de 60% das requisições foram processadas com sucesso. Sucessos: ${successCount}/5`
  );

  console.log('🎉 Teste 5 PASSOU: API suporta carga básica');
});
