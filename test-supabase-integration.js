const { supabase, signIn, signOut, getAdminProfile, getAdminBuildings, getCurrentAdmin } = require('./utils/supabase');

async function testSupabaseIntegration() {
  console.log('🔍 Testando integração com Supabase...');
  console.log('=' .repeat(50));

  try {
    // 1. Testar conexão básica
    console.log('\n1. Testando conexão básica com o banco...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('admin_profiles')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ Erro na conexão:', connectionError.message);
      return;
    }
    console.log('✅ Conexão com o banco estabelecida com sucesso!');

    // 2. Testar busca de perfis de administrador
    console.log('\n2. Testando busca de perfis de administrador...');
    const { data: adminProfiles, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .limit(5);
    
    if (adminError) {
      console.error('❌ Erro ao buscar perfis de admin:', adminError.message);
    } else {
      console.log(`✅ Encontrados ${adminProfiles.length} perfis de administrador`);
      if (adminProfiles.length > 0) {
        console.log('   Exemplo:', {
          id: adminProfiles[0].id,
          name: adminProfiles[0].name,
          email: adminProfiles[0].email
        });
      }
    }

    // 3. Testar busca de edifícios
    console.log('\n3. Testando busca de edifícios...');
    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('*')
      .limit(5);
    
    if (buildingsError) {
      console.error('❌ Erro ao buscar edifícios:', buildingsError.message);
    } else {
      console.log(`✅ Encontrados ${buildings.length} edifícios`);
      if (buildings.length > 0) {
        console.log('   Exemplo:', {
          id: buildings[0].id,
          name: buildings[0].name,
          address: buildings[0].address
        });
      }
    }

    // 4. Testar funções de autenticação (disponibilidade)
    console.log('\n4. Testando disponibilidade das funções de autenticação...');
    const authFunctions = {
      signIn: typeof signIn === 'function',
      signOut: typeof signOut === 'function',
      getAdminProfile: typeof getAdminProfile === 'function',
      getAdminBuildings: typeof getAdminBuildings === 'function',
      getCurrentAdmin: typeof getCurrentAdmin === 'function'
    };

    console.log('Funções disponíveis:');
    Object.entries(authFunctions).forEach(([func, available]) => {
      console.log(`   ${available ? '✅' : '❌'} ${func}`);
    });

    // 5. Testar configuração do cliente Supabase
    console.log('\n5. Verificando configuração do cliente Supabase...');
    console.log('   URL configurada:', supabase.supabaseUrl ? '✅' : '❌');
    console.log('   Chave anônima configurada:', supabase.supabaseKey ? '✅' : '❌');

    // 6. Testar relacionamentos entre tabelas
    console.log('\n6. Testando relacionamentos entre tabelas...');
    const { data: buildingAdmins, error: relationError } = await supabase
      .from('building_admins')
      .select(`
        *,
        admin_profiles(*),
        buildings(*)
      `)
      .limit(3);
    
    if (relationError) {
      console.error('❌ Erro ao testar relacionamentos:', relationError.message);
    } else {
      console.log(`✅ Relacionamentos funcionando - ${buildingAdmins.length} registros encontrados`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Teste de integração concluído com sucesso!');
    console.log('\n💡 Próximos passos:');
    console.log('   - Implementar telas de login');
    console.log('   - Configurar autenticação de usuários');
    console.log('   - Testar fluxo completo de autenticação');

  } catch (error) {
    console.error('\n💥 Erro inesperado durante o teste:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Executar o teste
if (require.main === module) {
  testSupabaseIntegration()
    .then(() => {
      console.log('\n✨ Teste finalizado.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Falha crítica no teste:', error.message);
      process.exit(1);
    });
}

module.exports = { testSupabaseIntegration };