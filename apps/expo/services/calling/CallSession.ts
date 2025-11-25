import { Audio } from 'expo-av';
import { agoraService } from '~/services/agora/AgoraService';
import type { CallParticipantSnapshot, AgoraTokenBundle } from '~/types/calling';
import { CALL_STATE_MACHINE, type CallLifecycleState } from './stateMachine';
import { supabase } from '~/utils/supabase';
import { InterfoneAPI } from '~/services/api/InterfoneAPI';


interface CallSessionOptions {
  id: string;
  channelName: string;
  participants: CallParticipantSnapshot[];
  isOutgoing: boolean;
  callerName?: string | null;
  apartmentNumber?: string | null;
  buildingId?: string | null;
}

type SessionEvent = 'stateChanged' | 'error' | 'nativeSyncRequired';
type EventHandler = (payload: any) => void;

/**
 * CallSession represents a single call with all its state and operations.
 * Like Wazo's callSession, this is the single source of truth for a call.
 */
export class CallSession {
  // Identity
  readonly id: string;
  readonly channelName: string;
  readonly initiatedAt: number;

  // Participants
  readonly participants: CallParticipantSnapshot[];
  readonly isOutgoing: boolean;
  readonly callerName: string | null;
  readonly apartmentNumber: string | null;
  readonly buildingId: string | null;

  // State
  private _state: CallLifecycleState = 'idle';

  // Connection status
  private _rtmReady: boolean = false;
  private _rtcJoined: boolean = false;
  private _localBundle: AgoraTokenBundle | null = null;

  // Event emitter
  private eventHandlers = new Map<SessionEvent, Set<EventHandler>>();

  // RTC event subscriptions
  private rtcUnsubscribers: (() => void)[] = [];

  constructor(options: CallSessionOptions) {
    this.id = options.id;
    this.channelName = options.channelName;
    this.participants = options.participants;
    this.isOutgoing = options.isOutgoing;
    this.callerName = options.callerName || null;
    this.apartmentNumber = options.apartmentNumber || null;
    this.buildingId = options.buildingId || null;
    this.initiatedAt = Date.now();

    console.log(`[CallSession] Created session ${this.id}`);
  }

  // ========================================
  // State Management
  // ========================================

  get state(): CallLifecycleState {
    return this._state;
  }

  get rtmReady(): boolean {
    return this._rtmReady;
  }

  get rtcJoined(): boolean {
    return this._rtcJoined;
  }

