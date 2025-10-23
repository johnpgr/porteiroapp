/**
 * Environment variable type declarations for Expo app
 * 
 * These types provide autocomplete and type safety when accessing process.env
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test';

      // Supabase
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: string;

      // Agora (Video/Audio calls)
      EXPO_PUBLIC_AGORA_APP_ID?: string;

      // API URLs
      EXPO_PUBLIC_API_BASE_URL?: string;
      EXPO_PUBLIC_REGISTRATION_SITE_URL?: string;
      EXPO_PUBLIC_NOTIFICATION_API_URL?: string;
      EXPO_PUBLIC_INTERCOM_API_URL?: string;
      EXPO_PUBLIC_INTERFONE_API_URL?: string;

      // Build/validation flags
      SKIP_ENV_VALIDATION?: string;
    }
  }
}

export {};
