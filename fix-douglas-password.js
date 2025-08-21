const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Chave de serviço para operações admin
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas!');
  console.log('Necessário: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Cliente com chave de serviço (para operações admin)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente normal (para testes de login)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL_TESTE = 'douglas@dev.com';
const SENHAS_TESTE = [
  'douglas123',
  'admin123',
  'douglas2024',
  '123456',
  'password',
  'admin',
  'douglas',
  'test123'
];

async function diagnosticarECorrigirLogin() {
  console.log('🔍 Iniciando diagnóstico do usuário:', EMAIL_TESTE);
  console.log('=' .repeat(50));

  try {
    // 1. Verificar se o usuário existe no Supabase Auth
    console.log('\n1️⃣ Verificando se o usuário existe no Supabase Auth...');
    
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError.message);
      return;
    }

    const usuario = users.users.find(user => user.email === EMAIL_TESTE);
    
    if (!usuario) {
      console.log('❌ Usuário não encontrado no Supabase Auth');
      console.log('\n🔧 Criando usuário...');
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL_TESTE,
        password: 'douglas123',
        email_confirm: true
      });
      
      if (createError) {
        console.error('❌ Erro ao criar usuário:', createError.message);
        return;
      }
      
      console.log('✅ Usuário criado com sucesso!');
      console.log('📧 Email:', newUser.user.email);
      console.log('🆔 ID:', newUser.user.id);
      
      // Verificar se precisa criar perfil de admin
      await verificarECriarPerfilAdmin(newUser.user.id);
      
    } else {
      console.log('✅ Usuário encontrado no Supabase Auth');
      console.log('📧 Email:', usuario.email);
      console.log('🆔 ID:', usuario.id);
      console.log('📅 Criado em:', new Date(usuario.created_at).toLocaleString());
      console.log('✉️ Email confirmado:', usuario.email_confirmed_at ? 'Sim' : 'Não');
    }

    // 2. Tentar login com senhas comuns
    console.log('\n2️⃣ Testando login com senhas comuns...');
    
    let loginSucesso = false;
    let senhaFuncional = null;
    
    for (const senha of SENHAS_TESTE) {
      console.log(`\n🔐 Testando senha: ${senha}`);
      
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: EMAIL_TESTE,
        password: senha
      });
      
      if (loginError) {
        console.log(`❌ Falha: ${loginError.message}`);
      } else {
        console.log('✅ Login bem-sucedido!');
        loginSucesso = true;
        senhaFuncional = senha;
        
        // Fazer logout para próximos testes
        await supabase.auth.signOut();
        break;
      }
    }

    // 3. Se nenhuma senha funcionou, resetar para uma conhecida
    if (!loginSucesso) {
      console.log('\n3️⃣ Nenhuma senha comum funcionou. Resetando senha...');
      
      const novaSenha = 'douglas123';
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        usuario.id,
        { password: novaSenha }
      );
      
      if (updateError) {
        console.error('❌ Erro ao resetar senha:', updateError.message);
        return;
      }
      
      console.log('✅ Senha resetada com sucesso para:', novaSenha);
      
      // Testar login com nova senha
      console.log('\n🔐 Testando login com nova senha...');
      
      const { error: novoLoginError } = await supabase.auth.signInWithPassword({
        email: EMAIL_TESTE,
        password: novaSenha
      });
      
      if (novoLoginError) {
        console.error('❌ Falha no login após reset:', novoLoginError.message);
        return;
      }
      
      console.log('✅ Login bem-sucedido com nova senha!');
      senhaFuncional = novaSenha;
      
      // Fazer logout
      await supabase.auth.signOut();
    }

    // 4. Verificar perfil de administrador
    console.log('\n4️⃣ Verificando perfil de administrador...');
    await verificarECriarPerfilAdmin(usuario?.id);

    // 5. Teste final completo
    console.log('\n5️⃣ Teste final do sistema de autenticação...');
    await testeCompletoAutenticacao(EMAIL_TESTE, senhaFuncional);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 DIAGNÓSTICO CONCLUÍDO COM SUCESSO!');
    console.log('📧 Email:', EMAIL_TESTE);
    console.log('🔐 Senha funcional:', senhaFuncional);
    console.log('✅ O usuário pode agora fazer login no sistema');
    
  } catch (error) {
    console.error('❌ Erro durante o diagnóstico:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function verificarECriarPerfilAdmin(userId) {
  try {
    // Verificar se já existe perfil de admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar perfil admin:', profileError.message);
      return;
    }
    
    if (adminProfile) {
      console.log('✅ Perfil de administrador já existe');
      console.log('👤 Nome:', adminProfile.full_name);
      console.log('📧 Email:', adminProfile.email);
      console.log('🔧 Role:', adminProfile.role);
      console.log('✅ Ativo:', adminProfile.is_active ? 'Sim' : 'Não');
    } else {
      console.log('⚠️ Perfil de administrador não encontrado. Criando...');
      
      const { data: newProfile, error: createProfileError } = await supabase
        .from('admin_profiles')
        .insert({
          user_id: userId,
          full_name: 'Douglas Moura',
          email: EMAIL_TESTE,
          role: 'admin',
          is_active: true
        })
        .select()
        .single();
      
      if (createProfileError) {
        console.error('❌ Erro ao criar perfil admin:', createProfileError.message);
        return;
      }
      
      console.log('✅ Perfil de administrador criado com sucesso!');
      console.log('👤 Nome:', newProfile.full_name);
      console.log('📧 Email:', newProfile.email);
    }
  } catch (error) {
    console.error('❌ Erro na verificação do perfil admin:', error.message);
  }
}

async function testeCompletoAutenticacao(email, senha) {
  try {
    console.log('🔐 Fazendo login...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    console.log('🆔 User ID:', loginData.user.id);
    
    // Verificar se é admin
    const { data: adminProfile, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('user_id', loginData.user.id)
      .single();
    
    if (adminError) {
      console.error('❌ Usuário não é administrador:', adminError.message);
    } else {
      console.log('✅ Usuário confirmado como administrador');
      console.log('👤 Nome:', adminProfile.full_name);
    }
    
    // Fazer logout
    await supabase.auth.signOut();
    console.log('✅ Logout realizado');
    
  } catch (error) {
    console.error('❌ Erro no teste completo:', error.message);
  }
}

// Executar o diagnóstico
diagnosticarECorrigirLogin().catch(console.error);