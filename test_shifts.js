const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testShiftSystem() {
  console.log('🔍 Testando sistema de turnos...');
  
  try {
    // 1. Consultar turnos ativos
    console.log('\n1. Consultando turnos ativos:');
    const { data: activeShifts, error: activeError } = await supabase
      .from('porteiro_shifts')
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .eq('status', 'active');
    
    if (activeError) {
      console.error('❌ Erro ao consultar turnos ativos:', activeError);
    } else {
      console.log(`✅ Turnos ativos encontrados: ${activeShifts.length}`);
      activeShifts.forEach(shift => {
        console.log(`   - ${shift.profiles?.full_name} em ${shift.buildings?.name} desde ${new Date(shift.shift_start).toLocaleString()}`);
      });
    }
    
    // 2. Consultar últimos 5 turnos
    console.log('\n2. Consultando últimos turnos:');
    const { data: recentShifts, error: recentError } = await supabase
      .from('porteiro_shifts')
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .order('shift_start', { ascending: false })
      .limit(5);
    
    if (recentError) {
      console.error('❌ Erro ao consultar turnos recentes:', recentError);
    } else {
      console.log(`✅ Últimos turnos encontrados: ${recentShifts.length}`);
      recentShifts.forEach(shift => {
        const duration = shift.shift_end 
          ? `${Math.round((new Date(shift.shift_end) - new Date(shift.shift_start)) / (1000 * 60 * 60) * 100) / 100}h`
          : 'Ativo';
        console.log(`   - ${shift.profiles?.full_name}: ${new Date(shift.shift_start).toLocaleString()} - ${shift.shift_end ? new Date(shift.shift_end).toLocaleString() : 'Ativo'} (${duration})`);
      });
    }
    
    // 3. Verificar permissões da tabela
    console.log('\n3. Verificando permissões da tabela:');
    const { data: permissions, error: permError } = await supabase
      .rpc('check_table_permissions', { table_name: 'porteiro_shifts' })
      .single();
    
    if (permError) {
      console.log('⚠️  Não foi possível verificar permissões automaticamente');
      // Tentar uma consulta simples para testar permissões
      const { data: testData, error: testError } = await supabase
        .from('porteiro_shifts')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('❌ Erro de permissão:', testError.message);
      } else {
        console.log('✅ Permissões básicas funcionando');
      }
    } else {
      console.log('✅ Permissões verificadas:', permissions);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testShiftSystem();