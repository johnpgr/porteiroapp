import { AuthUser } from './AuthManager';
import { AuthLogger } from './AuthLogger';

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  lastLoginTime: string | null;
  sessionId: string | null;
  userType: 'admin' | 'porteiro' | 'morador' | null;
  retryCount: number;
  networkStatus: 'online' | 'offline' | 'unknown';
}

export type AuthStateListener = (state: AuthState) => void;

export interface AuthStateUpdate {
  user?: AuthUser | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  isInitializing?: boolean;
  error?: string | null;
  lastLoginTime?: string | null;
  sessionId?: string | null;
  userType?: 'admin' | 'porteiro' | 'morador' | null;
  retryCount?: number;
  networkStatus?: 'online' | 'offline' | 'unknown';
}

export class AuthStateManager {
  private state: AuthState;
  private listeners: Set<AuthStateListener> = new Set();
  private logger: AuthLogger;
  private stateHistory: { timestamp: string; state: AuthState }[] = [];
  private maxHistorySize = 50;
  private updateQueue: AuthStateUpdate[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.logger = new AuthLogger('error');
    
    // Estado inicial
    this.state = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: true,
      error: null,
      lastLoginTime: null,
      sessionId: null,
      userType: null,
      retryCount: 0,
      networkStatus: 'unknown'
    };

