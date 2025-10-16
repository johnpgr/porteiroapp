import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';

type NotificationCallback = (data: PushNotificationData) => void;

// Configurar como as notificações devem ser tratadas quando recebidas
// IMPORTANTE: Funciona mesmo com app fechado ou em segundo plano
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

export interface PushNotificationData {
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  title: string;
  message: string;
  data?: Record<string, any>;
}

class NotificationService {
  private channel: RealtimeChannel | null = null;
  private callbacks: NotificationCallback[] = [];
  private isConnected = false;
  private notificationListener: any = null;
  private responseListener: any = null;
  private expoPushToken: string | null = null;

  /**
   * Registra o dispositivo para receber notificações push
   * Funciona com app fechado, em segundo plano ou aberto
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Web não suporta notificações push via Expo
    if (Platform.OS === 'web') {
      console.warn('🔔 Push notifications não são suportadas na web');
      return null;
    }

    // Apenas dispositivos físicos suportam push notifications
    if (!Device.isDevice) {
      console.warn('🔔 Push notifications requerem dispositivo físico');
      return null;
    }

    try {
      // Solicitar permissões
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('🔔 Permissão para notificações negada pelo usuário');
        return null;
      }

      // Obter o Expo Push Token
      // Tentar múltiplas formas de acessar o projectId
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.manifest?.extra?.eas?.projectId ||
        Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
        '74e123bc-f565-44ba-92f0-86fc00cbe0b1'; // Fallback hardcoded

      console.log('🔔 Debug - Constants.expoConfig:', JSON.stringify(Constants.expoConfig?.extra, null, 2));
      console.log('🔔 Debug - Project ID obtido:', projectId);

      if (!projectId) {
        console.error('🔔 Project ID não configurado. Configure em app.json ou eas.json');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      this.expoPushToken = token;
      console.log('🔔 Push token obtido:', token);

      // Configurar canais de notificação no Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      return token;
    } catch (error) {
      console.error('🔔 Erro ao registrar push notifications:', error);
      return null;
    }
  }

  /**
   * Configura canais de notificação no Android
   * Cada tipo tem prioridade e comportamento diferentes
   */
  private async setupAndroidChannels(): Promise<void> {
    // Canal padrão
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Canal para visitantes (alta prioridade)
    await Notifications.setNotificationChannelAsync('visitor', {
      name: 'Visitantes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      description: 'Notificações sobre visitantes aguardando autorização',
    });

    // Canal para entregas (prioridade média)
    await Notifications.setNotificationChannelAsync('delivery', {
      name: 'Encomendas',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#4CAF50',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      description: 'Notificações sobre encomendas recebidas',
    });

    // Canal para emergências (prioridade máxima)
    await Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergências',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000],
      lightColor: '#F44336',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,
      description: 'Alertas de emergência',
    });

    // Canal para comunicações (prioridade baixa)
    await Notifications.setNotificationChannelAsync('communication', {
      name: 'Comunicados',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#FF9800',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      description: 'Avisos e comunicados do condomínio',
    });
  }

  /**
   * Salva o token push no banco de dados
   * Necessário para enviar notificações push posteriormente
   */
  async savePushToken(userId: string, token: string, userType: 'admin' | 'porteiro' | 'morador'): Promise<void> {
    try {
      const table = userType === 'admin' ? 'admin_profiles' : 'profiles';

      const { error } = await supabase
        .from(table)
        .update({ push_token: token })
        .eq('user_id', userId);

      if (error) {
        console.error('🔔 Erro ao salvar push token:', error);
      } else {
        console.log('🔔 Push token salvo com sucesso');
      }
    } catch (error) {
      console.error('🔔 Erro ao salvar push token:', error);
    }
  }

  /**
   * Envia uma notificação local (não requer servidor)
   * Útil para testes ou notificações geradas localmente
   */
  async sendLocalNotification(data: PushNotificationData): Promise<void> {
    if (Platform.OS === 'web') {
      console.warn('🔔 Notificações locais não são suportadas na web');
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: data.title,
          body: data.message,
          data: data.data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: data.type,
        },
        trigger: null, // Enviar imediatamente
      });

      console.log('🔔 Notificação local enviada:', data.title);
    } catch (error) {
      console.error('🔔 Erro ao enviar notificação local:', error);
    }
  }

  /**
   * Busca push tokens de usuários específicos
   * Usado pelo backend para enviar notificações direcionadas
   */
  async getUserPushTokens(filters: {
    userType?: 'admin' | 'porteiro' | 'morador';
    buildingId?: string;
    apartmentIds?: string[];
  }): Promise<string[]> {
    try {
      const { userType, buildingId, apartmentIds } = filters;

      if (userType === 'admin') {
        // Buscar tokens de admins
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('push_token')
          .not('push_token', 'is', null)
          .eq('is_active', true);

        if (error) throw error;
        return data?.map((u) => u.push_token).filter(Boolean) || [];
      }

      // Buscar tokens de porteiros ou moradores
      let query = supabase
        .from('profiles')
        .select('push_token')
        .not('push_token', 'is', null)
        .eq('is_active', true);

      if (userType) {
        query = query.eq('user_type', userType);
      }

      if (buildingId) {
        query = query.eq('building_id', buildingId);
      }

      const { data, error } = await query;

      if (error) throw error;

      let tokens = data?.map((u) => u.push_token).filter(Boolean) || [];

      // Se temos apartmentIds, buscar moradores desses apartamentos
      if (apartmentIds && apartmentIds.length > 0) {
        const { data: residents, error: resError } = await supabase
          .from('apartment_residents')
          .select('profiles!inner(push_token)')
          .in('apartment_id', apartmentIds)
          .not('profiles.push_token', 'is', null);

        if (!resError && residents) {
          const residentTokens = residents
            .map((r: any) => r.profiles?.push_token)
            .filter(Boolean);
          tokens = [...tokens, ...residentTokens];
        }
      }

      // Remover duplicatas
      return [...new Set(tokens)];
    } catch (error) {
      console.error('🔔 Erro ao buscar push tokens:', error);
      return [];
    }
  }

  /**
   * Limpa todas as notificações exibidas
   */
  async clearAllNotifications(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('🔔 Todas as notificações foram limpas');
    } catch (error) {
      console.error('🔔 Erro ao limpar notificações:', error);
    }
  }

  /**
   * Remove o badge de notificações não lidas
   */
  async clearBadgeCount(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('🔔 Erro ao limpar badge:', error);
    }
  }

  /**
   * Obtém o push token atual
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Configura listeners para notificações
   * Permite responder quando o usuário interage com a notificação
   */
  setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): () => void {
    if (Platform.OS === 'web') {
      return () => {};
    }

    // Listener para quando notificação é recebida (app aberto)
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('🔔 Notificação recebida:', notification);
        onNotificationReceived?.(notification);
      }
    );

    // Listener para quando usuário toca na notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('🔔 Usuário interagiu com notificação:', response);
        onNotificationResponse?.(response);
      }
    );

    // Retorna função para cleanup
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }
}

// Instância singleton do serviço
export const notificationService = new NotificationService();

// Tipos de status para facilitar o uso
export const NotificationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
} as const;

export type NotificationStatusType = typeof NotificationStatus[keyof typeof NotificationStatus];