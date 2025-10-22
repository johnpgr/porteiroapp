import { Alert } from 'react-native';

/**
 * Configuração da API de notificação
 * URL configurada via variável de ambiente
 * Deve apontar para a API remota em produção
 */
const API_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://jamesavisaapi.jamesconcierge.com',
};

// Logs de debug para configuração
console.log('API Config:', {
  baseUrl: API_CONFIG.baseUrl,
  isAvailable: true,
});

// Interface para dados do morador
export interface ResidentData {
  name: string;
  phone: string;
  building: string;
  apartment: string;
  email?: string;
  profile_id?: string;
  temporaryPassword?: string;
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
  // Validar se phone existe e não é undefined/null
  if (!phone || typeof phone !== 'string') {
    console.warn('formatPhoneNumber: Telefone inválido ou não fornecido:', phone);
    return { clean: '', international: '55' };
  }
  
  const clean = phone.replace(/\D/g, '');
  const international = `55${clean}`;
  
  return { clean, international };
};

/**
 * Gera o link personalizado de cadastro com profile_id
 * @param residentData - Dados do morador
 * @param baseUrl - URL base do site de cadastro
 * @returns string - Link completo com profile_id
 */
export const generateRegistrationLink = (
  residentData: ResidentData,
  baseUrl: string = 'https://jamesavisa.jamesconcierge.com/cadastro/morador/completar'
): string => {
  // Se o residentData contém profile_id, usar o formato correto
  if (residentData.profile_id) {
    return `${baseUrl}?profile_id=${residentData.profile_id}`;
  }
  
  // Fallback para compatibilidade com formato antigo
  // Validar se phone existe antes de usar replace
  if (!residentData.phone) {
    console.warn('generateRegistrationLink: Telefone não fornecido, usando apenas dados básicos');
    const params = new URLSearchParams({
      nome: residentData.name || '',
      apto: residentData.apartment || '',
      predio: residentData.building || '',
    });
    return `${baseUrl}?${params.toString()}`;
  }
  
  const cleanPhone = residentData.phone.replace(/\D/g, '');
  const params = new URLSearchParams({
    telefone: cleanPhone,
    nome: residentData.name || '',
    apto: residentData.apartment || '',
    predio: residentData.building || '',
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
  
  // Incluir credenciais de acesso na mensagem se disponível
  const passwordInfo = residentData.temporaryPassword 
    ? `\n\n🔐 SUAS CREDENCIAIS DE ACESSO:\n\n📧 E-mail: ${residentData.email || residentData.phone}\n🔑 Senha: ${residentData.temporaryPassword}\n\n💡 IMPORTANTE: Use essas credenciais para fazer login no aplicativo!`
    : '';
  
  const message = `🏢 JamesAvisa - Cadastro de Morador\n\nOlá *${residentData.name}*!\n\nVocê foi convidado(a) para se cadastrar no JamesAvisa.\n\n📍 Dados do seu apartamento:\n🏢 Prédio: ${residentData.building}\n🚪 Apartamento: ${residentData.apartment}\n\nPara completar seu cadastro, clique no link abaixo:\n\`${registrationLink}\`${passwordInfo}\n\nCom o JamesAvisa você pode:\n✅ Receber visitantes com mais segurança\n✅ Autorizar entregas remotamente\n✅ Comunicar-se diretamente com a portaria\n✅ Acompanhar movimentações do seu apartamento\n\nMensagem enviada automaticamente pelo sistema JamesAvisa`;
  
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
    // Validar dados obrigatórios
    if (!residentData.name) {
      return {
        success: false,
        error: 'Nome do morador é obrigatório',
      };
    }

    // Formata o número de telefone
    const phoneNumber = formatPhoneNumber(residentData.phone);
    console.log('📱 Número formatado:', {
      original: residentData.phone,
      clean: phoneNumber.clean,
      international: phoneNumber.international,
    });

    // Verificar se o telefone foi formatado corretamente
    if (!phoneNumber.clean) {
      return {
        success: false,
        error: 'Número de telefone inválido ou não fornecido',
      };
    }

    // Gera email automaticamente se não fornecido
    const email = residentData.email || `${phoneNumber.clean}@temp.jamesconcierge.com`;

    // Prepara os dados para a API - incluindo profile_id, senha temporária e email
    const apiUrl = `${API_CONFIG.baseUrl}/api/send-resident-whatsapp`;
    const apiData = {
      name: residentData.name,
      phone: phoneNumber.clean,
      email: email,
      building: residentData.building,
      apartment: residentData.apartment,
      profile_id: residentData.profile_id,
      temporary_password: residentData.temporaryPassword || residentData.temporary_password
    };

    console.log('🌐 Fazendo chamada para API:', {
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
 * Verifica se a API está disponível
 * @returns boolean - true se disponível, false caso contrário
 */
export const isApiAvailable = (): boolean => {
  // Para desenvolvimento, assumimos que a API está sempre disponível
  // Em produção, você pode implementar uma verificação real
  console.log('🔧 Verificação de API:', {
    baseUrl: API_CONFIG.baseUrl,
    isAvailable: true,
  });
  
  return true;
};

/**
 * Testa a conectividade com a API
 * Faz uma chamada de teste para verificar se a API está respondendo
 * @returns Promise<{success: boolean, message: string, details?: any}> - Resultado do teste
 */
export const testApiConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  console.log('🧪 Iniciando teste de conectividade API...');
  
  try {
    const testUrl = `${API_CONFIG.baseUrl}/health`;
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
        message: 'Conexão com API estabelecida com sucesso!',
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
 * Mostra alerta de configuração da API
 * Exibe informações sobre a API
 */
export const showConfigurationAlert = (): void => {
  const message = `API WhatsApp configurada:\n\n• URL: ${API_CONFIG.baseUrl}\n• Endpoint: /api/register-resident\n\nCertifique-se de que a API está acessível.`;

  Alert.alert('Configuração API WhatsApp', message, [{ text: 'OK' }]);
};
