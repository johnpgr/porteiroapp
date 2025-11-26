import { readFileSync } from 'node:fs';
import type { ClientHttp2Session, ClientHttp2Stream } from 'node:http2';
import * as http2 from 'node:http2';
import jwt from 'jsonwebtoken';

export type ApnsEnvironment = 'production' | 'development';

export interface ApnsClientConfig {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
  environment?: ApnsEnvironment;
}

export interface ApnsSendOptions {
  deviceToken: string;
  payload: Record<string, unknown>;
  pushType?: 'voip' | 'alert' | 'background';
  priority?: '10' | '5';
  expiration?: number;
  topicOverride?: string;
  collapseId?: string;
}

export interface ApnsSendResult {
  success: boolean;
  status: number;
  apnsId?: string;
  body?: unknown;
  error?: string;
}

const APNS_PRODUCTION_HOST = 'https://api.push.apple.com';
const APNS_DEVELOPMENT_HOST = 'https://api.development.push.apple.com';
const JWT_TTL_SECONDS = 50 * 60; // Refresh JWT token every 50 minutes (Apple allows up to 60)
const REQUEST_TIMEOUT_MS = 10_000;

export class ApnsClient {
  private session: ClientHttp2Session | null = null;
  private cachedJwt: string | null = null;
  private cachedJwtExpiresAt = 0;
  private readonly hostUrl: URL;
  private readonly config: ApnsClientConfig;

  constructor(config: ApnsClientConfig) {
    this.config = config;
    const host = config.environment === 'development' ? APNS_DEVELOPMENT_HOST : APNS_PRODUCTION_HOST;
    this.hostUrl = new URL(host);
  }

  async send(options: ApnsSendOptions): Promise<ApnsSendResult> {
    const deviceToken = this.normalizeDeviceToken(options.deviceToken);
    if (!deviceToken) {
      return {
        success: false,
        status: 0,
        error: 'Invalid APNs device token'
      };
    }

    const payload = JSON.stringify(options.payload ?? {});

    try {
      const client = await this.ensureSession();
      const headers = this.buildHeaders(deviceToken, options);

      return await new Promise<ApnsSendResult>((resolve, reject) => {
        let status = 0;
        let apnsId: string | undefined;
        const chunks: Uint8Array[] = [];
        const request: ClientHttp2Stream = client.request(headers);
        let didTimeout = false;

        request.setEncoding('utf8');
        request.setTimeout(REQUEST_TIMEOUT_MS, () => {
          didTimeout = true;
          request.close();
          reject(new Error('APNs request timed out'));
        });

        request.on('response', (responseHeaders) => {
          const statusHeader = responseHeaders[http2.constants.HTTP2_HEADER_STATUS];
          status = typeof statusHeader === 'number' ? statusHeader : Number(statusHeader || 0);
          const apnsHeader = responseHeaders['apns-id'];
          if (typeof apnsHeader === 'string') {
            apnsId = apnsHeader;
          } else if (Array.isArray(apnsHeader) && typeof apnsHeader[0] === 'string') {
            apnsId = apnsHeader[0];
          }
        });

        request.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        request.on('end', () => {
          if (didTimeout) {
            return;
          }

          let body: unknown;
          if (chunks.length > 0) {
            const rawBody = Buffer.concat(chunks).toString('utf8');
            try {
              body = rawBody ? JSON.parse(rawBody) : undefined;
            } catch {
              body = rawBody;
            }
          }

          const success = status >= 200 && status < 300;
          resolve({
            success,
            status,
            apnsId,
            body,
            error: success ? undefined : this.extractError(body)
          });
        });

        request.on('error', (error) => {
          if (!didTimeout) {
            this.resetSession();
            reject(error);
          }
        });

        request.end(payload);
      });
    } catch (error) {
      this.resetSession();
      if (error instanceof Error) {
        return {
          success: false,
          status: 0,
          error: error.message
        };
      }
      return {
        success: false,
        status: 0,
        error: 'Unknown APNs error'
      };
    }
  }

