import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { iOSConfig } from '../services/auth/iOSConfig';
import { AuthLogger } from '../services/auth/AuthLogger';

// Configurações do ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Cliente Supabase otimizado para iOS
 */
class OptimizedSupabaseClient {
  private static instance: OptimizedSupabaseClient;
  private client: SupabaseClient;
  private logger: AuthLogger;
  private configManager = iOSConfig;
  private networkCleanup: (() => void) | null = null;
  private networkStatus: 'online' | 'offline' | 'slow' = 'online';
  
  private constructor() {
    this.logger = new AuthLogger('error');
    this.initializeClient();
    this.setupNetworkMonitoring();
  }
  
  public static getInstance(): OptimizedSupabaseClient {
    if (!OptimizedSupabaseClient.instance) {
      OptimizedSupabaseClient.instance = new OptimizedSupabaseClient();
    }
    return OptimizedSupabaseClient.instance;
  }
  
  /**
   * Inicializar cliente Supabase com configurações otimizadas
   */
  private initializeClient(): void {
    const { client } = this.configManager.getSupabaseConfig(supabaseUrl, supabaseAnonKey);
    this.client = client;
    
    this.logger.info('Optimized Supabase client initialized', {
      platform: this.configManager.getPlatform(),
      isIOS: this.configManager.isIOS(),
      url: supabaseUrl.substring(0, 30) + '...'
    });
    
    // Configurar listeners de auth
    this.setupAuthListeners();
  }
  
  /**
   * Configurar listeners de autenticação
   */
  private setupAuthListeners(): void {
    this.client.auth.onAuthStateChange((event, session) => {
      this.logger.debug('Auth state changed', {
        event,
        hasSession: !!session,
        platform: this.configManager.getPlatform(),
        networkStatus: this.networkStatus
      });
      
      // Log específico para iOS
      if (this.configManager.isIOS()) {
        this.logger.info('iOS auth state change', {
          event,
          sessionExists: !!session,
          userId: session?.user?.id,
          expiresAt: session?.expires_at
        });
      }
    });
  }
  
  /**
   * Configurar monitoramento de rede
   */
  private setupNetworkMonitoring(): void {
    this.networkCleanup = this.configManager.setupNetworkMonitoring((status) => {
      const oldStatus = this.networkStatus;
      this.networkStatus = status;
      
      this.logger.info('Network status changed', {
        oldStatus,
        newStatus: status,
        platform: this.configManager.getPlatform()
      });
      
      // Se voltou online, tentar reconectar realtime
      if (oldStatus === 'offline' && status !== 'offline') {
        this.reconnectRealtime();
      }
    });
  }
  
  /**
   * Reconectar realtime após volta da conectividade
   */
  private reconnectRealtime(): void {
    try {
      // Forçar reconexão do realtime
      const channels = this.client.getChannels();
      
      channels.forEach(channel => {
        if (channel.state === 'closed' || channel.state === 'errored') {
          this.logger.info('Reconnecting realtime channel', {
            channelTopic: channel.topic,
            channelState: channel.state
          });
          
          channel.subscribe();
        }
      });
    } catch (error) {
      this.logger.error('Error reconnecting realtime', { error });
    }
  }
  
  /**
   * Obter cliente Supabase
   */
  public getClient(): SupabaseClient {
    return this.client;
  }
  
