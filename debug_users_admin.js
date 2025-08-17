const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use SERVICE_ROLE key para bypass RLS
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Precisa desta chave

if (!supabaseServiceKey) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env');
  console.log('Tentando com ANON_KEY...');
}

const supabase = createClient(
  supabaseUrl, 
  supabaseServiceKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function debugUsers() {
  console.log('=== DEBUG ADMIN: Verificando usuários com privilégios administrativos ===');
  console.log('URL:', supabaseUrl);
  console.log('Usando SERVICE_ROLE:', !!supabaseServiceKey);
  
  try {
    // Verificar todos os usuários
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.log('❌ Erro ao buscar usuários:', usersError);
    } else {
      console.log(`✅ Total de usuários encontrados: ${users?.length || 0}`);
      if (users && users.length > 0) {
        users.forEach(user => {
          console.log(`- ${user.email} (${user.user_type}) - Ativo: ${user.is_active}`);
        });
      }
    }
    
    // Verificar admin específico
    console.log('\n=== VERIFICANDO admin@teste.com ===');
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@teste.com')
      .maybeSingle();
    
    if (adminError) {
      console.log('❌ Erro ao buscar admin:', adminError);
    } else if (admin) {
      console.log('✅ Admin encontrado:', {
        email: admin.email,
        user_type: admin.user_type,
        is_active: admin.is_active,
        password_hash: admin.password_hash?.substring(0, 20) + '...',
        condominium_id: admin.condominium_id
      });
    } else {
      console.log('❌ Admin não encontrado!');
    }
    
    // Verificar estrutura hierárquica
    console.log('\n=== VERIFICANDO ESTRUTURA HIERÁRQUICA ===');
    const { data: condos } = await supabase.from('condominiums').select('*');
    const { data: buildings } = await supabase.from('buildings').select('*');
    const { data: apartments } = await supabase.from('apartments').select('*');
    
    console.log(`Condomínios: ${condos?.length || 0}`);
    console.log(`Prédios: ${buildings?.length || 0}`);
    console.log(`Apartamentos: ${apartments?.length || 0}`);
    
    if (condos && condos.length > 0) {
      condos.forEach(condo => {
        console.log(`- Condomínio: ${condo.name} (ID: ${condo.id})`);
      });
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error);
  }
  
  console.log('\n=== DEBUG ADMIN CONCLUÍDO ===');
}

debugUsers();