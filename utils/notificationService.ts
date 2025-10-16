import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const supabaseClient = supabase as any;

// Configuração global de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationToken {
  token: string;
  deviceType: 'android' | 'ios';
  deviceInfo: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

export class NotificationService {
  private static instance: NotificationService;
  private currentToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permission for push notifications denied');
      return false;
    }

    return true;
  }

  async getDeviceToken(): Promise<NotificationToken | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const projectId =
        process.env.EXPO_PUBLIC_PROJECT_ID ||
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      const deviceInfo = {
        model: Device.modelName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        appVersion: '1.0.0', // Pode vir do app.json
      };

      const token: NotificationToken = {
        token: tokenData.data,
        deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceInfo,
      };

      this.currentToken = token.token;
      return token;
    } catch (error) {
      console.error('Error getting device token:', error);
      return null;
    }
  }

  async registerToken(userId: string): Promise<boolean> {
    try {
      const tokenData = await this.getDeviceToken();
      if (!tokenData) return false;

      const timestamp = new Date().toISOString();

      const { error } = await supabaseClient
        .from('user_notification_tokens')
        .upsert(
          {
            user_id: userId,
            device_type: tokenData.deviceType,
            notification_token: tokenData.token,
            device_info: tokenData.deviceInfo,
            is_active: true,
            last_used_at: timestamp,
            updated_at: timestamp,
          },
          {
            onConflict: 'user_id,notification_token',
          },
        );

      if (error) {
        console.error('Error registering token:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in registerToken:', error);
      return false;
    }
  }

  async updateTokenStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      const timestamp = new Date().toISOString();

      const updatePayload = isActive
        ? {
            is_active: true,
            updated_at: timestamp,
            last_used_at: timestamp,
          }
        : {
            is_active: false,
            updated_at: timestamp,
            deactivated_at: timestamp,
          };

      const { error } = await supabaseClient
        .from('user_notification_tokens')
        .update(updatePayload)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating token status:', error);
      }
    } catch (error) {
      console.error('Error updating token status:', error);
    }
  }

  async deactivateAllTokensForUser(userId: string): Promise<void> {
    try {
      await this.updateTokenStatus(userId, false);
    } catch (error) {
      console.error('Error deactivating tokens for user:', error);
    }
  }

  setupNotificationListeners() {
    // Listener para notificações recebidas em foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        this.handleNotificationReceived(notification);
      }
    );

    // Listener para quando usuário toca na notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        this.handleNotificationResponse(response);
      }
    );

    return {
      foregroundSubscription,
      responseSubscription,
    };
  }

  private async handleNotificationReceived(notification: Notifications.Notification) {
    // Atualizar status para 'delivered'
    const notificationId = notification.request.content.data?.notificationId;
    if (typeof notificationId === 'string') {
      await this.updateNotificationStatus(notificationId, 'delivered');
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    
    // Marcar como lida
    if (typeof data?.notificationId === 'string') {
      await this.updateNotificationStatus(data.notificationId, 'read');
    }

    // Navegar para tela apropriada baseado no tipo
    if (data?.type === 'visitor_approval') {
      // Navegar para tela de aprovação de visitante
    }
  }

  private async updateNotificationStatus(notificationId: string, status: string) {
    try {
      await supabaseClient
        .from('notifications')
        .update({ 
          status,
          ...(status === 'delivered' && { sent_at: new Date().toISOString() })
        })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }
}