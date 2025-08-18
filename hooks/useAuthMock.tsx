import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  user_type: 'admin' | 'porteiro' | 'morador';
  condominium_id?: string;
  building_id?: string;
  apartment_id?: string;
  is_active: boolean;
  last_login?: string;
  push_token?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Usuários mock para teste
const mockUsers: AuthUser[] = [
  {
    id: '1',
    email: 'morador1@teste.com',
    user_type: 'morador',
    condominium_id: '1',
    building_id: '1',
    apartment_id: '101',
    is_active: true,
    last_login: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'admin@teste.com',
    user_type: 'admin',
    condominium_id: '1',
    is_active: true,
    last_login: new Date().toISOString(),
  },
  {
    id: '3',
    email: 'porteiro@teste.com',
    user_type: 'porteiro',
    condominium_id: '1',
    is_active: true,
    last_login: new Date().toISOString(),
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Verificar credenciais mock
      const foundUser = mockUsers.find(u => u.email === email);
      
      if (!foundUser) {
        setLoading(false);
        return { success: false, error: 'Usuário não encontrado' };
      }
      
      if (password !== 'morador123') {
        setLoading(false);
        return { success: false, error: 'Senha incorreta' };
      }
      
      if (!foundUser.is_active) {
        setLoading(false);
        return { success: false, error: 'Usuário inativo' };
      }
      
      // Login bem-sucedido
      setUser({
        ...foundUser,
        last_login: new Date().toISOString(),
      });
      
      setLoading(false);
      return { success: true };
      
    } catch (error) {
      setLoading(false);
      return { success: false, error: 'Erro interno do servidor' };
    }
  };

  const signOut = async () => {
    setLoading(true);
    
    // Simular delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setUser(null);
    setLoading(false);
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

export function usePermissions() {
  const { user } = useAuth();

  const canManageUsers = user?.user_type === 'admin';
  const canManageVisitors = user?.user_type === 'admin' || user?.user_type === 'porteiro';
  const canViewLogs = user?.user_type === 'admin' || user?.user_type === 'porteiro';
  const canReceiveDeliveries = user?.user_type === 'porteiro';
  const canAuthorizeVisitors = user?.user_type === 'morador';

  return {
    canManageUsers,
    canManageVisitors,
    canViewLogs,
    canReceiveDeliveries,
    canAuthorizeVisitors,
  };
}