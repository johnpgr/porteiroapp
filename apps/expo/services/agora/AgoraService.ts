import { Platform } from 'react-native';
import RtmEngine, { RtmConnectionState, RtmMessage } from 'agora-react-native-rtm';
import {
  AudioProfileType,
  AudioScenarioType,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  IRtcEngineEventHandler,
  createAgoraRtcEngine,
} from 'react-native-agora';
import { supabase } from '~/utils/supabase';

// Types mirrored from useAgora for compatibility
export type UserType = 'porteiro' | 'morador';

export type RtmStatus = 'disconnected' | 'connecting' | 'connected';

export interface CurrentUserContext {
  id: string;
  userType: UserType;
  displayName?: string | null;
}

export interface AgoraTokenBundle {
  rtcToken: string;
  rtmToken: string;
  uid: string;
  channelName: string;
  rtcRole: 'publisher' | 'subscriber';
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const DEFAULT_LOCAL_URL = 'http://localhost:3001';
const DEFAULT_ANDROID_EMULATOR_URL = 'http://10.0.2.2:3001';

const resolveApiBaseUrl = (explicit?: string): string => {
  if (explicit) return explicit;
  if (process.env.EXPO_PUBLIC_API_BASE_URL) return process.env.EXPO_PUBLIC_API_BASE_URL;
  return Platform.OS === 'android' ? DEFAULT_ANDROID_EMULATOR_URL : DEFAULT_LOCAL_URL;
};

const apiRequest = async <T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<ApiResponse<T>> => {
  const { headers: initHeaders, ...restInit } = init as any;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...(restInit as any),
    headers: {
      'Content-Type': 'application/json',
      ...(initHeaders || {}),
    },
  });
  const raw = (await response.json().catch(() => ({ success: response.ok }))) as ApiResponse<T>;
  if (!response.ok) {
    const message = raw?.error || raw?.message || `HTTP ${response.status}`;
    return { success: false, error: message, message };
  }
  return raw;
};

// Tiny event emitter
class Emitter<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<(payload: any) => void>>();

  on<K extends keyof TEvents>(event: K, handler: (payload: TEvents[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as any);
    return () => this.off(event, handler);
  }
  off<K extends keyof TEvents>(event: K, handler: (payload: TEvents[K]) => void) {
    this.listeners.get(event)?.delete(handler as any);
  }
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }
}

interface AgoraEvents {
  status: RtmStatus;
  rtmMessage: { message: RtmMessage; peerId: string };
  error: { message: string; cause?: unknown };
  rtcJoinSuccess: { channelId: string };
  rtcLeave: { channelId?: string };
  rtcUserJoined: { remoteUid: number };
  rtcUserOffline: { remoteUid: number; reason: number };
  rtcError: { code: number; message?: string };
  audioRoutingChanged: { routing: number };
  rtcTokenPrivilegeWillExpire: null;
  rtcRequestToken: null;
}

// Track per-app-session users initialized in standby to avoid reinit churn
const standbyInitializedUsers = new Set<string>();

class AgoraService {
  private static instance: AgoraService | null = null;

  static getInstance(): AgoraService {
    if (!AgoraService.instance) {
      AgoraService.instance = new AgoraService();
    }
    return AgoraService.instance;
  }

  private appId: string = '';
  private apiBaseUrl: string = resolveApiBaseUrl();

  private rtmEngine: RtmEngine | null = null;
  private rtcEngine: IRtcEngine | null = null;
  private rtmStatus: RtmStatus = 'disconnected';
  private rtmListenersAttached = false;
  private rtmMessageSubscription: { remove: () => void } | null = null;
  private rtmConnectionSubscription: { remove: () => void } | null = null;
  private rtcListenersAttached = false;

  private currentUser: CurrentUserContext | null = null;
  private rtmSession: { uid: string; token: string; expiresAt?: string } | null = null;

  private standbyInitInProgress = false;
  private renewalTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectRetryCount = 0;

  private readonly emitter = new Emitter<AgoraEvents>();

  // Public API
  configure(opts: { appId?: string; apiBaseUrl?: string }) {
    if (opts.appId) this.appId = opts.appId;
    if (opts.apiBaseUrl) this.apiBaseUrl = resolveApiBaseUrl(opts.apiBaseUrl);
  }

  setCurrentUser(user: CurrentUserContext | null) {
    this.currentUser = user;
  }

  on = this.emitter.on.bind(this.emitter);
  off = this.emitter.off.bind(this.emitter);

  getStatus(): RtmStatus {
    return this.rtmStatus;
  }

