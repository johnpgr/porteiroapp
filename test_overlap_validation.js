const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOverlapValidation() {
  console.log('🔍 Testando validação de sobreposição de turnos...');
  
  try {
    // 1. Buscar porteiros do mesmo prédio
    const { data: porteiros, error: porteirosError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id, buildings!profiles_building_id_fkey(name)')
      .eq('user_type', 'porteiro')
      .limit(3);
    
    if (porteirosError || !porteiros || porteiros.length < 2) {
      console.error('❌ Erro ao buscar porteiros ou poucos porteiros disponíveis:', porteirosError);
      return;
    }
    
    console.log(`✅ Porteiros encontrados: ${porteiros.length}`);
    porteiros.forEach(p => {
      console.log(`   - ${p.full_name} (Prédio: ${p.buildings?.name})`);
    });
    
    // 2. Limpar turnos ativos existentes
    console.log('\n🧹 Limpando turnos ativos existentes...');
    
    const { error: cleanupError } = await supabase
      .from('porteiro_shifts')
      .update({
        shift_end: new Date().toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'active');
    
    if (cleanupError) {
      console.error('❌ Erro ao limpar turnos:', cleanupError);
    } else {
      console.log('✅ Turnos ativos limpos');
    }
    
    // 3. Teste 1: Iniciar turno do primeiro porteiro
    console.log('\n🚀 Teste 1: Iniciando turno do primeiro porteiro...');
    
    const porteiro1 = porteiros[0];
    const shiftStart = new Date();
    
    const { data: shift1, error: shift1Error } = await supabase
      .from('porteiro_shifts')
      .insert({
        porteiro_id: porteiro1.id,
        building_id: porteiro1.building_id,
        shift_start: shiftStart.toISOString(),
        status: 'active',
        notes: 'Teste de sobreposição - Turno 1'
      })
      .select()
      .single();
    
    if (shift1Error) {
      console.error('❌ Erro ao iniciar primeiro turno:', shift1Error);
      return;
    }
    
    console.log(`✅ Primeiro turno iniciado: ${porteiro1.full_name}`);
    console.log(`   - ID: ${shift1.id}`);
    console.log(`   - Início: ${new Date(shift1.shift_start).toLocaleString()}`);
    
    // 4. Teste 2: Tentar iniciar turno simultâneo no mesmo prédio
    console.log('\n🚀 Teste 2: Tentando iniciar turno simultâneo no mesmo prédio...');
    
    const porteiro2 = porteiros.find(p => p.building_id === porteiro1.building_id && p.id !== porteiro1.id);
    
    if (!porteiro2) {
      console.log('⚠️  Não há outro porteiro no mesmo prédio. Testando com porteiro de prédio diferente...');
      
      const porteiro2Alt = porteiros.find(p => p.id !== porteiro1.id);
      if (porteiro2Alt) {
        const { data: shift2, error: shift2Error } = await supabase
          .from('porteiro_shifts')
          .insert({
            porteiro_id: porteiro2Alt.id,
            building_id: porteiro2Alt.building_id,
            shift_start: new Date().toISOString(),
            status: 'active',
            notes: 'Teste de sobreposição - Turno 2 (prédio diferente)'
          })
          .select()
          .single();
        
        if (shift2Error) {
          console.error('❌ Erro ao iniciar segundo turno:', shift2Error);
        } else {
          console.log(`✅ Segundo turno iniciado em prédio diferente: ${porteiro2Alt.full_name}`);
          console.log(`   - Prédio: ${porteiro2Alt.buildings?.name}`);
          console.log('✅ Turnos simultâneos em prédios diferentes são permitidos');
        }
      }
    } else {
      // Tentar iniciar turno no mesmo prédio
      const { data: shift2, error: shift2Error } = await supabase
        .from('porteiro_shifts')
        .insert({
          porteiro_id: porteiro2.id,
          building_id: porteiro2.building_id,
          shift_start: new Date().toISOString(),
          status: 'active',
          notes: 'Teste de sobreposição - Turno 2 (mesmo prédio)'
        })
        .select()
        .single();
      
      if (shift2Error) {
        console.log('❌ Erro esperado ao tentar turno simultâneo no mesmo prédio:', shift2Error.message);
        console.log('✅ Validação de sobreposição funcionando (se houver constraint no banco)');
      } else {
        console.log(`⚠️  Segundo turno iniciado no mesmo prédio: ${porteiro2.full_name}`);
        console.log('⚠️  ATENÇÃO: Sistema permite turnos simultâneos no mesmo prédio!');
        console.log('   - Isso pode ser intencional ou precisar de validação adicional no frontend');
      }
    }
    
    // 5. Verificar todos os turnos ativos
    console.log('\n🔍 Verificando turnos ativos após testes...');
    
    const { data: activeShifts, error: activeError } = await supabase
      .from('porteiro_shifts')
      .select(`
        *,
        profiles!porteiro_shifts_porteiro_id_fkey(full_name),
        buildings!porteiro_shifts_building_id_fkey(name)
      `)
      .eq('status', 'active')
      .order('shift_start', { ascending: true });
    
    if (activeError) {
      console.error('❌ Erro ao consultar turnos ativos:', activeError);
      return;
    }
    
    console.log(`✅ Total de turnos ativos: ${activeShifts.length}`);
    
    if (activeShifts.length > 0) {
      console.log('\nDetalhes dos turnos ativos:');
      activeShifts.forEach((shift, index) => {
        console.log(`   ${index + 1}. ${shift.profiles?.full_name}`);
        console.log(`      - Prédio: ${shift.buildings?.name}`);
        console.log(`      - Início: ${new Date(shift.shift_start).toLocaleString()}`);
        console.log(`      - ID: ${shift.id}`);
      });
      
      // Verificar se há turnos no mesmo prédio
      const buildingGroups = {};
      activeShifts.forEach(shift => {
        const buildingId = shift.building_id;
        if (!buildingGroups[buildingId]) {
          buildingGroups[buildingId] = [];
        }
        buildingGroups[buildingId].push(shift);
      });
      
      console.log('\n🏢 Análise por prédio:');
      Object.entries(buildingGroups).forEach(([buildingId, shifts]) => {
        const buildingName = shifts[0].buildings?.name || 'Desconhecido';
        console.log(`   - ${buildingName}: ${shifts.length} turno(s) ativo(s)`);
        
        if (shifts.length > 1) {
          console.log('     ⚠️  MÚLTIPLOS TURNOS NO MESMO PRÉDIO!');
          shifts.forEach(shift => {
            console.log(`       * ${shift.profiles?.full_name} desde ${new Date(shift.shift_start).toLocaleString()}`);
          });
        }
      });
    }
    
    // 6. Teste 3: Tentar iniciar turno para porteiro que já tem turno ativo
    console.log('\n🚀 Teste 3: Tentando iniciar segundo turno para o mesmo porteiro...');
    
    if (activeShifts.length > 0) {
      const existingShift = activeShifts[0];
      
      const { data: duplicateShift, error: duplicateError } = await supabase
        .from('porteiro_shifts')
        .insert({
          porteiro_id: existingShift.porteiro_id,
          building_id: existingShift.building_id,
          shift_start: new Date().toISOString(),
          status: 'active',
          notes: 'Teste de duplicação - Segundo turno mesmo porteiro'
        })
        .select()
        .single();
      
      if (duplicateError) {
        console.log('❌ Erro esperado ao tentar segundo turno para mesmo porteiro:', duplicateError.message);
        console.log('✅ Validação de porteiro único funcionando (se houver constraint no banco)');
      } else {
        console.log(`⚠️  Segundo turno criado para o mesmo porteiro: ${existingShift.profiles?.full_name}`);
        console.log('⚠️  ATENÇÃO: Sistema permite múltiplos turnos para o mesmo porteiro!');
        console.log('   - Isso pode precisar de validação adicional no frontend');
      }
    }
    
    console.log('\n🎉 Teste de validação de sobreposição concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testOverlapValidation();