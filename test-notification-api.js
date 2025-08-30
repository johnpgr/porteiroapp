/**
 * Teste para verificar o envio de dados para a API de notificação WhatsApp
 * Este arquivo testa todos os cenários de cadastro e verifica se os dados
 * estão sendo enviados corretamente para o endpoint /api/send-resident-whatsapp
 */

const fetch = require('node-fetch');

// Configuração da API
const API_CONFIG = {
  baseUrl: 'https://notification-api-main-production.up.railway.app',
  endpoint: '/api/send-resident-whatsapp'
};

// Função para fazer delay entre chamadas
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para gerar senha temporária
const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Função para limpar número de telefone
const cleanPhone = (phone) => phone.replace(/\D/g, '');

// Função para fazer chamada para a API
const sendNotificationAPI = async (data, testName) => {
  console.log(`\n🧪 TESTE: ${testName}`);
  console.log('=' .repeat(50));
  
  console.log('📤 DADOS ENVIADOS:');
  console.log(JSON.stringify(data, null, 2));
  
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    console.log(`\n📡 STATUS DA RESPOSTA: ${response.status} ${response.statusText}`);
    
    const responseData = await response.json();
    console.log('📥 RESPOSTA DA API:');
    console.log(JSON.stringify(responseData, null, 2));
    
    if (response.ok) {
      console.log('✅ SUCESSO: Dados enviados com sucesso!');
    } else {
      console.log('❌ ERRO: Falha no envio dos dados');
    }
    
    return { success: response.ok, data: responseData };
    
  } catch (error) {
    console.log('💥 ERRO DE CONEXÃO:');
    console.log(error.message);
    return { success: false, error: error.message };
  }
};

// TESTE 1: Cadastro Individual de Morador
const testIndividualResident = async () => {
  const residentData = {
    name: 'João Silva Santos',
    phone: cleanPhone('(11) 99999-1234'),
    building: 'Edifício Teste Individual',
    apartment: '101',
    profile_id: 'profile_' + Date.now(),
    temporary_password: generateTemporaryPassword(),
    building_id: 'building_123'
  };
  
  return await sendNotificationAPI(residentData, 'CADASTRO INDIVIDUAL DE MORADOR');
};

