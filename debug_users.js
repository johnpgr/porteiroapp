const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuração do Supabase
const supabaseUrl = 'https://gfzhcjpbqsjzocgxerwa.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmemhjanBicXNqem9jZ3hlcndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzOTU4MzEsImV4cCI6MjA3MDk3MTgzMX0.GDR9aWb0AMlGuf0mVk8vEborixtGNQZavy3KwIz-O6c';

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para gerar hash SHA-256
function generateHash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function debugUsers() {
  console.log('=== DEBUG: Verificando usuários na tabela users ===');
  
  try {
    // 1. Verificar todos os usuários
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('*');
    
    if (allError) {
      console.error('Erro ao buscar usuários:', allError);
      return;
    }
    
    console.log(`\nTotal de usuários encontrados: ${allUsers?.length || 0}`);
    
    if (allUsers && allUsers.length > 0) {
      console.log('\n=== TODOS OS USUÁRIOS ===');
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Nome: ${user.name}`);
        console.log(`   Tipo: ${user.user_type}`);
        console.log(`   Ativo: ${user.is_active}`);
        console.log(`   Hash da senha: ${user.password_hash?.substring(0, 20)}...`);
        console.log(`   Condomínio ID: ${user.condominium_id}`);
        console.log(`   Prédio ID: ${user.building_id}`);
        console.log('   ---');
      });
    }
    
    // 2. Verificar especificamente o usuário admin@teste.com
    console.log('\n=== VERIFICANDO admin@teste.com ===');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@teste.com')
      .single();
    
    if (adminError) {
      console.error('Erro ao buscar admin@teste.com:', adminError);
      console.log('USUÁRIO NÃO ENCONTRADO!');
    } else if (adminUser) {
      console.log('USUÁRIO ENCONTRADO:');
      console.log('Email:', adminUser.email);
      console.log('Nome:', adminUser.name);
      console.log('Tipo:', adminUser.user_type);
      console.log('Ativo:', adminUser.is_active);
      console.log('Hash armazenado:', adminUser.password_hash);
      
      // 3. Verificar se o hash da senha está correto
      const expectedHash = generateHash('admin123');
      console.log('Hash esperado:', expectedHash);
      console.log('Hashes coincidem:', adminUser.password_hash === expectedHash);
      
      // 4. Verificar hierarquia
      console.log('Condomínio ID:', adminUser.condominium_id);
      console.log('Prédio ID:', adminUser.building_id);
    }
    
    // 5. Verificar se existe condomínio e prédio de teste
    console.log('\n=== VERIFICANDO ESTRUTURA HIERÁRQUICA ===');
    const { data: condominiums } = await supabase
      .from('condominiums')
      .select('*');
    
    console.log(`Condomínios encontrados: ${condominiums?.length || 0}`);
    if (condominiums && condominiums.length > 0) {
      condominiums.forEach(cond => {
        console.log(`- ${cond.name} (ID: ${cond.id})`);
      });
    }
    
    const { data: buildings } = await supabase
      .from('buildings')
      .select('*');
    
    console.log(`Prédios encontrados: ${buildings?.length || 0}`);
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        console.log(`- ${building.name} (ID: ${building.id})`);
      });
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

// Executar debug
debugUsers().then(() => {
  console.log('\n=== DEBUG CONCLUÍDO ===');
  process.exit(0);
}).catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});