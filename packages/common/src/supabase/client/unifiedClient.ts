import { createSupabaseClient, type TypedSupabaseClient } from '../core/client';
import type { PlatformDetector } from '../utils/platform';
import { PlatformConfigManager } from '../config/platformConfig';
import { AuthLogger } from '../utils/logger';

export interface UnifiedSupabaseClientOptions {
  url: string;
  anonKey: string;
  platformDetector: PlatformDetector;
  storage?: any;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Cliente Supabase unificado que funciona em todas as plataformas
 */
export class UnifiedSupabaseClient {
  private client: TypedSupabaseClient;
  private configManager: PlatformConfigManager;
  private logger: AuthLogger;
  private platformDetector: PlatformDetector;

  constructor(options: UnifiedSupabaseClientOptions) {
    this.platformDetector = options.platformDetector;
    this.configManager = new PlatformConfigManager(
      this.platformDetector,
      options.logLevel || 'error'
    );
    this.logger = this.configManager.getLogger();

    // Criar cliente Supabase com configurações otimizadas
    const supabaseOptions = this.configManager.getSupabaseOptions(options.storage);
    
    this.client = createSupabaseClient({
      url: options.url,
      anonKey: options.anonKey,
      options: supabaseOptions,
    });

    this.logger.info('Unified Supabase client initialized', {
      platform: this.platformDetector.getPlatform(),
      url: options.url.substring(0, 30) + '...',
      hasStorage: !!options.storage,
    });
  }

  /**
   * Obter cliente Supabase
   */
  public getClient(): TypedSupabaseClient {
    return this.client;
  }

  /**
   * Obter gerenciador de configuração
   */
  public getConfigManager(): PlatformConfigManager {
    return this.configManager;
  }

  /**
   * Obter logger
   */
  public getLogger(): AuthLogger {
    return this.logger;
  }

  /**
   * Executar operação com timeout
   * Aceita Promise ou PromiseLike (como query builders do Supabase)
   */
  public async withTimeout<T>(
    promiseOrThenable: PromiseLike<T>,
    operation: 'auth' | 'profile' | 'refresh' = 'auth'
  ): Promise<T> {
    const timeout = this.configManager.getTimeout(operation);
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(
          `Timeout: ${operation} operation took longer than ${timeout}ms (Platform: ${this.platformDetector.getPlatform()})`
        );
        this.logger.error('Operation timeout', {
          operation,
          timeout,
          platform: this.platformDetector.getPlatform(),
        });
        reject(error);
      }, timeout);

      // Convert PromiseLike to Promise to access catch method
      Promise.resolve(promiseOrThenable)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error: any) => {
          clearTimeout(timer);
          this.logger.error('Operation failed', {
            operation,
            error: error?.message,
            platform: this.platformDetector.getPlatform(),
          });
          reject(error);
        });
    });
  }

  /**
   * Executar operação com retry
   */
  public async withRetry<T>(
    fn: () => Promise<T>,
    operation: string = 'operation',
    retryCount: number = 0
  ): Promise<T> {
    const config = this.configManager.getConfig();

    try {
      return await fn();
    } catch (error) {
      this.logger.error(`${operation} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount,
        platform: this.platformDetector.getPlatform(),
      });

      // Verificar se deve fazer retry
      if (this.configManager.shouldRetry(retryCount + 1) && this.isRetryableError(error)) {
        const delay = this.configManager.calculateRetryDelay(retryCount + 1);
        
        this.logger.info(`Retrying ${operation}`, {
          retryCount: retryCount + 1,
          delay,
          maxRetries: config.maxRetries,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, operation, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Verificar se é erro que permite retry
   */
  private isRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code || '';

    // Erros de credencial não devem ter retry
    if (
      message.includes('invalid') ||
      message.includes('credential') ||
      message.includes('password') ||
      code === 'invalid_credentials'
    ) {
      return false;
    }

    // Erros de rede e timeout devem ter retry
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('fetch') ||
      code === 'NETWORK_ERROR' ||
      code === 'TIMEOUT'
    );
  }

  /**
   * Sign in com retry e timeout
   */
  public async signInWithPassword(email: string, password: string) {
    this.logger.info('Sign in attempt', {
      email,
      platform: this.platformDetector.getPlatform(),
    });

    return this.withRetry(
      async () => {
        return this.withTimeout(
          this.client.auth.signInWithPassword({ email, password }),
          'auth'
        );
      },
      'signInWithPassword'
    );
  }

  /**
   * Sign out
   */
  public async signOut() {
    this.logger.info('Sign out', {
      platform: this.platformDetector.getPlatform(),
    });

    return this.client.auth.signOut();
  }

  /**
   * Get session
   */
  public async getSession() {
    return this.withTimeout(
      this.client.auth.getSession(),
      'refresh'
    );
  }

  /**
   * Get user
   */
  public async getUser() {
    return this.withTimeout(
      this.client.auth.getUser(),
      'profile'
    );
  }

  /**
   * Refresh session
   */
  public async refreshSession() {
    return this.withTimeout(
      this.client.auth.refreshSession(),
      'refresh'
    );
  }

  /**
   * On auth state change
   */
  public onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.client.auth.onAuthStateChange((event, session) => {
      this.logger.debug('Auth state changed', {
        event,
        hasSession: !!session,
        platform: this.platformDetector.getPlatform(),
      });
      callback(event, session);
    });
  }
}
