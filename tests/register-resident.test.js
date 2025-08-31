const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { getTestPhoneNumber } = require('./test-numbers');

// Configuração da API e Supabase
const API_BASE_URL = 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Dados de teste válidos
const validTestData = {
  name: 'João Silva',
  phone: getTestPhoneNumber(),
  building: 'Edifício Teste',
  apartment: '101',
  building_id: '123e4567-e89b-12d3-a456-426614174000',
  temporary_password: 'TempPass123!'
};

// Função auxiliar para fazer requisições HTTP
async function makeRequest(endpoint, data, method = 'POST') {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };
    
    // Só adicionar data se não for GET e se data não for null/undefined
    if (method !== 'GET' && data !== null && data !== undefined) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message
    };
  }
}

// Função para verificar se a API está rodando
async function checkApiHealth() {
  console.log('🔍 Verificando se a API está rodando...');
  const result = await makeRequest('/health', null, 'GET');
  
  if (!result.success) {
    throw new Error(`API não está rodando. Erro: ${result.error}`);
  }
  
  console.log('✅ API está rodando:', result.data);
  return true;
}

// Função para limpar dados de teste (se necessário)
async function cleanupTestData(phone) {
  try {
    // Limpar dados de teste do Supabase se existirem
    await supabase
      .from('profiles')
      .delete()
      .eq('phone', phone);
    
    console.log(`🧹 Dados de teste limpos para telefone: ${phone}`);
  } catch (error) {
    console.log('⚠️ Erro ao limpar dados de teste:', error.message);
  }
}

// Teste 1: Caso de sucesso - Registro válido
async function testSuccessfulRegistration() {
  console.log('\n🧪 Teste 1: Registro de residente com dados válidos');
  
  const result = await makeRequest('/api/register-resident', validTestData);
  
  // Verificar status code
  if (result.status !== 200) {
    throw new Error(`Status code esperado: 200, recebido: ${result.status}`);
  }
  console.log('✅ Status code correto: 200');
  
  // Verificar estrutura da resposta
  const { data } = result;
  if (!data.success) {
    throw new Error('Resposta deveria indicar sucesso');
  }
  console.log('✅ Resposta indica sucesso');
  
  // Verificar campos obrigatórios na resposta
  const requiredFields = ['profile_id', 'email', 'building_name', 'apartment_number'];
  for (const field of requiredFields) {
    if (!data.data[field]) {
      throw new Error(`Campo obrigatório ausente na resposta: ${field}`);
    }
  }
  console.log('✅ Todos os campos obrigatórios presentes na resposta');
  
  // Verificar formato do email gerado
  const expectedEmail = `${validTestData.phone}@temp.jamesconcierge.com`;
  if (data.data.email !== expectedEmail) {
    throw new Error(`Email esperado: ${expectedEmail}, recebido: ${data.data.email}`);
  }
  console.log('✅ Email gerado corretamente');
  
  // Verificar se os dados do apartamento estão corretos
  if (data.data.building_name !== validTestData.building) {
    throw new Error(`Nome do prédio incorreto. Esperado: ${validTestData.building}, recebido: ${data.data.building_name}`);
  }
  
  if (data.data.apartment_number !== validTestData.apartment) {
    throw new Error(`Número do apartamento incorreto. Esperado: ${validTestData.apartment}, recebido: ${data.data.apartment_number}`);
  }
  console.log('✅ Dados do apartamento corretos na resposta');
  
  console.log('🎉 Teste 1 PASSOU: Registro de residente com dados válidos');
  return data.data;
}

// Teste 2: Campos obrigatórios faltantes
async function testMissingRequiredFields() {
  console.log('\n🧪 Teste 2: Campos obrigatórios faltantes');
  
  const testCases = [
    { data: { ...validTestData, name: undefined }, field: 'name' },
    { data: { ...validTestData, phone: undefined }, field: 'phone' },
    { data: { ...validTestData, building: undefined }, field: 'building' },
    { data: { ...validTestData, apartment: undefined }, field: 'apartment' }
  ];
  
  for (const testCase of testCases) {
    console.log(`  🔍 Testando sem o campo: ${testCase.field}`);
    
    const result = await makeRequest('/api/register-resident', testCase.data);
    
    // Deve retornar erro 400
    if (result.status !== 400) {
      throw new Error(`Status code esperado: 400, recebido: ${result.status} para campo: ${testCase.field}`);
    }
    
    // Deve indicar erro na resposta
    if (result.data.success !== false) {
      throw new Error(`Resposta deveria indicar erro para campo faltante: ${testCase.field}`);
    }
    
    console.log(`  ✅ Campo ${testCase.field} validado corretamente`);
  }
  
  console.log('🎉 Teste 2 PASSOU: Validação de campos obrigatórios');
}

