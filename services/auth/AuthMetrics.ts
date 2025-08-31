import { Platform } from 'react-native';
import { AuthLogger } from './AuthLogger';

export interface AuthAttemptMetric {
  timestamp: string;
  success: boolean;
  duration: number;
  retryCount: number;
  platform: string;
  userType?: string;
  errorCode?: string;
  networkType?: string;
}

export interface PerformanceMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  averageDuration: number;
  averageRetryCount: number;
  timeoutCount: number;
  networkErrorCount: number;
  credentialErrorCount: number;
  platformBreakdown: Record<string, {
    attempts: number;
    successRate: number;
    averageDuration: number;
  }>;
  userTypeBreakdown: Record<string, {
    attempts: number;
    successRate: number;
    averageDuration: number;
  }>;
  recentTrends: {
    last24h: PerformanceSummary;
    last7d: PerformanceSummary;
    last30d: PerformanceSummary;
  };
}

export interface PerformanceSummary {
  attempts: number;
  successRate: number;
  averageDuration: number;
  timeoutRate: number;
}

export class AuthMetrics {
  private metrics: AuthAttemptMetric[] = [];
  private logger: AuthLogger;
  private maxMetrics: number = 10000;
  private performanceThresholds = {
    targetSuccessRate: 0.95, // 95%
    targetAverageDuration: 3000, // 3 segundos
    maxTimeoutRate: 0.02, // 2%
    maxFailureRecoveryTime: 5000 // 5 segundos
  };

  constructor() {
    this.logger = new AuthLogger('error');
    this.logger.info('AuthMetrics initialized', { 
      maxMetrics: this.maxMetrics,
      thresholds: this.performanceThresholds 
    });
  }

  /**
   * Registrar tentativa de autenticação
   */
  public recordAuthAttempt(
    success: boolean,
    duration: number,
    retryCount: number,
    platform: string,
    userType?: string,
    errorCode?: string,
    networkType?: string
  ): void {
    const metric: AuthAttemptMetric = {
      timestamp: new Date().toISOString(),
      success,
      duration,
      retryCount,
      platform,
      userType,
      errorCode,
      networkType
    };

    this.metrics.push(metric);
    
    // Manter apenas as métricas mais recentes
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.logger.debug('Auth attempt recorded', metric);
    
    // Verificar se há problemas de performance
    this.checkPerformanceAlerts(metric);
  }

  /**
   * Obter métricas completas
   */
  public getMetrics(): PerformanceMetrics {
    if (this.metrics.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalAttempts = this.metrics.length;
    const successfulAttempts = this.metrics.filter(m => m.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const successRate = successfulAttempts / totalAttempts;
    
    const durations = this.metrics.map(m => m.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    const retryCounts = this.metrics.map(m => m.retryCount);
    const averageRetryCount = retryCounts.reduce((a, b) => a + b, 0) / retryCounts.length;
    
    const timeoutCount = this.metrics.filter(m => 
      m.errorCode === 'TIMEOUT_ERROR' || 
      (m.errorCode && m.errorCode.includes('timeout'))
    ).length;
    
    const networkErrorCount = this.metrics.filter(m => 
      m.errorCode === 'NETWORK_ERROR' || 
      (m.errorCode && m.errorCode.includes('network'))
    ).length;
    
    const credentialErrorCount = this.metrics.filter(m => 
      m.errorCode === 'INVALID_CREDENTIALS'
    ).length;

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate,
      averageDuration,
      averageRetryCount,
      timeoutCount,
      networkErrorCount,
      credentialErrorCount,
      platformBreakdown: this.getPlatformBreakdown(),
      userTypeBreakdown: this.getUserTypeBreakdown(),
      recentTrends: this.getRecentTrends()
    };
  }

  /**
   * Obter breakdown por plataforma
   */
  private getPlatformBreakdown(): Record<string, {
    attempts: number;
    successRate: number;
    averageDuration: number;
  }> {
    const breakdown: Record<string, {
      attempts: number;
      successRate: number;
      averageDuration: number;
    }> = {};

    const platforms = [...new Set(this.metrics.map(m => m.platform))];
    
    platforms.forEach(platform => {
      const platformMetrics = this.metrics.filter(m => m.platform === platform);
      const successful = platformMetrics.filter(m => m.success).length;
      const durations = platformMetrics.map(m => m.duration);
      
      breakdown[platform] = {
        attempts: platformMetrics.length,
        successRate: successful / platformMetrics.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length
      };
    });

    return breakdown;
  }

  /**
   * Obter breakdown por tipo de usuário
   */
  private getUserTypeBreakdown(): Record<string, {
    attempts: number;
    successRate: number;
    averageDuration: number;
  }> {
    const breakdown: Record<string, {
      attempts: number;
      successRate: number;
      averageDuration: number;
    }> = {};

    const userTypes = [...new Set(this.metrics.map(m => m.userType).filter(Boolean))];
    
    userTypes.forEach(userType => {
      const userMetrics = this.metrics.filter(m => m.userType === userType);
      const successful = userMetrics.filter(m => m.success).length;
      const durations = userMetrics.map(m => m.duration);
      
      breakdown[userType!] = {
        attempts: userMetrics.length,
        successRate: successful / userMetrics.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length
      };
    });

    return breakdown;
  }

  /**
   * Obter tendências recentes
   */
  private getRecentTrends(): {
    last24h: PerformanceSummary;
    last7d: PerformanceSummary;
    last30d: PerformanceSummary;
  } {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      last24h: this.getPerformanceSummary(last24h),
      last7d: this.getPerformanceSummary(last7d),
      last30d: this.getPerformanceSummary(last30d)
    };
  }

  /**
   * Obter resumo de performance para um período
   */
  private getPerformanceSummary(since: Date): PerformanceSummary {
    const periodMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) >= since
    );

