import { Platform } from 'react-native';
import { SupabaseClientFactory } from '@porteiroapp/supabase';
import { registerPushTokenAfterLogin } from './pushNotifications';
import type {Database} from '@porteiroapp/supabase';

type AdminProfile = Database['public']['Tables']['admin_profiles']['Row'];

// Importação condicional do AsyncStorage
let AsyncStorage: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

// Criar cliente unificado usando a factory com variáveis validadas
export const { client: supabase, unified } = SupabaseClientFactory.createReactNativeClient(
  Platform.OS,
  {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    storage: Platform.OS !== 'web' ? AsyncStorage : undefined,
    logLevel: __DEV__ ? 'info' : 'error',
  }
);

export interface Building {
  id: string;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface BuildingAdmin {
  id: string;
  building_id: string;
  admin_profile_id: string;
  created_at: string;
}

// Funções auxiliares para autenticação de administrador
export const adminAuth = {
  // Fazer login do administrador
  async signIn(email: string, password: string) {
    console.log('🔐 Iniciando login do administrador:', { email, platform: Platform.OS });

    try {
      // Usar o cliente unificado com retry e timeout automáticos
      const authResult = await unified.signInWithPassword(email, password);

      const { data, error } = authResult;

      if (error) {
        console.error('❌ Erro na autenticação:', {
          message: error.message,
          platform: Platform.OS,
          code: error.status,
        });
        throw error;
      }

      console.log('✅ Autenticação bem-sucedida:', { userId: data.user?.id, platform: Platform.OS });

      // Verificar se o usuário é um administrador
      if (data.user) {
        console.log('👤 Verificando perfil de administrador...', { platform: Platform.OS });

        const adminProfile = await this.getAdminProfile(data.user.id);

        if (!adminProfile) {
          console.warn('⚠️ Usuário não é administrador, fazendo logout...', { platform: Platform.OS });
          await supabase.auth.signOut();
          throw new Error('Usuário não é um administrador');
        }

        console.log('✅ Perfil de administrador encontrado:', {
          adminId: adminProfile.id,
          role: adminProfile.role,
          platform: Platform.OS,
        });

        // Register push token immediately after successful admin login
        registerPushTokenAfterLogin(data.user.id, 'admin').catch((error) => {
          console.error('🔔 Failed to register push token after admin login:', error);
        });

        return { user: data.user, adminProfile };
      }

      console.warn('⚠️ Nenhum usuário retornado na autenticação', { platform: Platform.OS });
      return { user: null, adminProfile: null };
    } catch (error) {
      if(error instanceof Error) {
        console.error('💥 Erro no login do administrador:', {
          error,
          platform: Platform.OS,
          message: error.message,
        });
      }
      throw error;
    }
  },

  // Fazer logout
  async signOut() {
    const { error } = await unified.signOut();
    if (error) throw error;
  },

  // Obter perfil do administrador
  async getAdminProfile(userId: string): Promise<AdminProfile | null> {
    try {
      // Usar o cliente unificado com timeout automático
      const { data: adminProfile, error } = await unified.withTimeout(
        supabase.from('admin_profiles').select('*').eq('user_id', userId).limit(1).maybeSingle(),
        'profile'
      );

      if (error) {
        console.error('❌ Erro ao buscar perfil do administrador:', {
          message: error.message,
          platform: Platform.OS,
          code: error.code,
        });
        return null;
      }

      return adminProfile;
    } catch (error) {
      console.error('💥 Erro ao buscar perfil do administrador:', {
        error,
        platform: Platform.OS,
      });
      return null;
    }
  },

  // Obter edifícios gerenciados pelo administrador
  async getAdminBuildings(adminProfileId: string): Promise<Building[]> {
    try {
      const { data, error } = await supabase
        .from('building_admins')
        .select(
          `
          buildings (
            id,
            name,
            address,
            created_at,
            updated_at
          )
        `
        )
        .eq('admin_profile_id', adminProfileId);

      if (error) {
        console.error('Erro ao buscar edifícios do administrador:', error);
        return [];
      }

      return data?.map((item) => item.buildings).filter(Boolean) || [];
    } catch (error) {
      console.error('Erro ao buscar edifícios do administrador:', error);
      return [];
    }
  },

  // Verificar se o usuário atual é administrador
  async getCurrentAdmin(): Promise<AdminProfile | null> {
    try {
      const userResult = await unified.getUser();

      const {
        data: { user },
      } = userResult;

      if (!user) {
        console.log('👤 Nenhum usuário logado', { platform: Platform.OS });
        return null;
      }

      const adminProfile = await this.getAdminProfile(user.id);

      if (adminProfile) {
        console.log('✅ Perfil de administrador encontrado', { platform: Platform.OS });
      } else {
        console.log('❌ Perfil de administrador não encontrado', { platform: Platform.OS });
      }

      return adminProfile;
    } catch (error) {
      console.error('💥 Erro ao verificar administrador atual:', {
        error,
        platform: Platform.OS,
      });
      return null;
    }
  },

  // Criar novo perfil de administrador
  async createAdminProfile(userData: {
    user_id: string;
    full_name: string;
    email: string;
    role?: string;
  }): Promise<AdminProfile | null> {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .insert({
          user_id: userData.user_id,
          full_name: userData.full_name,
          email: userData.email,
          role: userData.role || 'admin',
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar perfil do administrador:', error);
        throw error;
      }

      console.log('Perfil de administrador criado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('Erro ao criar perfil do administrador:', error);
      return null;
    }
  },

  // Listar todos os administradores
  async getAllAdmins(): Promise<AdminProfile[]> {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar administradores:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar administradores:', error);
      return [];
    }
  },

  // Atualizar perfil de administrador
  async updateAdminProfile(
    adminId: string,
    updateData: {
      full_name?: string;
      email?: string;
      role?: string;
    }
  ): Promise<AdminProfile | null> {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .update(updateData)
        .eq('id', adminId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar perfil do administrador:', error);
        throw error;
      }

      console.log('Perfil de administrador atualizado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('Erro ao atualizar perfil do administrador:', error);
      return null;
    }
  },

  // Verificar se administrador tem prédios vinculados
  async hasAssignedBuildings(adminProfileId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('building_admins')
        .select('id')
        .eq('admin_profile_id', adminProfileId)
        .limit(1);

      if (error) {
        console.error('Erro ao verificar vinculações do administrador:', error);
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Erro ao verificar vinculações do administrador:', error);
      return false;
    }
  },

  // Vincular administrador a um prédio
  async assignAdminToBuilding(adminProfileId: string, buildingId: string): Promise<boolean> {
    try {
      // Verificar se a vinculação já existe
      const { data: existing } = await supabase
        .from('building_admins')
        .select('id')
        .eq('admin_profile_id', adminProfileId)
        .eq('building_id', buildingId)
        .single();

      if (existing) {
        console.log('Administrador já está vinculado a este prédio');
        return true;
      }

      const { error } = await supabase.from('building_admins').insert({
        admin_profile_id: adminProfileId,
        building_id: buildingId,
      });

      if (error) {
        console.error('Erro ao vincular administrador ao prédio:', error);
        throw error;
      }

      console.log('Administrador vinculado ao prédio com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao vincular administrador ao prédio:', error);
      return false;
    }
  },

  // Desvincular administrador de um prédio
  async unassignAdminFromBuilding(adminProfileId: string, buildingId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('building_admins')
        .delete()
        .eq('admin_profile_id', adminProfileId)
        .eq('building_id', buildingId);

      if (error) {
        console.error('Erro ao desvincular administrador do prédio:', error);
        throw error;
      }

      console.log('Administrador desvinculado do prédio com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao desvincular administrador do prédio:', error);
      return false;
    }
  },
};
