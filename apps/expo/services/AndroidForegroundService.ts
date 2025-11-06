import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Manages Android foreground service lifecycle during incoming calls.
 * We emulate the required persistent notification via Expo notifications.
 */
class AndroidForegroundService {
  private isRunning = false;
  private currentNotificationId: string | null = null;

  /**
   * Start the foreground service before we invoke RNCallKeep.
   */
  async start(callerName: string, apartmentNumber?: string | null): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[ForegroundService] iOS does not require foreground service');
      return;
    }

    if (this.isRunning) {
      console.log('[ForegroundService] Already running, ignoring start()');
      return;
    }

    try {
      const title = callerName ? `Incoming call from ${callerName}` : 'Incoming call';
      const body = apartmentNumber && apartmentNumber.length > 0 ? apartmentNumber : 'Intercom call';

      this.currentNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'call',
          sticky: true,
          // No sound - CallKeep handles ringtone
          // No vibration - CallKeep handles haptics
        },
        trigger: null,
      });

      this.isRunning = true;
      console.log('[ForegroundService] ✅ Started with notification:', this.currentNotificationId);
    } catch (error) {
      console.error('[ForegroundService] ❌ Failed to start foreground service:', error);
      throw error;
    }
  }

  /**
   * Stop the foreground service once the call ends or fails.
   */
  async stop(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!this.isRunning) {
      return;
    }

    try {
      if (this.currentNotificationId) {
        await Notifications.dismissNotificationAsync(this.currentNotificationId);
        this.currentNotificationId = null;
      }

      this.isRunning = false;
      console.log('[ForegroundService] ✅ Stopped');
    } catch (error) {
      console.error('[ForegroundService] ❌ Failed to stop foreground service:', error);
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const foregroundService = new AndroidForegroundService();
