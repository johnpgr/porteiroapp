import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { Container } from '~/components/Container';
import { flattenStyles } from '~/utils/styles';

export default function Home() {
  const { user, loading } = useAuth();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const handleAutoRedirect = async () => {
      // Aguarda o loading do AuthProvider terminar
      if (!loading) {
        // Se há usuário logado, redireciona diretamente
        if (user) {
          // Mantém splash screen visível por mais tempo
          await new Promise(resolve => setTimeout(resolve, 2500));

          // Redireciona para a página correta
          switch (user.user_type) {
            case 'admin':
              router.replace('/admin');
              break;
            case 'porteiro':
              router.replace('/porteiro');
              break;
            case 'morador':
              router.replace('/morador');
              break;
          }
        } else {
          // Sem usuário logado - mostra a tela de seleção
          setIsCheckingSession(false);
        }
      }
    };

    handleAutoRedirect();
  }, [user, loading]);

  // Mostra loading enquanto verifica a sessão ou se está redirecionando usuário logado
  if (loading || isCheckingSession) {
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Image
            source={require('~/assets/logo-james.png')}
            style={styles.loadingLogo}
            alt="James Logo"
          />
          <Text style={styles.loadingText}>
            {loading ? 'Verificando sessão...' : 'Redirecionando...'}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image
            source={require('~/assets/logo-james.png')} 
            style={styles.logo}
            alt="James Logo"
          />
          <Text style={styles.title}>James Avisa</Text>
        </View>
        <Text style={styles.subtitle}>Selecione seu perfil de acesso</Text>

        <View style={styles.buttonsContainer}>
          <Link href="/admin/login" asChild>
            <TouchableOpacity style={flattenStyles([styles.button, styles.adminButton])}>
              <Text style={styles.buttonIcon}>👨‍💼</Text>
              <Text style={styles.buttonText}>Administrador</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/porteiro/login" asChild>
            <TouchableOpacity style={flattenStyles([styles.button, styles.porteiroButton])}>
              <Text style={styles.buttonIcon}>🛡️</Text>
              <Text style={styles.buttonText}>Porteiro</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/morador/login" asChild>
            <TouchableOpacity style={flattenStyles([styles.button, styles.moradorButton])}>
              <Text style={styles.buttonIcon}>🏠</Text>
              <Text style={styles.buttonText}>Morador</Text>
            </TouchableOpacity>
          </Link>

          {/* <Link href="/visitante" asChild>
            <TouchableOpacity style={flattenStyles([styles.button, styles.visitanteButton])}>
              <Text style={styles.buttonIcon}>👋</Text>
              <Text style={styles.buttonText}>Visitante</Text>
            </TouchableOpacity>
          </Link> */}
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212429',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  adminButton: {
    backgroundColor: '#FF9800',
  },
  porteiroButton: {
    backgroundColor: '#2196F3',
  },
  moradorButton: {
    backgroundColor: '#4CAF50',
  },
  visitanteButton: {
    backgroundColor: '#9C27B0',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
});
