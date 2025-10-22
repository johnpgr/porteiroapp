import { AuthUser } from '../AuthManager';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  requiresRetry?: boolean;
  retryAfter?: number;
}

export interface AuthContext {
  platform: string;
  networkType?: string;
  retryCount: number;
  sessionId: string;
}

export interface IAuthStrategy {
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  refreshSession(): Promise<AuthResult>;
}

/**
 * Base class para estratégias de autenticação
 */
export abstract class AuthStrategy {
  protected userType: 'admin' | 'porteiro' | 'morador';
  
  constructor(userType: 'admin' | 'porteiro' | 'morador') {
    this.userType = userType;
  }

  /**
   * Autenticar usuário
   */
  abstract authenticate(
    credentials: AuthCredentials, 
    context: AuthContext
  ): Promise<AuthResult>;

  /**
   * Carregar perfil completo do usuário
   */
  abstract loadUserProfile(
    userId: string, 
    context: AuthContext
  ): Promise<AuthResult>;

  /**
   * Validar se o usuário pertence a este tipo
   */
  abstract validateUserType(user: any): boolean;

  /**
   * Obter configurações específicas do tipo de usuário
   */
  abstract getTypeSpecificConfig(): {
    tableName: string;
    requiredFields: string[];
    permissions: string[];
    redirectPath: string;
  };

  /**
   * Transformar dados do Supabase para AuthUser
   */
  protected abstract transformToAuthUser(supabaseUser: any, profileData: any): AuthUser;

  /**
   * Validar credenciais antes da autenticação
   */
  protected validateCredentials(credentials: AuthCredentials): { valid: boolean; error?: string } {
    if (!credentials.email || !credentials.password) {
      return { valid: false, error: 'Email e senha são obrigatórios' };
    }

    if (!this.isValidEmail(credentials.email)) {
      return { valid: false, error: 'Email inválido' };
    }

    if (credentials.password.length < 6) {
      return { valid: false, error: 'Senha deve ter pelo menos 6 caracteres' };
    }

    return { valid: true };
  }

  /**
   * Validar formato do email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Obter tipo de usuário
   */
  public getUserType(): 'admin' | 'porteiro' | 'morador' {
    return this.userType;
  }

  /**
   * Verificar se deve tentar novamente baseado no erro
   */
  protected shouldRetry(error: any, retryCount: number): { shouldRetry: boolean; retryAfter?: number } {
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) {
      return { shouldRetry: false };
    }

    // Não tentar novamente para erros de credenciais
    if (error?.message?.includes('Invalid login credentials') || 
        error?.message?.includes('Email not confirmed')) {
      return { shouldRetry: false };
    }

    // Tentar novamente para erros de rede/timeout
    if (error?.message?.includes('timeout') || 
        error?.message?.includes('network') ||
        error?.message?.includes('fetch')) {
      const retryAfter = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
      return { shouldRetry: true, retryAfter };
    }

    return { shouldRetry: false };
  }

  /**
   * Formatar erro para exibição
   */
  protected formatError(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      // Traduzir erros comuns do Supabase
      const message = error.message.toLowerCase();
      
      if (message.includes('invalid login credentials')) {
        return 'Email ou senha incorretos';
      }
      
      if (message.includes('email not confirmed')) {
        return 'Email não confirmado. Verifique sua caixa de entrada';
      }
      
      if (message.includes('timeout')) {
        return 'Tempo limite excedido. Tente novamente';
      }
      
      if (message.includes('network') || message.includes('fetch')) {
        return 'Erro de conexão. Verifique sua internet';
      }
      
      if (message.includes('too many requests')) {
        return 'Muitas tentativas. Aguarde alguns minutos';
      }

      return error.message;
    }

    return 'Erro desconhecido durante a autenticação';
  }

  /**
   * Verificar se o erro é relacionado a permissões
   */
  protected isPermissionError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('permission') || 
           message.includes('unauthorized') ||
           message.includes('access denied');
  }

  /**
   * Verificar se o erro é de timeout
   */
  protected isTimeoutError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('timeout') || 
           message.includes('timed out') ||
           error?.code === 'TIMEOUT';
  }

  /**
   * Verificar se o erro é de rede
   */
  protected isNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('network') || 
           message.includes('fetch') ||
           message.includes('connection') ||
           error?.code === 'NETWORK_ERROR';
  }
}