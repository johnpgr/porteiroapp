/**
 * Background Notification Task Handler
 *
 * This task runs when a push notification is received, even when the app is killed.
 * It handles incoming intercom calls by creating call sessions via CallCoordinator.
 *
 * IMPORTANT: This must be registered at module level (not inside a component)
 * to ensure it's available before the app fully loads.
 */

import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import RNCallKeep from 'react-native-callkeep';
import { callCoordinator, type VoipPushData } from './calling/CallCoordinator';
import * as z from 'zod/v4';

// Zod schema for the expected notification payload
const IntercomCallSchema = z.object({
  type: z.literal('intercom_call'),
  callId: z.string(),
  callerName: z.string().optional(),
  fromName: z.string().optional(),
  apartmentNumber: z.string().optional(),
  channelName: z.string().optional(),
  channel: z.string().optional(),
  from: z.string(),
}).loose();

// Helper schema for parsing JSON strings
const JsonStringSchema = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str);
  } catch {
    ctx.addIssue({ code: "custom", message: 'Invalid JSON string' });
    return z.NEVER;
  }
});

// Schema to extract the actual payload from various notification shapes
const NotificationParser = z.union([
  // 1. Standard Expo notification structure
  z.object({
    notification: z.object({
      request: z.object({
        content: z.object({
          data: IntercomCallSchema
        })
      })
    })
  }).transform(data => data.notification.request.content.data),

  // 2. Direct data object (FCM/Data-only)
  z.object({
    data: IntercomCallSchema
  }).transform(data => data.data),

  // 3. Nested data object (common in some Expo deliveries)
  z.object({
    data: z.object({
      data: IntercomCallSchema
    })
  }).transform(data => data.data.data),

  // 4. JSON string in dataString or body
  z.object({
    data: z.object({
      dataString: JsonStringSchema.pipe(IntercomCallSchema)
    })
  }).transform(data => data.data.dataString),

  z.object({
    data: z.object({
      body: JsonStringSchema.pipe(IntercomCallSchema)
    })
  }).transform(data => data.data.body),

  // 5. Fallback: The input itself is the payload
  IntercomCallSchema
]);

// Use a fixed, non-empty task name as per Expo docs
export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

type CallKeepOptions = Parameters<typeof RNCallKeep.setup>[0];

