import agora from 'agora-token';

const { RtcTokenBuilder, RtmTokenBuilder, RtcRole } = agora;

type AgoraTokenRole = 'publisher' | 'subscriber';

export interface GenerateTokenInput {
  channelName: string;
  uid: string;
  role?: AgoraTokenRole;
  ttlSeconds?: number;
}

export interface GenerateTokenResponse {
  rtcToken: string;
  rtmToken: string;
  uid: string;
  channelName: string;
  rtcRole: AgoraTokenRole;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface GenerateMultipleTokenInput extends Omit<GenerateTokenInput, 'uid' | 'role'> {
  participants: Array<{
    uid: string;
    role?: AgoraTokenRole;
    ttlSeconds?: number;
  }>;
}

/**
 * Serviço responsável por gerar tokens RTC e RTM da Agora
 * Mantém a lógica centralizada para reutilização entre controllers
 */
class AgoraService {
  private readonly appId: string;
  private readonly appCertificate: string;
  private readonly defaultTtlSeconds: number;

  constructor() {
    this.appId = process.env.AGORA_APP_ID ?? '';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE ?? '';
    this.defaultTtlSeconds = this.resolveDefaultTtl();

    if (!this.appId || !this.appCertificate) {
      console.warn('⚠️  Credenciais da Agora não configuradas. Tokens não poderão ser gerados.');
    }
  }

  /**
   * Gera um par de tokens RTC + RTM para um único usuário
   */
  generateTokenPair(input: GenerateTokenInput): GenerateTokenResponse {
    this.assertCredentials();

    const ttlSeconds = this.normalizeTtl(input.ttlSeconds);
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAt + ttlSeconds;
    const rtcRole = this.mapRole(input.role);
    const rtcRoleEnum = rtcRole === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
      this.appId,
      this.appCertificate,
      input.channelName,
      input.uid,
      rtcRoleEnum,
      ttlSeconds,
      ttlSeconds
    );

    const rtmToken = RtmTokenBuilder.buildToken(
      this.appId,
      this.appCertificate,
      input.uid,
      ttlSeconds
    );

    return {
      rtcToken,
      rtmToken,
      uid: input.uid,
      channelName: input.channelName,
      rtcRole,
      issuedAt: new Date(issuedAt * 1000).toISOString(),
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      ttlSeconds
    };
  }

  /**
   * Gera tokens para múltiplos participantes de uma mesma chamada
   */
  generateTokensForParticipants(input: GenerateMultipleTokenInput): GenerateTokenResponse[] {
    return input.participants.map((participant) =>
      this.generateTokenPair({
        channelName: input.channelName,
        uid: participant.uid,
        role: participant.role,
        ttlSeconds: participant.ttlSeconds ?? input.ttlSeconds
      })
    );
  }

  /**
   * Expõe o App ID para o client sem revelar o certificado
   */
  getAppId(): string | null {
    return this.appId || null;
  }

  /**
   * TTL padrão aplicado quando não informado na requisição
   */
  getDefaultTtlSeconds(): number {
    return this.defaultTtlSeconds;
  }

  private assertCredentials(): void {
    if (!this.appId || !this.appCertificate) {
      throw new Error('Credenciais da Agora não configuradas');
    }
  }

  private resolveDefaultTtl(): number {
    const raw = process.env.AGORA_TOKEN_TTL_SECONDS;
    if (!raw) {
      return 300; // 5 minutos
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      console.warn('⚠️  Valor inválido para AGORA_TOKEN_TTL_SECONDS. Usando 300 segundos.');
      return 300;
    }

    return parsed;
  }

  private normalizeTtl(ttl?: number): number {
    if (!ttl || Number.isNaN(ttl) || ttl <= 0) {
      return this.defaultTtlSeconds;
    }

    // Evitar tokens extremamente longos
    const MAX_TTL_SECONDS = 3600; // 1 hora
    return Math.min(ttl, MAX_TTL_SECONDS);
  }

  private mapRole(role?: AgoraTokenRole): AgoraTokenRole {
    if (role === 'subscriber') {
      return 'subscriber';
    }

    return 'publisher';
  }
}

export default new AgoraService();
