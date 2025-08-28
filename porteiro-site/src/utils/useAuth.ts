'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string;
  cpf: string | null;
  work_schedule: string | null;
  address: string | null;
  birth_date: string | null;
  building_id: string | null;
  role: string | null;
  user_type: string | null;
  relation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  registration_token: string | null;
  token_expires_at: string | null;
  profile_complete: boolean | null;
}

interface UseAuthReturn {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  requireAuth: (redirectTo?: string) => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Verificar sessão atual
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileData && !error) {
        setProfile(profileData);
      } else {
        console.error('Erro ao buscar perfil:', error);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const requireAuth = (redirectTo?: string) => {
    if (!loading && !user) {
      const currentPath = window.location.pathname + window.location.search;
      const returnUrl = redirectTo || currentPath;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  };

  return {
    user,
    profile,
    loading,
    requireAuth
  };
}