import { Alert } from 'react-native';
import { CallSession } from './CallSession';
import { agoraService } from '~/services/agora/AgoraService';
import { supabase } from '~/utils/supabase';
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

  // RTM warmup timeout (increased to 6s to handle RTM connection time)
  // RTM can take 1-2 seconds to connect, so we need enough buffer
  private readonly RTM_WARMUP_TIMEOUT = 6000;

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize coordinator
   * Call this on app start after user is authenticated
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[CallCoordinator] Already initialized');
      return;
    }

    console.log('[CallCoordinator] Initializing...');

    // Set up RTM message listener for direct INVITE messages
    this.setupRtmListener();

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

    // Remove RTM listener
    if (this.rtmUnsubscribe) {
      this.rtmUnsubscribe();
      this.rtmUnsubscribe = null;
    }

    this.isInitialized = false;
  }

  // ========================================
  // RTM Message Listener
  // ========================================

  private rtmUnsubscribe: (() => void) | null = null;

  /**
   * Set up RTM message listener to handle INVITE messages
   * This allows calls to be received via RTM when app is open (foreground)
   */
  private setupRtmListener(): void {
    console.log('[CallCoordinator] Setting up RTM message listener');

    this.rtmUnsubscribe = agoraService.on('rtmMessage', ({ message, peerId }) => {
      void this.handleRtmMessage(message, peerId);
    });
  }

  /**
   * Handle incoming RTM message
   */
  private async handleRtmMessage(message: any, peerId: string): Promise<void> {
    try {
      const parsed = JSON.parse(message.text);
      
      // Only handle INVITE messages for moradores
      if (parsed.t !== 'INVITE') {
        return;
      }

      const currentUser = agoraService.getCurrentUser();
      if (currentUser?.userType !== 'morador') {
        return;
      }

      console.log('[CallCoordinator] 📞 RTM INVITE received:', parsed.callId);

      // Check if we already have this call
      if (this.activeSession?.id === parsed.callId) {
        console.log('[CallCoordinator] Call already exists, ignoring duplicate RTM invite');
        return;
      }

      // Auto-decline if already in a call
      if (this.activeSession) {
        console.log('[CallCoordinator] Already in call, auto-declining RTM invite');
        await this.declineCall(parsed.callId, 'busy');
        return;
      }

      // Convert RTM INVITE to push data format and handle it
      const pushData: VoipPushData = {
        callId: parsed.callId,
        from: peerId,
        callerName: parsed.from || 'Doorman',
        apartmentNumber: parsed.apartmentNumber,
        buildingName: parsed.buildingName,
        channelName: parsed.channel || `call-${parsed.callId}`,
        timestamp: Date.now(),
      };

      console.log('[CallCoordinator] Converting RTM INVITE to session creation');
      await this.handleIncomingPush(pushData);
      
    } catch (error) {
      console.error('[CallCoordinator] Error handling RTM message:', error);
    }
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
      console.log('[CallCoordinator] Call already exists, ignoring duplicate push');
      return;
    }

    // Auto-decline if already in a call (one call at a time)
    if (this.activeSession) {
      console.log('[CallCoordinator] Already in call, auto-declining new call');
      await this.declineCall(data.callId, 'busy');
      return;
    }

    try {
      // Step 0: Ensure AgoraService has current user context (needed for RTM warmup)
      console.log('[CallCoordinator] Step 0: Ensuring user context for AgoraService...');
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.user) {
        // Fetch user profile to get morador info
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, user_type')
          .eq('user_id', authSession.user.id)
          .eq('user_type', 'morador')
          .single();
        
        if (profile) {
          agoraService.setCurrentUser({
            id: profile.id,
            userType: 'morador',
            displayName: profile.full_name || authSession.user.email || null,
          });
          console.log('[CallCoordinator] ✅ User context set for AgoraService');
        } else {
          console.warn('[CallCoordinator] ⚠️ No morador profile found for user');
        }
      } else {
        console.warn('[CallCoordinator] ⚠️ No active session found');
      }

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

      console.log('[CallCoordinator] Call details received:', {
        channelName: callDetails.channelName,
        participantCount: callDetails.participants?.length || 0,
        participants: callDetails.participants?.map(p => ({ userId: p.userId, status: p.status })),
      });

      // Step 3: Create CallSession
      console.log('[CallCoordinator] Step 3: Creating session...');
      const session = new CallSession({
        id: data.callId,
        channelName: data.channelName || callDetails.channelName || `call-${data.callId}`,
        participants: callDetails.participants || [],
        isOutgoing: false,
        // Prioritize API data over push data (API has proper names, push may have UUIDs)
        callerName: callDetails.doormanName || data.callerName || 'Porteiro',
        apartmentNumber: callDetails.apartmentNumber || data.apartmentNumber,
        buildingId: callDetails.buildingId,
      });

      await session.initialize();
      this.activeSession = session;

      // Step 4: Persist session (user chose: "yes, persist")
      console.log('[CallCoordinator] Step 4: Persisting session...');
      await session.save();

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
  // Public Call Actions
  // ========================================

  /**
   * Answer the active call
   * Called from UI when user taps answer button
   */
  async answerActiveCall(): Promise<void> {
    if (!this.activeSession) {
      Alert.alert('No active call');
      return;
    }

    console.log('[CallCoordinator] Answering active call');

    try {
      await this.activeSession.answer();
      console.log('[CallCoordinator] ✅ Call answered');
    } catch (error) {
      console.error('[CallCoordinator] ❌ Answer failed:', error);
      Alert.alert('Call Failed', 'Unable to connect to the call.');
    }
  }

  /**
   * End the active call
   * Called from UI when user taps decline or hangup button
   */
  async endActiveCall(reason: 'decline' | 'hangup' = 'hangup'): Promise<void> {
    if (!this.activeSession) return;

    console.log(`[CallCoordinator] Ending active call (${reason})`);

    if (reason === 'decline') {
      await this.activeSession.decline();
    } else {
      await this.activeSession.end(reason);
    }

    this.activeSession = null;
    console.log('[CallCoordinator] ✅ Call ended');
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

      // Map participants to handle snake_case from API
      const participants: CallParticipantSnapshot[] = (result.data.participants || [])
        .map((p: any) => ({
          userId: p.userId || p.user_id,
          status: p.status,
          joinedAt: p.joinedAt || p.joined_at,
          leftAt: p.leftAt || p.left_at,
        }))
        .filter((p: CallParticipantSnapshot) => !!p.userId); // Filter out invalid entries

      return {
        channelName: result.data.call?.channelName || result.data.call?.channel_name || '',
        participants,
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
          userId: agoraService.getCurrentUser()?.id || '',
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
