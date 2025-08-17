import { Link } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Container } from '~/components/Container';
import { flattenStyles } from '~/utils/styles';

export default function MoradorDashboard() {
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
          <Text style={styles.title}>🏠 Morador</Text>
          <Text style={styles.subtitle}>Apartamento 101</Text>
        </View>

        <View style={styles.cardsContainer}>
          <Link href="/morador/notifications" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.notificationsCard])}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>🔔</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>Notificações</Text>
              <Text style={styles.cardDescription}>Visitantes e encomendas</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/morador/authorize" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.authorizeCard])}>
              <Text style={styles.cardIcon}>✅</Text>
              <Text style={styles.cardTitle}>Autorizar Visita</Text>
              <Text style={styles.cardDescription}>Aprovar ou negar acesso</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/morador/preregister" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.preregisterCard])}>
              <Text style={styles.cardIcon}>📝</Text>
              <Text style={styles.cardTitle}>Pré-cadastro</Text>
              <Text style={styles.cardDescription}>Registrar visitantes esperados</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/morador/logs" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.logsCard])}>
              <Text style={styles.cardIcon}>📋</Text>
              <Text style={styles.cardTitle}>Histórico</Text>
              <Text style={styles.cardDescription}>Atividades do apartamento</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity style={flattenStyles([styles.card, styles.settingsCard])}>
            <Text style={styles.cardIcon}>⚙️</Text>
            <Text style={styles.cardTitle}>Configurações</Text>
            <Text style={styles.cardDescription}>Preferências e perfil</Text>
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
    backgroundColor: '#4CAF50',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  notificationsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  authorizeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  preregisterCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  logsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#607D8B',
  },
  settingsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  badge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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