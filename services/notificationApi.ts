import { Alert } from 'react-native';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'http://10.0.2.2:3001'}/api`;

interface SendVisitorNotificationRequest {
  visitorLogId: string;
  visitorName: string;
  residentPhone: string;
  residentName: string;
  building: string;
  apartment: string;
}

interface SendVisitorNotificationResponse {
  success: boolean;
  message: string;
  token?: string;
  authorizationLink?: string;
}

interface SendRegularizationNotificationRequest {
  name: string;
  phone: string;
  building: string;
  apartment: string;
  issueType: 'visitor' | 'vehicle' | 'package' | 'other';
  description?: string;
}

interface SendRegularizationNotificationResponse {
  success: boolean;
  whatsappSent: boolean;
  messageId?: string;
  regularizationLink?: string;
  recipient?: {
    name: string;
    phone: string;
    building: string;
    apartment: string;
    issueType: string;
  };
  error?: string;
}

interface SendVisitorAuthorizationRequest {
  visitorName: string;
  residentName: string;
  residentPhone: string;
  residentEmail: string;
  building: string;
  apartment: string;
}

interface SendVisitorAuthorizationResponse {
  success: boolean;
  whatsappSent: boolean;
  messageId?: string;
  authorizationLink?: string;
  recipient?: {
    visitorName: string;
    residentName: string;
    residentPhone: string;
    building: string;
    apartment: string;
  };
  error?: string;
  timestamp?: string;
  duration?: string;
}

class NotificationApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`🚀 [NOTIFICATION_API] Iniciando requisição [${requestId}]:`, {
        endpoint,
        url: `${API_BASE_URL}${endpoint}`,
        options,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      console.log(`📡 [NOTIFICATION_API] Resposta recebida [${requestId}]:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [NOTIFICATION_API] Erro HTTP [${requestId}]:`, {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log(`✅ [NOTIFICATION_API] Requisição bem-sucedida [${requestId}]:`, {
        responseData,
        timestamp: new Date().toISOString()
      });
      
      return responseData;
    } catch (error) {
      console.error(`❌ [NOTIFICATION_API] Erro na requisição [${requestId}]:`, {
        endpoint,
        url: `${API_BASE_URL}${endpoint}`,
        options,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async sendVisitorNotification(
    data: SendVisitorNotificationRequest
  ): Promise<SendVisitorNotificationResponse> {
    console.log('📱 [WHATSAPP_VISITOR] Enviando notificação de visitante:', {
      visitorLogId: data.visitorLogId,
      visitorName: data.visitorName,
      residentPhone: data.residentPhone ? `${data.residentPhone.substring(0, 4)}****` : 'N/A',
      building: data.building,
      apartment: data.apartment,
      timestamp: new Date().toISOString()
    });
    
    try {
      const response = await this.makeRequest<SendVisitorNotificationResponse>(
        '/send-visitor-notification',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      console.log('✅ [WHATSAPP_VISITOR] Notificação de visitante enviada com sucesso');
      return response;
    } catch (error) {
      console.error('❌ [WHATSAPP_VISITOR] Falha ao enviar notificação de visitante:', {
        data,
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString()
      });
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Falha ao enviar notificação para o morador'
      );
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; expired?: boolean; data?: any }> {
    try {
      const response = await this.makeRequest<{ valid: boolean; expired?: boolean; data?: any }>(
        `/validate-token/${token}`
      );

      return response;
    } catch (error) {
      console.error('Erro ao validar token:', error);
      return { valid: false };
    }
  }

  async processAuthorization(data: {
    token: string;
    response: 'accept' | 'reject';
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest<{ success: boolean; message: string }>(
        '/process-authorization',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      return response;
    } catch (error) {
      console.error('Erro ao processar autorização:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Falha ao processar resposta de autorização'
      );
    }
  }

  // Método auxiliar para mostrar alertas de erro
  showErrorAlert(title: string, message: string) {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }

  // Método auxiliar para mostrar alertas de sucesso
  showSuccessAlert(title: string, message: string) {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }

  async sendRegularizationNotification(
    data: SendRegularizationNotificationRequest
  ): Promise<SendRegularizationNotificationResponse> {
    try {
      const response = await this.makeRequest<SendRegularizationNotificationResponse>(
        '/send-regularization-whatsapp',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      return response;
    } catch (error) {
      console.error('Erro ao enviar notificação de regularização:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Falha ao enviar notificação de regularização para o morador'
      );
    }
  }

  async sendVisitorAuthorization(
    data: SendVisitorAuthorizationRequest
  ): Promise<SendVisitorAuthorizationResponse> {
    console.log('🔐 [WHATSAPP_AUTH] Enviando autorização de visitante:', {
      visitorName: data.visitorName,
      residentPhone: data.residentPhone ? `${data.residentPhone.substring(0, 4)}****` : 'N/A',
      building: data.building,
      apartment: data.apartment,
      timestamp: new Date().toISOString()
    });
    
    try {
      const response = await this.makeRequest<SendVisitorAuthorizationResponse>(
        '/send-visitor-authorization-whatsapp',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      console.log('✅ [WHATSAPP_AUTH] Autorização de visitante enviada com sucesso:', {
        response,
        timestamp: new Date().toISOString()
      });
      return response;
    } catch (error) {
      console.error('❌ [WHATSAPP_AUTH] Falha ao enviar autorização de visitante:', {
        data,
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString()
      });
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Falha ao enviar autorização de visitante para o morador'
      );
    }
  }

  async sendVisitorWaitingNotification(data: {
    visitor_name: string;
    resident_phone: string;
    resident_name: string;
    building: string;
    apartment: string;
    visitor_log_id: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await this.makeRequest<{ success: boolean; message?: string; error?: string }>(
        '/send-visitor-waiting-notification',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      return response;
    } catch (error) {
      console.error('Erro ao enviar notificação de visitante aguardando:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Falha ao enviar notificação WhatsApp para o morador'
      );
    }
  }
}

export const notificationApi = new NotificationApiService();
export type { 
  SendVisitorNotificationRequest, 
  SendVisitorNotificationResponse,
  SendRegularizationNotificationRequest,
  SendRegularizationNotificationResponse,
  SendVisitorAuthorizationRequest,
  SendVisitorAuthorizationResponse
};