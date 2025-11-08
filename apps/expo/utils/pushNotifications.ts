import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import voipPushService from './voipPushNotifications';

export interface SendPushNotificationParams {
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  data?: Record<string, any>;
  // Opções de destinatários (usar apenas uma)
  userIds?: string[];
  pushTokens?: string[];
  userType?: 'admin' | 'porteiro' | 'morador';
  buildingId?: string;
  apartmentIds?: string[];
}

/**
 * Envia notificação push através da Supabase Edge Function
 * Funciona mesmo com app fechado ou em segundo plano
 *
 * @example
 * // Notificar morador de apartamento específico sobre visitante
 * await sendPushNotification({
 *   title: '🚪 Visitante Aguardando',
 *   message: 'João Silva está na portaria',
 *   type: 'visitor',
 *   apartmentIds: ['apartment-id'],
 *   data: { visitorId: 'visitor-123', apartmentNumber: '101' }
 * });
 *
 * @example
 * // Notificar todos os porteiros
 * await sendPushNotification({
 *   title: '📦 Nova Encomenda',
 *   message: 'Encomenda registrada para apt 205',
 *   type: 'delivery',
 *   userType: 'porteiro',
 *   buildingId: 'building-id'
 * });
 */
export async function sendPushNotification(
  params: SendPushNotificationParams
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: params,
    });

    if (error) {
      console.error('🔔 Erro ao chamar edge function:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        error: error.message,
      };
    }

    console.log('🔔 Notificações enviadas:', data);
    return data;
  } catch (error) {
    console.error('🔔 Erro ao enviar notificação push:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Notifica morador sobre novo visitante
 */
export async function notifyNewVisitor(params: {
  visitorName: string;
  visitorDocument: string;
  apartmentIds: string[];
  apartmentNumber?: string;
  visitorId?: string;
}) {
  return sendPushNotification({
    title: '🚪 Novo Visitante',
    message: `${params.visitorName} está aguardando autorização para entrar`,
    type: 'visitor',
    apartmentIds: params.apartmentIds,
    data: {
      type: 'visitor',
      visitorId: params.visitorId,
      apartmentNumber: params.apartmentNumber,
      visitorName: params.visitorName,
    },
  });
}

/**
 * Notifica porteiro sobre visitante autorizado
 */
export async function notifyPorteiroVisitorAuthorized(params: {
  visitorName: string;
  apartmentNumber: string;
  buildingId: string;
  visitorId?: string;
}) {
  return sendPushNotification({
    title: '✅ Visitante Autorizado',
    message: `${params.visitorName} foi autorizado para apt ${params.apartmentNumber}`,
    type: 'visitor',
    userType: 'porteiro',
    buildingId: params.buildingId,
    data: {
      type: 'visitor_authorized',
      visitorId: params.visitorId,
      apartmentNumber: params.apartmentNumber,
      visitorName: params.visitorName,
    },
  });
}

/**
 * Notifica morador sobre nova encomenda
 */
export async function notifyNewDelivery(params: {
  recipientName: string;
  apartmentIds: string[];
  apartmentNumber?: string;
  sender?: string;
  deliveryId?: string;
}) {
  return sendPushNotification({
    title: '📦 Nova Encomenda',
    message: `Encomenda de ${params.sender || 'remetente desconhecido'} para ${params.recipientName}`,
    type: 'delivery',
    apartmentIds: params.apartmentIds,
    data: {
      type: 'delivery',
      deliveryId: params.deliveryId,
      apartmentNumber: params.apartmentNumber,
      sender: params.sender,
    },
  });
}

/**
 * Envia comunicado para todo o prédio
 */
export async function sendBuildingCommunication(params: {
  title: string;
  message: string;
  buildingId: string;
  communicationId?: string;
}) {
  return sendPushNotification({
    title: params.title,
    message: params.message,
    type: 'communication',
    buildingId: params.buildingId,
    data: {
      type: 'communication',
      communicationId: params.communicationId,
      buildingId: params.buildingId,
    },
  });
}

/**
 * Envia alerta de emergência
 */
export async function sendEmergencyAlert(params: {
  message: string;
  buildingId?: string;
  apartmentNumber?: string;
  emergencyId?: string;
}) {
  return sendPushNotification({
    title: '🚨 EMERGÊNCIA',
    message: params.message,
    type: 'emergency',
    buildingId: params.buildingId,
    userType: params.buildingId ? undefined : 'admin', // Se não tem building, notifica admins
    data: {
      type: 'emergency',
      emergencyId: params.emergencyId,
      apartmentNumber: params.apartmentNumber,
      buildingId: params.buildingId,
    },
  });
}

/**
 * Registra push token para o usuário após login
 * Deve ser chamado imediatamente após autenticação bem-sucedida
 *
 * IMPORTANT: Also registers VoIP push token for iOS
 */
export async function registerPushTokenAfterLogin(
  userId: string,
  userType: 'admin' | 'porteiro' | 'morador'
): Promise<boolean> {
  try {
    // Só registra em dispositivos físicos
    if (!Device.isDevice) {
      console.log(
        '🔔 [registerPushToken] Push notifications não são suportadas em simulador/emulador'
      );
      return false;
    }

    console.log('🔔 [registerPushToken] Iniciando registro de push token para userId:', userId);

    // Register VoIP push notifications for iOS (for incoming calls when app is killed)
    try {
      await voipPushService.initialize(userId, userType);
      console.log('🔔 [registerPushToken] VoIP push initialized for iOS');
    } catch (voipError) {
      console.warn(
        '⚠️ [registerPushToken] VoIP push initialization failed (non-critical):',
        voipError
      );
    }

    // Solicitar permissão
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('🔔 [registerPushToken] Solicitando permissão de notificação...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('🚨 [registerPushToken] Permissão de notificação negada');
      return false;
    }

    console.log('✅ [registerPushToken] Permissão concedida, obtendo token...');

    // Note: CallKeep removed - using custom full-screen call UI instead

    // Obter push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '74e123bc-f565-44ba-92f0-86fc00cbe0b1',
    });

    const token = tokenData.data;

    if (!token) {
      console.error('❌ [registerPushToken] Falha ao obter push token');
      return false;
    }

    // Validate token format before saving
    if (
      !token.startsWith('ExponentPushToken[') &&
      !token.startsWith('ExpoPushToken[')
    ) {
      console.error('❌ [registerPushToken] Invalid token format received');
      console.error('   Expected: ExponentPushToken[...] or ExpoPushToken[...]');
      console.error('   Received:', token.substring(0, 50) + '...');
      console.error('   This should not happen - please report this issue');
      return false;
    }

    console.log('🔔 [registerPushToken] Push token obtido:', token);

    // Processar baseado no tipo de usuário com queries tipadas separadamente
    if (userType === 'admin') {
      // Query tipada para admin_profiles
      const { data: existingProfile, error: checkError } = await supabase
        .from('admin_profiles')
        .select('user_id, push_token')
        .eq('user_id', userId)
        .single();

      if (checkError || !existingProfile) {
        console.error(
          '❌ [registerPushToken] Perfil não encontrado para userId:',
          userId,
          checkError
        );
        return false;
      }

      // Verificar se o token mudou
      const needsTokenUpdate = existingProfile.push_token !== token;

      if (!needsTokenUpdate) {
        console.log(
          '✅ [registerPushToken] Push token já estava atualizado'
        );
        return true;
      }

      console.log('🔔 [registerPushToken] Atualizando push token no banco de dados...');

      // Atualizar push token
      const { data, error } = await supabase
        .from('admin_profiles')
        .update({
          push_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ [registerPushToken] Erro ao salvar preferências de push:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.error(
          '❌ [registerPushToken] Nenhuma linha foi atualizada. userId:',
          userId
        );
        return false;
      }

      console.log(
        '✅ [registerPushToken] Push token registrado com sucesso para admin'
      );
      return true;
    } else {
      // Query tipada para profiles (morador ou porteiro)
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('user_id, push_token, notification_enabled')
        .eq('user_id', userId)
        .single();

      if (checkError || !existingProfile) {
        console.error(
          '❌ [registerPushToken] Perfil não encontrado para userId:',
          userId,
          checkError
        );
        return false;
      }

      // Verificar se o token mudou ou se precisa habilitar notificações
      const needsTokenUpdate = existingProfile.push_token !== token;
      const needsNotificationEnable = existingProfile.notification_enabled !== true;

      if (!needsTokenUpdate && !needsNotificationEnable) {
        console.log(
          '✅ [registerPushToken] Push token e notificações já estavam atualizados'
        );
        return true;
      }

      console.log('🔔 [registerPushToken] Atualizando preferências de notificação no banco de dados...');

      const updates: {
        push_token?: string;
        notification_enabled: boolean;
        updated_at: string;
      } = {
        notification_enabled: true,
        updated_at: new Date().toISOString(),
      };

      if (needsTokenUpdate) {
        updates.push_token = token;
      }

      // Atualizar push token e habilitar notificações quando necessário
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ [registerPushToken] Erro ao salvar preferências de push:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.error(
          '❌ [registerPushToken] Nenhuma linha foi atualizada. userId:',
          userId
        );
        return false;
      }

      console.log(
        '✅ [registerPushToken] Preferências de push registradas com sucesso. Token atualizado:',
        needsTokenUpdate
      );
      return true;
    }
  } catch (error) {
    console.error('❌ [registerPushToken] Erro ao registrar push token:', error);
    return false;
  }
}
