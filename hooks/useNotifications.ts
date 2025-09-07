import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar como as notificações devem ser tratadas quando recebidas
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
}

export const useNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');

  // Solicitar permissões de notificação
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      setPermissionStatus(finalStatus);
      
      if (finalStatus !== 'granted') {
        console.log('Permissão de notificação negada');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      return false;
    }
  };

  // Agendar notificação local
  const scheduleNotification = async ({
    id,
    title,
    body,
    triggerDate,
    data = {}
  }: {
    id: string;
    title: string;
    body: string;
    triggerDate: Date;
    data?: any;
  }): Promise<string | null> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Permissão de notificação não concedida');
      }

      // Cancelar notificação existente com o mesmo ID
      await cancelNotification(id);

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title,
          body,
          data: { ...data, customId: id },
          sound: true,
        },
        trigger: {
          date: triggerDate,
        },
      });

      console.log(`Notificação agendada para ${triggerDate.toLocaleString()} com ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      return null;
    }
  };

  // Cancelar notificação específica
  const cancelNotification = async (customId: string): Promise<void> => {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Encontrar notificações com o customId específico
      const notificationsToCancel = scheduledNotifications.filter(
        notification => notification.identifier === customId
      );

      // Cancelar todas as notificações encontradas
      for (const notification of notificationsToCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`Notificação cancelada: ${notification.identifier}`);
      }
    } catch (error) {
      console.error('Erro ao cancelar notificação:', error);
    }
  };

  // Cancelar todas as notificações
  const cancelAllNotifications = async (): Promise<void> => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Todas as notificações foram canceladas');
    } catch (error) {
      console.error('Erro ao cancelar todas as notificações:', error);
    }
  };

  // Listar notificações agendadas
  const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Erro ao obter notificações agendadas:', error);
      return [];
    }
  };

  // Configurar listeners de notificação
  useEffect(() => {
    // Listener para notificações recebidas
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notificação recebida:', notification);
    });

    // Listener para quando o usuário toca na notificação
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuário interagiu com a notificação:', response);
      const customId = response.notification.request.content.data?.customId;
      if (customId) {
        // Aqui você pode navegar para uma tela específica baseada no customId
        console.log('ID customizado da notificação:', customId);
      }
    });

    // Solicitar permissões na inicialização
    requestPermissions();

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  return {
    expoPushToken,
    notification,
    permissionStatus,
    requestPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
  };
};