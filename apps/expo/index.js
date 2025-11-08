// Root entry: register Notifee background handler and background task early
import notifee, { EventType } from '@notifee/react-native';
import { AppRegistry } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { BACKGROUND_NOTIFICATION_TASK } from './services/backgroundNotificationTask';

// Ensure Expo background notification task is defined at bundle load
import './services/backgroundNotificationTask';

// Import call coordinator so action presses can route even when launched headless
import { callCoordinator } from './services/calling/CallCoordinator';

// Notifee background event handler (headless-capable)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    const actionId = detail?.pressAction?.id;
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
      if (actionId === 'answer_call') {
        console.log('[index] 📞 Notifee background: Answer pressed');
        if (callCoordinator.hasActiveCall()) {
          await callCoordinator.answerActiveCall();
        }
      } else if (actionId === 'decline_call') {
        console.log('[index] ❌ Notifee background: Decline pressed');
        await callCoordinator.endActiveCall('decline');
      } else if (actionId === 'incoming_call_fullscreen' || actionId === 'default') {
        console.log('[index] 👆 Notifee background: Fullscreen/default press');
      }
    }
  } catch (err) {
    console.error('[index] Notifee background handler error:', err);
  }
});

console.log('[index] ✅ Notifee background handler registered at root');

// Ensure the background notifications task is registered (persisted across launches)
(async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('[index] ✅ Registered background notifications task');
    } else {
      console.log('[index] ℹ️ Background notifications task already registered');
    }
  } catch (e) {
    console.warn('[index] ⚠️ Failed to register background notifications task:', e);
  }
})();

// Boot the app via Expo Router
import 'expo-router/entry';