  private buildHeaders(deviceToken: string, options: ApnsSendOptions) {
    return {
      [http2.constants.HTTP2_HEADER_SCHEME]: this.hostUrl.protocol.replace(':', ''),
      [http2.constants.HTTP2_HEADER_METHOD]: 'POST',
      [http2.constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
      [http2.constants.HTTP2_HEADER_AUTHORITY]: this.hostUrl.host,
      'content-type': 'application/json',
      authorization: `bearer ${this.getJwt()}`,
      'apns-topic': options.topicOverride ?? this.config.topic,
      'apns-push-type': options.pushType ?? 'voip',
      'apns-priority': options.priority ?? '10',
      'apns-expiration': options.expiration ? String(options.expiration) : '0',
      ...(options.collapseId ? { 'apns-collapse-id': options.collapseId } : {})
    };
  }

  private normalizeDeviceToken(token: string): string {
    if (!token) {
      return '';
    }
    return token.replace(/[\s<>]/g, '').toLowerCase();
  }

  private extractError(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }
    if ('reason' in body && typeof (body as any).reason === 'string') {
      return (body as any).reason;
    }
    if ('error' in body && typeof (body as any).error === 'string') {
      return (body as any).error;
    }
    return undefined;
  }

  private getJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedJwt && now < this.cachedJwtExpiresAt - 60) {
      return this.cachedJwt;
    }

    const token = jwt.sign(
      {
        iss: this.config.teamId,
        iat: now,
      },
      this.config.privateKey,
      {
        algorithm: 'ES256',
        keyid: this.config.keyId,
        header: { alg: 'ES256', typ: 'JWT' },
      }
    );

    this.cachedJwt = token;
    this.cachedJwtExpiresAt = now + JWT_TTL_SECONDS;
    return token;
  }

  private async ensureSession(): Promise<ClientHttp2Session> {
    if (this.session && !this.session.destroyed) {
      return this.session;
    }

    return await new Promise<ClientHttp2Session>((resolve, reject) => {
      const session = http2.connect(this.hostUrl);

      session.on('error', (error) => {
        this.resetSession();
        reject(error);
      });

      session.on('goaway', () => {
        this.resetSession();
      });

      session.on('close', () => {
        this.resetSession();
      });

      session.on('connect', () => {
        this.session = session;
        resolve(session);
      });
    });
  }

  private resetSession(): void {
    if (this.session && !this.session.closed) {
      try {
        this.session.close();
      } catch {}
    }
    this.session = null;
  }
}

export function normalizePrivateKey(raw: string): string {
  let normalized = raw.trim();
  normalized = normalized.replace(/\\n/g, '\n');

  if (!normalized.includes('BEGIN PRIVATE KEY')) {
    try {
      const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim();
      if (decoded) {
        normalized = decoded;
      }
    } catch {
      // ignore - treat as already plain text
    }
  }

  if (!normalized.includes('BEGIN PRIVATE KEY')) {
    normalized = `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
  }

  return normalized;
}

export function createApnsClientFromEnv(): ApnsClient | null {
  let key = process.env.APNS_VOIP_KEY;
  if (!key && process.env.APN_KEY_PATH) {
    try {
      key = readFileSync(process.env.APN_KEY_PATH, 'utf8');
    } catch (error) {
      console.warn('[APNs] Failed to read key from APN_KEY_PATH:', error);
    }
  }

  const keyId = process.env.APNS_VOIP_KEY_ID || process.env.APN_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID || process.env.APN_TEAM_ID;
  const topic = process.env.APNS_VOIP_TOPIC;

  if (!key || !keyId || !teamId || !topic) {
    return null;
  }

  const environment: ApnsEnvironment = process.env.APNS_VOIP_ENVIRONMENT === 'development'
    ? 'development'
    : 'production';

  const privateKey = normalizePrivateKey(key);
  return new ApnsClient({ keyId, teamId, topic, privateKey, environment });
}
