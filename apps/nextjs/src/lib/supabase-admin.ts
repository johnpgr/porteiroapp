import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas para admin');
}

// Cliente admin com service role key para operações privilegiadas
export const { client: supabaseAdmin, unified: unifiedAdmin } = SupabaseClientFactory.createServerClient({
  url: supabaseUrl,
  anonKey: supabaseServiceRoleKey,
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
});