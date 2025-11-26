import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { FloatingCallButton } from '~/components/shared/FloatingCallButton';

type IntercomCallStatus = 'calling' | 'answered' | 'ended' | 'missed';
type StatusFilter = 'all' | IntercomCallStatus;
type DateRangeFilter = 'today' | '7days' | '30days' | 'all';
type CallDirection = 'incoming' | 'outgoing';

interface CallParticipant {
  participant_id: string | null;
  participant_type: string | null;
  status: string | null;
  joined_at: string | null;
  left_at: string | null;
}

interface CallHistoryItem {
  id: string;
  status: IntercomCallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  resident_name: string | null;
  building_name: string | null;
  apartment_number: string | null;
  participants: CallParticipant[];
  direction: CallDirection;
  initiator_type: string | null;
}

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Atendidas', value: 'answered' },
  { label: 'Perdidas', value: 'missed' },
  { label: 'Encerradas', value: 'ended' },
  { label: 'Chamando', value: 'calling' },
];

const DATE_RANGE_OPTIONS: { label: string; value: DateRangeFilter }[] = [
  { label: 'Hoje', value: 'today' },
  { label: '7 dias', value: '7days' },
  { label: '30 dias', value: '30days' },
  { label: 'Todo período', value: 'all' },
];

const STATUS_META: Record<
  Exclude<StatusFilter, 'all'>,
  { label: string; icon: 'phone.fill' | 'checkmark.circle.fill' | 'exclamationmark.circle.fill' | 'stop.circle.fill'; background: string; text: string; border: string }
> = {
  calling: { label: 'Chamando', icon: 'phone.fill', background: '#e8f1ff', text: '#1b6ef3', border: '#c7dcff' },
  answered: { label: 'Atendida', icon: 'checkmark.circle.fill', background: '#e5f8ef', text: '#1e8a4f', border: '#b6ebcf' },
  missed: { label: 'Perdida', icon: 'exclamationmark.circle.fill', background: '#fdeaea', text: '#c32f2f', border: '#f5bcbc' },
  ended: { label: 'Encerrada', icon: 'stop.circle.fill', background: '#f0f0f3', text: '#6c6f7d', border: '#d1d2d8' },
};

interface CallFiltersBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (status: StatusFilter, dateRange: DateRangeFilter) => void;
  bottomSheetRef: React.RefObject<BottomSheetModalRef | null>;
  statusFilter: StatusFilter;
  dateRangeFilter: DateRangeFilter;
}

