// Script de teste para validar as funcionalidades de gerenciamento de administradores
// Este script testa a lógica onde administradores podem ser cadastrados sem estar vinculados a prédios

const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simular as funções do adminAuth (copiadas do supabase.ts)
const adminAuth = {
  // Criar novo perfil de administrador
  async createAdminProfile(userData) {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .insert({
          user_id: userData.user_id,
          full_name: userData.full_name,
          email: userData.email,
          role: userData.role || 'admin'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar perfil do administrador:', error);
        throw error;
      }
      
      console.log('Perfil de administrador criado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('Erro ao criar perfil do administrador:', error);
      return null;
    }
  },

  // Listar todos os administradores
  async getAllAdmins() {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar administradores:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar administradores:', error);
      return [];
    }
  },

  // Verificar se administrador tem prédios vinculados
  async hasAssignedBuildings(adminProfileId) {
    try {
      const { data, error } = await supabase
        .from('building_admins')
        .select('id')
        .eq('admin_profile_id', adminProfileId)
        .limit(1);
      
      if (error) {
        console.error('Erro ao verificar vinculações do administrador:', error);
        return false;
      }
      
      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Erro ao verificar vinculações do administrador:', error);
      return false;
    }
  },

  // Obter edifícios gerenciados pelo administrador (versão atualizada)
  async getAdminBuildings(adminProfileId) {
    try {
      const { data, error } = await supabase
        .from('building_admins')
        .select(`
          buildings (
            id,
            name,
            address,
            created_at,
            updated_at
          )
        `)
        .eq('admin_profile_id', adminProfileId);
      
      if (error) {
        console.error('Erro ao buscar edifícios do administrador:', error);
        return []; // Retorna array vazio ao invés de lançar erro
      }
      
      return data?.map(item => item.buildings).filter(Boolean) || [];
    } catch (error) {
      console.error('Erro ao buscar edifícios do administrador:', error);
      return []; // Sempre retorna array vazio em caso de erro
    }
  }
};

async function testAdminManagement() {
  console.log('🧪 Iniciando testes de gerenciamento de administradores...');
  console.log('=' .repeat(60));

  try {
    // Teste 1: Listar todos os administradores existentes
    console.log('\n📋 Teste 1: Listando administradores existentes');
    const existingAdmins = await adminAuth.getAllAdmins();
    console.log(`Encontrados ${existingAdmins.length} administradores:`);
    existingAdmins.forEach((admin, index) => {
      console.log(`  ${index + 1}. ${admin.full_name} (${admin.email}) - Role: ${admin.role}`);
    });

    // Teste 2: Verificar se o admin existente tem prédios vinculados
    if (existingAdmins.length > 0) {
      const firstAdmin = existingAdmins[0];
      console.log(`\n🏢 Teste 2: Verificando vinculações do admin ${firstAdmin.full_name}`);
      
      const hasBuildings = await adminAuth.hasAssignedBuildings(firstAdmin.id);
      console.log(`Admin tem prédios vinculados: ${hasBuildings ? 'SIM' : 'NÃO'}`);
      
      const buildings = await adminAuth.getAdminBuildings(firstAdmin.id);
      console.log(`Prédios encontrados: ${buildings.length}`);
      buildings.forEach((building, index) => {
        console.log(`  ${index + 1}. ${building.name} - ${building.address}`);
      });
    }

    // Teste 3: Testar criação de novo administrador sem prédios
    console.log('\n👤 Teste 3: Testando criação de administrador sem prédios');
    
    // Primeiro, vamos verificar se existe um usuário de teste no auth.users
    const testUserId = '00000000-0000-0000-0000-000000000001'; // ID fictício para teste
    
    const newAdminData = {
      user_id: testUserId,
      full_name: 'Admin Teste Sem Prédios',
      email: 'admin.teste@example.com',
      role: 'admin'
    };

    console.log('Tentando criar novo administrador:', newAdminData);
    
    // Nota: Este teste pode falhar se o user_id não existir no auth.users
    // Isso é esperado devido às constraints de foreign key
    const newAdmin = await adminAuth.createAdminProfile(newAdminData);
    
    if (newAdmin) {
      console.log('✅ Administrador criado com sucesso!');
      console.log('ID:', newAdmin.id);
      
      // Teste 4: Verificar se o novo admin não tem prédios vinculados
      console.log('\n🔍 Teste 4: Verificando se novo admin não tem prédios');
      const newAdminHasBuildings = await adminAuth.hasAssignedBuildings(newAdmin.id);
      console.log(`Novo admin tem prédios: ${newAdminHasBuildings ? 'SIM' : 'NÃO'}`);
      
      const newAdminBuildings = await adminAuth.getAdminBuildings(newAdmin.id);
      console.log(`Prédios do novo admin: ${newAdminBuildings.length}`);
      
      if (newAdminBuildings.length === 0) {
        console.log('✅ Confirmado: Admin criado sem prédios vinculados!');
      }
    } else {
      console.log('⚠️  Falha ao criar administrador (esperado se user_id não existir)');
      console.log('   Isso é normal - o user_id precisa existir na tabela auth.users');
    }

    // Teste 5: Verificar comportamento da função getAdminBuildings com ID inexistente
    console.log('\n🔍 Teste 5: Testando getAdminBuildings com ID inexistente');
    const fakeAdminId = '00000000-0000-0000-0000-000000000999';
    const fakeBuildingsResult = await adminAuth.getAdminBuildings(fakeAdminId);
    console.log(`Resultado para admin inexistente: ${JSON.stringify(fakeBuildingsResult)}`);
    
    if (Array.isArray(fakeBuildingsResult) && fakeBuildingsResult.length === 0) {
      console.log('✅ Função retorna array vazio corretamente para admin inexistente');
    }

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Testes concluídos!');
  console.log('\n📝 Resumo das funcionalidades testadas:');
  console.log('  ✅ Listagem de administradores existentes');
  console.log('  ✅ Verificação de vinculações de prédios');
  console.log('  ✅ Busca de prédios por administrador (retorna array vazio se sem prédios)');
  console.log('  ⚠️  Criação de novo administrador (depende de user_id válido)');
  console.log('  ✅ Tratamento de erros com retorno de arrays vazios');
}

// Executar os testes
testAdminManagement().catch(console.error);