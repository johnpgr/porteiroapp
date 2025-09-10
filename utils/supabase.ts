import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';

// Importação condicional do AsyncStorage
let AsyncStorage: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

// Configurações do projeto Supabase 'JamesAvisa-dev'
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

// Configuração condicional baseada na plataforma com melhorias para iOS
const authConfig =
  Platform.OS === 'web'
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
        // Configurações específicas para iOS
        ...(Platform.OS === 'ios' && {
          flowType: 'pkce',
          debug: false, // Desabilitar logs de debug do GoTrueClient
        }),
      };

// Configurações específicas do cliente Supabase com melhorias para iOS
const supabaseConfig = {
  auth: authConfig,
  // Configurações de rede mais robustas para iOS
  ...(Platform.OS === 'ios' && {
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-ios',
      },
    },
  }),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, supabaseConfig);

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
  created_at: string;
  updated_at: string;
}

export interface BuildingAdmin {
  id: string;
  building_id: string;
  admin_profile_id: string;
  created_at: string;
}

// Função auxiliar para timeout com melhorias e logs detalhados para iOS
const withTimeout = <T>(promise: Promise<T>, timeoutMs?: number): Promise<T> => {
  // Timeouts maiores para iOS devido a problemas de conectividade
  const defaultTimeout = Platform.OS === 'ios' ? 20000 : 10000;
  const actualTimeout = timeoutMs || defaultTimeout;
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const timer = setTimeout(() => {
      const elapsedTime = Date.now() - startTime;
      
      if (Platform.OS === 'ios') {
        console.error('⏰ Timeout iOS detectado:', {
          timeoutMs: actualTimeout,
          elapsedTime,
          timestamp: new Date().toISOString(),
          networkStatus: 'checking...'
        });
        
        // Verificar status da rede quando ocorre timeout no iOS
        checkNetworkConnectivity().then(isConnected => {
          console.log('📶 Status da rede durante timeout iOS:', {
            isConnected,
            elapsedTime,
            timestamp: new Date().toISOString()
          });
        }).catch(netError => {
          console.warn('⚠️ Erro ao verificar rede durante timeout iOS:', netError);
        });
      }
      
      reject(new Error(`Timeout: Operação demorou mais que ${actualTimeout}ms (Platform: ${Platform.OS}, Elapsed: ${elapsedTime}ms)`));
    }, actualTimeout);

    promise
      .then((result) => {
        clearTimeout(timer);
        
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        
        if (Platform.OS === 'ios') {
          const elapsedTime = Date.now() - startTime;
          console.error('❌ Erro na operação iOS:', {
            error: error?.message,
            elapsedTime,
            timeoutMs: actualTimeout,
            timestamp: new Date().toISOString(),
            errorCode: error?.code || error?.status
          });
        }
        
        reject(error);
      });
  });
};

// Função para verificar conectividade de rede (específico para iOS)
const checkNetworkConnectivity = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return true;
  
  try {
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected === true && netInfo.isInternetReachable === true;
    
    console.log('📶 Status da rede iOS:', {
      isConnected: netInfo.isConnected,
      isInternetReachable: netInfo.isInternetReachable,
      type: netInfo.type,
      details: netInfo.details
    });
    
    return isConnected;
  } catch (error) {
    console.warn('⚠️ Erro ao verificar conectividade iOS:', error);
    return false;
  }
};

