import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { adminAuth, supabase } from '~/utils/supabase';

type Mode = 'select' | 'view';

type Params = {
  mode?: Mode;
};

interface Communication {
  id: string;
  title: string;
  content: string;
  type: string | null;
  priority: string | null;
  created_at: string;
  building: {
    name: string | null;
  } | null;
}

export default function CommunicationsModal() {
  const { mode = 'view' } = useLocalSearchParams<Params>();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCommunications = useCallback(async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        setErrorMessage('Administrador não encontrado. Faça login novamente.');
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map((building) => building.id) ?? [];

      if (buildingIds.length === 0) {
        setCommunications([]);
        return;
      }

      const { data, error } = await supabase
        .from('communications')
        .select(
          `
          id,
          title,
          content,
          type,
          priority,
          created_at,
          building:buildings(name)
        `
        )
        .in('building_id', buildingIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCommunications(data ?? []);
      setErrorMessage(null);
    } catch (error) {
      console.error('Erro ao carregar comunicados:', error);
      setErrorMessage('Falha ao carregar comunicados. Tente novamente.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        setLoading(true);
        await fetchCommunications();
        if (isActive) {
          setLoading(false);
        }
      };
      load();
      return () => {
        isActive = false;
      };
    }, [fetchCommunications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCommunications();
    setRefreshing(false);
  }, [fetchCommunications]);

  const getTypeLabel = (type: string | null) => {
    switch (type) {
      case 'emergency':
        return '🚨 Emergência';
      case 'maintenance':
        return '🔧 Manutenção';
      case 'event':
        return '🎉 Evento';
      default:
        return '📢 Aviso';
    }
  };

  const getPriorityLabel = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return '🔴 Alta';
      case 'urgent':
        return '⚠️ Urgente';
      case 'low':
        return '🟢 Baixa';
      default:
        return '🟡 Normal';
    }
  };

  const handleSelect = (id: string) => {
    if (mode === 'select') {
      router.navigate({
        pathname: '/admin/(tabs)/comunicados',
        params: { selectedCommunicationId: id },
      });
    }
    router.back();
  };

  const renderItem = ({ item }: { item: Communication }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelect(item.id)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaChip}>{getTypeLabel(item.type)}</Text>
          <Text style={styles.cardMetaChip}>{getPriorityLabel(item.priority)}</Text>
        </View>
      </View>
      <Text style={styles.cardContent} numberOfLines={4}>
        {item.content}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>🏢 {item.building?.name ?? 'Sem prédio'}</Text>
        <Text style={styles.cardFooterText}>
          {new Date(item.created_at).toLocaleString('pt-BR')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.centerText}>Carregando comunicados...</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCommunications}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={communications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Text style={styles.centerText}>Nenhum comunicado encontrado.</Text>
          </View>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>📋 Comunicados</Text>
          {mode === 'select' ? (
            <Text style={styles.headerSubtitle}>Toque em um comunicado para selecionar</Text>
          ) : (
            <Text style={styles.headerSubtitle}>Histórico completo dos comunicados</Text>
          )}
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>
      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTextContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardMetaChip: {
    backgroundColor: '#f5f5f5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  cardContent: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 20,
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardFooterText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerText: {
    marginTop: 12,
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#b91c1c',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
