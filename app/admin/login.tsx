import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import AuthForm from '../../components/AuthForm';
import { adminAuth } from '../../utils/supabase';

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const loginTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isCheckingRef = useRef(false); // Flag para evitar múltiplas verificações

  useEffect(() => {
    // Verificar se já existe um administrador logado apenas uma vez
    if (!isCheckingRef.current) {
      checkCurrentAdmin();
    }
    
    // Cleanup na desmontagem do componente
    return () => {
      isMountedRef.current = false;
      isCheckingRef.current = false;
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, []);

  const checkCurrentAdmin = async () => {
    // Evitar múltiplas verificações simultâneas
    if (isCheckingRef.current) {
      console.log('🔄 Verificação já em andamento, ignorando...');
      return;
    }
    
    try {
      isCheckingRef.current = true;
      console.log('🔍 Verificando se há administrador logado...');
      setIsCheckingAuth(true);
      
      // Timeout para verificação inicial
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na verificação de autenticação')), 8000);
      });
      
      const currentAdmin = await Promise.race([
        adminAuth.getCurrentAdmin(),
        timeoutPromise
      ]);
      
      if (currentAdmin && isMountedRef.current) {
        console.log('✅ Administrador já logado, redirecionando...');
        router.replace('/admin');
      } else {
        console.log('👤 Nenhum administrador logado');
      }
    } catch (error) {
      console.log('⚠️ Erro ao verificar administrador logado:', error);
    } finally {
      isCheckingRef.current = false;
      if (isMountedRef.current) {
        setIsCheckingAuth(false);
      }
    }
  };

  const handleLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Limpar timeout anterior se existir
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }
    
    try {
      console.log('🔐 Iniciando processo de login...');
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
        
        if (isMountedRef.current) {
          Alert.alert(
            'Login Realizado',
            `Bem-vindo, ${result.adminProfile.name}!`,
            [{
              text: 'OK',
              onPress: () => {
                if (isMountedRef.current) {
                  router.replace('/admin');
                }
              }
            }]
          );
        }
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

  // Mostrar loading durante verificação inicial
  if (isCheckingAuth) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>🔍 Verificando autenticação...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
        disabled={isLoading}
      >
        <Text style={[styles.backButtonText, isLoading && styles.disabledText]}>← Voltar</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>🔐 Login Administrador</Text>
        <Text style={styles.subtitle}>Acesse o painel administrativo</Text>
        {isLoading && (
          <Text style={styles.loadingIndicator}>⏳ Autenticando...</Text>
        )}
      </View>

      <AuthForm 
        onSubmit={handleLogin} 
        submitText="Entrar como Admin" 
        loading={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    justifyContent: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: '600',
    textAlign: 'center',
  },
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
