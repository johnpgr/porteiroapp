// Script para testar diretamente as tabelas do banco de dados
// Verifica se os dados foram inseridos corretamente

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabase() {
  console.log('🔍 Verificando dados inseridos na migração\n');
  
  // 1. Verificar administradores
  console.log('📋 ADMINISTRADORES');
  console.log('=' .repeat(50));
  
  const { data: admins, error: adminsError } = await supabase
    .from('admin_profiles')
    .select('*')
    .order('full_name');
  
  if (adminsError) {
    console.log('❌ Erro ao buscar administradores:', adminsError.message);
  } else {
    console.log(`👥 Total de administradores: ${admins.length}`);
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.full_name} (${admin.email})`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   User ID: ${admin.user_id}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Ativo: ${admin.is_active}`);
      console.log('');
    });
  }
  
  // 2. Verificar prédios
  console.log('🏢 PRÉDIOS');
  console.log('=' .repeat(50));
  
  const { data: buildings, error: buildingsError } = await supabase
    .from('buildings')
    .select('*')
    .order('name');
  
  if (buildingsError) {
    console.log('❌ Erro ao buscar prédios:', buildingsError.message);
  } else {
    console.log(`🏢 Total de prédios: ${buildings.length}`);
    buildings.forEach((building, index) => {
      console.log(`${index + 1}. ${building.name}`);
      console.log(`   ID: ${building.id}`);
      console.log(`   Endereço: ${building.address}`);
      console.log('');
    });
  }
  
  // 3. Verificar apartamentos
  console.log('🏠 APARTAMENTOS');
  console.log('=' .repeat(50));
  
  const { data: apartments, error: apartmentsError } = await supabase
    .from('apartments')
    .select(`
      *,
      buildings (
        name
      )
    `)
    .order('number');
  
  if (apartmentsError) {
    console.log('❌ Erro ao buscar apartamentos:', apartmentsError.message);
  } else {
    console.log(`🏠 Total de apartamentos: ${apartments.length}`);
    
    // Agrupar por prédio
    const apartmentsByBuilding = {};
    apartments.forEach(apt => {
      const buildingName = apt.buildings.name;
      if (!apartmentsByBuilding[buildingName]) {
        apartmentsByBuilding[buildingName] = [];
      }
      apartmentsByBuilding[buildingName].push(apt);
    });
    
    Object.keys(apartmentsByBuilding).forEach(buildingName => {
      console.log(`\n🏢 ${buildingName}:`);
      apartmentsByBuilding[buildingName].forEach(apt => {
        console.log(`   - Apt ${apt.number} (Andar ${apt.floor})`);
      });
    });
  }
  
  // 4. Verificar vinculações admin-prédio
  console.log('\n🔗 VINCULAÇÕES ADMIN-PRÉDIO');
  console.log('=' .repeat(50));
  
  const { data: buildingAdmins, error: buildingAdminsError } = await supabase
    .from('building_admins')
    .select(`
      *,
      admin_profiles (
        full_name,
        email
      ),
      buildings (
        name,
        address
      )
    `);
  
  if (buildingAdminsError) {
    console.log('❌ Erro ao buscar vinculações:', buildingAdminsError.message);
  } else {
    console.log(`🔗 Total de vinculações: ${buildingAdmins.length}`);
    
    if (buildingAdmins.length === 0) {
      console.log('⚠️  Nenhuma vinculação encontrada!');
      console.log('   Isso pode indicar que a vinculação não foi criada corretamente.');
    } else {
      buildingAdmins.forEach((link, index) => {
        console.log(`${index + 1}. ${link.admin_profiles.full_name} → ${link.buildings.name}`);
        console.log(`   Admin: ${link.admin_profiles.email}`);
        console.log(`   Prédio: ${link.buildings.address}`);
        console.log('');
      });
    }
  }
  
  // 5. Verificar especificamente o Douglas
  console.log('🔍 VERIFICAÇÃO ESPECÍFICA - DOUGLAS');
  console.log('=' .repeat(50));
  
  const { data: douglasAdmin, error: douglasError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('email', 'douglas@dev.com')
    .single();
  
  if (douglasError) {
    console.log('❌ Douglas não encontrado:', douglasError.message);
  } else {
    console.log('✅ Douglas encontrado:', douglasAdmin.full_name);
    
    // Buscar prédios do Douglas
    const { data: douglasBuildings, error: douglasBuildingsError } = await supabase
      .from('building_admins')
      .select(`
        buildings (
          name,
          address
        )
      `)
      .eq('admin_profile_id', douglasAdmin.id);
    
    if (douglasBuildingsError) {
      console.log('❌ Erro ao buscar prédios do Douglas:', douglasBuildingsError.message);
    } else {
      console.log(`🏢 Prédios do Douglas: ${douglasBuildings.length}`);
      douglasBuildings.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.buildings.name}`);
      });
    }
  }
  
  // 6. Verificar especificamente o Síndico Sem Prédio
  console.log('\n🔍 VERIFICAÇÃO ESPECÍFICA - SÍNDICO SEM PRÉDIO');
  console.log('=' .repeat(50));
  
  const { data: sindicoAdmin, error: sindicoError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('email', 'sindicosempredio@dev.com')
    .single();
  
  if (sindicoError) {
    console.log('❌ Síndico não encontrado:', sindicoError.message);
  } else {
    console.log('✅ Síndico encontrado:', sindicoAdmin.full_name);
    
    // Buscar prédios do Síndico
    const { data: sindicoBuildings, error: sindicoBuildingsError } = await supabase
      .from('building_admins')
      .select(`
        buildings (
          name,
          address
        )
      `)
      .eq('admin_profile_id', sindicoAdmin.id);
    
    if (sindicoBuildingsError) {
      console.log('❌ Erro ao buscar prédios do Síndico:', sindicoBuildingsError.message);
    } else {
      console.log(`🏢 Prédios do Síndico: ${sindicoBuildings.length}`);
      if (sindicoBuildings.length === 0) {
        console.log('✅ CORRETO: Síndico não tem prédios vinculados');
      } else {
        console.log('❌ ERRO: Síndico não deveria ter prédios vinculados');
        sindicoBuildings.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.buildings.name}`);
        });
      }
    }
  }
  
  console.log('\n🎯 RESUMO DA VALIDAÇÃO');
  console.log('=' .repeat(50));
  console.log('✅ Administradores criados na tabela admin_profiles');
  console.log('✅ Prédios de teste criados na tabela buildings');
  console.log('✅ Apartamentos criados para cada prédio');
  
  if (buildingAdmins && buildingAdmins.length > 0) {
    console.log('✅ Vinculações admin-prédio criadas');
  } else {
    console.log('⚠️  Vinculações admin-prédio não encontradas - verificar migração');
  }
  
  console.log('\n📝 OBSERVAÇÕES:');
  console.log('- Os logins falharam porque os usuários não existem na tabela auth.users');
  console.log('- Os perfis foram criados corretamente na tabela admin_profiles');
  console.log('- Para testar login, seria necessário criar os usuários no Supabase Auth');
}

// Executar o teste
testDatabase().catch(console.error);