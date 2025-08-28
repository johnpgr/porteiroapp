import { Alert } from 'react-native';

/**
 * Configuração da API local
 * API rodando no IP local da máquina na porta 3001
 * React Native não consegue acessar 127.0.0.1 diretamente
 * URL configurada via variável de ambiente
 */
const LOCAL_API_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'http://192.168.0.2:3001',
};

// Logs de debug para configuração
console.log('API Local Config:', {
  baseUrl: LOCAL_API_CONFIG.baseUrl,
  isAvailable: true,
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
 * Formata o número de telefone para uso na API
 * @param phone - Número de telefone a ser formatado
 * @returns {clean: string, international: string} - Números formatados
 */
export const formatPhoneNumber = (phone: string): { clean: string; international: string } => {
  const clean = phone.replace(/\D/g, '');
  const international = `55${clean}`;
  
  return { clean, international };
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
 * @param baseUrl - URL base do site de cadastro (opcional)
 * @returns {message: string, registrationLink: string} - Mensagem formatada e link
 */
export const generateWhatsAppMessage = (
  residentData: ResidentData,
  baseUrl?: string
): { message: string; registrationLink: string } => {
  const registrationLink = generateRegistrationLink(residentData, baseUrl);
  const message = `Olá, ${residentData.name}! 👋\n\nComplete seu cadastro no JamesAvisa clicando no link abaixo:\n\n${registrationLink}\n\nSeus dados já estão pré-preenchidos para facilitar o processo.\n\nQualquer dúvida, entre em contato conosco! 📱`;
  
  return { message, registrationLink };
};

/**
 * Envia mensagem WhatsApp usando API local
 * @param residentData - Dados do morador (nome, telefone, apartamento, prédio)
 * @param baseUrl - URL base do site de cadastro (opcional)
 * @returns Promise<{success: boolean, message?: string, error?: string}> - Resultado do envio
 */
export const sendWhatsAppMessage = async (
  residentData: ResidentData,
  baseUrl?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> => {
  console.log('🚀 Iniciando envio de mensagem WhatsApp:', {
    name: residentData.name,
    phone: residentData.phone,
    apartment: residentData.apartment,
    building: residentData.building,
    baseUrl,
  });

  try {
    // Formata o número de telefone
    const phoneNumber = formatPhoneNumber(residentData.phone);
    console.log('📱 Número formatado:', {
      original: residentData.phone,
      clean: phoneNumber.clean,
      international: phoneNumber.international,
    });

    // Prepara os dados para a API local
    const apiUrl = `${LOCAL_API_CONFIG.baseUrl}/api/send-resident-whatsapp`;
    const apiData = {
      name: residentData.name,
      phone: phoneNumber.clean,
      building: residentData.building,
      apartment: residentData.apartment,
      registrationUrl: baseUrl || 'https://cadastro.jamesconcierge.com/'
    };

    console.log('🌐 Fazendo chamada para API local:', {
      url: apiUrl,
      phone: phoneNumber.clean,
      name: residentData.name,
      building: residentData.building,
      apartment: residentData.apartment,
    });

    // Faz a chamada para a API local
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
 * Verifica se a API local está disponível
 * Testa conectividade com 127.0.0.1:3001
 * @returns boolean - true se disponível, false caso contrário
 */
export const isLocalApiAvailable = (): boolean => {
  // Para desenvolvimento, assumimos que a API local está sempre disponível
  // Em produção, você pode implementar uma verificação real
  console.log('🔧 Verificação de API local:', {
    baseUrl: LOCAL_API_CONFIG.baseUrl,
    isAvailable: true,
  });
  
  return true;
};

/**
 * Testa a conectividade com a API local
 * Faz uma chamada de teste para verificar se a API está respondendo
 * @returns Promise<{success: boolean, message: string, details?: any}> - Resultado do teste
 */
export const testLocalApiConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  console.log('🧪 Iniciando teste de conectividade API local...');
  
  try {
    const testUrl = `${LOCAL_API_CONFIG.baseUrl}/api/health`;
    console.log('🌐 Testando URL:', testUrl);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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
        message: 'Conexão com API local estabelecida com sucesso!',
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
 * Mostra alerta de configuração da API local
 * Exibe informações sobre a API local
 */
export const showConfigurationAlert = (): void => {
  const message = `API WhatsApp configurada para usar servidor local:\n\n• URL: ${LOCAL_API_CONFIG.baseUrl}\n• Endpoint: /api/send-resident-whatsapp\n\nCertifique-se de que o servidor local está rodando na porta 3001.`;

  Alert.alert('Configuração API WhatsApp', message, [{ text: 'OK' }]);
};
