import { createUseLembretes } from '@porteiroapp/common/hooks';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

/**
 * Expo-specific wrapper for useLembretes hook
 * Injects Expo's supabase client and auth user
 */
export const useLembretesFactory = createUseLembretes({
  supabase,
  getUser: () => {
    // This will be called inside the hook, so we can't use useAuth here
    // Instead, we'll create a wrapper hook that does use useAuth
    return null as any; // Placeholder
  }
});

/**
 * Expo useLembretes hook
 * Uses the common factory with Expo-specific dependencies
 */
export function useLembretes() {
  const { user } = useAuth();
  
  // Create the hook with the current user
  const useLembretesHook = createUseLembretes({
    supabase,
    getUser: () => user
  });
  
  return useLembretesHook();
}

// Re-export types for convenience
export type {
  Lembrete,
  LembreteHistorico,
  CreateLembreteData,
  UpdateLembreteData
} from '@porteiroapp/common/hooks';
