import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

// Cliente admin com service role key para operações privilegiadas
export const { client: supabaseAdmin, unified: unifiedAdmin } = SupabaseClientFactory.createServerClient({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
});