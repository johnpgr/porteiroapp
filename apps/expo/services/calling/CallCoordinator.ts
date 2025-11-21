import { Alert, Platform } from 'react-native';
import { CallSession } from './CallSession';
import { agoraService } from '~/services/agora/AgoraService';
import { supabase } from '~/utils/supabase';
import type { CallParticipantSnapshot } from '~/types/calling';
import { callKeepService } from './CallKeepService';
import RNCallKeep from 'react-native-callkeep';
import type { CallLifecycleState } from './stateMachine';

export interface VoipPushData {
  callId: string;
  from: string;
  callerName?: string;
  apartmentNumber?: string;
  buildingName?: string;
  channelName: string;
  timestamp?: number;
  source?: 'background' | 'foreground' | 'rtm';
  shouldShowNativeUI?: boolean; // NEW: Explicit flag for whether to show native CallKeep UI
}

type CoordinatorEvent = 'sessionCreated' | 'sessionEnded' | 'error' | 'ready';
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
  private callKeepAvailable: boolean = false;

  // RTM warmup timeout (increased to 6s to handle RTM connection time)
  // RTM can take 1-2 seconds to connect, so we need enough buffer
  private readonly RTM_WARMUP_TIMEOUT = 6000;

  // Poller to detect remote hangup when no RTM END is received
  private remoteHangupPoll: ReturnType<typeof setInterval> | null = null;
  private remoteEndInProgress: boolean = false;

  // Track in-progress handleIncomingPush calls to prevent duplicates
  private incomingPushPromises = new Map<string, Promise<void>>();

  private clearRemoteHangupPoll() {
    if (this.remoteHangupPoll) {
      clearInterval(this.remoteHangupPoll);
      this.remoteHangupPoll = null;
    }
  }

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize coordinator
   * Call this on app start after user is authenticated
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[CallCoordinator] Already initialized');
      return;
    }

    console.log('[CallCoordinator] Initializing...');

    // Initialize CallKeep before setting up listeners
    this.callKeepAvailable = await callKeepService.setup();

    // Subscribe to CallKeep events
    callKeepService.addEventListener('answerCall', ({ callId }: { callId: string }) => {
      void this.handleCallKeepAnswer(callId);
    });

    callKeepService.addEventListener('endCall', ({ callId }: { callId: string }) => {
      void this.handleCallKeepEnd(callId);
    });

    callKeepService.addEventListener('didLoadWithEvents', (events: any[]) => {
      void this.handleEarlyEvents(events);
    });

    callKeepService.addEventListener('didActivateAudioSession', () => {
      console.log('[CallCoordinator] CallKit audio session activated');
      // Audio session ready, Agora already handling audio
    });

    // Set up RTM message listener for direct INVITE messages
    this.setupRtmListener();

    // Try to recover any persisted session
    void this.recoverPersistedSession();

    this.isInitialized = true;
    console.log('[CallCoordinator] ✅ Initialized');
    this.emit('ready', { ready: true });
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
    this.emit('ready', { ready: false });
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

      const type = parsed.t as 'INVITE' | 'END' | 'DECLINE' | 'ANSWER' | string;
      const altTypeRaw = (parsed.type || parsed.action || parsed.event || '')
        .toString()
        .toLowerCase();

      // Handle END/DECLINE signals to close UI when porteiro cancels
      const isEndLike =
        type === 'END' ||
        type === 'DECLINE' ||
        altTypeRaw === 'end' ||
        altTypeRaw === 'ended' ||
        altTypeRaw === 'hangup' ||
        altTypeRaw === 'cancel' ||
        altTypeRaw === 'cancelled' ||
        altTypeRaw === 'intercom_call_end' ||
        altTypeRaw === 'call_end' ||
        altTypeRaw === 'end_call';

      if (isEndLike && this.activeSession) {
        if (this.activeSession.id === parsed.callId) {
          console.log(`[CallCoordinator] RTM ${type} received for active call ${parsed.callId}`);
          try {
            // End CallKeep UI if available
            if (this.callKeepAvailable) {
              callKeepService.endCall(parsed.callId);
            }
            // Use 'drop' to indicate remote-ended when wrapping end()
            await this.activeSession.end('drop');
          } catch (e) {
            console.warn(
              '[CallCoordinator] Failed to end session on remote END, forcing cleanup:',
              e
            );
            this.activeSession = null;
            this.emit('sessionEnded', { session: null, finalState: 'ended' });
          }
        }
        return;
      }

      // Only handle INVITE messages for moradores
      if (type !== 'INVITE') {
        if (parsed.callId && this.activeSession?.id === parsed.callId) {
          console.log('[CallCoordinator] RTM non-INVITE message for active call ignored:', {
            type,
            altTypeRaw,
            callId: parsed.callId,
          });
        }
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

      // Check if there's already an in-progress creation for this call (from push notification)
      const existingPromise = this.incomingPushPromises.get(parsed.callId);
      if (existingPromise) {
        console.log('[CallCoordinator] Session creation already in progress (likely from push), ignoring RTM invite');
        return;
      }

      // Auto-decline if already in a call
      if (this.activeSession) {
        console.log('[CallCoordinator] Already in call, auto-declining RTM invite');
        // 1) Notify backend about decline (busy)
        await this.declineCall(parsed.callId, 'busy');
        // 2) Immediately notify inviter via RTM so their UI stops ringing
        try {
          const declineSignal = {
            t: 'DECLINE' as const,
            callId: parsed.callId,
            from: agoraService.getCurrentUser()?.id || '',
            channel: parsed.channel || parsed.channelName || `call-${parsed.callId}`,
            timestamp: Date.now(),
            reason: 'busy',
          };
          await agoraService.sendPeerMessage([peerId], declineSignal);
          console.log('[CallCoordinator] ✅ Sent RTM DECLINE (busy) to inviter');
        } catch (e) {
          console.warn('[CallCoordinator] ⚠️ Failed to send RTM DECLINE to inviter:', e);
        }
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
        source: 'rtm', // Mark as RTM source (foreground)
        shouldShowNativeUI: true, // RTM invites (foreground) should show CallKeep UI
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
    console.log('[CallCoordinator] 📞 Incoming push for call:', data.callId, 'source:', data.source);

    // Check if we already have this call
    if (this.activeSession?.id === data.callId) {
      console.log('[CallCoordinator] Call already exists, ignoring duplicate push');
      return;
    }

    // Check if there's already an in-progress creation for this call
    const existingPromise = this.incomingPushPromises.get(data.callId);
    if (existingPromise) {
      console.log('[CallCoordinator] Session creation already in progress for callId:', data.callId, '- ignoring duplicate');
      return existingPromise;
    }

    // Auto-decline if already in a call (one call at a time)
    if (this.activeSession) {
      console.log('[CallCoordinator] Already in call, auto-declining new call');
      await this.declineCall(data.callId, 'busy');
      return;
    }

    // Create and store the promise for this call creation
    const promise = this.handleIncomingPushInternal(data);
    this.incomingPushPromises.set(data.callId, promise);

    try {
      await promise;
    } finally {
      this.incomingPushPromises.delete(data.callId);
    }
  }

  /**
   * Internal implementation of handleIncomingPush
   * Separated to allow promise tracking in the public method
   */
  private async handleIncomingPushInternal(data: VoipPushData): Promise<void> {
    try {
      // Step 0: Ensure AgoraService has current user context (needed for RTM warmup)
      console.log('[CallCoordinator] Step 0: Ensuring user context for AgoraService...');
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
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

      // Step 1: Warm up RTM FIRST (user chose: "warm up first")
      // This ensures RTM is ready when user taps answer in CallKeep UI
      console.log('[CallCoordinator] Step 1: Warming up RTM...');
      const rtmReady = await this.warmupRTM();

      if (!rtmReady) {
        console.error('[CallCoordinator] RTM warmup failed');
        
        // In background/headless: decline call and end CallKeep UI (no Alert possible)
        if (data.source === 'background') {
          console.log('[CallCoordinator] Background context - declining call without Alert');
          await this.declineCall(data.callId, 'connection_failed');
          if (this.callKeepAvailable) {
            callKeepService.endCall(data.callId);
          }
          return;
        }
        
        // In foreground: show error + retry dialog
        this.showRetryDialog(data);
        return;
      }

      console.log('[CallCoordinator] ✅ RTM ready');

      // Step 2: Fetch call details from API FIRST (to get proper doorman name)
      console.log('[CallCoordinator] Step 2: Fetching call details...');
      const callDetails = await this.fetchCallDetails(data.callId);

      // Display CallKeep UI AFTER RTM warmup and fetching call details (if not already shown)
      // Note: iOS AppDelegate already shows CallKit UI, Android background task shows ConnectionService UI
      // This is a fallback for cases where native UI wasn't shown (e.g., foreground RTM invite)
      // Use explicit shouldShowNativeUI flag instead of inferring from source
      const shouldShowUI = !!data.shouldShowNativeUI;
      
      if (this.callKeepAvailable && shouldShowUI) {
        // Extra guard: avoid re-showing UI for same call
        if (this.activeSession?.id === data.callId) {
          console.log('[CallCoordinator] Call already active, skipping CallKeep UI');
        } else {
          // Use API doormanName if available (more reliable than push data)
          const displayCallerName = callDetails?.doormanName || data.callerName || 'Porteiro';
          // Use caller name for handle instead of UUID to ensure consistent display
          const displayHandle = displayCallerName !== 'Porteiro' 
            ? displayCallerName 
            : data.apartmentNumber 
              ? `Apt ${data.apartmentNumber}`
              : 'Interfone';
          
          callKeepService.displayIncomingCall(data.callId, displayHandle, displayCallerName);
          if (__DEV__) {
            console.log(
              '[CallCoordinator] ✅ CallKeep incoming call UI displayed (after RTM warmup)',
              { handle: displayHandle, callerName: displayCallerName, showNativeUI: shouldShowUI, source: data.source }
            );
          }
        }
      } else {
        if (__DEV__) {
          console.log(
            '[CallCoordinator] Skipping CallKeep UI',
            { callKeepAvailable: this.callKeepAvailable, shouldShowNativeUI: shouldShowUI, source: data.source }
          );
        }
      }

      if (!callDetails) {
        console.error('[CallCoordinator] Failed to fetch call details');
        Alert.alert('Call Error', 'Unable to retrieve call information.');
        return;
      }

      console.log('[CallCoordinator] Call details received:', {
        channelName: callDetails.channelName,
        doormanName: callDetails.doormanName,
        participantCount: callDetails.participants?.length || 0,
        participants: callDetails.participants?.map((p) => ({
          userId: p.userId,
          status: p.status,
        })),
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

      console.log('[CallCoordinator] ✅ Call ready for answer');

      this.emit('sessionCreated', { session });

      // Listen to session events
      session.on('stateChanged', ({ newState }) => {
        console.log(`[CallCoordinator] Session state: ${newState}`);

        // Only end CallKeep UI if not already ended by endActiveCall
        // This prevents duplicate endCall calls
        if (this.callKeepAvailable && (newState === 'ending' || newState === 'ended' || newState === 'declined' || newState === 'failed')) {
          // Determine reason code based on final state
          const reasonCode = newState === 'declined' ? 2 : newState === 'failed' ? 0 : 1;
          callKeepService.endCall(session.id, reasonCode);
        }

        if (newState === 'ended' || newState === 'declined' || newState === 'failed') {
          this.activeSession = null;
          this.clearRemoteHangupPoll();
          this.remoteEndInProgress = false;
          this.emit('sessionEnded', { session, finalState: newState });
        }
      });

      session.on('error', ({ error, operation }) => {
        console.error(`[CallCoordinator] Session error in ${operation}:`, error);
        this.emit('error', { error, operation, session });
      });

      // Start a short poll to detect remote cancel if RTM END isn't received
      this.startRemoteHangupPoll(session.id);
    } catch (error) {
      console.error('[CallCoordinator] ❌ Push handling failed:', error);
      Alert.alert('Call Error', 'Unable to process incoming call.');
      this.emit('error', { error, operation: 'handleIncomingPush' });
    }
  }

  private startRemoteHangupPoll(callId: string): void {
    // Poll only during ringing state before user answers
    this.clearRemoteHangupPoll();
    let attempts = 0;
    const maxAttempts = 20; // ~40s max

    this.remoteHangupPoll = setInterval(async () => {
      attempts += 1;
      try {
        if (!this.activeSession || this.activeSession.id !== callId) {
          this.clearRemoteHangupPoll();
          return;
        }

        // If user already answered/connected, stop polling
        const state = this.activeSession.state as any;
        if (state === 'connected' || state === 'ending' || state === 'ended') {
          this.clearRemoteHangupPoll();
          return;
        }

        const details = await this.fetchCallDetails(callId);
        // If call no longer exists or backend marks it as ended, close UI
        if (!details || (details as any).status === 'ended' || (details as any).endedAt) {
          console.log('[CallCoordinator] 🔚 Remote hangup detected via polling');
          if (this.remoteEndInProgress) {
            this.clearRemoteHangupPoll();
            return;
          }
          this.remoteEndInProgress = true;
          this.clearRemoteHangupPoll();
          try {
            // End CallKeep UI if available
            if (this.callKeepAvailable && this.activeSession?.id) {
              callKeepService.endCall(this.activeSession.id);
            }
            await this.activeSession.end('drop');
          } catch (e) {
            console.warn('[CallCoordinator] Poll end failed, forcing local cleanup:', e);
            this.activeSession = null;
            this.emit('sessionEnded', { session: null, finalState: 'ended' });
          } finally {
            this.remoteEndInProgress = false;
          }
          return;
        }
      } catch (err) {
        console.warn('[CallCoordinator] Remote hangup poll error:', err);
      }

      if (attempts >= maxAttempts) {
        this.clearRemoteHangupPoll();
      }
    }, 2000);
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

    const session = this.activeSession;
    const callId = this.activeSession.id;
    const sessionState: CallLifecycleState = session.state;

    if (sessionState === 'ending' || sessionState === 'ended' || sessionState === 'declined') {
      console.log('[CallCoordinator] Call already ending/ended, ignoring duplicate end request');
      return;
    }

    // Before leaving channel, end CallKeep if available
    // Use reason code: 2 for DECLINED, 1 for REMOTE_ENDED (hangup)
    if (this.callKeepAvailable) {
      const reasonCode = reason === 'decline' ? 2 : 1; // 2 = DECLINED, 1 = REMOTE_ENDED
      callKeepService.endCall(callId, reasonCode);
    }

    try {
      // If call was already answered/connected, always use end() not decline()
      // decline() is only for declining BEFORE answering
      const isAnswered = sessionState === 'connected' || sessionState === 'connecting' || 
                         sessionState === 'rtc_joining' || sessionState === 'token_fetching' ||
                         sessionState === 'native_answered';
      
      if (reason === 'decline' && !isAnswered) {
        // Only decline if call hasn't been answered yet
        await this.activeSession.decline();
      } else {
        // Use end() for all other cases (hangup, or decline after answering)
        await this.activeSession.end(reason === 'decline' ? 'hangup' : reason);
      }
    } catch (error) {
      console.warn('[CallCoordinator] Error during graceful end:', error);
    } finally {
      if (this.activeSession === session) {
        console.log('[CallCoordinator] Forcing cleanup of active session');
        this.activeSession = null;
        this.emit('sessionEnded', { session: null, finalState: 'ended' });
      }
      console.log('[CallCoordinator] ✅ Call cleaned up');
    }
  }

  /**
   * Fetch call details from API
   */
  private async fetchCallDetails(callId: string): Promise<{
    channelName: string;
    participants: CallParticipantSnapshot[];
    doormanName?: string | null;
    apartmentNumber?: string | null;
    buildingId?: string | null;
    // optional backend fields for end detection
    status?: string | null;
    endedAt?: string | null;
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

      const callObj = result.data.call || {};
      return {
        channelName: callObj.channelName || callObj.channel_name || '',
        participants,
        doormanName: callObj.doormanName || callObj.doorman_name,
        apartmentNumber: callObj.apartmentNumber || callObj.apartment_number,
        buildingId: callObj.buildingId || callObj.building_id,
        status: callObj.status || null,
        endedAt: callObj.endedAt || callObj.ended_at || null,
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
    console.log('[CallCoordinator] No persisted session support (startup fetch handles actives)');
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

    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[CallCoordinator] Event handler error:`, error);
      }
    });
  }

  /**
   * Wait for a session to be created for the given callId
   * Returns the session if found, null if timeout or aborted
   * Uses event listener with timeout promise - no polling needed
   */
  private async waitForSession(callId: string, timeoutMs: number): Promise<CallSession | null> {
    if (this.activeSession?.id === callId) {
      return this.activeSession;
    }

    return Promise.race<CallSession | null>([
      // Event listener promise - resolves when session is created
      new Promise<CallSession | null>((resolve) => {
        let unsubscribe: (() => void) | null = null;

        const cleanup = () => {
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
        };

        unsubscribe = this.on('sessionCreated', ({ session }: { session: CallSession }) => {
          if (session.id === callId) {
            cleanup();
            resolve(session);
          }
        });
      }),

      // Timeout promise - resolves to null after timeout
      new Promise<CallSession | null>((resolve) => {
        setTimeout(() => {
          console.warn(`[CallCoordinator] Timeout waiting for session ${callId}`);
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Ensures a session exists for the given callId
   * Returns true if session is ready, false if all attempts failed
   */
  private async ensureSessionExists(callId: string, sessionWaitTimeout = 10000): Promise<boolean> {
    if (this.activeSession?.id === callId) {
      console.log('[CallCoordinator] Session already exists');
      return true;
    }

    const inProgressPromise = this.incomingPushPromises.get(callId);
    if (inProgressPromise) {
      console.log('[CallCoordinator] Waiting for in-progress session creation');
      try {
        await inProgressPromise;
        if (this.activeSession?.id === callId) {
          console.log('[CallCoordinator] Session created by in-progress operation');
          return true;
        }
      } catch (error) {
        console.error('[CallCoordinator] In-progress creation failed:', error);
      }
    }

    try {
      console.log('[CallCoordinator] Waiting for session creation...');
      const existingSession = await this.waitForSession(callId, sessionWaitTimeout);

      if (existingSession?.id === callId) {
        console.log('[CallCoordinator] Session became available');
        return true;
      }

      console.error('[CallCoordinator] Session not available for CallKeep action');
      return false;
    } catch (error) {
      console.error('[CallCoordinator] Error ensuring session exists:', error);
      return false;
    }
  }

  /**
   * Handle CallKeep answer event
   *
   * CRITICAL: This may fire before the session is created (race condition),
   * so we wait for the coordinator to finish creating it.
   */
  private async handleCallKeepAnswer(callId: string): Promise<void> {
    console.log(`[CallCoordinator] CallKeep answer event: ${callId}`);

    callKeepService.backToForeground();
    callKeepService.setCurrentCall(callId);

    try {
      // Ensure session exists (wait or create)
      const sessionReady = await this.ensureSessionExists(callId);

      if (!sessionReady) {
        console.error('[CallCoordinator] Failed to establish session, cannot answer');
        return;
      }

      // Answer the call
      console.log('[CallCoordinator] Session ready, answering');
      await this.answerActiveCall();
    } catch (error) {
      console.error('[CallCoordinator] CallKeep answer error:', error);
    }
  }

  /**
   * Handle CallKeep end event
   */
  private async handleCallKeepEnd(callId: string): Promise<void> {
    console.log(`[CallCoordinator] CallKeep end event: ${callId}`);

    try {
      await this.endActiveCall('decline');
    } catch (error) {
      console.error('[CallCoordinator] CallKeep end error:', error);
    }
  }

  /**
   * Handle early CallKeep events (iOS - when user taps answer before JS loads)
   */
  private async handleEarlyEvents(events: any[]): Promise<void> {
    console.log('[CallCoordinator] Handling early CallKeep events:', events.length);

    for (const event of events) {
      const data = event?.data || {};
      const normalizedId: string | undefined =
        (data.callUUID || data.callId || data.uuid || data.id) ?? undefined;
      if (event.name === 'RNCallKeepPerformAnswerCallAction' && normalizedId) {
        await this.handleCallKeepAnswer(String(normalizedId));
      } else if (event.name === 'RNCallKeepPerformEndCallAction' && normalizedId) {
        await this.handleCallKeepEnd(String(normalizedId));
      }
    }
  }

  /**
   * Get debug info
   */
  getDebugInfo(): Record<string, any> {
    return {
      isInitialized: this.isInitialized,
      hasActiveSession: this.hasActiveCall(),
      activeSession: this.activeSession?.getDebugInfo() || null,
      callKeepAvailable: this.callKeepAvailable,
    };
  }
}

// Export singleton instance
export const callCoordinator = new CallCoordinator();
