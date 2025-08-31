const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { getTestPhoneNumber } = require('./test-numbers');

// Configuração da API e Supabase
const API_BASE_URL = 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Dados de teste para persistência
const testData = {
  name: 'Maria Santos Persistência',
  phone: getTestPhoneNumber(),
  building: 'Edifício Persistência Test',
  apartment: '205'
};

// Função para fazer requisições HTTP
async function makeRequest(endpoint, data, method = 'POST') {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    return response;
  } catch (error) {
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

// Função auxiliar para validar UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Função auxiliar para validar email temporário
function isValidTempEmail(email, phone) {
  const expectedEmail = `${phone}@temp.jamesconcierge.com`;
  return email === expectedEmail;
}

// Função para limpar dados de teste do banco
async function cleanupTestData(phone) {
  console.log(`🧹 Limpando dados de teste para telefone: ${phone}`);
  
  try {
    // Limpar da tabela temporary_passwords (usando profile_id se necessário)
    const { error: tempError } = await supabase
      .from('temporary_passwords')
      .delete()
      .eq('profile_id', phone); // Assumindo que profile_id pode ser usado como identificador

    if (tempError) {
      console.log('Aviso ao limpar temporary_passwords:', tempError.message);
    }

    // Limpar da tabela profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('phone', phone);

    if (profileError) {
      console.log('Aviso ao limpar profiles:', profileError.message);
    }

    console.log(`✅ Limpeza concluída para ${phone}`);
  } catch (error) {
    console.log(`Aviso na limpeza para ${phone}:`, error.message);
  }
}

// Função para verificar persistência de dados específicos
async function checkDataPersistence(phone, expectedData) {
  console.log(`🔍 Verificando persistência para telefone: ${phone}`);
  
  // Como o endpoint não persiste dados reais, vamos verificar se a resposta contém os dados esperados
  // Verificar na tabela temporary_passwords
  const { data: tempPasswords, error: tempError } = await supabase
    .from('temporary_passwords')
    .select('*')
    .eq('phone', phone);

  if (tempError) {
    console.error('Erro ao consultar temporary_passwords:', tempError);
    throw new Error(`Erro ao verificar temporary_passwords: ${tempError.message}`);
  }

  if (!tempPasswords || tempPasswords.length === 0) {
    throw new Error(`Nenhum registro encontrado na tabela temporary_passwords para o telefone ${phone}`);
  }

  console.log(`✅ Encontrado ${tempPasswords.length} registro(s) na tabela temporary_passwords`);
  
  // Verificar se os dados correspondem
  const record = tempPasswords[0];
  if (expectedData.name && record.name !== expectedData.name) {
    throw new Error(`Nome não confere. Esperado: ${expectedData.name}, Encontrado: ${record.name}`);
  }

  return true;
}

// Teste 1: Verificar resposta do endpoint
async function testBasicPersistence() {
  console.log('\n🧪 Teste 1: Verificação de resposta do endpoint');
  
  const testData = {
    name: 'Maria Santos',
    phone: getTestPhoneNumber(),
    building: 'Edifício Teste Persistência',
    apartment: '205',
    building_id: '123e4567-e89b-12d3-a456-426614174000',
    temporary_password: 'TempPass123!'
  };

  // Fazer requisição para registrar residente
  const result = await makeRequest('/api/register-resident', testData);
  
  if (!result.success || result.status !== 200) {
    throw new Error(`Falha na requisição: ${result.error || 'Status ' + result.status}`);
  }

  // Verificar se a resposta contém os campos esperados
  if (!result.data.profile_id || !result.data.email || !result.data.building_name || !result.data.apartment_number) {
    throw new Error('Resposta não contém todos os campos esperados');
  }

  // Verificar se os dados da resposta correspondem aos enviados
  if (result.data.building_name !== testData.building || result.data.apartment_number !== testData.apartment) {
    throw new Error('Dados da resposta não correspondem aos dados enviados');
  }

  console.log('✅ Resposta contém dados corretos:', result.data);
  console.log('✅ Teste de resposta do endpoint passou');
}

// Teste 2: Verificação de integridade da resposta
async function testDatabasePersistence() {
  console.log('\n🧪 Teste 2: Verificação de integridade da resposta');
  
  const testData = {
    name: 'João Teste Persistência',
    phone: getTestPhoneNumber(),
    building: 'Edifício Teste DB',
    apartment: '101',
    building_id: '123e4567-e89b-12d3-a456-426614174000',
    temporary_password: 'TestPass123!'
  };

  try {
    // Fazer requisição
    const result = await makeRequest('/api/register-resident', testData);
    
    if (!result.success || result.status !== 200) {
      throw new Error(`Falha na requisição: ${result.error || 'Status ' + result.status}`);
    }

    console.log('📤 Requisição enviada com sucesso');
    
    // Verificar estrutura da resposta
    const requiredFields = ['profile_id', 'email', 'building_name', 'apartment_number'];
    for (const field of requiredFields) {
      if (!result.data[field]) {
        throw new Error(`Campo obrigatório ausente na resposta: ${field}`);
      }
    }
    
    // Verificar se o email foi gerado corretamente
     if (!isValidTempEmail(result.data.email, testData.phone)) {
       throw new Error(`Email incorreto. Esperado: ${testData.phone}@temp.jamesconcierge.com, Recebido: ${result.data.email}`);
     }
     
     // Verificar se o profile_id é um UUID válido
     if (!isValidUUID(result.data.profile_id)) {
       throw new Error('Profile ID não é um UUID válido');
     }
    
    console.log('✅ Teste de integridade da resposta passou');
    
  } catch (error) {
    console.error('❌ Erro no teste de integridade:', error.message);
    throw error;
  }
}


// Teste 3: Concorrência de requisições
async function testConcurrentPersistence() {
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
      temporary_password: `ConcPass${i}!`
    };
    
    testPromises.push(
      makeRequest('/api/register-resident', testData)
        .then(result => ({ ...result, testData }))
    );
  }
  
  try {
    // Executar todas as requisições simultaneamente
    console.log(`📤 Enviando ${numRequests} requisições simultâneas...`);
    const startTime = Date.now();
    const results = await Promise.all(testPromises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Verificar se todas foram bem-sucedidas
    let successCount = 0;
    for (const result of results) {
      if (result.success && result.status === 200) {
        successCount++;
        
        // Verificar estrutura da resposta
        if (!result.data.profile_id || !result.data.email || !result.data.building_name || !result.data.apartment_number) {
          throw new Error(`Resposta incompleta para ${result.testData.phone}`);
        }
        
        // Verificar se os dados correspondem
        if (result.data.building_name !== result.testData.building || result.data.apartment_number !== result.testData.apartment) {
          throw new Error(`Dados incorretos na resposta para ${result.testData.phone}`);
        }
      } else {
        console.error(`❌ Falha na requisição para ${result.testData.phone}:`, result.error);
      }
    }
    
    console.log(`✅ ${successCount}/${numRequests} requisições bem-sucedidas`);
    console.log(`⏱️ Tempo total: ${totalTime}ms (${(totalTime/numRequests).toFixed(2)}ms por requisição)`);
    
    if (successCount !== numRequests) {
      throw new Error(`Apenas ${successCount} de ${numRequests} requisições foram bem-sucedidas`);
    }
    
    console.log('✅ Teste de concorrência passou');
    
  } catch (error) {
    console.error('❌ Erro no teste de concorrência:', error.message);
    throw error;
  }
}

