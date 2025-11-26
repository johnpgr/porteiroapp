import { createApnsClientFromEnv } from './apns.service.ts';

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

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

type ExpoPushResponse =
  | { data: ExpoPushTicket | ExpoPushTicket[] }
  | ExpoPushTicket;

class PushNotificationService {
  private readonly expoApiUrl = 'https://exp.host/--/api/v2/push/send';
  private readonly enabled: boolean;
  private readonly apnsClient = createApnsClientFromEnv();

  constructor() {
    // Check if push notifications are enabled
    // In production, you might want to require an access token
    this.enabled = process.env.PUSH_NOTIFICATIONS_ENABLED !== 'false';

    if (!this.enabled) {
      console.log('📵 Push notifications are disabled');
    } else if (this.apnsClient) {
      console.log('📡 APNs VoIP transport enabled (HTTP/2)');
    } else {
      console.warn('⚠️ APNs VoIP credentials missing - falling back to Expo VoIP push transport');
    }
  }

  /**
   * Send a call invite push notification.
   *
   * ANDROID: Sends data-only high-priority push to trigger background task and CallKeep UI
   * iOS: Sends notification with title/body (VoIP push via PushKit recommended for future)
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

    // Determine if this is an iOS token (heuristic: iOS tokens are longer and different format)
    // More reliable: track platform in DB, but this works for most cases
    const isIOS = params.metadata?.platform === 'ios';

    // Build base payload with data
    const basePayload = {
      to: params.pushToken,
      priority: 'high' as const,
      contentAvailable: true,
      _contentAvailable: true,
      data: {
        type: 'intercom_call',
        callId: params.callId,
        from: params.from,
        fromName: params.fromName || 'Porteiro',
        apartmentNumber: params.apartmentNumber || '',
        buildingName: params.buildingName || '',
        channelName: params.channelName,
        action: 'incoming_call',
        timestamp: Date.now().toString(),
        ...params.metadata
      }
    };

    // CRITICAL: Android requires data-only (no title/body) for background task to fire
    // iOS can have title/body for notification banner (until VoIP push implemented)
    const payload: PushNotificationPayload = isIOS
      ? {
          ...basePayload,
          title: 'Chamada do interfone',
          body: params.fromName
            ? `${params.fromName} está chamando`
            : 'Interfone chamando',
          sound: 'default',
          channelId: 'intercom_call',
        }
      : {
          ...basePayload,
          // Android: NO title, NO body, NO sound, NO channelId - pure data-only for background task
          // Including channelId causes a blank notification to be displayed and prevents background task from running
        };

    try {
      // Log sanitized payload info before sending
      const tokenPreview = `${params.pushToken?.slice(0, 12) ?? ''}...`;
      console.log('📤 [push] Preparing Expo push (call invite)', {
        to: tokenPreview,
        platform: isIOS ? 'iOS' : 'Android',
        dataOnly: !isIOS,
        callId: params.callId,
        from: params.from,
        priority: 'high',
        contentAvailable: true,
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

      const result = await response.json() as ExpoPushResponse;

      // Expo returns an array of results when you send an array of messages,
      // and an object when you send a single message. Normalize here.
      const firstResult: ExpoPushTicket | undefined = 'data' in result
        ? (Array.isArray(result.data) ? result.data[0] : result.data)
        : result;

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
      // channelId: 'intercom_call',
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

    if (this.apnsClient) {
      return this.sendVoipPushViaApns(params);
    }

    return this.sendVoipPushViaExpo(params);
  }

  private async sendVoipPushViaApns(params: VoipPushParams): Promise<SendPushResult> {
    if (!this.apnsClient) {
      return this.sendVoipPushViaExpo(params);
    }

    const sanitizedToken = this.sanitizeApnsDeviceToken(params.voipToken);

    if (!this.isValidApnsDeviceToken(sanitizedToken)) {
      console.warn(`⚠️ Invalid APNs VoIP token format: ${params.voipToken}`);
      return {
        success: false,
        pushToken: params.voipToken,
        error: 'Invalid APNs VoIP token format'
      };
    }

    const payload = {
      aps: {
        'content-available': 1,
      },
      data: this.buildVoipData(params),
    };

    try {
      const response = await this.apnsClient.send({
        deviceToken: sanitizedToken,
        payload,
        pushType: 'voip',
        priority: '10'
      });

      if (!response.success) {
        const errorMessage = response.error || `APNs HTTP ${response.status || 0}`;
        console.error('❌ [push] APNs VoIP push failed:', errorMessage, {
          status: response.status,
          apnsId: response.apnsId,
        });
        return {
          success: false,
          pushToken: sanitizedToken,
          error: errorMessage
        };
      }

      console.log('✅ [push] VoIP push sent via APNs', {
        token: `${sanitizedToken.slice(0, 10)}...`,
        apnsId: response.apnsId,
      });

      return {
        success: true,
        pushToken: sanitizedToken,
        ticketId: response.apnsId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown APNs error';
      console.error('❌ [push] Failed to send APNs VoIP push:', errorMessage);
      return {
        success: false,
        pushToken: sanitizedToken,
        error: errorMessage
      };
    }
  }

  private async sendVoipPushViaExpo(params: VoipPushParams): Promise<SendPushResult> {
    // Validate Expo push token format (legacy fallback)
    if (!this.isValidExpoPushToken(params.voipToken)) {
      console.warn(`⚠️ Invalid VoIP push token format: ${params.voipToken}`);
      return {
        success: false,
        pushToken: params.voipToken,
        error: 'Invalid VoIP push token format'
      };
    }

    const payload: PushNotificationPayload = {
      to: params.voipToken,
      contentAvailable: true,
      _contentAvailable: true,
      priority: 'high',
      channelId: 'intercom_call',
      data: this.buildVoipData(params),
    };

    try {
      const tokenPreview = `${params.voipToken?.slice(0, 12) ?? ''}...`;
      console.log('📤 [push] Sending fallback Expo VoIP push (high priority)', {
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

      console.log('📡 [push] VoIP push POST status (Expo fallback)', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ VoIP push notification failed (${response.status}):`, errorText);
        return {
          success: false,
          pushToken: params.voipToken,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const result = await response.json() as ExpoPushResponse;
      const firstResult: ExpoPushTicket | undefined = 'data' in result
        ? (Array.isArray(result.data) ? result.data[0] : result.data)
        : result;

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

  private buildVoipData(params: VoipPushParams): Record<string, any> {
    return {
      type: 'intercom_call',
      callId: params.callId,
      from: params.from,
      fromName: params.fromName || 'Doorman',
      apartmentNumber: params.apartmentNumber || '',
      buildingName: params.buildingName || '',
      channelName: params.channelName,
      action: 'incoming_call',
      timestamp: Date.now().toString(),
      isVoip: true,
      ...params.metadata,
    };
  }

  private sanitizeApnsDeviceToken(token: string): string {
    if (!token) {
      return '';
    }
    return token.replace(/[\s<>]/g, '').toLowerCase();
  }

  private isValidApnsDeviceToken(token: string): boolean {
    return /^[0-9a-f]{64,}$/i.test(token);
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
