import { Platform } from 'react-native';

const DEFAULT_LOCAL_URL = 'http://localhost:3001';
const DEFAULT_ANDROID_EMULATOR_URL = 'https://5302cc59505a.ngrok-free.app/';

const INTERCOM_API_BASE_URL =
  process.env.EXPO_PUBLIC_INTERCOM_API_URL ||
  process.env.EXPO_PUBLIC_INTERFONE_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? DEFAULT_ANDROID_EMULATOR_URL : DEFAULT_LOCAL_URL);

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface InitiateIntercomCallParams {
  apartmentNumber: string;
  buildingId: string;
  doormanId: string;
  doormanName?: string;
}

export interface InitiateIntercomCallResult {
  success: boolean;
  callId?: string;
  channelName?: string | null;
  status?: string;
  startedAt?: string | null;
  participants?: Record<string, any>[];
  apartment?: Record<string, any> | null;
  doorman?: Record<string, any> | null;
  notificationsSent?: number;
  message?: string;
  error?: string;
  raw?: any;
}

export interface RejectIntercomCallParams {
  callId: string;
  userId: string;
  userType?: 'doorman' | 'resident' | 'visitor';
  reason?: 'ended' | 'declined' | 'timeout' | string;
}

async function makeRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${INTERCOM_API_BASE_URL.replace(/\/$/, '')}${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const errorMessage = errorPayload.error || errorPayload.message || `HTTP ${response.status}`;
      console.error('❌ [INTERCOM_API] Request failed:', {
        url,
        status: response.status,
        errorPayload,
      });
      return {
        success: false,
        error: errorMessage,
        message: errorPayload.message,
      };
    }

    const payload = await response.json().catch(() => ({}));
    return payload;
  } catch (error) {
    console.error('❌ [INTERCOM_API] Network error:', { url, error });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Erro de rede ao contatar serviço do interfone',
    };
  }
}

interface StartCallResponse {
  call: any;
  participants?: any[];
  apartment?: any;
  doorman?: any;
  notificationsSent?: number;
  message?: string;
}

interface CallStatusResponse {
  call: {
    id: string;
    channelName?: string | null;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
    duration?: number | null;
    apartmentId?: string | null;
    apartmentNumber?: string | null;
    buildingId?: string | null;
    buildingName?: string | null;
    doormanId?: string | null;
    doormanName?: string | null;
  };
  participants: any[];
}

export interface AnswerIntercomCallParams {
  callId: string;
  userId: string;
  userType?: 'resident' | 'doorman' | 'visitor';
}

export interface DeclineIntercomCallParams {
  callId: string;
  userId: string;
  userType?: 'resident' | 'doorman' | 'visitor';
  reason?: 'declined' | 'timeout' | string;
}

export async function initiateIntercomCall(
  params: InitiateIntercomCallParams
): Promise<InitiateIntercomCallResult> {
  const response = await makeRequest<StartCallResponse>('/api/calls/start', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!response.success || !response.data?.call) {
    return {
      success: false,
      error: response.error || response.message || 'Não foi possível iniciar a chamada',
      notificationsSent: 0,
      raw: response,
    };
  }

  const {
    call,
    participants = [],
    apartment = null,
    doorman = null,
    notificationsSent = 0,
    message,
  } = response.data;

  return {
    success: true,
    callId: call.id,
    channelName: call.channelName || call.channel_name || null,
    status: call.status,
    startedAt: call.startedAt || call.started_at || null,
    participants,
    apartment,
    doorman,
    notificationsSent,
    message: message || response.message || 'Chamando morador...',
    raw: response,
  };
}

export async function rejectIntercomCall(
  params: RejectIntercomCallParams
): Promise<{ success: boolean; error?: string }> {
  const { callId, userId, userType = 'doorman', reason = 'ended' } = params;

  const endpoint =
    reason === 'declined' ? `/api/calls/${callId}/decline` : `/api/calls/${callId}/end`;

  const response = await makeRequest<{ call: any }>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      userType,
      reason,
    }),
  });

  if (!response.success) {
    return {
      success: false,
      error: response.error || response.message || 'Falha ao encerrar chamada',
    };
  }

  return { success: true };
}

export async function answerIntercomCall(
  params: AnswerIntercomCallParams
): Promise<{ success: boolean; data?: CallStatusResponse; error?: string }> {
  const { callId, userId, userType = 'resident' } = params;

  const response = await makeRequest<CallStatusResponse>(`/api/calls/${callId}/answer`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      userType,
    }),
  });

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || response.message || 'Falha ao atender chamada',
    };
  }

  return {
    success: true,
    data: response.data,
  };
}

export async function declineIntercomCall(
  params: DeclineIntercomCallParams
): Promise<{ success: boolean; error?: string }> {
  const { callId, userId, userType = 'resident', reason = 'declined' } = params;

  const response = await makeRequest<{ call: any }>(`/api/calls/${callId}/decline`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      userType,
      reason,
    }),
  });

  if (!response.success) {
    return {
      success: false,
      error: response.error || response.message || 'Falha ao recusar chamada',
    };
  }

  return { success: true };
}

export async function getIntercomCallStatus(
  callId: string
): Promise<{ success: boolean; data?: CallStatusResponse; error?: string; message?: string }> {
  const response = await makeRequest<CallStatusResponse>(`/api/calls/${callId}/status`);

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || response.message || 'Não foi possível obter status da chamada',
      message: response.message,
    };
  }

  return {
    success: true,
    data: response.data,
  };
}

export const endIntercomCall = rejectIntercomCall;
