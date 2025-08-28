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
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async sendVisitorNotification(
    data: SendVisitorNotificationRequest
  ): Promise<SendVisitorNotificationResponse> {
    try {
      const response = await this.makeRequest<SendVisitorNotificationResponse>(
        '/send-visitor-notification',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      return response;
    } catch (error) {
      console.error('Erro ao enviar notificação de visitante:', error);
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
    try {
      const response = await this.makeRequest<SendVisitorAuthorizationResponse>(
        '/send-visitor-authorization-whatsapp',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      return response;
    } catch (error) {
      console.error('Erro ao enviar autorização de visitante:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Falha ao enviar autorização de visitante para o morador'
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