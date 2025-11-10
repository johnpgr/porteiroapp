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
import { useFocusEffect } from '@react-navigation/native';

import ProtectedRoute from '~/components/ProtectedRoute';
import { useAuth } from '~/hooks/useAuth';
import { useUserApartment } from '~/hooks/useUserApartment';
import { supabase } from '~/utils/supabase';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';

type IntercomCallStatus = 'calling' | 'answered' | 'ended' | 'missed';
type StatusFilter = 'all' | IntercomCallStatus;
type DateRangeFilter = 'today' | '7days' | '30days' | 'all';

interface CallParticipant {
  resident_id: string | null;
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
  doorman_name: string | null;
  building_name: string | null;
  apartment_number: string | null;
  participants: CallParticipant[];
  answeredByCurrentUser: boolean;
}

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Atendidas', value: 'answered' },
  { label: 'Perdidas', value: 'missed' },
  { label: 'Encerradas', value: 'ended' },
  { label: 'Chamando', value: 'calling' },
];

const DATE_RANGE_OPTIONS: Array<{ label: string; value: DateRangeFilter }> = [
  { label: 'Hoje', value: 'today' },
  { label: '7 dias', value: '7days' },
  { label: '30 dias', value: '30days' },
  { label: 'Todo período', value: 'all' },
];

const STATUS_META: Record<
  Exclude<StatusFilter, 'all'>,
  { label: string; icon: string; background: string; text: string; border: string }
> = {
  calling: { label: 'Chamando', icon: '📞', background: '#e8f1ff', text: '#1b6ef3', border: '#c7dcff' },
  answered: { label: 'Atendida', icon: '✅', background: '#e5f8ef', text: '#1e8a4f', border: '#b6ebcf' },
  missed: { label: 'Perdida', icon: '❌', background: '#fdeaea', text: '#c32f2f', border: '#f5bcbc' },
  ended: { label: 'Encerrada', icon: '🔚', background: '#f0f0f3', text: '#6c6f7d', border: '#d1d2d8' },
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
    fontSize: 18,
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
    fontSize: 14,
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
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  chipText: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
  },
  applyButtonText: {
    fontSize: 14,
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

export default function CallsTab() {
  const { user } = useAuth();
  const { apartment, loading: apartmentLoading } = useUserApartment();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('7days');
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [noApartmentMessage, setNoApartmentMessage] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState<boolean>(false);

  const isFetchingRef = useRef(false);
  const offsetRef = useRef(0);
  const filterSheetRef = useRef<BottomSheetModalRef>(null);

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

      const answeredByCurrentUser = participants.some(
        (participant) =>
          participant &&
          typeof participant.resident_id === 'string' &&
          participant.resident_id === user?.id &&
          ['answered', 'connected'].includes((participant.status || '').toLowerCase())
      );

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

      return {
        id: call.id,
        status: normalizedStatus,
        started_at: call.started_at,
        answered_at: call.answered_at ?? null,
        ended_at: call.ended_at ?? null,
        duration_seconds: durationSeconds ?? null,
        doorman_name: call.doorman?.full_name ?? null,
        building_name: call.apartment?.building?.name ?? null,
        apartment_number: call.apartment?.number ?? null,
        participants,
        answeredByCurrentUser,
      };
    },
    [user?.id]
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
        // Wait for apartment data to load if still loading
        if (apartmentLoading) {
          return;
        }

        if (!apartment?.id) {
          setCalls([]);
          setHasMore(false);
          setNoApartmentMessage(
            'Nenhum apartamento vinculado à sua conta. Solicite ao síndico ou administrador para concluir o cadastro.'
          );
          return;
        }

        setNoApartmentMessage(null);

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
            doorman_id,
            apartment_id,
            doorman:profiles!intercom_calls_doorman_id_fkey(full_name),
            apartment:apartments(number, building:buildings(name)),
            call_participants(resident_id, status, joined_at, left_at)
          `
          )
          .eq('apartment_id', apartment.id)
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
    [apartment, apartmentLoading, dateRangeFilter, statusFilter, transformCall, user?.id]
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

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusMeta.background,
                  borderColor: statusMeta.border,
                },
              ]}
            >
              <Text style={[styles.statusBadgeIcon, { color: statusMeta.text }]}>{statusMeta.icon}</Text>
              <Text style={[styles.statusBadgeText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
            </View>
            <Text style={styles.dateText}>{formatCallDate(item.started_at)}</Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>👮 Porteiro: </Text>
              <Text style={styles.infoValue}>{item.doorman_name || 'Não informado'}</Text>
            </Text>

            {(item.building_name || item.apartment_number) && (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>🏢 Local: </Text>
                <Text style={styles.infoValue}>
                  {item.building_name ? `${item.building_name} • ` : ''}
                  Apt {item.apartment_number ?? 'N/A'}
                </Text>
              </Text>
            )}

            {durationLabel && (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>⏱️ Duração: </Text>
                <Text style={styles.infoValue}>{durationLabel}</Text>
              </Text>
            )}

            {item.answeredByCurrentUser && (
              <View style={styles.answeredPill}>
                <Text style={styles.answeredPillText}>Você atendeu esta chamada</Text>
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
          <View style={styles.headerRow}>
            <Text style={styles.title}>Histórico de Chamadas</Text>
            <TouchableOpacity style={styles.filterButton} onPress={openFilterSheet}>
              <Text style={styles.filterButtonText}>Filtros</Text>
            </TouchableOpacity>
          </View>

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
        </View>
      );
    },
    [dateRangeFilter, openFilterSheet, statusFilter]
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color="#4CAF50" />
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
          <ActivityIndicator color="#4CAF50" />
          <Text style={styles.emptyText}>Carregando histórico...</Text>
        </View>
      );
    }

    if (noApartmentMessage) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{noApartmentMessage}</Text>
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
        <Text style={styles.emptyEmoji}>📭</Text>
        <Text style={styles.emptyTitle}>Nenhuma chamada encontrada</Text>
        <Text style={styles.emptySubtitle}>
          Ajuste os filtros ou puxe para atualizar. Se nenhuma chamada aparecer, pode ser que ainda não houve
          registros para o seu apartamento neste período.
        </Text>
      </View>
    );
  }, [error, fetchCallHistory, loading, noApartmentMessage]);

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <>
        <View style={styles.container}>
          <FlatList
            data={calls}
            keyExtractor={(item) => item.id}
            renderItem={renderCallItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4CAF50" />
            }
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            ListEmptyComponent={listEmpty}
            onEndReachedThreshold={0.4}
            onEndReached={handleLoadMore}
          />
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
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  listHeader: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#e7f6ec',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2f7d44',
  },
  filterSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  filterSummaryPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    minWidth: 145,
  },
  filterSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7a7f87',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterSummaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusBadgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  cardBody: {
    gap: 6,
  },
  infoRow: {
    fontSize: 15,
    color: '#444444',
  },
  infoLabel: {
    fontWeight: '600',
  },
  infoValue: {
    fontWeight: '500',
  },
  answeredPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#e7f6ec',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  answeredPillText: {
    color: '#2f7d44',
    fontWeight: '600',
    fontSize: 12,
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
    fontSize: 13,
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
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyEmoji: {
    fontSize: 34,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#444444',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6d6d6d',
    textAlign: 'center',
    lineHeight: 20,
  },
});
