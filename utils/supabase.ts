import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Criar wrapper de storage que funciona tanto na web quanto no mobile
const createStorageWrapper = () => {
  // Verificar se estamos no ambiente web
  if (Platform.OS === 'web') {
    return {
      getItem: async (key: string): Promise<string | null> => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      },
      setItem: async (key: string, value: string): Promise<void> => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      },
      removeItem: async (key: string): Promise<void> => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
      },
    };
  }
  
  // Para mobile, usar AsyncStorage
  return AsyncStorage;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorageWrapper(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
