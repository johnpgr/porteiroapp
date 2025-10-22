import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AuthLogger } from './AuthLogger';

export interface NetworkConfig {
  authTimeout: number;
  profileTimeout: number;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeoutMultiplier: number;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
}

export class iOSNetworkHandler {
  private logger: AuthLogger;
  private config: NetworkConfig;
  private isOnline: boolean = true;

  constructor() {
    this.logger = AuthLogger.getInstance();
    
    // Configurações específicas para iOS com timeouts mais longos
    this.config = {
      authTimeout: Platform.OS === 'ios' ? 25000 : 15000, // 25s para iOS, 15s para outros
      profileTimeout: Platform.OS === 'ios' ? 20000 : 12000, // 20s para iOS, 12s para outros
      maxRetries: Platform.OS === 'ios' ? 3 : 2, // Mais tentativas no iOS
      baseDelay: 1000, // 1 segundo inicial
      maxDelay: 8000, // Máximo 8 segundos
      timeoutMultiplier: Platform.OS === 'ios' ? 1.5 : 1.2 // Multiplicador maior para iOS
    };

    this.initializeNetworkMonitoring();
    this.logger.info('iOS Network Handler initialized', { config: this.config });
  }

  /**
   * Inicializar monitoramento de rede
   */
  private initializeNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOnline !== this.isOnline) {
        this.logger.info('Network status changed', { 
          isOnline: this.isOnline,
          type: state.type,
          details: state.details
        });
      }
    });
  }

  /**
   * Executar operação com retry inteligente e timeouts adaptativos
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = this.config.maxRetries,
      baseDelay = this.config.baseDelay,
      maxDelay = this.config.maxDelay,
      shouldRetry = this.defaultShouldRetry
    } = options;

    let lastError: any;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // Verificar conectividade antes de tentar
        if (!this.isOnline) {
          await this.waitForConnection();
        }

        this.logger.info('Executing operation', { attempt, maxRetries });
        
        // Executar operação com timeout adaptativo
        const result = await this.executeWithTimeout(operation, attempt);
        
        if (attempt > 0) {
          this.logger.info('Operation succeeded after retry', { attempt });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        attempt++;
        
        this.logger.warn('Operation failed', { 
          attempt, 
          error: error.message,
          willRetry: attempt <= maxRetries && shouldRetry(error, attempt)
        });

        // Se não deve tentar novamente ou excedeu tentativas
        if (attempt > maxRetries || !shouldRetry(error, attempt)) {
          break;
        }

        // Calcular delay com backoff exponencial
        const delay = this.calculateBackoffDelay(attempt, baseDelay, maxDelay);
        
        this.logger.info('Waiting before retry', { delay, attempt });
        await this.sleep(delay);
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    this.logger.error('All retry attempts failed', { 
      totalAttempts: attempt,
      finalError: lastError.message 
    });
    
    throw this.enhanceError(lastError, attempt - 1);
  }

  /**
   * Executar operação com timeout adaptativo
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    attempt: number
  ): Promise<T> {
    // Timeout aumenta com as tentativas para dar mais tempo
    const timeout = this.config.authTimeout * Math.pow(this.config.timeoutMultiplier, attempt);
    
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms (attempt ${attempt + 1})`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Calcular delay com backoff exponencial
   */
  private calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    // Backoff exponencial com jitter para evitar thundering herd
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% de jitter
    const delay = Math.min(exponentialDelay + jitter, maxDelay);
    
    return Math.floor(delay);
  }

  /**
   * Determinar se deve tentar novamente baseado no erro
   */
  private defaultShouldRetry = (error: any, attempt: number): boolean => {
    // Não tentar novamente para erros de credenciais
    if (error.message?.includes('Invalid login credentials')) {
      return false;
    }
    
    if (error.message?.includes('Email not confirmed')) {
      return false;
    }
    
    // Tentar novamente para timeouts, erros de rede e erros temporários
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'fetch',
      'SSL',
      'TLS',
      'certificate'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    const isRetryable = retryableErrors.some(keyword => 
      errorMessage.includes(keyword.toLowerCase())
    );
    
    this.logger.info('Retry decision', { 
      error: error.message,
      attempt,
      isRetryable,
      matchedKeywords: retryableErrors.filter(k => errorMessage.includes(k.toLowerCase()))
    });
    
    return isRetryable;
  };

  /**
   * Aguardar conexão de rede
   */
  private async waitForConnection(maxWait: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.isOnline && (Date.now() - startTime) < maxWait) {
      this.logger.info('Waiting for network connection...');
      await this.sleep(1000);
      
      // Verificar status da rede novamente
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected ?? false;
    }
    
    if (!this.isOnline) {
      throw new Error('No network connection available');
    }
  }

  /**
   * Verificar qualidade da conexão
   */
  public async checkConnectionQuality(): Promise<{
    isConnected: boolean;
    type: string;
    strength?: 'poor' | 'moderate' | 'good' | 'excellent';
    details: any;
  }> {
    try {
      const netInfo = await NetInfo.fetch();
      
      let strength: 'poor' | 'moderate' | 'good' | 'excellent' | undefined;
      
      // Avaliar força do sinal para conexões móveis
      if (netInfo.type === 'cellular' && netInfo.details) {
        const details = netInfo.details as any;
        if (details.cellularGeneration) {
          switch (details.cellularGeneration) {
            case '2g':
              strength = 'poor';
              break;
            case '3g':
              strength = 'moderate';
              break;
            case '4g':
            case 'lte':
              strength = 'good';
              break;
            case '5g':
              strength = 'excellent';
              break;
          }
        }
      } else if (netInfo.type === 'wifi') {
        strength = 'good'; // Assumir boa qualidade para WiFi
      }
      
      return {
        isConnected: netInfo.isConnected ?? false,
        type: netInfo.type || 'unknown',
        strength,
        details: netInfo.details
      };
    } catch (error) {
      this.logger.error('Failed to check connection quality', { error: error.message });
      return {
        isConnected: false,
        type: 'unknown',
        details: null
      };
    }
  }

  /**
   * Melhorar erro com informações de contexto
   */
  private enhanceError(error: any, retryCount: number): Error {
    const enhancedError = new Error(error.message);
    (enhancedError as any).originalError = error;
    (enhancedError as any).retryCount = retryCount;
    (enhancedError as any).platform = Platform.OS;
    (enhancedError as any).isOnline = this.isOnline;
    
    // Adicionar informações específicas do iOS
    if (Platform.OS === 'ios') {
      (enhancedError as any).iOSSpecific = true;
      
      if (error.message?.includes('SSL') || error.message?.includes('TLS')) {
        (enhancedError as any).errorType = 'SSL_ERROR';
      } else if (error.message?.includes('timeout')) {
        (enhancedError as any).errorType = 'TIMEOUT_ERROR';
      } else if (error.message?.includes('network')) {
        (enhancedError as any).errorType = 'NETWORK_ERROR';
      }
    }
    
    return enhancedError;
  }

  /**
   * Utilitário para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obter configurações atuais
   */
  public getConfig(): NetworkConfig {
    return { ...this.config };
  }

  /**
   * Atualizar configurações
   */
  public updateConfig(newConfig: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Network handler config updated', { config: this.config });
  }

  /**
   * Obter status da rede
   */
  public isNetworkAvailable(): boolean {
    return this.isOnline;
  }
}