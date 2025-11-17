import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuth } from '~/hooks/useAuth';
import { isRegularUser } from '~/types/auth.types';
import { supabase } from '~/utils/supabase';
import { PorteiroDashboardProvider, usePorteiroDashboard } from '~/providers/PorteiroDashboardProvider';
import { flattenStyles } from '~/utils/styles';
import { IconSymbol } from '~/components/ui/IconSymbol';

type Role = 'morador' | 'porteiro';

interface CommunicationItem {
  id: string;
  title: string;
  content: string;
  type: string | null;
  priority: string | null;
  created_at: string;
  authorName?: string;
}

const iconByType: Record<string, { name: string; color: string }> = {
  manutencao: { name: 'wrench.fill', color: '#FF9800' },
  maintenance: { name: 'wrench.fill', color: '#FF9800' },
  reuniao: { name: 'person.2.fill', color: '#2196F3' },
  meeting: { name: 'person.2.fill', color: '#2196F3' },
  obra: { name: 'building.2.fill', color: '#795548' },
  informativo: { name: 'info.circle.fill', color: '#2196F3' },
  notice: { name: 'megaphone.fill', color: '#2196F3' },
  event: { name: 'party.popper.fill', color: '#9C27B0' },
  warning: { name: 'exclamationmark.triangle.fill', color: '#FF9800' },
  info: { name: 'info.circle.fill', color: '#2196F3' },
  emergency: { name: 'exclamationmark.triangle.fill', color: '#f44336' },
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
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function CommunicationCard({ item }: { item: CommunicationItem }) {
  const iconConfig = item.type ? iconByType[item.type] ?? iconByType.notice : iconByType.notice;
  const color = item.priority ? colorByPriority[item.priority] ?? '#2196F3' : '#2196F3';

  return (
    <View style={flattenStyles([styles.avisoCard, { borderLeftColor: color }])}>
      <View style={styles.avisoHeader}>
        <View style={styles.avisoIconContainer}>
          <IconSymbol name={iconConfig.name as any} color={iconConfig.color} size={28} />
        </View>
        <View style={styles.avisoInfo}>
          <Text style={styles.avisoTitle}>{item.title}</Text>
          {!!item.authorName && <Text style={styles.avisoAuthor}>Por {item.authorName || 'Administração'}</Text>}
          <Text style={styles.avisoDateTime}>{formatDateTime(item.created_at)}</Text>
        </View>
      </View>
      <Text style={styles.avisoDescription}>{item.content}</Text>
    </View>
  );
}

function CommunicationsList({ data, loading, onRefresh, emptyHint = 'Não há comunicados disponíveis no momento' }: { data: CommunicationItem[]; loading: boolean; onRefresh?: () => void | Promise<void>; emptyHint?: string }) {
  if (loading && data.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando comunicados...</Text>
      </View>
    );
  }
  if (!loading && data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="envelope" color="#999" size={48} />
        <Text style={styles.emptyTitle}>Nenhum comunicado</Text>
        <Text style={styles.emptySubtitle}>{emptyHint}</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.contentContainer}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!loading} onRefresh={onRefresh} /> : undefined}
      renderItem={({ item }) => <CommunicationCard item={item} />}
    />
  );
}

function PorteiroView() {
  const { communications, loadingCommunications, refreshCommunications } = usePorteiroDashboard();
  useEffect(() => {
    refreshCommunications();
  }, [refreshCommunications]);
  const handleBack = () => router.back();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <IconSymbol name="chevron.left" color="#fff" size={30} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <View style={styles.titleContainer}>
            <IconSymbol name="megaphone.fill" color="#fff" size={24} />
            <Text style={styles.title}>Avisos</Text>
          </View>
          <Text style={styles.subtitle}>Comunicados do condomínio</Text>
        </View>
      </View>
      <CommunicationsList data={communications} loading={loadingCommunications} onRefresh={refreshCommunications} />
    </View>
  );
}

interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  votes_count: number;
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  building_id: string | null;
  created_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  options: PollOption[];
  total_votes: number;
  user_voted: boolean;
  user_vote_option_id?: string;
}

interface UserApartment {
  building_id: string;
}

function MoradorView() {
  const { user } = useAuth();
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [pollsError, setPollsError] = useState<string | null>(null);
  const [userApartment, setUserApartment] = useState<UserApartment | null>(null);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const communicationsChannelRef = useRef<any>(null);
  const pollsChannelRef = useRef<any>(null);
  const votesChannelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  const formatDate = useCallback((dateString: string) => formatDateTime(dateString), []);
  const getTypeIcon = useCallback((type: string) => iconByType[type] ?? iconByType.notice, []);

  useEffect(() => {
    if (user?.id && isRegularUser(user) && user.building_id) {
      fetchCommunications();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchUserApartment();
    }
  }, [user?.id, userApartment?.building_id]);

  useEffect(() => {
    if (userApartment) {
      fetchPolls();
    }
  }, [userApartment]);

  const fetchUserApartment = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Erro ao buscar apartamento:', error);
        setPollsError('Erro ao carregar dados do apartamento');
        return;
      }
      if (!data) {
        setPollsError('Nenhum apartamento vinculado à sua conta.');
        return;
      }
      const apartmentData = { building_id: (data as any).apartments.building_id };
      setUserApartment(apartmentData);
    } catch (err) {
      console.error('Erro ao buscar apartamento:', err);
      setPollsError('Erro ao carregar dados do apartamento');
    }
  }, [user?.id]);

  const fetchCommunications = useCallback(async () => {
    if (!user?.id || !isRegularUser(user) || !user.building_id) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('communications')
        .select('id,title,content,type,priority,created_at')
        .eq('building_id', user.building_id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Erro ao buscar comunicados:', error);
      } else {
        setCommunications((data || []) as CommunicationItem[]);
      }
    } catch (error) {
      console.error('Erro ao buscar comunicados:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchPolls = useCallback(async () => {
    if (!user?.id || !userApartment?.building_id) return;
    try {
      setPollsLoading(true);
      setPollsError(null);
      setRealtimeError(null);
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('id,title,description,created_at,expires_at')
        .eq('building_id', userApartment.building_id)
        .order('created_at', { ascending: false });
      if (pollsError) {
        console.error('Erro ao buscar enquetes:', pollsError);
        setPollsError('Erro ao carregar enquetes');
        return;
      }
      if (!pollsData || pollsData.length === 0) {
        setPolls([]);
        return;
      }
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const filteredPolls = pollsData.filter((poll) => {
        if (!poll.expires_at) return true;
        const expiresDate = new Date(poll.expires_at);
        return expiresDate >= thirtyDaysAgo;
      });
      const pollsWithDetails = await Promise.all(
        filteredPolls.map(async (poll: any) => {
          const { data: optionsData, error: optionsError } = await supabase
            .from('poll_options')
            .select('id, poll_id, option_text')
            .eq('poll_id', poll.id)
            .order('id');
          if (optionsError) {
            console.error('Erro ao buscar opções:', optionsError);
            return null;
          }
          const optionsWithVotes = await Promise.all(
            (optionsData || []).map(async (option) => {
              const { count, error: countError } = await supabase
                .from('poll_votes')
                .select('*', { count: 'exact', head: true })
                .eq('poll_option_id', option.id);
              if (countError) {
                console.error('Erro ao contar votos:', countError);
                return { ...option, votes_count: 0 };
              }
              return { ...option, votes_count: count || 0 };
            })
          );
          const { data: userVoteData } = await supabase
            .from('poll_votes')
            .select('poll_option_id')
            .eq('user_id', user.id)
            .in('poll_option_id', optionsWithVotes.map((opt) => opt.id))
            .maybeSingle();
          const userVoted = !!userVoteData;
          const totalVotes = optionsWithVotes.reduce((sum, opt) => sum + opt.votes_count, 0);
          const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
          return {
            ...poll,
            is_active: !isExpired,
            options: optionsWithVotes,
            total_votes: totalVotes,
            user_voted: !!userVoted,
            user_vote_option_id: userVoted ? (userVoteData as any).poll_option_id : undefined,
          } as Poll;
        })
      );
      const validPolls = pollsWithDetails.filter((p) => p !== null) as Poll[];
      setPolls(validPolls);
    } catch (err) {
      console.error('Erro ao buscar enquetes:', err);
      setPollsError('Erro ao carregar enquetes');
    } finally {
      setPollsLoading(false);
    }
  }, [user?.id, userApartment?.building_id]);

  const cleanupSubscriptions = useCallback(() => {
    if (communicationsChannelRef.current) {
      supabase.removeChannel(communicationsChannelRef.current);
      communicationsChannelRef.current = null;
    }
    if (pollsChannelRef.current) {
      supabase.removeChannel(pollsChannelRef.current);
      pollsChannelRef.current = null;
    }
    if (votesChannelRef.current) {
      supabase.removeChannel(votesChannelRef.current);
      votesChannelRef.current = null;
    }
    isSubscribedRef.current = false;
  }, []);

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!user?.id || !isRegularUser(user) || !user.building_id || isSubscribedRef.current) {
      return;
    }
    try {
      setRealtimeError(null);
      communicationsChannelRef.current = supabase
        .channel('communications_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `building_id=eq.${user.building_id}` }, () => fetchCommunications())
        .subscribe();
      pollsChannelRef.current = supabase
        .channel('polls_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
        .subscribe();
      votesChannelRef.current = supabase
        .channel('votes_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchPolls())
        .subscribe();
      isSubscribedRef.current = true;
    } catch (error) {
      console.error('Erro ao configurar subscrições realtime:', error);
      setRealtimeError('Erro ao configurar atualizações em tempo real');
    }
  }, [user?.id, fetchCommunications, fetchPolls]);

  useEffect(() => {
    if (user?.id && isRegularUser(user) && user.building_id) {
      setupRealtimeSubscriptions();
    }
    return cleanupSubscriptions;
  }, [user?.id, setupRealtimeSubscriptions, cleanupSubscriptions]);

  const handleVote = useCallback(
    async (pollId: string, optionId: string) => {
      if (!user?.id || votingPollId) return;
      try {
        setVotingPollId(pollId);
        const poll = polls.find((p) => p.id === pollId);
        if (!poll) return;
        if (poll.user_voted) return;
        const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
        if (!poll.is_active || isExpired) return;
        const { error: voteError } = await supabase
          .from('poll_votes')
          .insert({ user_id: user.id, poll_option_id: optionId, created_at: new Date().toISOString() });
        if (voteError) {
          console.error('Erro ao votar:', voteError);
          return;
        }
        await fetchPolls();
      } finally {
        setVotingPollId(null);
      }
    },
    [user?.id, votingPollId, polls, fetchPolls]
  );

  const renderPollOption = (poll: Poll, option: PollOption) => {
    const percentage = poll.total_votes > 0 ? (option.votes_count / poll.total_votes) * 100 : 0;
    const isUserVote = poll.user_vote_option_id === option.id;
    const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
    const canVote = !poll.user_voted && !isExpired;
    const isVoting = votingPollId === poll.id;
    return (
      <TouchableOpacity
        key={option.id}
        style={[styles.pollOption, isUserVote && styles.userVoteOption, !canVote && styles.disabledOption]}
        onPress={() => (canVote && !isVoting ? handleVote(poll.id, option.id) : undefined)}
        disabled={!canVote || isVoting}
      >
        <View style={styles.optionContent}>
          <View style={styles.optionHeader}>
            <Text style={[styles.optionText, isUserVote && styles.userVoteText, !canVote && styles.disabledOptionText]}>
              {option.option_text}
            </Text>
            {isUserVote && <IconSymbol name="checkmark.circle.fill" color="#10B981" size={20} />}
          </View>
          {poll.user_voted && (
            <View style={styles.voteResults}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${percentage}%` }, isUserVote && styles.userVoteProgress]} />
              </View>
              <Text style={styles.voteCount}>
                {option.votes_count} voto{option.votes_count !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
              </Text>
            </View>
          )}
        </View>
        {isVoting && <ActivityIndicator size="small" color="#3B82F6" style={styles.votingIndicator} />}
      </TouchableOpacity>
    );
  };

  const renderPoll = (poll: Poll) => {
    const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
    const expiresDate = poll.expires_at ? new Date(poll.expires_at) : new Date();
    return (
      <View key={poll.id} style={styles.pollCard}>
        <View style={styles.pollHeader}>
          <Text style={styles.pollTitle}>{poll.title}</Text>
          <View style={[styles.statusBadge, poll.is_active && !isExpired ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, poll.is_active && !isExpired ? styles.activeStatusText : styles.inactiveStatusText]}>
              {poll.is_active && !isExpired ? 'Ativa' : 'Encerrada'}
            </Text>
          </View>
        </View>
        {!!poll.description && <Text style={styles.pollDescription}>{poll.description}</Text>}
        {!!poll.created_at && (
          <Text style={styles.pollExpiry}>
            Criada em: {new Date(poll.created_at).toLocaleDateString('pt-BR')} às {new Date(poll.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        {!!poll.expires_at && (
          <Text style={styles.pollExpiry}>
            {isExpired ? 'Expirou em' : 'Expira em'}: {expiresDate.toLocaleDateString('pt-BR')} às {expiresDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        <View style={styles.pollOptions}>{poll.options.map((opt) => renderPollOption(poll, opt))}</View>
        {poll.user_voted && (
          <View style={styles.voteInfo}>
            <IconSymbol name="checkmark.circle.fill" color="#10B981" size={16} />
            <Text style={styles.voteInfoText}>Você já votou nesta enquete. Total de votos: {poll.total_votes}</Text>
          </View>
        )}
      </View>
    );
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" color="#fff" size={30} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <View style={styles.titleContainer}>
            <IconSymbol name="megaphone.fill" color="#fff" size={24} />
            <Text style={styles.title}>Avisos</Text>
          </View>
          <Text style={styles.subtitle}>Comunicados do condomínio</Text>
        </View>
      </View>
      <ScrollView style={styles.content}>
        {realtimeError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{realtimeError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setRealtimeError(null);
                setupRealtimeSubscriptions();
              }}
            >
              <Text style={styles.retryButtonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <IconSymbol name="megaphone.fill" color="#333" size={20} />
            <Text style={styles.sectionTitle}>Avisos do Condomínio</Text>
          </View>
          {communications.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="envelope" color="#999" size={48} />
              <Text style={styles.emptyStateTitle}>Nenhum comunicado disponível</Text>
              <Text style={styles.emptyStateDescription}>Não há comunicados para o seu prédio no momento.</Text>
            </View>
          ) : (
            communications.map((communication) => {
              const iconConfig = getTypeIcon(communication.type || '');
              return (
                <View key={communication.id} style={styles.noticeCard}>
                  <View style={styles.noticeTitleContainer}>
                    <IconSymbol name={iconConfig.name as any} color={iconConfig.color} size={20} />
                    <Text style={styles.noticeTitle}>{communication.title}</Text>
                  </View>
                  <Text style={styles.noticeDescription}>{communication.content}</Text>
                  <Text style={styles.noticeTime}>Publicado em {formatDate(communication.created_at)}</Text>
                </View>
              );
            })
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <IconSymbol name="checkmark.square.fill" color="#333" size={20} />
            <Text style={styles.sectionTitle}>Enquetes Ativas</Text>
          </View>
          {pollsLoading ? (
            <View style={styles.pollsLoadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Carregando enquetes...</Text>
            </View>
          ) : pollsError ? (
            <View style={styles.pollsErrorContainer}>
              <IconSymbol name="exclamationmark.circle.fill" color="#EF4444" size={48} />
              <Text style={styles.errorText}>{pollsError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setPollsError(null);
                  fetchUserApartment();
                }}
              >
                <Text style={styles.retryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          ) : polls.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="checkmark.square.fill" color="#999" size={48} />
              <Text style={styles.emptyStateTitle}>Nenhuma enquete ativa</Text>
              <Text style={styles.emptyStateDescription}>As enquetes criadas pelo administrador aparecerão aqui.</Text>
            </View>
          ) : (
            polls.map(renderPoll)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function AvisosScreen({ role }: { role: Role }) {
  if (role === 'porteiro') return <PorteiroView />;
  return <MoradorView />;
}

export default function AvisosRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  const role = user?.user_type === 'porteiro' ? 'porteiro' : 'morador';
  if (role === 'porteiro') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PorteiroDashboardProvider>
          <AvisosScreen role={role} />
        </PorteiroDashboardProvider>
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AvisosScreen role={role} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
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
    marginBottom: 10,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  titleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 5 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#fff', textAlign: 'center', opacity: 0.9 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  // FlatList padding to align with Emergency screen and add space from header
  contentContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  loadingContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  loadingText: { fontSize: 14, color: '#666' },
  emptyContainer: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  avisoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderLeftWidth: 6, width: '100%' },
  avisoHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  avisoIconContainer: { marginRight: 16, marginTop: 2, justifyContent: 'center' },
  avisoInfo: { flex: 1 },
  avisoTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  avisoAuthor: { fontSize: 12, color: '#2196F3', fontWeight: 'bold', marginBottom: 2 },
  avisoDateTime: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  avisoDescription: { fontSize: 14, color: '#555', lineHeight: 20, textAlign: 'justify' },
  section: { marginBottom: 10 },
  errorContainer: { backgroundColor: '#ffebee', borderColor: '#f44336', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#d32f2f', fontSize: 14, flex: 1, marginRight: 12 },
  retryButton: { backgroundColor: '#f44336', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  retryButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 16 },
  emptyStateDescription: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  noticeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  noticeTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
  noticeDescription: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 8 },
  noticeTime: { fontSize: 12, color: '#999' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 20, marginVertical: 10 },
  pollsLoadingContainer: { alignItems: 'center', paddingVertical: 20 },
  pollsErrorContainer: { alignItems: 'center', paddingVertical: 20 },
  pollCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16 },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  pollTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activeBadge: { backgroundColor: '#D1FAE5' },
  inactiveBadge: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 12, fontWeight: '500' },
  activeStatusText: { color: '#065F46' },
  inactiveStatusText: { color: '#991B1B' },
  pollDescription: { fontSize: 14, color: '#6B7280', marginBottom: 8, lineHeight: 20 },
  pollExpiry: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  pollOptions: { gap: 8 },
  pollOption: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' },
  userVoteOption: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  disabledOption: { opacity: 0.5, backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
  disabledOptionText: { color: '#9CA3AF' },
  optionContent: { flex: 1 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optionText: { fontSize: 14, color: '#374151', flex: 1 },
  userVoteText: { color: '#065F46', fontWeight: '500' },
  voteResults: { marginTop: 8 },
  progressBar: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 4 },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  userVoteProgress: { backgroundColor: '#10B981' },
  voteCount: { fontSize: 12, color: '#6B7280' },
  votingIndicator: { marginLeft: 8 },
  voteInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 8, backgroundColor: '#F0FDF4', borderRadius: 6 },
  voteInfoText: { fontSize: 12, color: '#065F46', marginLeft: 6 },
});
