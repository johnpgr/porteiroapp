import { SupabaseClientFactory } from '@porteiroapp/supabase';

// Cliente admin com service role key para operações privilegiadas
export const { client: supabaseAdmin, unified: unifiedAdmin } = SupabaseClientFactory.createServerClient({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
});