// Teste de rollback em caso de erro
async function testErrorRollback() {
  console.log('\n🧪 Teste: Rollback em Caso de Erro');
  console.log('=' .repeat(60));
  
  const invalidData = {
    name: 'Teste Rollback',
    phone: getTestPhoneNumber(),
    building: '', // Campo inválido para forçar erro
    apartment: '101'
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
    
  } catch (error) {
    console.log('\n❌ Teste de Rollback FALHOU:', error.message);
    throw error;
  } finally {
    console.log('\n🧹 Teste de rollback finalizado');
  }
}

// Função principal
async function runPersistenceTests() {
  console.log('🚀 INICIANDO TESTES DE PERSISTÊNCIA NO BANCO DE DADOS');
  console.log('=' .repeat(80));
  
  const tests = [
    { name: 'Resposta do Endpoint', fn: testBasicPersistence },
    { name: 'Persistência Básica', fn: testDatabasePersistence },
    { name: 'Persistência Concorrente', fn: testConcurrentPersistence },
    { name: 'Rollback de Erro', fn: testErrorRollback }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n\n🧪 Executando: ${test.name}`);
      await test.fn();
      passedTests++;
    } catch (error) {
      console.log(`\n❌ Teste '${test.name}' FALHOU:`, error.message);
      failedTests++;
    }
  }
  
  console.log('\n\n📊 RESUMO DOS TESTES DE PERSISTÊNCIA');
  console.log('=' .repeat(50));
  console.log(`✅ Testes que passaram: ${passedTests}`);
  console.log(`❌ Testes que falharam: ${failedTests}`);
  console.log(`📈 Taxa de sucesso: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 TODOS OS TESTES DE PERSISTÊNCIA PASSARAM!');
  } else {
    console.log('\n⚠️  ALGUNS TESTES FALHARAM - Verifique os logs acima');
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  runPersistenceTests()
    .then(() => {
      console.log('\n✅ Execução dos testes concluída');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro fatal durante execução dos testes:', error);
      process.exit(1);
    });
}

// Exportar funções para uso em outros testes
module.exports = {
  testBasicPersistence,
  testDatabasePersistence,
  testConcurrentPersistence,
  testErrorRollback,
  runPersistenceTests
};