// Script para testar a correção do registro de visitantes
// Verifica se o apartamento 101 pode ser encontrado pelo porteiro dougladmo19@gmail.com

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testVisitorRegistrationFix() {
  console.log('🔍 Testando correção do registro de visitantes...');
  
  try {
    // 1. Buscar dados do porteiro
    console.log('\n1. Buscando dados do porteiro dougladmo19@gmail.com...');
    const { data: porteiroProfile, error: porteiroError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, building_id')
      .eq('email', 'dougladmo19@gmail.com')
      .single();

    if (porteiroError || !porteiroProfile) {
      console.error('❌ Porteiro não encontrado:', porteiroError?.message);
      return;
    }

    console.log('✅ Porteiro encontrado:');
    console.log(`   - ID: ${porteiroProfile.id}`);
    console.log(`   - Nome: ${porteiroProfile.full_name}`);
    console.log(`   - Role: ${porteiroProfile.role}`);
    console.log(`   - Building ID: ${porteiroProfile.building_id}`);

    if (!porteiroProfile.building_id) {
      console.error('❌ Porteiro não tem building_id associado!');
      return;
    }

    // 2. Buscar informações do prédio
    console.log('\n2. Buscando informações do prédio...');
    const { data: buildingData, error: buildingError } = await supabase
      .from('buildings')
      .select('id, name, address')
      .eq('id', porteiroProfile.building_id)
      .single();

    if (buildingError || !buildingData) {
      console.error('❌ Prédio não encontrado:', buildingError?.message);
      return;
    }

    console.log('✅ Prédio encontrado:');
    console.log(`   - ID: ${buildingData.id}`);
    console.log(`   - Nome: ${buildingData.name}`);
    console.log(`   - Endereço: ${buildingData.address}`);

    // 3. Testar busca do apartamento 101 SEM filtro de building_id (método antigo)
    console.log('\n3. Testando busca ANTIGA (sem building_id)...');
    const { data: apartmentOld, error: apartmentOldError } = await supabase
      .from('apartments')
      .select('id, building_id, number, floor')
      .eq('number', '101')
      .single();

    if (apartmentOldError) {
      console.log('❌ Método antigo falhou (esperado se houver múltiplos apt 101):', apartmentOldError.message);
    } else {
      console.log('⚠️  Método antigo encontrou apartamento (pode ser do prédio errado):');
      console.log(`   - ID: ${apartmentOld.id}`);
      console.log(`   - Building ID: ${apartmentOld.building_id}`);
      console.log(`   - Número: ${apartmentOld.number}`);
      console.log(`   - Andar: ${apartmentOld.floor}`);
    }

    // 4. Testar busca do apartamento 101 COM filtro de building_id (método corrigido)
    console.log('\n4. Testando busca CORRIGIDA (com building_id)...');
    const { data: apartmentNew, error: apartmentNewError } = await supabase
      .from('apartments')
      .select('id, building_id, number, floor')
      .eq('number', '101')
      .eq('building_id', porteiroProfile.building_id)
      .single();

    if (apartmentNewError || !apartmentNew) {
      console.error('❌ Método corrigido falhou:', apartmentNewError?.message);
      console.log('   Isso indica que não existe apartamento 101 no prédio do porteiro.');
      
      // Listar todos os apartamentos do prédio
      console.log('\n5. Listando todos os apartamentos do prédio...');
      const { data: allApartments, error: allApartmentsError } = await supabase
        .from('apartments')
        .select('id, number, floor')
        .eq('building_id', porteiroProfile.building_id)
        .order('number');

      if (allApartmentsError) {
        console.error('❌ Erro ao listar apartamentos:', allApartmentsError.message);
      } else {
        console.log(`✅ Apartamentos encontrados no prédio (${allApartments.length}):`);
        allApartments.forEach(apt => {
          console.log(`   - Apt ${apt.number} (Andar ${apt.floor}) - ID: ${apt.id}`);
        });
      }
    } else {
      console.log('✅ Método corrigido funcionou! Apartamento 101 encontrado:');
      console.log(`   - ID: ${apartmentNew.id}`);
      console.log(`   - Building ID: ${apartmentNew.building_id}`);
      console.log(`   - Número: ${apartmentNew.number}`);
      console.log(`   - Andar: ${apartmentNew.floor}`);
      console.log('\n🎉 CORREÇÃO FUNCIONANDO! O registro de visitantes deve funcionar agora.');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar o teste
testVisitorRegistrationFix()
  .then(() => {
    console.log('\n✅ Teste concluído.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  });