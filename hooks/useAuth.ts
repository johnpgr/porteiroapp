import React, { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';
import { notificationService } from '../services/notificationService';

interface User {
  id: string;
  name: string;
  code: string;
  role: 'admin' | 'porteiro' | 'morador';
  apartment_id?: string;
  last_login?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Verificar se há usuário logado no AsyncStorage
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Aqui você pode implementar verificação de token/sessão
      // Por enquanto, vamos simular verificação local
      setAuthState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setAuthState({ user: null, loading: false, isAuthenticated: false });
    }
  };

  const login = async (code: string, password?: string, userType?: 'admin' | 'porteiro' | 'morador') => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('code', code)
        .eq('role', userType || 'morador')
        .single();

      if (error || !user) {
        throw new Error('Usuário não encontrado');
      }

      if (user.password && password !== user.password) {
        throw new Error('Senha incorreta');
      }

      // Registrar para notificações push
      try {
        const pushToken = await notificationService.registerForPushNotifications();
        if (pushToken) {
          await notificationService.savePushToken(user.id, pushToken);
        }
      } catch (err) {
        console.error('Erro ao registrar token push:', err);
      }

      // Atualizar último login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      setAuthState({
        user,
        loading: false,
        isAuthenticated: true,
      });

      return { success: true, user };
    } catch (error) {
      setAuthState({ user: null, loading: false, isAuthenticated: false });
      return { success: false, error: error instanceof Error ? error.message : 'Erro na autenticação' };
    }
  };

  const logout = async () => {
    try {
      setAuthState({ user: null, loading: false, isAuthenticated: false });
    } catch (err) {
      console.error('Erro no logout:', err);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (authState.user) {
      setAuthState(prev => ({
        ...prev,
        user: { ...prev.user!, ...userData }
      }));
    }
  };

  return {
    ...authState,
    login,
    logout,
    updateUser,
    checkAuthState,
  };
}

// Hook para verificar permissões
export function usePermissions() {
  const { user } = useAuth();

  const canManageUsers = user?.role === 'admin';
  const canManageVisitors = user?.role === 'admin' || user?.role === 'porteiro';
  const canViewLogs = user?.role === 'admin' || user?.role === 'porteiro';
  const canReceiveDeliveries = user?.role === 'porteiro';
  const canAuthorizeVisitors = user?.role === 'morador';

  return {
    canManageUsers,
    canManageVisitors,
    canViewLogs,
    canReceiveDeliveries,
    canAuthorizeVisitors,
    userRole: user?.role,
  };
}

// Exporta um AuthProvider simples para evitar erro de componente inválido no layout.
// No momento, ele apenas encapsula os filhos sem fornecer contexto global.
export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  return React.createElement(React.Fragment, null, children);
};