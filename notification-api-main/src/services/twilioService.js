const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.initialized = false;
    this.accountSid = null;
    this.authToken = null;
    this.twimlAppSid = null;
    this.apiKeySid = null;
    this.apiKeySecret = null;
    this.client = null;
  }

  /**
   * Inicializa o serviço Twilio (lazy loading)
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
    this.apiKeySid = process.env.TWILIO_API_KEY_SID;
    this.apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    
    // Validar variáveis de ambiente obrigatórias
    this.validateEnvironmentVariables();
    
    this.client = twilio(this.accountSid, this.authToken);
    this.initialized = true;
  }

  /**
   * Valida se todas as variáveis de ambiente necessárias estão configuradas
   * @throws {Error} Se alguma variável obrigatória estiver faltando ou inválida
   */
  validateEnvironmentVariables() {
    const requiredVars = {
      TWILIO_ACCOUNT_SID: 'Account SID do Twilio (deve começar com "AC")',
      TWILIO_AUTH_TOKEN: 'Auth Token do Twilio',
      TWILIO_TWIML_APP_SID: 'TwiML App SID do Twilio (deve começar com "AP")',
      TWILIO_API_KEY_SID: 'API Key SID do Twilio (deve começar com "SK")',
      TWILIO_API_KEY_SECRET: 'API Key Secret do Twilio',
      API_BASE_URL: 'URL base da API'
    };

    const missingVars = [];
    const invalidVars = [];

    for (const [varName, description] of Object.entries(requiredVars)) {
      const value = process.env[varName];
      
      if (!value || value.includes('your_') || value.includes('xxxxxxxx')) {
        missingVars.push(`${varName}: ${description}`);
        continue;
      }

      // Validações específicas
      if (varName === 'TWILIO_ACCOUNT_SID' && !value.startsWith('AC')) {
        invalidVars.push(`${varName} deve começar com "AC"`);
      }
      if (varName === 'TWILIO_TWIML_APP_SID' && !value.startsWith('AP')) {
        invalidVars.push(`${varName} deve começar com "AP"`);
      }
      if (varName === 'TWILIO_API_KEY_SID' && !value.startsWith('SK')) {
        invalidVars.push(`${varName} deve começar com "SK"`);
      }
    }

    if (missingVars.length > 0 || invalidVars.length > 0) {
      let errorMessage = '❌ Erro na configuração do Twilio:\n\n';
      
      if (missingVars.length > 0) {
        errorMessage += '📋 Variáveis não configuradas:\n';
        missingVars.forEach(varInfo => {
          errorMessage += `  • ${varInfo}\n`;
        });
        errorMessage += '\n';
      }

      if (invalidVars.length > 0) {
        errorMessage += '⚠️  Variáveis com formato inválido:\n';
        invalidVars.forEach(varInfo => {
          errorMessage += `  • ${varInfo}\n`;
        });
        errorMessage += '\n';
      }

      errorMessage += '🔧 Para configurar o Twilio:\n';
      errorMessage += '1. Acesse https://console.twilio.com/\n';
      errorMessage += '2. Faça login ou crie uma conta\n';
      errorMessage += '3. Copie suas credenciais do dashboard\n';
      errorMessage += '4. Atualize o arquivo .env com os valores corretos\n';
      errorMessage += '5. Reinicie o servidor\n\n';
      errorMessage += '📄 Arquivo de configuração: notification-api-main/.env';

      throw new Error(errorMessage);
    }
  }

  /**
   * Gera um token de acesso para o cliente Twilio Voice
   * @param {string} identity - Identificador único do usuário
   * @returns {string} Token de acesso
   */
  generateAccessToken(identity) {
    this.initialize(); // Garante que o serviço está inicializado
    
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const accessToken = new AccessToken(
      this.accountSid,
      this.apiKeySid,
      this.apiKeySecret,
      { identity, ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlAppSid,
      incomingAllow: true,
    });

    accessToken.addGrant(voiceGrant);

    return accessToken.toJwt();
  }

  /**
   * Inicia uma chamada app-to-app
   * @param {string} apartmentIdentity - Identidade do apartamento
   * @param {string} callerIdentity - Identidade do porteiro (padrão: 'porteiro')
   * @returns {Promise<Object>} Dados da chamada criada
   */
  async makeCall(apartmentIdentity, callerIdentity = 'porteiro') {
    this.initialize(); // Garante que o serviço está inicializado
    
    try {
      const call = await this.client.calls.create({
        to: `client:${apartmentIdentity}`,
        from: `client:${callerIdentity}`,
        url: `${process.env.API_BASE_URL}/api/intercom/twiml/outgoing`,
        statusCallback: `${process.env.API_BASE_URL}/api/intercom/webhook/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      console.log('✅ Chamada Twilio criada:', call.sid);
      return call;
    } catch (error) {
      console.error('❌ Erro ao fazer chamada Twilio:', error);
      throw error;
    }
  }

  /**
   * Encerra uma chamada
   * @param {string} callSid - SID da chamada
   * @returns {Promise<Object>} Dados da chamada atualizada
   */
  async hangupCall(callSid) {
    this.initialize(); // Garante que o serviço está inicializado
    
    try {
      const call = await this.client.calls(callSid).update({
        status: 'completed'
      });

      return call;
    } catch (error) {
      console.error('Erro ao encerrar chamada Twilio:', error);
      throw error;
    }
  }

  /**
   * Gera TwiML para conectar uma chamada app-to-app
   * @param {string} targetIdentity - Identidade do cliente de destino
   * @returns {string} TwiML XML
   */
  generateConnectTwiML(targetIdentity) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    
    const dial = twiml.dial({
      timeout: 30,
      record: 'record-from-answer'
    });
    
    dial.client(targetIdentity);
    
    return twiml.toString();
  }

  /**
   * Gera TwiML para chamada não atendida
   * @returns {string} TwiML XML
   */
  generateNoAnswerTwiML() {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say({
      voice: 'alice',
      language: 'pt-BR'
    }, 'Ninguém atendeu a chamada. Tente novamente mais tarde.');

    response.hangup();

    return response.toString();
  }

  /**
   * Gera TwiML para chamada ocupada
   * @returns {string} TwiML XML
   */
  generateBusyTwiML() {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say({
      voice: 'alice',
      language: 'pt-BR'
    }, 'A linha está ocupada. Tente novamente mais tarde.');

    response.hangup();

    return response.toString();
  }
}

module.exports = new TwilioService();