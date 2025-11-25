import { Alert } from 'react-native';
import { CallSession } from './CallSession';
import { agoraService } from '~/services/agora/AgoraService';
import { supabase } from '~/utils/supabase';
import type { CallParticipantSnapshot } from '~/types/calling';
import { callKeepService } from './CallKeepService';
import type { CallLifecycleState } from './stateMachine';
import { InterfoneAPI } from '~/services/api/InterfoneAPI';

export interface VoipPushData {
  callId: string;
  from: string;
  callerName?: string;
  apartmentNumber?: string;
  buildingId?: string;
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

      if (this.isEndLikeMessage(type, altTypeRaw)) {
        await this.handleEndLikeMessage(parsed, type);
        return;
      }

      if (type !== 'INVITE') {
        this.logIgnoredNonInvite(parsed, type, altTypeRaw);
        return;
      }

      const currentUser = agoraService.getCurrentUser();
      if (currentUser?.userType !== 'morador') {
        return;
      }

      console.log('[CallCoordinator] 📞 RTM INVITE received:', parsed.callId);

      if (this.activeSession?.id === parsed.callId) {
        console.log('[CallCoordinator] Call already exists, ignoring duplicate RTM invite');
        return;
      }

      if (this.incomingPushPromises.has(parsed.callId)) {
        console.log(
          '[CallCoordinator] Session creation already in progress (likely from push), ignoring RTM invite'
        );
        return;
      }

      if (this.activeSession) {
        await this.autoDeclineInvite(parsed, peerId);
        return;
      }

