const axios = require('axios');

// Configuração do teste
const API_BASE_URL = 'http://localhost:3001'; // Porta correta da API
const TEST_DATA = {
  name: 'Teste Usuario',
  phone: '91981941219',
  building: 'Edifício Teste',
  apartment: '101',
  building_id: 'test-building-id',
  profile_id: '13c69a9e-f9bd-4524-a76c-859f97f7fc32' // UUID de teste
};

async function testSendResidentWhatsApp() {
  try {
    console.log('🧪 Testando endpoint /api/send-resident-whatsapp');
    console.log('📤 Dados enviados:', TEST_DATA);
    
    const response = await axios.post(`${API_BASE_URL}/api/send-resident-whatsapp`, TEST_DATA);
    
    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro no teste:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
  }
}

// Executar teste
if (require.main === module) {
  testSendResidentWhatsApp();
}

module.exports = { testSendResidentWhatsApp };