// Função para detectar e tratar erros específicos do iOS
const handleiOSNetworkError = (error: any): Error => {
  if (Platform.OS !== 'ios') return error;
  
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || error?.status;
  
  console.log('🔍 Analisando erro iOS:', {
    message: errorMessage,
    code: errorCode,
    name: error?.name,
    stack: error?.stack?.substring(0, 200)
  });
  
  // Erros de rede específicos do iOS
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('unreachable') ||
      errorCode === 'NETWORK_ERROR' ||
      errorCode === 'TIMEOUT') {
    
    return new Error('Problema de conexão detectado no iOS. Verifique sua conexão de internet e tente novamente.');
  }
  
  // Erros de SSL/TLS específicos do iOS
  if (errorMessage.includes('ssl') || 
      errorMessage.includes('tls') ||
      errorMessage.includes('certificate')) {
    
    return new Error('Problema de segurança de conexão no iOS. Tente novamente em alguns instantes.');
  }
  
  // Erros de DNS específicos do iOS
  if (errorMessage.includes('dns') || 
      errorMessage.includes('resolve') ||
      errorMessage.includes('host')) {
    
    return new Error('Problema de resolução de DNS no iOS. Verifique sua conexão e tente novamente.');
  }
  
  return error;
};

// Função auxiliar para retry com melhorias para iOS
const withRetry = async <T>(fn: () => Promise<T>, maxRetries?: number): Promise<T> => {
  // Configurações específicas por plataforma
  const retries = maxRetries ?? (Platform.OS === 'ios' ? 3 : 2);
  const baseDelay = Platform.OS === 'ios' ? 2000 : 1000; // Delay maior para iOS
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Verificar conectividade antes de tentar (específico para iOS)
      if (Platform.OS === 'ios' && attempt > 1) {
        const isConnected = await checkNetworkConnectivity();
        if (!isConnected) {
          console.warn('⚠️ Sem conectividade de rede no iOS, aguardando reconexão...');
          await new Promise(resolve => setTimeout(resolve, baseDelay * 2));
          continue;
        }
        console.log('✅ Conectividade iOS confirmada, tentando novamente...');
      }
      
      return await fn();
    } catch (error) {
      console.log(`Tentativa ${attempt} falhou:`, {
        error: error?.message,
        platform: Platform.OS,
        attempt,
        maxRetries: retries
      });
      
      // Usar a nova função de tratamento de erros iOS
      const processedError = handleiOSNetworkError(error);
      
      // Tratamento específico para erros de rede no iOS
      if (Platform.OS === 'ios') {
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('network') || 
            errorMessage.includes('timeout') || 
            errorMessage.includes('connection') ||
            errorMessage.includes('fetch') ||
            errorMessage.includes('unreachable')) {
          
          console.log('🔄 Erro de rede detectado no iOS, verificando conectividade...');
          
          // Re-verificar conectividade se for erro de rede
          const isConnected = await checkNetworkConnectivity();
          if (!isConnected) {
            console.warn('❌ Conectividade perdida no iOS durante retry');
            // Aguardar mais tempo para reconexão
            await new Promise(resolve => setTimeout(resolve, baseDelay * 3));
          } else {
            console.log('✅ Conectividade iOS mantida, erro pode ser temporário');
          }
        }
      }
      
      if (attempt === retries) {
        // Lançar o erro processado na última tentativa
        throw processedError;
      }
      
      // Delay exponencial com base específica por plataforma
      const delay = baseDelay * attempt;
      console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa... (${attempt}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Máximo de tentativas excedido');
};

