import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { Alert, AppState } from 'react-native';
import { supabase } from '../utils/supabase';
import { TokenStorage } from '../services/TokenStorage';
import { useNetworkState } from '../services/NetworkMonitor';
import { processQueue } from '../services/OfflineQueue';
import AnalyticsTracker from '../services/AnalyticsTracker';
import { registerPushTokenAfterLogin } from '../utils/pushNotifications';
import type { User } from '@porteiroapp/common/supabase';
import type { AuthUser, AuthProfile, AuthAdminProfile } from '~/types/auth.types';
import { isRegularUser, isAdminUser } from '~/types/auth.types';

export type SignInReturn =
  | {
      user: User;
      success: true;
      error: null;
    }
  | {
      user: null;
      success: false;
      error: string;
    };

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isOffline: boolean;
  isReadOnly: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<SignInReturn>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  isSessionValid: () => Promise<boolean>;
  updatePushToken: (token: string) => Promise<void>;
  ensureFreshToken: () => Promise<string | null>;
  refreshUserProfile: () => Promise<void>;
  requireWritable: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let currentUserRef: AuthUser | null = null;

export const getCurrentUser = (): AuthUser | null => currentUserRef;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  // Ref para controlar debounce do onAuthStateChange
  const authStateChangeTimeoutRef = useRef<number | null>(null);
  const lastAuthEventRef = useRef<{ event: string; timestamp: number } | null>(null);
  // Evitar carregamentos concorrentes/duplicados de perfil
  const loadingProfileRef = useRef(false);
  const lastLoadedRef = useRef<{ userId: string; at: number } | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const wasOnlineRef = useRef<boolean | null>(null);

  // Constantes para configuração de sessão
  const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dias em ms
  // const SESSION_CHECK_INTERVAL = 60 * 1000; // Verificar sessão a cada 1 minuto
  const OFFLINE_GRACE_PERIOD = 24 * 60 * 60 * 1000; // 24 horas
  const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas
  const LAST_AUTH_TIMESTAMP_KEY = '@porteiro_app:last_auth_time';

  // Função para logs apenas de erros críticos
  const logError = useCallback((message: string, error?: unknown) => {
    console.error(`[AuthProvider] ${message}`, error || '');
  }, []);

  const isOnline = useNetworkState();

  useEffect(() => {
    currentUserRef = user;

    return () => {
      if (currentUserRef === user) {
        currentUserRef = null;
      }
    };
  }, [user]);

  const updateLastAuthTime = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LAST_AUTH_TIMESTAMP_KEY, String(Date.now()));
    } catch (error) {
      console.error('[AuthProvider] Failed to update last auth timestamp:', error);
    }
  }, []);

  useEffect(() => {
    const previous = wasOnlineRef.current;

    if (previous === null) {
      wasOnlineRef.current = isOnline;
      return;
    }

    if (isOnline && previous === false) {
      console.log('[Auth] Back online - processing offline queue');
      processQueue()
        .then(() => {
          AnalyticsTracker.trackEvent('auth_offline_queue_processed', {
            remainingOffline: false,
          });
        })
        .catch((error) => {
          logError('Erro ao processar fila offline:', error);
          AnalyticsTracker.trackEvent('auth_offline_queue_error', {
            message: error instanceof Error ? error.message : String(error),
          });
        });
      setIsOffline(false);
      if (isReadOnly) {
        setIsReadOnly(false);
      }
      void checkSession();
    } else if (!isOnline) {
      setIsOffline(true);
      AnalyticsTracker.trackEvent('auth_offline_detected', {});
    }

    wasOnlineRef.current = isOnline;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isReadOnly, logError]);

  // Função para verificar e tratar erro JWT expired
  const handleJWTExpiredError = useCallback((error: any, signOutCallback: () => Promise<void>) => {
    if (error && (error.code === 'PGRST303' || error.message?.includes('JWT expired'))) {
      Alert.alert('Sessão Expirada', 'Sua sessão expirou. Faça login novamente.', [
        {
          text: 'OK',
          onPress: () => {
            signOutCallback();
          },
        },
      ]);
      return true; // Indica que o erro foi tratado
    }
    return false; // Indica que não é um erro JWT expired
  }, []);

  // Função para verificar se a sessão é válida
  const isSessionValid = useCallback(async (): Promise<boolean> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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
  }, [logError]);

  // Função para refresh da sessão
  const refreshSession = useCallback(async (): Promise<boolean> => {
    // const start = Date.now();
    try {
      // Verifica se há uma sessão com refresh token antes de tentar refresh
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.refresh_token) {
        console.log('[AuthProvider] Não há refresh token disponível, ignorando refresh');
        return false;
      }

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logError('Erro no refresh da sessão:', error);
        return false;
      }

      if (data.session?.access_token) {
        // Salva o novo token com expiração de 30 dias
        await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
        AnalyticsTracker.endTiming('auth_token_refresh_duration', {
          success: true,
        });
        return true;
      }

      return false;
    } catch (error) {
      logError('Erro no refresh da sessão:', error);
      AnalyticsTracker.endTiming('auth_token_refresh_duration', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, [SESSION_DURATION, logError]);

  const isTokenExpiringSoon = useCallback((token: string, thresholdSeconds = 600): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (typeof payload.exp !== 'number') {
        return false;
      }
      const secondsUntilExpiry = payload.exp - Math.floor(Date.now() / 1000);
      return secondsUntilExpiry <= thresholdSeconds;
    } catch (error) {
      logError('Erro ao analisar expiração do token:', error);
      return false;
    }
  }, [logError]);

  const ensureFreshToken = useCallback(async (): Promise<string | null> => {
    const token = await TokenStorage.getToken();
    if (!token) {
      return null;
    }

    if (!isTokenExpiringSoon(token)) {
      return token;
    }

    try {
      AnalyticsTracker.trackEvent('auth_token_refresh_attempt', {
        reason: 'ensureFreshToken',
      });
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        logError('Erro ao atualizar token sob demanda:', error);
        AnalyticsTracker.trackEvent('auth_token_refresh_failed', {
          reason: 'ensureFreshToken',
          message: error.message,
        });
        return token;
      }

      if (data.session?.access_token) {
        await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
        AnalyticsTracker.trackEvent('auth_token_refresh_success', {
          reason: 'ensureFreshToken',
        });
        return data.session.access_token;
      }

      return token;
    } catch (error) {
      logError('Erro ao garantir token atualizado:', error);
      AnalyticsTracker.trackEvent('auth_token_refresh_failed', {
        reason: 'ensureFreshToken_exception',
        message: error instanceof Error ? error.message : String(error),
      });
      return token;
    }
  }, [SESSION_DURATION, isTokenExpiringSoon, logError]);

  // Helper function to wrap async operations with timeout
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };

  // Função signOut definida antes para evitar problemas de inicialização
  const signOut = useCallback(async () => {
    const SIGNOUT_TIMEOUT = 10000; // 10 seconds timeout

    try {
      console.log('🔓 [AuthProvider] Starting signOut...');
      setLoading(true);

      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
        authStateChangeTimeoutRef.current = null;
      }

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }

      // Wrap Supabase signOut with timeout
      console.log('🔓 [AuthProvider] Calling supabase.auth.signOut...');
      try {
        const { error } = await withTimeout(
          supabase.auth.signOut(),
          SIGNOUT_TIMEOUT,
          'Supabase signOut'
        );
        if (error) {
          console.error('❌ [AuthProvider] Supabase signOut error:', error);
        } else {
          console.log('✅ [AuthProvider] Supabase signOut successful');
        }
      } catch (timeoutError) {
        console.error('⏱️ [AuthProvider] Supabase signOut timeout:', timeoutError);
      }

      // Wrap TokenStorage.clearAll with timeout
      console.log('🔓 [AuthProvider] Clearing TokenStorage...');
      try {
        await withTimeout(
          TokenStorage.clearAll(),
          SIGNOUT_TIMEOUT,
          'TokenStorage.clearAll'
        );
        console.log('✅ [AuthProvider] TokenStorage cleared');
      } catch (clearError) {
        console.error('❌ [AuthProvider] TokenStorage.clearAll error:', clearError);
      }

      setUser(null);
      console.log('✅ [AuthProvider] User state cleared');
      setIsOffline(false);
      setIsReadOnly(false);

      // Limpa refs de controle
      lastLoadedRef.current = null;
      loadingProfileRef.current = false;
      lastAuthEventRef.current = null;

      console.log('✅ [AuthProvider] signOut completed successfully');
    } catch (error) {
      console.error('❌ [AuthProvider] Critical error in signOut:', error);
      // Mesmo com erro, limpa o estado local
      setUser(null);
      setIsOffline(false);
      setIsReadOnly(false);

      // Força limpeza dos dados mesmo com erro
      try {
        await TokenStorage.clearAll();
      } catch (clearError) {
        console.error('❌ [AuthProvider] Error clearing storage during error recovery:', clearError);
      }
    } finally {
      setLoading(false);
      console.log('🔓 [AuthProvider] signOut finally block - loading set to false');
    }
  }, []);

  const isTokenValidLocally = useCallback(
    (token: string): boolean => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        return typeof expiresAt === 'number' && expiresAt > now;
      } catch (error) {
        logError('Erro ao validar token localmente:', error);
        return false;
      }
    },
    [logError]
  );

  const loadUserProfile = useCallback(async (authUser: User): Promise<AuthUser | null> => {
    // Guard: evita carregamento concorrente ou muito frequente para o mesmo usuário
    if (loadingProfileRef.current) return null;
    const nowGuard = Date.now();
    if (
      lastLoadedRef.current &&
      lastLoadedRef.current.userId === authUser.id &&
      nowGuard - lastLoadedRef.current.at < 1000
    ) {
      return null;
    }
    loadingProfileRef.current = true;
    AnalyticsTracker.startTiming('auth_profile_fetch_duration');
    AnalyticsTracker.trackEvent('auth_profile_fetch_start', {
      userId: authUser.id,
    });

    let profileFetchRole: string | undefined;
    let profileFetchSuccessful = false;
    try {
      // Primeiro tenta carregar da tabela profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logError('Erro ao carregar perfil:', error);
        return null;
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
          return null;
        }

        if (adminProfile && adminProfile.is_active) {
          // Atualiza o updated_at na tabela admin_profiles
          await supabase
            .from('admin_profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', authUser.id);

          userData = {
            ...adminProfile,
            user_type: 'admin' as const,
          };
        } else {
          return null;
        }
      } else {
        // Se encontrou perfil na tabela profiles
        // Só atualiza last_seen se passou mais de 5 minutos desde a última atualização
        const lastLogin = profile.last_seen ? new Date(profile.last_seen) : null;
        const now = new Date();
        const shouldUpdateLogin = !lastLogin || now.getTime() - lastLogin.getTime() > 5 * 60 * 1000;

        if (shouldUpdateLogin) {
          await supabase
            .from('profiles')
            .update({ last_seen: now.toISOString() })
            .eq('user_id', authUser.id);
        }

        const profileUserType = (profile.user_type ?? profile.role ?? 'morador') as 'morador' | 'porteiro';
        userData = {
          ...profile,
          user_type: profileUserType,
        };
        profileFetchRole = profile.user_type ?? profile.role ?? undefined;
      }

      // Salva os dados do usuário no TokenStorage
      await TokenStorage.saveUserData(userData);

      await updateLastAuthTime();
      setIsOffline(false);
      setIsReadOnly(false);
      profileFetchSuccessful = true;

      // Só atualiza o user se os dados realmente mudaram
      setUser((prevUser) => {
        if (
          !prevUser ||
          prevUser.id !== userData.id ||
          prevUser.email !== userData.email ||
          prevUser.user_type !== userData.user_type ||
          (isRegularUser(prevUser) && isRegularUser(userData) && prevUser.building_id !== userData.building_id) ||
          prevUser.push_token !== userData.push_token ||
          (isRegularUser(prevUser) && isRegularUser(userData) && prevUser.last_seen !== userData.last_seen)
        ) {
          return userData;
        }
        return prevUser;
      });

      return userData;
    } catch (error) {
      // Verifica se é erro JWT expired e trata adequadamente
      if (handleJWTExpiredError(error, signOut)) {
        return null;
      }
      logError('Erro ao carregar perfil do usuário:', error);
      return null;
    } finally {
      // Atualiza flags de controle mesmo em caso de erro
      loadingProfileRef.current = false;
      lastLoadedRef.current = { userId: authUser.id, at: Date.now() };
      AnalyticsTracker.endTiming('auth_profile_fetch_duration', {
        success: profileFetchSuccessful,
        role: profileFetchRole,
        userId: authUser.id,
      });
    }
  }, [handleJWTExpiredError, logError, signOut, updateLastAuthTime]);

  const handleSoftLogout = useCallback(
    (cachedUser?: AuthUser | null) => {
      console.log('[Auth] Soft logout - read-only mode ativo');
      AnalyticsTracker.trackEvent('auth_soft_logout', {
        hasCachedUser: Boolean(cachedUser),
      });
      if (cachedUser) {
        setUser(cachedUser);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      setIsReadOnly(true);
      setIsOffline(true);
      setLoading(false);
    },
    []
  );

  const handleOfflineSession = useCallback(async () => {
    try {
      const cachedToken = await TokenStorage.getToken();
      const cachedUser = await TokenStorage.getUserData();

      if (!cachedToken || !cachedUser || !cachedUser.id) {
        console.log('[Auth] Sem sessão em cache válida para modo offline');
        setUser(null);
        setIsReadOnly(false);
        AnalyticsTracker.trackEvent('auth_offline_no_cache', {
          hasToken: Boolean(cachedToken),
          hasUser: Boolean(cachedUser),
          hasProfileId: Boolean(cachedUser?.id),
        });
        return;
      }

      // At this point, cachedUser.id is guaranteed to exist (profile id)
      // Normalize user_type - ensure it's a valid AuthUser type
      let normalizedUser: AuthUser;
      if (cachedUser.user_type === 'admin') {
        normalizedUser = {
          ...cachedUser,
          user_type: 'admin' as const,
        } as AuthAdminProfile;
      } else {
        const profileUserType = (cachedUser.user_type ?? (cachedUser as unknown as { role?: string }).role ?? 'morador') as 'morador' | 'porteiro';
        normalizedUser = {
          ...cachedUser,
          user_type: profileUserType,
        } as AuthProfile;
      }

      const lastAuthRaw = await AsyncStorage.getItem(LAST_AUTH_TIMESTAMP_KEY);
      const lastAuthTime = lastAuthRaw ? parseInt(lastAuthRaw, 10) : 0;
      const withinGrace =
        Number.isFinite(lastAuthTime) && Date.now() - lastAuthTime < OFFLINE_GRACE_PERIOD;

      if (isTokenValidLocally(cachedToken) && withinGrace) {
        console.log('[Auth] Offline mode - usando sessão em cache (período de graça ativo)');
        setUser(normalizedUser);
        setIsOffline(true);
        setIsReadOnly(true);
        setLoading(false);
        AnalyticsTracker.trackEvent('auth_offline_mode_entered', {
          userId: normalizedUser.id,
          withinGrace,
        });
        return;
      }

      console.log('[Auth] Período de graça offline expirado - aplicando soft logout');
      AnalyticsTracker.trackEvent('auth_offline_grace_expired', {
        userId: normalizedUser.id,
        hadToken: true,
      });
      handleSoftLogout(normalizedUser);
    } catch (error) {
      logError('Erro ao preparar sessão offline:', error);
      setUser(null);
      AnalyticsTracker.trackEvent('auth_offline_mode_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [OFFLINE_GRACE_PERIOD, handleSoftLogout, isTokenValidLocally, logError]);

  const requireWritable = useCallback(() => {
    if (isReadOnly) {
      throw new Error('Modo somente leitura: tente novamente após reconectar ou refazer login.');
    }
    if (isOffline) {
      throw new Error('Sem conexão: reconecte-se à internet para continuar.');
    }
  }, [isOffline, isReadOnly]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (!user) {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      console.log('[Auth] Tempo de inatividade excedido - realizando logout');
      AnalyticsTracker.trackEvent('auth_inactivity_timeout', {
        userId: user?.id,
      });
      signOut().catch((error: unknown) => logError('Erro ao realizar logout por inatividade', error));
    }, INACTIVITY_TIMEOUT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [INACTIVITY_TIMEOUT, logError, user]);

  // Função melhorada para verificar sessão
  const checkSession = useCallback(async () => {
    try {
      console.log('[AuthProvider] 🔍 Verificando sessão...');

      if (!isOnline) {
        await handleOfflineSession();
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
      }

      if (session?.user) {
        await loadUserProfile(session.user);
        setIsOffline(false);
        setIsReadOnly(false);
        AnalyticsTracker.trackEvent('auth_session_status', {
          status: 'active',
        });
        return;
      }

      const hasStoredToken = await TokenStorage.hasValidToken();

      if (hasStoredToken) {
        console.log('[AuthProvider] 🔄 Tentando renovar sessão a partir do token salvo');
        const { data, error } = await supabase.auth.refreshSession();

        if (!error && data.session?.user) {
          if (data.session.access_token) {
            await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
          }
          if (!user) {
            await loadUserProfile(data.session.user);
          }
          console.log('[AuthProvider] ✅ Sessão renovada com sucesso');
          AnalyticsTracker.trackEvent('auth_session_status', {
            status: 'refreshed',
          });
          return;
        }
      }

      console.log('[AuthProvider] ⚠️ Nenhuma sessão válida encontrada, limpando armazenamento');
      await TokenStorage.clearAll();
      setUser(null);
      setIsOffline(false);
      setIsReadOnly(false);
      AnalyticsTracker.trackEvent('auth_session_status', {
        status: 'cleared',
      });
    } catch (error) {
      if (!isOnline) {
        await handleOfflineSession();
        return;
      }
      if (handleJWTExpiredError(error, signOut)) {
        return;
      }
      logError('Erro ao verificar sessão:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SESSION_DURATION, handleOfflineSession, isOnline, loadUserProfile, logError]);

  // Initial check - runs ONCE on mount
  useEffect(() => {
    let isMounted = true;

    AnalyticsTracker.startTiming('auth_startup_complete');
    AnalyticsTracker.startTiming('auth_cache_load_duration');

    TokenStorage.getUserData()
      .then((cachedUser) => {
        if (!isMounted || !cachedUser || !cachedUser.id) return;

        // Normalize user_type - ensure it's a valid AuthUser type
        let normalizedUser: AuthUser;
        if (cachedUser.user_type === 'admin') {
          normalizedUser = {
            ...cachedUser,
            user_type: 'admin' as const,
          } as AuthAdminProfile;
        } else {
          const profileUserType = (cachedUser.user_type ?? (cachedUser as any).role ?? 'morador') as 'morador' | 'porteiro';
          normalizedUser = {
            ...cachedUser,
            user_type: profileUserType,
          } as AuthProfile;
        }

        setUser((prev) => (prev ?? normalizedUser));
        AnalyticsTracker.trackEvent('auth_cache_hit', {
          userId: normalizedUser.id,
        });
      })
      .catch((error) => {
        console.error('[AuthProvider] Erro ao carregar usuário em cache:', error);
        AnalyticsTracker.trackEvent('auth_cache_error', {
          message: error instanceof Error ? error.message : String(error),
        });
      });

    const runInitialCheck = async () => {
      setLoading(true);
      AnalyticsTracker.startTiming('auth_session_validate_duration');
      try {
        await checkSession();
        AnalyticsTracker.endTiming('auth_session_validate_duration', {
          online: isOnline,
        });
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
        AnalyticsTracker.endTiming('auth_cache_load_duration');
        const fullMetadata = {
          online: isOnline,
          hasUser: Boolean(user),
          offlineMode: isOffline,
        };
        AnalyticsTracker.endTiming('auth_startup_complete', fullMetadata);
      }
    };

    runInitialCheck().catch((error) => logError('Erro na verificação inicial da sessão:', error));

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Auth state change listener - separate effect
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const now = Date.now();
      const lastEvent = lastAuthEventRef.current;

      if (lastEvent && lastEvent.event === event && now - lastEvent.timestamp < 1000) {
        return;
      }

      lastAuthEventRef.current = { event, timestamp: now };

      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
      }

      authStateChangeTimeoutRef.current = setTimeout(async () => {
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            if (session.access_token) {
              await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
            }
            await loadUserProfile(session.user);
          } else if (event === 'SIGNED_OUT') {
            await TokenStorage.clearAll();
            setUser(null);
          } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
            await TokenStorage.saveToken(session.access_token, SESSION_DURATION / 1000);
          }
        } catch (error) {
          if (handleJWTExpiredError(error, signOut)) {
            return;
          }
          logError('Erro ao processar mudança de sessão:', error);
        } finally {
          setLoading(false);
        }
      }, 300);
    });

    return () => {
      subscription.unsubscribe();

      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
        authStateChangeTimeoutRef.current = null;
      }
    };
  }, [SESSION_DURATION, handleJWTExpiredError, loadUserProfile, logError, signOut]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        resetInactivityTimer();
        if (user && isOnline) {
          void checkSession();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkSession, isOnline, resetInactivityTimer, user]);

  const refreshUserProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await loadUserProfile(session.user);
    }
  }, [loadUserProfile]);

  const signIn = async (email: string, password: string): Promise<SignInReturn> => {
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
          user: null,
        };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Usuário não encontrado', user: null };
      }

      // Salva o token com expiração de 30 dias
      if (data.session.access_token) {
        await TokenStorage.saveToken(data.session.access_token, SESSION_DURATION / 1000);
      }

      const userData = await loadUserProfile(data.user);

      // Register push token immediately after successful login
      if (userData?.user_type) {
        registerPushTokenAfterLogin(data.user.id, userData.user_type).catch((error) => {
          console.error('🔔 Failed to register push token after login:', error);
        });
      }

      return { success: true, user: data.user, error: null };
    } catch (error) {
      logError('Erro no login:', error);
      return { success: false, error: 'Erro interno do servidor', user: null };
    } finally {
      setLoading(false);
    }
  };

  const updatePushToken = async (token: string) => {
    if (!user) return;
    try {
      requireWritable();
    } catch (error) {
      console.error('[AuthProvider] updatePushToken blocked:', error);
      return;
    }

    try {
      const table = user.user_type === 'admin' ? 'admin_profiles' : 'profiles';

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const shouldEnableNotifications = user.user_type !== 'admin';
      if (shouldEnableNotifications) {
        updates.notification_enabled = true;
      }

      const tokenChanged = user.push_token !== token;
      if (tokenChanged) {
        updates.push_token = token;
      }

      if (!user.user_id) {
        console.error('[AuthProvider] Cannot update push token: user.user_id is null');
        return;
      }
      await supabase.from(table).update(updates).eq('user_id', user.user_id);

      if (tokenChanged) {
        // Atualiza o estado apenas quando o token muda
        setUser((prevUser) => {
          if (!prevUser) {
            return prevUser;
          }
          if (prevUser.push_token === token) {
            return prevUser;
          }
          return { ...prevUser, push_token: token };
        });
      } else if (shouldEnableNotifications) {
        // Garante que o estado reflita notificações habilitadas, se a propriedade existir
        setUser((prevUser) => {
          if (!prevUser) return prevUser;
          if ((prevUser as any).notification_enabled === true) return prevUser;
          return { ...prevUser, notification_enabled: true };
        });
      }

      console.log('🔔 Preferências de push atualizadas para o usuário');
    } catch (error) {
      console.error('🔔 Erro ao atualizar push token:', error);
    }
  };

  const value = {
    user,
    loading,
    isOffline,
    isReadOnly,
    initialized,
    signIn,
    signOut,
    refreshSession,
    isSessionValid,
    updatePushToken,
    ensureFreshToken,
    refreshUserProfile,
    requireWritable,
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

  const canManageCondominium = false; // condominium_id removed, always false
  const canManageBuilding =
    (user?.user_type === 'admin') ||
    (user && isRegularUser(user) && user.building_id);
  const canAccessCondominium = false; // condominium_id removed, always false
  const canAccessBuilding = user && isRegularUser(user) ? user.building_id : null;

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
    condominiumId: null, // condominium_id removed
    buildingId: user && isRegularUser(user) ? user.building_id : null,
  };
}
