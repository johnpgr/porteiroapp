import type { SupabaseConfig } from '../core/client.ts';
import type { PlatformDetector } from '../utils/platform.ts';
import { AuthLogger } from '../utils/logger.ts';

/**
 * Configurações específicas por plataforma
 */
export interface PlatformAuthConfig {
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
const IOS_CONFIG: PlatformAuthConfig = {
  authTimeout: 25000,
  profileTimeout: 20000,
  refreshTimeout: 15000,
  maxRetries: 3,
  baseRetryDelay: 1000,
  maxRetryDelay: 8000,
  networkCheckInterval: 5000,
  slowNetworkThreshold: 2000,
  enablePKCE: true,
  heartbeatInterval: 30000,
  sessionRefreshMargin: 300000,
  enableMetrics: true,
  enableDetailedLogs: true,
};

/**
 * Configurações padrão para Android
 */
const ANDROID_CONFIG: PlatformAuthConfig = {
  authTimeout: 20000,
  profileTimeout: 15000,
  refreshTimeout: 12000,
  maxRetries: 2,
  baseRetryDelay: 800,
  maxRetryDelay: 6000,
  networkCheckInterval: 8000,
  slowNetworkThreshold: 1800,
  enablePKCE: true,
  heartbeatInterval: 45000,
  sessionRefreshMargin: 300000,
  enableMetrics: false,
  enableDetailedLogs: false,
};

/**
 * Configurações padrão para Web
 */
const WEB_CONFIG: PlatformAuthConfig = {
  authTimeout: 15000,
  profileTimeout: 12000,
  refreshTimeout: 10000,
  maxRetries: 2,
  baseRetryDelay: 500,
  maxRetryDelay: 4000,
  networkCheckInterval: 10000,
  slowNetworkThreshold: 1500,
  enablePKCE: true,
  heartbeatInterval: 60000,
  sessionRefreshMargin: 300000,
  enableMetrics: false,
  enableDetailedLogs: false,
};

/**
 * Configurações padrão para Server
 */
const SERVER_CONFIG: PlatformAuthConfig = {
  authTimeout: 10000,
  profileTimeout: 8000,
  refreshTimeout: 8000,
  maxRetries: 1,
  baseRetryDelay: 300,
  maxRetryDelay: 2000,
  networkCheckInterval: 0,
  slowNetworkThreshold: 1000,
  enablePKCE: false,
  heartbeatInterval: 0,
  sessionRefreshMargin: 300000,
  enableMetrics: false,
  enableDetailedLogs: false,
};

/**
 * Classe para gerenciar configurações específicas por plataforma
 */
export class PlatformConfigManager {
  private config: PlatformAuthConfig;
  private logger: AuthLogger;
  private platformDetector: PlatformDetector;

  constructor(platformDetector: PlatformDetector, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error') {
    this.platformDetector = platformDetector;
    this.logger = new AuthLogger(logLevel, platformDetector.getPlatform());
    this.config = this.getDefaultConfig();

    this.logger.info('Platform Config initialized', {
      platform: this.platformDetector.getPlatform(),
      config: this.sanitizeConfigForLog(this.config),
    });
  }

  /**
   * Obter configuração padrão baseada na plataforma
   */
  private getDefaultConfig(): PlatformAuthConfig {
    const platform = this.platformDetector.getPlatform();
    
    switch (platform) {
      case 'ios':
        return { ...IOS_CONFIG };
      case 'android':
        return { ...ANDROID_CONFIG };
      case 'web':
        return { ...WEB_CONFIG };
      case 'server':
        return { ...SERVER_CONFIG };
      default:
        return { ...WEB_CONFIG };
    }
  }

  /**
   * Obter configuração atual
   */
  public getConfig(): PlatformAuthConfig {
    return { ...this.config };
  }

