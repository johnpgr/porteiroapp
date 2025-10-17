/**
 * Serviço de WhatsApp - Integração com James Concierge API
 *
 * Este serviço é responsável por enviar mensagens WhatsApp através da API hospedada
 * em https://jamesavisaapi.jamesconcierge.com/
 */

const API_BASE_URL = 'https://jamesavisaapi.jamesconcierge.com';

interface ResidentWhatsAppData {
  name: string;
  phone: string;
  email: string;
  building: string;
  apartment: string;
  profile_id: string;
  temporary_password?: string;
}

interface PorteiroWhatsAppData {
  name: string;
  phone: string;
  email: string;
  building: string;
  cpf: string;
  work_schedule: string;
  profile_id: string;
  temporary_password?: string;
}

interface WhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Envia WhatsApp para morador com credenciais de acesso
 */
export const sendResidentWhatsApp = async (
  data: ResidentWhatsAppData
): Promise<WhatsAppResponse> => {
  try {
    console.log('📱 [WhatsAppService] Enviando WhatsApp para morador:', {
      name: data.name,
      phone: data.phone,
      building: data.building,
      apartment: data.apartment
    });

    const response = await fetch(`${API_BASE_URL}/api/send-resident-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        email: data.email,
        building: data.building,
        apartment: data.apartment,
        profile_id: data.profile_id,
        temporary_password: data.temporary_password
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [WhatsAppService] Erro da API:', result);
      return {
        success: false,
        error: result.error || 'Erro ao enviar WhatsApp'
      };
    }

    console.log('✅ [WhatsAppService] WhatsApp enviado com sucesso');
    return {
      success: true,
      message: result.message,
      data: result.data
    };

  } catch (error) {
    console.error('❌ [WhatsAppService] Erro ao enviar WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar WhatsApp'
    };
  }
};

/**
 * Envia WhatsApp para porteiro com credenciais de acesso
 */
export const sendPorteiroWhatsApp = async (
  data: PorteiroWhatsAppData
): Promise<WhatsAppResponse> => {
  try {
    console.log('📱 [WhatsAppService] Enviando WhatsApp para porteiro:', {
      name: data.name,
      phone: data.phone,
      building: data.building
    });

    const response = await fetch(`${API_BASE_URL}/api/send-porteiro-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        email: data.email,
        building: data.building,
        cpf: data.cpf,
        work_schedule: data.work_schedule,
        profile_id: data.profile_id,
        temporary_password: data.temporary_password
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [WhatsAppService] Erro da API:', result);
      return {
        success: false,
        error: result.error || 'Erro ao enviar WhatsApp'
      };
    }

    console.log('✅ [WhatsAppService] WhatsApp enviado com sucesso para porteiro');
    return {
      success: true,
      message: result.message,
      data: result.data
    };

  } catch (error) {
    console.error('❌ [WhatsAppService] Erro ao enviar WhatsApp para porteiro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar WhatsApp'
    };
  }
};

/**
 * Objeto compatível com a interface antiga de notificationService
 */
export const notificationService = {
  sendResidentWhatsApp,
  sendPorteiroWhatsApp
};

export default notificationService;
