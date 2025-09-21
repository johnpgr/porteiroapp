const axios = require('axios');

// Configuração da API
const API_BASE_URL = 'http://localhost:3001';

// Função para simular webhook do WhatsApp
async function simulateWhatsAppWebhook(messageData) {
  try {
    console.log('🧪 Testando webhook com dados:', JSON.stringify(messageData, null, 2));
    
    const response = await axios.post(`${API_BASE_URL}/webhook/whatsapp-webhook`, messageData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta do webhook:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    return null;
  }
}

// Cenários de teste
async function runTests() {
  console.log('🚀 Iniciando testes das mensagens de confirmação do WhatsApp\n');
  
  // Teste 1: Resposta de botão - ACEITAR visita
  console.log('📋 TESTE 1: Botão ACEITAR visita');
  await simulateWhatsAppWebhook({
    data: {
      messages: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'test_message_1'
        },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'approve_test-token-123'
          }
        }
      }]
    }
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 2: Resposta de botão - RECUSAR visita
  console.log('📋 TESTE 2: Botão RECUSAR visita');
  await simulateWhatsAppWebhook({
    data: {
      messages: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'test_message_2'
        },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'reject_test-token-456'
          }
        }
      }]
    }
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 3: Resposta de botão - ELEVADOR para entrega
  console.log('📋 TESTE 3: Botão ELEVADOR para entrega');
  await simulateWhatsAppWebhook({
    data: {
      messages: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'test_message_3'
        },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'elevator_test-token-789'
          }
        }
      }]
    }
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 4: Resposta de botão - PORTARIA para entrega
  console.log('📋 TESTE 4: Botão PORTARIA para entrega');
  await simulateWhatsAppWebhook({
    data: {
      messages: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'test_message_4'
        },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'portaria_test-token-101'
          }
        }
      }]
    }
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 5: Resposta numérica - 1 (ACEITAR)
  console.log('📋 TESTE 5: Resposta numérica "1" (ACEITAR)');
  await simulateWhatsAppWebhook({
    data: {
      messages: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'test_message_5'
        },
        message: {
          conversation: '1'
        }
      }]
    }
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 6: Resposta numérica - 2 (RECUSAR)
  console.log('📋 TESTE 6: Resposta numérica "2" (RECUSAR)');
  await simulateWhatsAppWebhook({
    data: {
      messages: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          id: 'test_message_6'
        },
        message: {
          conversation: '2'
        }
      }]
    }
  });
  
  console.log('\n🏁 Testes concluídos!');
}

// Executar os testes
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { simulateWhatsAppWebhook, runTests };