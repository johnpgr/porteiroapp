import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas');
}

export const { client: supabase, unified } = SupabaseClientFactory.createBrowserClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
});