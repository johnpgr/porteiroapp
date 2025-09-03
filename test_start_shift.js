const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStartShift() {
  console.log('🔍 Testando funcionalidade de iniciar turno...');
  
  try {
    // 1. Pegar o primeiro porteiro disponível
    const { data: porteiros, error: porteiroError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('user_type', 'porteiro')
      .limit(1)
      .single();
    
    if (porteiroError || !porteiros) {
      console.error('❌ Erro ao buscar porteiro:', porteiroError);
      return;
    }
    
    console.log(`✅ Testando com porteiro: ${porteiros.full_name}`);
    
    // 2. Verificar se já há turno ativo para este porteiro
    const { data: activeShift, error: activeError } = await supabase
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', porteiros.id)
      .eq('status', 'active')
      .single();
    
    if (activeShift) {
      console.log('⚠️  Porteiro já possui turno ativo. Finalizando turno anterior...');
      
      const { error: endError } = await supabase
        .from('porteiro_shifts')
        .update({
          shift_end: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeShift.id);
      
      if (endError) {
        console.error('❌ Erro ao finalizar turno anterior:', endError);
        return;
      }
      
      console.log('✅ Turno anterior finalizado');
    }
    
    // 3. Verificar validações antes de iniciar turno
    console.log('\n🔍 Verificando validações...');
    
    // Verificar se há outros turnos ativos no mesmo prédio
    const { data: otherActiveShifts, error: otherError } = await supabase
      .from('porteiro_shifts')
      .select('*, profiles!porteiro_shifts_porteiro_id_fkey(full_name)')
      .eq('building_id', porteiros.building_id)
      .eq('status', 'active')
      .neq('porteiro_id', porteiros.id);
    
    if (otherError) {
      console.error('❌ Erro ao verificar outros turnos:', otherError);
      return;
    }
    
    if (otherActiveShifts && otherActiveShifts.length > 0) {
      console.log('⚠️  Outros porteiros já estão em turno neste prédio:');
      otherActiveShifts.forEach(shift => {
        console.log(`   - ${shift.profiles?.full_name} desde ${new Date(shift.shift_start).toLocaleString()}`);
      });
    } else {
      console.log('✅ Nenhum outro turno ativo no prédio');
    }
    
    // 4. Iniciar novo turno
    console.log('\n🚀 Iniciando novo turno...');
    
    const shiftData = {
      porteiro_id: porteiros.id,
      building_id: porteiros.building_id,
      shift_start: new Date().toISOString(),
      status: 'active',
      notes: 'Turno iniciado via teste automatizado'
    };
    
    const { data: newShift, error: startError } = await supabase
      .from('porteiro_shifts')
      .insert(shiftData)
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .single();
    
    if (startError) {
      console.error('❌ Erro ao iniciar turno:', startError);
      return;
    }
    
    console.log('✅ Turno iniciado com sucesso!');
    console.log(`   - ID: ${newShift.id}`);
    console.log(`   - Porteiro: ${newShift.profiles?.full_name}`);
    console.log(`   - Prédio: ${newShift.buildings?.name}`);
    console.log(`   - Início: ${new Date(newShift.shift_start).toLocaleString()}`);
    console.log(`   - Status: ${newShift.status}`);
    
    // 5. Verificar se o turno foi salvo corretamente
    console.log('\n🔍 Verificando se o turno foi salvo...');
    
    const { data: savedShift, error: verifyError } = await supabase
      .from('porteiro_shifts')
      .select('*')
      .eq('id', newShift.id)
      .single();
    
    if (verifyError || !savedShift) {
      console.error('❌ Erro ao verificar turno salvo:', verifyError);
      return;
    }
    
    console.log('✅ Turno verificado no banco de dados');
    
    // 6. Testar consulta de turnos ativos
    console.log('\n🔍 Consultando turnos ativos após inserção...');
    
    const { data: allActiveShifts, error: allActiveError } = await supabase
      .from('porteiro_shifts')
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .eq('status', 'active');
    
    if (allActiveError) {
      console.error('❌ Erro ao consultar turnos ativos:', allActiveError);
      return;
    }
    
    console.log(`✅ Total de turnos ativos: ${allActiveShifts.length}`);
    allActiveShifts.forEach(shift => {
      console.log(`   - ${shift.profiles?.full_name} em ${shift.buildings?.name} desde ${new Date(shift.shift_start).toLocaleString()}`);
    });
    
    console.log('\n🎉 Teste de iniciar turno concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testStartShift();