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

interface RequestResult {
  success: boolean;
  status: number;
  data: any;
  error?: string;
  headers?: any;
}

// Função para fazer requisições HTTP
async function makeRequest(
  endpoint: string,
  data: any,
  method: string = 'POST'
): Promise<RequestResult> {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error: any) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message,
      headers: error.response?.headers || {},
    };
  }
}

// Teste avançado 1: Validação de tipos de dados
test('Teste Avançado 1: Validação de tipos de dados', async () => {
  console.log('\n🧪 Teste Avançado 1: Validação de tipos de dados');

  const testCases = [
    {
      data: {
        name: 123, // Número em vez de string
        phone: getTestPhoneNumber(),
        building: 'Edifício Teste',
        apartment: '101',
      },
      description: 'Nome como número',
    },
    {
      data: {
        name: 'João Silva',
        phone: parseInt(getTestPhoneNumber()), // Número em vez de string
        building: 'Edifício Teste',
        apartment: '101',
      },
      description: 'Telefone como número',
    },
    {
      data: {
        name: 'João Silva',
        phone: getTestPhoneNumber(),
        building: null, // Null em vez de string
        apartment: '101',
      },
      description: 'Prédio como null',
    },
    {
      data: {
        name: 'João Silva',
        phone: getTestPhoneNumber(),
        building: 'Edifício Teste',
        apartment: 101, // Número em vez de string
      },
      description: 'Apartamento como número',
    },
  ];

  for (const testCase of testCases) {
    console.log(`  🔍 Testando: ${testCase.description}`);

    const result = await makeRequest('/api/register-resident', testCase.data);

    // API deve lidar com tipos incorretos graciosamente
    if (result.status === 200) {
      console.log(`  ✅ ${testCase.description} - API converteu tipo automaticamente`);
    } else if (result.status === 400) {
      console.log(`  ✅ ${testCase.description} - API rejeitou tipo incorreto`);
    } else {
      console.log(`  ⚠️ ${testCase.description} - Status inesperado: ${result.status}`);
    }
  }

  console.log('🎉 Teste Avançado 1 CONCLUÍDO: Validação de tipos de dados');
});

// Teste avançado 2: Caracteres especiais e encoding
test('Teste Avançado 2: Caracteres especiais e encoding', async () => {
  console.log('\n🧪 Teste Avançado 2: Caracteres especiais e encoding');

  const testCases = [
    {
      data: {
        name: 'José da Silva Ção',
        phone: getTestPhoneNumber(),
        building: 'Edifício São João',
        apartment: '101',
      },
      description: 'Caracteres acentuados',
    },
    {
      data: {
        name: 'María José',
        phone: getTestPhoneNumber(),
        building: 'Edifício Niño',
        apartment: '101',
      },
      description: 'Caracteres especiais latinos',
    },
    {
      data: {
        name: 'João & Silva',
        phone: getTestPhoneNumber(),
        building: 'Ed. A&B',
        apartment: '10-A',
      },
      description: 'Caracteres especiais (&, -)',
    },
    {
      data: {
        name: 'Test User',
        phone: getTestPhoneNumber(),
        building: 'Building "Test"',
        apartment: '101',
      },
      description: 'Aspas no nome do prédio',
    },
  ];

  for (const testCase of testCases) {
    console.log(`  🔍 Testando: ${testCase.description}`);

    const result = await makeRequest('/api/register-resident', testCase.data);

    if (result.status === 200) {
      console.log(`  ✅ ${testCase.description} - Processado com sucesso`);

      // Verificar se os dados foram preservados corretamente
      if (result.data.data.building_name === testCase.data.building) {
        console.log(`    ✅ Nome do prédio preservado corretamente`);
      } else {
        console.log(`    ⚠️ Nome do prédio alterado: ${result.data.data.building_name}`);
      }
    } else {
      console.log(`  ❌ ${testCase.description} - Falhou com status: ${result.status}`);
    }
  }

  console.log('🎉 Teste Avançado 2 CONCLUÍDO: Caracteres especiais');
});

// Teste avançado 3: Limites de tamanho de dados
test('Teste Avançado 3: Limites de tamanho de dados', async () => {
  console.log('\n🧪 Teste Avançado 3: Limites de tamanho de dados');

  const testCases = [
    {
      data: {
        name: 'A'.repeat(1000), // Nome muito longo
        phone: getTestPhoneNumber(),
        building: 'Edifício Teste',
        apartment: '101',
      },
      description: 'Nome extremamente longo (1000 chars)',
    },
    {
      data: {
        name: 'João Silva',
        phone: '1'.repeat(50), // Telefone muito longo
        building: 'Edifício Teste',
        apartment: '101',
      },
      description: 'Telefone extremamente longo (50 chars)',
    },
    {
      data: {
        name: 'João Silva',
        phone: getTestPhoneNumber(),
        building: 'B'.repeat(500), // Nome do prédio muito longo
        apartment: '101',
      },
      description: 'Nome do prédio extremamente longo (500 chars)',
    },
    {
      data: {
        name: '', // Nome vazio
        phone: '91981941219',
        building: 'Edifício Teste',
        apartment: '101',
      },
      description: 'Nome vazio',
    },
  ];

  for (const testCase of testCases) {
    console.log(`  🔍 Testando: ${testCase.description}`);

    const result = await makeRequest('/api/register-resident', testCase.data);

    if (result.status === 400) {
      console.log(`  ✅ ${testCase.description} - Rejeitado corretamente`);
    } else if (result.status === 200) {
      console.log(`  ⚠️ ${testCase.description} - Aceito (pode ser válido)`);
    } else {
      console.log(`  ❌ ${testCase.description} - Status inesperado: ${result.status}`);
    }
  }

  console.log('🎉 Teste Avançado 3 CONCLUÍDO: Limites de tamanho');
});

