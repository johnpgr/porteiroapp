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

// Função auxiliar para timeout
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: Operação demorou mais que ' + timeoutMs + 'ms')), timeoutMs)
    )
  ]);
};

// Função auxiliar para retry
const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number = 2): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.log(`Tentativa ${attempt + 1} falhou:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Backoff exponencial
        console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

// Funções auxiliares para autenticação de administrador
export const adminAuth = {
  // Fazer login do administrador
  async signIn(email: string, password: string) {
    console.log('🔐 Iniciando login do administrador:', { email });
    
    try {
      // Aplicar timeout e retry na autenticação
      const authResult = await withRetry(async () => {
        console.log('📡 Tentando autenticação no Supabase...');
        return await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          10000
        );
      });
      
      const { data, error } = authResult;
      
      if (error) {
        console.error('❌ Erro na autenticação:', error.message);
        throw error;
      }
      
      console.log('✅ Autenticação bem-sucedida:', { userId: data.user?.id });
      
      // Verificar se o usuário é um administrador
      if (data.user) {
        console.log('👤 Verificando perfil de administrador...');
        
        const adminProfile = await withTimeout(
          this.getAdminProfile(data.user.id),
          8000
        );
        
        if (!adminProfile) {
          console.warn('⚠️ Usuário não é administrador, fazendo logout...');
          await supabase.auth.signOut();
          throw new Error('Usuário não é um administrador');
        }
        
        console.log('✅ Perfil de administrador encontrado:', { adminId: adminProfile.id, role: adminProfile.role });
        return { user: data.user, adminProfile };
      }
      
      console.warn('⚠️ Nenhum usuário retornado na autenticação');
      return { user: null, adminProfile: null };
    } catch (error) {
      console.error('💥 Erro no login do administrador:', error);
      // Garantir que sempre lance o erro para que o loading seja resetado
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
      console.log('📋 Buscando perfil do administrador:', { userId });
      
      const { data, error } = await withTimeout(
        supabase
          .from('admin_profiles')
          .select('*')
          .eq('user_id', userId)
          .limit(1),
        8000
      );
      
      if (error) {
        console.error('❌ Erro ao buscar perfil do administrador:', error.message);
        return null;
      }
      
      // Verifica se há dados retornados
      if (!data || data.length === 0) {
        console.log('⚠️ Nenhum perfil de administrador encontrado para o usuário:', { userId });
        return null;
      }
      
      const adminProfile = data[0];
      console.log('✅ Perfil encontrado:', { adminId: adminProfile?.id, role: adminProfile?.role });
      return adminProfile;
    } catch (error) {
      console.error('💥 Erro ao buscar perfil do administrador:', error);
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
      console.log('🔍 Verificando administrador atual...');
      
      const userResult = await withTimeout(
        supabase.auth.getUser(),
        5000
      );
      
      const { data: { user } } = userResult;
      
      if (!user) {
        console.log('👤 Nenhum usuário logado');
        return null;
      }
      
      console.log('👤 Usuário encontrado, buscando perfil admin:', { userId: user.id });
      
      const adminProfile = await withTimeout(
        this.getAdminProfile(user.id),
        5000
      );
      
      if (adminProfile) {
        console.log('✅ Perfil de administrador encontrado:', { adminId: adminProfile.id });
      } else {
        console.log('❌ Perfil de administrador não encontrado');
      }
      
      return adminProfile;
    } catch (error) {
      console.error('💥 Erro ao verificar administrador atual:', error);
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
