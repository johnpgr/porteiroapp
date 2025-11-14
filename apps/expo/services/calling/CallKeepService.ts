import RNCallKeep from 'react-native-callkeep';
import { PermissionsAndroid, Platform, Linking } from 'react-native';
import type { Permission as AndroidPermission } from 'react-native/Libraries/PermissionsAndroid/PermissionsAndroid';
import { EventEmitter } from 'expo-modules-core';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const EndCallReason = {
  FAILED: 'FAILED',
  REMOTE_ENDED: 'REMOTE_ENDED',
  DECLINED: 'DECLINED',
  BUSY: 'BUSY',
} as const;

// Use distinct type alias name to avoid no-redeclare lint rule
export type EndCallReasonType = (typeof EndCallReason)[keyof typeof EndCallReason];

// Define event map for type-safe EventEmitter
export type CallKeepEventMap = {
  answerCall: (payload: { callId: string }) => void;
  endCall: (payload: { callId: string }) => void;
  didLoadWithEvents: (events: any[]) => void;
  didActivateAudioSession: () => void;
  showIncomingCallUi: (payload: { callId: string; handle: string; name?: string }) => void;
  silenceIncomingCall: (payload: { callId: string; handle: string; name?: string }) => void;
  createIncomingConnectionFailed: (payload: { callId: string; handle: string; name?: string }) => void;
  onHasActiveCall: () => void;
};

class CallKeepService {
  private isAvailable: boolean = false;
  private eventEmitter = new EventEmitter<CallKeepEventMap>();
  private hasAttempted: boolean = false;
  private isSetup: boolean = false;

  /**
   * Setup CallKeep with platform-specific options
   * Returns true if successful, false if unavailable
   * Can be retried if previous attempt failed (e.g., after permissions change)
   */
  async setup(): Promise<boolean> {
    // If already successfully setup, return cached result
    if (this.isSetup && this.isAvailable) {
      return true;
    }

    // Skip setup on emulators - phone account registration crashes
    if (!Device.isDevice) {
      this.isAvailable = false;
      this.hasAttempted = true;
      console.log('[CallKeepService] ⚠️ Skipping setup on emulator - CallKeep unavailable');
      return false;
    }

    // Android requires READ_PHONE permissions for self-managed ConnectionService
    if (Platform.OS === 'android') {
      const telecomPermissionsGranted = await this.ensureTelecomPermissions();
      if (!telecomPermissionsGranted) {
        this.isAvailable = false;
        this.hasAttempted = true;
        console.warn('[CallKeepService] ⚠️ Missing telecom permissions - using custom call UI instead');
        return false;
      }
    }

    // Allow retry if previous attempt failed
    try {
      const options = {
        ios: {
          appName: 'James Avisa',
        },
        android: {
          alertTitle: 'Permissões necessárias',
          alertDescription: 'Este app precisa de acesso à conta telefônica',
          cancelButton: 'Cancelar',
          okButton: 'OK',
          additionalPermissions: [],
          selfManaged: true,
          foregroundService: {
            channelId: 'com.porteiroapp.callkeep',
            channelName: 'Serviço de Chamadas',
            notificationTitle: 'Chamada recebida',
            notificationIcon: 'ic_notification',
          },
        },
      };

      await RNCallKeep.setup(options);

      if (Platform.OS === 'android') {
        try {
          RNCallKeep.registerPhoneAccount(options);
          RNCallKeep.registerAndroidEvents();
        } catch (registerError) {
          console.warn('[CallKeepService] ⚠️ Failed to register Android phone account/events', registerError);
        }
      }

      this.setAvailable(true);
      this.isSetup = true;
      this.hasAttempted = true;

      // Setup event listeners
      this.setupEventListeners();

      console.log('[CallKeepService] ✅ Setup successful');
      return true;
    } catch (error) {
      this.isAvailable = false;
      this.hasAttempted = true;
      // Don't set isSetup=true on failure - allows retry
      console.error('[CallKeepService] ❌ Setup failed:', error);
      return false;
    }
  }

