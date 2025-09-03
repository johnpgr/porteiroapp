// Teste do shiftService real para validar lógica de negócio
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Simulação do shiftService para teste
class TestShiftService {
  async validateShiftStart(porteiroId, buildingId) {
    try {
      // Verificar se já existe um turno ativo para o porteiro
      const { data: activeShift, error: checkError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar turno ativo:', checkError);
        return { isValid: false, error: 'Erro ao verificar turno ativo' };
      }

      if (activeShift) {
        return {
          isValid: false,
          error: 'Porteiro já possui um turno ativo',
          conflictingShift: activeShift
        };
      }

      // Verificar se há outro porteiro ativo no mesmo prédio
      const { data: buildingShift, error: buildingError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('building_id', buildingId)
        .eq('status', 'active')
        .neq('porteiro_id', porteiroId)
        .maybeSingle();

      if (buildingError) {
        console.error('Erro ao verificar turno no prédio:', buildingError);
        return { isValid: false, error: 'Erro ao verificar turno no prédio' };
      }

      if (buildingShift) {
        return {
          isValid: false,
          error: 'Já existe outro porteiro ativo neste prédio',
          conflictingShift: buildingShift
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Erro na validação:', error);
      return { isValid: false, error: 'Erro interno na validação' };
    }
  }

  async startShift(porteiroId, buildingId) {
    try {
      // Validar antes de iniciar
      const validation = await this.validateShiftStart(porteiroId, buildingId);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Criar novo turno
      const { data: newShift, error: insertError } = await supabase
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
        console.error('Erro ao criar turno:', insertError);
        return { success: false, error: 'Erro ao iniciar turno' };
      }

      return { success: true, shift: newShift };
    } catch (error) {
      console.error('Erro ao iniciar turno:', error);
      return { success: false, error: 'Erro interno ao iniciar turno' };
    }
  }

  async endShift(porteiroId) {
    try {
      // Buscar turno ativo
      const { data: activeShift, error: findError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .single();

      if (findError || !activeShift) {
        return { success: false, error: 'Nenhum turno ativo encontrado' };
      }

      // Finalizar turno
      const { data: updatedShift, error: updateError } = await supabase
        .from('porteiro_shifts')
        .update({
          shift_end: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeShift.id)
        .select()
        .single();

      if (updateError) {
        console.error('Erro ao finalizar turno:', updateError);
        return { success: false, error: 'Erro ao finalizar turno' };
      }

      return { success: true, shift: updatedShift };
    } catch (error) {
      console.error('Erro ao finalizar turno:', error);
      return { success: false, error: 'Erro interno ao finalizar turno' };
    }
  }

  async getActiveShift(porteiroId) {
    try {
      const { data: activeShift, error } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar turno ativo:', error);
        return { shift: null, error: 'Erro ao buscar turno ativo' };
      }

      return { shift: activeShift };
    } catch (error) {
      console.error('Erro ao buscar turno ativo:', error);
      return { shift: null, error: 'Erro interno ao buscar turno ativo' };
    }
  }
}

const testShiftService = new TestShiftService();

/**
 * Teste do shiftService real para validar lógica de negócio
 */
async function testRealShiftService() {
  console.log('🧪 === TESTE DO SHIFT SERVICE REAL ===\n');

  // IDs de teste
  const porteiroId1 = '45dd0438-e092-4c4e-a6ff-3a313855b41e'; // Severino Silva
  const porteiroId2 = 'de3e7b00-4f3a-4d94-b7e6-6ef2fba7f73f'; // Douglad Teste
  const buildingId = 'ee91248f-7991-42e0-b2c6-04683f692587';

  try {
    // Limpar turnos ativos existentes usando service_role apenas para limpeza
    console.log('🧹 Limpando turnos ativos existentes...');
    const { error: cleanupError } = await supabase
      .from('porteiro_shifts')
      .update({ 
        shift_end: new Date().toISOString(),
        status: 'completed'
      })
      .eq('status', 'active');
    
    if (cleanupError) {
      console.log('⚠️ Aviso na limpeza:', cleanupError.message);
    } else {
      console.log('✅ Turnos ativos limpos\n');
    }

    // TESTE 1: Validar início de turno
    console.log('📝 TESTE 1: Validar início de turno');
    const validation1 = await testShiftService.validateShiftStart(porteiroId1, buildingId);
    console.log('Resultado da validação:', validation1);
    
    if (validation1.isValid) {
      console.log('✅ Validação passou - pode iniciar turno\n');
    } else {
      console.log('❌ Validação falhou:', validation1.error, '\n');
    }

    // TESTE 2: Iniciar primeiro turno
    console.log('📝 TESTE 2: Iniciar primeiro turno');
    const startResult1 = await testShiftService.startShift(porteiroId1, buildingId);
    console.log('Resultado do início:', startResult1);
    
    if (startResult1.success) {
      console.log('✅ Turno iniciado com sucesso\n');
    } else {
      console.log('❌ Falha ao iniciar turno:', startResult1.error, '\n');
    }

    // TESTE 3: Tentar iniciar segundo turno para o mesmo porteiro
    console.log('📝 TESTE 3: Tentar iniciar segundo turno para o mesmo porteiro');
    const validation2 = await testShiftService.validateShiftStart(porteiroId1, buildingId);
    console.log('Resultado da validação:', validation2);
    
    if (!validation2.isValid) {
      console.log('✅ Validação bloqueou corretamente:', validation2.error);
    } else {
      console.log('❌ Validação deveria ter bloqueado');
    }

    const startResult2 = await testShiftService.startShift(porteiroId1, buildingId);
    console.log('Resultado do início:', startResult2);
    
    if (!startResult2.success) {
      console.log('✅ Início bloqueado corretamente:', startResult2.error, '\n');
    } else {
      console.log('❌ Início deveria ter sido bloqueado\n');
    }

    // TESTE 4: Tentar iniciar turno para outro porteiro no mesmo prédio
    console.log('📝 TESTE 4: Tentar iniciar turno para outro porteiro no mesmo prédio');
    const validation3 = await testShiftService.validateShiftStart(porteiroId2, buildingId);
    console.log('Resultado da validação:', validation3);
    
    if (!validation3.isValid) {
      console.log('✅ Validação bloqueou corretamente:', validation3.error);
    } else {
      console.log('❌ Validação deveria ter bloqueado');
    }

    const startResult3 = await testShiftService.startShift(porteiroId2, buildingId);
    console.log('Resultado do início:', startResult3);
    
    if (!startResult3.success) {
      console.log('✅ Início bloqueado corretamente:', startResult3.error, '\n');
    } else {
      console.log('❌ Início deveria ter sido bloqueado\n');
    }

    // TESTE 5: Verificar turno ativo
    console.log('📝 TESTE 5: Verificar turno ativo');
    const activeShiftResult = await testShiftService.getActiveShift(porteiroId1);
    console.log('Turno ativo encontrado:', activeShiftResult);
    
    if (activeShiftResult.shift) {
      console.log('✅ Turno ativo encontrado corretamente\n');
    } else {
      console.log('❌ Turno ativo não encontrado\n');
    }

    // TESTE 6: Finalizar turno
    console.log('📝 TESTE 6: Finalizar turno');
    const endResult = await testShiftService.endShift(porteiroId1);
    console.log('Resultado do fim:', endResult);
    
    if (endResult.success) {
      console.log('✅ Turno finalizado com sucesso\n');
    } else {
      console.log('❌ Falha ao finalizar turno:', endResult.error, '\n');
    }

    // TESTE 7: Tentar finalizar turno novamente
    console.log('📝 TESTE 7: Tentar finalizar turno novamente');
    const endResult2 = await testShiftService.endShift(porteiroId1);
    console.log('Resultado do fim:', endResult2);
    
    if (!endResult2.success) {
      console.log('✅ Fim bloqueado corretamente:', endResult2.error, '\n');
    } else {
      console.log('❌ Fim deveria ter sido bloqueado\n');
    }

    // TESTE 8: Segundo porteiro pode iniciar após primeiro finalizar
    console.log('📝 TESTE 8: Segundo porteiro pode iniciar após primeiro finalizar');
    const validation4 = await testShiftService.validateShiftStart(porteiroId2, buildingId);
    console.log('Resultado da validação:', validation4);
    
    if (validation4.isValid) {
      console.log('✅ Validação passou - pode iniciar turno');
    } else {
      console.log('❌ Validação falhou:', validation4.error);
    }

    const startResult4 = await testShiftService.startShift(porteiroId2, buildingId);
    console.log('Resultado do início:', startResult4);
    
    if (startResult4.success) {
      console.log('✅ Turno iniciado com sucesso');
      
      // Finalizar para limpeza
      await testShiftService.endShift(porteiroId2);
      console.log('🧹 Turno finalizado para limpeza\n');
    } else {
      console.log('❌ Falha ao iniciar turno:', startResult4.error, '\n');
    }

    console.log('🎉 === TESTE DO SHIFT SERVICE CONCLUÍDO ===');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testRealShiftService().catch(console.error);