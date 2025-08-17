import { Link } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Container } from '~/components/Container';
import { flattenStyles } from '~/utils/styles';

export default function Home() {
  return (
    <Container>
      <View style={styles.container}>
        <Text style={styles.title}>🏢 PorteiroApp</Text>
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

          <Link href="/visitante" asChild>
            <TouchableOpacity style={flattenStyles([styles.button, styles.visitanteButton])}>
              <Text style={styles.buttonIcon}>👋</Text>
              <Text style={styles.buttonText}>Visitante</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
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
