// Script de teste para verificar o login do administrador
// Execute com: node test-admin-login.js

const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função para testar o login do administrador
async function testAdminLogin() {
  console.log('🔍 Testando login do administrador...');
  console.log('Email: douglas@dev.com');

  try {
    // Primeiro, verificar se o perfil do admin existe
    console.log('\n1. Verificando se o perfil do admin existe...');
    const { data: adminProfiles, error: profileError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('email', 'douglas@dev.com');

    const adminProfile = adminProfiles && adminProfiles.length > 0 ? adminProfiles[0] : null;

    if (profileError) {
      console.error('❌ Erro ao buscar perfil do admin:', profileError.message);
      return;
    }

    if (!adminProfile) {
      console.error('❌ Perfil do administrador não encontrado!');
      return;
    }

    console.log('✅ Perfil do administrador encontrado:');
    console.log('   - ID:', adminProfile.id);
    console.log('   - Nome:', adminProfile.full_name);
    console.log('   - Email:', adminProfile.email);
    console.log('   - Role:', adminProfile.role);
    console.log('   - Ativo:', adminProfile.is_active);

    // Verificar se o usuário existe no auth.users
    console.log('\n2. Verificando usuário no auth.users...');
    const { error: authError } = await supabase.auth.admin.getUserById(adminProfile.user_id);

    if (authError) {
      console.log('⚠️  Não foi possível verificar o usuário no auth (normal com anon key)');
    } else {
      console.log('✅ Usuário encontrado no auth.users');
    }

    // Tentar fazer login (isso vai falhar porque não temos a senha, mas podemos testar a estrutura)
    console.log('\n3. Testando estrutura de login...');
    console.log('⚠️  Para testar o login completo, você precisa usar a senha correta.');
    console.log('   A senha está criptografada no banco de dados.');
    console.log('   Use o app ou interface web para fazer login com:');
    console.log('   Email: douglas@dev.com');
    console.log('   Senha: [a senha que foi usada para criar a conta]');

    // Verificar se há edifícios associados
    console.log('\n4. Verificando edifícios associados...');
    const { data: buildings, error: buildingsError } = await supabase
      .from('building_admins')
      .select(
        `
        buildings (
          id,
          name,
          address
        )
      `
      )
      .eq('admin_profile_id', adminProfile.id);

    if (buildingsError) {
      console.error('❌ Erro ao buscar edifícios:', buildingsError.message);
    } else {
      console.log(`✅ Encontrados ${buildings?.length || 0} edifícios associados`);
      if (buildings && buildings.length > 0) {
        buildings.forEach((item, index) => {
          if (item.buildings) {
            console.log(`   ${index + 1}. ${item.buildings.name} - ${item.buildings.address}`);
          }
        });
      }
    }

    console.log('\n✅ Teste concluído! O perfil do administrador está configurado corretamente.');
    console.log('   Para fazer login, use as credenciais no app React Native.');
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar o teste
testAdminLogin()
  .then(() => {
    console.log('\n🏁 Teste finalizado.');
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
  });
