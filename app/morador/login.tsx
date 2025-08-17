import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthForm from '../../components/AuthForm';
import { useAuth } from '../../hooks/useAuth';

export default function MoradorLogin() {
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();

  const handleTestLogin = async () => {
    await handleLogin('morador@teste.com', 'morador123');
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        Alert.alert('Erro de Login', error);
        return;
      }

      // Verificar se o usuário é morador após o login
      setTimeout(() => {
        if (user?.user_type !== 'morador') {
          Alert.alert('Acesso Negado', 'Apenas moradores podem acessar esta área');
          return;
        }
        // Redirecionar para a área do morador após verificação
        router.replace('/morador');
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
        <Ionicons name="arrow-back" size={24} color="#2196F3" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>🏠 Login Morador</Text>
        <Text style={styles.subtitle}>Acesse sua área de morador</Text>
      </View>

      <AuthForm onSubmit={handleLogin} loading={loading} submitText="Entrar como Morador" />

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
