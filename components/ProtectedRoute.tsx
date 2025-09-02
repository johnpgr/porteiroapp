import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  userType?: 'admin' | 'porteiro' | 'morador';
  requiredRole?: 'admin' | 'porteiro' | 'morador';
}

export default function ProtectedRoute({ children, redirectTo = '/login', userType, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (loading || hasRedirectedRef.current) return;

    if (!user) {
      hasRedirectedRef.current = true;
      router.replace(redirectTo);
      return;
    }

    const requiredUserType = userType || requiredRole;
    if (requiredUserType && user.user_type !== requiredUserType) {
      hasRedirectedRef.current = true;
      router.replace('/');
    }
  }, [loading, user, userType, requiredRole, redirectTo]);

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
  const requiredUserType = userType || requiredRole;
  if (requiredUserType && user.user_type !== requiredUserType) {
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