    this.logger.info('AuthStateManager initialized', { initialState: this.state });
  }

  /**
   * Obter estado atual
   */
  public getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Atualizar estado de forma segura
   */
  public async updateState(updates: AuthStateUpdate): Promise<void> {
    // Adicionar à fila para processamento sequencial
    this.updateQueue.push(updates);
    
    if (!this.isProcessingQueue) {
      await this.processUpdateQueue();
    }
  }

  /**
   * Processar fila de atualizações
   */
  private async processUpdateQueue(): Promise<void> {
    this.isProcessingQueue = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift()!;
        await this.applyStateUpdate(update);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Aplicar atualização de estado
   */
  private async applyStateUpdate(updates: AuthStateUpdate): Promise<void> {
    const previousState = { ...this.state };
    
    // Aplicar atualizações
    this.state = {
      ...this.state,
      ...updates
    };

    // Validar consistência do estado
    this.validateStateConsistency();

    // Salvar no histórico
    this.saveStateToHistory(previousState);

    // Log da mudança
    this.logger.debug('State updated', {
      previous: this.sanitizeStateForLog(previousState),
      current: this.sanitizeStateForLog(this.state),
      updates
    });

    // Notificar listeners
    this.notifyListeners();
  }

  /**
   * Validar consistência do estado
   */
  private validateStateConsistency(): void {
    // Se há usuário, deve estar autenticado
    if (this.state.user && !this.state.isAuthenticated) {
      this.logger.warn('State inconsistency: user exists but not authenticated');
      this.state.isAuthenticated = true;
    }

    // Se não há usuário, não deve estar autenticado
    if (!this.state.user && this.state.isAuthenticated) {
      this.logger.warn('State inconsistency: no user but authenticated');
      this.state.isAuthenticated = false;
      this.state.userType = null;
      this.state.sessionId = null;
    }

    // Se não está carregando e não está inicializando, não deve ter erro de loading
    if (!this.state.isLoading && !this.state.isInitializing && this.state.error) {
      // Manter erro por um tempo para que a UI possa exibi-lo
      setTimeout(() => {
        if (!this.state.isLoading && !this.state.isInitializing) {
          this.updateState({ error: null });
        }
      }, 5000);
    }

    // Resetar retry count em caso de sucesso
    if (this.state.isAuthenticated && this.state.retryCount > 0) {
      this.state.retryCount = 0;
    }
  }

  /**
   * Salvar estado no histórico
   */
  private saveStateToHistory(previousState: AuthState): void {
    this.stateHistory.push({
      timestamp: new Date().toISOString(),
      state: previousState
    });

    // Manter apenas os últimos estados
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Sanitizar estado para log (remover dados sensíveis)
   */
  private sanitizeStateForLog(state: AuthState): Partial<AuthState> {
    return {
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      isInitializing: state.isInitializing,
      error: state.error,
      lastLoginTime: state.lastLoginTime,
      userType: state.userType,
      retryCount: state.retryCount,
      networkStatus: state.networkStatus,
      // Não incluir dados do usuário ou sessionId
      user: state.user ? { id: state.user.id, email: '***' } : null
    };
  }

  /**
   * Notificar todos os listeners
   */
  private notifyListeners(): void {
    const currentState = this.getState();
    
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        this.logger.error('Error in state listener', { error });
      }
    });
  }

  /**
   * Adicionar listener
   */
  public addListener(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    
    // Chamar imediatamente com o estado atual
    try {
      listener(this.getState());
    } catch (error) {
      this.logger.error('Error in new state listener', { error });
    }

    // Retornar função para remover listener
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Remover listener
   */
  public removeListener(listener: AuthStateListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Limpar todos os listeners
   */
  public clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Resetar estado para inicial
   */
  public async resetState(): Promise<void> {
    await this.updateState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
      error: null,
      lastLoginTime: null,
      sessionId: null,
      userType: null,
      retryCount: 0
    });

    this.logger.info('State reset to initial');
  }

  /**
   * Definir estado de loading
   */
  public async setLoading(isLoading: boolean, error?: string | null): Promise<void> {
    await this.updateState({ 
      isLoading, 
      error: error !== undefined ? error : (isLoading ? null : this.state.error)
    });
  }

  /**
   * Definir estado de inicialização
   */
  public async setInitializing(isInitializing: boolean): Promise<void> {
    await this.updateState({ isInitializing });
  }

  /**
   * Definir erro
   */
  public async setError(error: string | null): Promise<void> {
    await this.updateState({ error, isLoading: false });
  }

  /**
   * Incrementar contador de retry
   */
  public async incrementRetryCount(): Promise<void> {
    await this.updateState({ retryCount: this.state.retryCount + 1 });
  }

  /**
   * Definir status da rede
   */
  public async setNetworkStatus(networkStatus: 'online' | 'offline' | 'unknown'): Promise<void> {
    await this.updateState({ networkStatus });
  }

  /**
   * Definir usuário autenticado
   */
  public async setAuthenticatedUser(
    user: AuthUser, 
    userType: 'admin' | 'porteiro' | 'morador',
    sessionId: string
  ): Promise<void> {
    await this.updateState({
      user,
      userType,
      sessionId,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
      error: null,
      lastLoginTime: new Date().toISOString(),
      retryCount: 0
    });
  }

  /**
   * Limpar usuário (logout)
   */
  public async clearUser(): Promise<void> {
    await this.updateState({
      user: null,
      userType: null,
      sessionId: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      retryCount: 0
    });
  }

  /**
   * Obter histórico de estados
   */
  public getStateHistory(): { timestamp: string; state: AuthState }[] {
    return [...this.stateHistory];
  }

  /**
   * Obter estatísticas do estado
   */
  public getStateStats(): {
    totalUpdates: number;
    currentListeners: number;
    lastUpdate: string | null;
    averageUpdateInterval: number;
    errorCount: number;
    successfulLogins: number;
  } {
    const errorCount = this.stateHistory.filter(h => h.state.error !== null).length;
    const successfulLogins = this.stateHistory.filter(h => 
      h.state.isAuthenticated && h.state.lastLoginTime
    ).length;

    let averageUpdateInterval = 0;
    if (this.stateHistory.length > 1) {
      const intervals = [];
      for (let i = 1; i < this.stateHistory.length; i++) {
        const current = new Date(this.stateHistory[i].timestamp).getTime();
        const previous = new Date(this.stateHistory[i - 1].timestamp).getTime();
        intervals.push(current - previous);
      }
      averageUpdateInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    return {
      totalUpdates: this.stateHistory.length,
      currentListeners: this.listeners.size,
      lastUpdate: this.stateHistory.length > 0 ? 
        this.stateHistory[this.stateHistory.length - 1].timestamp : null,
      averageUpdateInterval,
      errorCount,
      successfulLogins
    };
  }

  /**
   * Verificar se o estado está consistente
   */
  public isStateConsistent(): boolean {
    // Verificar consistência básica
    if (this.state.user && !this.state.isAuthenticated) return false;
    if (!this.state.user && this.state.isAuthenticated) return false;
    if (this.state.isAuthenticated && !this.state.userType) return false;
    if (this.state.isAuthenticated && !this.state.sessionId) return false;
    
    return true;
  }

  /**
   * Forçar validação e correção do estado
   */
  public async validateAndFixState(): Promise<void> {
    if (!this.isStateConsistent()) {
      this.logger.warn('State inconsistency detected, fixing...');
      this.validateStateConsistency();
      this.notifyListeners();
    }
  }
}