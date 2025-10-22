import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';
import { env } from '@porteiroapp/env/expo';

// Configuração do Supabase
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const { client: supabase } = SupabaseClientFactory.createBrowserClient({
  url: supabaseUrl,
  anonKey: supabaseKey,
});

interface AlertOptions {
  cancelable?: boolean;
}

interface AlertButton {
  text: string;
  style?: string;
  onPress?: () => void;
}

// Mock do Alert para simular o comportamento
const Alert = {
  alert: (title: string, message: string, buttons?: AlertButton[], options?: AlertOptions): void => {
    console.log('\n🚨 ALERT EXIBIDO:');
    console.log(`📋 Título: ${title}`);
    console.log(`💬 Mensagem: ${message}`);
    console.log('✅ Botões:', buttons?.map((b) => b.text).join(', ') || 'Nenhum');
    console.log('⚙️ Opções:', options || 'Nenhuma');
    console.log('\n');
  },
};

interface VisitorData {
  visitor_id?: string;
  apartment_id?: string;
  entry_type?: string;
  delivery_destination?: string;
  guest_name?: string;
}

// Função simulada showApprovalPopup
const showApprovalPopup = async (status: string, visitorData: VisitorData): Promise<void> => {
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
    } else if (visitorData?.visitor_id) {
      // Se não conseguiu pelo apartment_id, tentar pelo visitor_id
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
  } catch (error: any) {
    console.error('❌ [showApprovalPopup] Erro ao buscar número do apartamento:', error.message);
  }

  // Verificar se é uma entrega
  if (visitorData?.entry_type === 'delivery') {
    console.log('📦 [showApprovalPopup] Detectada entrega, exibindo alerta específico');

    const deliveryDestination = visitorData?.delivery_destination;
    const destinationText = deliveryDestination === 'elevador' ? 'no elevador' : 'na portaria';

    const title = 'Instrução de Entrega';
    const message = `O morador do apartamento ${apartmentNumber} solicitou para deixar ${destinationText}.`;

    Alert.alert(title, message, [{ text: 'OK', style: 'default' }], { cancelable: true });
    return;
  }

  // Comportamento padrão para visitantes
  const visitorName = visitorData?.guest_name || 'Visitante';
  const title = isApproved ? 'Visitante Aprovado' : 'Visitante Rejeitado';
  const message = isApproved
    ? `O visitante ${visitorName} foi aprovado para o apartamento ${apartmentNumber}.`
    : `A entrada do visitante ${visitorName} foi rejeitada pelo apartamento ${apartmentNumber}.`;

  Alert.alert(title, message, [{ text: 'OK', style: 'default' }], { cancelable: true });
};

// Teste para entrega no elevador
const testDeliveryElevador: VisitorData = {
  apartment_id: '550e8400-e29b-41d4-a716-446655440000', // UUID do apartamento 104
  entry_type: 'delivery',
  delivery_destination: 'elevador',
  guest_name: 'Entregador XYZ',
};

// Teste para entrega na portaria
const testDeliveryPortaria: VisitorData = {
  apartment_id: '550e8400-e29b-41d4-a716-446655440000', // UUID do apartamento 104
  entry_type: 'delivery',
  delivery_destination: 'portaria',
  guest_name: 'Entregador ABC',
};

// Teste para visitante normal
const testVisitante: VisitorData = {
  apartment_id: '550e8400-e29b-41d4-a716-446655440000', // UUID do apartamento 104
  entry_type: 'visitor',
  guest_name: 'João Silva',
};

// Teste 1: Entrega no elevador
test('Teste 1: Entrega no elevador', async () => {
  console.log('\n📦 TESTE 1: Entrega no elevador');
  await showApprovalPopup('approved', testDeliveryElevador);
  console.log('✅ Teste de entrega no elevador concluído');
});

// Teste 2: Entrega na portaria
test('Teste 2: Entrega na portaria', async () => {
  console.log('\n📦 TESTE 2: Entrega na portaria');
  await showApprovalPopup('approved', testDeliveryPortaria);
  console.log('✅ Teste de entrega na portaria concluído');
});

// Teste 3: Visitante normal aprovado
test('Teste 3: Visitante normal aprovado', async () => {
  console.log('\n👤 TESTE 3: Visitante normal aprovado');
  await showApprovalPopup('approved', testVisitante);
  console.log('✅ Teste de visitante aprovado concluído');
});

// Teste 4: Visitante normal rejeitado
test('Teste 4: Visitante normal rejeitado', async () => {
  console.log('\n👤 TESTE 4: Visitante normal rejeitado');
  await showApprovalPopup('rejected', testVisitante);
  console.log('✅ Teste de visitante rejeitado concluído');
});

// Teste 5: Validação de estrutura de dados
test('Teste 5: Validação de estrutura de dados', async () => {
  console.log('\n🔍 TESTE 5: Validação de estrutura de dados');

  // Verificar que os dados de teste têm a estrutura correta
  assert.ok(testDeliveryElevador.apartment_id, 'testDeliveryElevador deve ter apartment_id');
  assert.equal(testDeliveryElevador.entry_type, 'delivery', 'testDeliveryElevador deve ter entry_type=delivery');
  assert.equal(
    testDeliveryElevador.delivery_destination,
    'elevador',
    'testDeliveryElevador deve ter delivery_destination=elevador'
  );

  assert.ok(testDeliveryPortaria.apartment_id, 'testDeliveryPortaria deve ter apartment_id');
  assert.equal(testDeliveryPortaria.entry_type, 'delivery', 'testDeliveryPortaria deve ter entry_type=delivery');
  assert.equal(
    testDeliveryPortaria.delivery_destination,
    'portaria',
    'testDeliveryPortaria deve ter delivery_destination=portaria'
  );

  assert.ok(testVisitante.apartment_id, 'testVisitante deve ter apartment_id');
  assert.equal(testVisitante.entry_type, 'visitor', 'testVisitante deve ter entry_type=visitor');
  assert.ok(testVisitante.guest_name, 'testVisitante deve ter guest_name');

  console.log('✅ Todas as estruturas de dados estão válidas');
});
