import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthManager, AuthUser } from '../services/auth/AuthManager';
import { AuthStateManager } from '../services/auth/AuthStateManager';
import { AuthLogger } from '../services/auth/AuthLogger';
import { AuthMetrics } from '../services/auth/AuthMetrics';
import { supabase } from '../utils/supabase';

export interface UseUnifiedAuthReturn {
  // Estado atual
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  networkStatus: 'online' | 'offline' | 'slow';
  
  // Ações de autenticação
  signIn: (email: string, password: string, userType?: 'admin' | 'porteiro' | 'morador') => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
  
  // Informações de estado
  retryCount: number;
  lastError: string | null;
  isRetrying: boolean;
  
  // Métricas e logs
  getMetrics: () => any;
  getLogs: () => any[];
  
  // Utilitários
  canAccess: (permission: string) => boolean;
  getUserType: () => 'admin' | 'porteiro' | 'morador' | null;
  getDisplayName: () => string;
}

export interface UseUnifiedAuthOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableMetrics?: boolean;
  enableLogs?: boolean;
  onAuthStateChange?: (user: AuthUser | null) => void;
  onError?: (error: string) => void;
}

const DEFAULT_OPTIONS: UseUnifiedAuthOptions = {
  autoRefresh: true,
  refreshInterval: 30000, // 30 segundos
  enableMetrics: true,
  enableLogs: true
};

/**
 * Hook unificado para autenticação
 * Substitui todos os hooks de auth existentes
 */
