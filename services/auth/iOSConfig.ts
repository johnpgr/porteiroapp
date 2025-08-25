import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthLogger } from './AuthLogger';

/**
 * Configurações específicas para iOS
 */
export interface iOSAuthConfig {
  // Timeouts adaptativos
  authTimeout: number;
  profileTimeout: number;
  refreshTimeout: number;
  
  // Retry configuration
  maxRetries: number;
  baseRetryDelay: number;
  maxRetryDelay: number;
  
  // Network monitoring
  networkCheckInterval: number;
  slowNetworkThreshold: number;
  
  // Supabase specific
  enablePKCE: boolean;
  heartbeatInterval: number;
  sessionRefreshMargin: number;
  
  // Performance
  enableMetrics: boolean;
  enableDetailedLogs: boolean;
}

/**
 * Configurações padrão para iOS
 */
const DEFAULT_IOS_CONFIG: iOSAuthConfig = {
  // Timeouts mais longos para iOS devido aos problemas conhecidos
  authTimeout: 25000, // 25 segundos para autenticação
  profileTimeout: 20000, // 20 segundos para carregar perfil
  refreshTimeout: 15000, // 15 segundos para refresh de sessão
  
  // Retry mais agressivo no iOS
  maxRetries: 3,
  baseRetryDelay: 1000, // 1 segundo base
  maxRetryDelay: 8000, // máximo 8 segundos
  
  // Monitoramento de rede
  networkCheckInterval: 5000, // verificar a cada 5 segundos
  slowNetworkThreshold: 2000, // considerar lenta se > 2s
  
  // Configurações Supabase otimizadas para iOS
  enablePKCE: true, // PKCE é mais seguro e confiável no iOS
  heartbeatInterval: 30000, // heartbeat a cada 30 segundos
  sessionRefreshMargin: 300000, // refresh 5 minutos antes de expirar
  
  // Performance e debugging
  enableMetrics: true,
  enableDetailedLogs: true
};

/**
 * Configurações padrão para outras plataformas
 */
const DEFAULT_OTHER_CONFIG: iOSAuthConfig = {
  authTimeout: 15000, // 15 segundos
  profileTimeout: 12000, // 12 segundos
  refreshTimeout: 10000, // 10 segundos
  
  maxRetries: 2,
  baseRetryDelay: 500,
  maxRetryDelay: 4000,
  
  networkCheckInterval: 10000,
  slowNetworkThreshold: 1500,
  
  enablePKCE: true,
  heartbeatInterval: 60000, // 1 minuto
  sessionRefreshMargin: 300000,
  
  enableMetrics: false,
  enableDetailedLogs: false
};

/**
 * Classe para gerenciar configurações específicas do iOS
 */
export class iOSConfigManager {
  private static instance: iOSConfigManager;
  private config: iOSAuthConfig;
  private logger: AuthLogger;
  private platform: string;
  
  private constructor() {
    this.logger = new AuthLogger();
    this.platform = this.detectPlatform();
    this.config = this.platform === 'ios' ? DEFAULT_IOS_CONFIG : DEFAULT_OTHER_CONFIG;
    
    this.logger.info('iOS Config initialized', {
      platform: this.platform,
      config: this.sanitizeConfigForLog(this.config)
    });
  }
  
  public static getInstance(): iOSConfigManager {
    if (!iOSConfigManager.instance) {
      iOSConfigManager.instance = new iOSConfigManager();
    }
    return iOSConfigManager.instance;
  }
  
  /**
   * Detectar plataforma atual
   */
  private detectPlatform(): string {
    if (typeof window === 'undefined') {
      return 'server';
    }
    
    const userAgent = window.navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      return 'ios';
    }
    
    if (/Android/.test(userAgent)) {
      return 'android';
    }
    
