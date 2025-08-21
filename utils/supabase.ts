import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { Platform } from 'react-native';

// Importação condicional do AsyncStorage
let AsyncStorage: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

// Configurações do projeto Supabase 'porteiroapp-dev'
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

// Configuração condicional baseada na plataforma
const authConfig = Platform.OS === 'web' 
  ? {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    }
  : {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    };

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: authConfig,
});

// Tipos para autenticação de administrador (baseados na estrutura real do banco)
export interface AdminProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Verificar se o usuário é um administrador
      if (data.user) {
        const adminProfile = await this.getAdminProfile(data.user.id);
        if (!adminProfile) {
          await supabase.auth.signOut();
          throw new Error('Usuário não é um administrador');
        }
        return { user: data.user, adminProfile };
      }
      
      return { user: null, adminProfile: null };
    } catch (error) {
      console.error('Erro no login do administrador:', error);
      throw error;
    }
  },

  // Fazer logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Obter perfil do administrador
  async getAdminProfile(userId: string): Promise<AdminProfile | null> {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Erro ao buscar perfil do administrador:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao buscar perfil do administrador:', error);
      return null;
    }
  },

  // Obter edifícios gerenciados pelo administrador
  async getAdminBuildings(adminProfileId: string): Promise<Building[]> {
    try {
      const { data, error } = await supabase
        .from('building_admins')
        .select(`
          buildings (
            id,
            name,
            address,
            city,
            state,
            zip_code,
            created_at,
            updated_at
          )
        `)
        .eq('admin_profile_id', adminProfileId);
      
      if (error) {
        console.error('Erro ao buscar edifícios do administrador:', error);
        return []; // Retorna array vazio ao invés de lançar erro
      }
      
      return data?.map(item => item.buildings).filter(Boolean) || [];
    } catch (error) {
      console.error('Erro ao buscar edifícios do administrador:', error);
      return []; // Sempre retorna array vazio em caso de erro
    }
  },

  // Verificar se o usuário atual é administrador
  async getCurrentAdmin(): Promise<AdminProfile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;
      
      return await this.getAdminProfile(user.id);
    } catch (error) {
      console.error('Erro ao verificar administrador atual:', error);
      return null;
    }
  },

  // Criar novo perfil de administrador
  async createAdminProfile(userData: {
    user_id: string;
    name: string;
    email: string;
    role?: string;
  }): Promise<AdminProfile | null> {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .insert({
          user_id: userData.user_id,
          name: userData.name,
          email: userData.email,
          role: userData.role || 'admin'
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
  async updateAdminProfile(adminId: string, updateData: {
    name?: string;
    email?: string;
    role?: string;
  }): Promise<AdminProfile | null> {
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
      
      const { error } = await supabase
        .from('building_admins')
        .insert({
          admin_profile_id: adminProfileId,
          building_id: buildingId
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
  }
};
