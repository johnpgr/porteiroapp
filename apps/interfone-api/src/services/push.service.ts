/**
 * Push Notification Service
 * Handles sending push notifications to mobile devices for call invites
 * Supports Expo Push Notifications
 */

interface PushNotificationPayload {
  to: string; // Expo push token
  title?: string; // Optional for headless notifications
  body?: string; // Optional for headless notifications
  data?: Record<string, any>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  contentAvailable?: boolean; // iOS/Expo: deliver as background notification
  _contentAvailable?: boolean; // iOS: deliver as background notification
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

interface VoipPushParams {
  voipToken: string;
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
   * Send a call invite push notification with background handling hints.
   * We keep a visible notification for Android reliability while preserving TaskManager wake-up data.
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

    // Headless data-only push for Android reliability (full-screen handled by app via Notifee)
    // Note: omit title/body to encourage background task delivery; include high priority + contentAvailable
    const payload: PushNotificationPayload = {
      to: params.pushToken,
      contentAvailable: true,
      _contentAvailable: true,
      sound: 'telephone_toque_interfone.mp3',
      priority: 'high',
      channelId: 'intercom_call',
      data: {
        type: 'intercom_call',
        callId: params.callId,
        from: params.from,
        fromName: params.fromName || 'Doorman',
        apartmentNumber: params.apartmentNumber || '',
        buildingName: params.buildingName || '',
        channelName: params.channelName,
        action: 'incoming_call',
        timestamp: Date.now().toString(),
        ...params.metadata
      }
    };

    try {
      // Log sanitized payload info before sending
      const tokenPreview = `${params.pushToken?.slice(0, 12) ?? ''}...`;
      console.log('📤 [push] Preparing Expo push (call invite - data only)', {
        to: tokenPreview,
        callId: params.callId,
        from: params.from,
        contentAvailable: true,
        _contentAvailable: true,
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
      channelId: 'intercom_call',
      sound: 'telephone_toque_interfone.mp3',
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
   * Send iOS VoIP push notification (HIGH PRIORITY - wakes app from killed state)
   * VoIP pushes are delivered even when the app is killed, unlike regular pushes
   *
   * CRITICAL: iOS 13+ requires the app to report the call to CallKit immediately
   */
  async sendVoipPush(params: VoipPushParams): Promise<SendPushResult> {
    if (!this.enabled) {
      return {
        success: false,
        pushToken: params.voipToken,
        error: 'Push notifications are disabled'
      };
    }

    // Validate VoIP push token format
    if (!this.isValidExpoPushToken(params.voipToken)) {
      console.warn(`⚠️ Invalid VoIP push token format: ${params.voipToken}`);
      return {
        success: false,
        pushToken: params.voipToken,
        error: 'Invalid VoIP push token format'
      };
    }

    // VoIP push payload (data-only, no notification)
    const payload: PushNotificationPayload = {
      to: params.voipToken,
      // NO title or body - VoIP pushes are silent/data-only
      contentAvailable: true,
      _contentAvailable: true, // iOS: deliver as background notification
      priority: 'high',
      channelId: 'intercom_call',
      data: {
        type: 'intercom_call',
        callId: params.callId,
        from: params.from,
        fromName: params.fromName || 'Doorman',
        apartmentNumber: params.apartmentNumber || '',
        buildingName: params.buildingName || '',
        channelName: params.channelName,
        action: 'incoming_call',
        timestamp: Date.now().toString(),
        isVoip: true, // Flag to indicate this is a VoIP push
        ...params.metadata
      }
    };

    try {
      const tokenPreview = `${params.voipToken?.slice(0, 12) ?? ''}...`;
      console.log('📤 [push] Sending iOS VoIP push (high priority)', {
        to: tokenPreview,
        callId: params.callId,
        from: params.from,
        channelName: params.channelName,
        apartmentNumber: params.apartmentNumber,
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

      console.log('📡 [push] VoIP push POST status', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ VoIP push notification failed (${response.status}):`, errorText);
        return {
          success: false,
          pushToken: params.voipToken,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const result = await response.json();
      const firstResult = Array.isArray(result?.data)
        ? result.data[0]
        : result?.data ?? result;

      if (firstResult?.status === 'error') {
        console.error('❌ VoIP push notification error:', firstResult.message, {
          details: firstResult?.details,
          token: tokenPreview,
        });
        return {
          success: false,
          pushToken: params.voipToken,
          error: firstResult.message || 'VoIP push notification failed'
        };
      }

      console.log(`✅ VoIP push sent to ${tokenPreview} (ticket: ${firstResult?.id})`);

      return {
        success: true,
        pushToken: params.voipToken,
        ticketId: firstResult?.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to send VoIP push notification:', errorMessage);
      return {
        success: false,
        pushToken: params.voipToken,
        error: errorMessage
      };
    }
  }

  /**
   * Send VoIP pushes to multiple iOS recipients
   */
  async sendVoipPushesToMultiple(
    baseParams: Omit<VoipPushParams, 'voipToken'>,
    recipients: Array<{ voipToken: string; name?: string }>
  ): Promise<SendPushResult[]> {
    console.log('📣 [push] Sending VoIP pushes to multiple iOS recipients', {
      recipients: recipients.length,
      callId: baseParams.callId,
    });

    const promises = recipients.map((recipient) =>
      this.sendVoipPush({
        ...baseParams,
        voipToken: recipient.voipToken,
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

    // Detect raw FCM tokens (contain colon, e.g., "xxx:APA91b...")
    if (token.includes(':')) {
      console.error(`❌ [push] Invalid token format: This appears to be a raw FCM token, not an Expo push token.`);
      console.error(`   Token preview: ${token.substring(0, 30)}...`);
      console.error(`   Solution: User needs to re-login or update app to register proper Expo push token`);
      console.error(`   Expected format: ExponentPushToken[...] or ExpoPushToken[...]`);
      return false;
    }

    // Accept both old and new formats
    const isValid = (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      // Also accept bare tokens (legacy format without colons)
      /^[a-zA-Z0-9_-]{22,}$/.test(token)
    );

    if (!isValid) {
      console.warn(`⚠️ [push] Invalid Expo push token format: ${token.substring(0, 30)}...`);
      console.warn(`   Expected: ExponentPushToken[...] or ExpoPushToken[...]`);
    }

    return isValid;
  }

  /**
   * Check if push notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export default new PushNotificationService();
