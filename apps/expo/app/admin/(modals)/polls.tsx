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

interface PollOption {
  id: string;
  option_text: string;
  votes_count: number;
  percentage: number;
}

interface Poll {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  created_at: string;
  building: {
    name: string | null;
  };
  poll_options: PollOption[];
  total_votes: number;
}

export default function PollsModal() {
  const { mode = 'view' } = useLocalSearchParams<Params>();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPolls = useCallback(async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        setErrorMessage('Administrador não encontrado. Faça login novamente.');
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map((building) => building.id) ?? [];

      if (buildingIds.length === 0) {
        setPolls([]);
        return;
      }

      const { data, error } = await supabase
        .from('polls')
        .select(
          `
          id,
          title,
          description,
          expires_at,
          created_at,
          building_id,
          poll_options(id, option_text)
        `
        )
        .in('building_id', buildingIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const buildingNameMap = Object.fromEntries(
        (adminBuildings ?? []).map((building: any) => [building.id, building.name])
      );

      const pollsWithVotes = await Promise.all(
        (data ?? []).map(async (poll: any) => {
          const optionsWithVotes = await Promise.all(
            (poll.poll_options ?? []).map(async (option: any) => {
              const { count, error: countError } = await supabase
                .from('poll_votes')
                .select('*', { head: true, count: 'exact' })
                .eq('poll_option_id', option.id);

              if (countError) {
                console.error('Erro ao contar votos:', countError);
                return { ...option, votes_count: 0 };
              }

              return { ...option, votes_count: count ?? 0 };
            })
          );

          const totalVotes = optionsWithVotes.reduce((sum, opt) => sum + opt.votes_count, 0);

          const optionsWithPercentages = optionsWithVotes.map((option) => ({
            ...option,
            percentage: totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0,
          }));

          return {
            ...poll,
            poll_options: optionsWithPercentages,
            total_votes: totalVotes,
            building: {
              name: buildingNameMap[poll.building_id] ?? '',
            },
          };
        })
      );

      setPolls(pollsWithVotes);
      setErrorMessage(null);
    } catch (error) {
      console.error('Erro ao carregar enquetes:', error);
      setErrorMessage('Falha ao carregar enquetes. Tente novamente.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        setLoading(true);
        await fetchPolls();
        if (isActive) {
          setLoading(false);
        }
      };
      load();
      return () => {
        isActive = false;
      };
    }, [fetchPolls])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPolls();
    setRefreshing(false);
  }, [fetchPolls]);

  const handleSelect = (id: string) => {
    if (mode === 'select') {
      router.navigate({
        pathname: '/admin/(tabs)/comunicados',
        params: { selectedPollId: id },
      });
    }
    router.back();
  };

  const renderItem = ({ item }: { item: Poll }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelect(item.id)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.pollStatus}>
          {new Date(item.expires_at) > new Date() ? '🟢 Ativa' : '🔴 Expirada'}
        </Text>
      </View>
      <Text style={styles.cardContent}>{item.description}</Text>
      <View style={styles.optionsContainer}>
        <Text style={styles.optionsTitle}>Opções e resultados</Text>
        {item.poll_options.map((option, index) => (
          <View key={option.id} style={styles.optionRow}>
            <Text style={styles.optionText}>
              {index + 1}. {option.option_text}
            </Text>
            <View style={styles.optionMeta}>
              <Text style={styles.optionVotes}>
                {option.votes_count} votos ({option.percentage}%)
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${option.percentage}%` }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>🏢 {item.building?.name ?? 'Sem prédio'}</Text>
        <Text style={styles.cardFooterText}>
          Expira: {new Date(item.expires_at).toLocaleString('pt-BR')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.centerText}>Carregando enquetes...</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPolls}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={polls}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Text style={styles.centerText}>Nenhuma enquete encontrada.</Text>
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
          <Text style={styles.headerTitle}>📊 Enquetes</Text>
          {mode === 'select' ? (
            <Text style={styles.headerSubtitle}>Toque em uma enquete para selecionar</Text>
          ) : (
            <Text style={styles.headerSubtitle}>Acompanhe todas as enquetes criadas</Text>
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  pollStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardContent: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 12,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  optionRow: {
    marginBottom: 10,
  },
  optionText: {
    fontSize: 15,
    color: '#111827',
  },
  optionMeta: {
    marginTop: 4,
  },
  optionVotes: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#34d399',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
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