// Funções auxiliares para autenticação de administrador
export const adminAuth = {
  // Fazer login do administrador com melhorias para iOS
  async signIn(email: string, password: string) {
    console.log('🔐 Iniciando login do administrador:', { email, platform: Platform.OS });

    try {
      // Aplicar timeout e retry na autenticação com configurações específicas para iOS
      const authResult = await withRetry(async () => {
        console.log('📡 Tentando autenticação no Supabase...', { platform: Platform.OS });
        // Timeout maior para iOS
        const timeoutMs = Platform.OS === 'ios' ? 15000 : 10000;
        return await withTimeout(supabase.auth.signInWithPassword({ email, password }), timeoutMs);
      });

      const { data, error } = authResult;

      if (error) {
        console.error('❌ Erro na autenticação:', { 
          message: error.message, 
          platform: Platform.OS,
          code: error.status 
        });
        
        // Usar a nova função de tratamento de erros iOS
        const processedError = handleiOSNetworkError(error);
        throw processedError;
      }

      console.log('✅ Autenticação bem-sucedida:', { userId: data.user?.id, platform: Platform.OS });

      // Verificar se o usuário é um administrador
      if (data.user) {
        console.log('👤 Verificando perfil de administrador...', { platform: Platform.OS });

        // Timeout maior para iOS na busca do perfil
        const profileTimeoutMs = Platform.OS === 'ios' ? 12000 : 8000;
        const adminProfile = await withTimeout(this.getAdminProfile(data.user.id), profileTimeoutMs);

        if (!adminProfile) {
          console.warn('⚠️ Usuário não é administrador, fazendo logout...', { platform: Platform.OS });
          await supabase.auth.signOut();
          throw new Error('Usuário não é um administrador');
        }

        console.log('✅ Perfil de administrador encontrado:', {
          adminId: adminProfile.id,
          role: adminProfile.role,
          platform: Platform.OS
        });
        return { user: data.user, adminProfile };
      }

      console.warn('⚠️ Nenhum usuário retornado na autenticação', { platform: Platform.OS });
      return { user: null, adminProfile: null };
    } catch (error) {
      console.error('💥 Erro no login do administrador:', { 
        error, 
        platform: Platform.OS,
        message: error.message 
      });
      // Garantir que sempre lance o erro para que o loading seja resetado
      throw error;
    }
  },

  // Fazer logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Obter perfil do administrador com melhorias para iOS
  async getAdminProfile(userId: string): Promise<AdminProfile | null> {
    try {
      // Buscando perfil do administrador

      // Timeout maior para iOS
      const timeoutMs = Platform.OS === 'ios' ? 12000 : 8000;
      const { data, error } = await withTimeout(
        supabase.from('admin_profiles').select('*').eq('user_id', userId).limit(1),
        timeoutMs
      );

      if (error) {
        console.error('❌ Erro ao buscar perfil do administrador:', { 
          message: error.message, 
          platform: Platform.OS,
          code: error.code 
        });
        return null;
      }

      // Verifica se há dados retornados
      if (!data || data.length === 0) {
        // Nenhum perfil de administrador encontrado
        return null;
      }

      const adminProfile = data[0];
      // Perfil encontrado
      return adminProfile;
    } catch (error) {
      console.error('💥 Erro ao buscar perfil do administrador:', { 
        error, 
        platform: Platform.OS 
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
        return []; // Retorna array vazio ao invés de lançar erro
      }

      return data?.map((item) => item.buildings).filter(Boolean) || [];
    } catch (error) {
      console.error('Erro ao buscar edifícios do administrador:', error);
      return []; // Sempre retorna array vazio em caso de erro
    }
  },

  // Verificar se o usuário atual é administrador com melhorias para iOS
  async getCurrentAdmin(): Promise<AdminProfile | null> {
    try {
      // Verificando administrador atual

      // Timeout maior para iOS
      const userTimeoutMs = Platform.OS === 'ios' ? 8000 : 5000;
      const userResult = await withTimeout(supabase.auth.getUser(), userTimeoutMs);

      const {
        data: { user },
      } = userResult;

      if (!user) {
        console.log('👤 Nenhum usuário logado', { platform: Platform.OS });
        return null;
      }

      // Usuário encontrado, buscando perfil admin

      // Timeout maior para iOS na busca do perfil
      const profileTimeoutMs = Platform.OS === 'ios' ? 8000 : 5000;
      const adminProfile = await withTimeout(this.getAdminProfile(user.id), profileTimeoutMs);

      if (adminProfile) {
        // Perfil de administrador encontrado
      } else {
        console.log('❌ Perfil de administrador não encontrado', { platform: Platform.OS });
      }

      return adminProfile;
    } catch (error) {
      console.error('💥 Erro ao verificar administrador atual:', { 
        error, 
        platform: Platform.OS 
      });
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
      name?: string;
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
