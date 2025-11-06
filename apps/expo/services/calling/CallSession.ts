import AsyncStorage from '@react-native-async-storage/async-storage';
import { agoraService } from '~/services/agora/AgoraService';
import { callKeepService } from '~/services/CallKeepService';
import agoraAudioService from '~/services/audioService';
import type { CallParticipantSnapshot, AgoraTokenBundle } from '@porteiroapp/common/calling';
import { CALL_STATE_MACHINE, type CallLifecycleState } from './stateMachine';
import {supabase} from "~/utils/supabase";

const STORAGE_KEY = '@active_call_session';

interface CallSessionData {
  id: string;
  callKeepUUID: string;
  channelName: string;
  participants: CallParticipantSnapshot[];
  isOutgoing: boolean;
  callerName?: string | null;
  apartmentNumber?: string | null;
  buildingId?: string | null;
  initiatedAt: number;
}

interface CallSessionOptions {
  id: string;
  callKeepUUID: string;
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
  readonly callKeepUUID: string;
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
  private _nativeState: 'idle' | 'ringing' | 'active' = 'idle';

  // Connection status
  private _rtmReady: boolean = false;
  private _rtcJoined: boolean = false;
  private _localBundle: AgoraTokenBundle | null = null;

  // Event emitter
  private eventHandlers = new Map<SessionEvent, Set<EventHandler>>();

  constructor(options: CallSessionOptions) {
    this.id = options.id;
    this.callKeepUUID = options.callKeepUUID;
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

  get nativeState(): 'idle' | 'ringing' | 'active' {
    return this._nativeState;
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

  private setNativeState(state: 'idle' | 'ringing' | 'active'): void {
    if (this._nativeState === state) return;

    console.log(`[CallSession] Native state: ${this._nativeState} → ${state}`);
    this._nativeState = state;
  }

  // ========================================
  // Lifecycle Operations
  // ========================================

  /**
   * Initialize session - verify RTM connection is ready
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

    console.log(`[CallSession] ✅ Initialized`);
  }

  /**
   * Answer incoming call - joins Agora channel
   */
  async answer(): Promise<void> {
    console.log(`[CallSession] Answering call ${this.id}...`);

    if (!this.canAnswer) {
      throw new Error(`Cannot answer in state: ${this._state}`);
    }

    try {
      this.setState('native_answered');
      this.setNativeState('active');

      // Stop ringtone immediately
      await agoraAudioService.stopIntercomRingtone().catch(() => {});

      // Mark CallKeep call as active
      await callKeepService.answerIncoming(this.callKeepUUID);

      // Fetch tokens
      console.log(`[CallSession] Fetching tokens...`);
      this.setState('token_fetching');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${this.getApiBaseUrl()}/api/calls/${this.id}/answer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            userId: this.getCurrentUserId(),
            userType: 'resident',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Answer API failed: ${response.status}`);
      }

      const result = await response.json();
      this._localBundle = result.data?.tokens;

      if (!this._localBundle) {
        throw new Error('No tokens in answer response');
      }

      // Join RTC channel
      console.log(`[CallSession] Joining RTC channel...`);
      this.setState('rtc_joining');

      const rtcEngine = await agoraService.ensureRtcEngine();
      const joinResult = rtcEngine.joinChannel(
        this._localBundle.rtcToken,
        this.channelName,
        parseInt(this._localBundle.uid, 10) || 0,
        {
          autoSubscribeAudio: true,
          autoSubscribeVideo: false,
          publishCameraTrack: false,
          publishMicrophoneTrack: true,
        }
      );

      if (joinResult !== 0) {
        throw new Error(`Failed to join RTC channel: ${joinResult}`);
      }

      this._rtcJoined = true;
      this.setState('connecting');

      // Report connected to CallKeep
      await callKeepService.reportConnectedCall(this.callKeepUUID);

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

      // Leave RTC channel
      if (this._rtcJoined) {
        await agoraService.leaveRtcChannel();
        this._rtcJoined = false;
      }

      // End CallKeep call
      await callKeepService.endCall(this.callKeepUUID);
      this.setNativeState('idle');

      // Notify backend
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      await fetch(`${this.getApiBaseUrl()}/api/calls/${this.id}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          userId: this.getCurrentUserId(),
          userType: 'resident',
          cause: reason,
        }),
      }).catch(err => console.warn('[CallSession] End API failed:', err));