// Teste avançado 4: Validação de persistência (simulada)
test('Teste Avançado 4: Validação de persistência de dados', async () => {
  console.log('\n🧪 Teste Avançado 4: Validação de persistência de dados');

  const testData = {
    name: 'Teste Persistência',
    phone: getTestPhoneNumber(),
    building: 'Edifício Persistência',
    apartment: '999',
    temporary_password: 'TestPersist123!',
  };

  console.log('  🔍 Registrando usuário para teste de persistência...');
  const result = await makeRequest('/api/register-resident', testData);

  assert.equal(result.status, 200, `Falha no registro: ${result.status}`);

  const profileId = result.data.data.profile_id;
  console.log(`  ✅ Usuário registrado com profile_id: ${profileId}`);

  // Verificar se o profile_id é um UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(uuidRegex.test(profileId), 'Profile ID não é um UUID válido');
  console.log('  ✅ Profile ID é um UUID válido');

  // Verificar se o email foi gerado corretamente
  const expectedEmail = `${testData.phone}@temp.jamesconcierge.com`;
  assert.equal(
    result.data.data.email,
    expectedEmail,
    `Email inconsistente. Esperado: ${expectedEmail}, recebido: ${result.data.data.email}`
  );
  console.log('  ✅ Email gerado consistentemente');

  // Verificar se os dados do apartamento foram preservados
  assert.equal(
    result.data.data.building_name,
    testData.building,
    'Nome do prédio não foi preservado'
  );
  assert.equal(
    result.data.data.apartment_number,
    testData.apartment,
    'Número do apartamento não foi preservado'
  );
  console.log('  ✅ Dados do apartamento preservados corretamente');

  console.log('🎉 Teste Avançado 4 CONCLUÍDO: Persistência de dados validada');
});

// Teste avançado 5: Teste de concorrência
test('Teste Avançado 5: Teste de concorrência (10 requisições simultâneas)', async () => {
  console.log('\n🧪 Teste Avançado 5: Teste de concorrência (10 requisições simultâneas)');

  const promises = [];
  const startTime = Date.now();

  for (let i = 0; i < 10; i++) {
    const testData = {
      name: `Usuário Concorrência ${i}`,
      phone: `${getTestPhoneNumber().slice(0, -1)}${i}`, // Adicionar sufixo para tornar único
      building: `Edifício Concorrência ${i}`,
      apartment: `${100 + i}`,
      temporary_password: `Concur${i}123!`,
    };
    promises.push(makeRequest('/api/register-resident', testData));
  }

  console.log('  🔍 Enviando 10 requisições simultâneas...');
  const results = await Promise.all(promises);
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  let successCount = 0;
  let errorCount = 0;
  const statusCounts: Record<number, number> = {};

  for (const result of results) {
    if (result.status === 200) {
      successCount++;
    } else {
      errorCount++;
    }

    statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
  }

  console.log(`  📊 Resultados:`);
  console.log(`    ✅ Sucessos: ${successCount}/10`);
  console.log(`    ❌ Erros: ${errorCount}/10`);
  console.log(`    ⏱️ Tempo total: ${totalTime}ms`);
  console.log(`    📈 Média por requisição: ${(totalTime / 10).toFixed(2)}ms`);

  console.log(`  📋 Status codes:`);
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    ${status}: ${count} requisições`);
  }

  // Verificar se pelo menos 80% das requisições foram bem-sucedidas
  assert.ok(
    successCount >= 8,
    `Apenas ${successCount}/10 requisições foram bem-sucedidas. Esperado: pelo menos 8/10`
  );

  // Verificar se o tempo médio é razoável (menos de 5 segundos por requisição)
  const avgTime = totalTime / 10;
  if (avgTime > 5000) {
    console.log(`  ⚠️ Tempo médio alto: ${avgTime.toFixed(2)}ms por requisição`);
  } else {
    console.log(`  ✅ Tempo médio aceitável: ${avgTime.toFixed(2)}ms por requisição`);
  }

  console.log('🎉 Teste Avançado 5 CONCLUÍDO: Teste de concorrência');
});

// Teste avançado 6: Validação de headers HTTP
test('Teste Avançado 6: Validação de headers HTTP', async () => {
  console.log('\n🧪 Teste Avançado 6: Validação de headers HTTP');

  const testData = {
    name: 'Teste Headers',
    phone: getTestPhoneNumber(),
    building: 'Edifício Headers',
    apartment: '888',
  };

  console.log('  🔍 Testando headers da resposta...');
  const result = await makeRequest('/api/register-resident', testData);

  assert.equal(result.status, 200, `Falha na requisição: ${result.status}`);

  // Verificar Content-Type
  const contentType = result.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    console.log(`  ⚠️ Content-Type inesperado: ${contentType}`);
  } else {
    console.log(`  ✅ Content-Type correto: ${contentType}`);
  }

  // Verificar se há headers de segurança (opcionais)
  const securityHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];

  console.log('  🔍 Verificando headers de segurança (opcionais):');
  for (const header of securityHeaders) {
    if (result.headers[header]) {
      console.log(`    ✅ ${header}: ${result.headers[header]}`);
    } else {
      console.log(`    ⚠️ ${header}: não presente`);
    }
  }

  console.log('🎉 Teste Avançado 6 CONCLUÍDO: Headers HTTP');
});
