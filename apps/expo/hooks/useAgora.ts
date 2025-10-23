import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  AudioProfileType,
  AudioScenarioType,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  IRtcEngineEventHandler,
  createAgoraRtcEngine
} from 'react-native-agora';
import RtmEngine, {
  RtmConnectionState,
  RTMPeerMessage,
  RtmMessage,
  SendMessageOptions
} from 'agora-react-native-rtm';
import type {
  AgoraTokenBundle,
  CallLifecycleState,
  CallParticipantSnapshot,
  CallStartPayload,
  RtmInviteSignal,
  RtmSignal,
  RtmSignalType
} from '@porteiroapp/common/calling';
import { deriveNextStateFromSignal } from '~/services/calling';
import agoraAudioService from '~/services/audioService';
import { supabase } from '~/utils/supabase';

type UserType = 'porteiro' | 'morador';

interface CurrentUserContext {
  id: string;
  userType: UserType;
  displayName?: string | null;
}

interface UseAgoraOptions {
  currentUser?: CurrentUserContext | null;
  appId?: string;
  apiBaseUrl?: string;
  clientVersion?: string;
  schemaVersion?: number;
}

interface AgoraJoinConfig {
  appId?: string;
  channelName: string;
  uid: string | number;
  token?: string | null;
  role?: 'publisher' | 'subscriber';
}

interface StartIntercomCallParams {
  apartmentNumber: string;
  buildingId: string;
  context?: Record<string, unknown>;
}

type RtmStatus = 'disconnected' | 'connecting' | 'connected';

interface ActiveCallContext {
  callId: string;
  channelName: string;
  participants: CallParticipantSnapshot[];
  localBundle: AgoraTokenBundle;
  payload?: CallStartPayload;
  isOutgoing: boolean;
}

interface IncomingInviteContext {
  signal: RtmInviteSignal;
  from: string;
  participants?: CallParticipantSnapshot[];
  callSummary?: {
    callId: string;
    apartmentNumber?: string | null;
    buildingId?: string | null;
    doormanName?: string | null;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface CallStatusResponse {
  call: Record<string, any>;
  participants: any[];
}

export interface UseAgoraReturn {
  engine: IRtcEngine | null;
  rtmEngine: RtmEngine | null;
  currentUser: CurrentUserContext | null;
  rtmStatus: RtmStatus;
  callState: CallLifecycleState;
  activeCall: ActiveCallContext | null;
  incomingInvite: IncomingInviteContext | null;
  isJoined: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  error: string | null;
  setCurrentUser: (user: CurrentUserContext | null) => void;
  startIntercomCall: (params: StartIntercomCallParams) => Promise<CallStartPayload>;
  answerIncomingCall: () => Promise<void>;
  declineIncomingCall: (reason?: string) => Promise<void>;
  endActiveCall: (cause?: 'hangup' | 'drop' | 'timeout') => Promise<void>;
  joinChannel: (config: AgoraJoinConfig) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  cleanup: () => Promise<void>;
}

const DEFAULT_LOCAL_URL = 'http://localhost:3001';
const DEFAULT_ANDROID_EMULATOR_URL = 'http://10.0.2.2:3001';

const resolveApiBaseUrl = (explicit?: string): string => {
  if (explicit) {
    return explicit;
  }

  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  if (Platform.OS === 'android') {
    return DEFAULT_ANDROID_EMULATOR_URL;
  }

  return DEFAULT_LOCAL_URL;
};

const apiRequest = async <T,>(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    ...init
  });

  const raw = (await response
    .json()
    .catch(() => ({ success: response.ok, data: undefined, error: undefined }))) as ApiResponse<T>;

  if (!response.ok) {
    const message = raw.error || raw.message || `HTTP ${response.status}`;
    return {
      success: false,
      error: message,
      message
    };
  }

  return raw;
};

const toStringId = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    const normalized = String(value);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const normalizeParticipant = (participant: any): CallParticipantSnapshot | null => {
  const userId =
    toStringId(
      participant?.user_id ??
        participant?.resident_id ??
        participant?.id ??
        participant?.profile_id ??
        participant?.uid
    ) ?? undefined;

  if (!userId) {
    return null;
  }

  const userType =
    participant?.user_type ??
    participant?.role ??
    (participant?.userType ?? participant?.roleType ?? null);

  const role: CallParticipantSnapshot['role'] =
    participant?.role ??
    (userType === 'porteiro' || userType === 'doorman' ? 'caller' : 'callee');

  const status: CallParticipantSnapshot['status'] =
    participant?.status ??
    (participant?.joined_at ? 'connected' : 'invited');

  const rtcUid =
    toStringId(participant?.rtcUid ?? participant?.rtc_uid ?? userId) ?? userId;
  const rtmId =
    toStringId(participant?.rtmId ?? participant?.rtm_id ?? userId) ?? userId;

  return {
    userId,
    role,
    status,
    rtcUid,
    rtmId,
    name:
      participant?.name ??
      participant?.full_name ??
      participant?.display_name ??
      null,
    phone: participant?.phone ?? participant?.mobile ?? null,
    avatarUrl: participant?.avatarUrl ?? participant?.avatar_url ?? null,
    userType: userType ?? undefined
  };
};