// TESTE 2: Cadastro Múltiplo de Moradores
const testMultipleResidents = async () => {
  const residents = [
    {
      name: 'Maria Oliveira Costa',
      phone: cleanPhone('(11) 98888-5678'),
      building: 'Edifício Teste Múltiplo',
      apartment: '201',
      profile_id: 'profile_multi_1_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    },
    {
      name: 'Pedro Santos Lima',
      phone: cleanPhone('(11) 97777-9012'),
      building: 'Edifício Teste Múltiplo',
      apartment: '202',
      profile_id: 'profile_multi_2_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    },
    {
      name: 'Ana Carolina Ferreira',
      phone: cleanPhone('(11) 96666-3456'),
      building: 'Edifício Teste Múltiplo',
      apartment: '203',
      profile_id: 'profile_multi_3_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    }
  ];
  
  const results = [];
  
  for (let i = 0; i < residents.length; i++) {
    const resident = residents[i];
    const result = await sendNotificationAPI(
      resident, 
      `CADASTRO MÚLTIPLO - MORADOR ${i + 1}/3`
    );
    results.push(result);
    
    // Delay de 1 segundo entre envios (como no código real)
    if (i < residents.length - 1) {
      console.log('⏳ Aguardando 1 segundo antes do próximo envio...');
      await delay(1000);
    }
  }
  
  return results;
};

// TESTE 3: Cadastro em Massa (Bulk)
const testBulkRegistration = async () => {
  const bulkResidents = [
    {
      name: 'Carlos Eduardo Silva',
      phone: cleanPhone('(11) 95555-7890'),
      building: 'Edifício Teste Bulk',
      apartment: '301',
      profile_id: 'profile_bulk_1_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    },
    {
      name: 'Fernanda Alves Pereira',
      phone: cleanPhone('(11) 94444-2345'),
      building: 'Edifício Teste Bulk',
      apartment: '302',
      profile_id: 'profile_bulk_2_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    },
    {
      name: 'Roberto Machado Costa',
      phone: cleanPhone('(11) 93333-6789'),
      building: 'Edifício Teste Bulk',
      apartment: '303',
      profile_id: 'profile_bulk_3_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    },
    {
      name: 'Juliana Rodrigues Santos',
      phone: cleanPhone('(11) 92222-0123'),
      building: 'Edifício Teste Bulk',
      apartment: '304',
      profile_id: 'profile_bulk_4_' + Date.now(),
      temporary_password: generateTemporaryPassword()
    }
  ];
  
  const results = [];
  
  for (let i = 0; i < bulkResidents.length; i++) {
    const resident = bulkResidents[i];
    const result = await sendNotificationAPI(
      resident, 
      `CADASTRO EM MASSA - MORADOR ${i + 1}/${bulkResidents.length}`
    );
    results.push(result);
    
    // Delay entre envios para evitar limitação de taxa
    if (i < bulkResidents.length - 1) {
      console.log('⏳ Aguardando 1 segundo antes do próximo envio...');
      await delay(1000);
    }
  }
  
  return results;
};

// Função para executar todos os testes
const runAllTests = async () => {
  console.log('🚀 INICIANDO TESTES DA API DE NOTIFICAÇÃO WHATSAPP');
  console.log('=' .repeat(60));
  console.log(`📡 URL da API: ${API_CONFIG.baseUrl}${API_CONFIG.endpoint}`);
  console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}`);
  console.log('=' .repeat(60));
  
  const testResults = {
    individual: null,
    multiple: null,
    bulk: null
  };
  
  try {
    // Teste 1: Cadastro Individual
    console.log('\n🔍 Executando Teste 1: Cadastro Individual...');
    testResults.individual = await testIndividualResident();
    
    await delay(2000); // Pausa entre tipos de teste
    
    // Teste 2: Cadastro Múltiplo
    console.log('\n🔍 Executando Teste 2: Cadastro Múltiplo...');
    testResults.multiple = await testMultipleResidents();
    
    await delay(2000); // Pausa entre tipos de teste
    
    // Teste 3: Cadastro em Massa
    console.log('\n🔍 Executando Teste 3: Cadastro em Massa...');
    testResults.bulk = await testBulkRegistration();
    
  } catch (error) {
    console.log('💥 ERRO GERAL NOS TESTES:');
    console.log(error.message);
  }
  
  // Resumo dos resultados
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMO DOS RESULTADOS');
  console.log('=' .repeat(60));
  
  console.log('\n1️⃣ CADASTRO INDIVIDUAL:');
  if (testResults.individual) {
    console.log(`   Status: ${testResults.individual.success ? '✅ SUCESSO' : '❌ FALHA'}`);
  }
  
  console.log('\n2️⃣ CADASTRO MÚLTIPLO:');
  if (testResults.multiple && Array.isArray(testResults.multiple)) {
    const successCount = testResults.multiple.filter(r => r.success).length;
    console.log(`   Enviados: ${testResults.multiple.length}`);
    console.log(`   Sucessos: ${successCount}`);
    console.log(`   Falhas: ${testResults.multiple.length - successCount}`);
  }
  
  console.log('\n3️⃣ CADASTRO EM MASSA:');
  if (testResults.bulk && Array.isArray(testResults.bulk)) {
    const successCount = testResults.bulk.filter(r => r.success).length;
    console.log(`   Enviados: ${testResults.bulk.length}`);
    console.log(`   Sucessos: ${successCount}`);
    console.log(`   Falhas: ${testResults.bulk.length - successCount}`);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ TESTES CONCLUÍDOS!');
  console.log('=' .repeat(60));
};

// Executar os testes se o arquivo for chamado diretamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testIndividualResident,
  testMultipleResidents,
  testBulkRegistration,
  sendNotificationAPI
};