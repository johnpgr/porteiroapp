import * as z from 'zod/v4';
import { supabase } from '~/utils/supabase';

import { Platform } from 'react-native';

const DEFAULT_LOCAL_URL = 'http://localhost:3001';
const DEFAULT_ANDROID_EMULATOR_URL = 'http://10.0.2.2:3001';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? DEFAULT_ANDROID_EMULATOR_URL : DEFAULT_LOCAL_URL);

// Schemas
export const CallParticipantSchema = z.object({
  userId: z.string(),
  status: z.string(),
  joinedAt: z.string().nullable().optional(),
  leftAt: z.string().nullable().optional(),
});

export const CallDetailsSchema = z.object({
  channelName: z.string(),
  participants: z.array(CallParticipantSchema),
  doormanName: z.string().nullable().optional(),
  apartmentNumber: z.string().nullable().optional(),
  buildingId: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
});

export const TokenBundleSchema = z.object({
  rtcToken: z.string(),
  rtmToken: z.string(),
  uid: z.string(),
  channelName: z.string(),
  rtcRole: z.enum(['publisher', 'subscriber']),
  issuedAt: z.string(),
  expiresAt: z.string(),
  ttlSeconds: z.number(),
});

export const AnswerResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    tokens: TokenBundleSchema,
  }).optional(),
  error: z.string().optional(),
});

export const GenericResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export const CallStartResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    call: z.object({
      id: z.string(),
      channelName: z.string().nullable().optional(),
      status: z.string(),
      startedAt: z.string().nullable().optional(),
      apartmentNumber: z.string().nullable().optional(),
      buildingId: z.string().nullable().optional(),
    }).loose(),
    participants: z.array(z.any()).optional(),
    tokens: z.any().optional(),
  }).loose().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export const ActiveCallsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    activeCalls: z.array(z.any()),
  }).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export class InterfoneAPI {
  private static async getHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private static async handleResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const result = schema.safeParse(data);

    if (!result.success) {
      console.error('[InterfoneAPI] Schema validation failed:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  static async getCallDetails(callId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calls/${callId}/status`);
      
      if (!response.ok) return null;
      
      const json = await response.json();
      if (!json.success || !json.data) return null;

      // Map to our schema format
      const participants = (json.data.participants || []).map((p: any) => ({
        userId: p.userId || p.user_id,
        status: p.status,
        joinedAt: p.joinedAt || p.joined_at,
        leftAt: p.leftAt || p.left_at,
      }));

      const callObj = json.data.call || {};
      const details = {
        channelName: callObj.channelName || callObj.channel_name || '',
        participants,
        doormanName: callObj.doormanName || callObj.doorman_name,
        apartmentNumber: callObj.apartmentNumber || callObj.apartment_number,
        buildingId: callObj.buildingId || callObj.building_id,
        status: callObj.status,
        endedAt: callObj.endedAt || callObj.ended_at,
      };

      return CallDetailsSchema.parse(details);
    } catch (error) {
      console.error('[InterfoneAPI] getCallDetails failed:', error);
      return null;
    }
  }

  static async answerCall(callId: string, userId: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/calls/${callId}/answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, userType: 'resident' }),
    });

    return this.handleResponse(response, AnswerResponseSchema);
  }

  static async endCall(callId: string, userId: string, cause: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/calls/${callId}/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, userType: 'resident', cause }),
    });

    return this.handleResponse(response, GenericResponseSchema);
  }

  static async declineCall(callId: string, userId: string, reason: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/calls/${callId}/decline`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, userType: 'resident', reason }),
    });

    return this.handleResponse(response, GenericResponseSchema);
  }

  static async initiateCall(params: {
    apartmentNumber: string;
    buildingId: string;
    doormanId: string;
    doormanName?: string;
  }) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    return this.handleResponse(response, CallStartResponseSchema);
  }

  static async getActiveCalls(buildingId: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/calls/active?buildingId=${encodeURIComponent(buildingId)}`, {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response, ActiveCallsResponseSchema);
  }
}
