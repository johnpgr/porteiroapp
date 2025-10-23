const { env } = require('@porteiroapp/env/node');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mock do Alert para simular o comportamento
const Alert = {
  alert: (title, message, buttons, options) => {
    console.log('\n🚨 ALERT EXIBIDO:');
    console.log(`📋 Título: ${title}`);
    console.log(`💬 Mensagem: ${message}`);
    console.log('✅ Botões:', buttons?.map(b => b.text).join(', ') || 'Nenhum');
    console.log('⚙️ Opções:', options || 'Nenhuma');
    console.log('\n');
  }
};

// Função simulada showApprovalPopup
const showApprovalPopup = async (status, visitorData) => {
  console.log('🎯 [showApprovalPopup] Dados recebidos:', JSON.stringify(visitorData, null, 2));
  
  const isApproved = status === 'approved';
  let apartmentNumber = 'N/A';
  
  try {
    console.log('🔍 [showApprovalPopup] Tentando buscar apartamento com visitor_id:', visitorData?.visitor_id);
    console.log('🔍 [showApprovalPopup] Tentando buscar apartamento com apartment_id:', visitorData?.apartment_id);
    
    // Primeiro tentar pelo apartment_id diretamente (mais provável de estar no payload)
    if (visitorData?.apartment_id) {
      console.log('🏠 [showApprovalPopup] Buscando via apartment_id...');
      const { data: apartmentInfo, error } = await supabase
        .from('apartments')
        .select('number')
        .eq('id', visitorData.apartment_id)
        .single();
      
      console.log('🏠 [showApprovalPopup] Resultado busca apartment:', { apartmentInfo, error });
      
      if (!error && apartmentInfo?.number) {
        apartmentNumber = apartmentInfo.number;
        console.log('✅ [showApprovalPopup] Apartamento encontrado via apartment_id:', apartmentNumber);
      }
    }
    // Se não conseguiu pelo apartment_id, tentar pelo visitor_id
    else if (visitorData?.visitor_id) {
      console.log('📋 [showApprovalPopup] Buscando via visitor_id...');
      const { data: visitorInfo, error } = await supabase
        .from('visitors')
        .select(`
          apartment_id,
          apartments!inner(
            number
          )
        `)
        .eq('id', visitorData.visitor_id)
        .single();
      
      console.log('📋 [showApprovalPopup] Resultado busca visitor:', { visitorInfo, error });
      
      if (!error && visitorInfo?.apartments?.number) {
        apartmentNumber = visitorInfo.apartments.number;
        console.log('✅ [showApprovalPopup] Apartamento encontrado via visitor_id:', apartmentNumber);
      }
    }
  } catch (error) {
    console.error('❌ [showApprovalPopup] Erro ao buscar número do apartamento:', error);
  }
  
  // Verificar se é uma entrega
  if (visitorData?.entry_type === 'delivery') {
    console.log('📦 [showApprovalPopup] Detectada entrega, exibindo alerta específico');
    
    const deliveryDestination = visitorData?.delivery_destination;
    const destinationText = deliveryDestination === 'elevador' ? 'no elevador' : 'na portaria';
    
    const title = 'Instrução de Entrega';
    const message = `O morador do apartamento ${apartmentNumber} solicitou para deixar ${destinationText}.`;
    
    Alert.alert(
      title,
      message,
      [{ text: 'OK', style: 'default' }],
      { cancelable: true }
    );
    return;
  }
  
  // Comportamento padrão para visitantes
  const visitorName = visitorData?.guest_name || 'Visitante';
  const title = isApproved ? 'Visitante Aprovado' : 'Visitante Rejeitado';
  const message = isApproved 
    ? `O visitante ${visitorName} foi aprovado para o apartamento ${apartmentNumber}.`
    : `A entrada do visitante ${visitorName} foi rejeitada pelo apartamento ${apartmentNumber}.`;
  
  Alert.alert(
    title,
    message,
    [{ text: 'OK', style: 'default' }],
    { cancelable: true }
  );
};

// Teste para entrega no elevador
const testDeliveryElevador = {
  apartment_id: '550e8400-e29b-41d4-a716-446655440000', // UUID do apartamento 104
  visitor_id: null,
  entry_type: 'delivery',
  delivery_destination: 'elevador',
  guest_name: 'Entregador XYZ'
};

// Teste para entrega na portaria
const testDeliveryPortaria = {
  apartment_id: '550e8400-e29b-41d4-a716-446655440000', // UUID do apartamento 104
  visitor_id: null,
  entry_type: 'delivery',
  delivery_destination: 'portaria',
  guest_name: 'Entregador ABC'
};

// Teste para visitante normal
const testVisitante = {
  apartment_id: '550e8400-e29b-41d4-a716-446655440000', // UUID do apartamento 104
  visitor_id: null,
  entry_type: 'visitor',
  guest_name: 'João Silva'
};

// Executar testes
async function runTests() {
  console.log('🧪 === INICIANDO TESTES DA FUNÇÃO showApprovalPopup ===\n');
  
  console.log('📦 TESTE 1: Entrega no elevador');
  await showApprovalPopup('approved', testDeliveryElevador);
  
  console.log('📦 TESTE 2: Entrega na portaria');
  await showApprovalPopup('approved', testDeliveryPortaria);
  
  console.log('👤 TESTE 3: Visitante normal aprovado');
  await showApprovalPopup('approved', testVisitante);
  
  console.log('👤 TESTE 4: Visitante normal rejeitado');
  await showApprovalPopup('rejected', testVisitante);
  
  console.log('✅ === TESTES CONCLUÍDOS ===');
}

runTests().catch(console.error);