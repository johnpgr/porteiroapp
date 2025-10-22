/**
 * Environment variable type declarations for Interfone API
 * 
 * These types provide autocomplete and type safety when accessing process.env
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test';

      // Supabase
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;

      // Evolution API (WhatsApp)
      EVOLUTION_BASE_URL?: string;
      EVOLUTION_API_KEY?: string;
      EVOLUTION_INSTANCE?: string;
      WHATSAPP_DISABLED?: 'true' | 'false';
      WHATSAPP_SKIP_NUMBER_CHECK?: 'true' | 'false';

      // Agora (Video/Audio calls)
      AGORA_APP_ID?: string;
      AGORA_APP_CERTIFICATE?: string;

      // Twilio
      TWILIO_ACCOUNT_SID?: string;
      TWILIO_AUTH_TOKEN?: string;
      TWILIO_TWIML_APP_SID?: string;
      TWILIO_API_KEY_SID?: string;
      TWILIO_API_KEY_SECRET?: string;

      // Push Notifications
      FIREBASE_SERVICE_ACCOUNT_PATH?: string;
      APN_KEY_PATH?: string;
      APN_KEY_ID?: string;
      APN_TEAM_ID?: string;

      // Email Service
      RESEND_API_KEY?: string;
      RESEND_FROM?: string;

      // General Config
      PORT?: string;
      JWT_SECRET: string;
      API_BASE_URL: string;
      ALLOWED_ORIGINS?: string;

      // Build/validation flags
      SKIP_ENV_VALIDATION?: string;
    }
  }
}

export {};
