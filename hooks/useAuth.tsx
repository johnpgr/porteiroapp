import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
// import { notificationService } from '../services/notificationService'; // DESABILITADO TEMPORARIAMENTE

export interface AuthUser {
  id: string;
  email: string;
  user_type: 'admin' | 'porteiro' | 'morador';
  condominium_id?: string;
  building_id?: string;
  is_active: boolean;
  last_login?: string;
  push_token?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  // updatePushToken: (token: string) => Promise<void>; // DESABILITADO TEMPORARIAMENTE
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkSession]);

  const checkSession = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserProfile = async (authUser: User) => {
    try {
      // Primeiro tenta carregar da tabela profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Se não encontrou na tabela profiles, verifica se é um admin
        console.log('Perfil não encontrado em profiles, verificando admin_profiles...');

        const { data: adminProfile, error: adminError } = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single();

        if (adminError) {
          console.error('Erro ao carregar perfil de admin:', adminError);
          return;
        }

        if (adminProfile) {
          console.log('Perfil de admin encontrado, definindo user_type como admin');
          setUser({
            id: authUser.id,
            email: adminProfile.email,
            user_type: 'admin',
            condominium_id: undefined,
            building_id: undefined,
            is_active: true,
            last_login: new Date().toISOString(),
            push_token: undefined,
          });
          return;
        }
      }

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        return;
      }

      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authUser.id);

      setUser({
        id: profile.id,
        email: profile.email,
        user_type: profile.user_type,
        condominium_id: profile.condominium_id,
        building_id: profile.building_id,
        is_active: profile.is_active,
        last_login: profile.last_login,
        push_token: profile.push_token,
      });
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Erro de autenticação:', error);
        return {
          success: false,
          error:
            error.message === 'Invalid login credentials'
              ? 'Email ou senha incorretos'
              : 'Erro na autenticação',
        };
      }

      if (!data.user) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      await loadUserProfile(data.user);

      // PUSH NOTIFICATIONS DESABILITADAS TEMPORARIAMENTE
      // try {
      //   const pushToken = await notificationService.registerForPushNotifications();
      //   if (pushToken) {
      //     await updatePushToken(pushToken);
      //   }
      // } catch (pushError) {
      //   console.warn('Erro ao registrar push token:', pushError);
      // }

      return { success: true };
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro no logout:', error);
      }
      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setLoading(false);
    }
  };

  // FUNÇÃO DESABILITADA TEMPORARIAMENTE
  // const updatePushToken = async (token: string) => {
  //   if (!user) return;

  //   try {
  //     await supabase
  //       .from('profiles')
  //       .update({ push_token: token })
  //       .eq('id', user.id);

  //     setUser({ ...user, push_token: token });
  //   } catch (error) {
  //     console.error('Erro ao atualizar push token:', error);
  //   }
  // };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    // updatePushToken // DESABILITADO TEMPORARIAMENTE
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

export function usePermissions() {
  const { user } = useAuth();

  const canManageUsers = user?.user_type === 'admin';
  const canManageVisitors = user?.user_type === 'admin' || user?.user_type === 'porteiro';
  const canViewLogs = user?.user_type === 'admin' || user?.user_type === 'porteiro';
  const canReceiveDeliveries = user?.user_type === 'porteiro';
  const canAuthorizeVisitors = user?.user_type === 'morador';

  const canManageCondominium = user?.user_type === 'admin' && user?.condominium_id;
  const canManageBuilding =
    (user?.user_type === 'admin' && user?.condominium_id) ||
    (user?.user_type === 'porteiro' && user?.building_id);
  const canAccessCondominium = user?.condominium_id;
  const canAccessBuilding = user?.building_id || user?.condominium_id;

  return {
    canManageUsers,
    canManageVisitors,
    canViewLogs,
    canReceiveDeliveries,
    canAuthorizeVisitors,
    canManageCondominium,
    canManageBuilding,
    canAccessCondominium,
    canAccessBuilding,
    userRole: user?.user_type,
    condominiumId: user?.condominium_id,
    buildingId: user?.building_id,
  };
}
