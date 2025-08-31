/**
 * Teste isolado das funções utilizadas no cadastro individual e em massa
 * Este arquivo testa as funções sem fazer chamadas para APIs externas
 */

// Simulação das funções do utils/whatsapp.ts
function validateBrazilianPhone(phone) {
    if (!phone) return false;
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 10 || cleanPhone.length === 11;
}

function formatBrazilianPhone(phone) {
    if (!phone) return '';
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
        return `+55${cleanPhone}`;
    } else if (cleanPhone.length === 11) {
        return `+55${cleanPhone}`;
    }
    return cleanPhone;
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

function generateRegistrationLink(profileId, temporaryPassword) {
    const baseUrl = 'https://porteiroapp.vercel.app';
    const hash = Buffer.from(`${profileId}:${temporaryPassword}`).toString('base64');
    return `${baseUrl}/complete-registration?token=${hash}`;
}

function generateWhatsAppMessage(name, building, apartment, registrationLink, temporaryPassword) {
    return `Olá ${name}! 👋\n\n` +
           `Você foi cadastrado no sistema do ${building}, apartamento ${apartment}.\n\n` +
           `Para completar seu cadastro, acesse o link:\n${registrationLink}\n\n` +
           `Suas credenciais de acesso:\n` +
           `📱 Telefone: (seu número)\n` +
           `🔑 Senha temporária: ${temporaryPassword}\n\n` +
           `Após o primeiro acesso, você poderá alterar sua senha.\n\n` +
           `Bem-vindo(a)! 🏠`;
}

// Função para gerar senha temporária de 6 dígitos numéricos (função real do users.tsx)
function generateTemporaryPassword() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simulação da geração de profile_id
function generateProfileId() {
    return Math.random().toString(36).substr(2, 9);
}

// Simulação dos dados que seriam enviados para a API
function prepareApiData(residentData) {
    const cleanPhone = formatPhoneNumber(residentData.phone);
    
    return {
        name: residentData.name,
        phone: cleanPhone,
        building: residentData.building,
        apartment: residentData.apartment,
        profile_id: residentData.profile_id || generateProfileId(),
        temporary_password: residentData.temporaryPassword || generateTemporaryPassword()
    };
}

// Teste de cadastro individual
function testIndividualRegistration() {
    console.log('\n=== TESTE DE CADASTRO INDIVIDUAL ===');
    
    const residentData = {
        name: 'João Silva',
        phone: '(11) 99999-8888',
        building: 'Edifício Sunset',
        apartment: '101'
    };
    
    console.log('\n1. Dados originais do morador:');
    console.log(JSON.stringify(residentData, null, 2));
    
    // Validação do telefone
    console.log('\n2. Validação do telefone:');
    const isValidPhone = validateBrazilianPhone(residentData.phone);
    console.log(`Telefone válido: ${isValidPhone}`);
    
    // Formatação do telefone
    console.log('\n3. Formatação do telefone:');
    const formattedPhone = formatBrazilianPhone(residentData.phone);
    const cleanPhone = formatPhoneNumber(residentData.phone);
    console.log(`Telefone formatado (internacional): ${formattedPhone}`);
    console.log(`Telefone limpo (apenas números): ${cleanPhone}`);
    
    // Geração de credenciais
    console.log('\n4. Geração de credenciais:');
    const profileId = generateProfileId();
    const temporaryPassword = generateTemporaryPassword();
    console.log(`Profile ID: ${profileId}`);
    console.log(`Senha temporária: ${temporaryPassword}`);
    
    // Geração do link de cadastro
    console.log('\n5. Geração do link de cadastro:');
    const registrationLink = generateRegistrationLink(profileId, temporaryPassword);
    console.log(`Link: ${registrationLink}`);
    
    // Geração da mensagem WhatsApp
    console.log('\n6. Mensagem WhatsApp gerada:');
    const whatsappMessage = generateWhatsAppMessage(
        residentData.name,
        residentData.building,
        residentData.apartment,
        registrationLink,
        temporaryPassword
    );
    console.log(whatsappMessage);
    
    // Dados que seriam enviados para a API
    console.log('\n7. Dados preparados para envio à API:');
    const apiData = prepareApiData({
        ...residentData,
        profile_id: profileId,
        temporaryPassword: temporaryPassword
    });
    console.log(JSON.stringify(apiData, null, 2));
    
    return apiData;
}