  /**
   * Fazer login com retry inteligente
   */
  public async signInWithPassword(
    email: string, 
    password: string,
    options?: { retryCount?: number }
  ): Promise<any> {
    const retryCount = options?.retryCount || 0;
    const config = this.configManager.getAdaptiveConfig();
    
    this.logger.info('Sign in attempt', {
      email,
      retryCount,
      platform: this.configManager.getPlatform(),
      networkStatus: this.networkStatus,
      timeout: config.authTimeout
    });
    
    try {
      // Criar promise com timeout
      const authPromise = this.client.auth.signInWithPassword({
        email,
        password
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Authentication timeout after ${config.authTimeout}ms`));
        }, config.authTimeout);
      });
      
      const result = await Promise.race([authPromise, timeoutPromise]);
      
      this.logger.info('Sign in successful', {
        email,
        retryCount,
        hasUser: !!(result as any).data?.user
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Sign in failed', {
        email,
        retryCount,
        error: error instanceof Error ? error.message : 'Unknown error',
        networkStatus: this.networkStatus
      });
      
      // Verificar se deve fazer retry
      if (this.shouldRetryAuth(error, retryCount)) {
        const delay = this.configManager.calculateRetryDelay(retryCount + 1);
        
        this.logger.info('Retrying sign in', {
          email,
          retryCount: retryCount + 1,
          delay
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.signInWithPassword(email, password, {
          retryCount: retryCount + 1
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Fazer query com retry inteligente
   */
  public async queryWithRetry<T>(
    queryFn: () => Promise<T>,
    operation: string,
    options?: { retryCount?: number; timeout?: number }
  ): Promise<T> {
    const retryCount = options?.retryCount || 0;
    const config = this.configManager.getAdaptiveConfig();
    const timeout = options?.timeout || config.profileTimeout;
    
    this.logger.debug('Query with retry', {
      operation,
      retryCount,
      timeout,
      networkStatus: this.networkStatus
    });
    
    try {
      // Criar promise com timeout
      const queryPromise = queryFn();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operation} timeout after ${timeout}ms`));
        }, timeout);
      });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      this.logger.debug('Query successful', {
        operation,
        retryCount
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Query failed', {
        operation,
        retryCount,
        error: error instanceof Error ? error.message : 'Unknown error',
        networkStatus: this.networkStatus
      });
      
      // Verificar se deve fazer retry
      if (this.shouldRetryQuery(error, retryCount)) {
        const delay = this.configManager.calculateRetryDelay(retryCount + 1);
        
        this.logger.info('Retrying query', {
          operation,
          retryCount: retryCount + 1,
          delay
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.queryWithRetry(queryFn, operation, {
          ...options,
          retryCount: retryCount + 1
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Verificar se deve fazer retry para autenticação
   */
  private shouldRetryAuth(error: any, retryCount: number): boolean {
    // Não fazer retry se excedeu o máximo
    if (!this.configManager.shouldRetry(retryCount + 1)) {
      return false;
    }
    
    // Não fazer retry para erros de credencial
    if (this.isCredentialError(error)) {
      return false;
    }
    
    // Fazer retry para timeouts, erros de rede, etc.
    return this.isRetryableError(error);
  }
  
  /**
   * Verificar se deve fazer retry para queries
   */
  private shouldRetryQuery(error: any, retryCount: number): boolean {
    // Não fazer retry se excedeu o máximo
    if (!this.configManager.shouldRetry(retryCount + 1)) {
      return false;
    }
    
    // Fazer retry para timeouts e erros de rede
    return this.isRetryableError(error);
  }
  
  /**
   * Verificar se é erro de credencial
   */
  private isCredentialError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code || '';
    
    return message.includes('invalid') ||
           message.includes('credential') ||
           message.includes('password') ||
           message.includes('email') ||
           code === 'invalid_credentials' ||
           code === 'email_not_confirmed';
  }
  
  /**
   * Verificar se é erro que permite retry
   */
  private isRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code || '';
    
    // Erros de timeout
    if (message.includes('timeout')) {
      return true;
    }
    
    // Erros de rede
    if (message.includes('network') ||
        message.includes('connection') ||
        message.includes('fetch')) {
      return true;
    }
    
    // Códigos específicos
    if (code === 'NETWORK_ERROR' ||
        code === 'TIMEOUT' ||
        code === 'CONNECTION_ERROR') {
      return true;
    }
    
    // Se está offline, sempre tentar retry
    if (this.networkStatus === 'offline') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Obter status da rede
   */
  public getNetworkStatus(): 'online' | 'offline' | 'slow' {
    return this.networkStatus;
  }
  
  /**
   * Obter informações de configuração
   */
  public getConfigInfo(): {
    platform: string;
    isIOS: boolean;
    networkStatus: string;
    config: any;
  } {
    return {
      platform: this.configManager.getPlatform(),
      isIOS: this.configManager.isIOS(),
      networkStatus: this.networkStatus,
      config: this.configManager.getConfig()
    };
  }
  
  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.networkCleanup) {
      this.networkCleanup();
      this.networkCleanup = null;
    }
    
    this.logger.info('Optimized Supabase client cleaned up');
  }
}

// Instância singleton
const optimizedSupabase = OptimizedSupabaseClient.getInstance();

// Exportar cliente otimizado
export const supabase = optimizedSupabase.getClient();

// Exportar métodos otimizados
export const supabaseAuth = {
  signInWithPassword: (email: string, password: string) => 
    optimizedSupabase.signInWithPassword(email, password),
  
  signOut: () => supabase.auth.signOut(),
  
  getSession: () => supabase.auth.getSession(),
  
  refreshSession: () => supabase.auth.refreshSession(),
  
  onAuthStateChange: (callback: (event: string, session: any) => void) => 
    supabase.auth.onAuthStateChange(callback)
};

// Exportar query helper
export const supabaseQuery = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => 
        optimizedSupabase.queryWithRetry(
          () => supabase.from(table).select(columns).eq(column, value),
          `select from ${table}`
        ),
      
      single: () => 
        optimizedSupabase.queryWithRetry(
          () => supabase.from(table).select(columns).single(),
          `select single from ${table}`
        )
    }),
    
    update: (data: any) => ({
      eq: (column: string, value: any) => 
        optimizedSupabase.queryWithRetry(
          () => supabase.from(table).update(data).eq(column, value),
          `update ${table}`,
          { timeout: 10000 }
        )
    }),
    
    insert: (data: any) => 
      optimizedSupabase.queryWithRetry(
        () => supabase.from(table).insert(data),
        `insert into ${table}`,
        { timeout: 10000 }
      )
  })
};

// Exportar utilitários
export const supabaseUtils = {
  getNetworkStatus: () => optimizedSupabase.getNetworkStatus(),
  getConfigInfo: () => optimizedSupabase.getConfigInfo(),
  cleanup: () => optimizedSupabase.cleanup()
};

// Exportar cliente original para casos especiais
export { supabase as originalSupabase };

// Exportar instância otimizada
export { optimizedSupabase };