  /**
   * Atualizar configuração específica
   */
  public updateConfig(updates: Partial<PlatformAuthConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    this.logger.info('Platform Config updated', {
      platform: this.platformDetector.getPlatform(),
      oldConfig: this.sanitizeConfigForLog(oldConfig),
      newConfig: this.sanitizeConfigForLog(this.config),
      updates,
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
    const jitter = Math.random() * 0.1 * delay;
    const finalDelay = Math.min(delay + jitter, this.config.maxRetryDelay);

    this.logger.debug('Calculated retry delay', {
      attempt,
      baseDelay: this.config.baseRetryDelay,
      calculatedDelay: delay,
      jitter,
      finalDelay,
      maxDelay: this.config.maxRetryDelay,
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
  public getSupabaseOptions(storage?: any): NonNullable<SupabaseConfig['options']> {
    const platform = this.platformDetector.getPlatform();
    const isServer = this.platformDetector.isServer();
    const isMobile = this.platformDetector.isMobile();

    const options: SupabaseConfig['options'] = {
      auth: {
        flowType: this.config.enablePKCE && !isServer ? 'pkce' : 'implicit',
        persistSession: !isServer,
        detectSessionInUrl: !isMobile && !isServer,
        autoRefreshToken: true,
        ...(storage && { storage }),
      },
      global: {
        headers: {
          'X-Client-Platform': platform,
          'X-Client-Version': '1.0.0',
          'X-Request-Timeout': this.config.authTimeout.toString(),
        },
      },
    };

    // Adicionar configurações de realtime apenas para ambientes não-server
    if (!isServer) {
      options.realtime = {
        params: {
          eventsPerSecond: this.platformDetector.isIOS() ? 5 : 10,
        },
        heartbeatIntervalMs: this.config.heartbeatInterval,
        reconnectAfterMs: (tries: number) => {
          const baseDelay = this.platformDetector.isIOS() ? 2000 : 1000;
          return Math.min(baseDelay * Math.pow(2, tries), 30000);
        },
      };
    }

    this.logger.info('Supabase options configured', {
      platform,
      flowType: options.auth?.flowType,
      heartbeatInterval: this.config.heartbeatInterval,
      hasStorage: !!storage,
    });

    return options;
  }

  /**
   * Obter configuração otimizada baseada na qualidade da rede
   */
  public getAdaptiveConfig(isSlowNetwork: boolean = false): PlatformAuthConfig {
    const baseConfig = { ...this.config };

    if (isSlowNetwork) {
      baseConfig.authTimeout *= 1.5;
      baseConfig.profileTimeout *= 1.5;
      baseConfig.refreshTimeout *= 1.5;
      baseConfig.maxRetries += 1;

      this.logger.info('Applied slow network adaptations', {
        originalAuthTimeout: this.config.authTimeout,
        adaptedAuthTimeout: baseConfig.authTimeout,
        originalMaxRetries: this.config.maxRetries,
        adaptedMaxRetries: baseConfig.maxRetries,
      });
    }

    return baseConfig;
  }

  /**
   * Reset para configurações padrão
   */
  public resetToDefaults(): void {
    const oldConfig = { ...this.config };
    this.config = this.getDefaultConfig();

    this.logger.info('Config reset to defaults', {
      platform: this.platformDetector.getPlatform(),
      oldConfig: this.sanitizeConfigForLog(oldConfig),
      newConfig: this.sanitizeConfigForLog(this.config),
    });
  }

  /**
   * Sanitizar configuração para log
   */
  private sanitizeConfigForLog(config: PlatformAuthConfig): Partial<PlatformAuthConfig> {
    return {
      authTimeout: config.authTimeout,
      profileTimeout: config.profileTimeout,
      refreshTimeout: config.refreshTimeout,
      maxRetries: config.maxRetries,
      enablePKCE: config.enablePKCE,
      heartbeatInterval: config.heartbeatInterval,
      enableMetrics: config.enableMetrics,
      enableDetailedLogs: config.enableDetailedLogs,
    };
  }

  /**
   * Obter logger
   */
  public getLogger(): AuthLogger {
    return this.logger;
  }
}
