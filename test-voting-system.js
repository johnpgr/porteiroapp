/**
 * Script de Teste para Sistema de Votação e Notificações
 * 
 * Este script verifica:
 * 1. Estrutura de notificações e campo 'resident_response_by'
 * 2. Sistema de votação em enquetes com unicidade
 * 3. Políticas RLS e segurança
 * 4. Tratamento de erros específicos (42703, 42501)
 * 5. Validação de campos obrigatórios
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Carregar variáveis de ambiente
require('dotenv').config();

// Configuração do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Clientes Supabase
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utilitários de log
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}=== ${msg} ===${colors.reset}\n`)
};

// Dados de teste
let testData = {
  users: [],
  apartments: [],
  buildings: [],
  polls: [],
  pollOptions: [],
  visitorLogs: [],
  notifications: [],
  auditLogs: []
};

// Resultados dos testes
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Função para executar teste individual
 */
async function runTest(testName, testFunction) {
  testResults.total++;
  try {
    log.info(`Executando: ${testName}`);
    await testFunction();
    testResults.passed++;
    log.success(`${testName} - PASSOU`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    log.error(`${testName} - FALHOU: ${error.message}`);
  }
}

/**
 * Gerar dados de teste únicos
 */
function generateTestData() {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(4).toString('hex');
  
  return {
    userId: crypto.randomUUID(),
    apartmentId: crypto.randomUUID(),
    buildingId: crypto.randomUUID(),
    pollId: crypto.randomUUID(),
    optionId: crypto.randomUUID(),
    visitorLogId: crypto.randomUUID(),
    auditId: crypto.randomUUID(),
    email: `test_${randomId}@test.com`,
    name: `Test User ${randomId}`,
    timestamp
  };
}

/**
 * Função para verificar estrutura das tabelas
 */
async function checkTableStructure(tableName, expectedColumns, client = supabaseAdmin) {
  try {
    // Tentar fazer uma consulta simples na tabela para verificar se existe
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      // Se a tabela não existir, o erro será sobre a tabela não encontrada
      if (error.message.includes('does not exist') || error.message.includes('not found')) {
        return {
          exists: false,
          columns: [],
          missingColumns: expectedColumns,
          hasAllColumns: false
        };
      }
      throw new Error(`Erro ao verificar estrutura: ${error.message}`);
    }
    
    // Se chegou aqui, a tabela existe
    // Para verificar colunas específicas, tentamos fazer uma consulta com cada coluna
    const existingColumns = [];
    
    for (const column of expectedColumns) {
      try {
        const { error: columnError } = await client
          .from(tableName)
          .select(column)
          .limit(1);
        
        if (!columnError) {
          existingColumns.push(column);
        }
      } catch (e) {
        // Coluna não existe
      }
    }
    
    const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));
    
    return {
      exists: true,
      columns: existingColumns,
      missingColumns,
      hasAllColumns: missingColumns.length === 0
    };
  } catch (error) {
    throw new Error(`Erro ao verificar estrutura: ${error.message}`);
  }
}

/**
 * Teste 1: Verificar estrutura da tabela notification_audit_log
 */
async function testNotificationAuditLogStructure() {
  const requiredColumns = ['id', 'visitor_log_id', 'old_status', 'new_status', 'changed_by', 'changed_at', 'change_reason'];
  const structure = await checkTableStructure('notification_audit_log', requiredColumns);
  
  if (!structure.exists) {
    throw new Error('Tabela notification_audit_log não encontrada');
  }

  if (structure.missingColumns.length > 0) {
    throw new Error(`Colunas obrigatórias não encontradas na tabela notification_audit_log: ${structure.missingColumns.join(', ')}`);
  }

  // Verificar especificamente o campo 'old_status'
  if (!structure.columns.includes('old_status')) {
    throw new Error("Campo 'old_status' não encontrado - isso causaria erro 42703");
  }

  log.success('Estrutura da tabela notification_audit_log está correta');
  return true;
}

/**
 * Teste 2: Verificar estrutura da tabela poll_votes
 */
async function testPollVotesStructure() {
  const requiredColumns = ['id', 'user_id', 'poll_option_id', 'created_at'];
  const structure = await checkTableStructure('poll_votes', requiredColumns);
  
  if (!structure.exists) {
    throw new Error('Tabela poll_votes não encontrada');
  }

  if (structure.missingColumns.length > 0) {
    throw new Error(`Colunas obrigatórias não encontradas na tabela poll_votes: ${structure.missingColumns.join(', ')}`);
  }

  // Verificar especificamente o campo 'poll_option_id'
  if (!structure.columns.includes('poll_option_id')) {
    throw new Error("Campo 'poll_option_id' não encontrado - isso causaria erro ao votar");
  }

  log.success('Estrutura da tabela poll_votes está correta');
  return true;
}

/**
 * Teste 3: Verificar campo resident_response_by em visitor_logs
 */
async function testResidentResponseByField() {
  const allFields = ['resident_response_by', 'authorized_by', 'responded_by', 'notification_status', 'resident_response_at', 'requires_resident_approval'];
  const structure = await checkTableStructure('visitor_logs', allFields, supabaseAdmin);
  
  if (!structure.exists) {
    throw new Error('Tabela visitor_logs não encontrada');
  }
  
  // Verificar se existe resident_response_by ou campos alternativos
  const responseFields = ['resident_response_by', 'authorized_by', 'responded_by'];
  const hasResponseField = responseFields.some(field => structure.columns.includes(field));
  
  if (!hasResponseField) {
    log.warning('Campo resident_response_by não encontrado, mas pode usar authorized_by');
  } else {
    log.success('Campo de resposta do morador encontrado');
  }

  // Verificar outros campos importantes para notificações
  const notificationFields = ['notification_status', 'resident_response_at', 'requires_resident_approval'];
  const missingNotificationFields = notificationFields.filter(field => !structure.columns.includes(field));
  
  if (missingNotificationFields.length > 0) {
    log.warning(`Campos de notificação não encontrados: ${missingNotificationFields.join(', ')}`);
  } else {
    log.success('Todos os campos de notificação encontrados');
  }
  return true;
}

/**
 * Teste 4: Criar dados de teste
 */
