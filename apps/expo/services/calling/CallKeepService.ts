import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import { EventEmitter } from 'expo-modules-core';

export const EndCallReason = {
  FAILED: "FAILED",
  REMOTE_ENDED: "REMOTE_ENDED",
  DECLINED: "DECLINED",
  BUSY: "BUSY",
} as const;

export type EndCallReason = (typeof EndCallReason)[keyof typeof EndCallReason];

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

    // Allow retry if previous attempt failed
    try {
      const options = {
        ios: {
          appName: 'James Avisa',
        },
        android: {
          alertTitle: 'Permissions required',
          alertDescription: 'This app needs phone account access',
          cancelButton: 'Cancel',
          okButton: 'OK',
          additionalPermissions: [],
          foregroundService: {
            channelId: 'com.porteiroapp.callkeep',
            channelName: 'Incoming Call Service',
            notificationTitle: 'Incoming call',
            notificationIcon: 'ic_notification',
          },
        },
      };

      await RNCallKeep.setup(options);
      this.isSetup = true;
      this.isAvailable = true;
      this.hasAttempted = true;

      // Setup event listeners
      this.setupEventListeners();

      if (__DEV__) {
        console.log('[CallKeepService] ✅ Setup successful');
      }
      return true;
    } catch (error) {
      this.isAvailable = false;
      this.hasAttempted = true;
      // Don't set isSetup=true on failure - allows retry
      if (__DEV__) {
        console.error('[CallKeepService] ❌ Setup failed:', error);
      }
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
      if (__DEV__) {
        console.warn('[CallKeepService] Cannot display call - CallKeep unavailable');
      }
      return;
    }

    try {
      RNCallKeep.displayIncomingCall(callId, handle, callerName, 'generic', hasVideo);
      if (__DEV__) {
        console.log(`[CallKeepService] ✅ Incoming call displayed: ${callId}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[CallKeepService] ❌ Failed to display incoming call:', error);
      }
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
      if (__DEV__) {
        console.log(`[CallKeepService] ✅ Call ended: ${callId}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[CallKeepService] ❌ Failed to end call:', error);
      }
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
      if (__DEV__) {
        console.log(`[CallKeepService] ✅ Reported end call: ${callId}, reason: ${reason}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[CallKeepService] ❌ Failed to report end call:', error);
      }
    }
  }

  /**
   * Set availability flag
   */
  setAvailable(available: boolean): void {
    this.isAvailable = available;
  }

  /**
   * Android only - bring app to foreground
   */
  backToForeground(): void {
    if (Platform.OS === 'android' && this.isAvailable) {
      try {
        RNCallKeep.backToForeground();
        if (__DEV__) {
          console.log('[CallKeepService] ✅ Brought app to foreground');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[CallKeepService] ❌ Failed to bring app to foreground:', error);
        }
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
    // Answer call event (normalize payload: callUUID | callId | uuid | id)
    RNCallKeep.addEventListener('answerCall', (payload: any) => {
      const normalizedId = payload?.callUUID || payload?.callId || payload?.uuid || payload?.id;
      if (__DEV__) {
        console.log('[CallKeepService] Answer call event:', normalizedId);
      }
      if (!normalizedId) {
        if (__DEV__) {
          console.warn('[CallKeepService] Missing call identifier in answerCall payload:', payload);
        }
        return;
      }
      this.eventEmitter.emit('answerCall', { callId: String(normalizedId) });
    });

    // End call event (normalize payload)
    RNCallKeep.addEventListener('endCall', (payload: any) => {
      const normalizedId = payload?.callUUID || payload?.callId || payload?.uuid || payload?.id;
      if (__DEV__) {
        console.log('[CallKeepService] End call event:', normalizedId);
      }
      if (!normalizedId) {
        if (__DEV__) {
          console.warn('[CallKeepService] Missing call identifier in endCall payload:', payload);
        }
        return;
      }
      this.eventEmitter.emit('endCall', { callId: String(normalizedId) });
    });

    // Early events (iOS - when user taps answer before JS loads)
    RNCallKeep.addEventListener('didLoadWithEvents', (events: any[]) => {
      if (__DEV__) {
        console.log('[CallKeepService] Early events loaded:', events.length);
      }
      this.eventEmitter.emit('didLoadWithEvents', events);
    });

    // Audio session activated (iOS)
    RNCallKeep.addEventListener('didActivateAudioSession', () => {
      if (__DEV__) {
        console.log('[CallKeepService] Audio session activated');
      }
      this.eventEmitter.emit('didActivateAudioSession');
    });

    if (__DEV__) {
      console.log('[CallKeepService] Event listeners registered');
    }
  }
}

export const callKeepService = new CallKeepService();
