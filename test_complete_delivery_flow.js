require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteDeliveryFlow() {
  console.log('🧪 Testando fluxo completo de entrega...');
  
  try {
    // 1. Buscar um apartamento para teste
    const { data: apartments, error: apartmentError } = await supabase
      .from('apartments')
      .select('id, number, building_id')
      .limit(1)
      .single();
    
    if (apartmentError || !apartments) {
      console.error('❌ Erro ao buscar apartamento:', apartmentError);
      return;
    }
    
    console.log(`📍 Usando apartamento ${apartments.number} (ID: ${apartments.id})`);
    
    // 2. Criar uma nova entrega de teste
    const currentTime = new Date().toISOString();
    const deliveryData = {
      apartment_id: apartments.id,
      building_id: apartments.building_id,
      entry_type: 'delivery',
      tipo_log: 'IN',
      notification_status: 'pending',
      requires_resident_approval: true,
      notification_sent_at: currentTime,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      delivery_sender: 'Mercado Livre',
      delivery_description: 'Smartphone Samsung Galaxy',
      guest_name: 'Entrega de Mercado Livre',
      purpose: 'Entrega: Smartphone Samsung Galaxy',
      log_time: currentTime,
      created_at: currentTime
    };
    
    console.log('📦 Criando entrega de teste...');
    const { data: newDelivery, error: deliveryError } = await supabase
      .from('visitor_logs')
      .insert(deliveryData)
      .select('*')
      .single();
    
    if (deliveryError) {
      console.error('❌ Erro ao criar entrega:', deliveryError);
      return;
    }
    
    console.log('✅ Entrega criada com sucesso!');
    console.log(`ID: ${newDelivery.id}`);
    console.log(`Status: ${newDelivery.notification_status}`);
    console.log(`Tipo: ${newDelivery.entry_type}`);
    console.log(`Remetente: ${newDelivery.delivery_sender}`);
    console.log('');
    
    // 3. Verificar se a entrega aparece nas notificações pendentes
    console.log('🔍 Verificando notificações pendentes...');
    const { data: pendingNotifications, error: pendingError } = await supabase
      .from('visitor_logs')
      .select('*')
      .eq('entry_type', 'delivery')
      .eq('notification_status', 'pending')
      .eq('requires_resident_approval', true);
    
    if (pendingError) {
      console.error('❌ Erro ao buscar notificações pendentes:', pendingError);
      return;
    }
    
    console.log(`📋 Notificações pendentes encontradas: ${pendingNotifications.length}`);
    pendingNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. ID: ${notification.id}`);
      console.log(`   Tipo: ${notification.entry_type}`);
      console.log(`   Status: ${notification.notification_status}`);
      console.log(`   Remetente: ${notification.delivery_sender}`);
      console.log(`   Descrição: ${notification.delivery_description}`);
      console.log(`   Expira em: ${notification.expires_at}`);
      console.log('---');
    });
    
    // 4. Verificar se a entrega específica está na lista
    const ourDelivery = pendingNotifications.find(n => n.id === newDelivery.id);
    if (ourDelivery) {
      console.log('✅ Nossa entrega de teste está nas notificações pendentes!');
    } else {
      console.log('❌ Nossa entrega de teste NÃO está nas notificações pendentes!');
    }
    
    // 5. Simular aprovação da entrega (deixar na portaria)
    console.log('');
    console.log('🏠 Simulando aprovação da entrega (deixar na portaria)...');
    
    const { data: updatedDelivery, error: updateError } = await supabase
      .from('visitor_logs')
      .update({
        notification_status: 'approved',
        delivery_destination: 'portaria',
        resident_response_at: new Date().toISOString()
      })
      .eq('id', newDelivery.id)
      .select('*')
      .single();
    
    if (updateError) {
      console.error('❌ Erro ao aprovar entrega:', updateError);
      return;
    }
    
    console.log('✅ Entrega aprovada com sucesso!');
    console.log(`Status final: ${updatedDelivery.notification_status}`);
    console.log(`Destino: ${updatedDelivery.delivery_destination}`);
    console.log('');
    
    // 6. Verificar se a entrega não aparece mais nas pendentes
    console.log('🔍 Verificando se a entrega não aparece mais nas pendentes...');
    const { data: finalPendingNotifications, error: finalPendingError } = await supabase
      .from('visitor_logs')
      .select('*')
      .eq('entry_type', 'delivery')
      .eq('notification_status', 'pending')
      .eq('requires_resident_approval', true);
    
    if (finalPendingError) {
      console.error('❌ Erro ao buscar notificações pendentes finais:', finalPendingError);
      return;
    }
    
    const stillPending = finalPendingNotifications.find(n => n.id === newDelivery.id);
    if (!stillPending) {
      console.log('✅ Entrega não aparece mais nas notificações pendentes!');
    } else {
      console.log('❌ Entrega ainda aparece nas notificações pendentes!');
    }
    
    console.log('');
    console.log('🎉 Teste do fluxo completo de entrega finalizado!');
    console.log(`📊 Notificações pendentes restantes: ${finalPendingNotifications.length}`);
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testCompleteDeliveryFlow();