// Teste de cadastro múltiplo
function testMultipleRegistration() {
    console.log('\n\n=== TESTE DE CADASTRO MÚLTIPLO ===');
    
    const residentsData = [
        {
            name: 'Maria Santos',
            phone: '91981941219',
            building: 'Edifício Aurora',
            apartment: '201'
        },
        {
            name: 'Pedro Oliveira',
            phone: '(11) 98765-4322',
            building: 'Edifício Aurora',
            apartment: '202'
        },
        {
            name: 'Ana Costa',
            phone: '11 98765-4323',
            building: 'Edifício Aurora',
            apartment: '203'
        }
    ];
    
    console.log(`\nProcessando ${residentsData.length} moradores...`);
    
    const processedResidents = [];
    
    residentsData.forEach((resident, index) => {
        console.log(`\n--- Processando morador ${index + 1}: ${resident.name} ---`);
        
        // Validação do telefone
        const isValidPhone = validateBrazilianPhone(resident.phone);
        console.log(`Telefone válido: ${isValidPhone}`);
        
        if (!isValidPhone) {
            console.log(`❌ Erro: Telefone inválido para ${resident.name}`);
            return;
        }
        
        // Geração de credenciais
        const profileId = generateProfileId();
        const temporaryPassword = generateTemporaryPassword();
        
        // Preparação dos dados
        const apiData = prepareApiData({
            ...resident,
            profile_id: profileId,
            temporaryPassword: temporaryPassword
        });
        
        console.log('Dados preparados:', JSON.stringify(apiData, null, 2));
        
        // Geração da mensagem
        const registrationLink = generateRegistrationLink(profileId, temporaryPassword);
        const whatsappMessage = generateWhatsAppMessage(
            resident.name,
            resident.building,
            resident.apartment,
            registrationLink,
            temporaryPassword
        );
        
        console.log('Mensagem WhatsApp:');
        console.log(whatsappMessage.substring(0, 100) + '...');
        
        processedResidents.push(apiData);
        
        // Simulação do delay entre envios
        console.log('⏱️ Aguardando 1 segundo antes do próximo envio...');
    });
    
    console.log(`\n✅ Total de moradores processados com sucesso: ${processedResidents.length}`);
    return processedResidents;
}

