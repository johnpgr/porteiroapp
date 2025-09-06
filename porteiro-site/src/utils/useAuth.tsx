'use client';

import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Tipos baseados no plano de integração
interface AdminProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  admin_type: 'super_admin' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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

// Tipo para a linha real do banco admin_profiles
interface DBAdminProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean | null;
}

interface AuthUser {
  id: string;
  email: string;
  user_type: 'super_admin' | 'admin' | 'porteiro' | 'morador';
  admin_type?: 'super_admin' | 'admin';
  building_id?: string;
  is_active: boolean;
  profile: AdminProfile | Profile | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  requireAuth: (redirectTo?: string) => void;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  canManageAdmins: () => boolean;
  canManageBuildings: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // checkSession é definido mais abaixo, após loadUserProfile

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro no logout:', error);
      }
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Erro no logout:', error);
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const loadUserProfile = useCallback(async (authUser: User) => {
    try {
      // Primeiro verifica se é um admin
      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (adminProfile && !adminError) {
        // É um admin (super-admin ou admin regular)
        const ap = adminProfile as DBAdminProfile;
        const adminType: 'super_admin' | 'admin' = (ap.role === 'super_admin' || ap.role === 'superadmin') ? 'super_admin' : 'admin';
        const isActive: boolean = (ap.is_active ?? true) as boolean;
        const mappedProfile: AdminProfile = {
          id: ap.id,
          user_id: ap.user_id,
          name: ap.name,
          email: ap.email,
          phone: ap.phone,
          role: ap.role,
          admin_type: adminType,
          is_active: isActive,
          created_at: ap.created_at,
          updated_at: ap.updated_at,
        };
        const userData: AuthUser = {
          id: authUser.id,
          email: mappedProfile.email,
          user_type: adminType,
          admin_type: adminType,
          is_active: isActive,
          profile: mappedProfile
        };
        setUser(userData);
        return;
      }

      // Se não é admin, verifica na tabela profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (profile && !profileError) {
        const userData: AuthUser = {
          id: authUser.id,
          email: profile.email,
          user_type: profile.user_type as 'porteiro' | 'morador',
          building_id: profile.building_id || undefined,
          is_active: true,
          profile: profile
        };
        setUser(userData);
      } else {
        console.error('Perfil não encontrado:', profileError);
        await signOut();
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      await signOut();
    }
  }, [signOut]);

  const checkSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setLoading(false);
    }
  }, [loadUserProfile]);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkSession, loadUserProfile]);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message === 'Invalid login credentials' 
            ? 'Email ou senha incorretos' 
            : 'Erro na autenticação'
        };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      await loadUserProfile(data.user);
      return { success: true };
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };



  const requireAuth = (redirectTo?: string) => {
    if (!loading && !user) {
      const currentPath = window.location.pathname + window.location.search;
      const returnUrl = redirectTo || currentPath;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  };

  // Funções de verificação de permissões baseadas no plano
  const isSuperAdmin = (): boolean => {
    return user?.user_type === 'super_admin' && user?.admin_type === 'super_admin';
  };

  const isAdmin = (): boolean => {
    return user?.user_type === 'admin' || user?.user_type === 'super_admin';
  };

  const canManageAdmins = (): boolean => {
    return isSuperAdmin();
  };

  const canManageBuildings = (): boolean => {
    return isSuperAdmin();
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    requireAuth,
    isSuperAdmin,
    isAdmin,
    canManageAdmins,
    canManageBuildings
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

// Hook legado para compatibilidade
export function useAuthLegacy() {
  const { user, loading, requireAuth } = useAuth();
  
  return {
    user: user ? {
      id: user.id,
      email: user.email
    } as User : null,
    profile: user?.profile as Profile | null,
    loading,
    requireAuth
  };
}