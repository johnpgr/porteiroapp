/**
 * Script para testar notificação WhatsApp de visitante
 * Simula uma notificação de visita chamando a API local
 */

const API_BASE_URL = 'http://localhost:3001';
const PHONE_NUMBER = '91981941219';

/**
 * Dados realistas para teste de notificação
 */
const testData = {
  visitor_name: 'João Silva',
  resident_phone: PHONE_NUMBER,
  resident_name: 'Maria Santos',
  building: 'Edifício Residencial Sunset',
  apartment: '101',
  visitor_log_id: null // Opcional para teste
};

/**
 * Função para enviar notificação de visitante aguardando
 */
async function sendVisitorWaitingNotification() {
  try {
    console.log('🚀 Iniciando teste de notificação WhatsApp...');
    console.log('📱 Número de destino:', PHONE_NUMBER);
    console.log('📋 Dados do teste:', JSON.stringify(testData, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/api/send-visitor-waiting-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Notificação enviada com sucesso!');
      console.log('📊 Resposta da API:', JSON.stringify(result, null, 2));
      
      if (result.messageId) {
        console.log('📧 ID da mensagem WhatsApp:', result.messageId);
      }
      
      return { success: true, data: result };
    } else {
      console.error('❌ Erro ao enviar notificação:');
      console.error('📄 Status:', response.status);
      console.error('📋 Resposta:', JSON.stringify(result, null, 2));
      
      return { success: false, error: result };
    }
    
  } catch (error) {
    console.error('💥 Erro de conexão ou execução:');
    console.error('🔍 Detalhes:', error.message);
    console.error('📚 Stack:', error.stack);
    
    return { success: false, error: error.message };
  }
}

/**
 * Função para testar se a API está online
 */
async function checkAPIHealth() {
  try {
    console.log('🔍 Verificando status da API...');
    
    const response = await fetch(`${API_BASE_URL}/health`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ API está online!');
      console.log('📊 Status:', JSON.stringify(result, null, 2));
      return true;
    } else {
      console.error('❌ API retornou erro:', response.status);
      return false;
    }
    
  } catch (error) {
    console.error('💥 Erro ao conectar com a API:');
    console.error('🔍 Detalhes:', error.message);
    return false;
  }
}

/**
 * Função principal para executar o teste
 */
async function runTest() {
  console.log('🎯 === TESTE DE NOTIFICAÇÃO WHATSAPP ===');
  console.log('⏰ Iniciado em:', new Date().toLocaleString());
  console.log('');
  
  // Verificar se a API está online
  const apiOnline = await checkAPIHealth();
  
  if (!apiOnline) {
    console.error('🚫 Teste cancelado: API não está disponível');
    console.log('💡 Certifique-se de que a API está rodando em:', API_BASE_URL);
    return;
  }
  
  console.log('');
  
  // Enviar notificação de teste
  const result = await sendVisitorWaitingNotification();
  
  console.log('');
  console.log('📋 === RESULTADO DO TESTE ===');
  
  if (result.success) {
    console.log('🎉 SUCESSO: Notificação enviada!');
    console.log('📱 Verifique o WhatsApp do número:', PHONE_NUMBER);
    console.log('💬 A mensagem deve conter informações sobre o visitante:', testData.visitor_name);
  } else {
    console.log('❌ FALHA: Notificação não foi enviada');
    console.log('🔍 Verifique os logs acima para mais detalhes');
  }
  
  console.log('⏰ Finalizado em:', new Date().toLocaleString());
}

// Executar o teste se o script for chamado diretamente
if (require.main === module) {
  runTest().catch(error => {
    console.error('💥 Erro fatal no teste:', error);
    process.exit(1);
  });
}

// Exportar funções para uso em outros scripts
module.exports = {
  sendVisitorWaitingNotification,
  checkAPIHealth,
  runTest,
  testData
};