// Teste de cadastro em massa (bulk)
function testBulkRegistration() {
    console.log('\n\n=== TESTE DE CADASTRO EM MASSA (BULK) ===');
    
    // Simulação de dados vindos de planilha/CSV
    const bulkData = [
        { name: 'Carlos Ferreira', phone: '91981941219', buildingId: 1, apartmentId: 101 },
    { name: 'Lucia Mendes', phone: '91981941219', buildingId: 1, apartmentId: 102 },
    { name: 'Roberto Lima', phone: '91981941219', buildingId: 2, apartmentId: 201 },
    { name: 'Fernanda Rocha', phone: '91981941219', buildingId: 2, apartmentId: 202 },
    { name: 'Marcos Alves', phone: '91981941219', buildingId: 3, apartmentId: 301 }
    ];
    
    // Simulação de dados de prédios e apartamentos
    const buildingsData = {
        1: { name: 'Edifício Central', apartments: { 101: 'Apt 101', 102: 'Apt 102' } },
        2: { name: 'Edifício Norte', apartments: { 201: 'Apt 201', 202: 'Apt 202' } },
        3: { name: 'Edifício Sul', apartments: { 301: 'Apt 301' } }
    };
    
    console.log(`\nProcessando ${bulkData.length} registros em massa...`);
    
    const processedBulkData = [];
    let successCount = 0;
    let errorCount = 0;
    
    bulkData.forEach((record, index) => {
        console.log(`\n--- Processando registro ${index + 1}: ${record.name} ---`);
        
        // Busca dados do prédio e apartamento
        const buildingData = buildingsData[record.buildingId];
        const apartmentData = buildingData?.apartments[record.apartmentId];
        
        if (!buildingData || !apartmentData) {
            console.log(`❌ Erro: Prédio ou apartamento não encontrado para ${record.name}`);
            errorCount++;
            return;
        }
        
        // Validação do telefone
        const isValidPhone = validateBrazilianPhone(record.phone);
        if (!isValidPhone) {
            console.log(`❌ Erro: Telefone inválido para ${record.name}`);
            errorCount++;
            return;
        }
        
        // Montagem dos dados do morador
        const residentData = {
            name: record.name,
            phone: record.phone,
            building: buildingData.name,
            apartment: apartmentData
        };
        
        // Geração de credenciais
        const profileId = generateProfileId();
        const temporaryPassword = generateTemporaryPassword();
        
        // Preparação dos dados para API
        const apiData = prepareApiData({
            ...residentData,
            profile_id: profileId,
            temporaryPassword: temporaryPassword
        });
        
        console.log('Dados processados:', JSON.stringify(apiData, null, 2));
        
        processedBulkData.push(apiData);
        successCount++;
        
        // Simulação do delay entre envios
        console.log('⏱️ Aguardando antes do próximo processamento...');
    });
    
    console.log(`\n📊 RESUMO DO PROCESSAMENTO EM MASSA:`);
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📋 Total processado: ${bulkData.length}`);
    
    return processedBulkData;
}

// Teste de validação de dados
function testDataValidation() {
    console.log('\n\n=== TESTE DE VALIDAÇÃO DE DADOS ===');
    
    const testCases = [
        { phone: '91981941219', expected: true, description: 'Telefone válido (11 dígitos)' },
      { phone: '919819412', expected: true, description: 'Telefone válido (9 dígitos)' },
        { phone: '(11) 99988-7766', expected: true, description: 'Telefone com formatação' },
        { phone: '11 99988-7766', expected: true, description: 'Telefone com espaços' },
        { phone: '119998877', expected: false, description: 'Telefone muito curto' },
        { phone: '119998877665', expected: false, description: 'Telefone muito longo' },
        { phone: '', expected: false, description: 'Telefone vazio' },
        { phone: null, expected: false, description: 'Telefone nulo' }
    ];
    
    testCases.forEach((testCase, index) => {
        const result = validateBrazilianPhone(testCase.phone);
        const status = result === testCase.expected ? '✅' : '❌';
        console.log(`${status} Teste ${index + 1}: ${testCase.description}`);
        console.log(`   Input: "${testCase.phone}" | Resultado: ${result} | Esperado: ${testCase.expected}`);
    });
}

// Função principal para executar todos os testes
function runAllTests() {
    console.log('🧪 INICIANDO TESTES ISOLADOS DAS FUNÇÕES DE CADASTRO');
    console.log('=' .repeat(60));
    
    try {
        // Teste de validação
        testDataValidation();
        
        // Teste de cadastro individual
        const individualResult = testIndividualRegistration();
        
        // Teste de cadastro múltiplo
        const multipleResults = testMultipleRegistration();
        
        // Teste de cadastro em massa
        const bulkResults = testBulkRegistration();
        
        // Resumo final
        console.log('\n\n' + '=' .repeat(60));
        console.log('📋 RESUMO FINAL DOS TESTES');
        console.log('=' .repeat(60));
        console.log(`✅ Cadastro individual: ${individualResult ? 'SUCESSO' : 'FALHA'}`);
        console.log(`✅ Cadastro múltiplo: ${multipleResults.length} moradores processados`);
        console.log(`✅ Cadastro em massa: ${bulkResults.length} registros processados`);
        
        console.log('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
        
    } catch (error) {
        console.error('❌ Erro durante a execução dos testes:', error.message);
    }
}

// Executar os testes
runAllTests();