      this.setState('ended');

      // Clear from storage
      await this.clear();

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
      // Reject CallKeep call
      await callKeepService.rejectCall(this.callKeepUUID);
      this.setNativeState('idle');

      // Notify backend
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      await fetch(`${this.getApiBaseUrl()}/api/calls/${this.id}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          userId: this.getCurrentUserId(),
          userType: 'resident',
          reason,
        }),
      }).catch(err => console.warn('[CallSession] Decline API failed:', err));

      this.setState('declined');

      // Clear from storage
      await this.clear();

      console.log(`[CallSession] ✅ Call declined`);
    } catch (error) {
      console.error(`[CallSession] ❌ Decline failed:`, error);
      this.emit('error', { error, operation: 'decline' });
    }
  }

  // ========================================
  // State Synchronization
  // ========================================

  /**
   * Check if CallKeep native state matches our state
   */
  isConsistent(): boolean {
    // If we're in an active call state, native should be active
    const activeStates: CallLifecycleState[] = ['connecting', 'connected', 'native_answered', 'rtc_joining', 'token_fetching'];
    if (activeStates.includes(this._state)) {
      return this._nativeState === 'active';
    }

    // If we're ringing, native should be ringing
    if (this._state === 'rtm_ready' || this._state === 'ringing') {
      return this._nativeState === 'ringing';
    }

    // Terminal states should have idle native state
    const terminalStates: CallLifecycleState[] = ['ended', 'declined', 'failed', 'missed'];
    if (terminalStates.includes(this._state)) {
      return this._nativeState === 'idle';
    }

    return true;
  }

  /**
   * Force sync native state with current state
   */
  syncNativeState(): void {
    console.log(`[CallSession] Syncing native state...`);

    if (this._state === 'connected' && this._nativeState !== 'active') {
      void callKeepService.reportConnectedCall(this.callKeepUUID);
      this.setNativeState('active');
    }

    if (this._state === 'ended' && this._nativeState !== 'idle') {
      void callKeepService.endCall(this.callKeepUUID);
      this.setNativeState('idle');
    }
  }

  // ========================================
  // Persistence
  // ========================================

  /**
   * Save session to storage
   */
  async save(): Promise<void> {
    try {
      const data: CallSessionData = {
        id: this.id,
        callKeepUUID: this.callKeepUUID,
        channelName: this.channelName,
        participants: this.participants,
        isOutgoing: this.isOutgoing,
        callerName: this.callerName,
        apartmentNumber: this.apartmentNumber,
        buildingId: this.buildingId,
        initiatedAt: this.initiatedAt,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log(`[CallSession] Saved to storage`);
    } catch (error) {
      console.error(`[CallSession] Save failed:`, error);
    }
  }

  /**
   * Load session from storage
   */
  static async load(): Promise<CallSession | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (!json) return null;

      const data: CallSessionData = JSON.parse(json);

      const session = new CallSession({
        id: data.id,
        callKeepUUID: data.callKeepUUID,
        channelName: data.channelName,
        participants: data.participants,
        isOutgoing: data.isOutgoing,
        callerName: data.callerName,
        apartmentNumber: data.apartmentNumber,
        buildingId: data.buildingId,
      });

      console.log(`[CallSession] Loaded from storage: ${session.id}`);

      return session;
    } catch (error) {
      console.error(`[CallSession] Load failed:`, error);
      return null;
    }
  }

  /**
   * Clear saved session
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log(`[CallSession] Cleared from storage`);
    } catch (error) {
      console.error(`[CallSession] Clear failed:`, error);
    }
  }

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

    handlers.forEach(handler => {
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
    return agoraService['currentUser']?.id || '';
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
      callKeepUUID: this.callKeepUUID,
      state: this._state,
      nativeState: this._nativeState,
      rtmReady: this._rtmReady,
      rtcJoined: this._rtcJoined,
      isConsistent: this.isConsistent(),
      age: Date.now() - this.initiatedAt,
    };
  }
}
