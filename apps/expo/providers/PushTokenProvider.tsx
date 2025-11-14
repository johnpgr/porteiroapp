import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { queueNotification } from '../services/OfflineQueue';
import AnalyticsTracker from '../services/AnalyticsTracker';

/**
 * Provider that manages push token registration and offline notification queueing.
 * Automatically registers/updates push tokens when user logs in.
 * Queues notifications when offline for later processing.
 */
export function PushTokenProvider() {
  const { user, updatePushToken, isOffline, requireWritable } = useAuth();

  // Register push token when user logs in
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const registerPushToken = async () => {
      // Only register on physical devices
      if (!Device.isDevice) {
        console.log('🔔 Push notifications not supported on simulator/emulator');
        return;
      }

      try {
        // Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('🚨 Notification permission denied');
          return;
        }

        // Get push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '74e123bc-f565-44ba-92f0-86fc00cbe0b1',
        });

        const token = tokenData.data;

        // Only update if token changed
        if (token && token !== user.push_token) {
          try {
            requireWritable();
          } catch (err) {
            console.warn('[PushTokenProvider] Read-only mode - push token not updated');
            return;
          }
          console.log('🔔 Push token obtained:', token);
          await updatePushToken(token);
          console.log('✅ Push token registered in database');
          AnalyticsTracker.trackEvent('push_token_registered', { userId: user.id });
        }
      } catch (error) {
        console.error('❌ Error registering push token:', error);
        AnalyticsTracker.trackEvent('push_token_error', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    registerPushToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, updatePushToken]); // Exclude user.push_token to avoid infinite loops

  // Queue notifications when offline
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (!isOffline) {
        return;
      }

      queueNotification({
        payload: {
          content: notification.request.content,
        },
      })
        .then(() =>
          AnalyticsTracker.trackEvent('auth_notification_queued_offline', {
            identifier: notification.request.identifier,
          })
        )
        .catch((error) => {
          console.error('[OfflineQueue] Failed to queue offline notification:', error);
          AnalyticsTracker.trackEvent('auth_notification_queue_error', {
            identifier: notification.request.identifier,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });

    return () => {
      subscription.remove();
    };
  }, [isOffline]);

  return null;
}
