/**
 * Configurações WebRTC para sistema de interfone (áudio apenas)
 * Essas configurações são otimizadas para chamadas de voz entre porteiro e morador
 * através de NATs e firewalls
 */

// Configuração de servidores STUN/TURN
const webrtcConfig = {
  // Servidores STUN públicos gratuitos
  stunServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.voxgratia.org' }
  ],

  // Servidores TURN (configurar com suas credenciais)
  turnServers: [
    // Exemplo de configuração TURN (descomente e configure se necessário)
    /*
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password'
    },
    {
      urls: 'turns:your-turn-server.com:5349',
      username: 'your-username', 
      credential: 'your-password'
    }
    */
  ],

  // Configurações de ICE (Interactive Connectivity Establishment)
  iceConfig: {
    iceServers: [],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all', // 'all' ou 'relay'
    bundlePolicy: 'balanced', // 'balanced', 'max-compat', 'max-bundle'
    rtcpMuxPolicy: 'require' // 'negotiate' ou 'require'
  },

  // Configurações de mídia otimizadas para interfone (áudio apenas)
  mediaConstraints: {
    // Vídeo desabilitado para sistema de interfone
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
      // Configurações específicas para interfone
      latency: 0.01, // Baixa latência para comunicação em tempo real
      googEchoCancellation: true,
      googAutoGainControl: true,
      googNoiseSuppression: true,
      googHighpassFilter: true,
      googTypingNoiseDetection: true
    }
  },

  // Configurações de qualidade de áudio para interfone
  audioQualitySettings: {
    low: {
      sampleRate: 16000,
      bitrate: 32000, // 32 kbps
      channelCount: 1
    },
    medium: {
      sampleRate: 44100,
      bitrate: 64000, // 64 kbps
      channelCount: 1
    },
    high: {
      sampleRate: 48000,
      bitrate: 128000, // 128 kbps
      channelCount: 1
    }
  },

  // Timeouts e limites
  timeouts: {
    connectionTimeout: 30000, // 30 segundos
    callTimeout: 60000, // 60 segundos para responder
    maxCallDuration: 3600000, // 1 hora máxima por chamada
    iceGatheringTimeout: 10000, // 10 segundos para ICE gathering
    reconnectAttempts: 3,
    reconnectDelay: 5000 // 5 segundos entre tentativas
  },

  // Configurações de segurança
  security: {
    requireSecureOrigin: process.env.NODE_ENV === 'production',
    allowedOrigins: process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : ['*'],
    maxConcurrentCalls: 10,
    rateLimitWindow: 60000, // 1 minuto
    maxCallsPerWindow: 5
  },

  // Configurações de logging
  logging: {
    level: process.env.WEBRTC_LOG_LEVEL || 'info',
    logConnections: true,
    logErrors: true,
    logStats: false
  }
};

/**
 * Gera configuração ICE completa combinando STUN e TURN servers
 */
function getIceConfiguration() {
  const iceServers = [...webrtcConfig.stunServers];
  
  // Adicionar servidores TURN se configurados
  if (webrtcConfig.turnServers.length > 0) {
    iceServers.push(...webrtcConfig.turnServers);
  }

  return {
    ...webrtcConfig.iceConfig,
    iceServers
  };
}

/**
 * Gera configuração de mídia para interfone (áudio apenas)
 */
function getMediaConfiguration(quality = 'medium') {
  const audioQuality = webrtcConfig.audioQualitySettings[quality] || 
                      webrtcConfig.audioQualitySettings.medium;
  
  const config = {
    audio: {
      ...webrtcConfig.mediaConstraints.audio,
      sampleRate: audioQuality.sampleRate,
      channelCount: audioQuality.channelCount
    },
    video: false // Sistema de interfone não utiliza vídeo
  };

  return config;
}

/**
 * Valida se a configuração WebRTC está correta
 */
function validateConfiguration() {
  const errors = [];

  if (!webrtcConfig.stunServers || webrtcConfig.stunServers.length === 0) {
    errors.push('Pelo menos um servidor STUN deve ser configurado');
  }

  if (webrtcConfig.timeouts.connectionTimeout < 5000) {
    errors.push('Timeout de conexão deve ser pelo menos 5 segundos');
  }

  if (webrtcConfig.security.maxConcurrentCalls < 1) {
    errors.push('Número máximo de chamadas simultâneas deve ser pelo menos 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Obtém configuração específica para ambiente
 */
function getEnvironmentConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    ...webrtcConfig,
    security: {
      ...webrtcConfig.security,
      requireSecureOrigin: isProduction,
      allowedOrigins: isDevelopment ? ['*'] : webrtcConfig.security.allowedOrigins
    },
    logging: {
      ...webrtcConfig.logging,
      level: isDevelopment ? 'debug' : 'info',
      logStats: isDevelopment
    }
  };
}

module.exports = {
  webrtcConfig,
  getIceConfiguration,
  getMediaConfiguration,
  validateConfiguration,
  getEnvironmentConfig
};