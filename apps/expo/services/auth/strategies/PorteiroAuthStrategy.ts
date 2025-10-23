import { supabase } from '../../../utils/supabase';
import { AuthStrategy, AuthCredentials, AuthResult, AuthContext, IAuthStrategy } from './AuthStrategy';
import { AuthUser } from '../AuthManager';
import { AuthLogger } from '../AuthLogger';
import { router } from 'expo-router';

export class PorteiroAuthStrategy extends AuthStrategy implements IAuthStrategy {
  private logger: AuthLogger;

  constructor() {
    super('porteiro');
    this.logger = AuthLogger.getInstance();
  }

  /**
   * Autenticar porteiro
   */
  async authenticate(credentials: AuthCredentials, context: AuthContext): Promise<AuthResult> {
    this.logger.info('Porteiro authentication started', {
      email: credentials.email,
      platform: context.platform,
      retryCount: context.retryCount
    });

    try {
      // Validar credenciais
      const validation = this.validateCredentials(credentials);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Autenticar com Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (authError) {
        this.logger.error('Porteiro auth failed', { error: authError });
        
        const retryInfo = this.shouldRetry(authError, context.retryCount);
        return {
          success: false,
          error: this.formatError(authError),
          requiresRetry: retryInfo.shouldRetry,
          retryAfter: retryInfo.retryAfter
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Falha na autenticação'
        };
      }

      // Carregar perfil do porteiro
      const profileResult = await this.loadUserProfile(authData.user.id, context);
      
      if (!profileResult.success) {
        // Se falhou ao carregar perfil, fazer logout
        await supabase.auth.signOut();
        return profileResult;
      }

      this.logger.info('Porteiro authentication successful', {
        userId: authData.user.id,
        email: credentials.email
      });

      return {
        success: true,
        user: profileResult.user
      };

    } catch (error) {
      this.logger.error('Porteiro authentication error', { error });
      
      const retryInfo = this.shouldRetry(error, context.retryCount);
      return {
        success: false,
        error: this.formatError(error),
        requiresRetry: retryInfo.shouldRetry,
        retryAfter: retryInfo.retryAfter
      };
    }
  }

  /**
   * Carregar perfil completo do porteiro
   */
  async loadUserProfile(userId: string, context: AuthContext): Promise<AuthResult> {
    this.logger.debug('Loading porteiro profile', { userId });

    try {
      // Buscar dados do porteiro na tabela porteiros
      const { data: porteiroData, error: porteiroError } = await supabase
        .from('porteiros')
        .select(`
          id,
          nome,
          email,
          telefone,
          turno,
          ativo,
          created_at,
          updated_at,
          last_login,
          condominio_id,
          condominios (
            id,
            nome,
            endereco
          )
        `)
        .eq('user_id', userId)
        .eq('ativo', true)
        .single();

      if (porteiroError) {
        this.logger.error('Failed to load porteiro profile', { error: porteiroError, userId });
        
        if (porteiroError.code === 'PGRST116') {
          return {
            success: false,
            error: 'Usuário não encontrado ou não é um porteiro'
          };
        }
        
        const retryInfo = this.shouldRetry(porteiroError, context.retryCount);
        return {
          success: false,
          error: this.formatError(porteiroError),
          requiresRetry: retryInfo.shouldRetry,
          retryAfter: retryInfo.retryAfter
        };
      }

      if (!porteiroData) {
        router.push('/');
        return {
          success: false,
          error: 'Perfil de porteiro não encontrado'
        };
      }

      // Validar se é um porteiro válido
      if (!this.validateUserType(porteiroData)) {
        return {
          success: false,
          error: 'Usuário não possui permissões de porteiro'
        };
      }

      // Atualizar último login
      await this.updateLastLogin(porteiroData.id);

      // Transformar para AuthUser
      const authUser = this.transformToAuthUser({ id: userId }, porteiroData);

      this.logger.info('Porteiro profile loaded successfully', {
        userId,
        porteiroId: porteiroData.id,
        nome: porteiroData.nome,
        condominio: porteiroData.condominios?.nome
      });

      return {
        success: true,
        user: authUser
      };

    } catch (error) {
      this.logger.error('Error loading porteiro profile', { error, userId });
      
      const retryInfo = this.shouldRetry(error, context.retryCount);
      return {
        success: false,
        error: this.formatError(error),
        requiresRetry: retryInfo.shouldRetry,
        retryAfter: retryInfo.retryAfter
      };
    }
  }

  /**
   * Validar se o usuário é um porteiro válido
   */
  validateUserType(user: any): boolean {
    if (!user) return false;
    
    // Verificar se tem os campos obrigatórios
    const requiredFields = ['id', 'nome', 'email', 'ativo', 'condominio_id'];
    for (const field of requiredFields) {
      if (!user[field]) {
        this.logger.warn('Porteiro validation failed: missing field', { field, userId: user.id });
        return false;
      }
    }

    // Verificar se está ativo
    if (!user.ativo) {
      this.logger.warn('Porteiro validation failed: inactive user', { userId: user.id });
      return false;
    }

    // Verificar se tem condomínio associado
    if (!user.condominio_id) {
      this.logger.warn('Porteiro validation failed: no condominio', { userId: user.id });
      return false;
    }

    // Verificar se o turno é válido
    const validTurnos = ['manha', 'tarde', 'noite', 'madrugada', '24h'];
    if (user.turno && !validTurnos.includes(user.turno)) {
      this.logger.warn('Porteiro validation failed: invalid turno', { 
        userId: user.id, 
        turno: user.turno 
      });
      return false;
    }

    return true;
  }

