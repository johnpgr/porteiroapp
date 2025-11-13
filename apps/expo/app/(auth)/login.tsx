import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import AuthForm from '~/components/AuthForm';
import { useAuth } from '~/hooks/useAuth';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const { signIn, user, loading: authLoading } = useAuth();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, []);

  // Redirect if user is already logged in
  if (!authLoading && user) {
    switch (user.user_type) {
      case 'admin':
        return <Redirect href="/admin" />;
      case 'porteiro':
        return <Redirect href="/porteiro" />;
      case 'morador':
        return <Redirect href="/morador" />;
      default:
        break;
    }
  }

  const handleLogin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }

    try {
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

      // The redirect will be done automatically by the useEffect above
      return { success: true };
    } catch (error) {
      console.error('Erro durante login:', error);
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
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={require('~/assets/logo-james.png')}
              style={styles.logo}
              alt="James Logo"
            />
            <Text style={styles.title}>James Avisa</Text>
            <Text style={styles.subtitle}>Faça login para continuar</Text>
            {isLoading && <Text style={styles.loadingIndicator}>⏳ Autenticando...</Text>}
          </View>

          <AuthForm onSubmit={handleLogin} submitText="Entrar" loading={isLoading} />
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
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  loadingIndicator: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 8,
  },
});
