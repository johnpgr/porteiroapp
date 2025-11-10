/**
 * Unified Notification Handler
 *
 * Centralized notification handling to prevent conflicts from multiple
 * setNotificationHandler() calls across the codebase.
 *
 * Features:
 * - Single notification handler with type-based routing
 * - Push token change detection and auto-update
 * - Consolidated notification channel setup
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '~/utils/supabase';

let isInitialized = false;
let tokenListener: Notifications.EventSubscription | null = null;

/**
 * Configure notification handler with type-based routing
 */
function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const notificationType = data?.type as string | undefined;

      // Special handling for intercom calls
      if (notificationType === 'intercom_call') {
        return {
          shouldShowAlert: true,
          shouldPlaySound: false, // App handles ringtone via FullScreenCallUI
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        };
      }

      // Standard handling for all other notifications
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });

  console.log('✅ [NotificationHandler] Notification handler configured');
}

/**
 * Setup all notification channels (Android)
 */
async function setupNotificationChannels(): Promise<void> {
  if (!Device.isDevice || Platform.OS !== 'android') {
    console.log('⏭️ [NotificationHandler] Skipping channel setup (not Android device)');
    return;
  }

  console.log('🔧 [NotificationHandler] Setting up notification channels...');

  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notificações Porteiro',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [250, 250, 250, 250],
    lightColor: '#FF231F7C',
    sound: 'telephone_toque_interfone.mp3',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
  });

  // Visitor notifications
  await Notifications.setNotificationChannelAsync('visitor', {
    name: 'Visitantes',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [250, 250, 250, 250],
    sound: 'telephone_toque_interfone.mp3',
  });

  // Delivery notifications
  await Notifications.setNotificationChannelAsync('delivery', {
    name: 'Entregas',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'telephone_toque_interfone.mp3',
  });

  // Emergency notifications
  await Notifications.setNotificationChannelAsync('emergency', {
    name: 'Emergências',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [500, 250, 500, 250],
    sound: 'telephone_toque_interfone.mp3',
  });

  // Intercom call channel (HIGH PRIORITY) - for push notifications
  await Notifications.setNotificationChannelAsync('intercom_call', {
    name: 'Interfone (Chamada)',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [250, 250, 250, 250],
    sound: 'telephone_toque_interfone.mp3',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
  });

  // Call channel (for AndroidForegroundService)
  await Notifications.setNotificationChannelAsync('call', {
    name: 'Chamadas em Progresso',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null, // No sound - custom ringtone handled separately
    enableVibrate: false,
    showBadge: true,
    description: 'Mantém o app ativo durante chamadas',
  });

  console.log('✅ [NotificationHandler] Notification channels configured');

  // Setup notification categories (for action buttons)
  console.log('🔧 [NotificationHandler] Setting up notification categories...');
  
  await Notifications.setNotificationCategoryAsync('call', [
    {
      identifier: 'ANSWER_CALL',
      buttonTitle: 'Atender',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: 'DECLINE_CALL',
      buttonTitle: 'Recusar',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
  ]);

  console.log('✅ [NotificationHandler] Notification categories configured');
}

/**
 * Setup push token change listener
 * Automatically updates database when Expo/FCM/APNs rolls the token
 */
function setupTokenChangeListener(): void {
  if (tokenListener) {
    console.log('⏭️ [NotificationHandler] Token listener already registered');
    return;
  }

  tokenListener = Notifications.addPushTokenListener(async (token) => {
    try {
      // Silently ignore non-Expo tokens (FCM/APNs device tokens)
      // Only save valid Expo push tokens to database
      if (
        !token.data ||
        (!token.data.startsWith('ExponentPushToken[') &&
         !token.data.startsWith('ExpoPushToken['))
      ) {
        return; // Silently ignore invalid tokens
      }

      console.log('🔄 [NotificationHandler] Push token changed:', token.data);

      // Get current user from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn('⚠️ [NotificationHandler] No active session, cannot update token');
        return;
      }

      const userId = session.user.id;

      // Determine table based on user metadata
      const userType = session.user.user_metadata?.user_type;
      const table = userType === 'admin' ? 'admin_profiles' : 'profiles';

      console.log(`💾 [NotificationHandler] Updating token for user ${userId} in ${table}...`);

      // Update token in database
      const { error } = await supabase
        .from(table)
        .update({
          push_token: token.data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [NotificationHandler] Failed to update token:', error);
        return;
      }

      console.log('✅ [NotificationHandler] Token updated successfully');
    } catch (error) {
      console.error('❌ [NotificationHandler] Error in token change handler:', error);
    }
  });

  console.log('✅ [NotificationHandler] Token change listener registered');
}

/**
 * Initialize notification handler
 * Call this BEFORE registering background tasks to ensure handler is ready
 */
export async function initializeNotificationHandler(): Promise<void> {
  if (isInitialized) {
    console.log('⏭️ [NotificationHandler] Already initialized');
    return;
  }

  console.log('🚀 [NotificationHandler] Initializing...');

  // 1. Configure notification handler
  setupNotificationHandler();

  // 2. Setup expo notification channels (Android only)
  await setupNotificationChannels();

  // 3. Setup token change listener
  setupTokenChangeListener();

  isInitialized = true;
  console.log('✅ [NotificationHandler] Initialization complete');
}

/**
 * Cleanup notification handler (e.g., on logout)
 */
export function cleanupNotificationHandler(): void {
  if (tokenListener) {
    tokenListener.remove();
    tokenListener = null;
    console.log('🗑️ [NotificationHandler] Token listener removed');
  }

  isInitialized = false;
  console.log('🗑️ [NotificationHandler] Cleanup complete');
}

export default {
  initializeNotificationHandler,
  cleanupNotificationHandler,
};