export function useUnifiedAuth(options: UseUnifiedAuthOptions = {}): UseUnifiedAuthReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Instâncias dos serviços
  const authManager = useRef(AuthManager.getInstance());
  const stateManager = useRef(AuthStateManager.getInstance());
  const logger = useRef(AuthLogger.getInstance());
  const metrics = useRef(new AuthMetrics());
  
  // Estados locais
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Refs para controle
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const mounted = useRef(true);
  
  /**
   * Atualizar estado baseado no AuthStateManager
   */
  const updateStateFromManager = useCallback(() => {
    if (!mounted.current) return;
    
    const state = stateManager.current.getState();
    
    setUser(state.user);
    setIsLoading(state.isLoading);
    setError(state.error);
    setNetworkStatus(state.networkStatus);
    setRetryCount(state.retryCount || 0);
    setIsRetrying(state.isRetrying || false);
  }, []);
  
  /**
   * Fazer login
   */
  const signIn = useCallback(async (
    email: string, 
    password: string, 
    userType?: 'admin' | 'porteiro' | 'morador'
  ): Promise<boolean> => {
    if (!mounted.current) return false;
    
    try {
      logger.current.info('Sign in attempt started', { email, userType });
      
      // Limpar erro anterior
      setError(null);
      setIsRetrying(false);
      setRetryCount(0);
      
      // Iniciar loading
      stateManager.current.setLoading(true);
      
      const startTime = Date.now();
      
      // Tentar autenticação
      const result = await authManager.current.signIn(email, password, userType);
      
      const duration = Date.now() - startTime;
      
      if (result.success && result.user) {
        // Sucesso
        logger.current.info('Sign in successful', {
          userId: result.user.id,
          userType: result.user.tipo,
          duration
        });
        
        if (opts.enableMetrics) {
          metrics.current.recordAuthAttempt({
            success: true,
            duration,
            retryCount: 0,
            platform: getPlatform(),
            userType: result.user.tipo,
            networkType: getNetworkType()
          });
        }
        
        // Notificar callback
        if (opts.onAuthStateChange) {
          opts.onAuthStateChange(result.user);
        }
        
        return true;
      } else {
        // Falha
        const errorMessage = result.error || 'Falha na autenticação';
        
        logger.current.error('Sign in failed', {
          error: errorMessage,
          duration,
          requiresRetry: result.requiresRetry
        });
        
        if (opts.enableMetrics) {
          metrics.current.recordAuthAttempt({
            success: false,
            duration,
            retryCount: result.requiresRetry ? 1 : 0,
            platform: getPlatform(),
            userType: userType || 'unknown',
            errorCode: getErrorCode(result.error),
            networkType: getNetworkType()
          });
        }
        
        setError(errorMessage);
        
        if (opts.onError) {
          opts.onError(errorMessage);
        }
        
        // Se requer retry, configurar para retry automático
        if (result.requiresRetry && result.retryAfter) {
          setIsRetrying(true);
          setRetryCount(1);
          
          setTimeout(() => {
            if (mounted.current) {
              signIn(email, password, userType);
            }
          }, result.retryAfter);
        }
        
        return false;
      }
    } catch (error) {
      logger.current.error('Sign in error', { error });
      
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado';
      setError(errorMessage);
      
      if (opts.onError) {
        opts.onError(errorMessage);
      }
      
      return false;
    } finally {
      if (mounted.current) {
        stateManager.current.setLoading(false);
      }
    }
  }, [opts.enableMetrics, opts.onAuthStateChange, opts.onError]);
  
  /**
   * Fazer logout
   */
  const signOut = useCallback(async (): Promise<void> => {
    if (!mounted.current) return;
    
    try {
      logger.current.info('Sign out started');
      
      // Parar timer de refresh
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
      
      // Fazer logout
      await authManager.current.signOut();
      
      // Limpar estados
      setError(null);
      setRetryCount(0);
      setIsRetrying(false);
      
      logger.current.info('Sign out completed');
      
      // Notificar callback
      if (opts.onAuthStateChange) {
        opts.onAuthStateChange(null);
      }
    } catch (error) {
      logger.current.error('Sign out error', { error });
      
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer logout';
      setError(errorMessage);
      
      if (opts.onError) {
        opts.onError(errorMessage);
      }
    }
  }, [opts.onAuthStateChange, opts.onError]);
  
  /**
   * Atualizar sessão
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!mounted.current) return false;
    
    try {
      logger.current.debug('Refreshing session');
      
      const currentUser = await authManager.current.getCurrentUser();
      
      if (currentUser) {
        logger.current.debug('Session refresh successful');
        return true;
      } else {
        logger.current.debug('Session refresh failed - no user');
        return false;
      }
    } catch (error) {
      logger.current.error('Session refresh error', { error });
      return false;
    }
  }, []);
  
  /**
   * Limpar erro
   */
  const clearError = useCallback(() => {
    setError(null);
    stateManager.current.setError(null);
  }, []);
  
  /**
   * Verificar permissão
   */
  const canAccess = useCallback((permission: string): boolean => {
    if (!user) return false;
    
    // Lógica básica de permissões baseada no tipo de usuário
    const userPermissions = getUserPermissions(user.tipo);
    return userPermissions.includes(permission);
  }, [user]);
  
  /**
   * Obter tipo do usuário
   */
  const getUserType = useCallback((): 'admin' | 'porteiro' | 'morador' | null => {
    return user?.tipo || null;
  }, [user]);
  
  /**
   * Obter nome para exibição
   */
  const getDisplayName = useCallback((): string => {
    if (!user) return '';
    return user.nome || user.email || 'Usuário';
  }, [user]);
  
  /**
   * Obter métricas
   */
  const getMetrics = useCallback(() => {
    if (!opts.enableMetrics) return null;
    return metrics.current.getMetrics();
  }, [opts.enableMetrics]);
  
  /**
   * Obter logs
   */
  const getLogs = useCallback(() => {
    if (!opts.enableLogs) return [];
    return logger.current.getLogs();
  }, [opts.enableLogs]);
  
  // Efeito para inicialização
  useEffect(() => {
    mounted.current = true;
    
    // Configurar listener do state manager
    const unsubscribe = stateManager.current.addListener(updateStateFromManager);
    
    // Verificar sessão atual
    const initializeAuth = async () => {
      try {
        const currentUser = await authManager.current.getCurrentUser();
        
        if (currentUser && opts.onAuthStateChange) {
          opts.onAuthStateChange(currentUser);
        }
      } catch (error) {
        logger.current.error('Auth initialization error', { error });
      } finally {
        if (mounted.current) {
          setIsLoading(false);
        }
      }
    };
    
    initializeAuth();
    
    // Configurar refresh automático
    if (opts.autoRefresh && opts.refreshInterval) {
      refreshTimer.current = setInterval(() => {
        if (mounted.current && user) {
          refreshSession();
        }
      }, opts.refreshInterval);
    }
    
    // Listener para mudanças de auth do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return;
        
        logger.current.debug('Supabase auth state changed', { event, hasSession: !!session });
        
        if (event === 'SIGNED_OUT' || !session) {
          stateManager.current.setUser(null);
          if (opts.onAuthStateChange) {
            opts.onAuthStateChange(null);
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Recarregar usuário atual
          try {
            const currentUser = await authManager.current.getCurrentUser();
            if (currentUser && opts.onAuthStateChange) {
              opts.onAuthStateChange(currentUser);
            }
          } catch (error) {
            logger.current.error('Error reloading user after auth change', { error });
          }
        }
      }
    );
    
    // Cleanup
    return () => {
      mounted.current = false;
      unsubscribe();
      subscription.unsubscribe();
      
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [opts.autoRefresh, opts.refreshInterval, opts.onAuthStateChange, updateStateFromManager, user, refreshSession]);
  
  return {
    // Estado
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    networkStatus,
    
    // Ações
    signIn,
    signOut,
    refreshSession,
    clearError,
    
    // Informações
    retryCount,
    lastError: error,
    isRetrying,
    
    // Métricas e logs
    getMetrics,
    getLogs,
    
    // Utilitários
    canAccess,
    getUserType,
    getDisplayName
  };
}

