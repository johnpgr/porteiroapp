/**
 * Serviço de Notificações Push - Expo Notifications
 *
 * Este serviço gerencia:
 * - Registro de push tokens no campo profiles.push_token
 * - Configuração de notificações
 * - Envio de notificações push via Expo Push API
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
  type: 'visitor_approved' | 'visitor_rejected' | 'visitor_waiting' | 'visitor_arrival' | 'delivery' | 'emergency' | 'general';
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
        sound: 'doorbell_push.mp3',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('visitor', {
        name: 'Visitantes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'doorbell_push.mp3',
      });

      await Notifications.setNotificationChannelAsync('delivery', {
        name: 'Entregas',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'doorbell_push.mp3',
      });

      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergências',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'doorbell_push.mp3',
      });
    }

    return token;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao registrar push notifications:', error);
    return null;
  }
}

/**
 * Salva o push token no campo profiles.push_token
 */
export async function savePushToken(profileId: string, token: string): Promise<boolean> {
  try {
    console.log('💾 [NotificationService] Salvando push token para profileId:', profileId);

    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        notification_enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId);

    if (error) {
      console.error('❌ [NotificationService] Erro ao salvar token:', error);
      return false;
    }

    console.log('✅ [NotificationService] Token salvo com sucesso no profile');
    return true;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao salvar push token:', error);
    return false;
  }
}

/**
 * Envia notificação push diretamente via Expo Push API
 */
export async function sendPushNotification(params: {
  title: string;
  body: string;
  data?: NotificationData;
  pushTokens: string[];
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}): Promise<{ success: boolean; tickets: any[] }> {
  try {
    console.log('📤 [NotificationService] Enviando notificação push:', params.title);
    console.log('📤 [NotificationService] Tokens:', params.pushTokens);

    // Filtrar tokens válidos (formato ExponentPushToken[xxx])
    const validTokens = params.pushTokens.filter(token =>
      token && token.startsWith('ExponentPushToken[')
    );

    if (validTokens.length === 0) {
      console.warn('⚠️ [NotificationService] Nenhum token válido encontrado');
      return { success: false, tickets: [] };
    }

    // Criar mensagens para cada token
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'doorbell_push.mp3',
      title: params.title,
      body: params.body,
      data: params.data || {},
      channelId: params.channelId || 'default',
      priority: params.priority || 'high',
    }));

    // Enviar via Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json();
    console.log('✅ [NotificationService] Resposta Expo:', data);

    return { success: true, tickets: data.data || [] };
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao enviar notificação push:', error);
    return { success: false, tickets: [] };
  }
}

/**
 * Busca push tokens de usuários específicos
 */
export async function getUserPushTokens(profileIds: string[]): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('push_token')
      .in('id', profileIds)
      .eq('notification_enabled', true)
      .not('push_token', 'is', null);

    if (error) {
      console.error('❌ [NotificationService] Erro ao buscar tokens:', error);
      return [];
    }

    const tokens = data?.map(p => p.push_token).filter(Boolean) || [];
    console.log(`📱 [NotificationService] Encontrados ${tokens.length} tokens ativos`);
    return tokens;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao buscar push tokens:', error);
    return [];
  }
}

/**
 * Busca push tokens de todos os porteiros de um prédio
 */
export async function getPorteiroTokensByBuilding(buildingId: string): Promise<string[]> {
  try {
    console.log('🔍 [getPorteiroTokensByBuilding] Iniciando busca de tokens');
    console.log('🔍 [getPorteiroTokensByBuilding] BuildingId:', buildingId);

    // Primeiro, vamos verificar quantos porteiros existem neste prédio
    const { data: allPorteiros, error: countError } = await supabase
      .from('profiles')
      .select('id, full_name, user_type, building_id, push_token, notification_enabled')
      .eq('building_id', buildingId)
      .eq('user_type', 'porteiro');

    console.log('🔍 [getPorteiroTokensByBuilding] Total de porteiros no prédio:', allPorteiros?.length || 0);
    console.log('🔍 [getPorteiroTokensByBuilding] Porteiros encontrados:', allPorteiros);

    if (allPorteiros && allPorteiros.length > 0) {
      const withTokens = allPorteiros.filter(p => p.push_token);
      const withNotificationsEnabled = allPorteiros.filter(p => p.notification_enabled);

      console.log('🔍 [getPorteiroTokensByBuilding] Porteiros com push_token:', withTokens.length);
      console.log('🔍 [getPorteiroTokensByBuilding] Porteiros com notification_enabled:', withNotificationsEnabled.length);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('push_token, full_name, id')
      .eq('building_id', buildingId)
      .eq('user_type', 'porteiro')
      .eq('notification_enabled', true)
      .not('push_token', 'is', null);

    if (error) {
      console.error('❌ [getPorteiroTokensByBuilding] Erro ao buscar tokens:', error);
      return [];
    }

    console.log('🔍 [getPorteiroTokensByBuilding] Dados retornados pela query:', data);

    const tokens = data?.map(p => p.push_token).filter(Boolean) || [];
    console.log(`📱 [getPorteiroTokensByBuilding] Encontrados ${tokens.length} tokens válidos de porteiros`);
    console.log(`📱 [getPorteiroTokensByBuilding] Tokens:`, tokens);

    return tokens;
  } catch (error) {
    console.error('❌ [getPorteiroTokensByBuilding] Erro ao buscar tokens de porteiros:', error);
    return [];
  }
}

/**
 * Busca push tokens de moradores de um apartamento
 */
export async function getMoradorTokensByApartment(apartmentId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('apartment_residents')
      .select(`
        profiles!inner(push_token, notification_enabled)
      `)
      .eq('apartment_id', apartmentId);

    if (error) {
      console.error('❌ [NotificationService] Erro ao buscar tokens de moradores:', error);
      return [];
    }

    const tokens = data
      ?.map((ar: any) => ar.profiles?.push_token)
      .filter((token: string | null) => token && token.length > 0) || [];

    console.log(`📱 [NotificationService] Encontrados ${tokens.length} tokens de moradores`);
    return tokens;
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao buscar tokens de moradores:', error);
    return [];
  }
}

