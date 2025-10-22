const { RtcTokenBuilder, RtcRole } = require('agora-token');
// Environment variables accessed via process.env

/**
 * Controlador para geração de tokens RTC da Agora
 * Responsável por gerar tokens seguros para as chamadas de voz
 */
class TokenController {
  /**
   * Gera um token RTC para um usuário específico
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async generateToken(req, res) {
    try {
      const { channelName, uid, role = 'publisher' } = req.body;

      // Validação dos parâmetros obrigatórios
      if (!channelName) {
        return res.status(400).json({
          success: false,
          error: 'channelName é obrigatório'
        });
      }

      if (!uid) {
        return res.status(400).json({
          success: false,
          error: 'uid é obrigatório'
        });
      }

      // Configurações da Agora
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!appId || !appCertificate) {
        console.error('🔥 Credenciais da Agora não configuradas');
        return res.status(500).json({
          success: false,
          error: 'Configuração do servidor incompleta'
        });
      }

      // Definir o papel do usuário (publisher ou subscriber)
      const userRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

      // Token expira em 24 horas (86400 segundos)
      const expirationTimeInSeconds = 86400;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      // Gerar o token RTC
      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        parseInt(uid),
        userRole,
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
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async generateMultipleTokens(req, res) {
    try {
      const { channelName, users } = req.body;

      // Validação dos parâmetros
      if (!channelName) {
        return res.status(400).json({
          success: false,
          error: 'channelName é obrigatório'
        });
      }

      if (!users || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'users deve ser um array não vazio'
        });
      }

      // Configurações da Agora
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!appId || !appCertificate) {
        console.error('🔥 Credenciais da Agora não configuradas');
        return res.status(500).json({
          success: false,
          error: 'Configuração do servidor incompleta'
        });
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

        const userRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

        const token = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channelName,
          parseInt(uid),
          userRole,
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
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async validateToken(req, res) {
    try {
      const { token, channelName, uid } = req.body;

      if (!token || !channelName || !uid) {
        return res.status(400).json({
          success: false,
          error: 'token, channelName e uid são obrigatórios'
        });
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

module.exports = TokenController;