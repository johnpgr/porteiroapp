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
import { callKeepService } from './CallKeepService';

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
    console.log('[BackgroundTask] ========================================');
    console.log('[BackgroundTask] 🎯 TASK TRIGGERED');
    console.log('[BackgroundTask] Platform:', Platform.OS);
    console.log('[BackgroundTask] Timestamp:', new Date().toISOString());

    if (error) {
      console.error('[BackgroundTask] ❌ Task received error:', error);
      console.error('[BackgroundTask] Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('[BackgroundTask] 📥 Received notification data:');
    console.log('[BackgroundTask] Data keys:', Object.keys(data || {}));
    console.log('[BackgroundTask] Full data:', JSON.stringify(data, null, 2));

    try {
      // Check if this is a notification response (user tapped) or just received
      const isNotificationResponse = 'actionIdentifier' in data;

      console.log('[BackgroundTask] 🔍 Checking if notification response or received event...');
      console.log('[BackgroundTask] isNotificationResponse:', isNotificationResponse);

      if (!isNotificationResponse) {
        console.log('[BackgroundTask] 📨 This is a notification RECEIVED event (not user tap)');

        // This is a notification that was just received (not user action)
        // Robustly extract payload regardless of Expo/FCM shape
        const raw = data as any;
        console.log('[BackgroundTask] 🔍 Extracting notification payload...');
        console.log('[BackgroundTask] Checking raw?.notification?.request?.content?.data...');

        let notificationData: any = raw?.notification?.request?.content?.data;

        // Fallbacks for common Expo delivery shapes
        if (!notificationData || Object.keys(notificationData).length === 0) {
          console.log('[BackgroundTask] No data in standard location, trying fallbacks...');

          // Sometimes payload is placed under data
          const topData = raw?.data;
          console.log('[BackgroundTask] Checking raw?.data:', !!topData);

          if (topData && typeof topData === 'object') {
            // If server sent JSON as string, parse it
            if (!topData.type && typeof topData.dataString === 'string') {
              console.log('[BackgroundTask] Found dataString, parsing...');
              try {
                notificationData = JSON.parse(topData.dataString);
              } catch (e) {
                console.error('[BackgroundTask] Failed to parse dataString JSON:', e);
              }
            }
            if (!notificationData && !topData.type && typeof topData.body === 'string') {
              console.log('[BackgroundTask] Found body string, parsing...');
              try {
                notificationData = JSON.parse(topData.body);
              } catch (e) {
                console.error('[BackgroundTask] Failed to parse body JSON:', e);
              }
            }
            if (!notificationData) {
              console.log('[BackgroundTask] Using topData directly as structured payload');
              // If payload already comes structured
              notificationData = topData;
            }
          }
        }

        console.log('[BackgroundTask] ✅ Notification data extracted:', JSON.stringify(notificationData, null, 2));

        if (notificationData?.type === 'intercom_call') {
          console.log('[BackgroundTask] 🎉 INTERCOM CALL DETECTED!');
          console.log('[BackgroundTask] 📋 Building call data object...');

          const callData: IncomingCallData = {
            callId: notificationData.callId,
            callerName: notificationData.fromName || 'Doorman',
            apartmentNumber: notificationData.apartmentNumber || '',
            channelName: notificationData.channelName || notificationData.channel,
            from: notificationData.from,
            timestamp: Date.now(),
          };

          console.log('[BackgroundTask] ✅ Call data processed:');
          console.log('[BackgroundTask] - callId:', callData.callId);
          console.log('[BackgroundTask] - callerName:', callData.callerName);
          console.log('[BackgroundTask] - apartmentNumber:', callData.apartmentNumber);
          console.log('[BackgroundTask] - channelName:', callData.channelName);
          console.log('[BackgroundTask] - from:', callData.from);

          // Store call data for when app fully opens
          console.log('[BackgroundTask] 💾 Storing call data to AsyncStorage...');
          await AsyncStorage.setItem(
            '@pending_intercom_call',
            JSON.stringify(callData)
          );
          console.log('[BackgroundTask] ✅ Call data stored to AsyncStorage');

          // Display native call UI via CallKeep
          console.log('[BackgroundTask] 📞 Calling callKeepService.displayIncomingCall()...');
          try {
            await callKeepService.displayIncomingCall(
              callData.callId,
              callData.callerName,
              `Apt ${callData.apartmentNumber}`,
              false // hasVideo
            );

            console.log('[BackgroundTask] ✅ callKeepService.displayIncomingCall() completed successfully!');
            console.log('[BackgroundTask] 📱 Native call UI should now be visible to user');
          } catch (nativeCallError) {
            console.error('[BackgroundTask] Native call UI failed, falling back to notification:', nativeCallError);

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
