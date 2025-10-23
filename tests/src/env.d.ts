/**
 * Environment variable type declarations for Next.js app
 * 
 * These types provide autocomplete and type safety when accessing process.env
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test';

      // Supabase (Server-side)
      SUPABASE_URL: string;
      SUPABASE_SERVICE_ROLE_KEY: string;

      // JWT
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;

      // Supabase (Client-side)
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;

      // Agora (Client-side)
      NEXT_PUBLIC_AGORA_APP_ID?: string;

      // API URLs (Client-side)
      NEXT_PUBLIC_API_BASE_URL?: string;

      // Build/validation flags
      SKIP_ENV_VALIDATION?: string;
    }
  }
}

export {};