  private async ensureTelecomPermissions(): Promise<boolean> {
    const requiredPermissions: AndroidPermission[] = [];
    if (PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE) {
      requiredPermissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    }
    if (PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS) {
      requiredPermissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
    }

    if (requiredPermissions.length === 0) {
      return true;
    }

    const missingPermissions: AndroidPermission[] = [];
    for (const permission of requiredPermissions) {
      const granted = await PermissionsAndroid.check(permission);
      if (!granted) {
        missingPermissions.push(permission);
      }
    }

    if (missingPermissions.length === 0) {
      console.log('[CallKeepService] ✅ All telecom permissions already granted');
      return true;
    }

    console.log('[CallKeepService] 📋 Requesting telecom permissions:', missingPermissions.join(', '));
    console.log('[CallKeepService] ⚠️  MIUI users: You may see multiple permission dialogs - accept ALL of them');

    const results = await PermissionsAndroid.requestMultiple(missingPermissions);

    // Log detailed results for debugging
    console.log('[CallKeepService] Permission results:', results);

    const denied = missingPermissions.filter(
      (permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED
    );

    const neverAskAgain = missingPermissions.filter(
      (permission) => results[permission] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    );

    if (denied.length > 0) {
      console.warn('[CallKeepService] ❌ Telecom permissions denied:', denied.join(', '));

      // Check if this is MIUI/Xiaomi where permissions often need manual granting
      const isMIUI = Device.manufacturer?.toLowerCase().includes('xiaomi') ||
                     Device.brand?.toLowerCase().includes('xiaomi') ||
                     Device.brand?.toLowerCase().includes('redmi');

      if (neverAskAgain.length > 0) {
        console.warn(
          '[CallKeepService] 🚫 Permission permanently denied (NEVER_ASK_AGAIN)\n' +
          '   Affected permissions:', neverAskAgain.join(', ')
        );
      }

      const instructions = isMIUI
        ? '[CallKeepService] 🔧 MIUI/Xiaomi device detected\n' +
          '   READ_PHONE_STATE permission requires manual granting in Settings.\n' +
          '\n' +
          '   📱 TO FIX:\n' +
          '   1. Open Settings → Apps → James Avisa → Permissions\n' +
          '   2. Find and enable "Phone" permission\n' +
          '   3. Force stop and reopen the app\n' +
          '\n' +
          '   ℹ️  App works normally without this - will use custom call UI instead.'
        : '[CallKeepService] ℹ️  Telecom permissions not granted\n' +
          '   App will use custom call UI instead of native Android call screen.\n' +
          '\n' +
          '   📱 TO ENABLE NATIVE UI:\n' +
          '   Settings → Apps → James Avisa → Permissions → Enable "Phone"';

      console.warn(instructions);

      // Store this state so we can show an in-app alert/banner later
      AsyncStorage.setItem('@callkeep_permission_denied', 'true').catch(() => {});

      return false;
    }

    console.log('[CallKeepService] ✅ Telecom permissions granted');

    // Clear any previous denial flag
    await AsyncStorage.removeItem('@callkeep_permission_denied').catch(() => {});

    return true;
  }

  /**
   * Force retry setup (useful after permissions change)
   */
  async retrySetup(): Promise<boolean> {
    this.hasAttempted = false;
    this.isSetup = false;
    this.isAvailable = false;
    return this.setup();
  }

  /**
   * Open app settings to manually grant permissions (Android only)
   */
  openAppSettings(): void {
    if (Platform.OS === 'android') {
      Linking.openSettings().catch((err) => {
        console.error('[CallKeepService] Failed to open settings:', err);
      });
    }
  }

  /**
   * Check if CallKeep permission was previously denied
   * Useful for showing in-app guidance to users
   */
  async wasPermissionDenied(): Promise<boolean> {
    try {
      const denied = await AsyncStorage.getItem('@callkeep_permission_denied');
      return denied === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Clear the permission denied flag (call after user grants permission in Settings)
   */
  async clearPermissionDeniedFlag(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@callkeep_permission_denied');
    } catch {}
  }

  /**
   * Display incoming call UI
   */
  displayIncomingCall(
    callId: string,
    handle: string,
    callerName: string,
    hasVideo: boolean = false
  ): void {
    if (!this.isAvailable) {
      console.warn('[CallKeepService] Cannot display call - CallKeep unavailable');
      return;
    }

    try {
      RNCallKeep.displayIncomingCall(callId, handle, callerName, 'generic', hasVideo);
      console.log(`[CallKeepService] ✅ Incoming call displayed: ${callId}`);
    } catch (error) {
      console.error('[CallKeepService] ❌ Failed to display incoming call:', error);
    }
  }

  /**
   * End call and dismiss native UI
   */
  endCall(callId: string): void {
    if (!this.isAvailable) {
      return;
    }

    try {
      RNCallKeep.endCall(callId);
      console.log(`[CallKeepService] ✅ Call ended: ${callId}`);
    } catch (error) {
      console.error('[CallKeepService] ❌ Failed to end call:', error);
    }
  }

  /**
   * Report call failure to OS
   */
  reportEndCallWithUUID(callId: string, reason: number): void {
    if (!this.isAvailable) {
      return;
    }

    try {
      RNCallKeep.reportEndCallWithUUID(callId, reason);
      console.log(`[CallKeepService] ✅ Reported end call: ${callId}, reason: ${reason}`);
    } catch (error) {
      console.error('[CallKeepService] ❌ Failed to report end call:', error);
    }
  }

  /**
   * Set availability flag
   */
  setAvailable(available: boolean): void {
    this.isAvailable = available;
    if (Platform.OS === 'android') {
      RNCallKeep.setAvailable(available);
    }
  }

  /**
   * Android only - bring app to foreground
   */
  backToForeground(): void {
    if (Platform.OS === 'android' && this.isAvailable) {
      try {
        RNCallKeep.backToForeground();
        console.log('[CallKeepService] ✅ Brought app to foreground');
      } catch (error) {
        console.error('[CallKeepService] ❌ Failed to bring app to foreground:', error);
      }
    }
  }

  setCurrentCall(callId: string): void {
    try {
      RNCallKeep.setCurrentCallActive(callId);
    } catch (error) {
      console.error('[CallKeep] Failed to set call active:', error);
    }
  }

  /**
   * Subscribe to CallKeep events
   */
  addEventListener<EventName extends keyof CallKeepEventMap>(
    event: EventName,
    handler: CallKeepEventMap[EventName]
  ): () => void {
    const subscription = this.eventEmitter.addListener(event, handler);
    return () => {
      subscription.remove();
    };
  }

  /**
   * Check if CallKeep is initialized and available
   */
  checkAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Setup RNCallKeep event listeners and forward through EventEmitter
   */
  private setupEventListeners(): void {
    // Answer call event (normalize payload: callUUID | callId | uuid | id)
    RNCallKeep.addEventListener('answerCall', (payload: any) => {
      const normalizedId = this.normalizeCallId(payload);
      console.log('[CallKeepService] Answer call event:', normalizedId);
      if (!normalizedId) {
        console.warn('[CallKeepService] Missing call identifier in answerCall payload:', payload);
        return;
      }
      // Persist pending answer so coordinator can consume after initialization
      // This is critical for cold start / background accept actions
      AsyncStorage.setItem('@pending_callkeep_answer_call_id', String(normalizedId)).catch(
        () => {}
      );
      this.eventEmitter.emit('answerCall', { callId: String(normalizedId) });
    });

    // End call event (normalize payload)
    RNCallKeep.addEventListener('endCall', (payload: any) => {
      const normalizedId = this.normalizeCallId(payload);
      console.log('[CallKeepService] End call event:', normalizedId);
      if (!normalizedId) {
        console.warn('[CallKeepService] Missing call identifier in endCall payload:', payload);
        return;
      }
      // Persist pending end so coordinator can consume if not ready yet
      AsyncStorage.setItem('@pending_callkeep_end_call_id', String(normalizedId)).catch(() => {});
      this.eventEmitter.emit('endCall', { callId: String(normalizedId) });
    });

    // Early events (iOS - when user taps answer before JS loads)
    RNCallKeep.addEventListener('didLoadWithEvents', (events: any[]) => {
      console.log('[CallKeepService] Early events loaded:', events.length);
      this.eventEmitter.emit('didLoadWithEvents', events);
    });

    // Audio session activated (iOS)
    RNCallKeep.addEventListener('didActivateAudioSession', () => {
      console.log('[CallKeepService] Audio session activated');
      this.eventEmitter.emit('didActivateAudioSession');
    });

    if (Platform.OS === 'android') {
      RNCallKeep.addEventListener('showIncomingCallUi', (payload: any) => {
        const normalizedId = this.normalizeCallId(payload);
        if (!normalizedId) return;
        this.eventEmitter.emit('showIncomingCallUi', {
          callId: normalizedId,
          handle: payload?.handle ?? '',
          name: payload?.name,
        });
      });

      RNCallKeep.addEventListener('silenceIncomingCall', (payload: any) => {
        const normalizedId = this.normalizeCallId(payload);
        if (!normalizedId) return;
        this.eventEmitter.emit('silenceIncomingCall', {
          callId: normalizedId,
          handle: payload?.handle ?? '',
          name: payload?.name,
        });
      });

      RNCallKeep.addEventListener('createIncomingConnectionFailed', (payload: any) => {
        const normalizedId = this.normalizeCallId(payload);
        if (!normalizedId) return;
        this.eventEmitter.emit('createIncomingConnectionFailed', {
          callId: normalizedId,
          handle: payload?.handle ?? '',
          name: payload?.name,
        });
      });

      RNCallKeep.addEventListener('onHasActiveCall', () => {
        this.eventEmitter.emit('onHasActiveCall');
      });
    }

    console.log('[CallKeepService] Event listeners registered');
  }

  private normalizeCallId(payload: any): string | null {
    const id = payload?.callUUID || payload?.callId || payload?.uuid || payload?.id;
    return id ? String(id) : null;
  }
}

export const callKeepService = new CallKeepService();

/**
 * Helper functions to consume pending CallKeep actions that occurred before
 * the CallCoordinator was initialized. These are used during initialization
 * to bridge early accept/decline actions taken from native UI while JS was cold.
 */
export async function consumePendingCallKeepAnswer(): Promise<string | null> {
  try {
    const callId = await AsyncStorage.getItem('@pending_callkeep_answer_call_id');
    if (callId) {
      await AsyncStorage.removeItem('@pending_callkeep_answer_call_id').catch(() => {});
      console.log('[CallKeepService] Consumed pending answer for callId:', callId);
      return callId;
    }
  } catch (e) {
    console.warn('[CallKeepService] Failed to consume pending answer:', e);
  }
  return null;
}

export async function consumePendingCallKeepEnd(): Promise<string | null> {
  try {
    const callId = await AsyncStorage.getItem('@pending_callkeep_end_call_id');
    if (callId) {
      await AsyncStorage.removeItem('@pending_callkeep_end_call_id').catch(() => {});
      console.log('[CallKeepService] Consumed pending end for callId:', callId);
      return callId;
    }
  } catch (e) {
    console.warn('[CallKeepService] Failed to consume pending end:', e);
  }
  return null;
}