  get canAnswer(): boolean {
    return this._state === 'rtm_ready' || this._state === 'ringing';
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  private setState(newState: CallLifecycleState): void {
    const allowedTransitions = CALL_STATE_MACHINE[this._state] || [];

    if (!allowedTransitions.includes(newState) && newState !== this._state) {
      console.warn(`[CallSession] Invalid transition: ${this._state} → ${newState}`);
      return;
    }

    const oldState = this._state;
    this._state = newState;

    console.log(`[CallSession] State: ${oldState} → ${newState}`);

    this.emit('stateChanged', { oldState, newState });
  }

  /**
   * Setup RTC event listeners to track call state
   */
  private setupRtcEventListeners(): void {
    console.log(`[CallSession] Setting up RTC event listeners`);

    // Listen for remote user joining the channel
    const unsubUserJoined = agoraService.on('rtcUserJoined', ({ remoteUid }) => {
      console.log(`[CallSession] Remote user joined: ${remoteUid}`);

      // Transition from connecting → connected when first user joins
      if (this._state === 'connecting') {
        this.setState('connected');
      }
    });

    // Listen for remote user leaving the channel
    const unsubUserOffline = agoraService.on('rtcUserOffline', ({ remoteUid, reason }) => {
      console.log(`[CallSession] Remote user offline: ${remoteUid}, reason: ${reason}`);

      // If we're connected and other party leaves, end the call
      if (this._state === 'connected') {
        console.log(`[CallSession] Other party left, ending call`);
        void this.end('drop');
      }
    });

    // Listen for RTC errors
    const unsubRtcError = agoraService.on('rtcError', ({ code, message }) => {
      console.error(`[CallSession] RTC error: ${code} - ${message}`);
      this.setState('failed');
      this.emit('error', { error: new Error(`RTC error: ${code}`), operation: 'rtc' });
    });

    // Store unsubscribers for cleanup
    this.rtcUnsubscribers.push(unsubUserJoined, unsubUserOffline, unsubRtcError);
  }

  /**
   * Cleanup RTC event listeners
   */
  private cleanupRtcEventListeners(): void {
    console.log(`[CallSession] Cleaning up RTC event listeners`);
    this.rtcUnsubscribers.forEach((unsub) => unsub());
    this.rtcUnsubscribers = [];
  }

  // ========================================
  // Lifecycle Operations
  // ========================================

  /**
   * Initialize session - verify RTM connection is ready
   * DEPRECATED: Use initializeLightweight() for deferred heavy work approach
   */
  async initialize(): Promise<void> {
    console.log(`[CallSession] Initializing...`);

    this.setState('rtm_warming');

    // Verify RTM is connected (should be from warmup)
    const rtmStatus = agoraService.getStatus();
    if (rtmStatus !== 'connected') {
      console.error('[CallSession] RTM not connected during init');
      this.setState('failed');
      throw new Error('RTM connection not ready');
    }

    this._rtmReady = true;
    this.setState('rtm_ready');

    // Subscribe to RTC events for call state management
    this.setupRtcEventListeners();

    console.log(`[CallSession] ✅ Initialized`);
  }

  /**
   * Lightweight initialization - defers RTM warmup to answer()
   * Used for incoming calls to reduce background task load
   */
  async initializeLightweight(): Promise<void> {
    console.log(`[CallSession] Lightweight initialization (defer heavy work to answer)...`);

    // Set initial state (ready to ring, heavy work deferred)
    this.setState('ringing');

    // Subscribe to RTC events for call state management
    this.setupRtcEventListeners();

    console.log(`[CallSession] ✅ Lightweight init complete (RTM warmup deferred)`);
  }

  /**
   * Answer incoming call - joins Agora channel
   * PERFORMANCE: Heavy work (RTM warmup, API fetch) happens HERE instead of during ringing
   */
  async answer(): Promise<void> {
    console.log(`[CallSession] Answering call ${this.id}...`);

    const answerInProgressStates: CallLifecycleState[] = [
      'native_answered',
      'rtm_warming',
      'token_fetching',
      'rtc_joining',
      'connecting',
      'connected',
    ];

    // Make answer idempotent when multiple CallKeep events fire
    if (answerInProgressStates.includes(this._state)) {
      console.log(`[CallSession] Answer already in progress (${this._state}), ignoring duplicate`);
      return;
    }

    if (!this.canAnswer) {
      throw new Error(`Cannot answer in state: ${this._state}`);
    }

    try {
      this.setState('native_answered');

      // STEP 1: Warm up RTM if not already connected (deferred from init)
      const warmupStartedAt = Date.now();
      console.log(`[CallSession] Warming up RTM...`);
      this.setState('rtm_warming');

      const rtmStatus = agoraService.getStatus();
      if (rtmStatus !== 'connected') {
        // RTM not ready yet, warm it up now
        const warmupSuccess = await agoraService.warmupRTM({ timeout: 6000 });
        if (!warmupSuccess) {
          console.error('[CallSession] RTM warmup failed during answer');
          this.setState('failed');
          throw new Error('RTM connection failed');
        }
      }

      this._rtmReady = true;
      console.log(
        `[CallSession] ✅ RTM ready (warmup ${Date.now() - warmupStartedAt}ms)`
      );

      // STEP 2: Fetch call details from API (deferred from init)
      const detailsFetchStartedAt = Date.now();
      console.log(`[CallSession] Fetching call details from API...`);
      const callDetails = await InterfoneAPI.getCallDetails(this.id);
      console.log(
        `[CallSession] ✅ Call details fetch took ${Date.now() - detailsFetchStartedAt}ms`
      );

      if (callDetails) {
        console.log(`[CallSession] ✅ Call details received:`, {
          channelName: callDetails.channelName,
          doormanName: callDetails.doormanName,
          participantCount: callDetails.participants?.length || 0,
        });
        // Update session with fresh data from API
        // @ts-ignore - updating readonly field with fresh data
        this.participants = callDetails.participants || [];
      }

      // STEP 3: Fetch tokens
      console.log(`[CallSession] Fetching tokens...`);
      this.setState('token_fetching');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const userId = this.getCurrentUserId();
      const requestBody = {
        userId,
        userType: 'resident',
      };

      console.log(`[CallSession] Calling answer API:`, {
        url: `${this.getApiBaseUrl()}/api/calls/${this.id}/answer`,
        userId,
        hasToken: !!accessToken,
      });

      const response = await InterfoneAPI.answerCall(this.id, userId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Answer failed');
      }
      
      this._localBundle = response.data.tokens;

      if (!this._localBundle) {
        throw new Error('No tokens in answer response');
      }

      console.log(`[CallSession] Token bundle received:`, {
        hasRtcToken: !!this._localBundle.rtcToken,
        hasRtmToken: !!this._localBundle.rtmToken,
        uid: this._localBundle.uid,
        channelName: this._localBundle.channelName,
      });

      // Join RTC channel
      console.log(`[CallSession] Joining RTC channel...`);
      this.setState('rtc_joining');

      // Request microphone permissions before joining
      console.log(`[CallSession] Requesting microphone permissions...`);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn(`[CallSession] ⚠️ Microphone permission denied: ${status}`);
        // Continue anyway - user might grant permission later
      } else {
        console.log(`[CallSession] ✅ Microphone permission granted`);
      }

      console.log(`[CallSession] RTC join params:`, {
        channelName: this.channelName,
        userAccount: this._localBundle.uid,
        tokenPrefix: this._localBundle.rtcToken?.substring(0, 20) + '...',
      });

      // Use joinChannelWithUserAccount since UID is a string (UUID)
      await agoraService.joinChannelWithUserAccount({
        token: this._localBundle.rtcToken,
        channelName: this.channelName,
        userAccount: this._localBundle.uid,
      });

      this._rtcJoined = true;
      this.setState('connecting');

      // Send RTM ANSWER signal to notify other participants (especially porteiro)
      console.log(`[CallSession] Sending ANSWER signal to participants...`);
      try {
        const answerSignal = {
          t: 'ANSWER' as const,
          callId: this.id,
          from: this.getCurrentUserId(),
          channel: this.channelName,
          timestamp: Date.now(),
        };

        const participantIds = this.participants.map((p) => p.userId).filter(Boolean);
        console.log(`[CallSession] Participant IDs:`, participantIds);

        if (participantIds.length > 0) {
          await agoraService.sendPeerMessage(participantIds, answerSignal);
          console.log(
            `[CallSession] ✅ ANSWER signal sent to ${participantIds.length} participants`
          );
        } else {
          console.warn(`[CallSession] ⚠️ No valid participant IDs to send ANSWER signal`);
        }
      } catch (signalError) {
        console.warn(`[CallSession] ⚠️ Failed to send ANSWER signal:`, signalError);
        // Don't fail the call if signal sending fails
      }

      console.log(`[CallSession] ✅ Call answered successfully`);
    } catch (error) {
      console.error(`[CallSession] ❌ Answer failed:`, error);
      this.setState('failed');
      this.emit('error', { error, operation: 'answer' });
      throw error;
    }
  }