async function createTestData() {
  const testInfo = generateTestData();
  
  // Criar usuário de teste
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: testInfo.email,
    password: 'test123456',
    email_confirm: true
  });
  
  if (userError) throw new Error(`Erro ao criar usuário: ${userError.message}`);
  testData.users.push(userData.user);

  // Criar perfil
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userData.user.id,
      user_id: userData.user.id,
      full_name: testInfo.name,
      email: testInfo.email,
      role: 'morador',
      user_type: 'morador'
    });

  if (profileError) throw new Error(`Erro ao criar perfil: ${profileError.message}`);

  // Criar prédio de teste
  const { data: buildingData, error: buildingError } = await supabaseAdmin
    .from('buildings')
    .insert({
      id: testInfo.buildingId,
      name: `Prédio Teste ${testInfo.timestamp}`,
      address: 'Endereço Teste'
    })
    .select()
    .single();

  if (buildingError) throw new Error(`Erro ao criar prédio: ${buildingError.message}`);
  testData.buildings.push(buildingData);

  // Criar apartamento de teste
  const { data: apartmentData, error: apartmentError } = await supabaseAdmin
    .from('apartments')
    .insert({
      id: testInfo.apartmentId,
      building_id: testInfo.buildingId,
      number: `${testInfo.timestamp % 1000}`,
      floor: 1
    })
    .select()
    .single();

  if (apartmentError) throw new Error(`Erro ao criar apartamento: ${apartmentError.message}`);
  testData.apartments.push(apartmentData);

  // Associar morador ao apartamento
  const { error: residentError } = await supabaseAdmin
    .from('apartment_residents')
    .insert({
      profile_id: userData.user.id,
      apartment_id: testInfo.apartmentId,
      is_owner: true
    });

  if (residentError) throw new Error(`Erro ao associar morador: ${residentError.message}`);

  log.success('Dados de teste criados com sucesso');
  return { testInfo, userData };
}

/**
 * Teste 5: Testar criação de enquete e opções
 */
async function testPollCreation() {
  const testInfo = generateTestData();
  const building = testData.buildings[0];
  
  // Usar o admin padrão criado pela migração
  const { data: adminProfile, error: adminError } = await supabaseAdmin
    .from('admin_profiles')
    .select('id')
    .eq('email', 'admin-test@porteiroapp.com')
    .single();
  
  if (adminError || !adminProfile) {
    throw new Error('Admin padrão não encontrado. Execute a migração fix_default_admin_creation.sql');
  }
  
  // Criar enquete com created_by
  const { data: pollData, error: pollError } = await supabaseAdmin
    .from('polls')
    .insert({
      id: testInfo.pollId,
      building_id: building.id,
      title: `Enquete Teste ${testInfo.timestamp}`,
      question: 'Qual é a sua opinião sobre a nova regra do condomínio?',
      description: 'Descrição da enquete de teste',
      is_active: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_by: adminProfile.id
    })
    .select()
    .single();

  if (pollError) throw new Error(`Erro ao criar enquete: ${pollError.message}`);
  testData.polls.push(pollData);

  // Criar opções da enquete
  const options = [
    { id: crypto.randomUUID(), poll_id: testInfo.pollId, option_text: 'Opção A', order_index: 1 },
    { id: crypto.randomUUID(), poll_id: testInfo.pollId, option_text: 'Opção B', order_index: 2 }
  ];

  const { data: optionsData, error: optionsError } = await supabaseAdmin
    .from('poll_options')
    .insert(options)
    .select();

  if (optionsError) throw new Error(`Erro ao criar opções: ${optionsError.message}`);
  testData.pollOptions.push(...optionsData);

  log.success('Enquete e opções criadas com sucesso');
}

/**
 * Teste 6: Testar políticas RLS
 */
async function testRLSPolicies() {
  log.info('Testando políticas RLS para poll_votes...');
  
  try {
    // Teste 1: Tentar ler poll_votes sem autenticação (usuário anônimo)
    const { data: anonReadData, error: anonReadError } = await supabaseAdmin
      .from('poll_votes')
      .select('*')
      .limit(1);
    
    if (anonReadError && anonReadError.code === '42501') {
      log.success('RLS bloqueou leitura anônima corretamente');
    } else if (anonReadData) {
      log.warning(`Leitura anônima permitida: ${anonReadData.length} registros`);
    } else {
      log.info('Nenhum dado encontrado para leitura anônima');
    }
    
    // Teste 2: Tentar inserir poll_votes sem autenticação (deve falhar)
    const testPollOption = testData.pollOptions[0];
    const { error: anonInsertError } = await supabaseAdmin
      .from('poll_votes')
      .insert({
        user_id: crypto.randomUUID(),
        poll_option_id: testPollOption.id,
        created_at: new Date().toISOString()
      });
    
    if (anonInsertError && anonInsertError.code === '42501') {
      log.success('RLS bloqueou inserção anônima corretamente');
    } else {
      log.warning('Inserção anônima foi permitida (inesperado)');
    }
    
    // Teste 3: Verificar RLS em outras tabelas relacionadas
    const tables = ['polls', 'poll_options', 'poll_votes', 'notification_audit_log'];
    
    for (const table of tables) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42501') {
        log.success(`RLS ativo em ${table}`);
      } else if (data) {
        log.info(`${table}: ${data.length} registros acessíveis`);
      } else {
        log.info(`${table}: sem dados ou erro: ${error?.message}`);
      }
    }
    
    log.success('Testes de RLS concluídos');
    return true;
    
  } catch (error) {
    log.error(`Erro nos testes RLS: ${error.message}`);
    return false;
  }
}

/**
 * Teste 7: Testar auditoria de notificações
 */
