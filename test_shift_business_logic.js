const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');

// Carregar variáveis de ambiente
config();

// Configuração do Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simular o shiftService real (sem usar service_role)
const shiftService = {
  async startShift(porteiroId, buildingId) {
    console.log('🔄 Iniciando turno com validações de negócio...');
    
    try {
      // 1. Verificar se já existe turno ativo para este porteiro
      const { data: activeShifts, error: checkError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .is('shift_end', null);
      
      if (checkError) {
        throw new Error(`Erro ao verificar turnos ativos: ${checkError.message}`);
      }
      
      if (activeShifts && activeShifts.length > 0) {
        throw new Error('Já existe um turno ativo para este porteiro');
      }
      
      // 2. Fechar turnos antigos automaticamente (mais de 24h)
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      
      const { error: closeOldError } = await supabase
        .from('porteiro_shifts')
        .update({ 
          shift_end: new Date().toISOString(),
          notes: 'Turno fechado automaticamente após 24h'
        })
        .eq('porteiro_id', porteiroId)
        .is('shift_end', null)
        .lt('shift_start', oneDayAgo.toISOString());
      
      if (closeOldError) {
        console.warn('⚠️ Aviso ao fechar turnos antigos:', closeOldError.message);
      }
      
      // 3. Iniciar novo turno
      const { data: newShift, error: insertError } = await supabase
        .from('porteiro_shifts')
        .insert({
          porteiro_id: porteiroId,
          building_id: buildingId,
          shift_start: new Date().toISOString(),
          notes: 'Turno iniciado via teste de validação'
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Erro ao inserir turno: ${insertError.message}`);
      }
      
      return newShift;
    } catch (error) {
      console.error('❌ Erro no shiftService.startShift:', error.message);
      throw error;
    }
  },
  
  async endShift(shiftId) {
    console.log('🔄 Finalizando turno...');
    
    try {
      const { data: updatedShift, error } = await supabase
        .from('porteiro_shifts')
        .update({ 
          shift_end: new Date().toISOString(),
          notes: 'Turno finalizado via teste de validação'
        })
        .eq('id', shiftId)
        .is('shift_end', null)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Erro ao finalizar turno: ${error.message}`);
      }
      
      return updatedShift;
    } catch (error) {
      console.error('❌ Erro no shiftService.endShift:', error.message);
      throw error;
    }
  },
  
  async getCurrentShift(porteiroId) {
    try {
      const { data: currentShift, error } = await supabase
        .from('porteiro_shifts')
        .select(`
          *,
          buildings(name)
        `)
        .eq('porteiro_id', porteiroId)
        .is('shift_end', null)
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        throw new Error(`Erro ao buscar turno atual: ${error.message}`);
      }
      
      return currentShift;
    } catch (error) {
      console.error('❌ Erro no shiftService.getCurrentShift:', error.message);
      throw error;
    }
  }
};

async function testShiftBusinessLogic() {
  console.log('🧪 === TESTE DE LÓGICA DE NEGÓCIO DOS TURNOS ===\n');
  
  try {
    // 1. Buscar um porteiro real para teste
    console.log('1️⃣ Buscando porteiro para teste...');
    const { data: porteiros, error: porteiroError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('user_type', 'porteiro')
      .limit(1);
    
    if (porteiroError || !porteiros || porteiros.length === 0) {
      throw new Error('Nenhum porteiro encontrado para teste');
    }
    
    const porteiro = porteiros[0];
    console.log(`✅ Porteiro encontrado: ${porteiro.full_name} (ID: ${porteiro.id})`);
    console.log(`   Building ID: ${porteiro.building_id}\n`);
    
    // 2. Verificar turno atual
    console.log('2️⃣ Verificando turno atual...');
    const currentShift = await shiftService.getCurrentShift(porteiro.id);
    
    if (currentShift) {
      console.log(`✅ Turno ativo encontrado:`);
      console.log(`   ID: ${currentShift.id}`);
      console.log(`   Início: ${new Date(currentShift.shift_start).toLocaleString('pt-BR')}`);
      console.log(`   Prédio: ${currentShift.buildings?.name || 'N/A'}\n`);
      
      // Finalizar turno existente
      console.log('3️⃣ Finalizando turno existente...');
      await shiftService.endShift(currentShift.id);
      console.log('✅ Turno finalizado com sucesso\n');
    } else {
      console.log('ℹ️ Nenhum turno ativo encontrado\n');
    }
    
    // 3. Testar início de novo turno
    console.log('4️⃣ Testando início de novo turno...');
    const newShift = await shiftService.startShift(porteiro.id, porteiro.building_id);
    console.log(`✅ Novo turno iniciado:`);
    console.log(`   ID: ${newShift.id}`);
    console.log(`   Início: ${new Date(newShift.shift_start).toLocaleString('pt-BR')}\n`);
    
    // 4. Testar validação de turno duplicado
    console.log('5️⃣ Testando validação de turno duplicado...');
    try {
      await shiftService.startShift(porteiro.id, porteiro.building_id);
      console.log('❌ FALHA: Deveria ter impedido turno duplicado');
    } catch (error) {
      console.log(`✅ Validação funcionou: ${error.message}\n`);
    }
    
    // 5. Verificar se apenas um turno está ativo
    console.log('6️⃣ Verificando turnos ativos...');
    const { data: activeShifts, error: activeError } = await supabase
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', porteiro.id)
      .is('shift_end', null);
    
    if (activeError) {
      throw new Error(`Erro ao verificar turnos ativos: ${activeError.message}`);
    }
    
    console.log(`✅ Turnos ativos encontrados: ${activeShifts.length}`);
    if (activeShifts.length === 1) {
      console.log('✅ Validação OK: Apenas um turno ativo por porteiro\n');
    } else {
      console.log(`❌ PROBLEMA: ${activeShifts.length} turnos ativos (deveria ser 1)\n`);
    }
    
    // 6. Finalizar turno de teste
    console.log('7️⃣ Finalizando turno de teste...');
    await shiftService.endShift(newShift.id);
    console.log('✅ Turno de teste finalizado\n');
    
    // 7. Verificar se não há mais turnos ativos
    console.log('8️⃣ Verificação final...');
    const finalShift = await shiftService.getCurrentShift(porteiro.id);
    
    if (finalShift) {
      console.log('❌ PROBLEMA: Ainda há turno ativo após finalização');
    } else {
      console.log('✅ Verificação OK: Nenhum turno ativo após finalização\n');
    }
    
    console.log('🎉 === TESTE CONCLUÍDO COM SUCESSO ===');
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testShiftBusinessLogic().then(() => {
  console.log('\n✅ Teste finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});