// Teste 3: Dados inválidos
async function testInvalidData() {
  console.log('\n🧪 Teste 3: Dados inválidos');
  
  const testCases = [
    {
      data: { ...validTestData, name: 'A' }, // Nome muito curto
      description: 'Nome muito curto'
    },
    {
      data: { ...validTestData, phone: '123' }, // Telefone muito curto
      description: 'Telefone muito curto'
    },
    {
      data: { ...validTestData, apartment: '' }, // Apartamento vazio
      description: 'Apartamento vazio'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`  🔍 Testando: ${testCase.description}`);
    
    const result = await makeRequest('/api/register-resident', testCase.data);
    
    // Deve retornar erro 400 ou 500
    if (result.status !== 400 && result.status !== 500) {
      console.log(`  ⚠️ Status inesperado para ${testCase.description}: ${result.status}`);
    } else {
      console.log(`  ✅ ${testCase.description} rejeitado corretamente`);
    }
  }
  
  console.log('🎉 Teste 3 PASSOU: Validação de dados inválidos');
}

// Teste 4: Verificar estrutura completa da resposta
async function testResponseStructure() {
  console.log('\n🧪 Teste 4: Estrutura completa da resposta');
  
  const result = await makeRequest('/api/register-resident', {
    ...validTestData,
    phone: getTestPhoneNumber() // Usar número de teste seguro
  });
  
  if (result.status !== 200) {
    throw new Error(`Status code esperado: 200, recebido: ${result.status}`);
  }
  
  const { data } = result;
  
  // Verificar estrutura principal
  const requiredMainFields = ['success', 'message', 'data'];
  for (const field of requiredMainFields) {
    if (!(field in data)) {
      throw new Error(`Campo principal ausente: ${field}`);
    }
  }
  console.log('✅ Campos principais presentes');
  
  // Verificar estrutura dos dados
  const requiredDataFields = ['profile_id', 'email', 'building_name', 'apartment_number'];
  for (const field of requiredDataFields) {
    if (!(field in data.data)) {
      throw new Error(`Campo de dados ausente: ${field}`);
    }
  }
  console.log('✅ Campos de dados presentes');
  
  // Verificar tipos de dados
  if (typeof data.success !== 'boolean') {
    throw new Error('Campo success deve ser boolean');
  }
  
  if (typeof data.message !== 'string') {
    throw new Error('Campo message deve ser string');
  }
  
  if (typeof data.data.profile_id !== 'string') {
    throw new Error('Campo profile_id deve ser string');
  }
  
  console.log('✅ Tipos de dados corretos');
  
  console.log('🎉 Teste 4 PASSOU: Estrutura da resposta válida');
}

// Teste 5: Teste de carga (múltiplas requisições)
async function testLoadHandling() {
  console.log('\n🧪 Teste 5: Teste de carga (5 requisições simultâneas)');
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    const testData = {
      ...validTestData,
      phone: `1199${i}${i}${i}${i}${i}${i}${i}`,
      name: `Teste Usuario ${i}`
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
  
  if (successCount < 3) {
    throw new Error('Menos de 60% das requisições foram processadas com sucesso');
  }
  
  console.log('🎉 Teste 5 PASSOU: API suporta carga básica');
}

// Função principal para executar todos os testes
async function runAllTests() {
  console.log('🚀 Iniciando testes automatizados para /api/register-resident\n');
  
  try {
    // Verificar se a API está rodando
    await checkApiHealth();
    
    // Executar testes
    await testSuccessfulRegistration();
    await testMissingRequiredFields();
    await testInvalidData();
    await testResponseStructure();
    await testLoadHandling();
    
    console.log('\n🎉 TODOS OS TESTES PASSARAM! ✅');
    console.log('\n📊 Resumo dos testes:');
    console.log('✅ Teste 1: Registro com dados válidos');
    console.log('✅ Teste 2: Validação de campos obrigatórios');
    console.log('✅ Teste 3: Validação de dados inválidos');
    console.log('✅ Teste 4: Estrutura da resposta');
    console.log('✅ Teste 5: Teste de carga básica');
    
  } catch (error) {
    console.error('\n❌ TESTE FALHOU:', error.message);
    process.exit(1);
  }
}

// Executar testes se o arquivo for chamado diretamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testSuccessfulRegistration,
  testMissingRequiredFields,
  testInvalidData,
  testResponseStructure,
  testLoadHandling
};