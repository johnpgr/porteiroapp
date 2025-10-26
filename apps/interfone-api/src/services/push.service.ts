/**
 * Push Notification Service
 * Handles sending push notifications to mobile devices for call invites
 * Supports Expo Push Notifications
 */

interface PushNotificationPayload {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

interface SendPushResult {
  success: boolean;
  pushToken: string;
  error?: string;
  ticketId?: string;
}

interface CallInvitePushParams {
  pushToken: string;
  callId: string;
  from: string;
  fromName?: string;
  apartmentNumber?: string;
  buildingName?: string;
  channelName: string;
  metadata?: Record<string, any>;
}

class PushNotificationService {
  private readonly expoApiUrl = 'https://exp.host/--/api/v2/push/send';
  private readonly enabled: boolean;

  constructor() {
    // Check if push notifications are enabled
    // In production, you might want to require an access token
    this.enabled = process.env.PUSH_NOTIFICATIONS_ENABLED !== 'false';

    if (!this.enabled) {
      console.log('📵 Push notifications are disabled');
    }
  }

  /**
   * Send a call invite push notification
   */
  async sendCallInvite(params: CallInvitePushParams): Promise<SendPushResult> {
    if (!this.enabled) {
      return {
        success: false,
        pushToken: params.pushToken,
        error: 'Push notifications are disabled'
      };
    }

    // Validate Expo push token format
    if (!this.isValidExpoPushToken(params.pushToken)) {
      console.warn(`⚠️ Invalid Expo push token format: ${params.pushToken}`);
      return {
        success: false,
        pushToken: params.pushToken,
        error: 'Invalid push token format'
      };
    }

    const payload: PushNotificationPayload = {
      to: params.pushToken,
      title: 'Chamada do Interfone',
      body: params.fromName
        ? `${params.fromName} está chamando${params.apartmentNumber ? ` para o apartamento ${params.apartmentNumber}` : ''}`
        : `Chamada de interfone${params.apartmentNumber ? ` para o apartamento ${params.apartmentNumber}` : ''}`,
      // Use dedicated intercom call channel configured in the app
      sound: 'doorbell_push.mp3',
      priority: 'high',
      channelId: 'intercom-call',
      data: {
        type: 'intercom_call',
        callId: params.callId,
        from: params.from,
        fromName: params.fromName,
        apartmentNumber: params.apartmentNumber,
        buildingName: params.buildingName,
        channelName: params.channelName,
        action: 'incoming_call',
        ...params.metadata
      }
    };

    try {
      // Log sanitized payload info before sending
      const tokenPreview = `${params.pushToken?.slice(0, 12) ?? ''}...`;
      console.log('📤 [push] Preparing Expo push', {
        to: tokenPreview,
        callId: params.callId,
        from: params.from,
        channelId: payload.channelId,
        sound: payload.sound,
        channelName: params.channelName,
        apartmentNumber: params.apartmentNumber,
        buildingName: params.buildingName,
      });

      const response = await fetch(this.expoApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 [push] Expo POST status', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ Expo push notification failed (${response.status}):`, errorText);
        return {
          success: false,
          pushToken: params.pushToken,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const result = await response.json();

      // Expo returns an array of results when you send an array of messages,
      // and an object when you send a single message. Normalize here.
      const firstResult = Array.isArray(result?.data)
        ? result.data[0]
        : result?.data ?? result;

      if (firstResult?.status === 'error') {
        console.error('❌ Expo push notification error:', firstResult.message, {
          details: firstResult?.details,
          token: tokenPreview,
        });
        return {
          success: false,
          pushToken: params.pushToken,
          error: firstResult.message || 'Push notification failed'
        };
      }

      console.log(`✅ Push notification sent to ${tokenPreview} (ticket: ${firstResult?.id})`);

      return {
        success: true,
        pushToken: params.pushToken,
        ticketId: firstResult?.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to send push notification:', errorMessage);
      return {
        success: false,
        pushToken: params.pushToken,
        error: errorMessage
      };
    }
  }

  /**
   * Send call invites to multiple recipients
   */
  async sendCallInvitesToMultiple(
    baseParams: Omit<CallInvitePushParams, 'pushToken'>,
    recipients: Array<{ pushToken: string; name?: string }>
  ): Promise<SendPushResult[]> {
    console.log('📣 [push] Sending call invites to multiple recipients', {
      recipients: recipients.length,
      callId: baseParams.callId,
      channelId: 'intercom-call',
      sound: 'doorbell_push.mp3',
    });
    const promises = recipients.map((recipient) =>
      this.sendCallInvite({
        ...baseParams,
        pushToken: recipient.pushToken,
        fromName: baseParams.fromName || recipient.name
      })
    );

    return Promise.all(promises);
  }

  /**
   * Validate Expo push token format
   * Expo push tokens start with ExponentPushToken[...] or ExpoPushToken[...]
   */
  private isValidExpoPushToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Accept both old and new formats
    return (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      // Also accept bare tokens (legacy format)
      /^[a-zA-Z0-9_-]{22,}$/.test(token)
    );
  }

  /**
   * Check if push notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export default new PushNotificationService();