  async ensureRtmEngine(): Promise<RtmEngine> {
    if (!this.appId) throw new Error('AGORA_APP_ID não configurado para RTM');
    if (this.rtmEngine) return this.rtmEngine;

    const engine = new RtmEngine();
    await engine.createInstance(this.appId);
    this.rtmEngine = engine;
    this.attachRtmListeners();
    return engine;
  }

  // RTC lifecycle
  async ensureRtcEngine(): Promise<IRtcEngine> {
    if (!this.appId) throw new Error('AGORA_APP_ID não configurado');
    if (this.rtcEngine) return this.rtcEngine;

    const rtcEngine = createAgoraRtcEngine();
    const result = rtcEngine.initialize({
      appId: this.appId,
      logConfig: { level: __DEV__ ? 0x0001 : 0x0000 },
    });
    if (result !== 0) throw new Error(`Falha ao inicializar o Agora RTC (código ${result})`);

    const eventHandler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (connection) => {
        this.emitter.emit('rtcJoinSuccess', { channelId: connection.channelId ?? '' });
      },
      onLeaveChannel: (connection) => {
        this.emitter.emit('rtcLeave', { channelId: connection.channelId ?? undefined });
      },
      onUserJoined: (_, remoteUid) => {
        this.emitter.emit('rtcUserJoined', { remoteUid: Number(remoteUid) });
      },
      onUserOffline: (_, remoteUid, reason) => {
        this.emitter.emit('rtcUserOffline', { remoteUid: Number(remoteUid), reason });
      },
      onError: (err, msg) => {
        this.emitter.emit('rtcError', { code: err, message: msg });
      },
      onTokenPrivilegeWillExpire: () => {
        this.emitter.emit('rtcTokenPrivilegeWillExpire', null);
      },
      onRequestToken: () => {
        this.emitter.emit('rtcRequestToken', null);
      },
      onAudioRoutingChanged: (routing) => {
        this.emitter.emit('audioRoutingChanged', { routing });
      },
    };

    rtcEngine.registerEventHandler(eventHandler);
    rtcEngine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
    rtcEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
    rtcEngine.setAudioProfile(
      AudioProfileType.AudioProfileDefault,
      AudioScenarioType.AudioScenarioDefault
    );
    rtcEngine.enableAudio();
    rtcEngine.setDefaultAudioRouteToSpeakerphone(true);

