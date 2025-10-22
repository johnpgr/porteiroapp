import { supabase } from '../../../utils/supabase';
import { AuthStrategy, AuthCredentials, AuthResult, AuthContext, IAuthStrategy } from './AuthStrategy';
import { AuthUser } from '../AuthManager';
import { AuthLogger } from '../AuthLogger';
import { router } from 'expo-router';

export class AdminAuthStrategy extends AuthStrategy implements IAuthStrategy {
  private logger: AuthLogger;

  constructor() {
    super('admin');
    this.logger = AuthLogger.getInstance();
  }

  /**
   * Autenticar administrador
   */
  async authenticate(credentials: AuthCredentials, context: AuthContext): Promise<AuthResult> {
    this.logger.info('Admin authentication started', {
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
        this.logger.error('Admin auth failed', { error: authError });
        
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

      // Carregar perfil do admin
      const profileResult = await this.loadUserProfile(authData.user.id, context);
      
      if (!profileResult.success) {
        // Se falhou ao carregar perfil, fazer logout
        await supabase.auth.signOut();
        return profileResult;
      }

      this.logger.info('Admin authentication successful', {
        userId: authData.user.id,
        email: credentials.email
      });

      return {
        success: true,
        user: profileResult.user
      };

    } catch (error) {
      this.logger.error('Admin authentication error', { error });
      
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
   * Carregar perfil completo do administrador
   */
  async loadUserProfile(userId: string, context: AuthContext): Promise<AuthResult> {
    this.logger.debug('Loading admin profile', { userId });

    try {
      // Buscar dados do admin na tabela admins
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select(`
          id,
          nome,
          email,
          telefone,
          cargo,
          ativo,
          created_at,
          updated_at,
          last_login,
          permissions
        `)
        .eq('user_id', userId)
        .eq('ativo', true)
        .single();

      if (adminError) {
        this.logger.error('Failed to load admin profile', { error: adminError, userId });
        
        if (adminError.code === 'PGRST116') {
          return {
            success: false,
            error: 'Usuário não encontrado ou não é um administrador'
          };
        }
        
        const retryInfo = this.shouldRetry(adminError, context.retryCount);
        return {
          success: false,
          error: this.formatError(adminError),
          requiresRetry: retryInfo.shouldRetry,
          retryAfter: retryInfo.retryAfter
        };
      }

      if (!adminData) {
        router.push('/');
        return {
          success: false,
          error: 'Perfil de administrador não encontrado'
        };
      }

      // Validar se é um admin válido
      if (!this.validateUserType(adminData)) {
        return {
          success: false,
          error: 'Usuário não possui permissões de administrador'
        };
      }

      // Atualizar último login
      await this.updateLastLogin(adminData.id);

      // Transformar para AuthUser
      const authUser = this.transformToAuthUser({ id: userId }, adminData);

      this.logger.info('Admin profile loaded successfully', {
        userId,
        adminId: adminData.id,
        nome: adminData.nome
      });

      return {
        success: true,
        user: authUser
      };

    } catch (error) {
      this.logger.error('Error loading admin profile', { error, userId });
      
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
   * Validar se o usuário é um administrador válido
   */
  validateUserType(user: any): boolean {
    if (!user) return false;
    
    // Verificar se tem os campos obrigatórios
    const requiredFields = ['id', 'nome', 'email', 'ativo'];
    for (const field of requiredFields) {
      if (!user[field]) {
        this.logger.warn('Admin validation failed: missing field', { field, userId: user.id });
        return false;
      }
    }

    // Verificar se está ativo
    if (!user.ativo) {
      this.logger.warn('Admin validation failed: inactive user', { userId: user.id });
      return false;
    }

    // Verificar permissões (se existir)
    if (user.permissions && Array.isArray(user.permissions)) {
      const hasAdminPermission = user.permissions.some((perm: string) => 
        perm.includes('admin') || perm.includes('manage')
      );
      
      if (!hasAdminPermission) {
        this.logger.warn('Admin validation failed: no admin permissions', { 
          userId: user.id, 
          permissions: user.permissions 
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Obter configurações específicas do administrador
   */
  getTypeSpecificConfig() {
    return {
      tableName: 'admins',
      requiredFields: ['id', 'nome', 'email', 'cargo', 'ativo'],
      permissions: ['admin:read', 'admin:write', 'admin:delete', 'users:manage', 'system:manage'],
      redirectPath: '/admin'
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
      tipo: 'admin',
      ativo: profileData.ativo,
      metadata: {
        cargo: profileData.cargo,
        permissions: profileData.permissions || [],
        lastLogin: profileData.last_login,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      }
    };
  }

  /**
   * Atualizar último login do administrador
   */
  private async updateLastLogin(adminId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('admins')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId);

      if (error) {
        this.logger.warn('Failed to update admin last login', { error, adminId });
      }
    } catch (error) {
      this.logger.warn('Error updating admin last login', { error, adminId });
    }
  }

  /**
   * Verificar permissões específicas do admin
   */
  public hasPermission(user: AuthUser, permission: string): boolean {
    if (!user.metadata?.permissions) {
      return false;
    }

    const permissions = user.metadata.permissions as string[];
    
    // Verificar permissão exata
    if (permissions.includes(permission)) {
      return true;
    }

    // Verificar permissões wildcard
    const [resource, action] = permission.split(':');
    if (permissions.includes(`${resource}:*`) || permissions.includes('*:*')) {
      return true;
    }

    return false;
  }

  /**
   * Obter todas as permissões do admin
   */
  public getPermissions(user: AuthUser): string[] {
    return (user.metadata?.permissions as string[]) || [];
  }

  /**
   * Verificar se o admin pode acessar uma rota
   */
  public canAccessRoute(user: AuthUser, route: string): boolean {
    // Admins podem acessar todas as rotas admin por padrão
    if (route.startsWith('/admin')) {
      return true;
    }

    // Verificar permissões específicas para outras rotas
    const routePermissions: Record<string, string> = {
      '/users': 'users:read',
      '/settings': 'system:manage',
      '/reports': 'reports:read'
    };

    const requiredPermission = routePermissions[route];
    if (requiredPermission) {
      return this.hasPermission(user, requiredPermission);
    }

    return false;
  }

  /**
   * Implementação do IAuthStrategy: signIn
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const context: AuthContext = {
      platform: 'mobile',
      retryCount: 0,
      sessionId: `admin-${Date.now()}`
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
        sessionId: `admin-${Date.now()}`
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
        sessionId: `admin-${Date.now()}`
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