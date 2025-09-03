const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (usando service_role para testes)
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

console.log('⚠️ ATENÇÃO: Usando service_role_key para testes - não usar em produção!');

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Simula a função isPorteiroOnDuty do hook usePorteiroNotifications
 */
async function isPorteiroOnDuty(porteiroId) {
  if (!porteiroId) {
    console.log('⚠️ PorteiroId não disponível para verificação de turno');
    return false;
  }
  
  try {
    const { data: activeShift, error } = await supabase
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', porteiroId)
      .eq('status', 'active')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Nenhum turno ativo encontrado
        console.log('🔍 Nenhum turno ativo encontrado para porteiro:', porteiroId);
        return false;
      }
      throw error;
    }
    
    const onDuty = activeShift?.status === 'active';
    console.log('🔍 Porteiro em turno:', onDuty, activeShift ? `(${activeShift.id})` : '(sem turno)');
    return onDuty;
  } catch (error) {
    console.error('❌ Erro ao verificar turno:', error);
    return false;
  }
}

/**
 * Simula o processamento de uma notificação
 */
async function processNotification(porteiroId, notification) {
  console.log('\n➕ Tentando processar notificação para porteiro:', porteiroId);
  console.log('   Notificação:', notification.title);
  
  // Verificar se o porteiro está em turno ativo
  const onDuty = await isPorteiroOnDuty(porteiroId);
  
  if (!onDuty) {
    console.log('⏸️ Notificação IGNORADA - porteiro não está em turno ativo');
    return { processed: false, reason: 'Porteiro não está em turno ativo' };
  }
  
  console.log('✅ Notificação PROCESSADA - porteiro em turno ativo');
  return { processed: true, reason: 'Porteiro em turno ativo' };
}

/**
 * Testa o sistema de filtragem de notificações
 */
async function testNotificationFiltering() {
  console.log('🧪 === TESTE DE FILTRAGEM DE NOTIFICAÇÕES ===\n');
  
  try {
    // 1. Buscar porteiros disponíveis
    console.log('1️⃣ Buscando porteiros disponíveis...');
    const { data: porteiros, error: porteirosError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('user_type', 'porteiro')
      .limit(3);
    
    if (porteirosError) {
      console.error('❌ Erro ao buscar porteiros:', porteirosError);
      return;
    }
    
    if (!porteiros || porteiros.length === 0) {
      console.log('❌ Nenhum porteiro encontrado');
      return;
    }
    
    console.log(`✅ Encontrados ${porteiros.length} porteiros:`);
    porteiros.forEach(p => {
      console.log(`   - ${p.full_name} (ID: ${p.id})`);
    });
    
    // 2. Verificar status atual dos turnos
    console.log('\n2️⃣ Verificando status atual dos turnos...');
    for (const porteiro of porteiros) {
      const onDuty = await isPorteiroOnDuty(porteiro.id);
      console.log(`   - ${porteiro.full_name}: ${onDuty ? '🟢 EM TURNO' : '🔴 FORA DE TURNO'}`);
    }
    
    // 3. Simular notificações para diferentes cenários
    console.log('\n3️⃣ Simulando notificações...');
    
    const mockNotifications = [
      {
        id: 'test_1',
        type: 'visitor_log',
        title: 'Nova Atividade Registrada',
        message: 'Visitante autorizado na portaria',
        timestamp: new Date().toISOString()
      },
      {
        id: 'test_2',
        type: 'delivery',
        title: 'Nova Encomenda',
        message: 'Encomenda recebida para apartamento 101',
        timestamp: new Date().toISOString()
      },
      {
        id: 'test_3',
        type: 'visitor',
        title: 'Visitante Atualizado',
        message: 'Status do visitante foi alterado',
        timestamp: new Date().toISOString()
      }
    ];
    
    // Testar para cada porteiro
    for (const porteiro of porteiros) {
      console.log(`\n   📱 Testando notificações para ${porteiro.full_name}:`);
      
      for (const notification of mockNotifications) {
        const result = await processNotification(porteiro.id, notification);
        console.log(`      - ${notification.title}: ${result.processed ? '✅ PROCESSADA' : '❌ IGNORADA'} (${result.reason})`);
      }
    }
    
    // 4. Testar mudança de status de turno
    console.log('\n4️⃣ Testando mudança de status de turno...');
    
    const primeiroPorteiro = porteiros[0];
    console.log(`\n   🔄 Testando com ${primeiroPorteiro.full_name}:`);
    
    // Verificar se tem turno ativo
    const temTurnoAtivo = await isPorteiroOnDuty(primeiroPorteiro.id);
    
    if (!temTurnoAtivo) {
      // Iniciar um turno
      console.log('   📝 Iniciando turno para teste...');
      const { data: newShift, error: startError } = await supabase
        .from('porteiro_shifts')
        .insert({
          porteiro_id: primeiroPorteiro.id,
          building_id: primeiroPorteiro.building_id,
          shift_start: new Date().toISOString(),
          status: 'active'
        })
        .select()
        .single();
      
      if (startError) {
        console.error('❌ Erro ao iniciar turno:', startError);
      } else {
        console.log('✅ Turno iniciado com sucesso');
        
        // Testar notificação com turno ativo
        console.log('   📱 Testando notificação com turno ATIVO:');
        const result1 = await processNotification(primeiroPorteiro.id, mockNotifications[0]);
        console.log(`      - Resultado: ${result1.processed ? '✅ PROCESSADA' : '❌ IGNORADA'}`);
        
        // Finalizar turno
        console.log('   🔚 Finalizando turno...');
        const { error: endError } = await supabase
          .from('porteiro_shifts')
          .update({
            shift_end: new Date().toISOString(),
            status: 'completed'
          })
          .eq('id', newShift.id);
        
        if (endError) {
          console.error('❌ Erro ao finalizar turno:', endError);
        } else {
          console.log('✅ Turno finalizado com sucesso');
          
          // Testar notificação sem turno ativo
          console.log('   📱 Testando notificação SEM turno ativo:');
          const result2 = await processNotification(primeiroPorteiro.id, mockNotifications[0]);
          console.log(`      - Resultado: ${result2.processed ? '✅ PROCESSADA' : '❌ IGNORADA'}`);
        }
      }
    } else {
      console.log('   ℹ️ Porteiro já tem turno ativo, testando diretamente...');
      const result = await processNotification(primeiroPorteiro.id, mockNotifications[0]);
      console.log(`   - Resultado com turno ativo: ${result.processed ? '✅ PROCESSADA' : '❌ IGNORADA'}`);
    }
    
    console.log('\n🎉 === TESTE DE FILTRAGEM CONCLUÍDO ===');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar o teste
testNotificationFiltering().catch(console.error);