const toParticipantList = (raw: any[] | undefined): CallParticipantSnapshot[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: CallParticipantSnapshot[] = [];
  for (const participant of raw) {
    const item = normalizeParticipant(participant);
    if (item) {
      normalized.push(item);
    }
  }
  return normalized;
};

const fetchCallStatus = async (
  baseUrl: string,
  callId: string
): Promise<CallStatusResponse | null> => {
  const response = await apiRequest<{
    call: CallStatusResponse['call'];
    participants: CallStatusResponse['participants'];
  }>(baseUrl, `/api/calls/${callId}/status`);

  if (!response.success || !response.data) {
    return null;
  }

  return {
    call: response.data.call,
    participants: response.data.participants ?? []
  };
};

const fetchTokenBundle = async (
  baseUrl: string,
  params: {
    channelName: string;
    uid: string;
    role?: 'publisher' | 'subscriber';
  }
): Promise<AgoraTokenBundle> => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  const response = await apiRequest<AgoraTokenBundle>(baseUrl, '/api/tokens/generate', {
    method: 'POST',
    body: JSON.stringify({
      channelName: params.channelName,
      uid: params.uid,
      role: params.role ?? 'publisher'
    }),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || response.message || 'Não foi possível gerar token do Agora');
  }

  return response.data;
};

const fetchTokenForCall = async (
  baseUrl: string,
  params: { callId: string; uid: string; role?: 'publisher' | 'subscriber' }
): Promise<AgoraTokenBundle> => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  const response = await apiRequest<{
    appId: string | null;
    channelName: string;
    rtcToken: string;
    rtmToken: string;
    uid: string;
    rtcRole: 'publisher' | 'subscriber';
    issuedAt: string;
    expiresAt: string;
    ttlSeconds: number;
  }>(baseUrl, '/api/tokens/for-call', {
    method: 'POST',
    body: JSON.stringify({
      callId: params.callId,
      uid: params.uid,
      role: params.role ?? 'publisher'
    }),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || response.message || 'Não foi possível obter token da chamada');
  }

  return {
    rtcToken: response.data.rtcToken,
    rtmToken: response.data.rtmToken,
    uid: response.data.uid,
    channelName: response.data.channelName,
    rtcRole: response.data.rtcRole,
    issuedAt: response.data.issuedAt,
    expiresAt: response.data.expiresAt,
    ttlSeconds: response.data.ttlSeconds
  };
};

const uniqueTargets = (targets: string[]): string[] =>
  Array.from(new Set(targets.filter((target) => target && target.length > 0)));

