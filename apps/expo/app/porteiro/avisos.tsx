import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Container } from '~/components/Container';
import { usePorteiroDashboard } from '~/providers/PorteiroDashboardProvider';
import { flattenStyles } from '~/utils/styles';

const iconByType: Record<string, string> = {
  manutencao: '🔧',
  maintenance: '🔧',
  reuniao: '👥',
  meeting: '👥',
  obra: '🏗️',
  informativo: 'ℹ️',
  notice: '📢',
  urgent: '🚨',
};

const colorByPriority: Record<string, string> = {
  alta: '#FF5722',
  high: '#FF5722',
  media: '#FF9800',
  medium: '#FF9800',
  baixa: '#4CAF50',
  low: '#4CAF50',
  normal: '#2196F3',
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  const day = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
  const time = `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
  return { day, time };
};

export default function PorteiroAvisosScreen() {
  const router = useRouter();
  const {
    communications,
    loadingCommunications,
    refreshCommunications,
  } = usePorteiroDashboard();

  useEffect(() => {
    refreshCommunications();
  }, [refreshCommunications]);

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={30} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>📢 Avisos</Text>
            <Text style={styles.headerSubtitle}>Comunicados do condomínio</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={loadingCommunications} onRefresh={refreshCommunications} />
          }
        >
          {loadingCommunications && communications.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando comunicados...</Text>
            </View>
          ) : communications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Nenhum comunicado</Text>
              <Text style={styles.emptySubtitle}>Não há comunicados disponíveis no momento</Text>
            </View>
          ) : (
            communications.map((item) => {
              const { day, time } = formatDateTime(item.created_at);
              const icon = item.type ? iconByType[item.type] ?? '📢' : '📢';
              const color = item.priority ? colorByPriority[item.priority] ?? '#2196F3' : '#2196F3';

              return (
                <View
                  key={item.id}
                  style={flattenStyles([styles.avisoCard, { borderLeftColor: color }])}
                >
                  <View style={styles.avisoHeader}>
                    <Text style={styles.avisoIcon}>{icon}</Text>
                    <View style={styles.avisoInfo}>
                      <Text style={styles.avisoTitle}>{item.title}</Text>
                      <Text style={styles.avisoAuthor}>Por {item.authorName || 'Administração'}</Text>
                      <Text style={styles.avisoDateTime}>
                        {day} às {time}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.avisoDescription}>{item.content}</Text>
                </View>
              );
            })
          )}
        </ScrollView>
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
    backgroundColor: '#2196F3',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    paddingHorizontal: 20,
    gap: 50,
    paddingVertical: 30,
    marginBottom: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  avisoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
  },
  avisoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avisoIcon: {
    fontSize: 28,
    marginRight: 16,
    marginTop: 2,
  },
  avisoInfo: {
    flex: 1,
  },
  avisoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  avisoAuthor: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  avisoDateTime: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  avisoDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'justify',
  },
});
