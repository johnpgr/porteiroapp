/**
 * VoIP Push Notifications Handler
 *
 * Handles iOS VoIP push notifications using react-native-voip-push-notification
 * This enables the app to receive incoming call notifications even when killed.
 *
 * IMPORTANT: VoIP push is iOS only. Android uses regular FCM high-priority push.
 *
 * Flow:
 * 1. Register for VoIP push on app start (iOS only)
 * 2. Receive VoIP token → Save to database
 * 3. Receive VoIP push → Display full-screen call UI immediately
 * 4. User answers → Join Agora call
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { callCoordinator, type VoipPushData } from '~/services/calling/CallCoordinator';

// iOS only - react-native-voip-push-notification
let VoipPushNotification: typeof import('react-native-voip-push-notification').default | null = null;

// Only import on iOS
if (Platform.OS === 'ios') {
  try {
    VoipPushNotification = require('react-native-voip-push-notification').default;
  } catch (error) {
    console.warn('[VoIP Push] react-native-voip-push-notification not available:', error);
  }
}

class VoipPushNotificationService {
  private voipToken: string | null = null;
  private isRegistered: boolean = false;
  private userId: string | null = null;
  private userType: 'admin' | 'porteiro' | 'morador' | null = null;

  /**
   * Initialize VoIP push notifications (iOS only)
   */
  async initialize(userId: string, userType: 'admin' | 'porteiro' | 'morador'): Promise<void> {
    if (Platform.OS !== 'ios') {
      console.log('[VoIP Push] Skipping - Android uses regular FCM');
      return;
    }

    if (!VoipPushNotification) {
      console.warn('[VoIP Push] Library not available');
      return;
    }

    if (this.isRegistered) {
      console.log('[VoIP Push] Already registered');
      return;
    }

    console.log('[VoIP Push] Initializing for user:', userId, 'type:', userType);

    this.userId = userId;
    this.userType = userType;

    try {
      // Register for VoIP push
      VoipPushNotification.registerVoipToken();

      // Setup event listeners
      this.setupEventListeners();

      this.isRegistered = true;
      console.log('[VoIP Push] ✅ Initialization complete');
    } catch (error) {
      console.error('[VoIP Push] ❌ Initialization failed:', error);
    }
  }

  /**
   * Setup event listeners for VoIP push
   */
  private setupEventListeners(): void {
    if (!VoipPushNotification) {
      return;
    }

    // Listen for VoIP token registration
    VoipPushNotification.addEventListener('register', (token: string) => {
      console.log('[VoIP Push] 📱 Token received:', token);
      this.voipToken = token;
      this.saveVoipTokenToDatabase(token);
    });

    // Listen for incoming VoIP push notifications
    VoipPushNotification.addEventListener('notification', (notification: any) => {
      console.log('[VoIP Push] 📞 Incoming push notification:', notification);
      this.handleIncomingVoipPush(notification);
    });

    console.log('[VoIP Push] Event listeners registered');
  }

  /**
   * Save VoIP push token to database
   */
  private async saveVoipTokenToDatabase(token: string): Promise<void> {
    if (!this.userId || !this.userType) {
      console.warn('[VoIP Push] Cannot save token - user info not set');
      return;
    }

    console.log('[VoIP Push] 💾 Saving token to database...');

    try {
      // Determine table based on user type
      const table = this.userType === 'admin' ? 'admin_profiles' : 'profiles';

      // Check if token changed
      const { data: existingProfile } = await supabase
        .from(table)
        .select('user_id, voip_push_token')
        .eq('user_id', this.userId)
        .single();

      if (existingProfile?.voip_push_token === token) {
        console.log('[VoIP Push] ✅ Token already up-to-date');
        return;
      }

      // Update VoIP token in database
      const { error, count } = await supabase
        .from(table)
        .update({ voip_push_token: token })
        .eq('user_id', this.userId)
        .select();

      if (error) {
        console.error('[VoIP Push] ❌ Failed to save token:', error);
        return;
      }

      if (count && count > 0) {
        console.log('[VoIP Push] ✅ Token saved successfully');
      } else {
        console.warn('[VoIP Push] ⚠️ No rows updated');
      }
    } catch (error) {
      console.error('[VoIP Push] ❌ Error saving token:', error);
    }
  }

  /**
   * Handle incoming VoIP push notification
   * Simplified: Just extract data and delegate to CallCoordinator
   * Trust that AppDelegate already reported to CallKit (via plugin)
   */
  private async handleIncomingVoipPush(notification: any): Promise<void> {
    console.log('[VoIP Push] 🎯 Processing incoming push...');

    // Extract call data from notification (raw data can have different field formats)
    const data: any = notification || {};

    const callId = data.callId || data.call_id || 'unknown';
    const callerName = data.fromName || data.from_name || data.callerName || 'Porteiro';
    const apartmentNumber = data.apartmentNumber || data.apartment_number || '';
    const channelName = data.channelName || data.channel_name || data.channel || `call-${callId}`;
    const buildingName = data.buildingName || data.building_name || '';

    console.log('[VoIP Push] Call details:', {
      callId,
      callerName,
      apartmentNumber,
      channelName,
    });

    try {
      // Extract data and delegate to CallCoordinator
      // AppDelegate already reported to CallKit (via withCallKitAppDelegate plugin)
      // CallCoordinator will handle RTM warmup and session creation
      const pushData: VoipPushData = {
        callId,
        from: data.from || '',
        callerName,
        apartmentNumber,
        buildingName,
        channelName,
        timestamp: data.timestamp ? Number(data.timestamp) : Date.now(),
      };

      console.log('[VoIP Push] 📞 Delegating to CallCoordinator...');
      await callCoordinator.handleIncomingPush(pushData);
      console.log('[VoIP Push] ✅ CallCoordinator handled push successfully');
    } catch (error) {
      console.error('[VoIP Push] ❌ Error handling incoming push:', error);
      console.error('[VoIP Push] Coordinator failed, call may not work correctly');
    }
  }

  /**
   * Get current VoIP push token
   */
  getVoipToken(): string | null {
    return this.voipToken;
  }

  /**
   * Check if VoIP push is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && VoipPushNotification !== null;
  }

  /**
   * Cleanup on logout
   */
  cleanup(): void {
    console.log('[VoIP Push] Cleanup');
    this.userId = null;
    this.userType = null;
    this.voipToken = null;
    this.isRegistered = false;

    // Remove event listeners
    if (VoipPushNotification) {
      VoipPushNotification.removeEventListener('register');
      VoipPushNotification.removeEventListener('notification');
    }
  }
}

// Export singleton instance
export default new VoipPushNotificationService();
