const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (usando anon key para simular uso real)
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Simula a função startShift do shiftService
 */
async function startShift(porteiroId, buildingId) {
  try {
    console.log(`🔄 Tentando iniciar turno para porteiro: ${porteiroId}`);
    
    // Verificar se já existe um turno ativo (usando anon key como no app real)
    const { data: activeShift, error: checkError } = await supabaseAnon
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', porteiroId)
      .eq('status', 'active')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar turno ativo:', checkError);
      return { success: false, error: 'Erro ao verificar turno ativo' };
    }

    if (activeShift) {
      console.log('⚠️ Já existe um turno ativo para este porteiro');
      return { success: false, error: 'Já existe um turno ativo para este porteiro' };
    }

    // Verificar conflitos com outros porteiros no mesmo prédio
    const { data: conflictingShifts, error: conflictError } = await supabaseAnon
      .from('porteiro_shifts')
      .select('*')
      .eq('building_id', buildingId)
      .eq('status', 'active');

    if (conflictError) {
      console.error('❌ Erro ao verificar conflitos:', conflictError);
      return { success: false, error: 'Erro ao verificar conflitos de turno' };
    }

    if (conflictingShifts && conflictingShifts.length > 0) {
      console.log('⚠️ Já existe outro porteiro em turno ativo neste prédio');
      return { 
        success: false, 
        error: 'Já existe outro porteiro em turno ativo neste prédio' 
      };
    }

    // Criar novo turno (usando service key para contornar RLS nos testes)
    const { data: newShift, error: insertError } = await supabaseService
      .from('porteiro_shifts')
      .insert({
        porteiro_id: porteiroId,
        building_id: buildingId,
        shift_start: new Date().toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao criar turno:', insertError);
      return { success: false, error: 'Erro ao iniciar turno' };
    }

    console.log('✅ Turno iniciado com sucesso:', newShift.id);
    return { success: true, shift: newShift };

  } catch (error) {
    console.error('❌ Erro inesperado ao iniciar turno:', error);
    return { success: false, error: 'Erro inesperado ao iniciar turno' };
  }
}

/**
 * Simula a função endShift do shiftService
 */
async function endShift(porteiroId) {
  try {
    console.log(`🔄 Tentando finalizar turno para porteiro: ${porteiroId}`);
    
    // Buscar turno ativo (usando anon key)
    const { data: activeShift, error: findError } = await supabaseAnon
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', porteiroId)
      .eq('status', 'active')
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        console.log('⚠️ Nenhum turno ativo encontrado');
        return { success: false, error: 'Nenhum turno ativo encontrado' };
      }
      console.error('❌ Erro ao buscar turno ativo:', findError);
      return { success: false, error: 'Erro ao buscar turno ativo' };
    }

    // Finalizar turno (usando service key para contornar RLS nos testes)
    const { data: updatedShift, error: updateError } = await supabaseService
      .from('porteiro_shifts')
      .update({
        shift_end: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', activeShift.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao finalizar turno:', updateError);
      return { success: false, error: 'Erro ao finalizar turno' };
    }

    console.log('✅ Turno finalizado com sucesso:', updatedShift.id);
    return { success: true, shift: updatedShift };

  } catch (error) {
    console.error('❌ Erro inesperado ao finalizar turno:', error);
    return { success: false, error: 'Erro inesperado ao finalizar turno' };
  }
}

async function testShiftValidation() {
  console.log('🧪 === TESTE DE VALIDAÇÃO DE TURNOS ===\n');
  
  try {
    // Limpar turnos ativos existentes para começar limpo
    console.log('🧹 Limpando turnos ativos existentes...');
    const { error: cleanupError } = await supabaseService
      .from('porteiro_shifts')
      .update({ status: 'completed', shift_end: new Date().toISOString() })
      .eq('status', 'active');
      
    if (cleanupError) {
      console.error('❌ Erro na limpeza:', cleanupError);
      return;
    }
    
    // Buscar porteiros para teste
    const { data: porteiros, error: porteiroError } = await supabaseAnon
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('role', 'porteiro')
      .limit(2);
      
    if (porteiroError || !porteiros || porteiros.length < 2) {
      console.error('❌ Erro ao buscar porteiros:', porteiroError);
      return;
    }
    
    const porteiro1 = porteiros[0];
    const porteiro2 = porteiros[1];
    
    console.log(`👤 Porteiro 1: ${porteiro1.full_name} (${porteiro1.id})`);
    console.log(`👤 Porteiro 2: ${porteiro2.full_name} (${porteiro2.id})\n`);
    
    // Teste 1: Iniciar primeiro turno (deve funcionar)
    console.log('📝 TESTE 1: Iniciar primeiro turno');
    const result1 = await startShift(porteiro1.id, porteiro1.building_id);
    console.log(`Resultado: ${result1.success ? '✅ SUCESSO' : '❌ FALHOU'} - ${result1.error || 'Turno iniciado'}\n`);
    
    // Teste 2: Tentar iniciar segundo turno para o mesmo porteiro (deve falhar)
    console.log('📝 TESTE 2: Tentar iniciar segundo turno para o mesmo porteiro');
    const result2 = await startShift(porteiro1.id, porteiro1.building_id);
    console.log(`Resultado: ${result2.success ? '❌ FALHOU (deveria ter bloqueado)' : '✅ SUCESSO (bloqueou corretamente)'} - ${result2.error || 'Turno iniciado'}\n`);
    
    // Teste 3: Tentar iniciar turno para outro porteiro no mesmo prédio (deve falhar se for o mesmo prédio)
    console.log('📝 TESTE 3: Tentar iniciar turno para outro porteiro no mesmo prédio');
    const result3 = await startShift(porteiro2.id, porteiro1.building_id);
    console.log(`Resultado: ${result3.success ? '❌ FALHOU (deveria ter bloqueado)' : '✅ SUCESSO (bloqueou corretamente)'} - ${result3.error || 'Turno iniciado'}\n`);
    
    // Teste 4: Finalizar turno do primeiro porteiro
    console.log('📝 TESTE 4: Finalizar turno do primeiro porteiro');
    const result4 = await endShift(porteiro1.id);
    console.log(`Resultado: ${result4.success ? '✅ SUCESSO' : '❌ FALHOU'} - ${result4.error || 'Turno finalizado'}\n`);
    
    // Teste 5: Tentar finalizar novamente (deve falhar)
    console.log('📝 TESTE 5: Tentar finalizar turno novamente');
    const result5 = await endShift(porteiro1.id);
    console.log(`Resultado: ${result5.success ? '❌ FALHOU (deveria ter bloqueado)' : '✅ SUCESSO (bloqueou corretamente)'} - ${result5.error || 'Turno finalizado'}\n`);
    
    // Teste 6: Agora o segundo porteiro deve conseguir iniciar turno
    console.log('📝 TESTE 6: Segundo porteiro inicia turno após primeiro finalizar');
    const result6 = await startShift(porteiro2.id, porteiro1.building_id);
    console.log(`Resultado: ${result6.success ? '✅ SUCESSO' : '❌ FALHOU'} - ${result6.error || 'Turno iniciado'}\n`);
    
    // Limpar o turno criado no teste 6
    if (result6.success) {
      await endShift(porteiro2.id);
    }
    
    console.log('🎉 === TESTE DE VALIDAÇÃO CONCLUÍDO ===');
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

testShiftValidation();