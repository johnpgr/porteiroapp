/**
 * Serviço de Notificações Push - Expo Notifications
 *
 * Este serviço gerencia:
 * - Registro de push tokens
 * - Configuração de notificações
 * - Envio de notificações push via Edge Functions
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '~/utils/supabase';

// Configurar comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export interface NotificationData {
  type: 'visitor_approved' | 'visitor_rejected' | 'visitor_waiting' | 'delivery' | 'emergency' | 'general';
  visitor_id?: string;
  visitor_name?: string;
  apartment_id?: string;
  apartment_number?: string;
  delivery_id?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Registra o dispositivo para receber notificações push
 * Retorna o Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // Verificar se é dispositivo físico
    if (!Device.isDevice) {
      console.warn('⚠️ [NotificationService] Push notifications só funcionam em dispositivos físicos');
      return null;
    }

    // Solicitar permissões
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.error('❌ [NotificationService] Permissão de notificação negada');
      return null;
    }

    // Obter token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '74e123bc-f565-44ba-92f0-86fc00cbe0b1', // Project ID do app.json
    });

    const token = tokenData.data;
    console.log('✅ [NotificationService] Push token obtido:', token);

    // Configurar canal de notificação no Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificações Porteiro',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('visitor', {
        name: 'Visitantes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('delivery', {
        name: 'Entregas',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergências',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'default',
      });
    }

    return token;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao registrar push notifications:', error);
    return null;
  }
}

/**
 * Salva o push token no banco de dados
 */
export async function savePushToken(userId: string, token: string, deviceType: 'ios' | 'android' | 'web' = 'android'): Promise<boolean> {
  try {
    console.log('💾 [NotificationService] Salvando push token para userId:', userId);

    // Desativar tokens antigos deste usuário
    await supabase
      .from('user_notification_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Inserir novo token
    const { error } = await supabase
      .from('user_notification_tokens')
      .insert({
        user_id: userId,
        token: token,
        device_type: deviceType,
        is_active: true,
      });

    if (error) {
      console.error('❌ [NotificationService] Erro ao salvar token:', error);
      return false;
    }

    console.log('✅ [NotificationService] Token salvo com sucesso');
    return true;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao salvar push token:', error);
    return false;
  }
}

/**
 * Envia notificação push via Supabase Edge Function
 */
export async function sendPushNotification(params: {
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  data?: NotificationData;
  // Destinatários (usar apenas um)
  userIds?: string[];
  userType?: 'admin' | 'porteiro' | 'morador';
  buildingId?: string;
}): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    console.log('📤 [NotificationService] Enviando notificação push:', params.title);

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: params,
    });

    if (error) {
      console.error('❌ [NotificationService] Erro ao enviar notificação:', error);
      return { success: false, sent: 0, failed: 0 };
    }

    console.log('✅ [NotificationService] Notificação enviada:', data);
    return data;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao enviar notificação push:', error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Envia notificação local (sem servidor)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  delaySeconds: number = 0
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: delaySeconds > 0 ? { seconds: delaySeconds } : null,
    });

    console.log('✅ [NotificationService] Notificação local agendada:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao agendar notificação local:', error);
    return null;
  }
}

/**
 * Notifica porteiro sobre resposta de morador (aprovação/rejeição)
 */
export async function notifyPorteiroVisitorResponse(params: {
  buildingId: string;
  visitorName: string;
  apartmentNumber: string;
  status: 'approved' | 'rejected';
  visitorId?: string;
}): Promise<void> {
  const isApproved = params.status === 'approved';
  const title = isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Rejeitado';
  const message = isApproved
    ? `${params.visitorName} foi aprovado para o apartamento ${params.apartmentNumber}`
    : `A entrada de ${params.visitorName} foi rejeitada pelo apartamento ${params.apartmentNumber}`;

  await sendPushNotification({
    title,
    message,
    type: 'visitor',
    userType: 'porteiro',
    buildingId: params.buildingId,
    data: {
      type: isApproved ? 'visitor_approved' : 'visitor_rejected',
      visitor_id: params.visitorId,
      visitor_name: params.visitorName,
      apartment_number: params.apartmentNumber,
    },
  });
}

/**
 * Cancela todas as notificações pendentes
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('🗑️ [NotificationService] Todas as notificações canceladas');
}

/**
 * Remove badge do ícone do app
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

export default {
  registerForPushNotificationsAsync,
  savePushToken,
  sendPushNotification,
  scheduleLocalNotification,
  notifyPorteiroVisitorResponse,
  cancelAllNotifications,
  clearBadge,
};
