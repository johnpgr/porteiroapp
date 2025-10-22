import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceKey?: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
      storage?: any;
      flowType?: 'pkce' | 'implicit';
      debug?: boolean;
    };
    realtime?: any;
    global?: any;
  };
}

/**
 * Creates a Supabase client with the provided configuration
 *
 * @param config - Supabase configuration object
 * @returns Typed Supabase client
 */
export function createSupabaseClient(config: SupabaseConfig): TypedSupabaseClient {
  const key = config.serviceKey || config.anonKey;

  if (!config.url || !key) {
    throw new Error('Supabase URL and key (anonKey or serviceKey) are required');
  }

  return createClient<Database>(config.url, key, config.options);
}

/**
 * Creates a Supabase client for browser/client-side usage
 *
 * @param url - Supabase project URL
 * @param anonKey - Supabase anonymous key
 * @param storage - Optional storage adapter (for React Native)
 * @returns Typed Supabase client
 */
export function createBrowserClient(
  url: string,
  anonKey: string,
  storage?: any
): TypedSupabaseClient {
  return createSupabaseClient({
    url,
    anonKey,
    options: {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        ...(storage && { storage }),
      },
    },
  });
}

/**
 * Creates a Supabase client for server-side usage with service role key
 *
 * @param url - Supabase project URL
 * @param serviceKey - Supabase service role key
 * @returns Typed Supabase client
 */
export function createServerClient(
  url: string,
  serviceKey: string
): TypedSupabaseClient {
  return createSupabaseClient({
    url,
    serviceKey,
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  });
}
