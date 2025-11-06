import { Alert } from 'react-native';
import { CallSession } from './CallSession';
import { agoraService } from '~/services/agora/AgoraService';
import { callKeepService } from '~/services/CallKeepService';
import type { CallParticipantSnapshot } from '@porteiroapp/common/calling';

export interface VoipPushData {
  callId: string;
  from: string;
  callerName?: string;
  apartmentNumber?: string;
  buildingName?: string;
  channelName: string;
  timestamp?: number;
}

type CoordinatorEvent = 'sessionCreated' | 'sessionEnded' | 'error';
type EventHandler = (payload: any) => void;

/**
 * CallCoordinator orchestrates the call flow.
 * Handles VoIP push, RTM warmup, CallKeep integration, and session lifecycle.
 *
 * Based on user decisions:
 * - Warms up RTM BEFORE showing CallKeep UI (3s timeout)
 * - Shows error + retry on RTM failure
 * - Persists sessions for crash recovery
 */
export class CallCoordinator {
  private activeSession: CallSession | null = null;
  private isInitialized: boolean = false;
  private eventHandlers = new Map<CoordinatorEvent, Set<EventHandler>>();

  // RTM warmup timeout (from user decision: 3 seconds)
  private readonly RTM_WARMUP_TIMEOUT = 3000;

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize coordinator - register CallKeep handlers ONCE
   * Call this on app start after user is authenticated
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[CallCoordinator] Already initialized');
      return;
    }

    console.log('[CallCoordinator] Initializing...');

    // Register CallKeep event handlers
    callKeepService.on('answer', this.handleAnswer.bind(this));
    callKeepService.on('end', this.handleEnd.bind(this));
    callKeepService.on('mute', this.handleMute.bind(this));

    // Try to recover any persisted session
    void this.recoverPersistedSession();

    this.isInitialized = true;
    console.log('[CallCoordinator] ✅ Initialized');
  }

  /**
   * Cleanup on logout
   */
  async cleanup(): Promise<void> {
    console.log('[CallCoordinator] Cleanup');

    if (this.activeSession) {
      await this.activeSession.end('drop');
      this.activeSession = null;
    }

    this.isInitialized = false;
  }

  // ========================================
  // Incoming Call Flow (VoIP Push)
  // ========================================

  /**
   * Handle incoming VoIP push notification
   *
   * Flow (based on user decisions):
   * 1. Warm up RTM first (3s timeout)
   * 2. If timeout, show error + retry option
   * 3. Create CallSession
   * 4. Persist session
   * 5. Show CallKeep UI (now RTM is ready for instant answer)
   */
  async handleIncomingPush(data: VoipPushData): Promise<void> {
    console.log('[CallCoordinator] 📞 Incoming push for call:', data.callId);

    // Check if we already have this call
    if (this.activeSession?.id === data.callId) {
      console.log('[CallCoordinator] Call already exists, ignoring');
      return;
    }

    try {
      // Step 1: Warm up RTM (user chose: "warm up first")
      console.log('[CallCoordinator] Step 1: Warming up RTM...');
      const rtmReady = await this.warmupRTM();

      if (!rtmReady) {
        // User chose: "show error + retry"
        console.error('[CallCoordinator] RTM warmup failed');
        this.showRetryDialog(data);
        return;
      }

      console.log('[CallCoordinator] ✅ RTM ready');

      // Step 2: Fetch call details from API
      console.log('[CallCoordinator] Step 2: Fetching call details...');
      const callDetails = await this.fetchCallDetails(data.callId);

      if (!callDetails) {
        console.error('[CallCoordinator] Failed to fetch call details');
        Alert.alert('Call Error', 'Unable to retrieve call information.');
        return;
      }

      // Step 3: Create CallSession
      console.log('[CallCoordinator] Step 3: Creating session...');
      const session = new CallSession({
        id: data.callId,
        callKeepUUID: data.callId, // Use callId as UUID for consistency
        channelName: data.channelName || callDetails.channelName || `call-${data.callId}`,
        participants: callDetails.participants || [],
        isOutgoing: false,
        callerName: data.callerName || callDetails.doormanName || 'Doorman',
        apartmentNumber: data.apartmentNumber || callDetails.apartmentNumber,
        buildingId: callDetails.buildingId,
      });

      await session.initialize();
      this.activeSession = session;

      // Step 4: Persist session (user chose: "yes, persist")
      console.log('[CallCoordinator] Step 4: Persisting session...');
      await session.save();

      // Step 5: Show CallKeep UI
      console.log('[CallCoordinator] Step 5: Displaying CallKeep UI...');
      await callKeepService.displayIncomingCall(
        session.callKeepUUID,
        session.callerName || 'Doorman',
        session.apartmentNumber ? `Apt ${session.apartmentNumber}` : 'Intercom Call',
        false // hasVideo
      );

      console.log('[CallCoordinator] ✅ Call ready for answer');

      this.emit('sessionCreated', { session });

      // Listen to session events
      session.on('stateChanged', ({ newState }) => {
        console.log(`[CallCoordinator] Session state: ${newState}`);

        if (newState === 'ended' || newState === 'declined' || newState === 'failed') {
          this.activeSession = null;
          this.emit('sessionEnded', { session, finalState: newState });
        }
      });

      session.on('error', ({ error, operation }) => {
        console.error(`[CallCoordinator] Session error in ${operation}:`, error);
        this.emit('error', { error, operation, session });
      });

    } catch (error) {
      console.error('[CallCoordinator] ❌ Push handling failed:', error);
      Alert.alert('Call Error', 'Unable to process incoming call.');
      this.emit('error', { error, operation: 'handleIncomingPush' });
    }
  }

  /**
   * Warm up RTM connection with timeout
   * Based on user decisions: 3 second timeout, pre-connect before UI
   */
  private async warmupRTM(): Promise<boolean> {
    console.log('[CallCoordinator] Warming RTM (timeout: 3s)...');

    // Check if already connected
    const currentStatus = agoraService.getStatus();
    if (currentStatus === 'connected') {
      console.log('[CallCoordinator] ✅ RTM already connected');
      return true;
    }

    // Use AgoraService warmup method (will add this next)
    try {
      const ready = await agoraService.warmupRTM({ timeout: this.RTM_WARMUP_TIMEOUT });
      return ready;
    } catch (error) {
      console.error('[CallCoordinator] RTM warmup error:', error);
      return false;
    }
  }

  /**
   * Show retry dialog when RTM fails
   * Based on user decision: "show error + retry"
   */
  private showRetryDialog(data: VoipPushData): void {
    Alert.alert(
      'Connection Error',
      'Unable to connect to the call server. Would you like to retry?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            console.log('[CallCoordinator] User cancelled retry');
            // Optionally decline the call
            void this.declineCall(data.callId, 'connection_failed');
          },
        },
        {
          text: 'Retry',
          onPress: () => {
            console.log('[CallCoordinator] User requested retry');
            void this.handleIncomingPush(data);
          },
        },
      ]
    );
  }

  // ========================================
  // Call Actions (from CallKeep)
  // ========================================

  /**
   * Handle answer action from CallKeep
   * Called when user answers from lock screen or CallKeep UI
   */
  private async handleAnswer(callUUID: string): Promise<void> {
    console.log('[CallCoordinator] 🎯 Answer action for UUID:', callUUID);

    const session = this.activeSession;

    // Case 1: Session exists in memory (happy path)
    if (session && session.callKeepUUID === callUUID) {
      console.log('[CallCoordinator] Session found in memory');

      try {
        await session.answer();
        console.log('[CallCoordinator] ✅ Call answered');
      } catch (error) {
        console.error('[CallCoordinator] ❌ Answer failed:', error);
        Alert.alert('Call Failed', 'Unable to connect to the call.');
      }

      return;
    }

    // Case 2: Session not in memory, try to recover from storage
    console.log('[CallCoordinator] No session in memory, checking storage...');

    const recovered = await CallSession.load();
    if (recovered && recovered.callKeepUUID === callUUID) {
      console.log('[CallCoordinator] ✅ Session recovered from storage');

      // Restore as active session
      this.activeSession = recovered;

      try {
        await recovered.answer();
        console.log('[CallCoordinator] ✅ Recovered call answered');
      } catch (error) {
        console.error('[CallCoordinator] ❌ Recovered answer failed:', error);
        Alert.alert('Call Failed', 'Unable to connect to the call.');
      }

      return;
    }

    // Case 3: No session at all - this shouldn't happen but handle gracefully
    console.error('[CallCoordinator] ❌ No session found for answer');
    Alert.alert(
      'Call Lost',
      'Call information was lost. This may happen after an app restart.',
      [{ text: 'OK' }]
    );

    // End the native call
    await callKeepService.reportEndCall(callUUID, 1);
  }

  /**
   * Handle end action from CallKeep
   * Called when user ends call from CallKeep UI
   */
  private async handleEnd(callUUID: string): Promise<void> {
    console.log('[CallCoordinator] 🎯 End action for UUID:', callUUID);

    const session = this.activeSession;

    if (session && session.callKeepUUID === callUUID) {
      await session.end('hangup');
      this.activeSession = null;
      console.log('[CallCoordinator] ✅ Call ended');
      return;
    }

    // Try to recover and end
    const recovered = await CallSession.load();
    if (recovered && recovered.callKeepUUID === callUUID) {
      await recovered.end('hangup');
      console.log('[CallCoordinator] ✅ Recovered call ended');
    }
  }

  /**
   * Handle mute toggle from CallKeep
   */
  private async handleMute({ muted, callUUID }: { muted: boolean; callUUID: string }): Promise<void> {
    console.log('[CallCoordinator] 🎯 Mute toggle:', muted, 'for UUID:', callUUID);

    try {
      await agoraService.setMuted(muted);
      console.log(`[CallCoordinator] ✅ Audio ${muted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      console.error('[CallCoordinator] ❌ Mute toggle failed:', error);
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Fetch call details from API
   */
  private async fetchCallDetails(callId: string): Promise<{
    channelName: string;
    participants: CallParticipantSnapshot[];
    doormanName?: string | null;
    apartmentNumber?: string | null;
    buildingId?: string | null;
  } | null> {
    try {
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/calls/${callId}/status`);

      if (!response.ok) {
        console.error('[CallCoordinator] API returned:', response.status);
        return null;
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        return null;
      }

      return {
        channelName: result.data.call?.channelName || result.data.call?.channel_name || '',
        participants: result.data.participants || [],
        doormanName: result.data.call?.doormanName || result.data.call?.doorman_name,
        apartmentNumber: result.data.call?.apartmentNumber || result.data.call?.apartment_number,
        buildingId: result.data.call?.buildingId || result.data.call?.building_id,
      };
    } catch (error) {
      console.error('[CallCoordinator] Fetch call details failed:', error);
      return null;
    }
  }

  /**
   * Decline a call (used when retry is cancelled)
   */
  private async declineCall(callId: string, reason: string): Promise<void> {
    try {
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      await fetch(`${apiBaseUrl}/api/calls/${callId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: agoraService['currentUser']?.id || '',
          userType: 'resident',
          reason,
        }),
      });
    } catch (error) {
      console.error('[CallCoordinator] Decline API failed:', error);
    }
  }

  /**
   * Recover persisted session on app start
   */
  private async recoverPersistedSession(): Promise<void> {
    try {
      const session = await CallSession.load();

      if (!session) {
        console.log('[CallCoordinator] No persisted session');
        return;
      }

      console.log('[CallCoordinator] Found persisted session:', session.id);

      // Check if call is still active via API
      const details = await this.fetchCallDetails(session.id);

      if (!details) {
        console.log('[CallCoordinator] Persisted call is no longer active, clearing');
        await session.clear();
        return;
      }

      // Restore session
      this.activeSession = session;
      console.log('[CallCoordinator] ✅ Session recovered');

      this.emit('sessionCreated', { session, recovered: true });
    } catch (error) {
      console.error('[CallCoordinator] Session recovery failed:', error);
    }
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Get current active session
   */
  getActiveSession(): CallSession | null {
    return this.activeSession;
  }

  /**
   * Check if a call is active
   */
  hasActiveCall(): boolean {
    return this.activeSession !== null;
  }

  /**
   * Event emitter
   */
  on(event: CoordinatorEvent, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private emit(event: CoordinatorEvent, payload: any): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[CallCoordinator] Event handler error:`, error);
      }
    });
  }

  /**
   * Get debug info
   */
  getDebugInfo(): Record<string, any> {
    return {
      isInitialized: this.isInitialized,
      hasActiveSession: this.hasActiveCall(),
      activeSession: this.activeSession?.getDebugInfo() || null,
    };
  }
}

// Export singleton instance
export const callCoordinator = new CallCoordinator();
