import { createUseLembretes } from '@porteiroapp/hooks';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/utils/useAuth';

/**
 * Next.js-specific wrapper for useLembretes hook
 * Injects Next.js's supabase client and auth user
 */
export function useLembretes() {
  const { user } = useAuth();
  
  // Create the hook with the current user
  const useLembretesHook = createUseLembretes({
    supabase,
    getUser: () => user ? {
      id: user.id,
      user_type: user.user_type
    } : null
  });
  
  return useLembretesHook();
}

// Re-export types for convenience
export type {
  Lembrete,
  LembreteHistorico,
  CreateLembreteData,
  UpdateLembreteData
} from '@porteiroapp/hooks';
