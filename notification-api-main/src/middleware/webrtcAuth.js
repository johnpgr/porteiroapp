const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Middleware de autenticação para rotas WebRTC
 * Valida JWT token e verifica permissões do usuário
 */
const authenticateWebRTC = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de acesso requerido',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    
    // Verificar token com Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Buscar informações completas do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar se usuário tem permissão para WebRTC
    if (!userData.webrtc_enabled) {
      return res.status(403).json({
        success: false,
        error: 'WebRTC não habilitado para este usuário',
        code: 'WEBRTC_DISABLED'
      });
    }

    // Adicionar informações do usuário ao request
    req.user = {
      id: user.id,
      email: user.email,
      name: userData.name,
      userType: userData.user_type,
      phone: userData.phone,
      webrtcEnabled: userData.webrtc_enabled,
      lastSeen: userData.last_seen
    };

    next();
  } catch (error) {
    console.error('Erro na autenticação WebRTC:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para verificar se usuário é administrador
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware para verificar se usuário é porteiro
 */
const requirePorteiro = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (!['admin', 'porteiro'].includes(req.user.userType)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a porteiros e administradores',
      code: 'PORTEIRO_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware para verificar se usuário é morador
 */
const requireMorador = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (!['admin', 'morador'].includes(req.user.userType)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a moradores e administradores',
      code: 'MORADOR_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware para autenticação WebSocket
 * Usado no handshake do Socket.IO
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    const userType = socket.handshake.auth.userType;
    const userId = socket.handshake.auth.userId;
    
    if (!token) {
      return next(new Error('Token de acesso requerido'));
    }

    // Permitir acesso especial para porteiro de teste
    if (token === 'porteiro-token' && userType === 'porteiro' && userId === 'porteiro-001') {
      socket.user = {
        id: 'porteiro-001',
        email: 'porteiro@teste.com',
        name: 'Porteiro Principal',
        userType: 'porteiro',
        phone: '+5511999999999',
        webrtcEnabled: true,
        lastSeen: new Date().toISOString()
      };
      return next();
    }

    // Permitir acesso especial para morador de teste
    if (token === 'morador-token' && userType === 'morador' && userId === 'morador-001') {
      socket.user = {
        id: 'morador-001',
        email: 'morador@teste.com',
        name: 'Morador Teste',
        userType: 'morador',
        phone: '+5511888888888',
        webrtcEnabled: true,
        lastSeen: new Date().toISOString()
      };
      return next();
    }

    // Verificar token com Supabase para outros usuários
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return next(new Error('Token inválido ou expirado'));
    }

    // Buscar informações completas do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return next(new Error('Usuário não encontrado'));
    }

    // Verificar se usuário tem permissão para WebRTC
    if (!userData.webrtc_enabled) {
      return next(new Error('WebRTC não habilitado para este usuário'));
    }

    // Adicionar informações do usuário ao socket
    socket.user = {
      id: user.id,
      email: user.email,
      name: userData.name,
      userType: userData.user_type,
      phone: userData.phone,
      webrtcEnabled: userData.webrtc_enabled,
      lastSeen: userData.last_seen
    };

    next();
  } catch (error) {
    console.error('Erro na autenticação WebSocket:', error);
    next(new Error('Erro interno do servidor'));
  }
};

/**
 * Middleware para rate limiting de chamadas WebRTC
 */
const rateLimitCalls = (() => {
  const callAttempts = new Map();
  const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
  const MAX_CALLS_PER_WINDOW = 10;

  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    const now = Date.now();
    const userAttempts = callAttempts.get(userId) || [];
    
    // Remover tentativas antigas
    const recentAttempts = userAttempts.filter(timestamp => 
      now - timestamp < RATE_LIMIT_WINDOW
    );

    if (recentAttempts.length >= MAX_CALLS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas de chamada. Tente novamente em alguns minutos.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
      });
    }

    // Adicionar nova tentativa
    recentAttempts.push(now);
    callAttempts.set(userId, recentAttempts);

    next();
  };
})();

/**
 * Middleware para validar parâmetros de chamada
 */
const validateCallParams = (req, res, next) => {
  const { receiverId, callType } = req.body;

  if (!receiverId) {
    return res.status(400).json({
      success: false,
      error: 'ID do receptor é obrigatório',
      code: 'MISSING_RECEIVER_ID'
    });
  }

  if (callType && !['audio', 'video'].includes(callType)) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de chamada deve ser "audio" ou "video"',
      code: 'INVALID_CALL_TYPE'
    });
  }

  if (req.user.id === receiverId) {
    return res.status(400).json({
      success: false,
      error: 'Não é possível ligar para si mesmo',
      code: 'SELF_CALL_NOT_ALLOWED'
    });
  }

  next();
};

/**
 * Middleware para validar parâmetros de interfone
 */