/**
 * Utilitários auxiliares
 */
function getPlatform(): string {
  if (typeof window === 'undefined') return 'server';
  
  const userAgent = window.navigator.userAgent;
  
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  
  return 'web';
}

function getNetworkType(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    return connection.effectiveType || connection.type || 'unknown';
  }
  
  return 'unknown';
}

function getErrorCode(error: string | undefined): string {
  if (!error) return 'unknown';
  
  if (error.includes('timeout')) return 'timeout';
  if (error.includes('network')) return 'network';
  if (error.includes('credential')) return 'credentials';
  if (error.includes('permission')) return 'permission';
  
  return 'unknown';
}

function getUserPermissions(userType: string): string[] {
  switch (userType) {
    case 'admin':
      return [
        'admin:read', 'admin:write', 'admin:delete',
        'users:manage', 'system:config', 'reports:view',
        'porteiros:manage', 'moradores:manage', 'condominios:manage'
      ];
    
    case 'porteiro':
      return [
        'porteiro:read', 'porteiro:write',
        'visitantes:manage', 'entregas:manage',
        'moradores:view', 'emergencia:handle'
      ];
    
    case 'morador':
      return [
        'morador:read', 'morador:write',
        'visitantes:invite', 'entregas:view',
        'profile:edit', 'dependentes:manage'
      ];
    
    default:
      return [];
  }
}

/**
 * Hook para verificação rápida de autenticação
 */
export function useAuthCheck(): {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
} {
  const { isAuthenticated, user, isLoading } = useUnifiedAuth({
    autoRefresh: false,
    enableMetrics: false,
    enableLogs: false
  });
  
  return { isAuthenticated, user, isLoading };
}

/**
 * Hook para obter apenas o usuário atual
 */
export function useCurrentUser(): AuthUser | null {
  const { user } = useUnifiedAuth({
    autoRefresh: false,
    enableMetrics: false,
    enableLogs: false
  });
  
  return user;
}

/**
 * Hook para verificação de permissões
 */
export function usePermissions(): {
  canAccess: (permission: string) => boolean;
  userType: string | null;
  permissions: string[];
} {
  const { canAccess, getUserType, user } = useUnifiedAuth({
    autoRefresh: false,
    enableMetrics: false,
    enableLogs: false
  });
  
  const userType = getUserType();
  const permissions = userType ? getUserPermissions(userType) : [];
  
  return {
    canAccess,
    userType,
    permissions
  };
}