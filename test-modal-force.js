// Script para forçar exibição do modal de chamada para teste
// Execute este script no console do navegador para simular uma chamada

console.log('🧪 [TESTE] Forçando exibição do modal de chamada...');

// Simular dados de uma chamada
const testCallData = {
  callId: 'test-call-' + Date.now(),
  apartmentNumber: '101',
  doormanName: 'Porteiro Teste',
  buildingName: 'Prédio Teste',
  doormanId: 'doorman-test',
  buildingId: 'building-test',
  action: 'incoming_call',
  type: 'intercom_call'
};

// Simular notificação recebida
if (window.Expo && window.Expo.Notifications) {
  console.log('🧪 [TESTE] Simulando notificação...');
  
  // Criar evento de notificação simulado
  const mockNotification = {
    request: {
      content: {
        data: testCallData
      }
    }
  };
  
  // Disparar evento customizado para simular notificação
  window.dispatchEvent(new CustomEvent('test-notification', {
    detail: mockNotification
  }));
  
  console.log('🧪 [TESTE] Notificação simulada enviada:', testCallData);
} else {
  console.log('🧪 [TESTE] Expo.Notifications não disponível');
}

// Função para testar diretamente o estado do React (se disponível)
if (window.React) {
  console.log('🧪 [TESTE] React disponível - tentando forçar estado...');
}

console.log('🧪 [TESTE] Script de teste executado. Verifique se o modal apareceu.');