  /**
   * End active call
   */
  async end(reason: 'hangup' | 'drop' | 'timeout' = 'hangup'): Promise<void> {
    console.log(`[CallSession] Ending call ${this.id} (${reason})...`);

    try {
      this.setState('ending');

      // Send RTM END signal to notify other participants (RTM is the source of truth)
      console.log(`[CallSession] Sending END signal to participants...`);
      try {
        const endSignal = {
          t: 'END' as const,
          callId: this.id,
          from: this.getCurrentUserId(),
          channel: this.channelName,
          timestamp: Date.now(),
        };

        const participantIds = this.participants.map((p) => p.userId);
        if (participantIds.length > 0) {
          await agoraService.sendPeerMessage(participantIds, endSignal);
          console.log(`[CallSession] ✅ END signal sent to ${participantIds.length} participants`);
        }
      } catch (signalError) {
        console.warn(`[CallSession] ⚠️ Failed to send END signal:`, signalError);
      }

      // Leave RTC channel
      if (this._rtcJoined) {
        await agoraService.leaveRtcChannel();
        this._rtcJoined = false;
      }

      // Cleanup RTC event listeners
      this.cleanupRtcEventListeners();

      // Notify backend
      try {
        await InterfoneAPI.endCall(this.id, this.getCurrentUserId(), reason);
        console.log('[CallSession] ✅ Backend confirmed call ended');
      } catch (apiError) {
        console.error('[CallSession] ❌ End API call failed:', apiError);
      }

      this.setState('ended');

      console.log(`[CallSession] ✅ Call ended`);
    } catch (error) {
      console.error(`[CallSession] ❌ End failed:`, error);
      this.emit('error', { error, operation: 'end' });
    }
  }

