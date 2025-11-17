import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import { EventEmitter } from 'expo-modules-core';
import * as Device from 'expo-device';

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
};

class CallKeepService {
  private isAvailable: boolean = false;
  private eventEmitter = new EventEmitter<CallKeepEventMap>();
  private hasAttempted: boolean = false;
  private isSetup: boolean = false;
  // iOS: Map CallKit UUID to canonical callId
  private uuidToCallId = new Map<string, string>();
  // Track ended calls to prevent duplicate endCall calls
  private endedCalls = new Set<string>();

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
          foregroundService: {
            channelId: 'com.porteiroapp.callkeep',
            channelName: 'Serviço de Chamadas',
            notificationTitle: 'Chamada recebida',
            notificationIcon: 'ic_notification',
          },
        },
      };

      await RNCallKeep.setup(options);

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
  endCall(callId: string, reason?: number): void {
    if (!this.isAvailable) {
      return;
    }

    // Prevent duplicate endCall calls
    if (this.endedCalls.has(callId)) {
      console.log(`[CallKeepService] Call ${callId} already ended, skipping duplicate endCall`);
      return;
    }

    try {
      // Mark as ended immediately to prevent duplicates
      this.endedCalls.add(callId);

      // On Android, use reportEndCallWithUUID with reason code if provided
      // This ensures the native UI properly clears the "in-call" state
      if (Platform.OS === 'android') {
        // Use reason code 1 (REMOTE_ENDED) if not specified
        const endReason = reason ?? 1;
        RNCallKeep.reportEndCallWithUUID(callId, endReason);
        console.log(`[CallKeepService] ✅ Reported end call (Android): ${callId}, reason: ${endReason}`);
      }

      // Always call endCall to dismiss the UI
      RNCallKeep.endCall(callId);
      console.log(`[CallKeepService] ✅ Call ended: ${callId}`);

      // On Android, clear the current call state to ensure native UI releases "in-call" state
      if (Platform.OS === 'android') {
        this.clearCurrentCall();
      }
      
      // iOS: Clean up UUID mapping if this was the mapped UUID
      if (Platform.OS === 'ios') {
        // Check if callId is actually a UUID that was mapped
        for (const [uuid, mappedCallId] of this.uuidToCallId.entries()) {
          if (mappedCallId === callId || uuid === callId) {
            this.uuidToCallId.delete(uuid);
            console.log(`[CallKeepService] Cleared UUID mapping: ${uuid} → ${mappedCallId}`);
          }
        }
      }

      // Clean up ended call tracking after a delay (prevent memory leak)
      setTimeout(() => {
        this.endedCalls.delete(callId);
      }, 5000);
    } catch (error) {
      console.error('[CallKeepService] ❌ Failed to end call:', error);
      // Remove from ended set on error so we can retry
      this.endedCalls.delete(callId);
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
        for (var i = 0; i < 10; i++) {
          RNCallKeep.backToForeground();
        }
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
   * Clear current call state (Android)
   * This ensures the native UI properly releases the "in-call" state
   */
  clearCurrentCall(): void {
    if (Platform.OS === 'android' && this.isAvailable) {
      try {
        // On Android, temporarily set available to false then back to true
        // This forces ConnectionService to release the active call state
        RNCallKeep.setAvailable(false);
        setTimeout(() => {
          RNCallKeep.setAvailable(true);
        }, 100);
        console.log('[CallKeepService] ✅ Cleared current call state (Android)');
      } catch (error) {
        console.error('[CallKeepService] ❌ Failed to clear current call:', error);
      }
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
    // iOS: Listen for didDisplayIncomingCall to map callUUID ↔ callId
    if (Platform.OS === 'ios') {
      RNCallKeep.addEventListener('didDisplayIncomingCall', (event: any) => {
        // Extract UUID from event (could be callUUID or uuid)
        const callUUID = event?.callUUID || event?.uuid;
        
        // Extract callId from payload (could be nested in payload.payload or at payload level)
        const callId = event?.payload?.callId || event?.payload?.payload?.callId || event?.callId;
        
        if (callUUID && callId) {
          this.uuidToCallId.set(callUUID, callId);
          console.log(`[CallKeepService] Mapped CallKit UUID ${callUUID} → callId ${callId}`);
        } else {
          console.warn('[CallKeepService] Missing UUID or callId in didDisplayIncomingCall:', {
            callUUID,
            callId,
            event,
          });
        }
      });
    }

    // Answer call event (normalize payload: callUUID | callId | uuid | id)
    RNCallKeep.addEventListener('answerCall', (payload: any) => {
      const normalizedId = this.normalizeCallId(payload);
      console.log('[CallKeepService] Answer call event:', normalizedId);
      if (!normalizedId) {
        console.warn('[CallKeepService] Missing call identifier in answerCall payload:', payload);
        return;
      }
      this.eventEmitter.emit('answerCall', { callId: normalizedId });
    });

    // End call event (normalize payload)
    RNCallKeep.addEventListener('endCall', (payload: any) => {
      const normalizedId = this.normalizeCallId(payload);
      console.log('[CallKeepService] End call event:', normalizedId);
      if (!normalizedId) {
        console.warn('[CallKeepService] Missing call identifier in endCall payload:', payload);
        return;
      }
      this.eventEmitter.emit('endCall', { callId: normalizedId });
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

    console.log('[CallKeepService] Event listeners registered');
  }

  /**
   * Normalize call identifier from CallKeep payload
   * iOS: Maps CallKit UUID to canonical callId if available
   * Android: Uses callId directly
   */
  private normalizeCallId(payload: any): string | null {
    if (!payload) {
      return null;
    }

    // iOS: Check UUID mapping first
    if (Platform.OS === 'ios') {
      const callUUID = payload?.callUUID || payload?.uuid;
      if (callUUID && this.uuidToCallId.has(callUUID)) {
        const mappedCallId = this.uuidToCallId.get(callUUID);
        console.log(`[CallKeepService] Using mapped callId for UUID ${callUUID}: ${mappedCallId}`);
        return mappedCallId || null;
      }
    }

    // Fallback: try payload.callId, then callUUID/uuid/id
    const callId = payload?.callId || payload?.callUUID || payload?.uuid || payload?.id;
    return callId ? String(callId) : null;
  }

  /**
   * Clear UUID mapping (e.g., when call ends)
   */
  clearUuidMapping(callUUID: string): void {
    this.uuidToCallId.delete(callUUID);
  }
}

export const callKeepService = new CallKeepService();
