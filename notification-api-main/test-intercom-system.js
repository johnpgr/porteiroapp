const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testIntercomSystem() {
  console.log('🏢 === TESTE COMPLETO DO SISTEMA DE INTERFONE ===\n');

  try {
    // 1. Testar função RPC get_apartment_residents
    console.log('1️⃣ Testando função RPC get_apartment_residents...');
    
    // Buscar um prédio para teste
    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('id, name')
      .limit(1);

    if (buildingsError || !buildings?.length) {
      console.error('❌ Erro ao buscar prédios:', buildingsError);
      return;
    }

    const buildingId = buildings[0].id;
    console.log(`   📍 Usando prédio: ${buildings[0].name} (${buildingId})`);

    // Testar RPC com apartamento "101"
    const { data: residents, error: rpcError } = await supabase
      .rpc('get_apartment_residents', {
        apartment_number: '101',
        building_id: buildingId
      });

    if (rpcError) {
      console.error('❌ Erro na função RPC:', rpcError);
      return;
    }

    console.log(`   ✅ RPC funcionando! Encontrados ${residents?.length || 0} moradores no apartamento 101`);
    
    if (residents?.length > 0) {
      console.log('   👥 Moradores encontrados:');
      residents.forEach((resident, index) => {
        console.log(`      ${index + 1}. ${resident.full_name} (${resident.profile_id})`);
        console.log(`         📧 Email: ${resident.email}`);
        console.log(`         📱 Telefone: ${resident.phone || 'N/A'}`);
        console.log(`         🟢 Online: ${resident.is_online ? 'Sim' : 'Não'}`);
        console.log(`         ✅ Disponível: ${resident.is_available ? 'Sim' : 'Não'}`);
        console.log(`         📲 Tokens: ${resident.device_tokens?.length || 0} dispositivos`);
        console.log('');
      });
    }

    // 2. Testar serviço WebRTC
    console.log('\n2️⃣ Testando serviço WebRTC...');
    
    // Buscar um porteiro para teste
    const { data: porteiros, error: porteirosError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('user_type', 'porteiro')
      .eq('building_id', buildingId)
      .limit(1);

    if (porteirosError || !porteiros?.length) {
      console.error('❌ Nenhum porteiro encontrado para teste:', porteirosError);
      return;
    }

    const porteiro = porteiros[0];
    console.log(`   👮 Usando porteiro: ${porteiro.full_name} (${porteiro.id})`);

    // Importar e testar o serviço WebRTC
    const webrtcService = require('./src/services/webrtcService');
    
    console.log('   📞 Iniciando chamada de interfone...');
    
    const intercomResult = await webrtcService.initiateApartmentCall(
      porteiro.id,
      '101',
      buildingId,
      { timeout: 10000 } // 10 segundos para teste
    );

    console.log('   ✅ Chamada de interfone iniciada com sucesso!');
    console.log(`      🏠 Apartamento: ${intercomResult.apartmentNumber}`);
    console.log(`      👥 Total de moradores: ${intercomResult.totalResidents}`);
    console.log(`      🟢 Moradores ativos: ${intercomResult.activeResidents}`);
    console.log(`      📞 Chamadas iniciadas: ${intercomResult.callsInitiated}`);
    console.log(`      📱 Notificações enviadas: ${intercomResult.notificationsSent}`);
    console.log(`      🆔 ID do grupo: ${intercomResult.intercomGroupId}`);

    if (intercomResult.calls?.length > 0) {
      console.log('   📋 Detalhes das chamadas:');
      intercomResult.calls.forEach((call, index) => {
        console.log(`      ${index + 1}. Chamada ${call.id}`);
        console.log(`         👤 Para: ${call.resident.name}`);
        console.log(`         📊 Status: ${call.status}`);
        console.log(`         🏆 Primário: ${call.resident.is_primary ? 'Sim' : 'Não'}`);
        console.log(`         📱 Notificação enviada: ${call.notification_sent ? 'Sim' : 'Não'}`);
        if (call.devices_notified) {
          console.log(`         📲 Dispositivos notificados: ${call.devices_notified}`);
        }
      });
    }

    // 3. Verificar registros no banco
    console.log('\n3️⃣ Verificando registros no banco de dados...');
    
    const { data: recentCalls, error: callsError } = await supabase
      .from('webrtc_calls')
      .select(`
        id,
        call_type,
        status,
        intercom_group_id,
        initiated_at,
        metadata,
        profiles!webrtc_calls_receiver_id_fkey(full_name)
      `)
      .eq('call_type', 'intercom')
      .order('initiated_at', { ascending: false })
      .limit(5);

    if (callsError) {
      console.error('   ❌ Erro ao buscar chamadas:', callsError);
    } else {
      console.log(`   📋 Últimas ${recentCalls?.length || 0} chamadas de interfone:`);
      recentCalls?.forEach((call, index) => {
        console.log(`      ${index + 1}. Chamada ${call.id}`);
        console.log(`         👤 Para: ${call.profiles?.full_name || 'N/A'}`);
        console.log(`         📊 Status: ${call.status}`);
        console.log(`         🆔 Grupo: ${call.intercom_group_id}`);
        console.log(`         ⏰ Iniciada: ${new Date(call.initiated_at).toLocaleString()}`);
        if (call.metadata?.apartmentNumber) {
          console.log(`         🏠 Apartamento: ${call.metadata.apartmentNumber}`);
        }
      });
    }

    console.log('\n🎉 === TESTE COMPLETO FINALIZADO ===');
    console.log('✅ Sistema de interfone está funcionando corretamente!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Inicie o servidor: npm start');
    console.log('   2. Teste a interface web em: http://localhost:3001/tests/manual/webrtc-test-interface.html');
    console.log('   3. Configure as credenciais do Firebase/APNs para notificações push');
    console.log('   4. Teste com dispositivos móveis reais');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Inicie o servidor: npm start');
    console.log('   2. Teste a interface web em: http://localhost:3001/tests/manual/webrtc-test-interface.html');
    console.log('   3. Configure as credenciais do Firebase/APNs para notificações push');
    console.log('   4. Teste com dispositivos móveis reais');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Executar teste
if (require.main === module) {
  testIntercomSystem()
    .then(() => {
      console.log('\n🏁 Teste finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro fatal no teste:', error);
      process.exit(1);
    });
}

module.exports = { testIntercomSystem };