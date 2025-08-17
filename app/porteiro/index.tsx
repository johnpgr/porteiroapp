import { Link, router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Container } from '~/components/Container';
import { flattenStyles } from '~/utils/styles';

export default function PorteiroDashboard() {
  return (
    <Container>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🛡️ Porteiro</Text>
          <Text style={styles.subtitle}>Central de Controle</Text>
        </View>

        <View style={styles.cardsContainer}>
          <Link href="/porteiro/login" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.loginCard])}>
              <Text style={styles.cardIcon}>🔐</Text>
              <Text style={styles.cardTitle}>Fazer Login</Text>
              <Text style={styles.cardDescription}>Autenticar com código</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/porteiro/visitor" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.visitorCard])}>
              <Text style={styles.cardIcon}>👋</Text>
              <Text style={styles.cardTitle}>Gerenciar Visitantes</Text>
              <Text style={styles.cardDescription}>Registrar e autorizar visitas</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/porteiro/delivery" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.deliveryCard])}>
              <Text style={styles.cardIcon}>📦</Text>
              <Text style={styles.cardTitle}>Encomendas</Text>
              <Text style={styles.cardDescription}>Receber e gerenciar entregas</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/porteiro/logs" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.logsCard])}>
              <Text style={styles.cardIcon}>📋</Text>
              <Text style={styles.cardTitle}>Histórico</Text>
              <Text style={styles.cardDescription}>Ver atividades do turno</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity style={flattenStyles([styles.card, styles.emergencyCard])}>
            <Text style={styles.cardIcon}>🚨</Text>
            <Text style={styles.cardTitle}>Emergência</Text>
            <Text style={styles.cardDescription}>Contatos e procedimentos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  cardsContainer: {
    padding: 20,
    gap: 15,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loginCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  visitorCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deliveryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  logsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#607D8B',
  },
  emergencyCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
});