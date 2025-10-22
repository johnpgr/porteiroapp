import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthForm from '../../components/AuthForm';
import { useAuth } from '../../hooks/useAuth';
import { registerPushTokenAfterLogin } from '~/utils/pushNotifications';

export default function MoradorLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const hasNavigatedRef = useRef(false);
  const { signIn, user, loading: authLoading, checkAndRedirectUser } = useAuth();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Redireciona diretamente para /morador se o usuário já estiver logado
    if (!authLoading && user?.user_type === 'morador') {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        if (loginTimeoutRef.current) {
          clearTimeout(loginTimeoutRef.current);
          loginTimeoutRef.current = null;
        }
        router.replace('/morador');
      }
    } else if (!authLoading && !user) {
      hasNavigatedRef.current = false;
    }
  }, [authLoading, user]);

  const handleLogin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }

    try {
      hasNavigatedRef.current = false;
      setIsLoading(true);

      loginTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }, 15000);

      const result = await signIn(email, password);

      if (!result.success) {
        Alert.alert('Erro de Login', result.error || 'Erro desconhecido');
        return { success: false, error: result.error };
      }

      // Registrar push token imediatamente após login bem-sucedido
      if (result.user?.id) {
        console.log('🔔 [MoradorLogin] Registrando push token após login...');
        await registerPushTokenAfterLogin(result.user.id, 'morador');
      }

      // O redirecionamento será feito automaticamente pelo useEffect
      // que já tem o delay de 1.5s para melhor experiência visual
      return { success: true };
    } catch (error) {
      console.error('Erro durante login do morador:', error);
      const errorMessage = 'Ocorreu um erro inesperado';
      Alert.alert('Erro', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }

      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/')}
          disabled={isLoading}>
          <Ionicons name="arrow-back" size={24} color={isLoading ? '#ccc' : '#2196F3'} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>🏠 Login Morador</Text>
            <Text style={styles.subtitle}>Acesse sua área de morador</Text>
            {isLoading && <Text style={styles.loadingIndicator}>⏳ Autenticando...</Text>}
          </View>

          <AuthForm onSubmit={handleLogin} submitText="Entrar como Morador" loading={isLoading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingIndicator: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
