import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../hooks/useAuthMock';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo: string;
  userType?: 'admin' | 'porteiro' | 'morador';
}

export default function ProtectedRoute({ children, redirectTo, userType }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // Se não estiver autenticado, redirecionar para a tela de login
      router.replace(redirectTo);
    } else if (!loading && user && userType && user.user_type !== userType) {
      // Se estiver autenticado mas não for do tipo correto, redirecionar para home
      router.replace('/');
    }
  }, [user, loading, redirectTo, userType]);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Verificando autenticação...</Text>
      </View>
    );
  }

  // Se não estiver autenticado, não renderizar nada (será redirecionado)
  if (!user) {
    return null;
  }

  // Se estiver autenticado mas não for do tipo correto, não renderizar
  if (userType && user.user_type !== userType) {
    return null;
  }

  // Se estiver autenticado e for do tipo correto, renderizar o conteúdo protegido
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
