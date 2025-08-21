const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usando service role para acessar auth.users
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  console.log('EXPO_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  process.exit(1);
}

// Cliente com service role para acessar tabelas do sistema
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
// Cliente normal para testar autenticação
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL_TESTE = 'douglas@dev.com';
const SENHA_TESTE = 'douglas123';

async function debugAdminLogin() {
  console.log('🔍 DIAGNÓSTICO DE LOGIN DO ADMINISTRADOR');
  console.log('='.repeat(50));
  console.log(`Email de teste: ${EMAIL_TESTE}`);
  console.log(`Senha de teste: ${SENHA_TESTE}`);
  console.log('');

  try {
    // 1. Verificar se o usuário existe na tabela auth.users
    console.log('1️⃣ Verificando usuário na tabela auth.users...');
    const { data: authUsers, error: authError } = await supabaseAdmin
      .from('auth.users')
      .select('id, email, created_at, email_confirmed_at, last_sign_in_at')
      .eq('email', EMAIL_TESTE);

    if (authError) {
      console.error('❌ Erro ao consultar auth.users:', authError.message);
      // Tentar método alternativo usando RPC ou auth admin
      console.log('🔄 Tentando método alternativo...');

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
      if (userError) {
        console.error('❌ Erro ao listar usuários:', userError.message);
      } else {
        const user = userData.users.find((u) => u.email === EMAIL_TESTE);
        if (user) {
          console.log('✅ Usuário encontrado via admin.listUsers:');
          console.log(`   ID: ${user.id}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Criado em: ${user.created_at}`);
          console.log(`   Email confirmado: ${user.email_confirmed_at || 'Não confirmado'}`);
          console.log(`   Último login: ${user.last_sign_in_at || 'Nunca'}`);
        } else {
          console.log('❌ Usuário não encontrado na tabela auth.users');
          return;
        }
      }
    } else if (!authUsers || authUsers.length === 0) {
      console.log('❌ Usuário não encontrado na tabela auth.users');
      return;
    } else {
      const user = authUsers[0];
      console.log('✅ Usuário encontrado na auth.users:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Criado em: ${user.created_at}`);
      console.log(`   Email confirmado: ${user.email_confirmed_at || 'Não confirmado'}`);
      console.log(`   Último login: ${user.last_sign_in_at || 'Nunca'}`);
    }

    console.log('');

    // 2. Verificar se existe perfil na tabela admin_profiles
    console.log('2️⃣ Verificando perfil na tabela admin_profiles...');
    const { data: adminProfiles, error: profileError } = await supabaseAdmin
      .from('admin_profiles')
      .select('*')
      .eq('email', EMAIL_TESTE);

    if (profileError) {
      console.error('❌ Erro ao consultar admin_profiles:', profileError.message);
    } else if (!adminProfiles || adminProfiles.length === 0) {
      console.log('❌ Perfil de administrador não encontrado na tabela admin_profiles');
      console.log('💡 Isso pode ser a causa do problema de login!');
    } else {
      const profile = adminProfiles[0];
      console.log('✅ Perfil de administrador encontrado:');
      console.log(`   ID: ${profile.id}`);
      console.log(`   User ID: ${profile.user_id}`);
      console.log(`   Nome: ${profile.name}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Criado em: ${profile.created_at}`);
    }

    console.log('');

    // 3. Testar autenticação direta
    console.log('3️⃣ Testando autenticação direta...');
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: EMAIL_TESTE,
      password: SENHA_TESTE,
    });

    if (signInError) {
      console.error('❌ Erro na autenticação:', signInError.message);
      console.log('   Código do erro:', signInError.status);
      console.log('   Detalhes:', signInError);
    } else {
      console.log('✅ Autenticação bem-sucedida!');
      console.log(`   User ID: ${signInData.user?.id}`);
      console.log(`   Email: ${signInData.user?.email}`);
      console.log(`   Token válido até: ${signInData.session?.expires_at}`);

      // 4. Verificar se consegue buscar o perfil após login
      console.log('');
      console.log('4️⃣ Verificando busca do perfil após login...');

      const { data: profileAfterLogin, error: profileAfterError } = await supabaseClient
        .from('admin_profiles')
        .select('*')
        .eq('user_id', signInData.user.id)
        .single();

      if (profileAfterError) {
        console.error('❌ Erro ao buscar perfil após login:', profileAfterError.message);
        console.log('💡 Este pode ser o problema: usuário autenticado mas sem perfil de admin!');
      } else {
        console.log('✅ Perfil encontrado após login:');
        console.log(`   Nome: ${profileAfterLogin.name}`);
        console.log(`   Email: ${profileAfterLogin.email}`);
      }

      // Fazer logout
      await supabaseClient.auth.signOut();
    }

    console.log('');

    // 5. Verificar permissões da tabela admin_profiles
    console.log('5️⃣ Verificando permissões da tabela admin_profiles...');
    const { error: permError } = await supabaseAdmin
      .rpc('check_table_permissions', { table_name: 'admin_profiles' })
      .catch(() => null); // Ignora erro se a função não existir

    if (permError) {
      console.log('⚠️  Não foi possível verificar permissões automaticamente');
    }

    // Tentar consulta simples como usuário anônimo
    const { error: anonError } = await supabaseClient
      .from('admin_profiles')
      .select('count')
      .limit(1);

    if (anonError) {
      console.log('❌ Usuário anônimo não tem acesso à tabela admin_profiles');
      console.log('   Erro:', anonError.message);
      console.log('💡 Verifique as políticas RLS da tabela admin_profiles');
    } else {
      console.log('✅ Usuário anônimo tem acesso básico à tabela admin_profiles');
    }

    console.log('');

    // 6. Listar todos os administradores para debug
    console.log('6️⃣ Listando todos os administradores cadastrados...');
    const { data: allAdmins, error: allAdminsError } = await supabaseAdmin
      .from('admin_profiles')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false });

    if (allAdminsError) {
      console.error('❌ Erro ao listar administradores:', allAdminsError.message);
    } else {
      console.log(`✅ Total de administradores: ${allAdmins.length}`);
      allAdmins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.name} (${admin.email}) - ${admin.created_at}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro geral no diagnóstico:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('');
  console.log('🏁 DIAGNÓSTICO CONCLUÍDO');
  console.log('='.repeat(50));
}

// Executar diagnóstico
debugAdminLogin()
  .then(() => {
    console.log('\n✅ Script de diagnóstico executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal no script:', error.message);
    process.exit(1);
  });
