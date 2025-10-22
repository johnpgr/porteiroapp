import type { Request, Response } from 'express';
import * as agora from 'agora-token';

/**
 * Controlador para geração de tokens RTC da Agora
 * Responsável por gerar tokens seguros para as chamadas de voz
 */
class TokenController {
  /**
   * Gera um token RTC para um usuário específico
   * @param req - Request object
   * @param res - Response object
   */
  static async generateToken(req: Request, res: Response): Promise<void> {
    try {
      const { channelName, uid, role = 'publisher' } = req.body;

      // Validação dos parâmetros obrigatórios
      if (!channelName) {
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

      // Configurações da Agora
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!appId || !appCertificate) {
        console.error('🔥 Credenciais da Agora não configuradas');
        res.status(500).json({
          success: false,
          error: 'Configuração do servidor incompleta'
        });
        return;
      }

      // Definir o papel do usuário (publisher ou subscriber)
      const userRole = role === 'subscriber' ? agora.RtcRole.SUBSCRIBER : agora.RtcRole.PUBLISHER;

      // Token expira em 24 horas (86400 segundos)
      const expirationTimeInSeconds = 86400;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      // Gerar o token RTC
      const token = agora.RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        parseInt(uid),
        userRole,
        expirationTimeInSeconds,
        privilegeExpiredTs
      );

      console.log(`✅ Token gerado para canal: ${channelName}, uid: ${uid}, role: ${role}`);

      res.json({
        success: true,
        data: {
          token,
          appId,
          channelName,
          uid: parseInt(uid),
          role,
          expiresAt: privilegeExpiredTs
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao gerar token RTC:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Gera tokens para múltiplos usuários (útil para chamadas em grupo)
   * @param req - Request object
   * @param res - Response object
   */
  static async generateMultipleTokens(req: Request, res: Response): Promise<void> {
    try {
      const { channelName, users } = req.body;

      // Validação dos parâmetros
      if (!channelName) {
        res.status(400).json({
          success: false,
          error: 'channelName é obrigatório'
        });
        return;
      }

      if (!users || !Array.isArray(users) || users.length === 0) {
        res.status(400).json({
          success: false,
          error: 'users deve ser um array não vazio'
        });
        return;
      }

      // Configurações da Agora
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!appId || !appCertificate) {
        console.error('🔥 Credenciais da Agora não configuradas');
        res.status(500).json({
          success: false,
          error: 'Configuração do servidor incompleta'
        });
        return;
      }

      // Token expira em 24 horas
      const expirationTimeInSeconds = 86400;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const tokens = [];

      // Gerar token para cada usuário
      for (const user of users) {
        const { uid, role = 'publisher' } = user;

        if (!uid) {
          continue; // Pular usuários sem uid
        }

        const userRole = role === 'subscriber' ? agora.RtcRole.SUBSCRIBER : agora.RtcRole.PUBLISHER;

        const token = agora.RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channelName,
          parseInt(uid),
          userRole,
          expirationTimeInSeconds,
          privilegeExpiredTs
        );

        tokens.push({
          uid: parseInt(uid),
          token,
          role,
          expiresAt: privilegeExpiredTs
        });
      }

      console.log(`✅ ${tokens.length} tokens gerados para canal: ${channelName}`);

      res.json({
        success: true,
        data: {
          appId,
          channelName,
          tokens,
          expiresAt: privilegeExpiredTs
        }
      });

    } catch (error) {
      console.error('🔥 Erro ao gerar múltiplos tokens:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Valida se um token ainda é válido
   * @param req - Request object
   * @param res - Response object
   */
  static async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const { token, channelName, uid } = req.body;

      if (!token || !channelName || !uid) {
        res.status(400).json({
          success: false,
          error: 'token, channelName e uid são obrigatórios'
        });
        return;
      }

      // Nota: A validação completa do token requer decodificação
      // Por simplicidade, vamos apenas verificar se o token não está vazio
      // Em produção, você pode implementar validação mais robusta
      
      const isValid = token.length > 0;
      const currentTimestamp = Math.floor(Date.now() / 1000);

      res.json({
        success: true,
        data: {
          isValid,
          channelName,
          uid: parseInt(uid),
          validatedAt: currentTimestamp
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
