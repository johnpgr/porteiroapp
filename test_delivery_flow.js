require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeliveryFlow() {
  try {
    console.log('🧪 Testando fluxo de entrega...');
    
    // 1. Buscar um apartamento para teste
    const { data: apartments, error: aptError } = await supabase
      .from('apartments')
      .select('id, number, building_id')
      .limit(1);
    
    if (aptError || !apartments?.length) {
      console.error('❌ Erro ao buscar apartamento:', aptError);
      return;
    }
    
    const apartment = apartments[0];
    console.log(`📍 Usando apartamento ${apartment.number} (ID: ${apartment.id})`);
    
    // 2. Criar uma nova entrega de teste
    const deliveryData = {
      apartment_id: apartment.id,
      building_id: apartment.building_id,
      entry_type: 'delivery',
      tipo_log: 'IN', // Campo obrigatório
      notification_status: 'pending',
      requires_resident_approval: true,
      notification_sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      delivery_sender: 'Amazon',
      delivery_description: 'Pacote de teste',
      guest_name: 'Entrega de Amazon',
      created_at: new Date().toISOString()
    };
    
    console.log('📦 Criando entrega de teste...');
    const { data: newDelivery, error: deliveryError } = await supabase
      .from('visitor_logs')
      .insert([deliveryData])
      .select()
      .single();
    
    if (deliveryError) {
      console.error('❌ Erro ao criar entrega:', deliveryError);
      return;
    }
    
    console.log('✅ Entrega criada com sucesso!');
    console.log('ID:', newDelivery.id);
    console.log('Status:', newDelivery.notification_status);
    console.log('Tipo:', newDelivery.entry_type);
    console.log('Remetente:', newDelivery.delivery_sender);
    
    // 3. Verificar se a entrega aparece nas notificações pendentes
    console.log('\n🔍 Verificando notificações pendentes...');
    const { data: pendingNotifications, error: pendingError } = await supabase
      .from('visitor_logs')
      .select('*')
      .eq('apartment_id', apartment.id)
      .eq('notification_status', 'pending')
      .eq('requires_resident_approval', true)
      .gt('expires_at', new Date().toISOString());
    
    if (pendingError) {
      console.error('❌ Erro ao buscar notificações pendentes:', pendingError);
      return;
    }
    
    console.log(`📋 Notificações pendentes encontradas: ${pendingNotifications?.length || 0}`);
    
    if (pendingNotifications?.length > 0) {
      pendingNotifications.forEach((notification, index) => {
        console.log(`${index + 1}. ID: ${notification.id}`);
        console.log(`   Tipo: ${notification.entry_type}`);
        console.log(`   Status: ${notification.notification_status}`);
        console.log(`   Remetente: ${notification.delivery_sender || 'N/A'}`);
        console.log(`   Descrição: ${notification.delivery_description || 'N/A'}`);
        console.log('---');
      });
    }
    
    // 4. Simular resposta do morador (escolher portaria)
    console.log('\n🏠 Simulando resposta do morador (deixar na portaria)...');
    const { error: responseError } = await supabase
      .from('visitor_logs')
      .update({
        notification_status: 'approved',
        delivery_destination: 'portaria',
        resident_response_at: new Date().toISOString()
      })
      .eq('id', newDelivery.id);
    
    if (responseError) {
      console.error('❌ Erro ao processar resposta:', responseError);
      return;
    }
    
    console.log('✅ Resposta processada com sucesso!');
    
    // 5. Verificar o status final
    const { data: finalDelivery, error: finalError } = await supabase
      .from('visitor_logs')
      .select('*')
      .eq('id', newDelivery.id)
      .single();
    
    if (finalError) {
      console.error('❌ Erro ao verificar status final:', finalError);
      return;
    }
    
    console.log('\n📊 Status final da entrega:');
    console.log('Status:', finalDelivery.notification_status);
    console.log('Destino:', finalDelivery.delivery_destination);
    console.log('Respondido em:', finalDelivery.resident_response_at);
    
    console.log('\n🎉 Teste do fluxo de entrega concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

testDeliveryFlow();