const CallFiltersBottomSheet: React.FC<CallFiltersBottomSheetProps> = ({
  visible,
  onClose,
  onApply,
  bottomSheetRef,
  statusFilter,
  dateRangeFilter,
}) => {
  const [tempStatus, setTempStatus] = useState<StatusFilter>(statusFilter);
  const [tempDateRange, setTempDateRange] = useState<DateRangeFilter>(dateRangeFilter);

  useEffect(() => {
    if (visible) {
      setTempStatus(statusFilter);
      setTempDateRange(dateRangeFilter);
    }
  }, [dateRangeFilter, statusFilter, visible]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    onApply(tempStatus, tempDateRange);
    onClose();
  }, [onApply, onClose, tempDateRange, tempStatus]);

  return (
    <BottomSheetModal ref={bottomSheetRef} visible={visible} onClose={onClose} snapPoints={55}>
      <View style={filterSheetStyles.header}>
        <Text style={filterSheetStyles.title}>Filtros</Text>
      </View>

      <ScrollView style={filterSheetStyles.content} showsVerticalScrollIndicator={false}>
        <View style={filterSheetStyles.section}>
          <Text style={filterSheetStyles.sectionTitle}>Status</Text>
          <View style={filterSheetStyles.chipsContainer}>
            {STATUS_FILTER_OPTIONS.map((option) => {
              const isActive = tempStatus === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[filterSheetStyles.chip, isActive && filterSheetStyles.chipActive]}
                  onPress={() => setTempStatus(option.value)}
                >
                  <Text style={[filterSheetStyles.chipText, isActive && filterSheetStyles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={filterSheetStyles.section}>
          <Text style={filterSheetStyles.sectionTitle}>Período</Text>
          <View style={filterSheetStyles.chipsContainer}>
            {DATE_RANGE_OPTIONS.map((option) => {
              const isActive = tempDateRange === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[filterSheetStyles.chip, isActive && filterSheetStyles.chipActive]}
                  onPress={() => setTempDateRange(option.value)}
                >
                  <Text style={[filterSheetStyles.chipText, isActive && filterSheetStyles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={filterSheetStyles.footer}>
        <TouchableOpacity style={filterSheetStyles.cancelButton} onPress={handleCancel}>
          <Text style={filterSheetStyles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={filterSheetStyles.applyButton} onPress={handleApply}>
          <Text style={filterSheetStyles.applyButtonText}>Aplicar</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const filterSheetStyles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#1E88E5',
    borderColor: '#1E88E5',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E88E5',
  },
  applyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const resolveDateRangeStart = (range: DateRangeFilter): Date | null => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  switch (range) {
    case 'today':
      return base;
    case '7days': {
      const start = new Date(base);
      start.setDate(start.getDate() - 6);
      return start;
    }
    case '30days': {
      const start = new Date(base);
      start.setDate(start.getDate() - 29);
      return start;
    }
    default:
      return null;
  }
};

interface FetchOptions {
  reset?: boolean;
  manualRefresh?: boolean;
  status?: StatusFilter;
  dateRange?: DateRangeFilter;
}

export default function PorteiroCallsTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('7days');
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [filterSheetVisible, setFilterSheetVisible] = useState<boolean>(false);

  const isFetchingRef = useRef(false);
  const offsetRef = useRef(0);
  const filterSheetRef = useRef<BottomSheetModalRef>(null);

  const handleCallButtonPress = useCallback(() => {
    router.push('/porteiro/intercom');
  }, [router]);

  const openFilterSheet = useCallback(() => {
    setFilterSheetVisible(true);
  }, []);

  const handleFilterSheetClose = useCallback(() => {
    setFilterSheetVisible(false);
  }, []);

  const formatCallDate = useCallback((isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const isSameDay = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isSameDay) {
      return `Hoje às ${time}`;
    }
    if (isYesterday) {
      return `Ontem às ${time}`;
    }
    const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${dateLabel} às ${time}`;
  }, []);

  const formatDuration = useCallback((seconds: number | null | undefined) => {
    if (!seconds || seconds <= 0) {
      return null;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }, []);

  const transformCall = useCallback(
    (call: any): CallHistoryItem => {
      const participants: CallParticipant[] = Array.isArray(call.call_participants)
        ? call.call_participants
        : [];

      let durationSeconds: number | null =
        typeof call.duration_seconds === 'number' ? call.duration_seconds : null;

      if ((!durationSeconds || durationSeconds <= 0) && call.answered_at && call.ended_at) {
        const answeredAt = Date.parse(call.answered_at);
        const endedAt = Date.parse(call.ended_at);
        if (!Number.isNaN(answeredAt) && !Number.isNaN(endedAt) && endedAt > answeredAt) {
          durationSeconds = Math.round((endedAt - answeredAt) / 1000);
        }
      }

      const rawStatus =
        typeof call.status === 'string' ? (call.status as string).toLowerCase() : 'ended';
      const allowedStatuses: IntercomCallStatus[] = ['calling', 'answered', 'ended', 'missed'];
      const normalizedStatus: IntercomCallStatus = allowedStatuses.includes(
        rawStatus as IntercomCallStatus
      )
        ? (rawStatus as IntercomCallStatus)
        : 'ended';

      // Determine call direction from porteiro's perspective
      // If initiator_type is 'doorman' and initiator_id matches current user, it's outgoing (porteiro called resident)
      // If initiator_type is 'resident', it's incoming (resident called porteiro)
      const initiatorType = call.initiator_type || 'doorman';
      let direction: CallDirection = 'outgoing';
      
      if (initiatorType === 'resident') {
        // Resident initiated the call - for porteiro this is incoming
        direction = 'incoming';
      } else {
        // Doorman initiated the call - for porteiro this is outgoing
        direction = 'outgoing';
      }

      // Get resident name from participants if available
      let residentName: string | null = null;
      if (call.initiator_type === 'resident' && call.initiator_profile) {
        residentName = call.initiator_profile.full_name;
      } else if (participants.length > 0) {
        // Try to find a participant with profile info
        const participant = participants.find(p => p.participant_id);
        if (participant && (call as any).participant_profiles) {
          const profile = (call as any).participant_profiles.find(
            (p: any) => p.id === participant.participant_id
          );
          if (profile) {
            residentName = profile.full_name;
          }
        }
      }

      return {
        id: call.id,
        status: normalizedStatus,
        started_at: call.started_at,
        answered_at: call.answered_at ?? null,
        ended_at: call.ended_at ?? null,
        duration_seconds: durationSeconds ?? null,
        resident_name: residentName,
        building_name: call.apartment?.building?.name ?? null,
        apartment_number: call.apartment?.number ?? null,
        participants,
        direction,
        initiator_type: initiatorType,
      };
    },
    []
  );

  const fetchCallHistory = useCallback(
    async (options: FetchOptions = {}) => {
      const manualRefresh = options.manualRefresh ?? false;
      const reset = options.reset ?? manualRefresh;

      if (isFetchingRef.current) {
        return;
      }

      if (!user?.id) {
        setError('Usuário não autenticado.');
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      const statusToUse = options.status ?? statusFilter;
      const dateRangeToUse = options.dateRange ?? dateRangeFilter;
      const resolvedDateStart = resolveDateRangeStart(dateRangeToUse);

      isFetchingRef.current = true;
      setError(null);

      if (reset) {
        offsetRef.current = 0;
        setHasMore(true);
      }

      if (manualRefresh) {
        setRefreshing(true);
      } else if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        // For porteiro, we query calls where they are a participant
        // The call_participants table tracks all participants (initiators + callees)
        // Using !inner join with filter on participant_id = user.id
        
        let query = supabase
          .from('intercom_calls')
          .select(
            `
            id,
            status,
            started_at,
            answered_at,
            ended_at,
            duration_seconds,
            apartment_id,
            initiator_id,
            initiator_type,
            initiator_profile:profiles!intercom_calls_initiator_id_fkey(id, full_name),
            apartment:apartments(number, building:buildings(name)),
            call_participants!inner(participant_id, participant_type, status, joined_at, left_at)
          `
          )
          .eq('call_participants.participant_id', user.id)
          .order('started_at', { ascending: false })
          .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

        if (statusToUse !== 'all') {
          query = query.eq('status', statusToUse);
        }

        if (resolvedDateStart) {
          query = query.gte('started_at', resolvedDateStart.toISOString());
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        const fetchedCalls = (data ?? []).map(transformCall);

        setCalls((prevCalls) => {
          if (reset) {
            return fetchedCalls;
          }
          const merged = [...prevCalls, ...fetchedCalls];
          const unique = merged.reduce<CallHistoryItem[]>((acc, current) => {
            const exists = acc.find((item) => item.id === current.id);
            if (!exists) {
              acc.push(current);
            }
            return acc;
          }, []);
          return unique;
        });

        const receivedCount = fetchedCalls.length;
        offsetRef.current = reset ? receivedCount : offsetRef.current + receivedCount;
        setHasMore(receivedCount === PAGE_SIZE);
      } catch (fetchError: any) {
        console.error('Erro ao carregar histórico de chamadas:', fetchError);
        setError('Erro ao carregar histórico de chamadas. Tente novamente.');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [dateRangeFilter, statusFilter, transformCall, user?.id]
  );

  const handleApplyFilters = useCallback(
    (nextStatus: StatusFilter, nextDateRange: DateRangeFilter) => {
      const statusChanged = nextStatus !== statusFilter;
      const dateChanged = nextDateRange !== dateRangeFilter;

      setFilterSheetVisible(false);

      if (statusChanged) {
        setStatusFilter(nextStatus);
      }
      if (dateChanged) {
        setDateRangeFilter(nextDateRange);
      }

      if (statusChanged || dateChanged) {
        fetchCallHistory({ reset: true, status: nextStatus, dateRange: nextDateRange });
      } else {
        fetchCallHistory({ reset: true });
      }
    },
    [dateRangeFilter, fetchCallHistory, statusFilter]
  );

  useFocusEffect(
    useCallback(() => {
      fetchCallHistory({ reset: true });
    }, [fetchCallHistory])
  );

  const handleRefresh = useCallback(() => {
    fetchCallHistory({ manualRefresh: true });
  }, [fetchCallHistory]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading || refreshing || calls.length === 0) {
      return;
    }
    fetchCallHistory();
  }, [calls.length, fetchCallHistory, hasMore, loading, loadingMore, refreshing]);

  const renderCallItem = useCallback(
    ({ item }: { item: CallHistoryItem }) => {
      const statusMeta = STATUS_META[item.status];
      const durationLabel = formatDuration(item.duration_seconds);
      const isOutgoing = item.direction === 'outgoing';

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.directionBadge, isOutgoing ? styles.outgoingBadge : styles.incomingBadge]}>
                <IconSymbol 
                  name={isOutgoing ? 'phone.arrow.up.right' : 'phone.arrow.down.left'} 
                  color={isOutgoing ? '#1E88E5' : '#4CAF50'} 
                  size={12} 
                />
                <Text style={[styles.directionText, isOutgoing ? styles.outgoingText : styles.incomingText]}>
                  {isOutgoing ? 'Efetuada' : 'Recebida'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusMeta.background,
                    borderColor: statusMeta.border,
                  },
                ]}
              >
                <IconSymbol name={statusMeta.icon} color={statusMeta.text} size={14} />
                <Text style={[styles.statusBadgeText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
              </View>
            </View>
            <Text style={styles.dateText}>{formatCallDate(item.started_at)}</Text>
          </View>

          <View style={styles.cardBody}>
            {item.resident_name && (
              <View style={styles.infoRowContainer}>
                <IconSymbol name="person.fill" color="#666" size={14} />
                <Text style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Morador: </Text>
                  <Text style={styles.infoValue}>{item.resident_name}</Text>
                </Text>
              </View>
            )}

            {(item.building_name || item.apartment_number) && (
              <View style={styles.infoRowContainer}>
                <IconSymbol name="building.2.fill" color="#666" size={14} />
                <Text style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Local: </Text>
                  <Text style={styles.infoValue}>
                    {item.building_name ? `${item.building_name} • ` : ''}
                    Apt {item.apartment_number ?? 'N/A'}
                  </Text>
                </Text>
              </View>
            )}

            {durationLabel && (
              <View style={styles.infoRowContainer}>
                <IconSymbol name="clock.fill" color="#666" size={14} />
                <Text style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Duração: </Text>
                  <Text style={styles.infoValue}>{durationLabel}</Text>
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [formatCallDate, formatDuration]
  );

  const listHeader = useMemo(
    () => {
      const statusLabel =
        STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Todas';
      const dateLabel =
        DATE_RANGE_OPTIONS.find((option) => option.value === dateRangeFilter)?.label || 'Todo período';

      return (
        <View style={styles.listHeader}>
          <View style={styles.filterRow}>
            <View style={styles.filterSummary}>
              <View style={styles.filterSummaryPill}>
                <Text style={styles.filterSummaryLabel}>Status</Text>
                <Text style={styles.filterSummaryValue}>{statusLabel}</Text>
              </View>
              <View style={styles.filterSummaryPill}>
                <Text style={styles.filterSummaryLabel}>Período</Text>
                <Text style={styles.filterSummaryValue}>{dateLabel}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.filterButton} onPress={openFilterSheet}>
              <IconSymbol name="slider.horizontal.3" color="#1565C0" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [dateRangeFilter, openFilterSheet, statusFilter]
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color="#1E88E5" />
          <Text style={styles.footerLoadingText}>Carregando mais chamadas...</Text>
        </View>
      );
    }

    if (!hasMore && calls.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>Fim do histórico</Text>
        </View>
      );
    }

    return <View style={styles.footerSpacing} />;
  }, [calls.length, hasMore, loadingMore]);

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color="#1E88E5" />
          <Text style={styles.emptyText}>Carregando histórico...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchCallHistory({ reset: true })}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="envelope" color="#666" size={48} />
        <Text style={styles.emptyTitle}>Nenhuma chamada encontrada</Text>
        <Text style={styles.emptySubtitle}>
          Ajuste os filtros ou puxe para atualizar. Use o botão no canto inferior direito para iniciar uma nova chamada.
        </Text>
      </View>
    );
  }, [error, fetchCallHistory, loading]);

  return (
    <>
      <View style={styles.container}>
        {/* Styled Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📞 Chamadas</Text>
          <Text style={styles.headerSubtitle}>Histórico de chamadas do interfone</Text>
        </View>

        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          renderItem={renderCallItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1E88E5" />
          }
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmpty}
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
        />

        <FloatingCallButton onPress={handleCallButtonPress} color="#1E88E5" />
      </View>

      <CallFiltersBottomSheet
        bottomSheetRef={filterSheetRef}
        visible={filterSheetVisible}
        onClose={handleFilterSheetClose}
        onApply={handleApplyFilters}
        statusFilter={statusFilter}
        dateRangeFilter={dateRangeFilter}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E3F2FD',
    textAlign: 'center',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  listHeader: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  filterSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  filterSummaryPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    flex: 1,
  },
  filterSummaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7a7f87',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  incomingBadge: {
    backgroundColor: '#e5f8ef',
  },
  outgoingBadge: {
    backgroundColor: '#e8f4fd',
  },
  directionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  incomingText: {
    color: '#4CAF50',
  },
  outgoingText: {
    color: '#1E88E5',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  cardBody: {
    gap: 6,
  },
  infoRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoRow: {
    fontSize: 14,
    color: '#444444',
  },
  infoLabel: {
    fontWeight: '600',
  },
  infoValue: {
    fontWeight: '500',
  },
  footerLoading: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  footerLoadingText: {
    fontSize: 14,
    color: '#555555',
  },
  footerEnd: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerEndText: {
    fontSize: 12,
    color: '#777777',
    fontWeight: '500',
  },
  footerSpacing: {
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#1E88E5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444444',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6d6d6d',
    textAlign: 'center',
    lineHeight: 20,
  },
});