  /**
   * Decline incoming call
   */
  async decline(reason: string = 'declined'): Promise<void> {
    console.log(`[CallSession] Declining call ${this.id}...`);

    try {
      // Transition immediately so UI shows "Encerrando..."
      this.setState('ending');

      // Ensure we leave the RTC channel if we had already joined
      if (this._rtcJoined) {
        try {
          await agoraService.leaveRtcChannel();
        } catch (leaveError) {
          console.warn('[CallSession] ⚠️ Failed to leave RTC channel during decline:', leaveError);
        } finally {
          this._rtcJoined = false;
        }
      }

      // Cleanup RTC listeners early so we don't leak subscriptions
      this.cleanupRtcEventListeners();

      // Send RTM DECLINE signal to notify other participants (RTM is the source of truth)
      console.log(`[CallSession] Sending DECLINE signal to participants...`);
      try {
        const declineSignal = {
          t: 'DECLINE' as const,
          callId: this.id,
          from: this.getCurrentUserId(),
          channel: this.channelName,
          timestamp: Date.now(),
        };

        const participantIds = this.participants.map((p) => p.userId);
        if (participantIds.length > 0) {
          await agoraService.sendPeerMessage(participantIds, declineSignal);
          console.log(
            `[CallSession] ✅ DECLINE signal sent to ${participantIds.length} participants`
          );
        }
      } catch (signalError) {
        console.warn(`[CallSession] ⚠️ Failed to send DECLINE signal:`, signalError);
      }

      // Notify backend
      try {
        await InterfoneAPI.declineCall(this.id, this.getCurrentUserId(), reason);
        console.log('[CallSession] ✅ Backend confirmed call declined');
      } catch (apiError) {
        console.error('[CallSession] ❌ Decline API call failed:', apiError);
      }

      this.setState('declined');

      console.log(`[CallSession] ✅ Call declined`);
    } catch (error) {
      console.error(`[CallSession] ❌ Decline failed:`, error);
      this.emit('error', { error, operation: 'decline' });
    }
  }

  // ========================================
  // Persistence
  // ========================================

  // ========================================
  // Events
  // ========================================

  on(event: SessionEvent, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private emit(event: SessionEvent, payload: any): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[CallSession] Event handler error:`, error);
      }
    });
  }

  // ========================================
  // Helpers
  // ========================================

  private getApiBaseUrl(): string {
    return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  }

  private getCurrentUserId(): string {
    // This should be passed in constructor ideally, but for now get from context
    return agoraService.getCurrentUser()?.id || '';
  }

  /**
   * Convert to context format for useAgora compatibility
   */
  toContext(): {
    callId: string;
    channelName: string;
    participants: CallParticipantSnapshot[];
    localBundle: AgoraTokenBundle | null;
    isOutgoing: boolean;
  } {
    return {
      callId: this.id,
      channelName: this.channelName,
      participants: this.participants,
      localBundle: this._localBundle,
      isOutgoing: this.isOutgoing,
    };
  }

  /**
   * Get session info for debugging
   */
  getDebugInfo(): Record<string, any> {
    return {
      id: this.id,
      state: this._state,
      rtmReady: this._rtmReady,
      rtcJoined: this._rtcJoined,
      age: Date.now() - this.initiatedAt,
    };
  }
}
