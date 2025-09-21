const jwt = require('jsonwebtoken');

// Chave secreta para JWT (deve ser definida nas variáveis de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Duração padrão do token (30 minutos)
const TOKEN_EXPIRATION = '30m';

/**
 * Gera um token JWT para autorização de visitante
 * @param {Object} payload - Dados do visitante e morador
 * @param {string} payload.visitorLogId - ID do log do visitante
 * @param {string} payload.visitorName - Nome do visitante
 * @param {string} payload.residentPhone - Telefone do morador
 * @param {string} payload.residentName - Nome do morador
 * @param {string} payload.building - Prédio
 * @param {string} payload.apartment - Apartamento
 * @returns {Object} Token e informações de expiração
 */
function generateAuthorizationToken(payload) {
  try {
    const tokenPayload = {
      ...payload,
      createdAt: new Date().toISOString(),
      type: 'visitor_authorization'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    console.log('🔑 Token JWT gerado:', {
      visitorName: payload.visitorName,
      residentName: payload.residentName,
      expiresAt: expiresAt.toISOString()
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      payload: tokenPayload
    };
  } catch (error) {
    console.error('❌ Erro ao gerar token JWT:', error.message);
    throw new Error('Falha ao gerar token de autorização');
  }
}

/**
 * Valida e decodifica um token JWT
 * @param {string} token - Token JWT a ser validado
 * @returns {Object} Dados decodificados do token
 * @throws {Error} Se o token for inválido ou expirado
 */
function validateAuthorizationToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar se é um token de autorização de visitante
    if (decoded.type !== 'visitor_authorization') {
      throw new Error('Tipo de token inválido');
    }

    console.log('✅ Token validado com sucesso:', {
      visitorName: decoded.visitorName,
      residentName: decoded.residentName,
      createdAt: decoded.createdAt
    });

    return decoded;
  } catch (error) {
    console.error('❌ Erro ao validar token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expirado');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Token inválido');
    } else {
      throw new Error('Falha na validação do token');
    }
  }
}

/**
 * Gera um link de autorização (agora retorna apenas o link do site principal)
 * @param {string} token - Token JWT (ignorado)
 * @param {string} baseUrl - URL base para autorização (ignorado)
 * @returns {string} Link fixo do site principal
 */
function generateAuthorizationLink(token, baseUrl = null) {
  return 'porteiroapp://login';
}

/**
 * Extrai informações básicas do token sem validar a assinatura
 * Útil para logs e debugging
 * @param {string} token - Token JWT
 * @returns {Object|null} Payload decodificado ou null se inválido
 */
function decodeTokenInfo(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded;
  } catch (error) {
    console.error('❌ Erro ao decodificar token:', error.message);
    return null;
  }
}

/**
 * Verifica se um token está próximo do vencimento
 * @param {string} token - Token JWT
 * @param {number} minutesThreshold - Minutos antes do vencimento (padrão: 5)
 * @returns {boolean} True se o token está próximo do vencimento
 */
function isTokenNearExpiration(token, minutesThreshold = 5) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;

    const expirationTime = decoded.exp * 1000; // Converter para milliseconds
    const currentTime = Date.now();
    const thresholdTime = minutesThreshold * 60 * 1000; // Converter para milliseconds

    return (expirationTime - currentTime) <= thresholdTime;
  } catch (error) {
    return true; // Se houver erro, considerar como próximo do vencimento
  }
}

module.exports = {
  generateAuthorizationToken,
  validateAuthorizationToken,
  generateAuthorizationLink,
  decodeTokenInfo,
  isTokenNearExpiration,
  TOKEN_EXPIRATION
};