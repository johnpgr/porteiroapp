import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { queueNotification } from '../services/OfflineQueue';
import AnalyticsTracker from '../services/AnalyticsTracker';

// Retry configuration for push token registration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

/**
 * Attempts to get push token with retry logic and exponential backoff
 */
async function getTokenWithRetry(
  projectId: string,
  retryCount = 0
): Promise<string | null> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);

    // Categorize error types
    const isServiceUnavailable = errorMessage.includes('SERVICE_NOT_AVAILABLE');
    const isNetworkError = errorMessage.includes('network') || errorMessage.includes('timeout');
    const isInvalidRequest = errorMessage.includes('INVALID') || errorMessage.includes('BAD_REQUEST');

    // Log detailed error info
    console.error(`❌ [PushToken] Attempt ${retryCount + 1}/${MAX_RETRIES + 1} failed:`, {
      error: errorMessage,
      platform: Platform.OS,
      isServiceUnavailable,
      isNetworkError,
      isInvalidRequest,
    });

    // Don't retry on invalid requests (permanent errors)
    if (isInvalidRequest) {
      console.error('❌ [PushToken] Invalid request - not retrying');
      throw error;
    }

    // Retry on transient errors (SERVICE_NOT_AVAILABLE, network issues)
    if (retryCount < MAX_RETRIES && (isServiceUnavailable || isNetworkError)) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`🔄 [PushToken] Retrying in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return getTokenWithRetry(projectId, retryCount + 1);
    }

    throw error;
  }
}

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

        // Get push token with retry logic
        const token = await getTokenWithRetry('74e123bc-f565-44ba-92f0-86fc00cbe0b1');

        if (!token) {
          console.error('❌ [PushToken] Failed to obtain token after retries');
          return;
        }

        // Only update if token changed
        if (token !== user.push_token) {
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
      } catch (error: any) {
        const errorMessage = error?.message || String(error);

        // Categorize error for analytics
        const errorType = errorMessage.includes('SERVICE_NOT_AVAILABLE')
          ? 'service_unavailable'
          : errorMessage.includes('permission')
            ? 'permission_denied'
            : errorMessage.includes('network')
              ? 'network_error'
              : 'unknown';

        // Log detailed error
        console.error('❌ [PushToken] Registration failed:', {
          error: errorMessage,
          errorType,
          platform: Platform.OS,
          deviceManufacturer: Device.manufacturer,
          isDevice: Device.isDevice,
        });

        // Track error with context
        AnalyticsTracker.trackEvent('push_token_error', {
          message: errorMessage,
          errorType,
          platform: Platform.OS,
          manufacturer: Device.manufacturer || 'unknown',
        });

        // Show user-friendly guidance for common issues
        if (errorType === 'service_unavailable' && Platform.OS === 'android') {
          console.warn(
            '⚠️ [PushToken] Google Play Services unavailable. If on Xiaomi/MIUI:\n' +
              '   1. Enable Autostart for this app\n' +
              '   2. Set Battery Saver to "No restrictions"\n' +
              '   3. Allow "Display pop-up windows while running in background"'
          );
        }
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
