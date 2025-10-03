const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycamhxzumzkpxuhtugxc.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8'
);

async function testRPC() {
  console.log('=== TESTANDO FUNÇÃO RPC get_apartment_residents ===\n');
  
  try {
    // Primeiro, vamos buscar o ID do prédio "Prediodeteste"
    console.log('1. Buscando ID do prédio "Prediodeteste"...');
    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('id, name')
      .ilike('name', '%prediodeteste%');
    
    if (buildingsError) {
      console.error('❌ Erro ao buscar prédios:', buildingsError);
      return;
    }
    
    if (!buildings || buildings.length === 0) {
      console.log('❌ Prédio "Prediodeteste" não encontrado');
      return;
    }
    
    const building = buildings[0];
    console.log(`✅ Prédio encontrado: ${building.name} (ID: ${building.id})\n`);
    
    // Agora vamos buscar o apartamento 101 neste prédio
    console.log('2. Buscando apartamento 101 no prédio...');
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('*')
      .eq('number', '101')
      .eq('building_id', building.id);
    
    if (apartmentsError) {
      console.error('❌ Erro ao buscar apartamentos:', apartmentsError);
      return;
    }
    
    console.log(`📋 Apartamentos encontrados: ${apartments?.length || 0}`);
    apartments?.forEach(a => console.log(`  - Apt ${a.number} (ID: ${a.id})`));
    console.log('');
    
    // Agora vamos testar a função RPC
    console.log('3. Testando função RPC get_apartment_residents...');
    console.log(`   Parâmetros: apartment_number='101', building_id='${building.id}'`);
    
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('get_apartment_residents', {
        apartment_number: '101',
        building_id: building.id
      });
    
    if (rpcError) {
      console.error('❌ Erro na função RPC:', rpcError);
      console.error('   Detalhes:', JSON.stringify(rpcError, null, 2));
    } else {
      console.log(`✅ RPC executada com sucesso!`);
      console.log(`📊 Resultado: ${rpcResult?.length || 0} moradores encontrados`);
      if (rpcResult && rpcResult.length > 0) {
        rpcResult.forEach(r => console.log(`  - ${r.full_name || r.name || 'Nome não disponível'}`));
      }
    }
    console.log('');
    
    // Vamos fazer uma consulta direta para comparar
    console.log('4. Fazendo consulta direta nas tabelas para comparar...');
    
    // Buscar relações apartment_residents
    const { data: relations, error: relationsError } = await supabase
      .from('apartment_residents')
      .select('*, profiles(full_name), apartments(number, building_id)')
      .eq('apartments.number', '101')
      .eq('apartments.building_id', building.id);
    
    if (relationsError) {
      console.error('❌ Erro ao buscar relações:', relationsError);
    } else {
      console.log(`📋 Relações apartment_residents encontradas: ${relations?.length || 0}`);
      relations?.forEach(r => console.log(`  - ${r.profiles?.full_name} no Apt ${r.apartments?.number}`));
    }
    console.log('');
    
    // Buscar moradores diretamente por building_id
    console.log('5. Buscando moradores diretamente por building_id...');
    const { data: residents, error: residentsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('building_id', building.id)
      .eq('user_type', 'morador');
    
    if (residentsError) {
      console.error('❌ Erro ao buscar moradores:', residentsError);
    } else {
      console.log(`👥 Moradores no prédio: ${residents?.length || 0}`);
      residents?.forEach(r => console.log(`  - ${r.full_name} (Apt: ${r.apartment_number || 'não definido'})`));
    }
    console.log('');
    
    // Verificar se a função RPC existe
    console.log('6. Verificando se a função RPC existe no banco...');
    const { data: functions, error: functionsError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'get_apartment_residents');
    
    if (functionsError) {
      console.log('⚠️  Não foi possível verificar funções (normal em alguns casos)');
    } else {
      console.log(`📋 Função RPC existe: ${functions?.length > 0 ? 'SIM' : 'NÃO'}`);
    }
    console.log('');
    
    // Testar variações dos parâmetros
    console.log('7. Testando variações dos parâmetros...');
    
    // Teste com apartment_number como string de número
    console.log('   Testando com apartment_number como string de número ("101")...');
    const { data: rpcResult2, error: rpcError2 } = await supabase
      .rpc('get_apartment_residents', {
        apartment_number: "101",
        building_id: building.id
      });
    
    if (rpcError2) {
      console.log('   ❌ Erro com número:', rpcError2.message);
    } else {
      console.log(`   ✅ Sucesso com número: ${rpcResult2?.length || 0} moradores`);
    }
    
    // Teste sem parâmetros
    console.log('   Testando sem parâmetros...');
    const { data: rpcResult3, error: rpcError3 } = await supabase
      .rpc('get_apartment_residents');
    
    if (rpcError3) {
      console.log('   ❌ Erro sem parâmetros:', rpcError3.message);
    } else {
      console.log(`   ✅ Sucesso sem parâmetros: ${rpcResult3?.length || 0} moradores`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testRPC().catch(console.error);