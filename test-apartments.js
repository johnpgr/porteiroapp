const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  console.log('🔍 Testando acesso ao banco de dados...');
  console.log('='.repeat(60));

  try {
    // 1. Testar tabela buildings
    console.log('\n🏢 Testando tabela BUILDINGS:');
    console.log('-'.repeat(40));

    const { data: buildings, error: buildingsError } = await supabase.from('buildings').select('*');

    if (buildingsError) {
      console.error('❌ Erro ao buscar prédios:', buildingsError.message);
      console.log('💡 Detalhes do erro:', buildingsError);
    } else {
      console.log(`✅ Prédios encontrados: ${buildings?.length || 0}`);
      if (buildings && buildings.length > 0) {
        buildings.forEach((building, index) => {
          console.log(`   ${index + 1}. ${building.name} (ID: ${building.id})`);
          console.log(`      Endereço: ${building.address}`);
        });
      } else {
        console.log('⚠️  Nenhum prédio cadastrado.');
      }
    }

    // 2. Testar tabela apartments
    console.log('\n🏠 Testando tabela APARTMENTS:');
    console.log('-'.repeat(40));

    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('*');

    if (apartmentsError) {
      console.error('❌ Erro ao buscar apartamentos:', apartmentsError.message);
      console.log('💡 Detalhes do erro:', apartmentsError);
    } else {
      console.log(`✅ Apartamentos encontrados: ${apartments?.length || 0}`);
      if (apartments && apartments.length > 0) {
        apartments.forEach((apt, index) => {
          console.log(`   ${index + 1}. Apartamento ${apt.number}`);
          console.log(`      ID: ${apt.id}`);
          console.log(`      Prédio ID: ${apt.building_id}`);
          console.log(`      Andar: ${apt.floor || 'Não informado'}`);
        });
      } else {
        console.log('⚠️  Nenhum apartamento cadastrado.');
      }
    }

    // 3. Testar permissões RLS
    console.log('\n🔐 Testando permissões RLS:');
    console.log('-'.repeat(40));

    // Verificar se conseguimos inserir dados de teste
    console.log('\n📝 Tentando inserir um prédio de teste...');
    const { data: newBuilding, error: insertBuildingError } = await supabase
      .from('buildings')
      .insert({
        name: 'Prédio Teste',
        address: 'Rua Teste, 123',
      })
      .select()
      .single();

    if (insertBuildingError) {
      console.error('❌ Erro ao inserir prédio:', insertBuildingError.message);
      console.log('💡 Isso pode indicar problema de permissões RLS');
    } else {
      console.log('✅ Prédio inserido com sucesso!');
      console.log(`   ID: ${newBuilding.id}`);
      console.log(`   Nome: ${newBuilding.name}`);

      // Se conseguiu inserir o prédio, tentar inserir apartamento
      console.log('\n📝 Tentando inserir apartamento de teste...');
      const { data: newApartment, error: insertApartmentError } = await supabase
        .from('apartments')
        .insert({
          building_id: newBuilding.id,
          number: '101',
          floor: 1,
        })
        .select()
        .single();

      if (insertApartmentError) {
        console.error('❌ Erro ao inserir apartamento:', insertApartmentError.message);
      } else {
        console.log('✅ Apartamento inserido com sucesso!');
        console.log(`   ID: ${newApartment.id}`);
        console.log(`   Número: ${newApartment.number}`);
        console.log(`   Andar: ${newApartment.floor}`);
      }
    }

    // 4. Verificar novamente após inserções
    console.log('\n🔄 Verificando dados após inserções:');
    console.log('-'.repeat(40));

    const { data: finalBuildings } = await supabase.from('buildings').select('*');

    const { data: finalApartments } = await supabase.from('apartments').select('*');

    console.log(
      `📊 Total final - Prédios: ${finalBuildings?.length || 0}, Apartamentos: ${finalApartments?.length || 0}`
    );
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

// Executar o teste
testDatabase()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Se não há dados, cadastre prédios primeiro');
    console.log('   2. Depois cadastre apartamentos para os prédios');
    console.log('   3. Verifique as permissões RLS no Supabase');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
