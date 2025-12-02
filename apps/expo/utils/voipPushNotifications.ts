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
 * 2. Receive VoIP token → Save to user_devices table (normalized storage)
 * 3. Receive VoIP push → Display full-screen call UI immediately
 * 4. User answers → Join Agora call
 *
 * Token Storage:
 * - Tokens are stored in user_devices table (not profiles.voip_push_token)
 * - Supports multiple devices per user
 * - Distinguishes VoIP vs standard tokens
 * - Tracks sandbox vs production environment
 */

import { Platform, NativeEventEmitter } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { callCoordinator, type VoipPushData } from '~/services/calling/CallCoordinator';

// iOS only - react-native-voip-push-notification
let VoipPushNotification: typeof import('react-native-voip-push-notification').default | null = null;

// Only import on iOS
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    VoipPushNotification = require('react-native-voip-push-notification').default;
  } catch (error) {
    console.warn('[VoIP Push] react-native-voip-push-notification not available:', error);
  }
}

// Determine APNs environment based on build configuration
function getApnsEnvironment(): 'sandbox' | 'production' {
  // Development builds use sandbox, production builds use production
  const isDev = __DEV__ || Constants.appOwnership === 'expo';
  return isDev ? 'sandbox' : 'production';
}

class VoipPushNotificationService {
  private voipToken: string | null = null;
  private isRegistered: boolean = false;
  private userId: string | null = null;
  private userType: 'admin' | 'porteiro' | 'morador' | null = null;
  private nativeEventEmitter: NativeEventEmitter | null = null;

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

    // Listen for native token invalidation events from VoipCallKitHandler.mm
    // This fires when iOS revokes/rotates the VoIP token
    this.setupNativeInvalidationListener();

    console.log('[VoIP Push] Event listeners registered');
  }

  /**
   * Setup listener for native token invalidation events
   * VoipCallKitHandler.mm posts 'voipPushTokenInvalidated' when iOS invalidates the token
   */
  private setupNativeInvalidationListener(): void {
    try {
      // Listen for native notification from VoipCallKitHandler.mm
      // The native code posts NSNotification which we can observe via NativeEventEmitter
      // Note: This requires the native module to bridge the NSNotification to RN
      // For now, we'll rely on the next registerVoipToken() call to get a fresh token
      // The 'register' event will fire with the new token automatically
      console.log("[VoIP Push] Token invalidation handling: will re-register on next 'register' event");
    } catch (error) {
      console.warn('[VoIP Push] Could not setup invalidation listener:', error);
    }
  }

  /**
   * Handle token invalidation - remove from database and re-register
   */
  private async handleTokenInvalidation(): Promise<void> {
    console.log('[VoIP Push] ⚠️ Token invalidated, cleaning up...');

    if (this.voipToken && this.userId) {
      try {
        // Remove the invalidated token from user_devices
        const { error } = await supabase
          .from('user_devices')
          .delete()
          .eq('device_token', this.voipToken)
          .eq('user_id', this.userId);

        if (error) {
          console.error('[VoIP Push] Failed to remove invalidated token:', error);
        } else {
          console.log('[VoIP Push] ✅ Invalidated token removed from database');
        }
      } catch (error) {
        console.error('[VoIP Push] Error removing invalidated token:', error);
      }
    }

    // Clear local state
    this.voipToken = null;

    // Re-register for a new token
    if (VoipPushNotification && this.userId) {
      console.log('[VoIP Push] 🔄 Re-registering for new token...');
      VoipPushNotification.registerVoipToken();
    }
  }

  /**
   * Save VoIP push token to user_devices table (normalized storage)
   * Supports multiple devices per user
   * Uses register_device_token RPC to handle device token reassignment between users
   */
  private async saveVoipTokenToDatabase(token: string): Promise<void> {
    if (!this.userId || !this.userType) {
      console.warn('[VoIP Push] Cannot save token - user info not set');
      return;
    }

    console.log('[VoIP Push] 💾 Saving token to user_devices...');

    try {
      const environment = getApnsEnvironment();

      // Use RPC function to handle device token reassignment between users
      // This bypasses RLS to allow reassigning tokens from other users on shared devices
      const { error } = await supabase.rpc('register_device_token', {
        p_device_token: token,
        p_platform: 'ios',
        p_token_type: 'voip',
        p_environment: environment,
      });

      if (error) {
        console.error('[VoIP Push] ❌ Failed to save token to user_devices:', error);
        // Fallback: try legacy profiles table for backwards compatibility
        await this.saveVoipTokenToLegacyTable(token);
        return;
      }

      console.log('[VoIP Push] ✅ Token saved to user_devices successfully');
    } catch (error) {
      console.error('[VoIP Push] ❌ Error saving token:', error);
      // Fallback to legacy table
      await this.saveVoipTokenToLegacyTable(token);
    }
  }

  /**
   * Legacy fallback: save to profiles.voip_push_token
   * Used during migration period for backwards compatibility
   */
  private async saveVoipTokenToLegacyTable(token: string): Promise<void> {
    if (!this.userId || !this.userType) {
      return;
    }

    console.log('[VoIP Push] 💾 Fallback: saving to legacy profiles table...');

    try {
      const table = this.userType === 'admin' ? 'admin_profiles' : 'profiles';

      const { error } = await supabase
        .from(table)
        .update({ voip_push_token: token })
        .eq('user_id', this.userId);

      if (error) {
        console.error('[VoIP Push] ❌ Legacy save also failed:', error);
        return;
      }

      console.log('[VoIP Push] ✅ Token saved to legacy table');
    } catch (error) {
      console.error('[VoIP Push] ❌ Legacy save error:', error);
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
        source: 'foreground', // VoIP push from JS (iOS) - CallKit already shown by native handler
        shouldShowNativeUI: false, // iOS CallKit UI already shown natively in AppDelegate
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
