const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

// Cliente com service role para operações administrativas
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const EMAIL_ADMIN = 'douglas@dev.com';
const NOVA_SENHA = 'douglas123';
const USER_ID = '2dce9e93-61c0-4d66-b765-8f4d4220b25b';

async function resetAdminPassword() {
  console.log('🔐 REDEFININDO SENHA DO ADMINISTRADOR');
  console.log('=' .repeat(50));
  console.log(`Email: ${EMAIL_ADMIN}`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`Nova senha: ${NOVA_SENHA}`);
  console.log('');

  try {
    // 1. Verificar se o usuário existe
    console.log('1️⃣ Verificando usuário...');
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(USER_ID);
    
    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError.message);
      return;
    }
    
    if (!userData.user) {
      console.error('❌ Usuário não encontrado');
      return;
    }
    
    console.log('✅ Usuário encontrado:');
    console.log(`   Email: ${userData.user.email}`);
    console.log(`   ID: ${userData.user.id}`);
    console.log('');

    // 2. Redefinir a senha
    console.log('2️⃣ Redefinindo senha...');
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      USER_ID,
      {
        password: NOVA_SENHA
      }
    );

    if (updateError) {
      console.error('❌ Erro ao redefinir senha:', updateError.message);
      return;
    }

    console.log('✅ Senha redefinida com sucesso!');
    console.log('');

    // 3. Testar login com a nova senha
    console.log('3️⃣ Testando login com nova senha...');
    
    // Criar cliente normal para teste
    const supabaseClient = createClient(supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: EMAIL_ADMIN,
      password: NOVA_SENHA
    });

    if (signInError) {
      console.error('❌ Erro no teste de login:', signInError.message);
    } else {
      console.log('✅ Login testado com sucesso!');
      console.log(`   User ID: ${signInData.user?.id}`);
      console.log(`   Email: ${signInData.user?.email}`);
      
      // Fazer logout
      await supabaseClient.auth.signOut();
    }

    console.log('');
    console.log('🎉 PROCESSO CONCLUÍDO!');
    console.log('Agora você pode fazer login com:');
    console.log(`Email: ${EMAIL_ADMIN}`);
    console.log(`Senha: ${NOVA_SENHA}`);

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Executar redefinição de senha
resetAdminPassword().then(() => {
  console.log('\n✅ Script executado com sucesso!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erro fatal no script:', error.message);
  process.exit(1);
});