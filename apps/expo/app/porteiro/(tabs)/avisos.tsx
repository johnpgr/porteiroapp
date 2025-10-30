import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
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

export default function PorteiroAvisosTab() {
  const {
    communications,
    loadingCommunications,
    refreshCommunications,
  } = usePorteiroDashboard();

  useFocusEffect(
    useCallback(() => {
      refreshCommunications();
    }, [refreshCommunications])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={loadingCommunications} onRefresh={refreshCommunications} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📢 Avisos</Text>
        <Text style={styles.headerSubtitle}>Comunicados do condomínio</Text>
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    marginTop: 24,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
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
