import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRtcEngine } from 'react-native-agora';
import RtmEngine, { RtmMessage } from 'agora-react-native-rtm';
import type {
  AgoraTokenBundle,
  CallLifecycleState,
  CallParticipantSnapshot,
  CallStartPayload,
  RtmInviteSignal,
  RtmSignal,
  RtmSignalType,
} from '@porteiroapp/common/calling';
import { deriveNextStateFromSignal } from '~/services/calling';
import agoraAudioService from '~/services/audioService';
import { supabase } from '~/utils/supabase';
import { agoraService } from '~/services/agora/AgoraService';
import { callKeepService } from '~/services/CallKeepService';

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
  checkForActiveCall: (callId: string) => Promise<void>;
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

const apiRequest = async <T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> => {
  // Extract headers from init to avoid overwriting merged headers when spreading ...init
  const { headers: initHeaders, ...restInit } = init;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...restInit,
    headers: {
      'Content-Type': 'application/json',
      ...(initHeaders || {}),
    },
  });

  const raw = (await response
    .json()
    .catch(() => ({ success: response.ok, data: undefined, error: undefined }))) as ApiResponse<T>;

  if (!response.ok) {
    const message = raw.error || raw.message || `HTTP ${response.status}`;
    return {
      success: false,
      error: message,
      message,
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
    participant?.userType ??
    participant?.roleType ??
    null;

  const role: CallParticipantSnapshot['role'] =
    participant?.role ?? (userType === 'porteiro' || userType === 'doorman' ? 'caller' : 'callee');

  const status: CallParticipantSnapshot['status'] =
    participant?.status ?? (participant?.joined_at ? 'connected' : 'invited');

  const rtcUid = toStringId(participant?.rtcUid ?? participant?.rtc_uid ?? userId) ?? userId;
  const rtmId = toStringId(participant?.rtmId ?? participant?.rtm_id ?? userId) ?? userId;

  return {
    userId,
    role,
    status,
    rtcUid,
    rtmId,
    name: participant?.name ?? participant?.full_name ?? participant?.display_name ?? null,
    phone: participant?.phone ?? participant?.mobile ?? null,
    avatarUrl: participant?.avatarUrl ?? participant?.avatar_url ?? null,
    userType: userType ?? undefined,
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
    participants: response.data.participants ?? [],
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
      role: params.role ?? 'publisher',
    }),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
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
      role: params.role ?? 'publisher',
    }),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || 'Não foi possível obter token da chamada'
    );
  }

  return {
    rtcToken: response.data.rtcToken,
    rtmToken: response.data.rtmToken,
    uid: response.data.uid,
    channelName: response.data.channelName,
    rtcRole: response.data.rtcRole,
    issuedAt: response.data.issuedAt,
    expiresAt: response.data.expiresAt,
    ttlSeconds: response.data.ttlSeconds,
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
  const callStateRef = useRef<CallLifecycleState>('idle');
  const currentUserRef = useRef<CurrentUserContext | null>(currentUser);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInviteContext | null>(null);
  const incomingInviteRef = useRef<IncomingInviteContext | null>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<IRtcEngine | null>(null);
  const rtmEngineRef = useRef<RtmEngine | null>(null);
  const rtmSessionRef = useRef<{ uid: string; token: string; expiresAt?: string } | null>(null);
  const prevUserIdRef = useRef<string | undefined>(undefined);
  const isRecoveringCallRef = useRef(false);
  const recoveryCallIdRef = useRef<string | null>(null);

  const agoraAppId = useMemo(() => {
    const resolved = options?.appId ?? process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';
    return resolved;
  }, [options?.appId]);

  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(options?.apiBaseUrl), [options?.apiBaseUrl]);
  const apiBaseUrlRef = useRef(apiBaseUrl);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    apiBaseUrlRef.current = apiBaseUrl;
  }, [apiBaseUrl]);

  useEffect(() => {
    incomingInviteRef.current = incomingInvite;
  }, [incomingInvite]);

  // Configure AgoraService with latest appId and API base URL
  useEffect(() => {
    agoraService.configure({ appId: agoraAppId, apiBaseUrl });
  }, [agoraAppId, apiBaseUrl]);

  // Sync currentUser state with options when parent component updates it
  // Use ref to track previous ID and only update state when ID actually changes
  useEffect(() => {
    const newUserId = options?.currentUser?.id;

    if (newUserId !== prevUserIdRef.current) {
      setCurrentUser(options?.currentUser ?? null);
      prevUserIdRef.current = newUserId;
    }
    // propagate to service
    agoraService.setCurrentUser(options?.currentUser ?? null);
  }, [options?.currentUser]);

  const schemaVersion = options?.schemaVersion ?? 1;

  const initializeRtcEngine = useCallback(async (): Promise<IRtcEngine> => {
    const rtcEngine = await agoraService.ensureRtcEngine();
    engineRef.current = rtcEngine;
    setEngine(rtcEngine);
    return rtcEngine;
  }, []);

  const ensureRtmEngine = useCallback(async (): Promise<RtmEngine> => {
    const engineInstance = await agoraService.ensureRtmEngine();
    rtmEngineRef.current = engineInstance;
    setRtmEngine(engineInstance);
    return engineInstance;
  }, []);

  const ensureRtmLoggedIn = useCallback(
    async (bundle: AgoraTokenBundle): Promise<RtmEngine> => {
      console.log(`🔐 [ensureRtmLoggedIn] Iniciando login RTM para uid: ${bundle.uid}`);
      console.log(`🔐 [ensureRtmLoggedIn] RTM Status atual: ${rtmStatus}`);

      const engineInstance = await ensureRtmEngine();
      const session = rtmSessionRef.current;

      if (session && session.uid === bundle.uid && session.token === bundle.rtmToken && rtmStatus === 'connected') {
        console.log(`✅ [ensureRtmLoggedIn] Já conectado com mesma sessão`);
        return engineInstance;
      }

      console.log(`🔄 [ensureRtmLoggedIn] Fazendo login RTM...`);
      await agoraService.loginRtm({ uid: bundle.uid, rtmToken: bundle.rtmToken, expiresAt: bundle.expiresAt });
      rtmSessionRef.current = { uid: bundle.uid, token: bundle.rtmToken, expiresAt: bundle.expiresAt };
      console.log(`✅ [ensureRtmLoggedIn] Login RTM concluído`);
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

      await initializeRtcEngine();

      const userAccount =
        typeof config.uid === 'string' && config.uid.length > 0
          ? config.uid
          : (toStringId(config.uid) ?? undefined);

      let token = config.token ?? null;

      if (!token && userAccount) {
        const bundle = await fetchTokenBundle(apiBaseUrl, {
          channelName: config.channelName,
          uid: userAccount,
          role: config.role,
        });
        token = bundle.rtcToken;
      }

      if (!token) {
        console.warn('⚠️ Token RTC não fornecido e não foi possível obter um token válido.');
        return;
      }

      if (userAccount) {
        await agoraService.joinChannelWithUserAccount({
          appId: config.appId ?? agoraAppId,
          token,
          channelName: config.channelName,
          userAccount,
        });
      } else {
        const numericUid =
          typeof config.uid === 'number' ? config.uid : Math.floor(Math.random() * 100000);
        await agoraService.joinChannel({ token, channelName: config.channelName, uid: numericUid });
      }
    },
    [agoraAppId, apiBaseUrl, initializeRtcEngine]
  );

  const leaveChannel = useCallback(async (): Promise<void> => {
    try {
      await agoraService.leaveRtcChannel();
    } catch (leaveError) {
      console.error('❌ Erro ao sair do canal:', leaveError);
    } finally {
      setIsJoined(false);
      setIsConnecting(false);
      setCallState((prev) => {
        const next = prev !== 'idle' ? 'ended' : prev;
        if (next === 'ended') {
          setTimeout(() => {
            // Clear activeCall first, then transition state
            // Separate calls to ensure React properly updates dependencies
            setActiveCall(null);
            activeCallRef.current = null;

            setCallState((current) => {
              return current === 'ended' ? 'idle' : current;
            });
          }, 2000);
        }
        return next;
      });
    }
  }, []);

  const sendPeerSignal = useCallback(
    async (targets: string[], signal: RtmSignal): Promise<void> => {
      await agoraService.sendPeerMessage(targets, signal);
    },
    []
  );

  const checkForActiveCall = useCallback(
    async (callId: string): Promise<void> => {
      // Guard: prevent duplicate recovery attempts
      if (isRecoveringCallRef.current && recoveryCallIdRef.current === callId) {
        console.log(`🔄 [checkForActiveCall] Already recovering call ${callId}`);
        return;
      }

      // Guard: don't recover if we already have an incoming invite or active call
      if (incomingInvite?.signal.callId === callId || activeCallRef.current?.callId === callId) {
        console.log(`✅ [checkForActiveCall] Call ${callId} already handled`);
        return;
      }

      console.log(`🔍 [checkForActiveCall] Checking status for call ${callId}`);
      isRecoveringCallRef.current = true;
      recoveryCallIdRef.current = callId;

      try {
        const statusResponse = await fetchCallStatus(apiBaseUrlRef.current, callId);

        // If RTM already handled this call, abort
        if (incomingInvite?.signal.callId === callId || activeCallRef.current?.callId === callId) {
          console.log(`✅ [checkForActiveCall] RTM handled call ${callId} first`);
          return;
        }

        if (!statusResponse?.call) {
          console.log(`⚠️ [checkForActiveCall] No call data for ${callId}`);
          return;
        }

        const callStatus = statusResponse.call.status?.toLowerCase();
        console.log(`📊 [checkForActiveCall] Call ${callId} status: ${callStatus}`);

        // Handle different call states
        switch (callStatus) {
          case 'calling': {
            // Call still ringing - show modal
            console.log(`📞 [checkForActiveCall] Recovering ringing call ${callId}`);

            // Note: Ringtone is handled by IncomingCallModal to avoid duplicate sounds

            // Construct invite signal from call data
            const inviteSignal: RtmInviteSignal = {
              t: 'INVITE',
              v: 1,
              callId: callId,
              from: statusResponse.call.doormanId ?? statusResponse.call.doorman_id ?? '',
              channel: statusResponse.call.channelName ?? statusResponse.call.channel_name ?? '',
              context: statusResponse.call.context ?? null,
              ts: Date.now(),
            };

            // Set incoming invite state to trigger modal
            setIncomingInvite({
              signal: inviteSignal,
              from: inviteSignal.from,
              participants: toParticipantList(statusResponse.participants),
              callSummary: {
                callId: callId,
                apartmentNumber: statusResponse.call.apartmentNumber ?? statusResponse.call.apartment_number ?? null,
                buildingId: statusResponse.call.buildingId ?? statusResponse.call.building_id ?? null,
                doormanName: statusResponse.call.doormanName ?? statusResponse.call.doorman_name ?? null,
              },
            });

            setCallState('ringing');
            console.log(`✅ [checkForActiveCall] Modal triggered for call ${callId}`);
            break;
          }

          case 'connecting': {
            // Call already being answered - auto-answer
            console.log(`🔄 [checkForActiveCall] Auto-answering connecting call ${callId}`);

            if (!currentUserRef.current || currentUserRef.current.userType !== 'morador') {
              console.warn('⚠️ Cannot auto-answer: invalid user context');
              return;
            }

            // Fetch tokens and join
            const bundle = await fetchTokenForCall(apiBaseUrlRef.current, {
              callId: callId,
              uid: currentUserRef.current.id,
              role: 'publisher',
            });

            await ensureRtmLoggedIn(bundle);

            const participants = toParticipantList(statusResponse.participants);
            const channelName = statusResponse.call.channelName ?? statusResponse.call.channel_name ?? '';

            const nextActive: ActiveCallContext = {
              callId: callId,
              channelName: channelName,
              participants: participants,
              localBundle: bundle,
              isOutgoing: false,
            };

            setCallState('connecting');
            setActiveCall(nextActive);
            activeCallRef.current = nextActive;

            await joinChannel({
              channelName: channelName,
              uid: bundle.uid,
              token: bundle.rtcToken,
            });

            console.log(`✅ [checkForActiveCall] Auto-answered call ${callId}`);
            break;
          }

          case 'connected':
            console.log(`⚠️ [checkForActiveCall] Call ${callId} already connected`);
            break;

          case 'ended':
          case 'declined':
          case 'missed':
          case 'failed':
            console.log(`⚠️ [checkForActiveCall] Call ${callId} already ${callStatus}`);
            break;

          default:
            console.log(`⚠️ [checkForActiveCall] Unknown status: ${callStatus}`);
        }
      } catch (error) {
        console.error(`❌ [checkForActiveCall] Error recovering call ${callId}:`, error);
      } finally {
        isRecoveringCallRef.current = false;
        recoveryCallIdRef.current = null;
      }
    },
    [incomingInvite, ensureRtmLoggedIn, joinChannel]
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
          context: params.context ?? null,
        }),
      });

      if (!response.success || !response.data) {
        setCallState('idle');
        throw new Error(response.error || response.message || 'Falha ao iniciar chamada');
      }

      const payload = response.data;

      const bundle = payload.tokens.initiator;
      await ensureRtmLoggedIn(bundle);

      setCallState('ringing');

      const nextActive: ActiveCallContext = {
        callId: payload.call.id,
        channelName: payload.call.channelName,
        participants: payload.participants ?? [],
        localBundle: bundle,
        payload,
        isOutgoing: true,
      };
      setActiveCall(nextActive);
      activeCallRef.current = nextActive;

      try {
        await joinChannel({
          channelName: payload.call.channelName,
          uid: bundle.uid,
          token: bundle.rtcToken,
        });
      } catch (err) {
        setActiveCall(null);
        activeCallRef.current = null;
        setCallState('idle');
        throw err;
      }

      const targets = uniqueTargets(
        payload.signaling.targets.filter((target) => target !== bundle.uid)
      );

      if (targets.length > 0) {
        try {
          console.log(`📤 Tentando enviar convite RTM para ${targets.length} alvos:`, targets);
          console.log(`📤 RTM Status atual: ${rtmStatus}`);
          await sendPeerSignal(targets, {
            ...payload.signaling.invite,
            from: bundle.uid,
            ts: Date.now(),
          });
          console.log(`✅ Convite RTM enviado com sucesso`);
        } catch (signalError) {
          console.error('⚠️ Falha ao enviar convite RTM:', signalError);
          console.error('   Erro detalhado:', JSON.stringify(signalError, null, 2));
          console.error('   RTM Status:', rtmStatus);
          console.error('   Alvos:', targets);
        }
      }

      

      return payload;
    },
    [apiBaseUrl, currentUser, ensureRtmLoggedIn, joinChannel, options?.clientVersion, rtmStatus, schemaVersion, sendPeerSignal]
  );

  const answerIncomingCall = useCallback(async (): Promise<void> => {
    console.log('[useAgora] ========================================');
    console.log('[useAgora] 📞 answerIncomingCall() STARTED');
    console.log('[useAgora] incomingInvite:', incomingInvite ? {
      callId: incomingInvite.signal.callId,
      from: incomingInvite.from,
      channel: incomingInvite.signal.channel
    } : null);
    console.log('[useAgora] currentUser:', currentUser ? {
      id: currentUser.id,
      userType: currentUser.userType
    } : null);

    if (!incomingInvite) {
      console.error('[useAgora] ❌ No incoming invite found!');
      throw new Error('Nenhuma chamada pendente para atendimento');
    }

    if (!currentUser || currentUser.userType !== 'morador') {
      console.error('[useAgora] ❌ Invalid user - not a morador');
      throw new Error('Somente moradores podem atender chamadas');
    }

    console.log('[useAgora] ✅ Pre-checks passed');
    setError(null);

    // Call answer endpoint which now returns tokens, eliminating extra round-trip
    console.log('[useAgora] Step 1: Calling answer API endpoint...');
    console.log('[useAgora] API URL:', `${apiBaseUrl}/api/calls/${incomingInvite.signal.callId}/answer`);

    const answerResponse = await apiRequest<{
      call: Record<string, any>;
      participants: any[];
      tokens?: AgoraTokenBundle;
    }>(apiBaseUrl, `/api/calls/${incomingInvite.signal.callId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.id,
        userType: 'resident',
      }),
    });

    console.log('[useAgora] ✅ Answer API response received:', {
      success: answerResponse.success,
      hasTokens: !!answerResponse.data?.tokens,
      participantCount: answerResponse.data?.participants?.length || 0
    });

    // Use tokens from answer response if available, otherwise fetch separately (backward compatibility)
    const bundle = answerResponse.data?.tokens
      ? answerResponse.data.tokens
      : await fetchTokenForCall(apiBaseUrl, {
          callId: incomingInvite.signal.callId,
          uid: currentUser.id,
          role: 'publisher',
        });

    await ensureRtmLoggedIn(bundle);

    const participants = toParticipantList(answerResponse.data?.participants);

    const targets = uniqueTargets(
      (participants.length > 0 ? participants : (incomingInvite.participants ?? []))
        .map((participant) => participant.userId)
        .filter((userId) => userId !== currentUser.id)
    );

    // Build activeCall context BEFORE joining channel
    const nextActive: ActiveCallContext = {
      callId: incomingInvite.signal.callId,
      channelName: incomingInvite.signal.channel,
      participants: participants.length > 0 ? participants : (incomingInvite.participants ?? []),
      localBundle: bundle,
      payload: answerResponse.data
        ? {
            call: {
              id: incomingInvite.signal.callId,
              channelName: incomingInvite.signal.channel,
              status: answerResponse.data.call?.status ?? 'connecting',
              startedAt:
                answerResponse.data.call?.startedAt ?? answerResponse.data.call?.started_at ?? null,
              endedAt:
                answerResponse.data.call?.endedAt ?? answerResponse.data.call?.ended_at ?? null,
              initiatorId:
                answerResponse.data.call?.doormanId ??
                answerResponse.data.call?.doorman_id ??
                incomingInvite.signal.from,
              apartmentNumber:
                answerResponse.data.call?.apartmentNumber ??
                answerResponse.data.call?.apartment_number ??
                null,
              buildingId:
                answerResponse.data.call?.buildingId ??
                answerResponse.data.call?.building_id ??
                null,
              context: incomingInvite.signal.context ?? null,
            },
            participants,
            tokens: {
              initiator: bundle,
            },
            signaling: {
              invite: incomingInvite.signal,
              targets,
              pushFallback: [],
            },
            metadata: {
              schemaVersion: incomingInvite.signal.v ?? schemaVersion,
              clientVersion: options?.clientVersion ?? null,
            },
          }
        : undefined,
      isOutgoing: false,
    };

    // Set all state BEFORE joining channel so rtcJoinSuccess sees correct state
    console.log('[useAgora] Step 3: Setting state and joining Agora channel...');
    console.log('[useAgora] - Clearing incomingInvite');
    console.log('[useAgora] - Setting callState to: connecting');
    console.log('[useAgora] - Setting activeCall with callId:', nextActive.callId);

    setIncomingInvite(null);
    setCallState('connecting');
    setActiveCall(nextActive);
    activeCallRef.current = nextActive;

    console.log('[useAgora] Step 4: Calling joinChannel()...');
    console.log('[useAgora] Join params:', {
      channelName: incomingInvite.signal.channel,
      uid: bundle.uid,
      hasToken: !!bundle.rtcToken
    });

    await joinChannel({
      channelName: incomingInvite.signal.channel,
      uid: bundle.uid,
      token: bundle.rtcToken,
    });

    console.log('[useAgora] ✅ joinChannel() completed!');

    if (targets.length > 0) {
      const answerSignal: RtmSignal = {
        t: 'ANSWER',
        v: incomingInvite.signal.v ?? schemaVersion,
        callId: incomingInvite.signal.callId,
        from: currentUser.id,
        ts: Date.now(),
      };

      try {
        await sendPeerSignal(targets, answerSignal);
      } catch (signalError) {
        console.warn('⚠️ Falha ao enviar sinal de ANSWER:', signalError);
      }
    }
  }, [
    apiBaseUrl,
    currentUser,
    ensureRtmLoggedIn,
    incomingInvite,
    joinChannel,
    options?.clientVersion,
    schemaVersion,
    sendPeerSignal,
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
          reason,
        }),
      });

      try {
        await sendPeerSignal([incomingInvite.from], {
          t: 'DECLINE',
          v: incomingInvite.signal.v ?? schemaVersion,
          callId: incomingInvite.signal.callId,
          from: currentUser.id,
          ts: Date.now(),
          reason,
        });
      } catch (signalError) {
        console.warn('⚠️ Falha ao enviar sinal DECLINE:', signalError);
      }

      setIncomingInvite(null);
      setCallState('idle');
      // Dismiss native call UI if visible (reject before connected)
      try { await callKeepService.rejectCall(incomingInvite.signal.callId); } catch {}
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
          cause,
        }),
      });

      const targets = activeCall.participants
        .map((participant) => participant.userId)
        .filter((id) => id && id !== currentUser.id);

      if (targets.length > 0) {
        try {
          await sendPeerSignal(uniqueTargets(targets), {
            t: 'END',
            v: activeCall.payload?.metadata?.schemaVersion ?? schemaVersion,
            callId,
            from: currentUser.id,
            ts: Date.now(),
            cause,
          });
        } catch (signalError) {
          console.warn('⚠️ Falha ao enviar sinal END:', signalError);
        }
      }

      // Set state to 'ending' before leaving channel so UI updates immediately
      // Don't clear activeCall yet - modal needs it to show 'ending' state
      setCallState('ending');

      await leaveChannel();
      // Dismiss native call UI if visible
      try { await callKeepService.endCall(callId); } catch {}
    },
    [activeCall, apiBaseUrl, currentUser, leaveChannel, schemaVersion, sendPeerSignal]
  );

  const toggleMute = useCallback(async (): Promise<void> => {
    const nextMuted = !isMuted;
    await agoraService.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleSpeaker = useCallback(async (): Promise<void> => {
    const nextSpeaker = !isSpeakerOn;
    await agoraService.setSpeakerphoneOn(nextSpeaker);
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
        const destroyClient = (
          rtmEngineRef.current as unknown as {
            destroyClient?: () => void;
          }
        ).destroyClient;
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


  const rtmMessageCallback = useCallback(
    async (message: RtmMessage, peerId: string): Promise<void> => {
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

      // If we're recovering this call via API, let recovery handle it (first response wins)
      if (
        isRecoveringCallRef.current &&
        recoveryCallIdRef.current === parsed.callId &&
        parsed.t === 'INVITE'
      ) {
        console.log(`⏭️ [RTM] Skipping INVITE for ${parsed.callId} - recovery in progress`);
        return;
      }

      if (activeCall && parsed.callId === activeCall.callId) {
        const nextState = deriveNextStateFromSignal(callState, parsed.t as RtmSignalType);
        setCallState(nextState);

        if (parsed.t === 'END' || parsed.t === 'DECLINE') {
          // Don't clear activeCall here - let leaveChannel handle it after timer
          await leaveChannel();
          // Ensure native UI is dismissed
          try { await callKeepService.endCall(parsed.callId); } catch {}
        }
        return;
      }

      if (incomingInvite?.signal.callId === parsed.callId) {
        if (parsed.t === 'END' || parsed.t === 'DECLINE') {
          setIncomingInvite(null);

          const nextState = deriveNextStateFromSignal(callState, parsed.t as RtmSignalType);
          setCallState((prev) => {
            if (prev === nextState) {
              return prev;
            }
            return nextState;
          });

          try {
            await agoraAudioService.stopRingtone();
          } catch (stopError) {
            console.warn('⚠️ Falha ao parar ringtone após cancelamento:', stopError);
          }

          // Dismiss native UI for incoming cancel/decline before connected
          try { await callKeepService.endCall(parsed.callId); } catch {}

          if (nextState === 'ended' || nextState === 'declined') {
            setTimeout(() => {
              setCallState((current) => (current === nextState ? 'idle' : current));
            }, 2000);
          }

          return;
        }
      }

      if (parsed.t === 'INVITE' && currentUser?.userType === 'morador') {
        if (incomingInvite?.signal.callId === parsed.callId) {
          return;
        }

        const status = await fetchCallStatus(apiBaseUrl, parsed.callId).catch(() => null);

        setIncomingInvite({
          signal: parsed,
          from: peerId,
          participants: toParticipantList(status?.participants),
          callSummary: status
            ? {
                callId: parsed.callId,
                apartmentNumber:
                  status.call?.apartmentNumber ?? status.call?.apartment_number ?? null,
                buildingId: status.call?.buildingId ?? status.call?.building_id ?? null,
                doormanName: status.call?.doormanName ?? status.call?.doorman_name ?? null,
              }
            : { callId: parsed.callId },
        });
        setCallState('ringing');
      }
    },
    [activeCall, apiBaseUrl, callState, currentUser?.userType, incomingInvite, leaveChannel]
  );

  // Subscribe to AgoraService RTM status and messages
  useEffect(() => {
    const offStatus = agoraService.on('status', (s) => setRtmStatus(s));
    const offMsg = agoraService.on('rtmMessage', ({ message, peerId }) => {
      void rtmMessageCallback(message, peerId);
    });
    return () => {
      offStatus();
      offMsg();
    };
  }, [rtmMessageCallback]);

  // Check for pending incoming calls stored by background task
  useEffect(() => {
    const checkPendingIncomingCall = async () => {
      try {
        const pendingCallData = await AsyncStorage.getItem('@pending_intercom_call');

        if (pendingCallData) {
          console.log('[useAgora] Found pending call from background task');
          const callData = JSON.parse(pendingCallData);

          // Check if call is still recent (not expired)
          const age = Date.now() - (callData.timestamp || 0);
          if (age < 60000) { // 60 seconds
            console.log('[useAgora] Displaying pending call:', callData);

            // Create an incoming invite context to trigger the UI
            const inviteSignal: RtmInviteSignal = {
              t: 'INVITE',
              v: schemaVersion,
              callId: callData.callId,
              channel: callData.channel ?? callData.channelName,
              from: callData.from,
              ts: callData.timestamp,
            };

            setIncomingInvite({
              signal: inviteSignal,
              from: callData.from,
              callSummary: {
                callId: callData.callId,
                apartmentNumber: callData.apartmentNumber,
                doormanName: callData.callerName,
                buildingId: null,
              },
            });

            console.log('[useAgora] ✅ Pending call restored from storage');
          } else {
            console.log('[useAgora] ⚠️ Pending call expired (age:', age, 'ms)');
          }

          // Clear stored data
          await AsyncStorage.removeItem('@pending_intercom_call');
        }
      } catch (error) {
        console.error('[useAgora] Error checking pending call:', error);
      }
    };

    checkPendingIncomingCall();
  }, [schemaVersion]); // Run once on mount

  // Wire CallKeep events to Agora call actions
  useEffect(() => {
    // Register CallKeep answer handler
    callKeepService.setOnAnswer(async ({ callUUID }: { callUUID: string }) => {
      console.log('[useAgora] ========================================');
      console.log('[useAgora] 🎯 ANSWER HANDLER TRIGGERED');
      console.log('[useAgora] callUUID:', callUUID);
      console.log('[useAgora] Current user:', currentUserRef.current?.id, currentUserRef.current?.userType);
      console.log('[useAgora] Has incoming invite:', !!incomingInviteRef.current);

      // Stop any custom ringtone immediately
      try {
        await agoraAudioService.stopIntercomRingtone();
        console.log('[useAgora] ✅ Ringtone stopped');
      } catch (err) {
        console.error('[useAgora] ❌ Failed to stop ringtone:', err);
      }

      const currentInvite = incomingInviteRef.current;

      // CASE 1: App already has invite in memory
      if (currentInvite && currentInvite.signal.callId === callUUID) {
        console.log('[useAgora] ✅ Found matching incoming invite in memory');
        try {
          await answerIncomingCall();
          console.log('[useAgora] ✅ Call answered successfully (warm state)');
        } catch (err) {
          console.error('[useAgora] ❌ answerIncomingCall() failed:', err);
          console.error('[useAgora] Error stack:', err instanceof Error ? err.stack : 'No stack');
        }
        console.log('[useAgora] 🎯 ANSWER HANDLER COMPLETE');
        console.log('[useAgora] ========================================');
        return;
      }

      // CASE 2: Cold start scenario
      console.log('[useAgora] ⚠️ No incoming invite in memory - treating as cold start');
      console.log('[useAgora] Checking AsyncStorage for pending call data...');

      try {
        const pendingCallData = await AsyncStorage.getItem('@pending_intercom_call');

        if (!pendingCallData) {
          console.error('[useAgora] ❌ No pending call data in AsyncStorage');
          await callKeepService.reportEndCall(callUUID, 1);
          Alert.alert('Call Failed', 'Could not retrieve call information. Please try again.');
          console.log('[useAgora] 🎯 ANSWER HANDLER COMPLETE');
          console.log('[useAgora] ========================================');
          return;
        }

        const callData = JSON.parse(pendingCallData);
        console.log('[useAgora] 📋 Found pending call:', callData);

        // Wait for RTM invite to arrive (up to 5 seconds)
        console.log('[useAgora] ⏳ Waiting for RTM invite (max 5s)...');
        const success = await new Promise<boolean>((resolve) => {
          const startTime = Date.now();
          const maxWaitTime = 5000;

          const checkInterval = setInterval(() => {
            const latestInvite = incomingInviteRef.current;
            if (latestInvite?.signal?.callId === callUUID) {
              clearInterval(checkInterval);
              console.log('[useAgora] 🎉 RTM invite received!');
              resolve(true);
              return;
            }

            if (Date.now() - startTime >= maxWaitTime) {
              clearInterval(checkInterval);
              console.error('[useAgora] ❌ Timeout waiting for RTM invite');
              resolve(false);
            }
          }, 200);
        });

        if (success) {
          try {
            console.log('[useAgora] 🚀 Answering call after RTM invite arrived...');
            await answerIncomingCall();
            console.log('[useAgora] ✅ Call answered successfully (cold start)');
          } catch (err) {
            console.error('[useAgora] ❌ answerIncomingCall() failed after RTM:', err);
            console.error('[useAgora] Error stack:', err instanceof Error ? err.stack : 'No stack');
          }
        } else {
          await callKeepService.reportEndCall(callUUID, 1);
          Alert.alert(
            'Connection Failed',
            'Could not connect to the call. The call may have ended or there may be a network issue.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('[useAgora] ❌ Error in cold start answer handler:', error);
        await callKeepService.reportEndCall(callUUID, 1);
        Alert.alert(
          'Call Error',
          'An error occurred while connecting to the call. Please try again.',
          [{ text: 'OK' }]
        );
      }

      console.log('[useAgora] 🎯 ANSWER HANDLER COMPLETE');
      console.log('[useAgora] ========================================');
    });

    // Register CallKeep end handler
    callKeepService.setOnEnd(async ({ callUUID }: { callUUID: string }) => {
      console.log('[useAgora] ========================================');
      console.log('[useAgora] 🎯 END HANDLER TRIGGERED');
      console.log('[useAgora] callUUID:', callUUID);
      console.log('[useAgora] Has incoming invite:', !!incomingInviteRef.current);
      console.log('[useAgora] Has active call:', !!activeCallRef.current);

      console.log('[useAgora] Stopping ringtone...');
      try {
        await agoraAudioService.stopIntercomRingtone();
      } catch (err) {
        console.error('[useAgora] Failed to stop ringtone:', err);
      }

      if (incomingInviteRef.current) {
        console.log('[useAgora] Found incoming invite, declining...');
        try {
          await declineIncomingCall('User declined');
          console.log('[useAgora] ✅ Call declined');
        } catch (err) {
          console.error('[useAgora] ❌ Failed to decline call:', err);
        }
      } else if (activeCallRef.current) {
        console.log('[useAgora] Found active call, ending...');
        try {
          await endActiveCall();
          console.log('[useAgora] ✅ Call ended');
        } catch (err) {
          console.error('[useAgora] ❌ Failed to end call:', err);
        }
      } else {
        console.log('[useAgora] ⚠️ No incoming invite or active call found');
      }

      // Clear any pending call data
      console.log('[useAgora] Clearing AsyncStorage...');
      await AsyncStorage.removeItem('@pending_intercom_call');
      console.log('[useAgora] ✅ AsyncStorage cleared');

      console.log('[useAgora] 🎯 END HANDLER COMPLETE');
      console.log('[useAgora] ========================================');
    });

    // Register CallKeep mute toggle handler - wire to Agora
    callKeepService.setOnToggleMute(async ({ muted, callUUID }: { muted: boolean; callUUID: string }) => {
      console.log('[useAgora] CallKeep: Mute toggled', { muted, callUUID });

      try {
        // Update Agora mute state
        await agoraService.setMuted(muted);
        // Update local state to keep UI in sync
        setIsMuted(muted);
        console.log(`[useAgora] ✅ Agora audio ${muted ? 'muted' : 'unmuted'}`);
      } catch (error) {
        console.error('[useAgora] ❌ Failed to toggle mute:', error);
      }
    });

    return () => {
      // Cleanup is handled by CallKeepService
    };
  }, [answerIncomingCall, declineIncomingCall, endActiveCall]);

  // Stop native + custom ringtone when our call becomes connected
  useEffect(() => {
    if (callState === 'connected') {
      const uuid = activeCall?.callId ?? undefined;
      callKeepService.reportConnectedCall(uuid).catch(() => undefined);
      try { void agoraAudioService.stopIntercomRingtone(); } catch {}
    }
  }, [callState, activeCall?.callId]);

  useEffect(() => {
    if (!incomingInvite || currentUser?.userType !== 'morador') {
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let consecutiveFailures = 0;

    const mapCallStatusToLifecycle = (status?: string | null): CallLifecycleState => {
      const normalized = (status ?? '').toLowerCase();
      switch (normalized) {
        case 'declined':
          return 'declined';
        case 'missed':
        case 'timeout':
        case 'timed_out':
          return 'missed';
        case 'failed':
        case 'error':
        case 'unavailable':
          return 'failed';
        default:
          return 'ended';
      }
    };

    const finalizeInvite = (nextState: CallLifecycleState) => {
      if (cancelled) {
        return;
      }

      cancelled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      setIncomingInvite(null);
      setCallState((prev) => {
        if (prev === 'ringing' || prev === 'connecting' || prev === 'dialing') {
          return nextState;
        }
        return prev;
      });

      void agoraAudioService.stopRingtone().catch((stopError) => {
        console.warn('⚠️ Falha ao parar ringtone após verificação de status da chamada:', stopError);
      });

      if (nextState === 'ended' || nextState === 'declined' || nextState === 'missed' || nextState === 'failed') {
        setTimeout(() => {
          setCallState((current) => (current === nextState ? 'idle' : current));
        }, 2000);
      }
    };

    const checkStatus = async () => {
      let statusResponse: CallStatusResponse | null = null;

      try {
        statusResponse = await fetchCallStatus(apiBaseUrlRef.current, incomingInvite.signal.callId);
      } catch (statusError) {
        console.warn('⚠️ Falha ao verificar status da chamada:', statusError);
      }

      if (cancelled) {
        return;
      }

      if (!statusResponse) {
        consecutiveFailures += 1;

        if (consecutiveFailures >= 2) {
          finalizeInvite('ended');
        }

        return;
      }

      consecutiveFailures = 0;

      const status = typeof statusResponse.call?.status === 'string' ? statusResponse.call.status : null;

      if (!status || status.toLowerCase() !== 'calling') {
        const nextState = mapCallStatusToLifecycle(status);
        finalizeInvite(nextState);
      }
    };

    void checkStatus();
    pollTimer = setInterval(() => {
      void checkStatus();
    }, 4000);

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }, [incomingInvite, currentUser?.userType]);

  // Subscribe to AgoraService RTC events
  useEffect(() => {
    const offJoin = agoraService.on('rtcJoinSuccess', ({ channelId }) => {
      setIsJoined(true);
      setIsConnecting(false);
      setError(null);
      setCallState((prev) => {
        // Doorman starting call: ringing → connecting (waits for resident to join)
        if (prev === 'ringing') {
          return 'connecting';
        }
        // Resident answering: connecting → connected (already joined after doorman)
        if (prev === 'connecting' && activeCallRef.current) {
          return 'connected';
        }
        return prev;
      });
    });

    const offLeave = agoraService.on('rtcLeave', ({ channelId }) => {
      setIsJoined(false);
      setIsConnecting(false);
      setCallState((prev) => {
        // Transition to 'ended' for any active call state (not just ending/connected/connecting)
        const isActiveCallState = prev === 'ending' || prev === 'connected' || prev === 'connecting' || prev === 'ringing' || prev === 'dialing';
        const nextState = isActiveCallState ? 'ended' : prev;
        
        // Automatically transition from 'ended' to 'idle' after a short delay
        if (nextState === 'ended') {
          setTimeout(() => {
            setCallState((current) => current === 'ended' ? 'idle' : current);
          }, 2000);
        }
        
        return nextState;
      });
    });

    const offUserJoined = agoraService.on('rtcUserJoined', ({ remoteUid }) => {
      setCallState((prev) =>
        prev === 'connecting' || prev === 'ringing' || prev === 'dialing' ? 'connected' : prev
      );
    });

    const offUserOffline = agoraService.on('rtcUserOffline', ({ remoteUid, reason }) => {
      setCallState((prev) => (prev === 'connected' || prev === 'connecting' ? 'ending' : prev));

      const currentState = callStateRef.current;
      const isTerminalState =
        currentState === 'idle' ||
        currentState === 'ended' ||
        currentState === 'declined' ||
        currentState === 'failed' ||
        currentState === 'missed';
      const shouldForceLeave = !activeCallRef.current?.isOutgoing;

      if (!isTerminalState && shouldForceLeave && activeCallRef.current) {
        void leaveChannel();
      }
    });

    const offRtcError = agoraService.on('rtcError', ({ code, message }) => {
      console.error('❌ Erro no Agora RTC:', code, message);
      setError(message || `Erro RTC ${code}`);
      setIsConnecting(false);
      if (activeCallRef.current) {
        setActiveCall(null);
        activeCallRef.current = null;
        setCallState('idle');
      }
    });

    const offRouting = agoraService.on('audioRoutingChanged', ({ routing }) => {
      setIsSpeakerOn(routing === 1);
    });

    const renewRtcToken = async () => {
      const ac = activeCallRef.current;
      const cu = currentUserRef.current;
      if (!ac || !cu) return;
      try {
        const bundle = await fetchTokenForCall(apiBaseUrlRef.current, {
          callId: ac.callId,
          uid: cu.id,
        });
        await agoraService.renewRtcToken(bundle.rtcToken);
      } catch (e) {
        console.error('❌ Falha ao renovar token RTC:', e);
        setError('Token expirado. Encerrando chamada...');
        setActiveCall(null);
        activeCallRef.current = null;
        setCallState('ending');
      }
    };

    const offWillExpire = agoraService.on('rtcTokenPrivilegeWillExpire', renewRtcToken);
    const offRequestToken = agoraService.on('rtcRequestToken', renewRtcToken);

    return () => {
      offJoin();
      offLeave();
      offUserJoined();
      offUserOffline();
      offRtcError();
      offRouting();
      offWillExpire();
      offRequestToken();
    };
  }, [leaveChannel]);

  // Reconnection handled by AgoraService

  // RTM token renewal for active calls - proactively renew before expiry
  useEffect(() => {
    if (
      rtmStatus !== 'connected' ||
      !currentUser ||
      !rtmSessionRef.current ||
      !activeCallRef.current
    ) {
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
            uid: currentUser.id,
          });

          const engine = await ensureRtmEngine();
          await engine.logout();
          await engine.loginV2(bundle.uid, bundle.rtmToken);

          rtmSessionRef.current = {
            uid: bundle.uid,
            token: bundle.rtmToken,
            expiresAt: bundle.expiresAt,
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

    console.log(
      `⏰ [useAgora] RTM token renewal scheduled in ${Math.floor(timeUntilRenewal / 1000)}s`
    );

    const renewalTimer = setTimeout(async () => {
      try {
        const bundle = await fetchTokenForCall(apiBaseUrlRef.current, {
          callId: activeCallRef.current!.callId,
          uid: currentUser.id,
        });

        const engine = await ensureRtmEngine();
        await engine.logout();
        await engine.loginV2(bundle.uid, bundle.rtmToken);

        rtmSessionRef.current = {
          uid: bundle.uid,
          token: bundle.rtmToken,
          expiresAt: bundle.expiresAt,
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

  // Standby renewal handled by AgoraService

  // RTM initialization is now handled by AuthProvider when user authenticates
  // This ensures proper initialization timing and avoids race conditions

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
    cleanup,
    checkForActiveCall,
  };
};

export default useAgora;
