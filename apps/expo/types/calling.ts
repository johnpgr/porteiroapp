export type CallLifecycleState =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ending'
  | 'ended'
  | 'declined'
  | 'failed'
  | 'missed';

export type CallParticipantRole = 'caller' | 'callee';

export type CallParticipantStatus =
  | 'initiating'
  | 'invited'
  | 'ringing'
  | 'connected'
  | 'declined'
  | 'missed'
  | 'disconnected';

export interface CallParticipantSnapshot {
  userId: string;
  role: CallParticipantRole;
  status: CallParticipantStatus;
  rtcUid: string;
  rtmId: string;
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  userType?: 'doorman' | 'resident' | 'visitor' | 'admin' | string;
}

export type AgoraTokenRole = 'publisher' | 'subscriber';

export interface AgoraTokenBundle {
  rtcToken: string;
  rtmToken: string;
  uid: string;
  channelName: string;
  rtcRole: AgoraTokenRole;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface RtmInviteSignal {
  t: 'INVITE';
  v: number;
  callId: string;
  from: string;
  channel: string;
  ts: number;
  clientVersion?: string | null;
  context?: unknown;
}

export interface RtmRingingSignal {
  t: 'RINGING';
  v: number;
  callId: string;
  from: string;
  ts: number;
}

export interface RtmAnswerSignal {
  t: 'ANSWER';
  v: number;
  callId: string;
  from: string;
  ts: number;
}

export interface RtmDeclineSignal {
  t: 'DECLINE';
  v: number;
  callId: string;
  from: string;
  ts: number;
  reason?: string;
}

export interface RtmEndSignal {
  t: 'END';
  v: number;
  callId: string;
  from: string;
  ts: number;
  cause?: 'hangup' | 'drop' | 'timeout';
}

export type RtmSignal =
  | RtmInviteSignal
  | RtmRingingSignal
  | RtmAnswerSignal
  | RtmDeclineSignal
  | RtmEndSignal;

export type RtmSignalType = RtmSignal['t'];

export interface CallSummary {
  id: string;
  channelName: string;
  status: string;
  startedAt: string | null;
  endedAt?: string | null;
  initiatorId: string;
  apartmentNumber?: string | null;
  buildingId?: string | null;
  context?: unknown;
}

export interface PushFallbackTarget {
  userId: string;
  pushToken: string;
  name?: string | null;
}

export interface CallStartPayload {
  call: CallSummary;
  participants: CallParticipantSnapshot[];
  tokens: {
    initiator: AgoraTokenBundle;
  };
  signaling: {
    invite: RtmInviteSignal;
    targets: string[];
    pushFallback: PushFallbackTarget[];
  };
  apartment?: {
    id: string;
    number: string;
    block?: string | null;
  };
  doorman?: {
    id: string;
    name: string;
  };
  metadata?: {
    schemaVersion: number;
    clientVersion?: string | null;
  };
  notificationsSent?: number;
  message?: string;
}

export interface CallStartResponse {
  success: boolean;
  data: CallStartPayload;
}