    if (periodMetrics.length === 0) {
      return {
        attempts: 0,
        successRate: 0,
        averageDuration: 0,
        timeoutRate: 0
      };
    }

    const successful = periodMetrics.filter(m => m.success).length;
    const timeouts = periodMetrics.filter(m => 
      m.errorCode === 'TIMEOUT_ERROR' || 
      (m.errorCode && m.errorCode.includes('timeout'))
    ).length;
    
    const durations = periodMetrics.map(m => m.duration);
    
    return {
      attempts: periodMetrics.length,
      successRate: successful / periodMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      timeoutRate: timeouts / periodMetrics.length
    };
  }

  /**
   * Verificar alertas de performance
   */
  private checkPerformanceAlerts(metric: AuthAttemptMetric): void {
    // Verificar se a duração está muito alta
    if (metric.duration > this.performanceThresholds.maxFailureRecoveryTime) {
      this.logger.warn('High duration detected', {
        duration: metric.duration,
        threshold: this.performanceThresholds.maxFailureRecoveryTime,
        platform: metric.platform
      });
    }

    // Verificar muitas tentativas
    if (metric.retryCount > 2) {
      this.logger.warn('High retry count detected', {
        retryCount: metric.retryCount,
        platform: metric.platform,
        errorCode: metric.errorCode
      });
    }

    // Verificar taxa de sucesso recente
    const recentMetrics = this.getRecentMetrics(10); // Últimas 10 tentativas
    if (recentMetrics.length >= 5) {
      const recentSuccessRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
      
      if (recentSuccessRate < this.performanceThresholds.targetSuccessRate) {
        this.logger.warn('Low success rate detected', {
          recentSuccessRate,
          threshold: this.performanceThresholds.targetSuccessRate,
          sampleSize: recentMetrics.length
        });
      }
    }
  }

  /**
   * Obter métricas recentes
   */
  private getRecentMetrics(count: number): AuthAttemptMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Obter métricas vazias
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      successRate: 0,
      averageDuration: 0,
      averageRetryCount: 0,
      timeoutCount: 0,
      networkErrorCount: 0,
      credentialErrorCount: 0,
      platformBreakdown: {},
      userTypeBreakdown: {},
      recentTrends: {
        last24h: { attempts: 0, successRate: 0, averageDuration: 0, timeoutRate: 0 },
        last7d: { attempts: 0, successRate: 0, averageDuration: 0, timeoutRate: 0 },
        last30d: { attempts: 0, successRate: 0, averageDuration: 0, timeoutRate: 0 }
      }
    };
  }

  /**
   * Limpar métricas
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.logger.info('Metrics cleared');
  }

  /**
   * Exportar métricas como JSON
   */
  public exportMetrics(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      platform: Platform.OS,
      metrics: this.getMetrics(),
      rawData: this.metrics
    }, null, 2);
  }

  /**
   * Obter relatório de saúde do sistema
   */
  public getHealthReport(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: PerformanceMetrics;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Verificar taxa de sucesso
    if (metrics.successRate < this.performanceThresholds.targetSuccessRate) {
      issues.push(`Taxa de sucesso baixa: ${(metrics.successRate * 100).toFixed(1)}%`);
      recommendations.push('Investigar causas de falhas de autenticação');
      status = metrics.successRate < 0.8 ? 'critical' : 'warning';
    }

    // Verificar duração média
    if (metrics.averageDuration > this.performanceThresholds.targetAverageDuration) {
      issues.push(`Duração média alta: ${metrics.averageDuration.toFixed(0)}ms`);
      recommendations.push('Otimizar timeouts e configurações de rede');
      if (status !== 'critical') status = 'warning';
    }

    // Verificar taxa de timeout
    const timeoutRate = metrics.timeoutCount / metrics.totalAttempts;
    if (timeoutRate > this.performanceThresholds.maxTimeoutRate) {
      issues.push(`Taxa de timeout alta: ${(timeoutRate * 100).toFixed(1)}%`);
      recommendations.push('Aumentar timeouts para iOS ou melhorar conectividade');
      status = 'critical';
    }

    // Verificar problemas específicos do iOS
    const iosMetrics = metrics.platformBreakdown['ios'];
    if (iosMetrics && iosMetrics.successRate < 0.9) {
      issues.push(`Problemas específicos no iOS: ${(iosMetrics.successRate * 100).toFixed(1)}% de sucesso`);
      recommendations.push('Implementar configurações específicas para iOS');
      if (status !== 'critical') status = 'warning';
    }

    return {
      status,
      issues,
      recommendations,
      metrics
    };
  }
}