/**
 * Notifica morador sobre chegada de visitante
 */
export async function notifyMoradorVisitorArrival(params: {
  apartmentId: string;
  visitorName: string;
  apartmentNumber: string;
  purpose?: string;
  visitorId?: string;
}): Promise<{ success: boolean }> {
  try {
    const tokens = await getMoradorTokensByApartment(params.apartmentId);

    if (tokens.length === 0) {
      console.warn('⚠️ [NotificationService] Nenhum token encontrado para moradores');
      return { success: false };
    }

    const result = await sendPushNotification({
      title: '🔔 Visitante na Portaria',
      body: `${params.visitorName} chegou para o apartamento ${params.apartmentNumber}`,
      data: {
        type: 'visitor_arrival',
        visitor_id: params.visitorId,
        visitor_name: params.visitorName,
        apartment_number: params.apartmentNumber,
        purpose: params.purpose,
      },
      pushTokens: tokens,
      channelId: 'visitor',
      priority: 'high',
    });

    return { success: result.success };
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao notificar morador:', error);
    return { success: false };
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
}): Promise<{ success: boolean }> {
  try {
    console.log('🔔 [notifyPorteiroVisitorResponse] Iniciando notificação para porteiros');
    console.log('🔔 [notifyPorteiroVisitorResponse] Parâmetros:', {
      buildingId: params.buildingId,
      visitorName: params.visitorName,
      apartmentNumber: params.apartmentNumber,
      status: params.status
    });

    const tokens = await getPorteiroTokensByBuilding(params.buildingId);

    console.log('🔔 [notifyPorteiroVisitorResponse] Tokens encontrados:', tokens.length);
    console.log('🔔 [notifyPorteiroVisitorResponse] Tokens:', tokens);

    if (tokens.length === 0) {
      console.warn('⚠️ [notifyPorteiroVisitorResponse] Nenhum token encontrado para porteiros');
      console.warn('⚠️ [notifyPorteiroVisitorResponse] BuildingId usado na busca:', params.buildingId);
      return { success: false };
    }

    const isApproved = params.status === 'approved';
    const title = isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Rejeitado';
    const body = isApproved
      ? `${params.visitorName} foi aprovado pelo apartamento ${params.apartmentNumber}`
      : `A entrada de ${params.visitorName} foi rejeitada pelo apartamento ${params.apartmentNumber}`;

    console.log('🔔 [notifyPorteiroVisitorResponse] Enviando notificação:', { title, body });

    const result = await sendPushNotification({
      title,
      body,
      data: {
        type: isApproved ? 'visitor_approved' : 'visitor_rejected',
        visitor_id: params.visitorId,
        visitor_name: params.visitorName,
        apartment_number: params.apartmentNumber,
      },
      pushTokens: tokens,
      channelId: 'visitor',
      priority: 'high',
    });

    console.log('🔔 [notifyPorteiroVisitorResponse] Resultado:', result);

    return { success: result.success };
  } catch (error) {
    console.error('❌ [notifyPorteiroVisitorResponse] Erro ao notificar porteiro:', error);
    return { success: false };
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
        sound: 'doorbell_push.mp3',
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
  getUserPushTokens,
  getPorteiroTokensByBuilding,
  getMoradorTokensByApartment,
  notifyMoradorVisitorArrival,
  notifyPorteiroVisitorResponse,
  scheduleLocalNotification,
  cancelAllNotifications,
  clearBadge,
};
