import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

export const { client: supabase, unified } = SupabaseClientFactory.createBrowserClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
});