      await this.processInvite(parsed, peerId);
    } catch (error) {
      console.error('[CallCoordinator] Error handling RTM message:', error);
    }
  }

  private isEndLikeMessage(type: string, altTypeRaw: string): boolean {
    const endTypes = new Set(['END', 'DECLINE']);
    const endAltTypes = new Set([
      'end',
      'ended',
      'hangup',
      'cancel',
      'cancelled',
      'intercom_call_end',
      'call_end',
      'end_call',
    ]);
    return endTypes.has(type) || endAltTypes.has(altTypeRaw);
  }

  private async handleEndLikeMessage(parsed: any, type: string): Promise<void> {
    if (!this.activeSession || this.activeSession.id !== parsed.callId) {
      return;
    }

    console.log(`[CallCoordinator] RTM ${type} received for active call ${parsed.callId}`);
    try {
      if (this.callKeepAvailable) {
        callKeepService.endCall(parsed.callId);
      }
      await this.activeSession.end('drop');
    } catch (e) {
      console.warn('[CallCoordinator] Failed to end session on remote END, forcing cleanup:', e);
      this.activeSession = null;
      this.emit('sessionEnded', { session: null, finalState: 'ended' });
    }
  }

  private logIgnoredNonInvite(parsed: any, type: string, altTypeRaw: string): void {
    if (parsed.callId && this.activeSession?.id === parsed.callId) {
      console.log('[CallCoordinator] RTM non-INVITE message for active call ignored:', {
        type,
        altTypeRaw,
        callId: parsed.callId,
      });
    }
  }

  private async autoDeclineInvite(parsed: any, peerId: string): Promise<void> {
    console.log('[CallCoordinator] Already in call, auto-declining RTM invite');
    await this.declineCall(parsed.callId, 'busy');

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
  }

  private async processInvite(parsed: any, peerId: string): Promise<void> {
    const pushData: VoipPushData = {
      callId: parsed.callId,
      from: peerId,
      callerName: parsed.from || 'Doorman',
      apartmentNumber: parsed.apartmentNumber,
      buildingName: parsed.buildingName,
      channelName: parsed.channel || `call-${parsed.callId}`,
      timestamp: Date.now(),
      source: 'rtm',
      shouldShowNativeUI: true,
    };

    console.log('[CallCoordinator] Converting RTM INVITE to session creation');
    await this.handleIncomingPush(pushData);
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
    console.log(
      '[CallCoordinator] 📞 Incoming push for call:',
      data.callId,
      'source:',
      data.source
    );

    // Check if we already have this call
    if (this.activeSession?.id === data.callId) {
      console.log('[CallCoordinator] Call already exists, ignoring duplicate push');
      return;
    }

    // Check if there's already an in-progress creation for this call
    const existingPromise = this.incomingPushPromises.get(data.callId);
    if (existingPromise) {
      console.log(
        '[CallCoordinator] Session creation already in progress for callId:',
        data.callId,
        '- ignoring duplicate'
      );
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
   *
   * PERFORMANCE: Heavy work (RTM warmup, API fetch) deferred to answer() to reduce
   * background task load and prevent OS kill on low-end devices
   */
  private async handleIncomingPushInternal(data: VoipPushData): Promise<void> {
    try {
      // Step 0: Ensure AgoraService has current user context (lightweight, needed for session)
      await this.ensureUserContext();

      // Display CallKeep UI IMMEDIATELY (lightweight operation)
      // Heavy work (RTM warmup, API fetch) will happen when user taps ANSWER
      const shouldShowUI = !!data.shouldShowNativeUI;
      if (this.callKeepAvailable && shouldShowUI) {
        this.displayIncomingCallUI(data, null); // No call details yet, use push data
      }

      // Step 1: Create lightweight CallSession (defer heavy work)
      console.log(
        '[CallCoordinator] Creating lightweight session (heavy work deferred to answer)...'
      );
      const session = new CallSession({
        id: data.callId,
        channelName: data.channelName || `call-${data.callId}`,
        participants: [], // Will be fetched on answer
        isOutgoing: false,
        callerName: data.callerName || 'Porteiro',
        apartmentNumber: data.apartmentNumber,
        buildingId: data.buildingId,
      });

      // Initialize session WITHOUT RTM warmup (lightweight)
      await session.initializeLightweight();
      this.activeSession = session;

      console.log('[CallCoordinator] ✅ Lightweight session created, ready for answer');

      this.emit('sessionCreated', { session });

      // Listen to session events
      session.on('stateChanged', ({ newState }) => {
        console.log(`[CallCoordinator] Session state: ${newState}`);

        // Only end CallKeep UI if not already ended by endActiveCall
        // This prevents duplicate endCall calls
        if (
          this.callKeepAvailable &&
          (newState === 'ending' ||
            newState === 'ended' ||
            newState === 'declined' ||
            newState === 'failed')
        ) {
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
    this.clearRemoteHangupPoll();

    if (this.shouldSkipRemoteHangupPoll()) {
      return;
    }

    const maxAttempts = 20; // ~40s max
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      if (this.shouldStopRemoteHangupPoll(callId)) {
        this.clearRemoteHangupPoll();
        return;
      }

      if (await this.tryHandleRemoteHangup(callId)) {
        this.clearRemoteHangupPoll();
        return;
      }

      if (attempts >= maxAttempts) {
        this.clearRemoteHangupPoll();
      }
    };

    this.remoteHangupPoll = setInterval(() => {
      if (this.shouldSkipRemoteHangupPoll()) {
        this.clearRemoteHangupPoll();
        return;
      }

      void poll();
    }, 2000);
  }

  private shouldSkipRemoteHangupPoll(): boolean {
    const rtmStatus = agoraService.getStatus();
    const shouldSkip = rtmStatus === 'connected';

    if (shouldSkip) {
      console.log('[CallCoordinator] ⏭️ Skipping remote hangup poll - RTM connected');
    }

    return shouldSkip;
  }

  private shouldStopRemoteHangupPoll(callId: string): boolean {
    const session = this.activeSession;

    if (!session || session.id !== callId) {
      return true;
    }

    const terminalStates = new Set<CallLifecycleState>([
      'connected',
      'ending',
      'ended',
      'declined',
      'failed',
    ]);
    return terminalStates.has(session.state);
  }

  private async tryHandleRemoteHangup(callId: string): Promise<boolean> {
    try {
      const details = await this.fetchCallDetails(callId);
      const remoteEnded = !details || details.status === 'ended' || Boolean(details.endedAt);

      if (!remoteEnded) {
        return false;
      }

      console.log('[CallCoordinator] 🔚 Remote hangup detected via polling');
      await this.finalizeRemoteHangup(callId);
      return true;
    } catch (error) {
      console.warn('[CallCoordinator] Remote hangup poll error:', error);
      return false;
    }
  }

  private async finalizeRemoteHangup(callId: string): Promise<void> {
    if (this.remoteEndInProgress) {
      return;
    }

    const session = this.activeSession;
    if (!session || session.id !== callId) {
      return;
    }

    this.remoteEndInProgress = true;
    try {
      if (this.callKeepAvailable) {
        callKeepService.endCall(callId);
      }
      await session.end('drop');
    } catch (error) {
      console.warn('[CallCoordinator] Poll end failed, forcing local cleanup:', error);
      this.activeSession = null;
      this.emit('sessionEnded', { session: null, finalState: 'ended' });
    } finally {
      this.remoteEndInProgress = false;
    }
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
      const isAnswered =
        sessionState === 'connected' ||
        sessionState === 'connecting' ||
        sessionState === 'rtc_joining' ||
        sessionState === 'token_fetching' ||
        sessionState === 'native_answered';

      if (reason === 'decline' && !isAnswered) {
        // Only decline if call hasn't been answered yet
        await this.activeSession.decline();
        return;
      }

      // Use end() for all other cases (hangup, or decline after answering)
      await this.activeSession.end(reason === 'decline' ? 'hangup' : reason);
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
   * PERFORMANCE: Now only used for polling, deferred to answer() in new flow
   */
  private async fetchCallDetails(callId: string): Promise<{
    channelName: string;
    participants: CallParticipantSnapshot[];
    doormanName?: string | null;
    apartmentNumber?: string | null;
    buildingId?: string | null;
    status?: string | null;
    endedAt?: string | null;
  } | null> {
    const fetchStartedAt = Date.now();
    try {
      const details = await InterfoneAPI.getCallDetails(callId);
      console.log(`[CallCoordinator] Call details fetch took ${Date.now() - fetchStartedAt}ms`);
      if (!details) return null;

      // Map back to the expected format if needed, but InterfoneAPI returns almost the same structure
      // InterfoneAPI returns CallDetailsSchema which matches what we need
      return {
        channelName: details.channelName,
        participants: details.participants as CallParticipantSnapshot[],
        doormanName: details.doormanName,
        apartmentNumber: details.apartmentNumber,
        buildingId: details.buildingId,
        status: details.status,
        endedAt: details.endedAt,
      };
    } catch (error) {
      console.log(
        `[CallCoordinator] Call details fetch failed after ${Date.now() - fetchStartedAt}ms`
      );
      console.error('[CallCoordinator] Fetch call details failed:', error);
      return null;
    }
  }

  /**
   * Decline a call (used when retry is cancelled)
   */
  private async declineCall(callId: string, reason: string): Promise<void> {
    try {
      await InterfoneAPI.declineCall(callId, agoraService.getCurrentUser()?.id || '', reason);
    } catch (error) {
      console.error('[CallCoordinator] Decline API failed:', error);
    }
  }

  /**
   * Ensure user context is set for AgoraService
   */
  private async ensureUserContext(): Promise<void> {
    console.log('[CallCoordinator] Step 0: Ensuring user context for AgoraService...');
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();

    if (!authSession?.user) {
      console.warn('[CallCoordinator] ⚠️ No active session found');
      return;
    }

    // Fetch user profile to get morador info
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, user_type')
      .eq('user_id', authSession.user.id)
      .eq('user_type', 'morador')
      .single();

    if (!profile) {
      console.warn('[CallCoordinator] ⚠️ No morador profile found for user');
      return;
    }

    agoraService.setCurrentUser({
      id: profile.id,
      userType: 'morador',
      displayName: profile.full_name || authSession.user.email || null,
    });
    console.log('[CallCoordinator] ✅ User context set for AgoraService');
  }

  /**
   * Display Incoming Call UI via CallKeep
   */
  private displayIncomingCallUI(data: VoipPushData, callDetails: any): void {
    // Extra guard: avoid re-showing UI for same call
    if (this.activeSession?.id === data.callId) {
      console.log('[CallCoordinator] Call already active, skipping CallKeep UI');
      return;
    }

    // Use API doormanName if available (more reliable than push data)
    const displayCallerName = callDetails?.doormanName || data.callerName || 'Porteiro';

    // Use caller name for handle instead of UUID to ensure consistent display
    const displayHandle =
      displayCallerName !== 'Porteiro'
        ? displayCallerName
        : data.apartmentNumber
          ? `Apt ${data.apartmentNumber}`
          : 'Interfone';

    callKeepService.displayIncomingCall(data.callId, displayHandle, displayCallerName);
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
   * PUBLIC: Used by NotificationProvider to handle notification action taps
   */
  async ensureSessionExists(callId: string, sessionWaitTimeout = 10000): Promise<boolean> {
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
        continue;
      }

      if (event.name === 'RNCallKeepPerformEndCallAction' && normalizedId) {
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
