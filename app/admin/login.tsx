import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import AuthForm from '../../components/AuthForm';
import { adminAuth } from '../../utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import { registerPushTokenAfterLogin } from '~/utils/pushNotifications';

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  // Use generic timeout return type for compatibility across environments (RN / web / Node)
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const hasNavigatedRef = useRef(false);
  const { user, loading: authLoading, checkAndRedirectUser } = useAuth();

  useEffect(() => {
    // Cleanup na desmontagem do componente
    return () => {
      isMountedRef.current = false;
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Redireciona diretamente para /admin se o usuário já estiver logado
    if (!authLoading && user?.user_type === 'admin') {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        if (loginTimeoutRef.current) {
          clearTimeout(loginTimeoutRef.current);
          loginTimeoutRef.current = null;
        }
        router.replace('/admin');
      }
    } else if (!authLoading && !user) {
      hasNavigatedRef.current = false;
    }
  }, [authLoading, user]);

  // Removida função checkCurrentAdmin - verificação automática deve ocorrer apenas em rotas protegidas

  const handleLogin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Limpar timeout anterior se existir
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }

    try {
      console.log('🔐 Iniciando processo de login...');
      hasNavigatedRef.current = false;
      setIsLoading(true);

      // Timeout de segurança para resetar loading em caso de travamento
      loginTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.warn('⏰ Timeout de segurança ativado, resetando loading...');
          setIsLoading(false);
        }
      }, 15000);

      const result = await adminAuth.signIn(email, password);

      // Limpar timeout se chegou até aqui
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }

      if (result.user && result.adminProfile) {
        console.log('✅ Login realizado com sucesso!');

        // Registrar push token imediatamente após login bem-sucedido
        if (result.user.id) {
          console.log('🔔 [AdminLogin] Registrando push token após login...');
          await registerPushTokenAfterLogin(result.user.id, 'admin');
        }

        // O redirecionamento será feito automaticamente pelo useEffect
        // que já tem o delay de 1.5s para melhor experiência visual
        return { success: true };
      } else {
        console.warn('⚠️ Falha na autenticação - dados incompletos');
        return { success: false, error: 'Falha na autenticação' };
      }
    } catch (error: any) {
      console.error('💥 Erro durante o login:', error);

      let errorMessage = 'Ocorreu um erro inesperado';

      if (error.message?.includes('Timeout')) {
        errorMessage = 'A operação demorou muito para responder. Tente novamente.';
      } else if (error.message === 'Invalid login credentials') {
        errorMessage = 'Email ou senha incorretos';
      } else if (error.message === 'Usuário não é um administrador') {
        errorMessage = 'Este usuário não possui permissões de administrador';
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    } finally {
      // Garantir que o loading seja sempre resetado
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }

      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Removida verificação de loading inicial - não há mais verificação automática

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
          <Text style={[styles.backButtonText, isLoading && styles.disabledText]}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>🔐 Login Administrador</Text>
            <Text style={styles.subtitle}>Acesse o painel administrativo</Text>
            {isLoading && <Text style={styles.loadingIndicator}>⏳ Autenticando...</Text>}
          </View>

          <AuthForm onSubmit={handleLogin} submitText="Entrar como Admin" loading={isLoading} />
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
  // Removidos estilos de loading da verificação automática
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  disabledText: {
    color: '#ccc',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
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