// CallKeep options (defined at module level)
const callKeepOptions: CallKeepOptions = {
  ios: { appName: 'James Avisa' },
  android: {
    alertTitle: 'Permissões necessárias',
    alertDescription: 'Este app precisa de acesso à conta telefônica',
    cancelButton: 'Cancelar',
    okButton: 'OK',
    foregroundService: {
      channelId: 'com.porteiroapp.callkeep',
      channelName: 'Serviço de Chamadas',
      notificationTitle: 'Chamada recebida',
      notificationIcon: 'ic_notification',
    },
    additionalPermissions: [],
  },
};

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
    console.log(`[BackgroundTask] 🎯 TRIGGERED (${Platform.OS}) at ${new Date().toISOString()}`);

    // On Android, skip if app is in foreground (foreground listener will handle it)
    // This prevents duplicate call handling
    if (Platform.OS === 'android' && AppState.currentState === 'active') {
      console.log(
        '[BackgroundTask] ⏭️ App is in foreground, skipping background task (foreground listener will handle)'
      );
      return;
    }

    if (error) {
      console.error('[BackgroundTask] ❌ Task received error:', error);
      console.error('[BackgroundTask] Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('[BackgroundTask] 📥 Received data:', { keys: Object.keys(data || {}), data });

    try {
      // Distinguish RECEIVED vs RESPONSE by presence of `actionIdentifier`
      const isResponseEvent =
        data && typeof data === 'object' && 'actionIdentifier' in (data as any);

      if (isResponseEvent) {
        console.log('[BackgroundTask] � Notification RESPONSE event (user action)');
        return;
      }

      console.log('[BackgroundTask] 📨 This is a notification RECEIVED event');
      console.log('[BackgroundTask] Notification data extracted');

      // Use Zod to robustly parse and extract the payload from any shape
      const parseResult = NotificationParser.safeParse(data);

      if (!parseResult.success) {
        console.warn('[BackgroundTask] Zod parsing failed:', parseResult.error);
        console.log('[BackgroundTask] ⚠️ Not an intercom call or parsing failed');
        return;
      }

      const payload = parseResult.data;
      console.log('[BackgroundTask] Notification data extracted');
      console.log('[BackgroundTask] 🎉 INTERCOM CALL DETECTED:', payload.callId);

      const callData: IncomingCallData = {
        callId: payload.callId,
        callerName: payload.fromName || payload.callerName || 'Porteiro',
        apartmentNumber: payload.apartmentNumber || '',
        channelName: payload.channelName || payload.channel || '',
        from: payload.from,
        timestamp: Date.now(),
      };

      await processIncomingCall(callData);
    } catch (error) {
      console.error('[BackgroundTask] ❌ Fatal error processing notification:', error);
      console.error(
        '[BackgroundTask] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace'
      );
      console.error(
        '[BackgroundTask] Error details:',
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
    }
  }
);

async function processIncomingCall(callData: IncomingCallData) {
  try {
    // 1. Setup CallKeep (Android only - iOS handled in AppDelegate)
    let callKeepAvailable = false;
    if (Platform.OS === 'android') {
      callKeepAvailable = await setupCallKeep();
    }

    // 2. Display CallKeep UI if available (Android)
    if (callKeepAvailable && Platform.OS === 'android') {
      displayCallKeepUI(callData);
    }

    // 3. CRITICAL: Create session in background via CallCoordinator
    console.log('[BackgroundTask] 🎯 Creating call session via CallCoordinator...');

    const pushData: VoipPushData = {
      callId: callData.callId,
      callerName: callData.callerName,
      apartmentNumber: callData.apartmentNumber,
      channelName: callData.channelName,
      from: callData.from,
      source: 'background', // Mark as background source
      shouldShowNativeUI: false, // Background task already shows CallKeep UI directly
    };

    await callCoordinator.handleIncomingPush(pushData);
    console.log('[BackgroundTask] ✅ Call session created');
  } catch (notificationError) {
    console.error(
      '[BackgroundTask] ❌ Failed to process intercom call:',
      notificationError
    );
    console.error(
      '[BackgroundTask] Error stack:',
      notificationError instanceof Error ? notificationError.stack : 'No stack trace'
    );
    console.error(
      '[BackgroundTask] Error details:',
      JSON.stringify(notificationError, Object.getOwnPropertyNames(notificationError))
    );
  }
}

async function setupCallKeep(): Promise<boolean> {
  try {
    console.log('[BackgroundTask] 🔧 Setting up CallKeep for Android...');
    await RNCallKeep.setup(callKeepOptions);
    RNCallKeep.setAvailable(true);
    console.log('[BackgroundTask] ✅ CallKeep setup successful');
    return true;
  } catch (callKeepError) {
    console.warn(
      '[BackgroundTask] ⚠️ CallKeep setup failed, will use fallback UI:',
      callKeepError
    );
    return false;
  }
}

function displayCallKeepUI(callData: IncomingCallData) {
  // Check if call is already active before showing UI (prevents duplicate UI)
  const hasActiveCall = callCoordinator.hasActiveCall();
  const activeSession = callCoordinator.getActiveSession();

  if (hasActiveCall && activeSession?.id === callData.callId) {
    console.log('[BackgroundTask] Call already active, skipping CallKeep UI');
    return;
  }

  try {
    // Use caller name for handle (not UUID) to ensure consistent display
    // If callerName is not available or is the fallback, use a formatted string instead of UUID
    const displayHandle =
      callData.callerName && callData.callerName !== 'Porteiro'
        ? callData.callerName
        : callData.apartmentNumber
          ? `Apt ${callData.apartmentNumber}`
          : 'Interfone';

    RNCallKeep.displayIncomingCall(
      callData.callId,
      displayHandle, // Use name/apartment instead of UUID
      callData.callerName || 'Porteiro', // Ensure we always have a name
      'generic',
      false
    );
    console.log('[BackgroundTask] ✅ CallKeep incoming call UI displayed:', {
      callId: callData.callId,
      handle: displayHandle,
      callerName: callData.callerName || 'Porteiro',
    });
  } catch (displayError) {
    console.error('[BackgroundTask] ❌ Failed to display CallKeep UI:', displayError);
  }
}

/**
 * Register the background task
 * MUST be called at module level (not inside component)
 */
export async function registerBackgroundNotificationTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);

    if (isRegistered) {
      console.log('[BackgroundTask] Already registered');
      return;
    }

    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('[BackgroundTask] ✅ Registered successfully');
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
