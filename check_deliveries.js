require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDeliveries() {
  try {
    console.log('Verificando registros de entrega...');
    
    // Buscar todas as entregas
    const { data: deliveries, error } = await supabase
      .from('visitor_logs')
      .select('id, entry_type, notification_status, guest_name, delivery_sender, delivery_description, created_at')
      .eq('entry_type', 'delivery')
      .limit(10);
    
    if (error) {
      console.error('Erro ao buscar entregas:', error);
      return;
    }
    
    console.log(`\nTotal de entregas encontradas: ${deliveries?.length || 0}`);
    
    if (deliveries && deliveries.length > 0) {
      console.log('\nEntregas:');
      deliveries.forEach((delivery, index) => {
        console.log(`${index + 1}. ID: ${delivery.id}`);
        console.log(`   Status: ${delivery.notification_status}`);
        console.log(`   Remetente: ${delivery.delivery_sender || 'N/A'}`);
        console.log(`   Descrição: ${delivery.delivery_description || 'N/A'}`);
        console.log(`   Criado em: ${delivery.created_at}`);
        console.log('---');
      });
    } else {
      console.log('Nenhuma entrega encontrada.');
    }
    
    // Buscar entregas pendentes especificamente
    const { data: pendingDeliveries, error: pendingError } = await supabase
      .from('visitor_logs')
      .select('id, entry_type, notification_status, guest_name, delivery_sender, delivery_description')
      .eq('entry_type', 'delivery')
      .eq('notification_status', 'pending')
      .limit(5);
    
    if (pendingError) {
      console.error('Erro ao buscar entregas pendentes:', pendingError);
      return;
    }
    
    console.log(`\nEntregas pendentes: ${pendingDeliveries?.length || 0}`);
    
    if (pendingDeliveries && pendingDeliveries.length > 0) {
      console.log('\nEntregas pendentes:');
      pendingDeliveries.forEach((delivery, index) => {
        console.log(`${index + 1}. ID: ${delivery.id}`);
        console.log(`   Remetente: ${delivery.delivery_sender || 'N/A'}`);
        console.log(`   Descrição: ${delivery.delivery_description || 'N/A'}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkDeliveries();