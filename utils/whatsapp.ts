import { Alert } from 'react-native';

// Configurações da Evolution API
const EVOLUTION_API_CONFIG = {
  baseUrl:
    process.env.EXPO_PUBLIC_EVOLUTION_API_URL ||
    'https://evolutionapi.atendimentoemagrecer.com.br',
  token: process.env.EXPO_PUBLIC_EVOLUTION_API_TOKEN || '09E5A1E9AA3C-495D-BEDF-50DCD30DE760',
  instance: process.env.EXPO_PUBLIC_EVOLUTION_INSTANCE || 'desenvolvimento',
};

// Logs de debug para configuração
console.log('Evolution API Config:', {
  baseUrl: EVOLUTION_API_CONFIG.baseUrl,
  hasToken: !!EVOLUTION_API_CONFIG.token,
  tokenLength: EVOLUTION_API_CONFIG.token?.length || 0,
  instance: EVOLUTION_API_CONFIG.instance,
});

// Interface para dados do morador
export interface ResidentData {
  name: string;
  phone: string;
  building: string;
  apartment: string;
}

// Interface para resposta da API
interface WhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Valida se o número de telefone está no formato brasileiro correto
 * Aceita formatos: (XX) 9XXXX-XXXX, (XX) XXXX-XXXX, XX9XXXXXXXX, XX XXXXXXXX
 * @param phone - Número de telefone a ser validado
 * @returns boolean - true se válido, false caso contrário
 */
export const validateBrazilianPhone = (phone: string): boolean => {
  // Validação de entrada
  if (!phone || typeof phone !== 'string') {
    console.warn('validateBrazilianPhone: Telefone inválido ou não fornecido:', phone);
    return false;
  }
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');

  // Verifica se tem 10 ou 11 dígitos (com DDD)
  // Formato: (XX) 9XXXX-XXXX ou (XX) XXXX-XXXX
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return false;
  }

  // Verifica se o DDD é válido (11 a 99)
  const ddd = parseInt(cleanPhone.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Para celular (11 dígitos), o terceiro dígito deve ser 9
  if (cleanPhone.length === 11 && cleanPhone[2] !== '9') {
    return false;
  }

  return true;
};

/**
 * Formata o número de telefone para o padrão brasileiro
 * @param phone - Número de telefone a ser formatado
 * @returns string - Número formatado
 */
export const formatBrazilianPhone = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');

  if (cleanPhone.length === 10) {
    return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 6)}-${cleanPhone.substring(6)}`;
  } else if (cleanPhone.length === 11) {
    return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 7)}-${cleanPhone.substring(7)}`;
  }

  return phone;
};

/**
 * Gera o link personalizado de cadastro com parâmetros
 * @param residentData - Dados do morador
 * @param baseUrl - URL base do site de cadastro
 * @returns string - Link completo com parâmetros
 */
export const generateRegistrationLink = (
  residentData: ResidentData,
  baseUrl: string = 'https://cadastro.jamesconcierge.com/'
): string => {
  const cleanPhone = residentData.phone.replace(/\D/g, '');

  const params = new URLSearchParams({
    telefone: cleanPhone,
    nome: residentData.name,
    apto: residentData.apartment,
    predio: residentData.building,
  });

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Gera a mensagem personalizada para o WhatsApp
 * @param residentData - Dados do morador
 * @param registrationLink - Link de cadastro gerado
 * @returns string - Mensagem formatada
 */
export const generateWhatsAppMessage = (
  residentData: ResidentData,
  registrationLink: string
): string => {
  return `Olá, ${residentData.name}! 👋\n\nComplete seu cadastro no PorteiroApp clicando no link abaixo:\n\n${registrationLink}\n\nSeus dados já estão pré-preenchidos para facilitar o processo.\n\nQualquer dúvida, entre em contato conosco! 📱`;
};

/**
 * Envia mensagem via WhatsApp usando a Evolution API
 * @param residentData - Dados do morador (nome, telefone, prédio, apartamento)
 * @param baseUrl - URL base do site de cadastro (opcional, padrão: https://cadastro.porteiroapp.com)
 * @returns Promise<WhatsAppResponse> - Resposta da operação com status de sucesso/erro
 */
export const sendWhatsAppMessage = async (
  residentData: ResidentData,
  baseUrl?: string
): Promise<WhatsAppResponse> => {
  console.log('🚀 Iniciando envio de mensagem WhatsApp:', {
    name: residentData.name,
    phone: residentData.phone,
    building: residentData.building,
    apartment: residentData.apartment,
    baseUrl,
  });

  try {
    // Validação de entrada mais robusta
    if (!residentData || typeof residentData !== 'object') {
      const error = 'Dados do morador não fornecidos ou inválidos';
      console.error('❌ Erro de validação:', error);
      return { success: false, error };
    }

    if (!residentData.name?.trim()) {
      const error = 'Nome do morador é obrigatório';
      console.error('❌ Erro de validação:', error);
      return { success: false, error };
    }

    if (!residentData.phone?.trim()) {
      const error = 'Telefone do morador é obrigatório';
      console.error('❌ Erro de validação:', error);
      return { success: false, error };
    }

    // Valida o número de telefone
    if (!validateBrazilianPhone(residentData.phone)) {
      const error = 'Número de telefone inválido. Use o formato (XX) 9XXXX-XXXX';
      console.error('❌ Telefone inválido:', residentData.phone);
      return { success: false, error };
    }

    // Gera o link e a mensagem
    const registrationLink = generateRegistrationLink(residentData, baseUrl);
    const message = generateWhatsAppMessage(residentData, registrationLink);
    
    console.log('📝 Mensagem gerada:', {
      registrationLink,
      messageLength: message.length,
    });

    // Prepara o número no formato internacional
    const cleanPhone = residentData.phone.replace(/\D/g, '');
    const internationalPhone = `55${cleanPhone}`;
    
    console.log('📱 Número formatado:', {
      original: residentData.phone,
      clean: cleanPhone,
      international: internationalPhone,
    });

    // Dados para a Evolution API
    const apiData = {
      number: internationalPhone,
      text: message,
    };

    const apiUrl = `${EVOLUTION_API_CONFIG.baseUrl}/message/sendText/${EVOLUTION_API_CONFIG.instance}`;
    console.log('🌐 Fazendo chamada para Evolution API:', {
      url: apiUrl,
      hasToken: !!EVOLUTION_API_CONFIG.token,
      instance: EVOLUTION_API_CONFIG.instance,
    });

    // Faz a chamada para a Evolution API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_CONFIG.token,
      },
      body: JSON.stringify(apiData),
    });

    console.log('📡 Resposta da API:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
        console.error('❌ Erro detalhado da API:', errorData);
      } catch (parseError) {
        console.error('❌ Erro ao parsear resposta de erro:', parseError);
      }
      
      const errorMessage = errorData.message || errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMessage,
      };
    }

    let responseData: any = {};
    try {
      responseData = await response.json();
      console.log('✅ Resposta de sucesso da API:', responseData);
    } catch (parseError) {
      console.warn('⚠️ Não foi possível parsear resposta de sucesso:', parseError);
    }

    console.log('🎉 Mensagem enviada com sucesso!');
    return {
      success: true,
      message: 'Mensagem enviada com sucesso!',
    };
  } catch (error) {
    console.error('💥 Erro inesperado ao enviar mensagem WhatsApp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      error: `Erro de conexão: ${errorMessage}`,
    };
  }
};

/**
 * Envia mensagens em massa para múltiplos moradores
 * @param residentsData - Array com dados dos moradores
 * @param baseUrl - URL base do site de cadastro (opcional)
 * @returns Promise<{success: number, failed: number, errors: string[]}> - Resultado do envio em massa
 */
export const sendBulkWhatsAppMessages = async (
  residentsData: ResidentData[],
  baseUrl?: string
): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> => {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Envia mensagens com delay para evitar rate limiting
  for (let i = 0; i < residentsData.length; i++) {
    const resident = residentsData[i];

    try {
      const result = await sendWhatsAppMessage(resident, baseUrl);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${resident.name}: ${result.error}`);
      }

      // Delay de 1 segundo entre mensagens para evitar rate limiting
      if (i < residentsData.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch {
      results.failed++;
      results.errors.push(`${resident.name}: Erro inesperado`);
    }
  }

  return results;
};

/**
 * Verifica se a Evolution API está configurada corretamente
 * Valida se todas as variáveis de ambiente necessárias estão definidas e não são strings vazias
 * @returns boolean - true se configurada corretamente, false caso contrário
 */
export const isEvolutionApiConfigured = (): boolean => {
  const hasBaseUrl = !!process.env.EXPO_PUBLIC_EVOLUTION_API_URL?.trim();
  const hasToken = !!process.env.EXPO_PUBLIC_EVOLUTION_API_TOKEN?.trim();
  const hasInstance = !!process.env.EXPO_PUBLIC_EVOLUTION_INSTANCE?.trim();
  
  const isConfigured = hasBaseUrl && hasToken && hasInstance;
  
  console.log('🔧 Verificação de configuração Evolution API:', {
    hasBaseUrl,
    hasToken,
    hasInstance,
    isConfigured,
    baseUrl: process.env.EXPO_PUBLIC_EVOLUTION_API_URL || 'não definida',
    instance: process.env.EXPO_PUBLIC_EVOLUTION_INSTANCE || 'não definida',
  });
  
  return isConfigured;
};

/**
 * Testa a conectividade com a Evolution API
 * Faz uma chamada de teste para verificar se a API está respondendo
 * @returns Promise<{success: boolean, message: string, details?: any}> - Resultado do teste
 */
export const testEvolutionApiConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  console.log('🧪 Iniciando teste de conectividade Evolution API...');
  
  try {
    if (!isEvolutionApiConfigured()) {
      return {
        success: false,
        message: 'Configuração da Evolution API incompleta. Verifique as variáveis de ambiente.',
      };
    }

    const testUrl = `${EVOLUTION_API_CONFIG.baseUrl}/instance/connect/${EVOLUTION_API_CONFIG.instance}`;
    console.log('🌐 Testando URL:', testUrl);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_CONFIG.token,
      },
    });

    console.log('📡 Resposta do teste:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: true,
        message: 'Conexão com Evolution API estabelecida com sucesso!',
        details: data,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Erro na conexão: HTTP ${response.status} - ${response.statusText}`,
        details: errorData,
      };
    }
  } catch (error) {
    console.error('💥 Erro no teste de conectividade:', error);
    return {
      success: false,
      message: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
};

/**
 * Mostra alerta de configuração da Evolution API
 * Exibe informações detalhadas sobre as variáveis de ambiente necessárias
 */
export const showConfigurationAlert = (): void => {
  const config = {
    hasUrl: !!process.env.EXPO_PUBLIC_EVOLUTION_API_URL?.trim(),
    hasToken: !!process.env.EXPO_PUBLIC_EVOLUTION_API_TOKEN?.trim(),
    hasInstance: !!process.env.EXPO_PUBLIC_EVOLUTION_INSTANCE?.trim(),
  };

  let message = 'Para usar o WhatsApp, configure as variáveis de ambiente:\n\n';
  
  message += `• EXPO_PUBLIC_EVOLUTION_API_URL ${config.hasUrl ? '✅' : '❌'}\n`;
  message += `• EXPO_PUBLIC_EVOLUTION_API_TOKEN ${config.hasToken ? '✅' : '❌'}\n`;
  message += `• EXPO_PUBLIC_EVOLUTION_INSTANCE ${config.hasInstance ? '✅' : '❌'}\n\n`;
  
  if (config.hasUrl && config.hasToken && config.hasInstance) {
    message += 'Todas as variáveis estão configuradas! ✅';
  } else {
    message += 'Consulte a documentação para mais detalhes.';
  }

  Alert.alert('Configuração Evolution API', message, [{ text: 'OK' }]);
};
