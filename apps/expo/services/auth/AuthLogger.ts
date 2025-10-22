import { Platform } from 'react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  platform: string;
  sessionId?: string;
}

export class AuthLogger {
  private sessionId: string;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor(logLevel: LogLevel = 'info') {
    this.sessionId = this.generateSessionId();
    this.logLevel = logLevel;
    
    this.info('AuthLogger initialized', { 
      sessionId: this.sessionId,
      platform: Platform.OS,
      logLevel 
    });
  }

  /**
   * Log de debug (apenas em desenvolvimento)
   */
  public debug(message: string, context?: any): void {
    if (__DEV__ && this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }

  /**
   * Log de informação
   */
  public info(message: string, context?: any): void {
    if (this.shouldLog('info')) {
      this.log('info', message, context);
    }
  }

  /**
   * Log de aviso
   */
  public warn(message: string, context?: any): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, context);
    }
  }

  /**
   * Log de erro
   */
  public error(message: string, context?: any): void {
    if (this.shouldLog('error')) {
      this.log('error', message, context);
    }
  }

  /**
   * Log interno
   */
  private log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.sanitizeContext(context),
      platform: Platform.OS,
      sessionId: this.sessionId
    };

    // Adicionar ao array de logs
    this.logs.push(entry);
    
    // Manter apenas os últimos logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log no console com formatação
    this.logToConsole(entry);
  }

  /**
   * Verificar se deve fazer log baseado no nível
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Log no console com formatação adequada
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[AUTH-${entry.level.toUpperCase()}] ${entry.timestamp}`;
    const message = `${prefix} ${entry.message}`;
    
    switch (entry.level) {
      case 'debug':
        console.log(message, entry.context || '');
        break;
      case 'info':
        console.info(message, entry.context || '');
        break;
      case 'warn':
        console.warn(message, entry.context || '');
        break;
      case 'error':
        console.error(message, entry.context || '');
        break;
    }
  }

  /**
   * Sanitizar contexto removendo informações sensíveis
   */
  private sanitizeContext(context: any): any {
    if (!context) return context;
    
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'auth',
      'credential',
      'session'
    ];
    
    const sanitized = { ...context };
    
    // Recursivamente sanitizar objeto
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      const result: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    return sanitizeObject(sanitized);
  }

  /**
   * Gerar ID único da sessão
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${random}`;
  }

  /**
   * Obter todos os logs da sessão atual
   */
  public getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  /**
   * Obter logs recentes (últimos N)
   */
  public getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Limpar logs
   */
  public clearLogs(): void {
    this.logs = [];
    this.info('Logs cleared');
  }

  /**
   * Obter estatísticas dos logs
   */
  public getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    sessionId: string;
    oldestLog?: string;
    newestLog?: string;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      } as Record<LogLevel, number>,
      sessionId: this.sessionId,
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp
    };
    
    this.logs.forEach(log => {
      stats.byLevel[log.level]++;
    });
    
    return stats;
  }

  /**
   * Exportar logs como string formatada
   */
  public exportLogs(): string {
    const header = `=== AUTH LOGS SESSION ${this.sessionId} ===\n`;
    const platform = `Platform: ${Platform.OS}\n`;
    const stats = this.getLogStats();
    const statsStr = `Total Logs: ${stats.total} (Debug: ${stats.byLevel.debug}, Info: ${stats.byLevel.info}, Warn: ${stats.byLevel.warn}, Error: ${stats.byLevel.error})\n\n`;
    
    const logsStr = this.logs
      .map(log => {
        const contextStr = log.context ? ` | Context: ${JSON.stringify(log.context)}` : '';
        return `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${contextStr}`;
      })
      .join('\n');
    
    return header + platform + statsStr + logsStr;
  }

  /**
   * Configurar nível de log
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Log level changed', { newLevel: level });
  }

  /**
   * Obter nível de log atual
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Obter ID da sessão
   */
  public getSessionId(): string {
    return this.sessionId;
  }
}