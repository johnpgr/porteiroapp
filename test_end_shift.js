const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEndShift() {
  console.log('🔍 Testando funcionalidade de finalizar turno...');
  
  try {
    // 1. Buscar turnos ativos
    const { data: activeShifts, error: activeError } = await supabase
      .from('porteiro_shifts')
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .eq('status', 'active');
    
    if (activeError) {
      console.error('❌ Erro ao buscar turnos ativos:', activeError);
      return;
    }
    
    if (!activeShifts || activeShifts.length === 0) {
      console.log('⚠️  Nenhum turno ativo encontrado. Criando um turno para teste...');
      
      // Criar um turno de teste
      const { data: porteiro } = await supabase
        .from('profiles')
        .select('id, full_name, building_id')
        .eq('user_type', 'porteiro')
        .limit(1)
        .single();
      
      if (!porteiro) {
        console.error('❌ Nenhum porteiro encontrado');
        return;
      }
      
      const { data: testShift, error: createError } = await supabase
        .from('porteiro_shifts')
        .insert({
          porteiro_id: porteiro.id,
          building_id: porteiro.building_id,
          shift_start: new Date().toISOString(),
          status: 'active',
          notes: 'Turno criado para teste de finalização'
        })
        .select(`
          *,
          profiles!porteiro_shifts_porteiro_id_fkey(full_name),
          buildings!porteiro_shifts_building_id_fkey(name)
        `)
        .single();
      
      if (createError) {
        console.error('❌ Erro ao criar turno de teste:', createError);
        return;
      }
      
      activeShifts.push(testShift);
      console.log('✅ Turno de teste criado');
    }
    
    console.log(`✅ Turnos ativos encontrados: ${activeShifts.length}`);
    
    // 2. Testar finalização do primeiro turno ativo
    const shiftToEnd = activeShifts[0];
    console.log(`\n🔍 Finalizando turno de: ${shiftToEnd.profiles?.full_name}`);
    console.log(`   - Prédio: ${shiftToEnd.buildings?.name}`);
    console.log(`   - Início: ${new Date(shiftToEnd.shift_start).toLocaleString()}`);
    
    // Calcular duração do turno
    const shiftStart = new Date(shiftToEnd.shift_start);
    const shiftEnd = new Date();
    const durationMs = shiftEnd.getTime() - shiftStart.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`   - Duração: ${durationHours}h ${durationMinutes}min`);
    
    // 3. Finalizar o turno
    console.log('\n🏁 Finalizando turno...');
    
    const { data: endedShift, error: endError } = await supabase
      .from('porteiro_shifts')
      .update({
        shift_end: shiftEnd.toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString(),
        notes: shiftToEnd.notes ? `${shiftToEnd.notes} - Finalizado via teste automatizado` : 'Finalizado via teste automatizado'
      })
      .eq('id', shiftToEnd.id)
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .single();
    
    if (endError) {
      console.error('❌ Erro ao finalizar turno:', endError);
      return;
    }
    
    console.log('✅ Turno finalizado com sucesso!');
    console.log(`   - ID: ${endedShift.id}`);
    console.log(`   - Status: ${endedShift.status}`);
    console.log(`   - Início: ${new Date(endedShift.shift_start).toLocaleString()}`);
    console.log(`   - Fim: ${new Date(endedShift.shift_end).toLocaleString()}`);
    
    // 4. Verificar se o turno foi atualizado corretamente
    console.log('\n🔍 Verificando se o turno foi atualizado...');
    
    const { data: verifyShift, error: verifyError } = await supabase
      .from('porteiro_shifts')
      .select('*')
      .eq('id', endedShift.id)
      .single();
    
    if (verifyError || !verifyShift) {
      console.error('❌ Erro ao verificar turno atualizado:', verifyError);
      return;
    }
    
    if (verifyShift.status !== 'completed' || !verifyShift.shift_end) {
      console.error('❌ Turno não foi finalizado corretamente');
      console.log('   Status:', verifyShift.status);
      console.log('   Fim:', verifyShift.shift_end);
      return;
    }
    
    console.log('✅ Turno verificado no banco de dados');
    
    // 5. Verificar se não há mais turnos ativos para este porteiro
    console.log('\n🔍 Verificando turnos ativos restantes...');
    
    const { data: remainingActive, error: remainingError } = await supabase
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', endedShift.porteiro_id)
      .eq('status', 'active');
    
    if (remainingError) {
      console.error('❌ Erro ao verificar turnos restantes:', remainingError);
      return;
    }
    
    if (remainingActive && remainingActive.length > 0) {
      console.log(`⚠️  Ainda há ${remainingActive.length} turno(s) ativo(s) para este porteiro`);
    } else {
      console.log('✅ Nenhum turno ativo restante para este porteiro');
    }
    
    // 6. Consultar todos os turnos ativos no sistema
    const { data: allActiveShifts, error: allActiveError } = await supabase
      .from('porteiro_shifts')
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .eq('status', 'active');
    
    if (allActiveError) {
      console.error('❌ Erro ao consultar todos os turnos ativos:', allActiveError);
      return;
    }
    
    console.log(`\n✅ Total de turnos ativos no sistema: ${allActiveShifts.length}`);
    if (allActiveShifts.length > 0) {
      allActiveShifts.forEach(shift => {
        console.log(`   - ${shift.profiles?.full_name} em ${shift.buildings?.name} desde ${new Date(shift.shift_start).toLocaleString()}`);
      });
    }
    
    console.log('\n🎉 Teste de finalizar turno concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testEndShift();