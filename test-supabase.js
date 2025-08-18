const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://gfzhcjpbqsjzocgxerwa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmemhjanBicXNqem9jZ3hlcndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzOTU4MzEsImV4cCI6MjA3MDk3MTgzMX0.GDR9aWb0AMlGuf0mVk8vEborixtGNQZavy3KwIz-O6c';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('🔍 Testando conexão com Supabase...');
  
  try {
    // Testar conexão básica
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Erro ao conectar:', error.message);
      return;
    }
    
    console.log('✅ Conexão bem-sucedida!');
    console.log(`📊 Encontrados ${data.length} perfis no banco:`);
    
    data.forEach((profile, index) => {
      console.log(`${index + 1}. Email: ${profile.email}, Tipo: ${profile.user_type}, Ativo: ${profile.is_active}`);
    });
    
    // Verificar se existe um usuário morador
    const moradores = data.filter(p => p.user_type === 'morador');
    if (moradores.length > 0) {
      console.log('\n🏠 Usuários moradores encontrados:');
      moradores.forEach((morador, index) => {
        console.log(`${index + 1}. ${morador.email} (Ativo: ${morador.is_active})`);
      });
    } else {
      console.log('\n⚠️  Nenhum usuário morador encontrado no banco de dados');
      console.log('💡 Criando usuário de teste...');
      await createTestUser();
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

async function createTestUser() {
  try {
    // Primeiro, criar o usuário na autenticação
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'morador1@teste.com',
      password: '123456',
    });
    
    if (authError) {
      console.error('❌ Erro ao criar usuário de autenticação:', authError.message);
      return;
    }
    
    console.log('✅ Usuário de autenticação criado');
    
    // Aguardar um pouco para o trigger do banco criar o perfil
    setTimeout(async () => {
      // Verificar se o perfil foi criado e atualizar
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'morador1@teste.com')
        .single();
      
      if (profileError) {
        console.error('❌ Erro ao buscar perfil:', profileError.message);
        return;
      }
      
      // Atualizar o perfil para ser morador
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          user_type: 'morador',
          is_active: true,
          condominium_id: '1',
          building_id: '1',
          apartment_id: '101'
        })
        .eq('id', profile.id);
      
      if (updateError) {
        console.error('❌ Erro ao atualizar perfil:', updateError.message);
        return;
      }
      
      console.log('✅ Usuário morador de teste criado com sucesso!');
      console.log('📧 Email: morador1@teste.com');
      console.log('🔑 Senha: 123456');
      
    }, 2000);
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário de teste:', error);
  }
}

// Executar teste
testConnection();