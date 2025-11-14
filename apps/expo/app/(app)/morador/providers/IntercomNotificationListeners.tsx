import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '~/hooks/useAuth';
import { callCoordinator } from '~/services/calling/CallCoordinator';

const normalizeIntercomPayload = (
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object') return null;
  if ((raw as any).type === 'intercom_call') return raw as Record<string, unknown>;
  const dataString = (raw as any).dataString;
  const body = (raw as any).body;
  try {
    if (typeof dataString === 'string') {
      const parsed = JSON.parse(dataString);
      if (parsed && parsed.type === 'intercom_call') return parsed;
    }
  } catch {}
  try {
    if (typeof body === 'string') {
      const parsed = JSON.parse(body);
      if (parsed && parsed.type === 'intercom_call') return parsed;
    }
  } catch {}
  return null;
};

export function IntercomNotificationListeners() {
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!user?.id) {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      return;
    }

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const raw = notification.request.content.data as Record<string, unknown>;
      const payload = normalizeIntercomPayload(raw);
      if (!payload) {
        return;
      }

      console.log('📞 [MoradorLayout] Push notification de interfone recebida (foreground)');
      console.log('📞 [MoradorLayout] Delegating to CallCoordinator...');

      void callCoordinator
        .handleIncomingPush({
          callId: (payload.callId as string) || 'unknown',
          from: (payload.from as string) || '',
          callerName: (payload.fromName as string) || (payload.callerName as string) || 'Doorman',
          apartmentNumber: (payload.apartmentNumber as string) || '',
          buildingName: (payload.buildingName as string) || '',
          channelName:
            (payload.channelName as string) || (payload.channel as string) || `call-${payload.callId}`,
          timestamp: Date.now(),
        })
        .catch((error) => {
          console.error('❌ [MoradorLayout] CallCoordinator failed to handle push:', error);
        });
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const raw = response.notification.request.content.data as Record<string, unknown>;
      const payload = normalizeIntercomPayload(raw);
      if (!payload) {
        return;
      }

      console.log(
        '📞 [MoradorLayout] Usuário interagiu com notificação de chamada:',
        response.actionIdentifier
      );
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [user?.id]);

  return null;
}
