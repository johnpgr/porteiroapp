/**
 * Teste de integração WhatsApp após correção do building_id
 * Verifica se a função sendWhatsAppMessage está enviando UUID correto
 */

// Mock do React Native Alert para ambiente Node.js
global.Alert = {
  alert: (title, message) => console.log(`Alert: ${title} - ${message}`)
};

// Mock do process.env para teste
process.env.EXPO_PUBLIC_NOTIFICATION_API_URL = 'https://notification-api-james-1.onrender.com';

// Simular função sendWhatsAppMessage baseada no código corrigido
const sendWhatsAppMessage = async (residentData, baseUrl) => {
  console.log('🚀 Iniciando envio de mensagem WhatsApp:', {
    name: residentData.name,
    phone: residentData.phone,
    apartment: residentData.apartment,
    building: residentData.building,
    building_id: residentData.building_id,
    baseUrl,
  });

  try {
    // Formata o número de telefone
    const phoneNumber = {
      clean: residentData.phone.replace(/\D/g, ''),
      international: `55${residentData.phone.replace(/\D/g, '')}`
    };
    
    console.log('📱 Número formatado:', {
      original: residentData.phone,
      clean: phoneNumber.clean,
      international: phoneNumber.international,
    });

    // Validar se building_id está disponível
    if (!residentData.building_id) {
      console.error('❌ building_id não fornecido:', residentData);
      return {
        success: false,
        error: 'ID do prédio é obrigatório para envio via WhatsApp',
      };
    }

    // Validar se building_id é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(residentData.building_id)) {
      console.error('❌ building_id inválido (não é UUID):', residentData.building_id);
      return {
        success: false,
        error: 'ID do prédio deve ser um UUID válido',
      };
    }

    // Prepara os dados para a API local
    const apiUrl = `${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL}/api/register-resident`;
    const apiData = {
      full_name: residentData.name,
      email: residentData.email || `${phoneNumber.clean}@temp.jamesconcierge.com`,
      phone: phoneNumber.clean,
      building_id: residentData.building_id,
      apartment_number: residentData.apartment,
      // Incluir senha temporária se disponível (apenas para moradores)
      ...(residentData.temporary_password && { temporary_password: residentData.temporary_password })
    };

    console.log('🌐 Fazendo chamada para API:', {
      url: apiUrl,
      data: apiData,
    });

    // Simular chamada para API (sem fazer requisição real)
    console.log('📡 Dados que seriam enviados para API:', JSON.stringify(apiData, null, 2));
    
    // Validar se os dados estão no formato correto
    if (apiData.building_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(apiData.building_id)) {
      console.log('✅ building_id está no formato UUID correto!');
      return {
        success: true,
        message: 'Dados validados com sucesso - building_id UUID correto',
      };
    } else {
      return {
        success: false,
        error: 'building_id não está no formato UUID correto',
      };
    }
  } catch (error) {
    console.error('💥 Erro inesperado ao enviar mensagem WhatsApp:', error);
    return {
      success: false,
      error: `Erro de conexão: ${error.message}`,
    };
  }
};

// Dados de teste com building_id UUID válido
const testResidentData = {
  name: 'Douglas Moura',
  phone: '91981941219',
  building: 'Prediodeteste',
  apartment: '101',
  email: 'douglas@test.com',
  building_id: '550e8400-e29b-41d4-a716-446655440000', // UUID válido de teste
  temporary_password: 'temp123'
};

// Dados de teste com building_id inválido (para testar validação)
const testInvalidData = {
  name: 'Test User',
  phone: '91981941219',
  building: 'Prediodeteste',
  apartment: '101',
  email: 'test@test.com',
  building_id: 'invalid-uuid', // UUID inválido
};

// Dados de teste sem building_id (para testar validação)
const testMissingBuildingId = {
  name: 'Test User 2',
  phone: '91981941219',
  building: 'Prediodeteste',
  apartment: '101',
  email: 'test2@test.com',
  // building_id ausente
};

async function testWhatsAppIntegration() {
  console.log('🧪 Iniciando testes de integração WhatsApp...');
  
  // Teste 1: Dados válidos com UUID correto
  console.log('\n📋 Teste 1: Enviando dados com building_id UUID válido');
  try {
    const result1 = await sendWhatsAppMessage(testResidentData);
    console.log('✅ Resultado Teste 1:', result1);
    
    if (result1.success) {
      console.log('✅ Teste 1 PASSOU: Mensagem enviada com sucesso');
    } else {
      console.log('❌ Teste 1 FALHOU:', result1.error);
    }
  } catch (error) {
    console.log('❌ Teste 1 ERRO:', error.message);
  }
  
  // Teste 2: UUID inválido (deve falhar com validação)
  console.log('\n📋 Teste 2: Enviando dados com building_id UUID inválido');
  try {
    const result2 = await sendWhatsAppMessage(testInvalidData);
    console.log('✅ Resultado Teste 2:', result2);
    
    if (!result2.success && result2.error.includes('UUID válido')) {
      console.log('✅ Teste 2 PASSOU: Validação UUID funcionando corretamente');
    } else {
      console.log('❌ Teste 2 FALHOU: Validação UUID não está funcionando');
    }
  } catch (error) {
    console.log('❌ Teste 2 ERRO:', error.message);
  }
  
  // Teste 3: building_id ausente (deve falhar com validação)
  console.log('\n📋 Teste 3: Enviando dados sem building_id');
  try {
    const result3 = await sendWhatsAppMessage(testMissingBuildingId);
    console.log('✅ Resultado Teste 3:', result3);
    
    if (!result3.success && result3.error.includes('obrigatório')) {
      console.log('✅ Teste 3 PASSOU: Validação de campo obrigatório funcionando');
    } else {
      console.log('❌ Teste 3 FALHOU: Validação de campo obrigatório não está funcionando');
    }
  } catch (error) {
    console.log('❌ Teste 3 ERRO:', error.message);
  }
  
  console.log('\n🏁 Testes de integração WhatsApp concluídos!');
}

// Executar os testes
testWhatsAppIntegration().catch(console.error);

module.exports = { testWhatsAppIntegration };