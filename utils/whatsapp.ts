import { Alert } from 'react-native';

// Configurações da Evolution API
const EVOLUTION_API_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_EVOLUTION_API_URL || 'https://evolutionapi.atendimentoemagrecer.com.br/',
  token: process.env.EXPO_PUBLIC_EVOLUTION_API_TOKEN || '09E5A1E9AA3C-495D-BEDF-50DCD30DE760',
  instance: process.env.EXPO_PUBLIC_EVOLUTION_INSTANCE || 'desenvolvimento',
};

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
 * @param phone - Número de telefone a ser validado
 * @returns boolean - true se válido, false caso contrário
 */
export const validateBrazilianPhone = (phone: string): boolean => {
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
  baseUrl: string = 'https://cadastro.porteiroapp.com'
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
 * @param residentData - Dados do morador
 * @param baseUrl - URL base do site de cadastro (opcional)
 * @returns Promise<WhatsAppResponse> - Resposta da operação
 */
export const sendWhatsAppMessage = async (
  residentData: ResidentData,
  baseUrl?: string
): Promise<WhatsAppResponse> => {
  try {
    // Valida o número de telefone
    if (!validateBrazilianPhone(residentData.phone)) {
      return {
        success: false,
        error: 'Número de telefone inválido. Use o formato (XX) 9XXXX-XXXX',
      };
    }

    // Gera o link e a mensagem
    const registrationLink = generateRegistrationLink(residentData, baseUrl);
    const message = generateWhatsAppMessage(residentData, registrationLink);

    // Prepara o número no formato internacional
    const cleanPhone = residentData.phone.replace(/\D/g, '');
    const internationalPhone = `55${cleanPhone}`;

    // Dados para a Evolution API
    const apiData = {
      number: internationalPhone,
      text: message,
    };

    // Faz a chamada para a Evolution API
    const response = await fetch(
      `${EVOLUTION_API_CONFIG.baseUrl}/message/sendText/${EVOLUTION_API_CONFIG.instance}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_CONFIG.token,
        },
        body: JSON.stringify(apiData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Erro HTTP: ${response.status}`,
      };
    }

    await response.json();

    return {
      success: true,
      message: 'Mensagem enviada com sucesso!',
    };
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
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
 * @returns boolean - true se configurada, false caso contrário
 */
export const isEvolutionApiConfigured = (): boolean => {
  return (
    EVOLUTION_API_CONFIG.baseUrl !== 'https://your-evolution-api-url.com' &&
    EVOLUTION_API_CONFIG.token !== 'your-api-token' &&
    EVOLUTION_API_CONFIG.instance !== 'your-instance-name'
  );
};

/**
 * Mostra alerta de configuração da Evolution API
 */
export const showConfigurationAlert = (): void => {
  Alert.alert(
    'Configuração Necessária',
    'Para usar o WhatsApp, configure as variáveis de ambiente:\n\n' +
      '• EXPO_PUBLIC_EVOLUTION_API_URL\n' +
      '• EXPO_PUBLIC_EVOLUTION_API_TOKEN\n' +
      '• EXPO_PUBLIC_EVOLUTION_INSTANCE\n\n' +
      'Consulte a documentação para mais detalhes.',
    [{ text: 'OK' }]
  );
};
