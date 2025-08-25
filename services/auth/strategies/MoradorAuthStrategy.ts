import { supabase } from '../../../utils/supabase';
import { AuthStrategy, AuthCredentials, AuthResult, AuthContext } from './AuthStrategy';
import { AuthUser } from '../AuthManager';
import { AuthLogger } from '../AuthLogger';

export class MoradorAuthStrategy extends AuthStrategy {
  private logger: AuthLogger;

  constructor() {
    super('morador');
    this.logger = new AuthLogger();
  }

  /**
   * Autenticar morador
   */
  async authenticate(credentials: AuthCredentials, context: AuthContext): Promise<AuthResult> {
    this.logger.info('Morador authentication started', {
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
        this.logger.error('Morador auth failed', { error: authError });
        
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

      // Carregar perfil do morador
      const profileResult = await this.loadUserProfile(authData.user.id, context);
      
      if (!profileResult.success) {
        // Se falhou ao carregar perfil, fazer logout
        await supabase.auth.signOut();
        return profileResult;
      }

      this.logger.info('Morador authentication successful', {
        userId: authData.user.id,
        email: credentials.email
      });

      return {
        success: true,
        user: profileResult.user
      };

    } catch (error) {
      this.logger.error('Morador authentication error', { error });
      
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
   * Carregar perfil completo do morador
   */
  async loadUserProfile(userId: string, context: AuthContext): Promise<AuthResult> {
    this.logger.debug('Loading morador profile', { userId });

    try {
      // Buscar dados do morador na tabela moradores
      const { data: moradorData, error: moradorError } = await supabase
        .from('moradores')
        .select(`
          id,
          nome,
          email,
          telefone,
          cpf,
          apartamento,
          bloco,
          ativo,
          created_at,
          updated_at,
          last_login,
          condominio_id,
          condominios (
            id,
            nome,
            endereco
          ),
          proprietario,
          data_nascimento,
          observacoes
        `)
        .eq('user_id', userId)
        .eq('ativo', true)
        .single();

      if (moradorError) {
        this.logger.error('Failed to load morador profile', { error: moradorError, userId });
        
        if (moradorError.code === 'PGRST116') {
          return {
            success: false,
            error: 'Usuário não encontrado ou não é um morador'
          };
        }
        
        const retryInfo = this.shouldRetry(moradorError, context.retryCount);
        return {
          success: false,
          error: this.formatError(moradorError),
          requiresRetry: retryInfo.shouldRetry,
          retryAfter: retryInfo.retryAfter
        };
      }

      if (!moradorData) {
        return {
          success: false,
          error: 'Perfil de morador não encontrado'
        };
      }

      // Validar se é um morador válido
      if (!this.validateUserType(moradorData)) {
        return {
          success: false,
          error: 'Usuário não possui permissões de morador'
        };
      }

      // Carregar dependentes do morador
      const dependentes = await this.loadDependentes(moradorData.id);

      // Atualizar último login
      await this.updateLastLogin(moradorData.id);

      // Transformar para AuthUser
      const authUser = this.transformToAuthUser({ id: userId }, { ...moradorData, dependentes });

      this.logger.info('Morador profile loaded successfully', {
        userId,
        moradorId: moradorData.id,
        nome: moradorData.nome,
        apartamento: moradorData.apartamento,
        condominio: moradorData.condominios?.nome
      });

      return {
        success: true,
        user: authUser
      };

    } catch (error) {
      this.logger.error('Error loading morador profile', { error, userId });
      
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
   * Carregar dependentes do morador
   */
  private async loadDependentes(moradorId: string): Promise<any[]> {
    try {
      const { data: dependentes, error } = await supabase
        .from('dependentes')
        .select(`
          id,
          nome,
          parentesco,
          telefone,
          data_nascimento,
          ativo
        `)
        .eq('morador_id', moradorId)
        .eq('ativo', true);

      if (error) {
        this.logger.warn('Failed to load dependentes', { error, moradorId });
        return [];
      }

      return dependentes || [];
    } catch (error) {
      this.logger.warn('Error loading dependentes', { error, moradorId });
      return [];
    }
  }

  /**
   * Validar se o usuário é um morador válido
   */
  validateUserType(user: any): boolean {
    if (!user) return false;
    
    // Verificar se tem os campos obrigatórios
    const requiredFields = ['id', 'nome', 'email', 'ativo', 'condominio_id', 'apartamento'];
    for (const field of requiredFields) {
      if (!user[field]) {
        this.logger.warn('Morador validation failed: missing field', { field, userId: user.id });
        return false;
      }
    }

    // Verificar se está ativo
    if (!user.ativo) {
      this.logger.warn('Morador validation failed: inactive user', { userId: user.id });
      return false;
    }

    // Verificar se tem condomínio associado
    if (!user.condominio_id) {
      this.logger.warn('Morador validation failed: no condominio', { userId: user.id });
      return false;
    }

    // Verificar se tem apartamento
    if (!user.apartamento || user.apartamento.trim() === '') {
      this.logger.warn('Morador validation failed: no apartamento', { userId: user.id });
      return false;
    }

    return true;
  }

  /**
   * Obter configurações específicas do morador
   */
  getTypeSpecificConfig() {
    return {
      tableName: 'moradores',
      requiredFields: ['id', 'nome', 'email', 'apartamento', 'ativo', 'condominio_id'],
      permissions: ['morador:read', 'morador:write', 'visitantes:invite', 'entregas:view'],
      redirectPath: '/morador'
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
      tipo: 'morador',
      ativo: profileData.ativo,
      metadata: {
        cpf: profileData.cpf,
        apartamento: profileData.apartamento,
        bloco: profileData.bloco,
        proprietario: profileData.proprietario,
        dataNascimento: profileData.data_nascimento,
        observacoes: profileData.observacoes,
        condominioId: profileData.condominio_id,
        condominio: profileData.condominios ? {
          id: profileData.condominios.id,
          nome: profileData.condominios.nome,
          endereco: profileData.condominios.endereco
        } : null,
        dependentes: profileData.dependentes || [],
        lastLogin: profileData.last_login,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      }
    };
  }

  /**
   * Atualizar último login do morador
   */
  private async updateLastLogin(moradorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('moradores')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', moradorId);

      if (error) {
        this.logger.warn('Failed to update morador last login', { error, moradorId });
      }
    } catch (error) {
      this.logger.warn('Error updating morador last login', { error, moradorId });
    }
  }

  /**
   * Obter informações do apartamento
   */
  public getApartamentoInfo(user: AuthUser): {
    apartamento: string;
    bloco?: string;
    proprietario: boolean;
  } | null {
    if (!user.metadata?.apartamento) {
      return null;
    }

    return {
      apartamento: user.metadata.apartamento as string,
      bloco: user.metadata.bloco as string,
      proprietario: user.metadata.proprietario as boolean
    };
  }

  /**
   * Obter informações do condomínio do morador
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
   * Obter dependentes do morador
   */
  public getDependentes(user: AuthUser): {
    id: string;
    nome: string;
    parentesco: string;
    telefone?: string;
    dataNascimento?: string;
  }[] {
    return (user.metadata?.dependentes as any[]) || [];
  }

  /**
   * Verificar se o morador é proprietário
   */
  public isProprietario(user: AuthUser): boolean {
    return user.metadata?.proprietario === true;
  }

  /**
   * Verificar se o morador pode convidar visitantes
   */
  public canInviteVisitors(user: AuthUser): boolean {
    // Moradores ativos sempre podem convidar visitantes
    return user.ativo;
  }

  /**
   * Verificar se o morador pode acessar uma funcionalidade
   */
  public canAccessFeature(user: AuthUser, feature: string): boolean {
    // Funcionalidades básicas que todo morador pode acessar
    const basicFeatures = [
      'morador:dashboard',
      'visitantes:view',
      'visitantes:invite',
      'entregas:view',
      'profile:view',
      'profile:edit'
    ];

    if (basicFeatures.includes(feature)) {
      return true;
    }

    // Funcionalidades avançadas baseadas no status de proprietário
    const proprietarioFeatures = [
      'condominio:view',
      'assembleia:vote',
      'financeiro:view'
    ];

    if (proprietarioFeatures.includes(feature)) {
      return this.isProprietario(user);
    }

    // Funcionalidades de dependentes
    const dependenteFeatures = [
      'dependentes:manage',
      'dependentes:add',
      'dependentes:remove'
    ];

    if (dependenteFeatures.includes(feature)) {
      return true; // Todo morador pode gerenciar dependentes
    }

    return false;
  }

  /**
   * Obter endereço completo do morador
   */
  public getEnderecoCompleto(user: AuthUser): string {
    const apartamento = user.metadata?.apartamento as string;
    const bloco = user.metadata?.bloco as string;
    const condominio = user.metadata?.condominio as any;

    let endereco = `Apartamento ${apartamento}`;
    
    if (bloco) {
      endereco += `, Bloco ${bloco}`;
    }
    
    if (condominio?.nome) {
      endereco += ` - ${condominio.nome}`;
    }

    return endereco;
  }

  /**
   * Verificar se o morador tem dependentes
   */
  public hasDependentes(user: AuthUser): boolean {
    const dependentes = this.getDependentes(user);
    return dependentes.length > 0;
  }
}