  /**
   * Obter configurações específicas do porteiro
   */
  getTypeSpecificConfig() {
    return {
      tableName: 'porteiros',
      requiredFields: ['id', 'nome', 'email', 'turno', 'ativo', 'condominio_id'],
      permissions: ['portaria:read', 'portaria:write', 'visitantes:manage', 'entregas:manage'],
      redirectPath: '/porteiro'
    };
  }

  /**
   * Transformar dados para AuthUser
   */
  protected transformToAuthUser(supabaseUser: any, profileData: any): AuthUser {
    return {
      id: profileData.id,
      supabaseId: supabaseUser.id,
      email: profileData.email,
      nome: profileData.nome,
      telefone: profileData.telefone,
      tipo: 'porteiro',
      ativo: profileData.ativo,
      metadata: {
        turno: profileData.turno,
        condominioId: profileData.condominio_id,
        condominio: profileData.condominios ? {
          id: profileData.condominios.id,
          nome: profileData.condominios.nome,
          endereco: profileData.condominios.endereco
        } : null,
        lastLogin: profileData.last_login,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      }
    };
  }

  /**
   * Atualizar último login do porteiro
   */
  private async updateLastLogin(porteiroId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('porteiros')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', porteiroId);

      if (error) {
        this.logger.warn('Failed to update porteiro last login', { error, porteiroId });
      }
    } catch (error) {
      this.logger.warn('Error updating porteiro last login', { error, porteiroId });
    }
  }

  /**
   * Verificar se o porteiro está no turno atual
   */
  public isInCurrentShift(user: AuthUser): boolean {
    if (!user.metadata?.turno) {
      return true; // Se não tem turno definido, assume que pode trabalhar
    }

    const turno = user.metadata.turno as string;
    
    // Se é 24h, sempre pode trabalhar
    if (turno === '24h') {
      return true;
    }

    const now = new Date();
    const hour = now.getHours();

    // Definir horários dos turnos
    const turnos: Record<string, { start: number; end: number }> = {
      'manha': { start: 6, end: 14 },
      'tarde': { start: 14, end: 22 },
      'noite': { start: 22, end: 6 }, // Atravessa meia-noite
      'madrugada': { start: 0, end: 6 }
    };

    const turnoConfig = turnos[turno];
    if (!turnoConfig) {
      return true; // Se turno não reconhecido, permite
    }

    // Verificar se está no horário do turno
    if (turnoConfig.start <= turnoConfig.end) {
      // Turno normal (não atravessa meia-noite)
      return hour >= turnoConfig.start && hour < turnoConfig.end;
    } else {
      // Turno noturno (atravessa meia-noite)
      return hour >= turnoConfig.start || hour < turnoConfig.end;
    }
  }

  /**
   * Obter informações do condomínio do porteiro
   */
  public getCondominioInfo(user: AuthUser): {
    id: string;
    nome: string;
    endereco?: string;
  } | null {
    if (!user.metadata?.condominio) {
      return null;
    }

    return user.metadata.condominio as {
      id: string;
      nome: string;
      endereco?: string;
    };
  }

  /**
   * Verificar se o porteiro pode acessar uma funcionalidade
   */
  public canAccessFeature(user: AuthUser, feature: string): boolean {
    // Funcionalidades básicas que todo porteiro pode acessar
    const basicFeatures = [
      'visitantes:view',
      'visitantes:register',
      'entregas:view',
      'entregas:register',
      'moradores:view',
      'portaria:dashboard'
    ];

    if (basicFeatures.includes(feature)) {
      return true;
    }

    // Funcionalidades avançadas baseadas no turno ou condomínio
    const advancedFeatures: Record<string, (user: AuthUser) => boolean> = {
      'visitantes:delete': (user) => user.metadata?.turno === '24h',
      'entregas:delete': (user) => user.metadata?.turno === '24h',
      'reports:generate': (user) => ['24h', 'manha'].includes(user.metadata?.turno as string)
    };

    const featureCheck = advancedFeatures[feature];
    if (featureCheck) {
      return featureCheck(user);
    }

    return false;
  }

  /**
   * Obter turno atual do porteiro
   */
  public getCurrentShift(user: AuthUser): string | null {
    return (user.metadata?.turno as string) || null;
  }

  /**
   * Implementação do IAuthStrategy: signIn
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const context: AuthContext = {
      platform: 'mobile',
      retryCount: 0,
      sessionId: `porteiro-${Date.now()}`
    };
    
    return this.authenticate({ email, password }, context);
  }

  /**
   * Implementação do IAuthStrategy: signOut
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  /**
   * Implementação do IAuthStrategy: getCurrentUser
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      const context: AuthContext = {
        platform: 'mobile',
        retryCount: 0,
        sessionId: `porteiro-${Date.now()}`
      };

      const result = await this.loadUserProfile(user.id, context);
      return result.success ? result.user || null : null;
    } catch (error) {
      this.logger.error('Failed to get current user', { error });
      return null;
    }
  }

  /**
   * Implementação do IAuthStrategy: refreshSession
   */
  async refreshSession(): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.user) {
        return {
          success: false,
          error: 'Falha ao renovar sessão'
        };
      }

      const context: AuthContext = {
        platform: 'mobile',
        retryCount: 0,
        sessionId: `porteiro-${Date.now()}`
      };

      return this.loadUserProfile(data.user.id, context);
    } catch (error) {
      this.logger.error('Failed to refresh session', { error });
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }
}