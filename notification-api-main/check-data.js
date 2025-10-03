const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycamhxzumzkpxuhtugxc.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8'
);

async function checkData() {
  console.log('=== VERIFICANDO DADOS REAIS NO BANCO ===');
  
  try {
    // Buscar prédios
    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('*')
      .limit(5);
    
    if (buildingsError) {
      console.error('Erro ao buscar prédios:', buildingsError);
    } else {
      console.log('\n📋 PRÉDIOS:', buildings?.length || 0);
      buildings?.forEach(b => console.log(`  - ${b.name} (ID: ${b.id})`));
    }
    
    // Buscar apartamentos
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('*, buildings(name)')
      .limit(5);
    
    if (apartmentsError) {
      console.error('Erro ao buscar apartamentos:', apartmentsError);
    } else {
      console.log('\n🏠 APARTAMENTOS:', apartments?.length || 0);
      apartments?.forEach(a => console.log(`  - Apt ${a.number} - ${a.buildings?.name} (ID: ${a.id})`));
    }
    
    // Buscar perfis de moradores
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'morador')
      .limit(5);
    
    if (profilesError) {
      console.error('Erro ao buscar moradores:', profilesError);
    } else {
      console.log('\n👥 MORADORES:', profiles?.length || 0);
      profiles?.forEach(p => console.log(`  - ${p.full_name} (ID: ${p.id}, Building: ${p.building_id})`));
    }
    
    // Buscar relações apartamento-morador
    const { data: residents, error: residentsError } = await supabase
      .from('apartment_residents')
      .select('*, profiles(full_name), apartments(number, buildings(name))')
      .limit(5);
    
    if (residentsError) {
      console.error('Erro ao buscar relações:', residentsError);
    } else {
      console.log('\n🔗 RELAÇÕES APARTAMENTO-MORADOR:', residents?.length || 0);
      residents?.forEach(r => console.log(`  - ${r.profiles?.full_name} -> Apt ${r.apartments?.number} (${r.apartments?.buildings?.name})`));
    }
    
    // Buscar primeiro morador com apartamento para usar como exemplo
    if (residents && residents.length > 0) {
      const firstResident = residents[0];
      console.log('\n🎯 EXEMPLO DE MORADOR PARA TESTE:');
      console.log(`  - Profile ID: ${firstResident.profile_id}`);
      console.log(`  - Nome: ${firstResident.profiles?.full_name}`);
      console.log(`  - Apartamento: ${firstResident.apartments?.number}`);
      console.log(`  - Prédio: ${firstResident.apartments?.buildings?.name}`);
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkData().catch(console.error);