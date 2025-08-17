import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Container } from '~/components/Container';
import { AuthForm } from '~/components/AuthForm';
import { useAuth } from '~/hooks/useAuth';

export default function PorteiroLogin() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (code: string, password?: string) => {
    setLoading(true);
    try {
      const success = await login(code, password, 'porteiro');
      if (success) {
        Alert.alert('Sucesso', 'Login realizado com sucesso!', [
          { text: 'OK', onPress: () => router.replace('/porteiro') }
        ]);
      } else {
        Alert.alert('Erro', 'Código ou senha incorretos');
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha no login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🛡️ Login do Porteiro</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeIcon}>🛡️</Text>
            <Text style={styles.welcomeTitle}>Bem-vindo, Porteiro!</Text>
            <Text style={styles.welcomeText}>
              Faça login para acessar o sistema de controle de visitantes e encomendas.
            </Text>
          </View>

          <View style={styles.loginCard}>
            <AuthForm
              userType="porteiro"
              onSubmit={handleLogin}
              loading={loading}
            />
          </View>

          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>💡 Precisa de ajuda?</Text>
            <Text style={styles.helpText}>
              • Use seu código de acesso fornecido pela administração
            </Text>
            <Text style={styles.helpText}>
              • A senha é opcional, mas recomendada para maior segurança
            </Text>
            <Text style={styles.helpText}>
              • Em caso de problemas, contate a administração
            </Text>
          </View>

          <View style={styles.emergencyCard}>
            <TouchableOpacity style={styles.emergencyButton}>
              <Text style={styles.emergencyIcon}>🚨</Text>
              <Text style={styles.emergencyText}>Emergência</Text>
            </TouchableOpacity>
            <Text style={styles.emergencyNote}>
              Use apenas em situações de emergência real
            </Text>
          </View>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  welcomeIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    overflow: 'hidden',
  },
  helpCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 4,
    lineHeight: 18,
  },
  emergencyCard: {
    alignItems: 'center',
  },
  emergencyButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 3,
  },
  emergencyIcon: {
    fontSize: 20,
  },
  emergencyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emergencyNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});