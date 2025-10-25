import { Platform } from 'react-native';
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

// Importação condicional do AsyncStorage
let AsyncStorage: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

// IMPORTANTE: Service role key deve ser mantida em segredo e nunca exposta no código do cliente
// Em produção, operações privilegiadas devem ser feitas através de uma API backend segura
// Esta implementação é apenas para desenvolvimento/testes controlados

/**
 * Cliente admin com service role key para operações privilegiadas
 *
 * ⚠️ ATENÇÃO DE SEGURANÇA:
 * - Este cliente bypassa Row Level Security (RLS)
 * - Deve ser usado APENAS em contextos seguros
 * - Em produção, operações privilegiadas devem ser feitas via API backend
 * - Nunca exponha a service role key no código do cliente
 */
export const { client: supabaseAdmin, unified: unifiedAdmin } =
  SupabaseClientFactory.createReactNativeClient(Platform.OS, {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    storage: Platform.OS !== 'web' ? AsyncStorage : undefined,
    logLevel: __DEV__ ? 'info' : 'error',
  });
