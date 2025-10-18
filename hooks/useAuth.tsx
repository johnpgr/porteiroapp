import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { supabase } from '../utils/supabase';
import { TokenStorage } from '../services/TokenStorage';
import { registerForPushNotificationsAsync, savePushToken } from '../services/notificationService';

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
  refreshSession: () => Promise<boolean>;
  isSessionValid: () => Promise<boolean>;
  checkAndRedirectUser: () => Promise<void>;
  updatePushToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Evitar carregamentos concorrentes/duplicados de perfil
  const loadingProfileRef = useRef(false);
  const lastLoadedRef = useRef<{ userId: string; at: number } | null>(null);
  
  // Constantes para configuração de sessão
  const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dias em ms
  const REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // Refresh 24h antes de expirar
  const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // Heartbeat a cada 5 minutos
  const SESSION_CHECK_INTERVAL = 60 * 1000; // Verificar sessão a cada 1 minuto

  // Função para logs apenas de erros críticos
  const logError = (message: string, error?: any) => {
    console.error(`[AuthProvider] ${message}`, error || '');
  };

  // Função para verificar se a sessão é válida
  const isSessionValid = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return false;
      }

      // Verifica se o token ainda é válido
      const tokenValid = TokenStorage.isTokenValid(session.access_token);
      
      return tokenValid;
    } catch (error) {
      logError('Erro ao verificar sessão:', error);
      return false;
    }
  }, []);

  // Função para refresh da sessão
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        logError('Erro no refresh da sessão:', error);
        return false;
      }

      if (data.session?.access_token) {
        // Salva o novo token com expiração de 30 dias
        await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
        
        // Agenda próximo refresh
        scheduleTokenRefresh();
        
        return true;
      }
      
      return false;
    } catch (error) {
      logError('Erro no refresh da sessão:', error);
      return false;
    }
  }, [SESSION_DURATION]);

  // Função para agendar refresh automático do token
  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Agenda refresh para 24h antes da expiração
    refreshTimerRef.current = setTimeout(async () => {
      const success = await refreshSession();
      
      if (!success) {
        logError('Falha no refresh automático, fazendo logout');
        await signOut();
      }
    }, SESSION_DURATION - REFRESH_THRESHOLD);
  }, [refreshSession, SESSION_DURATION, REFRESH_THRESHOLD]);

  // Sistema de heartbeat para manter sessão ativa
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(async () => {
      try {
        const sessionValid = await isSessionValid();
        
        if (!sessionValid) {
          logError('Sessão inválida detectada no heartbeat, fazendo logout');
          await signOut();
          return;
        }

        // Atualiza last_login para manter atividade
        if (user) {
          const table = user.user_type === 'admin' ? 'admin_profiles' : 'profiles';
          const column = user.user_type === 'admin' ? 'updated_at' : 'last_login';
          
          await supabase
            .from(table)
            .update({ [column]: new Date().toISOString() })
            .eq('user_id', user.id);
        }
      } catch (error) {
        logError('Erro no heartbeat:', error);
      }
    }, HEARTBEAT_INTERVAL);
  }, [isSessionValid, user, HEARTBEAT_INTERVAL]);

  // Função signOut definida antes para evitar problemas de inicialização
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      
      // Para todos os timers antes do logout
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
        authStateChangeTimeoutRef.current = null;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        logError('Erro no logout do Supabase:', error);
      }
      
      // Limpa todos os dados armazenados
      await TokenStorage.clearAll();
      
      setUser(null);
      
      // Limpa refs de controle
      lastLoadedRef.current = null;
      loadingProfileRef.current = false;
      lastAuthEventRef.current = null;
      
    } catch (error) {
      logError('Erro no logout:', error);
      // Mesmo com erro, limpa o estado local
      setUser(null);
      
      // Força limpeza dos dados mesmo com erro
      try {
        await TokenStorage.clearAll();
      } catch (clearError) {
        logError('Erro ao limpar storage durante logout:', clearError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Função para verificar sessão ativa e redirecionar automaticamente
  const checkAndRedirectUser = useCallback(async () => {
    try {
      // Verifica se há uma sessão válida
      const sessionValid = await isSessionValid();
      
      if (!sessionValid) {
        return;
      }

      // Verifica se já temos os dados do usuário carregados
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await loadUserProfile(session.user);
          // Não chama recursivamente - deixa o useEffect lidar com a atualização do estado
          return;
        } else {
          return;
        }
      }

      // Verifica o tipo de usuário e redireciona para as páginas index corretas
      switch (user.user_type) {
        case 'admin':
          router.replace('/admin');
          break;
        case 'porteiro':
          router.replace('/porteiro');
          break;
        case 'morador':
          router.replace('/morador');
          break;
        default:
          logError('Tipo de usuário não reconhecido:', user.user_type);
          await signOut();
          router.replace('/');
          break;
      }
    } catch (error) {
      logError('Erro ao verificar e redirecionar usuário:', error);
      // Em caso de erro, redireciona para a página inicial
      router.replace('/');
    }
  }, [isSessionValid, user, signOut]);

  // Função melhorada para verificar sessão
  const checkSession = useCallback(async () => {
    const timeout = setTimeout(() => {
      console.error('[AuthProvider] ⚠️ checkSession timeout - forçando setLoading(false)');
      setLoading(false);
    }, 10000); // 10 segundos timeout

    try {
      console.log('[AuthProvider] 🔍 Verificando sessão...');

      // Primeiro verifica se há uma sessão salva localmente
      const hasStoredToken = await TokenStorage.hasValidToken();
      console.log('[AuthProvider] hasStoredToken:', hasStoredToken);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log('[AuthProvider] session existe:', !!session?.user);

      if (session?.user) {
        // Só salva o token se não há um token válido armazenado ou se é diferente
        if (session.access_token && !hasStoredToken) {
          await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
        }

        await loadUserProfile(session.user);

        // Inicia sistemas de manutenção da sessão
        scheduleTokenRefresh();
        startHeartbeat();
      } else if (hasStoredToken) {
        console.log('[AuthProvider] Tentando refresh da sessão...');
        // Tenta fazer refresh da sessão
        const refreshSuccess = await refreshSession();

        if (refreshSuccess) {
          // Tenta novamente obter a sessão
          const { data: { session: newSession } } = await supabase.auth.getSession();

          if (newSession?.user) {
            await loadUserProfile(newSession.user);
            scheduleTokenRefresh();
            startHeartbeat();
          }
        } else {
          await TokenStorage.clearAll();
        }
      }

      console.log('[AuthProvider] ✅ checkSession concluído');
    } catch (error) {
      logError('Erro ao verificar sessão:', error);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [SESSION_DURATION, refreshSession, scheduleTokenRefresh, startHeartbeat]);

  // Ref para controlar debounce do onAuthStateChange
  const authStateChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAuthEventRef = useRef<{ event: string; timestamp: number } | null>(null);

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Implementa debounce para evitar múltiplas chamadas rápidas
      const now = Date.now();
      const lastEvent = lastAuthEventRef.current;
      
      // Se é o mesmo evento em menos de 1 segundo, ignora
      if (lastEvent && lastEvent.event === event && (now - lastEvent.timestamp) < 1000) {
        return;
      }
      
      // Atualiza o último evento
      lastAuthEventRef.current = { event, timestamp: now };
      
      // Limpa timeout anterior se existir
      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
      }
      
      // Executa com debounce de 300ms
      authStateChangeTimeoutRef.current = setTimeout(async () => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Verifica se já existe um token válido antes de salvar
          const hasValidToken = await TokenStorage.hasValidToken();
          
          if (session.access_token && !hasValidToken) {
            await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
          }
          
          await loadUserProfile(session.user);
          
          // Inicia sistemas de manutenção da sessão
          scheduleTokenRefresh();
          startHeartbeat();
        } else if (event === 'SIGNED_OUT') {
          // Para todos os timers
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
          }
          if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
          }
          if (sessionCheckIntervalRef.current) {
            clearInterval(sessionCheckIntervalRef.current);
            sessionCheckIntervalRef.current = null;
          }
          
          // Limpa dados armazenados
          await TokenStorage.clearAll();
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          // Para TOKEN_REFRESHED, sempre atualiza pois é um novo token
          await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
        }
        setLoading(false);
      }, 300);
    });

    // Cleanup na desmontagem do componente
    return () => {
      subscription.unsubscribe();
      
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
      }
    };
  }, [checkSession, SESSION_DURATION, scheduleTokenRefresh, startHeartbeat]);

  const loadUserProfile = async (authUser: User) => {
    // Guard: evita carregamento concorrente ou muito frequente para o mesmo usuário
    if (loadingProfileRef.current) return;
    const nowGuard = Date.now();
    if (
      lastLoadedRef.current &&
      lastLoadedRef.current.userId === authUser.id &&
      nowGuard - lastLoadedRef.current.at < 1000
    ) {
      return;
    }
    loadingProfileRef.current = true;

    try {
      // Primeiro tenta carregar da tabela profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logError('Erro ao carregar perfil:', error);
        return;
      }

      let userData: AuthUser;

      if (!profile) {
        // Se não encontrou na tabela profiles, verifica se é um admin
        const { data: adminProfile, error: adminError } = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminError) {
          logError('Erro ao carregar perfil de admin:', adminError);
          return;
        }

        if (adminProfile && adminProfile.is_active) {
          
          // Atualiza o updated_at na tabela admin_profiles
          await supabase
            .from('admin_profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', authUser.id);

          userData = {
            id: authUser.id,
            email: adminProfile.email,
            user_type: 'admin',
            condominium_id: undefined,
            building_id: undefined,
            is_active: adminProfile.is_active,
            last_login: new Date().toISOString(),
            push_token: undefined,
          };
        } else {
          return;
        }
      } else {
        // Se encontrou perfil na tabela profiles
        // Só atualiza last_login se passou mais de 5 minutos desde a última atualização
        const lastLogin = profile.last_login ? new Date(profile.last_login) : null;
        const now = new Date();
        const shouldUpdateLogin = !lastLogin || (now.getTime() - lastLogin.getTime()) > 5 * 60 * 1000;
        
        if (shouldUpdateLogin) {
          await supabase
            .from('profiles')
            .update({ last_login: now.toISOString() })
            .eq('user_id', authUser.id);
        }

        userData = {
          id: profile.id,
          email: profile.email,
          user_type: profile.user_type,
          condominium_id: profile.condominium_id,
          building_id: profile.building_id,
          is_active: profile.is_active,
          last_login: shouldUpdateLogin ? now.toISOString() : profile.last_login,
          push_token: profile.push_token,
        };
      }

      // Salva os dados do usuário no TokenStorage
      await TokenStorage.saveUserData({
        id: userData.id,
        email: userData.email,
        role: userData.user_type === 'admin' ? 'admin' : userData.user_type === 'porteiro' ? 'porteiro' : 'morador',
        building_id: userData.building_id,
        apartment_id: undefined, // Pode ser expandido futuramente
      });

      // Só atualiza o user se os dados realmente mudaram
      setUser(prevUser => {
        if (!prevUser || 
            prevUser.id !== userData.id ||
            prevUser.email !== userData.email ||
            prevUser.user_type !== userData.user_type ||
            prevUser.building_id !== userData.building_id ||
            prevUser.last_login !== userData.last_login) {
          return userData;
        }
        return prevUser;
      });
    } catch (error) {
      logError('Erro ao carregar perfil do usuário:', error);
    } finally {
      // Atualiza flags de controle mesmo em caso de erro
      loadingProfileRef.current = false;
      lastLoadedRef.current = { userId: authUser.id, at: Date.now() };
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
        logError('Erro de autenticação:', error);
        return {
          success: false,
          error:
            error.message === 'Invalid login credentials'
              ? 'Email ou senha incorretos'
              : 'Erro na autenticação',
        };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      // Salva o token com expiração de 30 dias
      if (data.session.access_token) {
        await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
      }

      await loadUserProfile(data.user);

      // Inicia sistemas de manutenção da sessão
      scheduleTokenRefresh();
      startHeartbeat();

      // Registra push token após login bem-sucedido
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken && data.user) {
          // Busca o profile_id do usuário
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', data.user.id)
            .single();

          if (profileData?.id) {
            await savePushToken(profileData.id, pushToken);
            console.log('✅ [useAuth] Push token registrado no login');
          }
        }
      } catch (pushError) {
        console.error('⚠️ [useAuth] Erro ao registrar push token:', pushError);
        // Não bloqueia o login se falhar o registro do push token
      }

      return { success: true };
    } catch (error) {
      logError('Erro no login:', error);
      return { success: false, error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };



  const updatePushToken = async (token: string) => {
    if (!user) return;

    // Não atualiza se o token já é o mesmo
    if (user.push_token === token) {
      return;
    }

    try {
      const table = user.user_type === 'admin' ? 'admin_profiles' : 'profiles';

      await supabase
        .from(table)
        .update({ push_token: token })
        .eq('user_id', user.id);

      // Atualiza o estado sem criar um novo objeto se não necessário
      setUser(prevUser => {
        if (!prevUser || prevUser.push_token === token) {
          return prevUser;
        }
        return { ...prevUser, push_token: token };
      });

      console.log('🔔 Push token atualizado no estado do usuário');
    } catch (error) {
      console.error('🔔 Erro ao atualizar push token:', error);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    refreshSession,
    isSessionValid,
    checkAndRedirectUser,
    updatePushToken,
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
