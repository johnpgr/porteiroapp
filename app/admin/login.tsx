import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import AuthForm from '../../components/AuthForm';
import { useAuth } from '../../hooks/useAuth';

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();

  const handleTestLogin = async () => {
    await handleLogin('admin@teste.com', 'admin123');
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        Alert.alert('Erro de Login', error);
        return;
      }

      // Verificar se o usuário é admin após o login
      // Aguardar um momento para o estado ser atualizado
      setTimeout(() => {
        if (user?.user_type !== 'admin') {
          Alert.alert('Acesso Negado', 'Apenas administradores podem acessar esta área');
          return;
        }
        // Redirecionar para a área do admin após verificação
        router.replace('/admin');
      }, 100);
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Voltar</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>🔐 Login Administrador</Text>
        <Text style={styles.subtitle}>Acesse o painel administrativo</Text>
      </View>

      <AuthForm onSubmit={handleLogin} loading={loading} submitText="Entrar como Admin" />

      {/* Botão de Login de Teste - Apenas para Desenvolvimento */}
      <TouchableOpacity style={styles.testButton} onPress={handleTestLogin} disabled={loading}>
        <Text style={styles.testButtonText}>🧪 Login Teste (Dev)</Text>
      </TouchableOpacity>
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
  testButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