const validateIntercomParams = (req, res, next) => {
  const { callerId, apartmentNumber, buildingId, timeout } = req.body;

  // Validar callerId
  if (!callerId) {
    return res.status(400).json({
      success: false,
      error: 'callerId é obrigatório',
      code: 'MISSING_CALLER_ID',
      details: 'O ID do porteiro que está fazendo a chamada deve ser fornecido'
    });
  }

  if (typeof callerId !== 'string' || callerId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'callerId deve ser uma string válida',
      code: 'INVALID_CALLER_ID',
      details: 'O ID do porteiro deve ser uma string não vazia'
    });
  }

  // Validar apartmentNumber
  if (!apartmentNumber) {
    return res.status(400).json({
      success: false,
      error: 'apartmentNumber é obrigatório',
      code: 'MISSING_APARTMENT_NUMBER',
      details: 'O número do apartamento deve ser fornecido (ex: 101, 202, 1503)'
    });
  }

  if (typeof apartmentNumber !== 'string' || apartmentNumber.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'apartmentNumber deve ser uma string válida',
      code: 'INVALID_APARTMENT_NUMBER',
      details: 'O número do apartamento deve ser uma string não vazia'
    });
  }

  // Validar formato do apartmentNumber (apenas números e letras)
  const apartmentRegex = /^[0-9A-Za-z\-]+$/;
  if (!apartmentRegex.test(apartmentNumber.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Formato de apartamento inválido',
      code: 'INVALID_APARTMENT_FORMAT',
      details: 'O número do apartamento deve conter apenas números, letras e hífens (ex: 101, 202A, 15-03)'
    });
  }

  // Validar buildingId
  if (!buildingId) {
    return res.status(400).json({
      success: false,
      error: 'buildingId é obrigatório',
      code: 'MISSING_BUILDING_ID',
      details: 'O ID do prédio deve ser fornecido'
    });
  }

  if (typeof buildingId !== 'string' || buildingId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'buildingId deve ser uma string válida',
      code: 'INVALID_BUILDING_ID',
      details: 'O ID do prédio deve ser uma string não vazia'
    });
  }

  // Validar formato UUID do buildingId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(buildingId.trim())) {
    return res.status(400).json({
      success: false,
      error: 'buildingId deve ser um UUID válido',
      code: 'INVALID_BUILDING_UUID',
      details: 'O ID do prédio deve estar no formato UUID válido'
    });
  }

  // Validar timeout (opcional)
  if (timeout !== undefined) {
    if (typeof timeout !== 'number' || timeout < 5000 || timeout > 120000) {
      return res.status(400).json({
        success: false,
        error: 'timeout deve ser um número entre 5000 e 120000 (5s a 2min)',
        code: 'INVALID_TIMEOUT',
        details: 'O timeout da chamada deve estar entre 5 segundos e 2 minutos'
      });
    }
  }

  // Normalizar dados
  req.body.callerId = callerId.trim();
  req.body.apartmentNumber = apartmentNumber.trim().toUpperCase();
  req.body.buildingId = buildingId.trim();
  req.body.timeout = timeout || 30000; // Default 30 segundos

  next();
};

/**
 * Middleware para tratamento de erros específicos do WebRTC
 */
const handleWebRTCErrors = (error, req, res, next) => {
  console.error('❌ Erro WebRTC:', error);

  // Erros específicos do Supabase
  if (error.code === 'PGRST116') {
    return res.status(404).json({
      success: false,
      error: 'Recurso não encontrado',
      code: 'RESOURCE_NOT_FOUND',
      details: 'O recurso solicitado não foi encontrado no banco de dados'
    });
  }

  if (error.code === 'PGRST301') {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'INVALID_DATA',
      details: 'Os dados fornecidos não atendem aos critérios de validação'
    });
  }

  // Erros de conexão
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Serviço temporariamente indisponível',
      code: 'SERVICE_UNAVAILABLE',
      details: 'Não foi possível conectar aos serviços externos. Tente novamente em alguns minutos.'
    });
  }

  // Erros de timeout
  if (error.code === 'ETIMEDOUT') {
    return res.status(408).json({
      success: false,
      error: 'Timeout na operação',
      code: 'OPERATION_TIMEOUT',
      details: 'A operação demorou mais tempo que o esperado. Tente novamente.'
    });
  }

  // Erros específicos do interfone
  if (error.message && error.message.includes('apartamento não encontrado')) {
    return res.status(404).json({
      success: false,
      error: 'Apartamento não encontrado',
      code: 'APARTMENT_NOT_FOUND',
      details: 'O apartamento especificado não existe ou não possui moradores cadastrados'
    });
  }

  if (error.message && error.message.includes('Nenhum morador encontrado')) {
    return res.status(404).json({
      success: false,
      error: 'Nenhum morador encontrado',
      code: 'NO_RESIDENTS_FOUND',
      details: 'O apartamento existe mas não possui moradores cadastrados ou ativos'
    });
  }

  if (error.message && error.message.includes('Porteiro não autorizado')) {
    return res.status(403).json({
      success: false,
      error: 'Porteiro não autorizado',
      code: 'UNAUTHORIZED_DOORMAN',
      details: 'O porteiro não tem permissão para fazer chamadas neste prédio'
    });
  }

  // Erro genérico
  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    code: 'INTERNAL_SERVER_ERROR',
    details: 'Ocorreu um erro inesperado. Nossa equipe foi notificada.'
  });
};

/**
 * Middleware para logging detalhado de chamadas de interfone
 */
const logIntercomCall = (req, res, next) => {
  const startTime = Date.now();
  const { callerId, apartmentNumber, buildingId } = req.body;
  
  console.log(`🏢 [INTERFONE] Iniciando chamada:`, {
    callerId,
    apartmentNumber,
    buildingId,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Override do res.json para capturar a resposta
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    if (data.success) {
      console.log(`✅ [INTERFONE] Chamada iniciada com sucesso:`, {
        callerId,
        apartmentNumber,
        buildingId,
        duration: `${duration}ms`,
        callsInitiated: data.data?.callsInitiated || 0,
        totalResidents: data.data?.totalResidents || 0
      });
    } else {
      console.log(`❌ [INTERFONE] Falha na chamada:`, {
        callerId,
        apartmentNumber,
        buildingId,
        duration: `${duration}ms`,
        error: data.error,
        code: data.code
      });
    }
    
    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  authenticateWebRTC,
  requireAdmin,
  requirePorteiro,
  requireMorador,
  authenticateSocket,
  rateLimitCalls,
  validateCallParams,
  validateIntercomParams,
  handleWebRTCErrors,
  logIntercomCall
};