export const useAgora = (options?: UseAgoraOptions): UseAgoraReturn => {
  const [engine, setEngine] = useState<IRtcEngine | null>(null);
  const [rtmEngine, setRtmEngine] = useState<RtmEngine | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserContext | null>(
    options?.currentUser ?? null
  );
  const [rtmStatus, setRtmStatus] = useState<RtmStatus>('disconnected');
  const [callState, setCallState] = useState<CallLifecycleState>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCallContext | null>(null);
  const activeCallRef = useRef<ActiveCallContext | null>(null);
  const currentUserRef = useRef<CurrentUserContext | null>(currentUser);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInviteContext | null>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<IRtcEngine | null>(null);
  const rtmEngineRef = useRef<RtmEngine | null>(null);
  const rtmSessionRef = useRef<{ uid: string; token: string; expiresAt?: string } | null>(null);

  const agoraAppId = useMemo(() => {
    const resolved = options?.appId ?? process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';
    return resolved;
  }, [options?.appId]);

  const apiBaseUrl = useMemo(
    () => resolveApiBaseUrl(options?.apiBaseUrl),
    [options?.apiBaseUrl]
  );
  const apiBaseUrlRef = useRef(apiBaseUrl);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    apiBaseUrlRef.current = apiBaseUrl;
  }, [apiBaseUrl]);

  const schemaVersion = options?.schemaVersion ?? 1;

  const initializeRtcEngine = useCallback(async (): Promise<IRtcEngine> => {
    if (!agoraAppId) {
      throw new Error('AGORA_APP_ID não configurado');
    }

    if (engineRef.current) {
      return engineRef.current;
    }

    const rtcEngine = createAgoraRtcEngine();

    const result = rtcEngine.initialize({
      appId: agoraAppId,
      logConfig: {
        level: __DEV__ ? 0x0001 : 0x0000
      }
    });

    if (result !== 0) {
      throw new Error(`Falha ao inicializar o Agora RTC (código ${result})`);
    }

    const eventHandler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (connection) => {
        console.log('✅ Entrou no canal Agora:', connection.channelId);
        setIsJoined(true);
        setIsConnecting(false);
        setError(null);
        setCallState((prev) => (prev === 'ringing' ? 'connecting' : prev));
      },
      onLeaveChannel: (connection) => {
        console.log('👋 Saiu do canal Agora:', connection.channelId);
        setIsJoined(false);
        setIsConnecting(false);
        setCallState((prev) =>
          prev === 'ending' || prev === 'connected' || prev === 'connecting' ? 'ended' : prev
        );
      },
      onUserJoined: (connection, remoteUid) => {
        console.log('👤 Participante entrou no canal:', remoteUid);
        setCallState((prev) =>
          prev === 'connecting' || prev === 'ringing' || prev === 'dialing' ? 'connected' : prev
        );
      },
      onUserOffline: (connection, remoteUid, reason) => {
        console.log('👤 Participante saiu do canal:', remoteUid, 'Razão:', reason);
        setCallState((prev) =>
          prev === 'connected' || prev === 'connecting' ? 'ending' : prev
        );
      },
      onError: (err, msg) => {
        console.error('❌ Erro no Agora RTC:', err, msg);
        setError(msg || `Erro RTC ${err}`);
        setIsConnecting(false);
        // Clear active call on RTC error
        if (activeCallRef.current) {
          setActiveCall(null);
          activeCallRef.current = null;
          setCallState('idle');
        }
      },
      onTokenPrivilegeWillExpire: () => {
        const ac = activeCallRef.current;
        const cu = currentUserRef.current;
        if (!ac || !cu) return;
        fetchTokenForCall(apiBaseUrlRef.current, { callId: ac.callId, uid: cu.id })
          .then((bundle) => {
            try {
              const res = engineRef.current?.renewToken(bundle.rtcToken);
              if (res !== undefined && res !== 0) {
                console.warn('⚠️ Falha ao renovar token RTC (willExpire):', res);
              }
            } catch (e) {
              console.warn('⚠️ Erro ao renovar token RTC (willExpire):', e);
            }
          })
          .catch((e) => {
            console.error('❌ Falha ao obter novo token RTC (willExpire):', e);
            setError('Token expirado. Encerrando chamada...');
            // Clear call state - endActiveCall will be called via state change
            setActiveCall(null);
            activeCallRef.current = null;
            setCallState('ending');
          });
      },
      onRequestToken: () => {
        const ac = activeCallRef.current;
        const cu = currentUserRef.current;
        if (!ac || !cu) return;
        fetchTokenForCall(apiBaseUrlRef.current, { callId: ac.callId, uid: cu.id })
          .then((bundle) => {
            try {
              const res = engineRef.current?.renewToken(bundle.rtcToken);
              if (res !== undefined && res !== 0) {
                console.warn('⚠️ Falha ao renovar token RTC (onRequestToken):', res);
              }
            } catch (e) {
              console.warn('⚠️ Erro ao renovar token RTC (onRequestToken):', e);
            }
          })
          .catch((e) => {
            console.error('❌ Falha ao obter novo token RTC (onRequestToken):', e);
            setError('Token expirado. Encerrando chamada...');
            // Clear call state - endActiveCall will be called via state change
            setActiveCall(null);
            activeCallRef.current = null;
            setCallState('ending');
          });
      },
      onAudioRoutingChanged: (routing) => {
        setIsSpeakerOn(routing === 1);
      }
    };

    rtcEngine.registerEventHandler(eventHandler);
    rtcEngine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
    rtcEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
    rtcEngine.setAudioProfile(AudioProfileType.AudioProfileDefault, AudioScenarioType.AudioScenarioDefault);
    rtcEngine.enableAudio();
    rtcEngine.setDefaultAudioRouteToSpeakerphone(true);

    engineRef.current = rtcEngine;
    setEngine(rtcEngine);

    return rtcEngine;
  }, [agoraAppId]);

  const ensureRtmEngine = useCallback(async (): Promise<RtmEngine> => {
    if (!agoraAppId) {
      throw new Error('AGORA_APP_ID não configurado para RTM');
    }

    if (rtmEngineRef.current) {
      return rtmEngineRef.current;
    }

    const engineInstance = new RtmEngine();
    await engineInstance.createInstance(agoraAppId);
    rtmEngineRef.current = engineInstance;
    setRtmEngine(engineInstance);
    return engineInstance;
  }, [agoraAppId]);

  const ensureRtmLoggedIn = useCallback(
    async (bundle: AgoraTokenBundle): Promise<RtmEngine> => {
      const engineInstance = await ensureRtmEngine();
      const session = rtmSessionRef.current;

      if (
        session &&
        session.uid === bundle.uid &&
        session.token === bundle.rtmToken &&
        rtmStatus === 'connected'
      ) {
        return engineInstance;
      }

      setRtmStatus('connecting');

      if (session) {
        try {
          await engineInstance.logout();
        } catch (logoutError) {
          console.warn('⚠️ Falha ao realizar logout RTM anterior:', logoutError);
        }
      }

      await engineInstance.loginV2(bundle.uid, bundle.rtmToken);
      setRtmStatus('connected');
      rtmSessionRef.current = {
        uid: bundle.uid,
        token: bundle.rtmToken,
        expiresAt: bundle.expiresAt
      };

      return engineInstance;
    },
    [ensureRtmEngine, rtmStatus]
  );

  const joinChannel = useCallback(
    async (config: AgoraJoinConfig): Promise<void> => {
      setIsConnecting(true);
      setError(null);
      const granted = await agoraAudioService.requestPermissions();
      if (!granted) {
        setIsConnecting(false);
        throw new Error('Permissão de microfone negada');
      }

      const rtcEngine = await initializeRtcEngine();

      const userAccount =
        typeof config.uid === 'string' && config.uid.length > 0
          ? config.uid
          : toStringId(config.uid) ?? undefined;

      let token = config.token ?? null;

      if (!token && userAccount) {
        const bundle = await fetchTokenBundle(apiBaseUrl, {
          channelName: config.channelName,
          uid: userAccount,
          role: config.role
        });
        token = bundle.rtcToken;
      }

      if (userAccount) {
        const registerResult = rtcEngine.registerLocalUserAccount(
          config.appId ?? agoraAppId,
          userAccount
        );

        if (registerResult !== 0) {
          console.warn('⚠️ Falha ao registrar conta local no Agora:', registerResult);
        }

        const joinResult = rtcEngine.joinChannelWithUserAccount(
          token,
          config.channelName,
          userAccount,
          {
            autoSubscribeAudio: true,
            autoSubscribeVideo: false,
            publishCameraTrack: false,
            publishMicrophoneTrack: true
          }
        );

        if (joinResult !== 0) {
          setIsConnecting(false);
          throw new Error(`Falha ao entrar no canal do Agora (código ${joinResult})`);
        }
      } else {
        const numericUid =
          typeof config.uid === 'number' ? config.uid : Math.floor(Math.random() * 100000);

        const joinResult = rtcEngine.joinChannel(token, config.channelName, numericUid, {
          autoSubscribeAudio: true,
          autoSubscribeVideo: false,
          publishCameraTrack: false,
          publishMicrophoneTrack: true
        });

        if (joinResult !== 0) {
          setIsConnecting(false);
          throw new Error(`Falha ao entrar no canal do Agora (código ${joinResult})`);
        }
      }
    },
    [agoraAppId, apiBaseUrl, initializeRtcEngine]
  );

  const leaveChannel = useCallback(async (): Promise<void> => {
    try {
      if (engineRef.current && isJoined) {
        const result = engineRef.current.leaveChannel();
        if (result !== 0) {
          console.warn('⚠️ Falha ao sair do canal do Agora:', result);
        }
      }
    } catch (leaveError) {
      console.error('❌ Erro ao sair do canal:', leaveError);
    } finally {
      setIsJoined(false);
      setIsConnecting(false);
      setCallState((prev) => (prev !== 'idle' ? 'ended' : prev));
    }
  }, [isJoined]);

  const sendPeerSignal = useCallback(
    async (targets: string[], signal: RtmSignal): Promise<void> => {
      const engineInstance = rtmEngineRef.current;
      if (!engineInstance) {
        throw new Error('RTM não inicializado');
      }

      const payload = JSON.stringify(signal);
      const deliveries = targets.map(async (target) => {
        const options: SendMessageOptions = {
          enableOfflineMessaging: true,
          enableHistoricalMessaging: true
        };
        return engineInstance.sendMessageToPeerV2(target, new RtmMessage(payload), options);
      });

      await Promise.all(deliveries);
    },
    []
  );

  const startIntercomCall = useCallback(
    async (params: StartIntercomCallParams): Promise<CallStartPayload> => {
      if (!currentUser || currentUser.userType !== 'porteiro') {
        throw new Error('Somente usuários porteiros podem iniciar chamadas');
      }

      setError(null);
      setCallState('dialing');

      const response = await apiRequest<CallStartPayload>(apiBaseUrl, '/api/calls/start', {
        method: 'POST',
        body: JSON.stringify({
          apartmentNumber: params.apartmentNumber,
          buildingId: params.buildingId,
          fromUserId: currentUser.id,
          clientVersion: options?.clientVersion ?? null,
          schemaVersion,
          context: params.context ?? null
        })
      });

      if (!response.success || !response.data) {
        setCallState('idle');
        throw new Error(response.error || response.message || 'Falha ao iniciar chamada');
      }

      const payload = response.data;

      const bundle = payload.tokens.initiator;
      await ensureRtmLoggedIn(bundle);

      setCallState('ringing');

      await joinChannel({
        channelName: payload.call.channelName,
        uid: bundle.uid,
        token: bundle.rtcToken
      });

      const targets = uniqueTargets(
        payload.signaling.targets.filter((target) => target !== bundle.uid)
      );

      if (targets.length > 0) {
        try {
          await sendPeerSignal(targets, {
            ...payload.signaling.invite,
            from: bundle.uid,
            ts: Date.now()
          });
        } catch (signalError) {
          console.warn('⚠️ Falha ao enviar convite RTM:', signalError);
        }
      }

      const nextActive: ActiveCallContext = {
        callId: payload.call.id,
        channelName: payload.call.channelName,
        participants: payload.participants ?? [],
        localBundle: bundle,
        payload,
        isOutgoing: true
      };
      setActiveCall(nextActive);
      activeCallRef.current = nextActive;

      return payload;
    },
    [
      apiBaseUrl,
      currentUser,
      ensureRtmLoggedIn,
      joinChannel,
      options?.clientVersion,
      schemaVersion,
      sendPeerSignal
    ]
  );

  const answerIncomingCall = useCallback(async (): Promise<void> => {
    if (!incomingInvite) {
      throw new Error('Nenhuma chamada pendente para atendimento');
    }

    if (!currentUser || currentUser.userType !== 'morador') {
      throw new Error('Somente moradores podem atender chamadas');
    }

    setError(null);

    // Call answer endpoint which now returns tokens, eliminating extra round-trip
    const answerResponse = await apiRequest<{
      call: Record<string, any>;
      participants: any[];
      tokens?: AgoraTokenBundle;
    }>(apiBaseUrl, `/api/calls/${incomingInvite.signal.callId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.id,
        userType: 'resident'
      })
    });

    // Use tokens from answer response if available, otherwise fetch separately (backward compatibility)
    const bundle = answerResponse.data?.tokens
      ? answerResponse.data.tokens
      : await fetchTokenForCall(apiBaseUrl, {
          callId: incomingInvite.signal.callId,
          uid: currentUser.id,
          role: 'publisher'
        });

    await ensureRtmLoggedIn(bundle);

    const participants = toParticipantList(answerResponse.data?.participants);

    await joinChannel({
      channelName: incomingInvite.signal.channel,
      uid: bundle.uid,
      token: bundle.rtcToken
    });

    const targets = uniqueTargets(
      (participants.length > 0
        ? participants
        : incomingInvite.participants ?? []
      )
        .map((participant) => participant.userId)
        .filter((userId) => userId !== currentUser.id)
    );

    if (targets.length > 0) {
      const answerSignal: RtmSignal = {
        t: 'ANSWER',
        v: incomingInvite.signal.v ?? schemaVersion,
        callId: incomingInvite.signal.callId,
        from: currentUser.id,
        ts: Date.now()
      };

      try {
        await sendPeerSignal(targets, answerSignal);
      } catch (signalError) {
        console.warn('⚠️ Falha ao enviar sinal de ANSWER:', signalError);
      }
    }

    setIncomingInvite(null);
    setCallState('connecting');

    const nextActive: ActiveCallContext = {
      callId: incomingInvite.signal.callId,
      channelName: incomingInvite.signal.channel,
      participants: participants.length > 0 ? participants : incomingInvite.participants ?? [],
      localBundle: bundle,
      payload: answerResponse.data
        ? {
            call: {
              id: incomingInvite.signal.callId,
              channelName: incomingInvite.signal.channel,
              status: answerResponse.data.call?.status ?? 'connecting',
              startedAt: answerResponse.data.call?.startedAt ?? answerResponse.data.call?.started_at ?? null,
              endedAt: answerResponse.data.call?.endedAt ?? answerResponse.data.call?.ended_at ?? null,
              initiatorId: answerResponse.data.call?.doormanId ?? answerResponse.data.call?.doorman_id ?? incomingInvite.signal.from,
              apartmentNumber:
                answerResponse.data.call?.apartmentNumber ??
                answerResponse.data.call?.apartment_number ??
                null,
              buildingId:
                answerResponse.data.call?.buildingId ??
                answerResponse.data.call?.building_id ??
                null,
              context: incomingInvite.signal.context ?? null
            },
            participants,
            tokens: {
              initiator: bundle
            },
            signaling: {
              invite: incomingInvite.signal,
              targets,
              pushFallback: []
            },
            metadata: {
              schemaVersion: incomingInvite.signal.v ?? schemaVersion,
              clientVersion: options?.clientVersion ?? null
            }
          }
        : undefined,
      isOutgoing: false
    };
    setActiveCall(nextActive);
    activeCallRef.current = nextActive;
  }, [
    apiBaseUrl,
    currentUser,
    ensureRtmLoggedIn,
    incomingInvite,
    joinChannel,
    options?.clientVersion,
    schemaVersion,
    sendPeerSignal
  ]);

  const declineIncomingCall = useCallback(
    async (reason: string = 'declined'): Promise<void> => {
      if (!incomingInvite) {
        return;
      }

      if (!currentUser) {
        return;
      }

      await apiRequest(apiBaseUrl, `/api/calls/${incomingInvite.signal.callId}/decline`, {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.id,
          userType: currentUser.userType === 'morador' ? 'resident' : currentUser.userType,
          reason
        })
      });

      try {
        await sendPeerSignal(
          [incomingInvite.from],
          {
            t: 'DECLINE',
            v: incomingInvite.signal.v ?? schemaVersion,
            callId: incomingInvite.signal.callId,
            from: currentUser.id,
            ts: Date.now(),
            reason
          }
        );
      } catch (signalError) {
        console.warn('⚠️ Falha ao enviar sinal DECLINE:', signalError);
      }

      setIncomingInvite(null);
      setCallState('idle');
    },
    [apiBaseUrl, currentUser, incomingInvite, schemaVersion, sendPeerSignal]
  );

  const endActiveCall = useCallback(
    async (cause: 'hangup' | 'drop' | 'timeout' = 'hangup'): Promise<void> => {
      if (!activeCall || !currentUser) {
        return;
      }

      const callId = activeCall.callId;

      await apiRequest(apiBaseUrl, `/api/calls/${callId}/end`, {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.id,
          userType: currentUser.userType === 'morador' ? 'resident' : currentUser.userType,
          cause
        })
      });

      const targets = activeCall.participants
        .map((participant) => participant.userId)
        .filter((id) => id && id !== currentUser.id);

      if (targets.length > 0) {
        try {
          await sendPeerSignal(
            uniqueTargets(targets),
            {
              t: 'END',
              v: activeCall.payload?.metadata?.schemaVersion ?? schemaVersion,
              callId,
              from: currentUser.id,
              ts: Date.now(),
              cause
            }
          );
        } catch (signalError) {
          console.warn('⚠️ Falha ao enviar sinal END:', signalError);
        }
      }

      await leaveChannel();
      setCallState('ending');
      setActiveCall(null);
      activeCallRef.current = null;
    },
    [activeCall, apiBaseUrl, currentUser, leaveChannel, schemaVersion, sendPeerSignal]
  );

  const toggleMute = useCallback(async (): Promise<void> => {
    if (!engineRef.current) {
      return;
    }

    const nextMuted = !isMuted;
    const result = engineRef.current.muteLocalAudioStream(nextMuted);
    if (result !== 0) {
      throw new Error(`Falha ao alternar microfone (código ${result})`);
    }

    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleSpeaker = useCallback(async (): Promise<void> => {
    if (!engineRef.current) {
      return;
    }

    const nextSpeaker = !isSpeakerOn;
    const result = engineRef.current.setDefaultAudioRouteToSpeakerphone(nextSpeaker);
    if (result !== 0) {
      throw new Error(`Falha ao alternar alto-falante (código ${result})`);
    }

    setIsSpeakerOn(nextSpeaker);
  }, [isSpeakerOn]);

  const cleanup = useCallback(async (): Promise<void> => {
    try {
      await leaveChannel();
    } catch (cleanupError) {
      console.warn('⚠️ Falha ao sair do canal durante cleanup:', cleanupError);
    }

    if (engineRef.current) {
      try {
        engineRef.current.release();
      } catch (releaseError) {
        console.warn('⚠️ Falha ao liberar engine RTC:', releaseError);
      }
      engineRef.current = null;
    }

    if (rtmEngineRef.current) {
      try {
        if (rtmStatus === 'connected') {
          await rtmEngineRef.current.logout();
        }
        const destroyClient = (rtmEngineRef.current as unknown as {
          destroyClient?: () => void;
        }).destroyClient;
        if (typeof destroyClient === 'function') {
          destroyClient.call(rtmEngineRef.current);
        }
      } catch (releaseError) {
        console.warn('⚠️ Falha ao liberar engine RTM:', releaseError);
      }
      rtmEngineRef.current = null;
      rtmSessionRef.current = null;
    }

    setEngine(null);
    setRtmEngine(null);
    setActiveCall(null);
    activeCallRef.current = null;
    setIncomingInvite(null);
    setCallState('idle');
    setRtmStatus('disconnected');
    setIsMuted(false);
    setIsSpeakerOn(true);
    setError(null);
  }, [leaveChannel, rtmStatus]);

  const handlePeerMessage = useCallback(
    async (message: RTMPeerMessage): Promise<void> => {
      let parsed: RtmSignal | null = null;
      try {
        parsed = JSON.parse(message.text) as RtmSignal;
      } catch (parseError) {
        console.warn('⚠️ Mensagem RTM inválida recebida:', message.text, parseError);
        return;
      }

      if (!parsed?.t) {
        return;
      }

      if (activeCall && parsed.callId === activeCall.callId) {
        const nextState = deriveNextStateFromSignal(callState, parsed.t as RtmSignalType);
        setCallState(nextState);

        if (parsed.t === 'END' || parsed.t === 'DECLINE') {
          await leaveChannel();
          setActiveCall(null);
        }
        return;
      }

      if (parsed.t === 'INVITE' && currentUser?.userType === 'morador') {
        if (incomingInvite?.signal.callId === parsed.callId) {
          return;
        }

        const status = await fetchCallStatus(apiBaseUrl, parsed.callId).catch(() => null);

        setIncomingInvite({
          signal: parsed,
          from: message.peerId,
          participants: toParticipantList(status?.participants),
          callSummary: status
            ? {
                callId: parsed.callId,
                apartmentNumber:
                  status.call?.apartmentNumber ??
                  status.call?.apartment_number ??
                  null,
                buildingId:
                  status.call?.buildingId ??
                  status.call?.building_id ??
                  null,
                doormanName:
                  status.call?.doormanName ??
                  status.call?.doorman_name ??
                  null
              }
            : { callId: parsed.callId }
        });
        setCallState('ringing');
      }
    },
    [activeCall, apiBaseUrl, callState, currentUser?.userType, incomingInvite, leaveChannel]
  );

  useEffect(() => {
    let messageSubscription: { remove: () => void } | null = null;
    let connectionSubscription: { remove: () => void } | null = null;

    const attach = async () => {
      if (!rtmEngineRef.current) {
        return;
      }

      messageSubscription = rtmEngineRef.current.addListener(
        'messageReceived',
        (message: RTMPeerMessage) => {
          void handlePeerMessage(message);
        }
      );

      connectionSubscription = rtmEngineRef.current.addListener(
        'connectionStateChanged',
        ({ state }: RtmConnectionState) => {
          const mapped: RtmStatus =
            state === RtmConnectionState.CONNECTED
              ? 'connected'
              : state === RtmConnectionState.CONNECTING
                ? 'connecting'
                : 'disconnected';
          setRtmStatus(mapped);
        }
      );
    };

    void attach();

    return () => {
      messageSubscription?.remove();
      connectionSubscription?.remove();
    };
  }, [handlePeerMessage]);

  // RTM auto-reconnection with exponential backoff
  useEffect(() => {
    if (rtmStatus !== 'disconnected' || !currentUser || !rtmSessionRef.current) {
      return;
    }

    const maxRetries = 5;
    const baseDelay = 2000; // 2 seconds
    let retryCount = 0;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const attemptReconnect = async () => {
      if (!isMounted || retryCount >= maxRetries) {
        if (retryCount >= maxRetries) {
          console.error('❌ [useAgora] RTM reconnection failed after', maxRetries, 'attempts');
          setError('RTM connection lost. Please restart the app.');
        }
        return;
      }

      const delay = baseDelay * Math.pow(2, retryCount);
      retryCount++;
      console.log(`🔄 [useAgora] Attempting RTM reconnection (${retryCount}/${maxRetries}) in ${delay}ms...`);

      reconnectTimer = setTimeout(async () => {
        if (!isMounted || !rtmSessionRef.current) {
          return;
        }

        try {
          console.log(`🔄 [useAgora] Reconnecting RTM... (attempt ${retryCount})`);
          const engine = await ensureRtmEngine();
          await engine.loginV2(rtmSessionRef.current.uid, rtmSessionRef.current.token);
          console.log('✅ [useAgora] RTM reconnected successfully');
          retryCount = 0; // Reset retry count on success
        } catch (error) {
          console.warn(`⚠️ [useAgora] RTM reconnection attempt ${retryCount} failed:`, error);
          // Schedule next retry
          if (isMounted && retryCount < maxRetries) {
            attemptReconnect();
          }
        }
      }, delay);
    };

    attemptReconnect();

    return () => {
      isMounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [rtmStatus, currentUser, ensureRtmEngine]);

  // RTM token renewal - proactively renew before expiry
  useEffect(() => {
    if (rtmStatus !== 'connected' || !currentUser || !rtmSessionRef.current || !activeCallRef.current) {
      return;
    }

    const session = rtmSessionRef.current;
    if (!session.expiresAt) {
      return;
    }

    // Schedule renewal 30 seconds before expiry
    const expiryTime = new Date(session.expiresAt).getTime();
    const now = Date.now();
    const renewalBuffer = 30000; // 30 seconds
    const timeUntilRenewal = expiryTime - now - renewalBuffer;

    if (timeUntilRenewal <= 0) {
      // Token already expired or about to expire, renew immediately
      console.log('⚠️ [useAgora] RTM token expired or expiring soon, renewing now...');
      void (async () => {
        try {
          const bundle = await fetchTokenForCall(apiBaseUrlRef.current, {
            callId: activeCallRef.current!.callId,
            uid: currentUser.id
          });

          const engine = await ensureRtmEngine();
          await engine.logout();
          await engine.loginV2(bundle.uid, bundle.rtmToken);

          rtmSessionRef.current = {
            uid: bundle.uid,
            token: bundle.rtmToken,
            expiresAt: bundle.expiresAt
          };

          console.log('✅ [useAgora] RTM token renewed successfully');
        } catch (error) {
          console.error('❌ [useAgora] Failed to renew RTM token:', error);
          setError('Token RTM expirado. Encerrando chamada...');
          // Clear call state on RTM token failure
          if (activeCallRef.current) {
            setActiveCall(null);
            activeCallRef.current = null;
            setCallState('ending');
          }
        }
      })();
      return;
    }

    console.log(`⏰ [useAgora] RTM token renewal scheduled in ${Math.floor(timeUntilRenewal / 1000)}s`);

    const renewalTimer = setTimeout(async () => {
      try {
        const bundle = await fetchTokenForCall(apiBaseUrlRef.current, {
          callId: activeCallRef.current!.callId,
          uid: currentUser.id
        });

        const engine = await ensureRtmEngine();
        await engine.logout();
        await engine.loginV2(bundle.uid, bundle.rtmToken);

        rtmSessionRef.current = {
          uid: bundle.uid,
          token: bundle.rtmToken,
          expiresAt: bundle.expiresAt
        };

        console.log('✅ [useAgora] RTM token renewed successfully (scheduled)');
      } catch (error) {
        console.error('❌ [useAgora] Failed to renew RTM token (scheduled):', error);
        setError('Token RTM expirado. Encerrando chamada...');
        // Clear call state on RTM token failure
        if (activeCallRef.current) {
          setActiveCall(null);
          activeCallRef.current = null;
          setCallState('ending');
        }
      }
    }, timeUntilRenewal);

    return () => {
      clearTimeout(renewalTimer);
    };
  }, [rtmStatus, currentUser, activeCall, ensureRtmEngine]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return {
    engine,
    rtmEngine,
    currentUser,
    rtmStatus,
    callState,
    activeCall,
    incomingInvite,
    isJoined,
    isConnecting,
    isMuted,
    isSpeakerOn,
    error,
    setCurrentUser,
    startIntercomCall,
    answerIncomingCall,
    declineIncomingCall,
    endActiveCall,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleSpeaker,
    cleanup
  };
};

export default useAgora;
