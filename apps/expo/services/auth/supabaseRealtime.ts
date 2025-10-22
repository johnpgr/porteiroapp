import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../../utils/supabaseUnified';
import { AuthLogger } from '../../../services/auth/AuthLogger';
import { AuthStateManager } from '../../../services/auth/AuthStateManager';
import { AuthUser } from '../../../services/auth/AuthManager';

interface RealtimeConfig {
  enabled: boolean;
  channels: string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

interface UserUpdatePayload {
  id: string;
  active: boolean;
  permissions?: string[];
  last_login?: string;
  profile_data?: any;
}

export class SupabaseRealtimeManager {
  private static instance: SupabaseRealtimeManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private config: RealtimeConfig;
  private logger: AuthLogger;
  private stateManager: AuthStateManager;
  private reconnectAttempts = 0;
  private isConnected = false;
  private currentUserId: string | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      channels: ['admins', 'porteiros', 'moradores'],
      reconnectInterval: 5000,
      maxReconnectAttempts: 5
    };
    this.logger = AuthLogger.getInstance();
    this.stateManager = AuthStateManager.getInstance();
  }

  static getInstance(): SupabaseRealtimeManager {
    if (!SupabaseRealtimeManager.instance) {
      SupabaseRealtimeManager.instance = new SupabaseRealtimeManager();
    }
    return SupabaseRealtimeManager.instance;
  }

  /**
   * Inicializa as conexões realtime para o usuário atual
   */
  async initialize(user: AuthUser): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Realtime desabilitado', { userId: user.id });
      return;
    }

    try {
      this.currentUserId = user.id;
      await this.setupUserChannel(user);
      await this.setupGeneralChannels();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      this.logger.info('Realtime inicializado com sucesso', {
        userId: user.id,
        userType: user.type,
        channels: Array.from(this.channels.keys())
      });
    } catch (error) {
      this.logger.error('Erro ao inicializar Realtime', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * Configura canal específico do usuário
   */
  private async setupUserChannel(user: AuthUser): Promise<void> {
    const tableName = this.getTableNameByUserType(user.type);
    const channelName = `user_${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: `id=eq.${user.id}`
        },
        (payload) => this.handleUserUpdate(payload, user)
      )
      .on('presence', { event: 'sync' }, () => {
        this.logger.debug('Presença sincronizada', { channelName });
      })
      .subscribe((status) => {
        this.logger.info('Status do canal do usuário', {
          channelName,
          status,
          userId: user.id
        });
      });

    this.channels.set(channelName, channel);
  }

  /**
   * Configura canais gerais para notificações do sistema
   */
  private async setupGeneralChannels(): Promise<void> {
    // Canal para notificações gerais do sistema
    const systemChannel = supabase
      .channel('system_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_notifications'
        },
        (payload) => this.handleSystemNotification(payload)
      )
      .subscribe((status) => {
        this.logger.info('Canal do sistema', { status });
      });

    this.channels.set('system_notifications', systemChannel);

    // Canal para atualizações de sessão
    const sessionChannel = supabase
      .channel('auth_sessions')
      .on('broadcast', { event: 'session_update' }, (payload) => {
        this.handleSessionBroadcast(payload);
      })
      .subscribe((status) => {
        this.logger.info('Canal de sessões', { status });
      });

    this.channels.set('auth_sessions', sessionChannel);
  }

  /**
   * Manipula atualizações do usuário atual
   */
  private async handleUserUpdate(
    payload: RealtimePostgresChangesPayload<UserUpdatePayload>,
    currentUser: AuthUser
  ): Promise<void> {
    try {
      const { new: newData, old: oldData } = payload;
      
      this.logger.info('Atualização do usuário recebida', {
        userId: currentUser.id,
        changes: this.getChangedFields(oldData, newData)
      });

      // Verifica se o usuário foi desativado
      if (newData && !newData.active && oldData?.active) {
        this.logger.warn('Usuário desativado remotamente', {
          userId: currentUser.id
        });
        
        await this.handleUserDeactivation();
        return;
      }

      // Verifica mudanças nas permissões
      if (newData && this.hasPermissionChanges(oldData, newData)) {
        this.logger.info('Permissões do usuário alteradas', {
          userId: currentUser.id,
          oldPermissions: oldData?.permissions,
          newPermissions: newData.permissions
        });
        
        await this.handlePermissionUpdate(newData);
      }

      // Atualiza dados do perfil
      if (newData && newData.profile_data) {
        await this.handleProfileUpdate(newData);
      }

    } catch (error) {
      this.logger.error('Erro ao processar atualização do usuário', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        userId: currentUser.id
      });
    }
  }

  /**
   * Manipula notificações do sistema
   */
  private handleSystemNotification(payload: RealtimePostgresChangesPayload<any>): void {
    try {
      this.logger.info('Notificação do sistema recebida', {
        event: payload.eventType,
        table: payload.table
      });

      // Aqui você pode implementar lógica específica para diferentes tipos de notificações
      // Por exemplo: manutenção programada, atualizações de sistema, etc.
      
    } catch (error) {
      this.logger.error('Erro ao processar notificação do sistema', {
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Manipula broadcasts de sessão
   */
  private handleSessionBroadcast(payload: any): void {
    try {
      const { event, userId, action } = payload.payload;
      
      this.logger.info('Broadcast de sessão recebido', {
        event,
        userId,
        action
      });

      // Se for uma ação de logout forçado para o usuário atual
      if (action === 'force_logout' && userId === this.currentUserId) {
        this.handleForceLogout();
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar broadcast de sessão', {
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Manipula desativação do usuário
   */
  private async handleUserDeactivation(): Promise<void> {
    this.stateManager.setError('Sua conta foi desativada. Entre em contato com o administrador.');
    
    // Força logout após um breve delay para mostrar a mensagem
    setTimeout(async () => {
      await this.disconnect();
      // Aqui você pode disparar um evento para forçar o logout
      window.dispatchEvent(new CustomEvent('auth:force-logout', {
        detail: { reason: 'account_deactivated' }
      }));
    }, 3000);
  }

  /**
   * Manipula atualização de permissões
   */
  private async handlePermissionUpdate(userData: UserUpdatePayload): Promise<void> {
    // Atualiza o estado com as novas permissões
    const currentState = this.stateManager.getState();
    if (currentState.user) {
      const updatedUser = {
        ...currentState.user,
        permissions: userData.permissions || []
      };
      
      this.stateManager.setUser(updatedUser);
      
      // Dispara evento para componentes reagirem às mudanças de permissão
      window.dispatchEvent(new CustomEvent('auth:permissions-updated', {
        detail: { permissions: userData.permissions }
      }));
    }
  }

  /**
   * Manipula atualização do perfil
   */
  private async handleProfileUpdate(userData: UserUpdatePayload): Promise<void> {
    const currentState = this.stateManager.getState();
    if (currentState.user && userData.profile_data) {
      const updatedUser = {
        ...currentState.user,
        ...userData.profile_data
      };
      
      this.stateManager.setUser(updatedUser);
      
      // Dispara evento para componentes reagirem às mudanças de perfil
      window.dispatchEvent(new CustomEvent('auth:profile-updated', {
        detail: { profileData: userData.profile_data }
      }));
    }
  }

  /**
   * Manipula logout forçado
   */
  private handleForceLogout(): void {
    this.logger.warn('Logout forçado recebido via broadcast');
    
    // Dispara evento para forçar o logout
    window.dispatchEvent(new CustomEvent('auth:force-logout', {
      detail: { reason: 'remote_logout' }
    }));
  }

  /**
   * Envia broadcast para outros dispositivos do usuário
   */
  async broadcastToUserDevices(event: string, data: any): Promise<void> {
    if (!this.isConnected || !this.currentUserId) {
      this.logger.warn('Tentativa de broadcast sem conexão ativa');
      return;
    }

    try {
      const channel = this.channels.get('auth_sessions');
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'session_update',
          payload: {
            event,
            userId: this.currentUserId,
            data,
            timestamp: new Date().toISOString()
          }
        });
        
        this.logger.info('Broadcast enviado', {
          event,
          userId: this.currentUserId
        });
      }
    } catch (error) {
      this.logger.error('Erro ao enviar broadcast', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        event
      });
    }
  }

  /**
   * Desconecta todos os canais
   */
  async disconnect(): Promise<void> {
    try {
      for (const [name, channel] of this.channels) {
        await supabase.removeChannel(channel);
        this.logger.debug('Canal desconectado', { channelName: name });
      }
      
      this.channels.clear();
      this.isConnected = false;
      this.currentUserId = null;
      
      this.logger.info('Realtime desconectado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao desconectar Realtime', {
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Reconecta após falha
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    
    this.logger.info('Tentando reconectar Realtime', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts
    });

    setTimeout(async () => {
      try {
        const currentState = this.stateManager.getState();
        if (currentState.user) {
          await this.initialize(currentState.user);
        }
      } catch (error) {
        this.logger.error('Falha na reconexão', {
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          attempt: this.reconnectAttempts
        });
        
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          await this.attemptReconnect();
        }
      }
    }, this.config.reconnectInterval * this.reconnectAttempts);
  }

  // Métodos utilitários
  private getTableNameByUserType(userType: string): string {
    switch (userType) {
      case 'admin': return 'admins';
      case 'porteiro': return 'porteiros';
      case 'morador': return 'moradores';
      default: return 'users';
    }
  }

  private getChangedFields(oldData: any, newData: any): string[] {
    if (!oldData || !newData) return [];
    
    const changes: string[] = [];
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes.push(key);
      }
    }
    return changes;
  }

  private hasPermissionChanges(oldData: any, newData: any): boolean {
    if (!oldData?.permissions && !newData?.permissions) return false;
    if (!oldData?.permissions || !newData?.permissions) return true;
    
    return JSON.stringify(oldData.permissions.sort()) !== 
           JSON.stringify(newData.permissions.sort());
  }

  // Getters
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  getConfig(): RealtimeConfig {
    return { ...this.config };
  }

  // Configuração
  updateConfig(newConfig: Partial<RealtimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuração do Realtime atualizada', { config: this.config });
  }
}

export default SupabaseRealtimeManager;