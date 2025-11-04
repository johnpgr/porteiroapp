/**
 * Background Notification Task Handler
 *
 * This task runs when a push notification is received, even when the app is killed.
 * It handles incoming intercom calls by displaying native call UI via CallKeep.
 *
 * IMPORTANT: This must be registered at module level (not inside a component)
 * to ensure it's available before the app fully loads.
 */

import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import callKeepService from './CallKeepService';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

interface IncomingCallData {
  callId: string;
  callerName: string;
  apartmentNumber: string;
  channelName: string;
  from: string;
  timestamp: number;
}

/**
 * Define the background task that runs when a notification is received
 * This runs even when the app is killed!
 */
TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<Record<string, any>>) => {
    if (error) {
      console.error('[BackgroundTask] Error:', error);
      return;
    }

    console.log('[BackgroundTask] Received notification data:', JSON.stringify(data, null, 2));

    try {
      // Check if this is a notification response (user tapped) or just received
      const isNotificationResponse = 'actionIdentifier' in data;

      if (!isNotificationResponse) {
        // This is a notification that was just received (not user action)
        const notificationData = (data as any)?.notification?.request?.content?.data;

        console.log('[BackgroundTask] Notification data extracted:', notificationData);

        if (notificationData?.type === 'intercom_call') {
          console.log('[BackgroundTask] ✅ Incoming intercom call detected!');

          const callData: IncomingCallData = {
            callId: notificationData.callId,
            callerName: notificationData.fromName || 'Doorman',
            apartmentNumber: notificationData.apartmentNumber || '',
            channelName: notificationData.channelName,
            from: notificationData.from,
            timestamp: Date.now(),
          };

          console.log('[BackgroundTask] Processed call data:', callData);

          // Store call data for when app fully opens
          await AsyncStorage.setItem(
            '@pending_intercom_call',
            JSON.stringify(callData)
          );
          console.log('[BackgroundTask] ✅ Stored call data to AsyncStorage');

          // Display native call UI via CallKeep
          try {
            // Initialize CallKeep if not already done
            await callKeepService.initialize();

            // Display incoming call with native UI
            // Use callId as UUID so we can map it later
            await callKeepService.displayIncomingCall(
              callData.callId,
              callData.callerName,
              `Apt ${callData.apartmentNumber}`,
              false // audio only
            );

            console.log('[BackgroundTask] ✅ Displayed native call UI via CallKeep');
          } catch (callKeepError) {
            console.error('[BackgroundTask] CallKeep failed, falling back to notification:', callKeepError);

            // Fallback: Display local notification if CallKeep fails
            const notificationId = await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Incoming Call',
                body: `${callData.callerName} - Apt ${callData.apartmentNumber}`,
                data: callData,
                sound: 'telephone_toque_interfone.mp3',
                priority: Notifications.AndroidNotificationPriority.MAX,
                categoryIdentifier: 'call',
              },
              trigger: null, // Immediate
            });

            console.log('[BackgroundTask] ✅ Scheduled local notification (fallback):', notificationId);
          }
        } else {
          console.log('[BackgroundTask] ⚠️ Not an intercom call, type:', notificationData?.type);
        }
      } else {
        // User tapped on notification
        console.log('[BackgroundTask] User tapped notification, app will handle in foreground');
      }
    } catch (error) {
      console.error('[BackgroundTask] Error processing notification:', error);
    }
  }
);

/**
 * Register the background task
 * MUST be called at module level (not inside component)
 */
export async function registerBackgroundNotificationTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_NOTIFICATION_TASK
    );

    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('[BackgroundTask] ✅ Registered successfully');
    } else {
      console.log('[BackgroundTask] Already registered');
    }
  } catch (error) {
    console.error('[BackgroundTask] ❌ Failed to register:', error);
  }
}

/**
 * Check if task is registered
 */
export async function isBackgroundTaskRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (error) {
    console.error('[BackgroundTask] Error checking registration:', error);
    return false;
  }
}

/**
 * Unregister the background task (for cleanup)
 */
export async function unregisterBackgroundNotificationTask(): Promise<void> {
  try {
    await TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('[BackgroundTask] ✅ Unregistered successfully');
  } catch (error) {
    console.error('[BackgroundTask] ❌ Failed to unregister:', error);
  }
}
