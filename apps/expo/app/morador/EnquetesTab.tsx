import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';

interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  votes_count: number;
}

interface Poll {
  id: string;
  title: string;
  description: string;
  building_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  options: PollOption[];
  total_votes: number;
  user_voted: boolean;
  user_vote_option_id?: string;
}

interface UserApartment {
  building_id: string;
}

export default function EnquetesTab() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userApartment, setUserApartment] = useState<UserApartment | null>(null);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  // Buscar apartamento do usuário
  const fetchUserApartment = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar apartamento:', error);
        setError('Erro ao carregar dados do apartamento');
        return;
      }

      if (!data) {
        setUserApartment(null);
        setError('Nenhum apartamento vinculado à sua conta.');
        return;
      }

      // Acessar building_id através do objeto apartments
      const apartmentData = {
        building_id: data.apartments.building_id
      };
      setUserApartment(apartmentData);
    } catch (err) {
      console.error('Erro ao buscar apartamento:', err);
      setError('Erro ao carregar dados do apartamento');
    }
  };

  // Buscar enquetes ativas
  const fetchPolls = async () => {
    if (!userApartment?.building_id || !user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar enquetes ativas do prédio
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select(`
          id,
          title,
          question,
          description,
          building_id,
          created_by,
          created_at,
          expires_at
        `)
        .eq('building_id', userApartment.building_id)
        .order('created_at', { ascending: false });

      if (pollsError) {
        console.error('Erro ao buscar enquetes:', pollsError);
        setError('Erro ao carregar enquetes');
        return;
      }

      if (!pollsData || pollsData.length === 0) {
        setPolls([]);
        return;
      }

      // Para cada enquete, buscar opções e votos
      const pollsWithDetails = await Promise.all(
        pollsData.map(async (poll) => {
          // Buscar opções da enquete
          const { data: optionsData, error: optionsError } = await supabase
            .from('poll_options')
            .select('id, poll_id, option_text')
            .eq('poll_id', poll.id)
            .order('id');

          if (optionsError) {
            console.error('Erro ao buscar opções:', optionsError);
            return null;
          }

          // Buscar votos para cada opção
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

          // Verificar se o usuário já votou nesta enquete
          const { data: userVoteData, error: userVoteError } = await supabase
            .from('poll_votes')
            .select('poll_option_id')
            .eq('user_id', user.id)
            .in('poll_option_id', optionsWithVotes.map(opt => opt.id))
            .maybeSingle();

          const userVoted = !!userVoteData;
          const totalVotes = optionsWithVotes.reduce((sum, opt) => sum + opt.votes_count, 0);

          // Verificar se a enquete ainda está ativa (não expirou)
          const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;

          return {
            ...poll,
            is_active: !isExpired, // Apenas baseado na data de expiração
            options: optionsWithVotes,
            total_votes: totalVotes,
            user_voted: !!userVoted,
            user_vote_option_id: userVoted ? userVoteData.poll_option_id : undefined
          };
        })
      );

      const validPolls = pollsWithDetails.filter(poll => poll !== null) as Poll[];
      setPolls(validPolls);
    } catch (err) {
      console.error('Erro ao buscar enquetes:', err);
      setError('Erro ao carregar enquetes');
    } finally {
      setLoading(false);
    }
  };

  // Votar em uma opção
  const handleVote = async (pollId: string, optionId: string) => {
    if (!user?.id || votingPollId) return;

    try {
      setVotingPollId(pollId);

      // Verificar se o usuário já votou nesta enquete
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;

      if (poll.user_voted) {
        Alert.alert('Aviso', 'Você já votou nesta enquete.');
        return;
      }

      if (!poll.is_active) {
        Alert.alert('Aviso', 'Esta enquete não está mais ativa.');
        return;
      }

      // Registrar o voto
      const { error: voteError } = await supabase
        .from('poll_votes')
        .insert({
          user_id: user.id,
          poll_option_id: optionId,
          created_at: new Date().toISOString()
        });

      if (voteError) {
        console.error('Erro ao votar:', voteError);
        Alert.alert('Erro', 'Não foi possível registrar seu voto. Tente novamente.');
        return;
      }

      Alert.alert('Sucesso', 'Seu voto foi registrado com sucesso!');
      
      // Atualizar as enquetes para refletir o novo voto
      await fetchPolls();
    } catch (err) {
      console.error('Erro ao votar:', err);
      Alert.alert('Erro', 'Não foi possível registrar seu voto. Tente novamente.');
    } finally {
      setVotingPollId(null);
    }
  };

  // Configurar subscrição em tempo real
  useEffect(() => {
    if (!userApartment?.building_id) return;

    // Subscrever a mudanças nas enquetes
    const pollsSubscription = supabase
      .channel('polls_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
          filter: `building_id=eq.${userApartment.building_id}`
        },
        () => {
          fetchPolls();
        }
      )
      .subscribe();

    // Subscrever a mudanças nos votos
    const votesSubscription = supabase
      .channel('votes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes'
        },
        () => {
          fetchPolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pollsSubscription);
      supabase.removeChannel(votesSubscription);
    };
  }, [userApartment?.building_id]);

  // Carregar dados iniciais
  useEffect(() => {
    fetchUserApartment();
  }, [user?.id]);

  useEffect(() => {
    if (userApartment) {
      fetchPolls();
    }
  }, [userApartment]);

  // Renderizar opção de voto
  const renderPollOption = (poll: Poll, option: PollOption) => {
    const percentage = poll.total_votes > 0 ? (option.votes_count / poll.total_votes) * 100 : 0;
    const isUserVote = poll.user_vote_option_id === option.id;
    const canVote = !poll.user_voted && poll.is_active;
    const isVoting = votingPollId === poll.id;

    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.pollOption,
          isUserVote && styles.userVoteOption,
          !canVote && styles.disabledOption
        ]}
        onPress={() => canVote && !isVoting ? handleVote(poll.id, option.id) : null}
        disabled={!canVote || isVoting}
      >
        <View style={styles.optionContent}>
          <View style={styles.optionHeader}>
            <Text style={[styles.optionText, isUserVote && styles.userVoteText]}>
              {option.option_text}
            </Text>
            {isUserVote && (
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            )}
          </View>
          
          {poll.user_voted && (
            <View style={styles.voteResults}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${percentage}%` },
                    isUserVote && styles.userVoteProgress
                  ]} 
                />
              </View>
              <Text style={styles.voteCount}>
                {option.votes_count} voto{option.votes_count !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
              </Text>
            </View>
          )}
        </View>
        
        {isVoting && (
          <ActivityIndicator size="small" color="#3B82F6" style={styles.votingIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  // Renderizar enquete
  const renderPoll = (poll: Poll) => {
    const isExpired = new Date(poll.expires_at) < new Date();
    const expiresDate = new Date(poll.expires_at);
    
    return (
      <View key={poll.id} style={styles.pollCard}>
        <View style={styles.pollHeader}>
          <Text style={styles.pollTitle}>{poll.title}</Text>
          <View style={[
            styles.statusBadge,
            poll.is_active && !isExpired ? styles.activeBadge : styles.inactiveBadge
          ]}>
            <Text style={[
              styles.statusText,
              poll.is_active && !isExpired ? styles.activeStatusText : styles.inactiveStatusText
            ]}>
              {poll.is_active && !isExpired ? 'Ativa' : 'Encerrada'}
            </Text>
          </View>
        </View>
        
        {poll.description && (
          <Text style={styles.pollDescription}>{poll.description}</Text>
        )}
        
        <Text style={styles.pollExpiry}>
          {isExpired ? 'Encerrada em' : 'Encerra em'}: {expiresDate.toLocaleDateString('pt-BR')} às {expiresDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        
        <View style={styles.pollOptions}>
          {poll.options.map(option => renderPollOption(poll, option))}
        </View>
        
        {poll.user_voted && (
          <View style={styles.voteInfo}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.voteInfoText}>
              Você já votou nesta enquete. Total de votos: {poll.total_votes}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Carregando enquetes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setError(null);
          fetchUserApartment();
        }}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (polls.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="bar-chart" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>Nenhuma enquete ativa no momento</Text>
        <Text style={styles.emptySubtext}>
          As enquetes criadas pelo administrador aparecerão aqui
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Enquetes</Text>
        <Text style={styles.headerSubtitle}>
          {polls.length} enquete{polls.length !== 1 ? 's' : ''} ativa{polls.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <View style={styles.pollsList}>
        {polls.map(renderPoll)}
      </View>
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  pollsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pollCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pollHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 8,
  },
  pollTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  activeStatusText: {
    color: '#065F46',
  },
  inactiveStatusText: {
    color: '#991B1B',
  },
  pollDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  pollExpiry: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  pollOptions: {
    gap: 8,
  },
  pollOption: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  userVoteOption: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  disabledOption: {
    opacity: 0.7,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  userVoteText: {
    color: '#065F46',
    fontWeight: '500' as const,
  },
  voteResults: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  userVoteProgress: {
    backgroundColor: '#10B981',
  },
  voteCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  votingIndicator: {
    marginLeft: 8,
  },
  voteInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 12,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
  },
  voteInfoText: {
    fontSize: 12,
    color: '#065F46',
    marginLeft: 6,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center' as const,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '500' as const,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
};