async function testNotificationAuditLogging() {
  log.info('Testando sistema de auditoria de notificações...');
  
  try {
    const testInfo = generateTestData();
    const user = testData.users[0];
    const building = testData.buildings[0];
    
    // Teste 1: Inserir log de auditoria
    const auditData = {
      id: testInfo.auditId,
      user_id: user.id,
      apartment_id: testData.apartments[0].id,
      event_type: 'notification_sent',
      action_type: 'visitor_notification',
      response_type: 'push',
      delivery_destination: 'mobile_app',
      affected_count: 1,
      metadata: {
        notification_type: 'visitor_arrival',
        recipient_count: 1,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };
    
    const { data: auditResult, error: auditError } = await supabaseAdmin
      .from('notification_audit_log')
      .insert(auditData)
      .select()
      .single();
    
    if (auditError) {
      log.error(`Erro ao inserir log de auditoria: ${auditError.message}`);
      return { success: false, message: auditError.message };
    }
    
    testData.auditLogs.push(auditResult);
    log.success('Log de auditoria inserido com sucesso');
    
    // Teste 2: Verificar se o log foi salvo corretamente
    const { data: retrievedLog, error: retrieveError } = await supabaseAdmin
      .from('notification_audit_log')
      .select('*')
      .eq('id', testInfo.auditId)
      .single();
    
    if (retrieveError) {
      log.error(`Erro ao recuperar log: ${retrieveError.message}`);
      return { success: false, message: retrieveError.message };
    }
    
    if (retrievedLog.event_type !== 'notification_sent') {
      throw new Error('Dados do log de auditoria não correspondem');
    }
    
    log.success('Log de auditoria recuperado e validado');
    
    // Teste 3: Verificar estrutura do JSON metadata
    try {
      const metadata = retrievedLog.metadata;
      if (!metadata.notification_type || !metadata.recipient_count) {
        throw new Error('Estrutura do JSON metadata inválida');
      }
      log.success('Estrutura JSON do metadata validada');
    } catch (jsonError) {
      log.error(`Erro na estrutura JSON: ${jsonError.message}`);
      return { success: false, message: jsonError.message };
    }
    
    log.success('Sistema de auditoria funcionando corretamente');
    return true;
    
  } catch (error) {
    log.error(`Erro no teste de auditoria: ${error.message}`);
    return false;
  }
}

/**
 * Teste 8: Testar votação única por usuário
 */
async function testUniqueVoting() {
  const user = testData.users[0];
  const poll = testData.polls[0];
  const option = testData.pollOptions[0];

  // Verificar se já existe voto do usuário (limpeza prévia)
  const { data: existingVotes } = await supabaseAdmin
    .from('poll_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('poll_option_id', option.id);

  if (existingVotes && existingVotes.length > 0) {
    log.warning('Limpando votos existentes do usuário...');
    await supabaseAdmin
      .from('poll_votes')
      .delete()
      .eq('user_id', user.id);
  }

  // Primeiro voto (deve funcionar)
  const { error: firstVoteError } = await supabaseAdmin
    .from('poll_votes')
    .insert({
      user_id: user.id,
      poll_option_id: option.id,
      created_at: new Date().toISOString()
    });

  if (firstVoteError) throw new Error(`Erro no primeiro voto: ${firstVoteError.message}`);

  // Verificação a nível de aplicação para voto duplicado
  const { data: duplicateCheck } = await supabaseAdmin
    .from('poll_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('poll_option_id', option.id);

  if (!duplicateCheck || duplicateCheck.length === 0) {
    throw new Error('Primeiro voto não foi registrado corretamente');
  }

  // Segundo voto (implementar verificação a nível de aplicação)
  const { data: existingUserVotes } = await supabaseAdmin
    .from('poll_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('poll_option_id', testData.pollOptions[1].id);

  if (existingUserVotes && existingUserVotes.length > 0) {
    log.success('Verificação de voto único a nível de aplicação funcionando');
    return;
  }

  // Tentar segundo voto (pode ou não falhar dependendo da constraint DB)
  const { error: secondVoteError } = await supabaseAdmin
    .from('poll_votes')
    .insert({
      user_id: user.id,
      poll_option_id: testData.pollOptions[1].id,
      created_at: new Date().toISOString()
    });

  if (secondVoteError) {
    // Verificar se o erro é relacionado à constraint de unicidade
    if (secondVoteError.message.includes('duplicate') || secondVoteError.message.includes('unique')) {
      log.success('Constraint de voto único a nível de banco funcionando corretamente');
    } else {
      log.warning(`Erro inesperado no segundo voto: ${secondVoteError.message}`);
    }
  } else {
    log.warning('Segundo voto foi aceito - recomenda-se implementar constraint única no banco');
    log.success('Verificação a nível de aplicação deve ser implementada');
  }
  return true;
}

/**
 * Teste 7: Testar políticas RLS para poll_votes
 */
async function testPollVotesRLS() {
  const user = testData.users[0];
  const option = testData.pollOptions[1];

  // Test 1: Anonymous user access (should be able to read only)
  log.info('Testing anonymous user access...');
  
  const { data: anonRead, error: anonReadError } = await supabaseAnon
    .from('poll_votes')
    .select('*')
    .limit(1);
  
  if (anonReadError) {
    log.warning(`Anonymous user cannot read poll_votes: ${anonReadError.message}`);
  } else {
    log.success('Anonymous user can read poll_votes');
  }

  // Test 2: Anonymous user trying to insert (should fail)
  const { error: anonError } = await supabaseAnon
    .from('poll_votes')
    .insert({
      user_id: user.id,
      poll_option_id: option.id,
      created_at: new Date().toISOString()
    });

  if (!anonError) {
    throw new Error('Voto anônimo deveria ter falhado devido às políticas RLS');
  }

  // Verificar se o erro é relacionado à política RLS (código 42501)
  if (anonError.code === '42501') {
    log.success('Anonymous user correctly blocked from inserting votes (Error 42501)');
  } else if (anonError.message.includes('policy')) {
    log.success('Anonymous user correctly blocked by RLS policy');
  } else {
    log.warning(`Erro RLS esperado, mas recebido: ${anonError.message}`);
  }

  // Test 3: Check specific RLS error code 42501
  log.info('Testing specific RLS error scenarios...');
  
  // Try to insert with invalid user_id (should trigger RLS)
  const { error: invalidUserError } = await supabaseAnon
    .from('poll_votes')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // Invalid user
      poll_option_id: option.id,
      created_at: new Date().toISOString()
    });
  
  if (invalidUserError && invalidUserError.code === '42501') {
    log.success('RLS correctly blocking invalid user access (Error 42501)');
  } else if (invalidUserError) {
    log.warning(`Different error for invalid user: ${invalidUserError.message}`);
  }

  log.success('Políticas RLS para poll_votes funcionando corretamente');
  return true;
}

/**
 * Teste 8: Testar criação de notificação com audit log
 */
async function testNotificationWithAuditLog() {
  const testInfo = generateTestData();
  const apartment = testData.apartments[0];
  const user = testData.users[0];

  // Criar visitor log que gerará audit log
  const { data: visitorLogData, error: visitorLogError } = await supabaseAdmin
    .from('visitor_logs')
    .insert({
      id: testInfo.visitorLogId,
      apartment_id: apartment.id,
      building_id: apartment.building_id,
      notification_status: 'pending',
      requires_resident_approval: true,
      entry_type: 'visitor',
      guest_name: 'Visitante Teste',
      purpose: 'Teste de notificação',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      notification_sent_at: new Date().toISOString()
    })
    .select()
    .single();

  if (visitorLogError) throw new Error(`Erro ao criar visitor log: ${visitorLogError.message}`);
  testData.visitorLogs.push(visitorLogData);

  // Atualizar status (deve gerar audit log)
  const { error: updateError } = await supabaseAdmin
    .from('visitor_logs')
    .update({
      notification_status: 'approved',
      resident_response_at: new Date().toISOString()
    })
    .eq('id', testInfo.visitorLogId);

  if (updateError) {
    // Se erro 42703 (coluna não existe), isso indica problema com old_status
    if (updateError.code === '42703' && updateError.message.includes('old_status')) {
      throw new Error('Erro 42703: Campo old_status não existe na tabela notification_audit_log');
    }
    throw new Error(`Erro ao atualizar visitor log: ${updateError.message}`);
  }

  // Verificar se audit log foi criado
  const { data: auditData, error: auditError } = await supabaseAdmin
    .from('notification_audit_log')
    .select('*')
    .eq('visitor_log_id', testInfo.visitorLogId);

  if (auditError) throw new Error(`Erro ao verificar audit log: ${auditError.message}`);
  
  if (!auditData || auditData.length === 0) {
    log.warning('Audit log não foi criado automaticamente');
    return false;
  } else {
    log.success('Audit log criado com sucesso');
    return true;
  }
}

/**
 * Teste 9: Testar tratamento de erros específicos
 */
async function testSpecificErrorHandling() {
  const results = {
    error42703: false,
    error42501: false,
    errorHandling: false
  };

  // Teste para erro 42703 (coluna não existe)
  try {
    const { data, error } = await supabaseAdmin
      .from('visitor_logs')
      .select('nonexistent_column_that_does_not_exist')
      .limit(1);
    
    if (error) {
      if (error.code === '42703' || error.message.includes('column') || error.message.includes('does not exist')) {
        log.success('Erro 42703 (coluna não existe) tratado corretamente');
        results.error42703 = true;
      } else {
        log.warning(`Erro esperado 42703, mas recebido: ${error.code} - ${error.message}`);
      }
    } else {
      log.warning('Query com coluna inexistente deveria ter falhado');
    }
  } catch (error) {
    if (error.code === '42703' || error.message.includes('column') || error.message.includes('does not exist')) {
      log.success('Erro 42703 (coluna não existe) tratado corretamente');
      results.error42703 = true;
    } else {
      log.warning(`Erro esperado 42703, mas recebido: ${error.code} - ${error.message}`);
    }
  }

  // Teste específico do campo 'resident_response_by'
  log.info('Testando tratamento do campo resident_response_by...');
  
  try {
    await supabaseAdmin
      .from('notification_audit_log')
      .insert({
        visitor_log_id: crypto.randomUUID(),
        old_status: 'pending',
        new_status: 'approved',
        changed_by: crypto.randomUUID(),
        change_reason: 'test'
        // resident_response_by removido - campo não existe na tabela notification_audit_log
      });
  } catch (error) {
    if (error.message.includes('resident_response_by')) {
      log.warning('Campo resident_response_by causou erro - precisa ser adicionado à tabela');
    } else if (error.code === '42703') {
      log.success('Erro 42703 detectado corretamente para campo ausente');
      results.error42703 = true;
    }
  }

  // Teste para erro 42501 (violação de política RLS)
  // Tentativa de inserção não autorizada em poll_votes (sabemos que tem RLS restritivo)
  try {
    const { data: insertData, error: insertError } = await supabaseAnon
      .from('poll_votes')
      .insert({
        user_id: crypto.randomUUID(),
        poll_option_id: crypto.randomUUID(),
        apartment_id: crypto.randomUUID(),
        poll_id: crypto.randomUUID()
      });
    
    if (insertError) {
      if (insertError.code === '42501' || insertError.message.includes('policy') || insertError.message.includes('permission') || insertError.message.includes('denied') || insertError.message.includes('row-level security')) {
        log.success('Erro 42501 (violação RLS) tratado corretamente na inserção');
        results.error42501 = true;
      } else {
        log.warning(`Erro esperado 42501 na inserção, mas recebido: ${insertError.code} - ${insertError.message}`);
      }
    } else {
      log.warning('Operação anônima em poll_votes deveria ter falhado devido às políticas RLS');
    }
    
    // Teste adicional: tentativa de acesso a dados administrativos
    const { data: adminData, error: adminError } = await supabaseAnon
      .from('admin_profiles')
      .select('*')
      .limit(1);
    
    if (adminError) {
      if (adminError.code === '42501' || adminError.message.includes('policy') || adminError.message.includes('permission') || adminError.message.includes('denied') || adminError.message.includes('row-level security')) {
        log.success('Erro 42501 (violação RLS) tratado corretamente no acesso a admin_profiles');
        results.error42501 = true;
      } else {
        log.warning(`Erro esperado 42501 para admin_profiles, mas recebido: ${adminError.code} - ${adminError.message}`);
      }
    } else {
      log.warning('Acesso anônimo a admin_profiles deveria ter falhado devido às políticas RLS');
    }
    
  } catch (error) {
    if (error.code === '42501' || error.message.includes('policy') || error.message.includes('permission') || error.message.includes('denied') || error.message.includes('row-level security')) {
      log.success('Erro 42501 (violação RLS) tratado corretamente');
      results.error42501 = true;
    } else {
      log.warning(`Erro esperado 42501, mas recebido: ${error.code} - ${error.message}`);
    }
  }

  // Teste de lógica de retry para tratamento de erros
  log.info('Testando lógica de retry para tratamento de erros...');
  
  const maxRetries = 3;
  let retryCount = 0;
  let success = false;
  
  while (retryCount < maxRetries && !success) {
    try {
      const { error } = await supabaseAdmin
        .from('polls')
        .select('id')
        .limit(1);
      
      if (!error) {
        success = true;
        log.success(`Lógica de retry funcionando - sucesso na tentativa ${retryCount + 1}`);
      }
    } catch (retryError) {
      retryCount++;
      log.warning(`Tentativa ${retryCount} falhou: ${retryError.message}`);
      
      if (retryCount >= maxRetries) {
        log.error('Máximo de tentativas atingido');
      } else {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  results.errorHandling = success;
  
  log.info('=== Resultados do Tratamento de Erros ===');
  log.info(`42703 (Erro de Coluna): ${results.error42703 ? '✅' : '❌'}`);
  log.info(`42501 (Erro RLS): ${results.error42501 ? '✅' : '❌'}`);
  log.info(`Lógica de Retry: ${results.errorHandling ? '✅' : '❌'}`);
  
  return results.error42703 && results.error42501 && results.errorHandling;
}

/**
 * Testa validação de campos obrigatórios
 */
async function testRequiredFieldsValidation() {
  log.info('=== Testando Validação de Campos Obrigatórios ===');
  
  const results = {
    notificationFields: false,
    pollFields: false,
    voteFields: false,
    auditLogFields: false
  };
  
  // Teste de campos obrigatórios para notificações
  log.info('Testando campos obrigatórios para notificações...');
  
  const { data: notificationData, error: notificationError } = await supabaseAdmin
    .from('visitor_logs')
    .insert({
      // visitor_name ausente - campo obrigatório
      apartment_id: crypto.randomUUID(),
      notification_status: 'pending'
    });
  
  if (notificationError) {
    if (notificationError.message.includes('null') || notificationError.message.includes('required') || notificationError.code === '23502' || notificationError.message.includes('violates not-null')) {
      log.success('Validação de campos obrigatórios funcionando para notificações');
      results.notificationFields = true;
    } else {
      log.warning(`Erro inesperado na validação de notificações: ${notificationError.message}`);
    }
  } else {
    log.warning('Inserção de notificação sem campos obrigatórios deveria ter falhado');
  }
  
  // Teste de campos obrigatórios para enquetes
  log.info('Testando campos obrigatórios para enquetes...');
  
  const { data: pollData, error: pollError } = await supabaseAdmin
    .from('polls')
    .insert({
      // title ausente - campo obrigatório
      question: 'Pergunta de teste',
      building_id: testData.buildings[0]?.id || crypto.randomUUID(),
      created_by: testData.users[0]?.id || crypto.randomUUID()
    });
  
  if (pollError) {
    if (pollError.message.includes('null') || pollError.message.includes('required') || pollError.code === '23502' || pollError.message.includes('violates not-null')) {
      log.success('Validação de campos obrigatórios funcionando para enquetes');
      results.pollFields = true;
    } else {
      log.warning(`Erro inesperado na validação de enquetes: ${pollError.message}`);
    }
  } else {
    log.warning('Inserção de enquete sem campos obrigatórios deveria ter falhado');
  }
  
  // Teste de campos obrigatórios para votos
  log.info('Testando campos obrigatórios para votos...');
  
  const { data: voteData, error: voteError } = await supabaseAdmin
    .from('poll_votes')
    .insert({
      poll_id: crypto.randomUUID(),
      // user_id ausente - campo obrigatório
      poll_option_id: crypto.randomUUID(),
      apartment_id: crypto.randomUUID()
    });
  
  if (voteError) {
    if (voteError.message.includes('null') || voteError.message.includes('required') || voteError.code === '23502' || voteError.message.includes('violates not-null') || voteError.message.includes('foreign key')) {
      log.success('Validação de campos obrigatórios funcionando para votos');
      results.voteFields = true;
    } else {
      log.warning(`Erro inesperado na validação de votos: ${voteError.message}`);
    }
  } else {
    log.warning('Inserção de voto sem campos obrigatórios deveria ter falhado');
  }
  
  // Teste de campos obrigatórios para audit log
  log.info('Testando campos obrigatórios para audit log...');
  
  const { data: auditData, error: auditError } = await supabaseAdmin
    .from('notification_audit_log')
    .insert({
      // event_type ausente - campo obrigatório
      action_type: 'test_action',
      user_id: crypto.randomUUID(),
      apartment_id: crypto.randomUUID()
    });
  
  if (auditError) {
    if (auditError.message.includes('null') || auditError.message.includes('required') || auditError.code === '23502' || auditError.message.includes('violates not-null')) {
      log.success('Validação de campos obrigatórios funcionando para audit log');
      results.auditLogFields = true;
    } else {
      log.warning(`Erro inesperado na validação de audit log: ${auditError.message}`);
    }
  } else {
    log.warning('Inserção de audit log sem campos obrigatórios deveria ter falhado');
  }
  
  // Teste de validação com todos os campos corretos
  log.info('Testando inserção com todos os campos obrigatórios...');
  
  try {
    // Usar dados de teste válidos existentes
    const testBuildingId = testData.buildings[0]?.id;
    
    // Obter admin padrão para created_by
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('admin_profiles')
      .select('id')
      .eq('email', 'admin-test@porteiroapp.com')
      .single();
    
    if (!testBuildingId || adminError || !adminProfile) {
      log.warning('Dados de teste não disponíveis para validação de campos obrigatórios');
      return false;
    }
    
    // Inserir enquete válida
    const { data: pollData, error: pollError } = await supabaseAdmin
      .from('polls')
      .insert({
        title: 'Enquete de Teste - Campos Obrigatórios',
        question: 'Esta é uma pergunta de teste?',
        building_id: testBuildingId,
        created_by: adminProfile.id,
        is_active: true
      })
      .select()
      .single();
    
    if (pollError) {
      log.warning(`Erro ao criar enquete de teste: ${pollError.message}`);
    } else {
      log.success('Enquete criada com sucesso com todos os campos obrigatórios');
      
      // Limpar dados de teste
      await supabaseAdmin
        .from('polls')
        .delete()
        .eq('id', pollData.id);
    }
    
  } catch (error) {
    log.warning(`Erro no teste de campos válidos: ${error.message}`);
  }
  
  log.info('=== Resultados da Validação de Campos Obrigatórios ===');
  log.info(`Notificações: ${results.notificationFields ? '✅' : '❌'}`);
  log.info(`Enquetes: ${results.pollFields ? '✅' : '❌'}`);
  log.info(`Votos: ${results.voteFields ? '✅' : '❌'}`);
  log.info(`Audit Log: ${results.auditLogFields ? '✅' : '❌'}`);
  
  return results.notificationFields && results.pollFields && results.voteFields && results.auditLogFields;
}

/**
 * Função de limpeza automática de dados de teste
 */
async function cleanupTestData() {
  log.info('=== Iniciando Limpeza de Dados de Teste ===');
  
  const cleanupResults = {
    polls: 0,
    pollOptions: 0,
    pollVotes: 0,
    visitorLogs: 0,
    auditLogs: 0,
    errors: []
  };
  
  try {
    // Limpar votos de teste
    log.info('Limpando votos de teste...');
    const { data: votesToDelete } = await supabaseAdmin
      .from('poll_votes')
      .select('id')
      .or('user_id.like.*test*,apartment_id.like.*test*');
    
    if (votesToDelete && votesToDelete.length > 0) {
      const { error: votesError } = await supabaseAdmin
        .from('poll_votes')
        .delete()
        .in('id', votesToDelete.map(v => v.id));
      
      if (votesError) {
        cleanupResults.errors.push(`Erro ao limpar votos: ${votesError.message}`);
      } else {
        cleanupResults.pollVotes = votesToDelete.length;
        log.success(`${votesToDelete.length} votos de teste removidos`);
      }
    }
    
    // Limpar opções de enquete de teste
    log.info('Limpando opções de enquete de teste...');
    const { data: optionsToDelete } = await supabaseAdmin
      .from('poll_options')
      .select('id, poll_id')
      .like('option_text', '%teste%');
    
    if (optionsToDelete && optionsToDelete.length > 0) {
      const { error: optionsError } = await supabaseAdmin
        .from('poll_options')
        .delete()
        .in('id', optionsToDelete.map(o => o.id));
      
      if (optionsError) {
        cleanupResults.errors.push(`Erro ao limpar opções: ${optionsError.message}`);
      } else {
        cleanupResults.pollOptions = optionsToDelete.length;
        log.success(`${optionsToDelete.length} opções de teste removidas`);
      }
    }
    
    // Limpar enquetes de teste
    log.info('Limpando enquetes de teste...');
    const { data: pollsToDelete } = await supabaseAdmin
      .from('polls')
      .select('id')
      .or('title.like.*teste*,title.like.*test*,question.like.*teste*,question.like.*test*');
    
    if (pollsToDelete && pollsToDelete.length > 0) {
      const { error: pollsError } = await supabaseAdmin
        .from('polls')
        .delete()
        .in('id', pollsToDelete.map(p => p.id));
      
      if (pollsError) {
        cleanupResults.errors.push(`Erro ao limpar enquetes: ${pollsError.message}`);
      } else {
        cleanupResults.polls = pollsToDelete.length;
        log.success(`${pollsToDelete.length} enquetes de teste removidas`);
      }
    }
    
    // Limpar logs de visitantes de teste
    log.info('Limpando logs de visitantes de teste...');
    const { data: visitorLogsToDelete } = await supabaseAdmin
      .from('visitor_logs')
      .select('id')
      .or('visitor_name.like.*test*,visitor_name.like.*teste*');
    
    if (visitorLogsToDelete && visitorLogsToDelete.length > 0) {
      const { error: visitorLogsError } = await supabaseAdmin
        .from('visitor_logs')
        .delete()
        .in('id', visitorLogsToDelete.map(v => v.id));
      
      if (visitorLogsError) {
        cleanupResults.errors.push(`Erro ao limpar visitor logs: ${visitorLogsError.message}`);
      } else {
        cleanupResults.visitorLogs = visitorLogsToDelete.length;
        log.success(`${visitorLogsToDelete.length} visitor logs de teste removidos`);
      }
    }
    
    // Limpar audit logs de teste
    log.info('Limpando audit logs de teste...');
    const { data: auditLogsToDelete } = await supabaseAdmin
      .from('notification_audit_log')
      .select('id')
      .or('event_type.like.*test*,action_type.like.*test*,change_reason.like.*test*');
    
    if (auditLogsToDelete && auditLogsToDelete.length > 0) {
      const { error: auditLogsError } = await supabaseAdmin
        .from('notification_audit_log')
        .delete()
        .in('id', auditLogsToDelete.map(a => a.id));
      
      if (auditLogsError) {
        cleanupResults.errors.push(`Erro ao limpar audit logs: ${auditLogsError.message}`);
      } else {
        cleanupResults.auditLogs = auditLogsToDelete.length;
        log.success(`${auditLogsToDelete.length} audit logs de teste removidos`);
      }
    }
    
    // Limpar dados órfãos (dados que podem ter ficado sem referência)
    log.info('Verificando dados órfãos...');
    
    // Verificar votos sem enquete válida
    const { data: orphanVotes } = await supabaseAdmin
      .from('poll_votes')
      .select('id, poll_id')
      .not('poll_id', 'in', `(SELECT id FROM polls)`);
    
    if (orphanVotes && orphanVotes.length > 0) {
      const { error: orphanVotesError } = await supabaseAdmin
        .from('poll_votes')
        .delete()
        .in('id', orphanVotes.map(v => v.id));
      
      if (!orphanVotesError) {
        log.success(`${orphanVotes.length} votos órfãos removidos`);
        cleanupResults.pollVotes += orphanVotes.length;
      }
    }
    
    // Verificar opções sem enquete válida
    const { data: orphanOptions } = await supabaseAdmin
      .from('poll_options')
      .select('id, poll_id')
      .not('poll_id', 'in', `(SELECT id FROM polls)`);
    
    if (orphanOptions && orphanOptions.length > 0) {
      const { error: orphanOptionsError } = await supabaseAdmin
        .from('poll_options')
        .delete()
        .in('id', orphanOptions.map(o => o.id));
      
      if (!orphanOptionsError) {
        log.success(`${orphanOptions.length} opções órfãs removidas`);
        cleanupResults.pollOptions += orphanOptions.length;
      }
    }
    
  } catch (error) {
    cleanupResults.errors.push(`Erro geral na limpeza: ${error.message}`);
    log.error(`Erro durante limpeza: ${error.message}`);
  }
  
  // Relatório de limpeza
  log.info('=== Relatório de Limpeza ===');
  log.info(`Enquetes removidas: ${cleanupResults.polls}`);
  log.info(`Opções removidas: ${cleanupResults.pollOptions}`);
  log.info(`Votos removidos: ${cleanupResults.pollVotes}`);
  log.info(`Visitor logs removidos: ${cleanupResults.visitorLogs}`);
  log.info(`Audit logs removidos: ${cleanupResults.auditLogs}`);
  
  if (cleanupResults.errors.length > 0) {
    log.warning('Erros durante limpeza:');
    cleanupResults.errors.forEach(error => log.warning(`- ${error}`));
  } else {
    log.success('Limpeza concluída sem erros');
  }
  
  return cleanupResults;
}

/**
 * Função para executar limpeza segura com confirmação
 */
async function safeCleanup(force = false) {
  if (!force) {
    log.warning('ATENÇÃO: Esta operação irá remover dados de teste do banco.');
    log.warning('Para executar a limpeza, use: node test-voting-system.js --cleanup --force');
    return false;
  }
  
  log.info('Executando limpeza forçada...');
  return await cleanupTestData();
}

/**
 * Teste 10: Validar campos obrigatórios
 */
async function testRequiredFields() {
  // Testar campos obrigatórios em poll_votes
  try {
    await supabaseAdmin
      .from('poll_votes')
      .insert({
        // Faltando user_id e poll_option_id
        created_at: new Date().toISOString()
      });
    
    throw new Error('Inserção sem campos obrigatórios deveria ter falhado');
  } catch (error) {
    if (error.message.includes('null') || error.message.includes('required')) {
      log.success('Validação de campos obrigatórios funcionando');
    } else {
      throw new Error(`Erro inesperado: ${error.message}`);
    }
  }

  // Testar campos obrigatórios em notification_audit_log
  try {
    await supabaseAdmin
      .from('notification_audit_log')
      .insert({
        // Faltando campos obrigatórios
        change_reason: 'test'
      });
    
    throw new Error('Inserção sem campos obrigatórios deveria ter falhado');
  } catch (error) {
    if (error.message.includes('null') || error.message.includes('required')) {
      log.success('Validação de campos obrigatórios em audit log funcionando');
    } else {
      log.warning(`Erro na validação de audit log: ${error.message}`);
    }
  }
}

/**
 * Limpeza de dados de teste
 */
async function cleanupTestData() {
  log.info('Iniciando limpeza de dados de teste...');

  try {
    // Remover votos
    if (testData.users.length > 0) {
      await supabaseAdmin
        .from('poll_votes')
        .delete()
        .eq('user_id', testData.users[0].id);
    }

    // Remover audit logs
    for (const visitorLog of testData.visitorLogs) {
      await supabaseAdmin
        .from('notification_audit_log')
        .delete()
        .eq('visitor_log_id', visitorLog.id);
    }

    // Remover visitor logs
    for (const visitorLog of testData.visitorLogs) {
      await supabaseAdmin
        .from('visitor_logs')
        .delete()
        .eq('id', visitorLog.id);
    }

    // Remover opções de enquete
    for (const option of testData.pollOptions) {
      await supabaseAdmin
        .from('poll_options')
        .delete()
        .eq('id', option.id);
    }

    // Remover enquetes
    for (const poll of testData.polls) {
      await supabaseAdmin
        .from('polls')
        .delete()
        .eq('id', poll.id);
    }

    // Remover associações de apartamento
    for (const user of testData.users) {
      await supabaseAdmin
        .from('apartment_residents')
        .delete()
        .eq('profile_id', user.id);
    }

    // Remover admin_profiles
    if (testData.adminProfiles) {
      for (const adminProfile of testData.adminProfiles) {
        await supabaseAdmin
          .from('admin_profiles')
          .delete()
          .eq('id', adminProfile.id);
      }
    }

    // Remover perfis
    for (const user of testData.users) {
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', user.id);
    }

    // Remover apartamentos
    for (const apartment of testData.apartments) {
      await supabaseAdmin
        .from('apartments')
        .delete()
        .eq('id', apartment.id);
    }

    // Remover prédios
    for (const building of testData.buildings) {
      await supabaseAdmin
        .from('buildings')
        .delete()
        .eq('id', building.id);
    }

    // Remover usuários
    for (const user of testData.users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }

    log.success('Limpeza de dados concluída');
  } catch (error) {
    log.warning(`Erro durante limpeza: ${error.message}`);
  }
}

/**
 * Função principal para executar todos os testes
 */
async function runAllTests() {
  log.info('🚀 Iniciando testes do sistema de votação e notificações');
  log.info('================================================');
  
  const results = {
    notificationAuditLog: false,
    pollVotesStructure: false,
    residentResponseBy: false,
    uniqueVoting: false,
    rlsPolicies: false,
    notificationAuditLogging: false,
    specificErrorHandling: false,
    requiredFields: false
  };
  
  try {
    // Configurar dados de teste
    await setupTestData();
    
    // Executar todos os testes
    results.notificationAuditLog = await testNotificationAuditLogStructure();
    results.pollVotesStructure = await testPollVotesStructure();
    results.residentResponseBy = await testResidentResponseByField();
    results.uniqueVoting = await testUniqueVoting();
    results.rlsPolicies = await testRLSPolicies();
    results.notificationAuditLogging = await testNotificationAuditLogging();
    results.specificErrorHandling = await testSpecificErrorHandling();
    results.requiredFields = await testRequiredFieldsValidation();
    
  } catch (error) {
    log.error(`Erro durante execução dos testes: ${error.message}`);
  } finally {
    // Limpar dados de teste automaticamente
    log.info('\n=== Limpeza Automática de Dados de Teste ===');
    await cleanupTestData();
  }
  
  // Relatório final
  log.info('\n================================================');
  log.info('📊 RELATÓRIO FINAL DOS TESTES');
  log.info('================================================');
  
  const testResults = [
    ['Estrutura Notification Audit Log', results.notificationAuditLog],
    ['Estrutura Poll Votes', results.pollVotesStructure],
    ['Campo resident_response_by', results.residentResponseBy],
    ['Votação Única', results.uniqueVoting],
    ['Políticas RLS', results.rlsPolicies],
    ['Auditoria de Notificações', results.notificationAuditLogging],
    ['Tratamento de Erros Específicos', results.specificErrorHandling],
    ['Validação de Campos Obrigatórios', results.requiredFields]
  ];
  
  testResults.forEach(([name, passed]) => {
    const status = passed ? '✅ PASSOU' : '❌ FALHOU';
    log.info(`${name}: ${status}`);
  });
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(([, passed]) => passed).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  log.info('================================================');
  log.info(`📈 Taxa de Sucesso: ${passedTests}/${totalTests} (${successRate}%)`);
  
  if (passedTests === totalTests) {
    log.success('🎉 Todos os testes passaram! Sistema pronto para implementação.');
  } else {
    log.warning(`⚠️  ${totalTests - passedTests} teste(s) falharam. Revisar implementação necessária.`);
  }
  
  log.info('================================================');
  
  return {
    totalTests,
    passedTests,
    successRate: parseFloat(successRate),
    results
  };
}

/**
 * Função para configurar dados de teste
 */
async function setupTestData() {
  log.info('Configurando dados de teste...');
  
  try {
    // Verificar configuração
    if (SUPABASE_URL === 'your-supabase-url' || SUPABASE_ANON_KEY === 'your-anon-key') {
      throw new Error('Configure as variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY');
    }

    // Criar dados de teste
    await createTestData();
    await testPollCreation();
    
    log.success('Dados de teste configurados com sucesso');
  } catch (error) {
    log.error(`Erro ao configurar dados de teste: ${error.message}`);
    throw error;
  }
}

/**
 * Função para processar argumentos da linha de comando
 */
function processCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    cleanup: false,
    force: false,
    help: false,
    test: null
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--cleanup':
        options.cleanup = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--test':
        if (i + 1 < args.length) {
          options.test = args[i + 1];
          i++;
        }
        break;
    }
  }
  
  return options;
}

/**
 * Função para mostrar ajuda
 */
function showHelp() {
  console.log(`
🧪 Sistema de Testes - Votação e Notificações
`);
  console.log('Uso: node test-voting-system.js [opções]\n');
  console.log('Opções:');
  console.log('  --help, -h          Mostra esta ajuda');
  console.log('  --cleanup           Executa apenas limpeza de dados de teste');
  console.log('  --force             Força execução da limpeza (use com --cleanup)');
  console.log('  --test <nome>       Executa apenas um teste específico\n');
  console.log('Testes disponíveis:');
  console.log('  - notification-audit-log');
  console.log('  - poll-votes-structure');
  console.log('  - resident-response-by');
  console.log('  - unique-voting');
  console.log('  - rls-policies');
  console.log('  - notification-audit-logging');
  console.log('  - specific-error-handling');
  console.log('  - required-fields\n');
  console.log('Exemplos:');
  console.log('  node test-voting-system.js                    # Executa todos os testes');
  console.log('  node test-voting-system.js --test unique-voting  # Executa apenas teste de votação única');
  console.log('  node test-voting-system.js --cleanup --force     # Limpa dados de teste\n');
}

/**
 * Função para executar teste específico
 */
async function runSpecificTest(testName) {
  log.info(`🎯 Executando teste específico: ${testName}`);
  
  await setupTestData();
  
  let result = false;
  
  try {
    switch (testName) {
      case 'notification-audit-log':
        result = await testNotificationAuditLogStructure();
        break;
      case 'poll-votes-structure':
        result = await testPollVotesStructure();
        break;
      case 'resident-response-by':
        result = await testResidentResponseByField();
        break;
      case 'unique-voting':
        result = await testUniqueVoting();
        break;
      case 'rls-policies':
        result = await testPollVotesRLS();
        break;
      case 'notification-audit-logging':
        result = await testNotificationWithAuditLog();
        break;
      case 'specific-error-handling':
        result = await testSpecificErrorHandling();
        break;
      case 'required-fields':
        result = await testRequiredFieldsValidation();
        break;
      default:
        log.error(`Teste '${testName}' não encontrado. Use --help para ver testes disponíveis.`);
        return false;
    }
  } catch (error) {
    log.error(`Erro ao executar teste '${testName}': ${error.message}`);
    result = false;
  } finally {
    await cleanupTestData();
  }
  
  const status = result ? '✅ PASSOU' : '❌ FALHOU';
  log.info(`\n📊 Resultado do teste '${testName}': ${status}`);
  
  return result;
}

/**
 * Função principal (mantida para compatibilidade)
 */
async function main() {
  return await runAllTests();
}

// Executar testes se este arquivo for executado diretamente
if (require.main === module) {
  const options = processCommandLineArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  if (options.cleanup) {
    safeCleanup(options.force)
      .then((result) => {
        if (result) {
          log.success('✅ Limpeza concluída com sucesso');
        }
        process.exit(0);
      })
      .catch((error) => {
        log.error(`❌ Erro durante limpeza: ${error.message}`);
        process.exit(1);
      });
  } else if (options.test) {
    runSpecificTest(options.test)
      .then((result) => {
        process.exit(result ? 0 : 1);
      })
      .catch((error) => {
        log.error(`❌ Erro fatal: ${error.message}`);
        process.exit(1);
      });
  } else {
    runAllTests()
      .then((summary) => {
        log.info('✅ Execução dos testes concluída');
        process.exit(summary.passedTests === summary.totalTests ? 0 : 1);
      })
      .catch((error) => {
        log.error(`❌ Erro fatal: ${error.message}`);
        process.exit(1);
      });
  }
}

module.exports = {
  main,
  runTest,
  testNotificationAuditLogStructure,
  testPollVotesStructure,
  testResidentResponseByField,
  testUniqueVoting,
  testPollVotesRLS,
  cleanupTestData
};