    return 'web';
  }
  
  /**
   * Obter configuração atual
   */
  public getConfig(): iOSAuthConfig {
    return { ...this.config };
  }
  
  /**
   * Verificar se é iOS
   */
  public isIOS(): boolean {
    return this.platform === 'ios';
  }
  
  /**
   * Obter plataforma atual
   */
  public getPlatform(): string {
    return this.platform;
  }
  
  /**
   * Atualizar configuração específica
   */
  public updateConfig(updates: Partial<iOSAuthConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    
    this.logger.info('iOS Config updated', {
      platform: this.platform,
      oldConfig: this.sanitizeConfigForLog(oldConfig),
      newConfig: this.sanitizeConfigForLog(this.config),
      updates
    });
  }
  
  /**
   * Obter timeout baseado no tipo de operação
   */
  public getTimeout(operation: 'auth' | 'profile' | 'refresh'): number {
    switch (operation) {
      case 'auth':
        return this.config.authTimeout;
      case 'profile':
        return this.config.profileTimeout;
      case 'refresh':
        return this.config.refreshTimeout;
      default:
        return this.config.authTimeout;
    }
  }
  
  /**
   * Calcular delay para retry com backoff exponencial
   */
  public calculateRetryDelay(attempt: number): number {
    const delay = this.config.baseRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // 10% de jitter
    const finalDelay = Math.min(delay + jitter, this.config.maxRetryDelay);
    
    this.logger.debug('Calculated retry delay', {
      attempt,
      baseDelay: this.config.baseRetryDelay,
      calculatedDelay: delay,
      jitter,
      finalDelay,
      maxDelay: this.config.maxRetryDelay
    });
    
    return finalDelay;
  }
  
  /**
   * Verificar se deve fazer retry baseado no número de tentativas
   */
  public shouldRetry(attempt: number): boolean {
    return attempt <= this.config.maxRetries;
  }
  
  /**
   * Obter configurações do Supabase otimizadas
   */
  public getSupabaseConfig(supabaseUrl: string, supabaseKey: string): {
    client: SupabaseClient;
    options: any;
  } {
    const options = {
      auth: {
        // Usar PKCE para maior segurança e confiabilidade
        flowType: this.config.enablePKCE ? 'pkce' : 'implicit',
        
        // Configurações de sessão otimizadas para iOS
        persistSession: true,
        detectSessionInUrl: true,
        
        // Timeouts específicos
        autoRefreshToken: true,
        
        // Headers específicos para iOS
        headers: {
          'X-Client-Platform': this.platform,
          'X-Client-Version': '1.0.0',
          'X-iOS-Optimized': this.isIOS() ? 'true' : 'false'
        }
      },
      
      // Configurações de rede
      realtime: {
        params: {
          eventsPerSecond: this.isIOS() ? 5 : 10, // Menos eventos por segundo no iOS
        },
        heartbeatIntervalMs: this.config.heartbeatInterval,
        reconnectAfterMs: (tries: number) => {
          // Backoff mais conservador no iOS
          const baseDelay = this.isIOS() ? 2000 : 1000;
          return Math.min(baseDelay * Math.pow(2, tries), 30000);
        }
      },
      
      // Configurações globais
      global: {
        headers: {
          'X-Client-Platform': this.platform,
          'X-Request-Timeout': this.config.authTimeout.toString()
        }
      }
    };
    
    const client = createClient(supabaseUrl, supabaseKey, options);
    
    this.logger.info('Supabase client configured', {
      platform: this.platform,
      flowType: options.auth.flowType,
      heartbeatInterval: this.config.heartbeatInterval,
      isIOS: this.isIOS()
    });
    
    return { client, options };
  }
  
  /**
   * Configurar monitoramento de rede específico para iOS
   */
  public setupNetworkMonitoring(callback: (status: 'online' | 'offline' | 'slow') => void): () => void {
    let networkStatus: 'online' | 'offline' | 'slow' = 'online';
    let lastCheck = Date.now();
    
    // Verificar conectividade inicial
    const checkNetwork = async () => {
      const startTime = Date.now();
      
      try {
        // Fazer uma requisição simples para verificar conectividade
        const response = await fetch('https://httpbin.org/status/200', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(this.config.slowNetworkThreshold)
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const newStatus = responseTime > this.config.slowNetworkThreshold ? 'slow' : 'online';
          
          if (newStatus !== networkStatus) {
            networkStatus = newStatus;
            callback(networkStatus);
            
            this.logger.info('Network status changed', {
              status: networkStatus,
              responseTime,
              threshold: this.config.slowNetworkThreshold
            });
          }
        } else {
          if (networkStatus !== 'offline') {
            networkStatus = 'offline';
            callback(networkStatus);
            this.logger.warn('Network offline detected');
          }
        }
      } catch (error) {
        if (networkStatus !== 'offline') {
          networkStatus = 'offline';
          callback(networkStatus);
          this.logger.warn('Network check failed', { error });
        }
      }
      
      lastCheck = Date.now();
    };
    
    // Verificação inicial
    checkNetwork();
    
    // Configurar verificação periódica
    const interval = setInterval(checkNetwork, this.config.networkCheckInterval);
    
    // Listeners para eventos de rede do browser
    const handleOnline = () => {
      this.logger.info('Browser online event detected');
      checkNetwork();
    };
    
    const handleOffline = () => {
      this.logger.warn('Browser offline event detected');
      networkStatus = 'offline';
      callback(networkStatus);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    
    // Retornar função de cleanup
    return () => {
      clearInterval(interval);
      
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }
  
  /**
   * Obter informações de performance da rede
   */
  public getNetworkInfo(): {
    type: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
  } | null {
    if (typeof window === 'undefined') {
      return null;
    }
    
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (!connection) {
      return null;
    }
    
    return {
      type: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0
    };
  }
  
  /**
   * Verificar se a rede está lenta
   */
  public isSlowNetwork(): boolean {
    const networkInfo = this.getNetworkInfo();
    
    if (!networkInfo) {
      return false;
    }
    
    // Considerar lenta se:
    // - effectiveType é 'slow-2g' ou '2g'
    // - RTT > 1000ms
    // - downlink < 0.5 Mbps
    return networkInfo.effectiveType === 'slow-2g' ||
           networkInfo.effectiveType === '2g' ||
           networkInfo.rtt > 1000 ||
           networkInfo.downlink < 0.5;
  }
  
  /**
   * Sanitizar configuração para log (remover dados sensíveis)
   */
  private sanitizeConfigForLog(config: iOSAuthConfig): Partial<iOSAuthConfig> {
    return {
      authTimeout: config.authTimeout,
      profileTimeout: config.profileTimeout,
      refreshTimeout: config.refreshTimeout,
      maxRetries: config.maxRetries,
      enablePKCE: config.enablePKCE,
      heartbeatInterval: config.heartbeatInterval,
      enableMetrics: config.enableMetrics,
      enableDetailedLogs: config.enableDetailedLogs
    };
  }
  
  /**
   * Obter configuração otimizada baseada na qualidade da rede
   */
  public getAdaptiveConfig(): iOSAuthConfig {
    const baseConfig = { ...this.config };
    
    // Se a rede está lenta, aumentar timeouts
    if (this.isSlowNetwork()) {
      baseConfig.authTimeout *= 1.5;
      baseConfig.profileTimeout *= 1.5;
      baseConfig.refreshTimeout *= 1.5;
      baseConfig.maxRetries += 1;
      
      this.logger.info('Applied slow network adaptations', {
        originalAuthTimeout: this.config.authTimeout,
        adaptedAuthTimeout: baseConfig.authTimeout,
        originalMaxRetries: this.config.maxRetries,
        adaptedMaxRetries: baseConfig.maxRetries
      });
    }
    
    return baseConfig;
  }
  
  /**
   * Reset para configurações padrão
   */
  public resetToDefaults(): void {
    const oldConfig = { ...this.config };
    this.config = this.platform === 'ios' ? { ...DEFAULT_IOS_CONFIG } : { ...DEFAULT_OTHER_CONFIG };
    
    this.logger.info('Config reset to defaults', {
      platform: this.platform,
      oldConfig: this.sanitizeConfigForLog(oldConfig),
      newConfig: this.sanitizeConfigForLog(this.config)
    });
  }
}

/**
 * Instância singleton do gerenciador de configuração
 */
export const iOSConfig = iOSConfigManager.getInstance();