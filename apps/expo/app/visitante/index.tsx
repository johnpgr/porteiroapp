import { Link, router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Container } from '~/components/Container';
import { flattenStyles } from '~/utils/styles';

export default function VisitanteDashboard() {
  return (
    <Container>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>👋 Visitante</Text>
          <Text style={styles.subtitle}>Acesso sem Porteiro</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoTitle}>Como funciona?</Text>
          <Text style={styles.infoText}>
            Registre sua visita e aguarde a autorização do morador. Você receberá uma notificação
            quando for aprovado.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <Link href="/visitante/register" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.registerCard])}>
              <Text style={styles.cardIcon}>📝</Text>
              <Text style={styles.cardTitle}>Registrar Visita</Text>
              <Text style={styles.cardDescription}>Informar dados e apartamento</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/visitante/status" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.statusCard])}>
              <Text style={styles.cardIcon}>⏳</Text>
              <Text style={styles.cardTitle}>Status da Visita</Text>
              <Text style={styles.cardDescription}>Verificar autorização</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/visitante/help" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.helpCard])}>
              <Text style={styles.cardIcon}>❓</Text>
              <Text style={styles.cardTitle}>Ajuda</Text>
              <Text style={styles.cardDescription}>Dúvidas e contatos</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/emergency" asChild>
            <TouchableOpacity style={flattenStyles([styles.card, styles.emergencyCard])}>
              <Text style={styles.cardIcon}>🚨</Text>
              <Text style={styles.cardTitle}>Emergência</Text>
              <Text style={styles.cardDescription}>Contatos de emergência</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>🏢 Edifício Residencial</Text>
          <Text style={styles.footerSubtext}>Sistema de Acesso Inteligente</Text>
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
  infoCard: {
    backgroundColor: '#E3F2FD',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  cardsContainer: {
    paddingHorizontal: 20,
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
  registerCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  helpCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
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
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
  },
});