    this.rtcEngine = rtcEngine;
    this.rtcListenersAttached = true;
    return rtcEngine;
  }

  async joinChannelWithUserAccount(params: {
    appId?: string;
    token: string;
    channelName: string;
    userAccount: string;
  }): Promise<void> {
    const engine = await this.ensureRtcEngine();
    const registerResult = engine.registerLocalUserAccount(params.appId ?? this.appId, params.userAccount);
    if (registerResult !== 0) {
      console.warn('⚠️ Falha ao registrar conta local no Agora:', registerResult);
    }
    const joinResult = engine.joinChannelWithUserAccount(
      params.token,
      params.channelName,
      params.userAccount,
      {
        autoSubscribeAudio: true,
        autoSubscribeVideo: false,
        publishCameraTrack: false,
        publishMicrophoneTrack: true,
      }
    );
    if (joinResult !== 0) {
      throw new Error(`Falha ao entrar no canal do Agora (código ${joinResult})`);
    }
  }

  async joinChannel(params: { token: string; channelName: string; uid: number }): Promise<void> {
    const engine = await this.ensureRtcEngine();
    const joinResult = engine.joinChannel(params.token, params.channelName, params.uid, {
      autoSubscribeAudio: true,
      autoSubscribeVideo: false,
      publishCameraTrack: false,
      publishMicrophoneTrack: true,
    });
    if (joinResult !== 0) {
      throw new Error(`Falha ao entrar no canal do Agora (código ${joinResult})`);
    }
  }

  async leaveRtcChannel(): Promise<void> {
    if (!this.rtcEngine) return;
    const result = this.rtcEngine.leaveChannel();
    if (result !== 0) {
      console.warn('⚠️ Falha ao sair do canal do Agora:', result);
    }
  }

  async renewRtcToken(token: string): Promise<void> {
    if (!this.rtcEngine) return;
    try {
      this.rtcEngine.renewToken(token);
    } catch (e) {
      console.warn('⚠️ Falha ao renovar token RTC:', e);
    }
  }

  async setSpeakerphoneOn(on: boolean): Promise<void> {
    if (!this.rtcEngine) return;
    const res = this.rtcEngine.setDefaultAudioRouteToSpeakerphone(on);
    if (res !== 0) throw new Error(`Falha ao alternar alto-falante (código ${res})`);
  }

  async setMuted(on: boolean): Promise<void> {
    if (!this.rtcEngine) return;
    const res = this.rtcEngine.muteLocalAudioStream(on);
    if (res !== 0) throw new Error(`Falha ao alternar microfone (código ${res})`);
  }

  private attachRtmListeners() {
    if (!this.rtmEngine || this.rtmListenersAttached) return;

    this.rtmMessageSubscription = this.rtmEngine.addListener('MessageReceived', (message: RtmMessage, peerId: string) => {
      this.emitter.emit('rtmMessage', { message, peerId });
    });

    this.rtmConnectionSubscription = this.rtmEngine.addListener('ConnectionStateChanged', (state: RtmConnectionState) => {
      const mapped: RtmStatus = state === RtmConnectionState.CONNECTED ? 'connected' : state === RtmConnectionState.CONNECTING ? 'connecting' : 'disconnected';
      this.setRtmStatus(mapped);
      if (mapped === 'disconnected' && this.rtmSession) {
        this.scheduleReconnect();
      }
    });

    this.rtmListenersAttached = true;
  }

  private setRtmStatus(next: RtmStatus) {
    if (this.rtmStatus === next) return;
    this.rtmStatus = next;
    this.emitter.emit('status', next);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (!this.currentUser || !this.rtmSession) return;
    if (this.reconnectTimer) return;

    const maxRetries = 5;
    const baseDelay = 2000;

    const attempt = async () => {
      if (!this.currentUser || !this.rtmSession) return;
      if (this.reconnectRetryCount >= maxRetries) {
        this.emitter.emit('error', { message: 'RTM reconnection failed', cause: new Error('max-retries') });
        this.clearReconnectTimer();
        this.reconnectRetryCount = 0;
        return;
      }

      const delay = baseDelay * Math.pow(2, this.reconnectRetryCount);
      this.reconnectRetryCount++;
      this.reconnectTimer = setTimeout(async () => {
        try {
          const engine = await this.ensureRtmEngine();
          await engine.loginV2(this.rtmSession!.uid, this.rtmSession!.token);
          this.setRtmStatus('connected');
          this.clearReconnectTimer();
          this.reconnectRetryCount = 0;
        } catch {
          // try again
          this.clearReconnectTimer();
          this.scheduleReconnect();
        }
      }, delay);
    };

    attempt();
  }

  private clearRenewalTimer() {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  private scheduleStandbyRenewal(expiresAt?: string) {
    this.clearRenewalTimer();
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const renewalBuffer = 30_000; // 30s before expiry
    const timeUntilRenewal = expiryTime - Date.now() - renewalBuffer;

    const renew = async () => {
      try {
        if (!this.currentUser) return;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const response = await apiRequest<{ appId: string | null; rtmToken: string; uid: string; expiresAt: string; ttlSeconds: number }>(
          this.apiBaseUrl,
          '/api/tokens/standby',
          {
            method: 'POST',
            body: JSON.stringify({ uid: this.currentUser.id }),
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } as any : {},
          }
        );
        if (!response.success || !response.data) {
          return;
        }
        const { rtmToken, uid, expiresAt: nextExp } = response.data;
        const engine = await this.ensureRtmEngine();
        try {
          await engine.logout();
        } catch {}
        await engine.loginV2(uid, rtmToken);
        this.rtmSession = { uid, token: rtmToken, expiresAt: nextExp };
        this.setRtmStatus('connected');
        this.scheduleStandbyRenewal(nextExp);
      } catch (err) {
        this.emitter.emit('error', { message: 'Failed to renew RTM standby token', cause: err });
      }
    };

    if (timeUntilRenewal <= 0) {
      void renew();
      return;
    }
    this.renewalTimer = setTimeout(() => void renew(), timeUntilRenewal);
  }

  async loginRtm(bundle: { uid: string; rtmToken: string; expiresAt?: string }) {
    const engine = await this.ensureRtmEngine();
    this.setRtmStatus('connecting');

    if (this.rtmSession) {
      try { await engine.logout(); } catch {}
    }

    console.log(`🔐 [AgoraService] Iniciando login RTM para uid: ${bundle.uid}`);

    // Wait for ConnectionStateChanged event
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        console.warn(`⚠️ [AgoraService] Timeout aguardando conexão RTM`);
        resolve(); // Don't reject, just resolve to continue
      }, 5000);

      const listener = (state: RtmConnectionState, reason: any) => {
        console.log(`📡 [AgoraService] ConnectionStateChanged: state=${state}, reason=${reason}`);
        console.log(`📡 [AgoraService] Checking: state === CONNECTED? ${state === RtmConnectionState.CONNECTED}, RtmConnectionState.CONNECTED = ${RtmConnectionState.CONNECTED}`);

        // Check for connected state (value 3)
        if (state === RtmConnectionState.CONNECTED || state === 3) {
          cleanup();
          console.log(`✅ [AgoraService] RTM conectado com sucesso`);
          resolve();
        }
      };

      let subscription: any = null;
      const cleanup = () => {
        clearTimeout(timeout);
        if (subscription) {
          subscription.remove(); // Workaround for SDK bug - use .remove() instead of engine.removeListener()
        }
      };

      subscription = engine.addListener('ConnectionStateChanged', listener);
    });

    await engine.loginV2(bundle.uid, bundle.rtmToken);
    this.rtmSession = { uid: bundle.uid, token: bundle.rtmToken, expiresAt: bundle.expiresAt };

    console.log(`⏳ [AgoraService] Aguardando evento de conexão RTM...`);
    await connectionPromise;

    this.setRtmStatus('connected');
    this.scheduleStandbyRenewal(bundle.expiresAt);
  }

  async initializeStandby(): Promise<void> {
    if (!this.currentUser || this.currentUser.userType !== 'morador') return;
    if (this.rtmStatus === 'connected' || this.rtmStatus === 'connecting') return;
    if (this.rtmSession) return;
    if (standbyInitializedUsers.has(this.currentUser.id)) return;
    if (this.standbyInitInProgress) return;

    this.standbyInitInProgress = true;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await apiRequest<{ appId: string | null; rtmToken: string; uid: string; expiresAt: string; ttlSeconds: number }>(
        this.apiBaseUrl,
        '/api/tokens/standby',
        {
          method: 'POST',
          body: JSON.stringify({ uid: this.currentUser.id }),
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } as any : {},
        }
      );
      if (!response.success || !response.data) {
        this.standbyInitInProgress = false;
        return;
      }
      const { rtmToken, uid, expiresAt } = response.data;
      await this.loginRtm({ uid, rtmToken, expiresAt });
      standbyInitializedUsers.add(this.currentUser.id);
    } catch (err) {
      this.emitter.emit('error', { message: 'Failed to initialize RTM standby', cause: err });
    } finally {
      this.standbyInitInProgress = false;
    }
  }

  async sendPeerMessage(targets: string[], payload: unknown) {
    if (!this.rtmEngine) {
      throw new Error('RTM não inicializado');
    }

    if (this.rtmStatus !== 'connected') {
      throw new Error(`RTM não está conectado. Estado atual: ${this.rtmStatus}`);
    }

    const data = JSON.stringify(payload);
    const uniqueTargets = Array.from(new Set(targets)).filter(Boolean);
    console.log(`📤 [AgoraService] Enviando mensagem RTM para ${uniqueTargets.length} alvos (status: ${this.rtmStatus})`);

    for (const target of uniqueTargets) {
      try {
        console.log(`📤 [AgoraService] Enviando para: ${target}`);
        await this.rtmEngine.sendMessageToPeerV2(target, new RtmMessage(data), {
          enableOfflineMessaging: true,
          enableHistoricalMessaging: true,
        });
        console.log(`✅ [AgoraService] Mensagem enviada para: ${target}`);
      } catch (err) {
        console.error(`❌ [AgoraService] Falha ao enviar para ${target}:`, err);
        throw err;
      }
    }
  }

  async cleanup(): Promise<void> {
    this.clearRenewalTimer();
    this.clearReconnectTimer();

    if (this.rtmEngine) {
      try {
        if (this.rtmStatus === 'connected') {
          await this.rtmEngine.logout();
        }
        const destroyClient = (this.rtmEngine as unknown as { destroyClient?: () => void }).destroyClient;
        if (typeof destroyClient === 'function') destroyClient.call(this.rtmEngine);
      } catch {}
      this.rtmEngine = null;
    }

    if (this.rtcEngine) {
      try {
        this.rtcEngine.release();
      } catch {}
      this.rtcEngine = null;
    }

    this.rtmMessageSubscription?.remove();
    this.rtmMessageSubscription = null;
    this.rtmConnectionSubscription?.remove();
    this.rtmConnectionSubscription = null;
    this.rtmListenersAttached = false;

    this.rtmSession = null;
    this.setRtmStatus('disconnected');
  }
}

export const agoraService = AgoraService.getInstance();
export default AgoraService;
