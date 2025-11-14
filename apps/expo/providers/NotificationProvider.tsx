import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { callCoordinator } from '~/services/calling/CallCoordinator';

/**
 * Provider that manages notification listeners and routing.
 * Handles foreground notifications and user interactions (clicks/actions).
 * Routes to appropriate screens based on notification type.
 * Coordinates with CallManager for call-related notifications.
 */
export function NotificationProvider() {
  const router = useRouter();

  useEffect(() => {
    // Listener for notifications received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 [Foreground] Notification received:', notification);
      // Notification will be displayed automatically due to centralized handler in notificationHandler.ts
    });

    // Listener for when user clicks on notification
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('👆 [Click] User clicked notification:', response);
        const data = response.notification.request.content.data;
        const actionId = response.actionIdentifier;

        console.log('👆 [Click] Action identifier:', actionId);
        console.log('👆 [Click] Notification type:', data?.type);

        // Handle intercom call notification actions
        if (data?.type === 'intercom_call') {
          console.log('📞 [Click] Intercom call notification action');

          if (actionId === 'ANSWER_CALL' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            console.log('✅ [Click] User wants to answer call');

            // If there's an active call, answer it
            if (callCoordinator.hasActiveCall()) {
              await callCoordinator.answerActiveCall();
            } else {
              console.log('⚠️ [Click] No active call - will be recovered on morador screen');
            }

            // Navigate to morador home (UI will appear via state subscription or pending call recovery)
            router.push('/morador');
            return;
          } else if (actionId === 'DECLINE_CALL') {
            console.log('❌ [Click] User declined call');

            // Coordinator handles decline logic + API call
            await callCoordinator.endActiveCall('decline');
            return;
          }
        }

        // Navigation based on notification type (existing logic)
        if (data?.type === 'visitor_arrival') {
          // Navigate to resident authorization screen
          router.push('/morador/authorize');
        } else if (data?.type === 'visitor_approved' || data?.type === 'visitor_rejected') {
          // Navigate to doorman screen
          router.push('/porteiro');
        }
      }
    );

    // Cleanup
    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  return null;
}
