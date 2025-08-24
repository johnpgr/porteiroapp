import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';
import BottomNav from '~/components/BottomNav';

interface Communication {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const AvisosTab = () => {
  const { user } = useAuth();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunications();
  }, [user?.building_id]);

  const fetchCommunications = async () => {
    if (!user?.building_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('building_id', user.building_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar comunicados:', error);
      } else {
        setCommunications(data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar comunicados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return '🛠️';
      case 'event':
        return '🎉';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  if (loading) {
    return (
      <View style={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Carregando comunicados...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📢 Avisos do Condomínio</Text>

          {communications.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>📭</Text>
              <Text style={styles.emptyStateTitle}>Nenhum comunicado disponível</Text>
              <Text style={styles.emptyStateDescription}>
                Não há comunicados para o seu prédio no momento.
              </Text>
            </View>
          ) : (
            communications.map((communication) => (
              <View key={communication.id} style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>
                  {getTypeIcon(communication.type)} {communication.title}
                </Text>
                <Text style={styles.noticeDescription}>
                  {communication.content}
                </Text>
                <Text style={styles.noticeTime}>
                  Publicado em {formatDate(communication.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <BottomNav activeTab="avisos" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noticeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noticeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noticeTime: {
    fontSize: 12,
    color: '#999',
  },
});

export default AvisosTab;