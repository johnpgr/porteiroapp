import { Platform } from 'react-native';
import { supabase } from '../../utils/supabase';
import { iOSNetworkHandler } from './iOSNetworkHandler';
import { AuthLogger } from './AuthLogger';
import { AuthMetrics } from './AuthMetrics';
import { AuthStateManager } from './AuthStateManager';
import { AdminAuthStrategy } from './strategies/AdminAuthStrategy';
import { PorteiroAuthStrategy } from './strategies/PorteiroAuthStrategy';
import { MoradorAuthStrategy } from './strategies/MoradorAuthStrategy';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'porteiro' | 'morador';
  profile: any;
  building_id?: string;
  apartment_id?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  errorCode?: string;
  metrics?: {
    duration: number;
    retryCount: number;
    platform: string;
  };
}

export interface AuthStrategy {
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  refreshSession(): Promise<AuthResult>;
}

export class AuthManager {
  private static instance: AuthManager;
  private logger: AuthLogger;
  private metrics: AuthMetrics;
  private stateManager: AuthStateManager;
  private iOSHandler: iOSNetworkHandler;
  private strategies: Map<string, AuthStrategy>;
  private currentPlatform: string;

  private constructor() {
    this.logger = new AuthLogger();
    this.metrics = new AuthMetrics();
    this.stateManager = new AuthStateManager();
    this.iOSHandler = new iOSNetworkHandler();
    this.currentPlatform = Platform.OS;
    
    // Inicializar estratégias de autenticação
    this.strategies = new Map();
    this.strategies.set('admin', new AdminAuthStrategy(this.logger, this.metrics));
    this.strategies.set('porteiro', new PorteiroAuthStrategy(this.logger, this.metrics));
    this.strategies.set('morador', new MoradorAuthStrategy(this.logger, this.metrics));

    this.logger.info('AuthManager initialized', { platform: this.currentPlatform });
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Login unificado que detecta automaticamente o tipo de usuário
   */
  public async signIn(email: string, password: string): Promise<AuthResult> {
    const startTime = Date.now();
    this.logger.info('Starting unified sign in', { email, platform: this.currentPlatform });
    
    try {
      // Aplicar configurações específicas do iOS
      if (this.currentPlatform === 'ios') {
        return await this.iOSHandler.executeWithRetry(async () => {
          return await this.performSignIn(email, password, startTime);
        });
      }
      
      return await this.performSignIn(email, password, startTime);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Sign in failed', { error: error.message, duration });
      this.metrics.recordAuthAttempt(false, duration, 0, this.currentPlatform);
      
      return {
        success: false,
        error: this.formatErrorMessage(error),
        errorCode: this.getErrorCode(error),
        metrics: { duration, retryCount: 0, platform: this.currentPlatform }
      };
    }
  }

  private async performSignIn(email: string, password: string, startTime: number): Promise<AuthResult> {
    // Primeiro, tentar autenticação básica no Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Falha na autenticação - usuário não encontrado');
    }

    // Detectar tipo de usuário e usar estratégia apropriada
    const userType = await this.detectUserType(authData.user.id);
    const strategy = this.strategies.get(userType);
    
    if (!strategy) {
      throw new Error(`Tipo de usuário não suportado: ${userType}`);
    }

    // Usar estratégia específica para carregar perfil completo
    const result = await strategy.getCurrentUser();
    
    if (!result) {
      throw new Error('Falha ao carregar perfil do usuário');
    }

    const duration = Date.now() - startTime;
    this.logger.info('Sign in successful', { 
      userId: result.id, 
      role: result.role, 
      duration 
    });
    
    this.metrics.recordAuthAttempt(true, duration, 0, this.currentPlatform);
    this.stateManager.setCurrentUser(result);

    return {
      success: true,
      user: result,
      metrics: { duration, retryCount: 0, platform: this.currentPlatform }
    };
  }

  /**
   * Detecta automaticamente o tipo de usuário baseado nos perfis
   */
  private async detectUserType(userId: string): Promise<string> {
    try {
      // Verificar se é admin
      const { data: adminProfile } = await supabase
        .from('admin_profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (adminProfile) return 'admin';

      // Verificar se é porteiro
      const { data: porteiroProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .eq('role', 'porteiro')
        .single();
      
      if (porteiroProfile) return 'porteiro';

      // Por padrão, assumir que é morador
      return 'morador';
    } catch (error) {
      this.logger.warn('Error detecting user type, defaulting to morador', { error: error.message });
      return 'morador';
    }
  }

  /**
   * Logout unificado
   */
  public async signOut(): Promise<void> {
    try {
      this.logger.info('Starting sign out');
      
      // Limpar estado local primeiro
      this.stateManager.clearCurrentUser();
      
      // Fazer logout no Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        this.logger.warn('Supabase sign out error', { error: error.message });
      }
      
      this.logger.info('Sign out completed');
    } catch (error) {
      this.logger.error('Sign out failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Obter usuário atual
   */
  public getCurrentUser(): AuthUser | null {
    return this.stateManager.getCurrentUser();
  }

  /**
   * Verificar se usuário está autenticado
   */
  public isAuthenticated(): boolean {
    return this.stateManager.isAuthenticated();
  }

  /**
   * Refresh da sessão
   */
  public async refreshSession(): Promise<AuthResult> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (data.user) {
        const userType = await this.detectUserType(data.user.id);
        const strategy = this.strategies.get(userType);
        
        if (strategy) {
          const user = await strategy.getCurrentUser();
          if (user) {
            this.stateManager.setCurrentUser(user);
            return { success: true, user };
          }
        }
      }

      return { success: false, error: 'Falha ao renovar sessão' };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Session refresh failed', { error: error.message, duration });
      
      return {
        success: false,
        error: this.formatErrorMessage(error),
        errorCode: this.getErrorCode(error)
      };
    }
  }

  /**
   * Obter métricas de autenticação
   */
  public getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Formatar mensagem de erro para o usuário
   */
  private formatErrorMessage(error: any): string {
    if (error.message?.includes('Invalid login credentials')) {
      return 'Email ou senha incorretos';
    }
    
    if (error.message?.includes('timeout')) {
      return 'Tempo limite excedido. Verifique sua conexão e tente novamente.';
    }
    
    if (error.message?.includes('network')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    
    return error.message || 'Erro desconhecido durante a autenticação';
  }

  /**
   * Obter código de erro estruturado
   */
  private getErrorCode(error: any): string {
    if (error.message?.includes('Invalid login credentials')) {
      return 'INVALID_CREDENTIALS';
    }
    
    if (error.message?.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    
    if (error.message?.includes('network')) {
      return 'NETWORK_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();