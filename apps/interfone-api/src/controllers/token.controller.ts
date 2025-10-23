import type { Request, Response } from 'express';
import agoraService, { type GenerateTokenResponse } from '../services/agora.service.ts';

/**
 * Controlador para geração de tokens RTC/RTM da Agora
 */
class TokenController {
  /**
   * Gera um par de tokens RTC + RTM para um usuário específico
   * Body: { channelName, uid, role?, ttlSeconds? }
   */
  static async generateToken(req: Request, res: Response): Promise<void> {
    try {
      const { channelName, uid, role, ttlSeconds } = req.body ?? {};

      if (!channelName || typeof channelName !== 'string') {
        res.status(400).json({
          success: false,
          error: 'channelName é obrigatório'
        });
        return;
      }

      if (!uid) {
        res.status(400).json({
          success: false,
          error: 'uid é obrigatório'
        });
        return;
      }

      const tokenBundle = agoraService.generateTokenPair({
        channelName,
        uid: String(uid),
        role,
        ttlSeconds
      });

      console.log(
        `✅ Token RTC/RTM gerado para canal ${channelName}, uid=${tokenBundle.uid}, ttl=${tokenBundle.ttlSeconds}s`
      );

      res.json({
        success: true,
        data: tokenBundle
      });
    } catch (error) {
      console.error('🔥 Erro ao gerar tokens da Agora:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  }

  /**
   * Gera tokens para múltiplos participantes
   * Body: { channelName, participants: [{ uid, role?, ttlSeconds? }], ttlSeconds? }
   */
  static async generateMultipleTokens(req: Request, res: Response): Promise<void> {
    try {
      const { channelName, participants, ttlSeconds } = req.body ?? {};

      if (!channelName || typeof channelName !== 'string') {
        res.status(400).json({
          success: false,
          error: 'channelName é obrigatório'
        });
        return;
      }

      if (!Array.isArray(participants) || participants.length === 0) {
        res.status(400).json({
          success: false,
          error: 'participants deve ser um array não vazio'
        });
        return;
      }

      const sanitizedParticipants = participants
        .filter((participant: any) => participant?.uid)
        .map((participant: any) => ({
          uid: String(participant.uid),
          role: participant.role,
          ttlSeconds: participant.ttlSeconds
        }));

      if (sanitizedParticipants.length === 0) {
        res.status(400).json({
          success: false,
          error: 'participants válidos não encontrados'
        });
        return;
      }

      const tokens: GenerateTokenResponse[] = agoraService.generateTokensForParticipants({
        channelName,
        participants: sanitizedParticipants,
        ttlSeconds
      });

      res.json({
        success: true,
        data: {
          appId: agoraService.getAppId(),
          channelName,
          tokens
        }
      });
    } catch (error) {
      console.error('🔥 Erro ao gerar múltiplos tokens:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  }

  /**
   * Validação simples da estrutura do token
   * (placeholder até implementação completa)
   */
  static async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const { token, channelName, uid } = req.body ?? {};

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          error: 'token é obrigatório'
        });
        return;
      }

      if (!channelName || !uid) {
        res.status(400).json({
          success: false,
          error: 'channelName e uid são obrigatórios'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          isValid: token.length > 0,
          channelName,
          uid: String(uid),
          validatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('🔥 Erro ao validar token:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

export default TokenController;
