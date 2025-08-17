import React, { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';
import { notificationService } from '../services/notificationService';

interface User {
  id: string;
  email: string;
  name: string;
  code: string;
  user_type: 'admin' | 'porteiro' | 'morador';
  condominium_id?: string;
  building_id?: string;
  apartment_id?: string;
  phone?: string;
  is_active: boolean;
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
      setAuthState((prev) => ({ ...prev, loading: false }));
    } catch (error) {
      setAuthState({ user: null, loading: false, isAuthenticated: false });
    }
  };

  const signIn = async (
    email: string,
    password: string,
    userType?: 'admin' | 'porteiro' | 'morador'
  ) => {
    setAuthState((prev) => ({ ...prev, loading: true }));

    try {
      // Inferir user_type do email se não fornecido
      let inferredUserType = userType;
      if (!inferredUserType) {
        if (email.includes('admin')) {
          inferredUserType = 'admin';
        } else if (email.includes('porteiro')) {
          inferredUserType = 'porteiro';
        } else {
          inferredUserType = 'morador';
        }
      }

      // Buscar usuário por email e tipo
      const { data: user, error } = await supabase
        .from('users')
        .select(
          `
          *,
          condominium:condominiums(id, name),
          building:buildings(id, name)
        `
        )
        .eq('email', email)
        .eq('user_type', inferredUserType || 'morador')
        .eq('is_active', true)
        .single();

      if (error || !user) {
        throw new Error('Usuário não encontrado ou inativo');
      }

      // Verificar senha usando hash SHA-256
      const crypto = require('crypto');
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

      if (user.password_hash !== hashedPassword) {
        throw new Error('Senha incorreta');
      }

      // Verificar hierarquia baseada no tipo de usuário
      if (userType === 'admin' && !user.condominium_id) {
        throw new Error('Administrador deve estar associado a um condomínio');
      }

      if (userType === 'porteiro' && (!user.condominium_id || !user.building_id)) {
        throw new Error('Porteiro deve estar associado a um condomínio e prédio');
      }

      if (userType === 'morador' && !user.condominium_id) {
        throw new Error('Morador deve estar associado a um condomínio');
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

      // Mapear dados do usuário para interface
      const mappedUser: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        code: user.code,
        user_type: user.user_type,
        condominium_id: user.condominium_id,
        building_id: user.building_id,
        apartment_id: user.apartment_id,
        phone: user.phone,
        is_active: user.is_active,
        last_login: user.last_login,
      };

      setAuthState({
        user: mappedUser,
        loading: false,
        isAuthenticated: true,
      });

      return { success: true, user: mappedUser };
    } catch (err) {
      setAuthState({ user: null, loading: false, isAuthenticated: false });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro na autenticação',
      };
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
      setAuthState((prev) => ({
        ...prev,
        user: { ...prev.user!, ...userData },
      }));
    }
  };

  return {
    ...authState,
    signIn,
    logout,
    updateUser,
    checkAuthState,
  };
}

// Hook para verificar permissões baseado na hierarquia
export function usePermissions() {
  const { user } = useAuth();

  const canManageUsers = user?.user_type === 'admin';
  const canManageVisitors = user?.user_type === 'admin' || user?.user_type === 'porteiro';
  const canViewLogs = user?.user_type === 'admin' || user?.user_type === 'porteiro';
  const canReceiveDeliveries = user?.user_type === 'porteiro';
  const canAuthorizeVisitors = user?.user_type === 'morador';

  // Permissões hierárquicas
  const canManageCondominium = user?.user_type === 'admin' && user?.condominium_id;
  const canManageBuilding =
    (user?.user_type === 'admin' && user?.condominium_id) ||
    (user?.user_type === 'porteiro' && user?.building_id);
  const canAccessCondominium = user?.condominium_id;
  const canAccessBuilding = user?.building_id || user?.condominium_id;

  return {
    canManageUsers,
    canManageVisitors,
    canViewLogs,
    canReceiveDeliveries,
    canAuthorizeVisitors,
    canManageCondominium,
    canManageBuilding,
    canAccessCondominium,
    canAccessBuilding,
    userRole: user?.user_type,
    condominiumId: user?.condominium_id,
    buildingId: user?.building_id,
  };
}

// Exporta um AuthProvider simples para evitar erro de componente inválido no layout.
// No momento, ele apenas encapsula os filhos sem fornecer contexto global.
export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  return React.createElement(React.Fragment, null, children);
};
