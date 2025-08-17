import { Link, router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Container } from '~/components/Container';
import { flattenStyles } from '~/utils/styles';

export default function AdminDashboard() {
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
          <Text style={styles.title}>👨‍💼 Administrador</Text>
          <Text style={styles.subtitle}>Painel de Controle</Text>
        </View>

        <View style={styles.cardsContainer}>
          <Link href="/admin/users" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.usersCard])}>
              <Text style={styles.cardIcon}>👥</Text>
              <Text style={styles.cardTitle}>Gerenciar Usuários</Text>
              <Text style={styles.cardDescription}>Cadastrar porteiros e moradores</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/admin/logs" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.logsCard])}>
              <Text style={styles.cardIcon}>📋</Text>
              <Text style={styles.cardTitle}>Logs do Sistema</Text>
              <Text style={styles.cardDescription}>Visualizar histórico completo</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/admin/communications" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.communicationsCard])}>
              <Text style={styles.cardIcon}>📢</Text>
              <Text style={styles.cardTitle}>Comunicados</Text>
              <Text style={styles.cardDescription}>Enviar avisos e alertas</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity style={flattenStyles([styles.card, styles.statsCard])}>
            <Text style={styles.cardIcon}>📊</Text>
            <Text style={styles.cardTitle}>Estatísticas</Text>
            <Text style={styles.cardDescription}>Relatórios e métricas</Text>
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
    backgroundColor: '#FF9800',
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
  usersCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  logsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  communicationsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  statsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
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