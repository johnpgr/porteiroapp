import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '~/hooks/useAuth';
import { usePendingNotifications } from '~/hooks/usePendingNotifications';
import { NotificationCard } from '~/components/NotificationCard';
import { useFirstLogin } from '~/hooks/useFirstLogin';
import { supabase } from '~/utils/supabase';
import { IconSymbol } from '~/components/ui/IconSymbol';

interface VisitorHistory {
  id: string;
  visitor_name: string;
  purpose: string;
  log_time: string;
  resident_response_at?: string;
  notification_status: 'approved' | 'pending' | 'denied' | 'rejected';
  visitor_document?: string;
  visitor_phone?: string;
  delivery_destination?: string;
  building_name?: string;
  apartment_number?: string;
  approved_by_name?: string;
}

export default function MoradorInicioTab() {
  const { user } = useAuth();
  const { isFirstLogin, checkFirstLoginStatus } = useFirstLogin();

  // Notifications
  const {
    notifications: pendingNotifications,
    loading: loadingNotifications,
    error: notificationsError,
    respondToNotification,
  } = usePendingNotifications();

  // Visitor history
  const [visitorsHistory, setVisitorsHistory] = useState<VisitorHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [userApartmentId, setUserApartmentId] = useState<string | null>(null);

  const fetchVisitorsHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingHistory(true);
      setHistoryError(null);

      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (apartmentError) {
        console.error('Erro ao buscar apartamento do usuário:', apartmentError.message);
        throw new Error('Erro ao buscar apartamento do usuário: ' + apartmentError.message);
      }

      if (!apartmentData?.apartment_id) {
        setVisitorsHistory([]);
        setHistoryError(
          'Nenhum apartamento vinculado à sua conta. Solicite ao síndico/administrador para vincular seu apartamento.'
        );
        setUserApartmentId(null);
        return;
      }

      setUserApartmentId(apartmentData.apartment_id);

      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitor_logs')
        .select(
          `
          id,
          log_time,
          resident_response_at,
          resident_response_by,
          tipo_log,
          purpose,
          notification_status,
          delivery_destination,
          apartment_id,
          visitors (
            id,
            name,
            document,
            phone
          ),
          apartments (
            number,
            buildings (
              name
            )
          )
        `
        )
        .eq('apartment_id', apartmentData.apartment_id)
        .in('notification_status', ['approved', 'rejected'])
        .order('resident_response_at', { ascending: false })
        .order('log_time', { ascending: false })
        .limit(20);

      if (visitorsError) {
        console.error('Erro ao buscar histórico de visitantes:', visitorsError.message);
        throw new Error('Erro ao buscar histórico de visitantes: ' + visitorsError.message);
      }

      const approverIds = (visitorsData || [])
        .map((l: any) => l.resident_response_by)
        .filter((id: any) => typeof id === 'string') as string[];
      const uniqueApproverIds: string[] = [...new Set(approverIds)];

      let approverNames: Record<string, string> = {};
      if (uniqueApproverIds.length > 0) {
        const { data: approversData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueApproverIds);

        if (approversData) {
          approverNames = (approversData as any[]).reduce(
            (acc: Record<string, string>, profile: any) => {
              const pid = typeof profile.id === 'string' ? profile.id : '';
              if (pid) acc[pid] = (profile.full_name as string) || '';
              return acc;
            },
            {} as Record<string, string>
          );
        }
      }

      const mapped: VisitorHistory[] = (visitorsData || []).map((log: any) => ({
        id: log.id,
        visitor_name: log.visitors?.name || (log.purpose?.includes('entrega') ? 'Entregador' : ''),
        purpose: log.purpose || 'Não informado',
        log_time: log.log_time,
        resident_response_at: log.resident_response_at || undefined,
        notification_status:
          (log.notification_status as VisitorHistory['notification_status']) || 'pending',
        delivery_destination: log.delivery_destination || undefined,
        building_name: (log.apartments?.buildings?.name as string) || undefined,
        apartment_number: (log.apartments?.number as string) || undefined,
        approved_by_name: log.resident_response_by
          ? approverNames[log.resident_response_by] || 'Usuário não encontrado'
          : undefined,
      }));

      setVisitorsHistory(mapped);
    } catch (error: any) {
      console.error('Erro ao carregar histórico de visitantes:', error?.message || error);
      setHistoryError(
        'Erro ao carregar histórico de visitantes: ' + (error?.message || 'Erro desconhecido')
      );
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchVisitorsHistory();
      checkFirstLoginStatus();
    }
  }, [user?.id, fetchVisitorsHistory, checkFirstLoginStatus]);

  useEffect(() => {
    if (!user?.id || !userApartmentId) return;

    const subscription = supabase
      .channel('visitor_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `apartment_id=eq.${userApartmentId}`,
        },
        () => fetchVisitorsHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id, userApartmentId, fetchVisitorsHistory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
      return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'checkmark.circle.fill';
      case 'pending':
        return 'hourglass';
      case 'denied':
      case 'rejected':
        return 'exclamationmark.circle.fill';
      default:
        return 'questionmark.circle.fill';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Autorizada';
      case 'pending':
        return 'Pendente';
      case 'denied':
        return 'Negada';
      case 'rejected':
        return 'Rejeitada';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <IconSymbol name="envelope.fill" color="#333" size={18} />
            <Text style={styles.sectionTitle}>Notificações Pendentes</Text>
          </View>

          {loadingNotifications && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingText}>Carregando notificações...</Text>
            </View>
          )}

          {notificationsError && (
            <View style={styles.errorContainer}>
              <View style={styles.errorTextContainer}>
                <IconSymbol name="exclamationmark.circle.fill" color="#d32f2f" size={16} />
                <Text style={styles.errorText}>{notificationsError}</Text>
              </View>
            </View>
          )}

          {!loadingNotifications && !notificationsError && pendingNotifications.length === 0 && (
            <View style={styles.emptyContainer}>
              <IconSymbol name="envelope" color="#666" size={24} />
              <Text style={styles.emptyText}>Nenhuma notificação pendente</Text>
            </View>
          )}

          {!loadingNotifications &&
            !notificationsError &&
            pendingNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRespond={respondToNotification}
              />
            ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <IconSymbol name="list.bullet.rectangle" color="#333" size={18} />
              <Text style={styles.sectionTitle}>Histórico de Visitantes</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={fetchVisitorsHistory}
              disabled={loadingHistory}>
              <Ionicons name="refresh" size={20} color={loadingHistory ? '#ccc' : '#4CAF50'} />
            </TouchableOpacity>
          </View>

          {loadingHistory && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingText}>Carregando histórico...</Text>
            </View>
          )}

          {historyError && (
            <View style={styles.errorContainer}>
              <View style={styles.errorTextContainer}>
                <IconSymbol name="exclamationmark.circle.fill" color="#d32f2f" size={16} />
                <Text style={styles.errorText}>{historyError}</Text>
              </View>
              <TouchableOpacity style={styles.retryButton} onPress={fetchVisitorsHistory}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loadingHistory && !historyError && visitorsHistory.length === 0 && (
            <View style={styles.emptyContainer}>
              <IconSymbol name="envelope" color="#666" size={24} />
              <Text style={styles.emptyText}>Nenhum visitante registrado ainda</Text>
            </View>
          )}

          {!loadingHistory &&
            !historyError &&
            visitorsHistory.map((visitor) => (
              <View
                key={visitor.id}
                style={[
                  styles.historyCard,
                  visitor.purpose?.includes('entrega') && styles.deliveryHistoryCard,
                ]}>
                <Text style={styles.historyTitle}>{visitor.visitor_name}</Text>
                <Text style={styles.historyDetails}>
                  {visitor.purpose} • {formatDate(visitor.resident_response_at || visitor.log_time)}
                </Text>
                {(visitor.building_name || visitor.apartment_number) && (
                  <View style={styles.buildingApartmentInfoContainer}>
                    <IconSymbol name="building.2.fill" color="#4CAF50" size={14} />
                    <Text style={styles.buildingApartmentInfo}>
                      {visitor.building_name || 'Prédio'} - Apt {visitor.apartment_number || 'N/A'}
                    </Text>
                  </View>
                )}
                {visitor.approved_by_name && (
                  <View style={styles.approvedByInfoContainer}>
                    <IconSymbol name="person.fill" color="#2196F3" size={14} />
                    <Text style={styles.approvedByInfo}>
                      Aprovado por: {visitor.approved_by_name}
                    </Text>
                  </View>
                )}
                {visitor.purpose?.includes('entrega') && visitor.delivery_destination && (
                  <View
                    style={[
                      styles.deliveryDestinationContainer,
                      visitor.delivery_destination === 'portaria'
                        ? styles.porterDestination
                        : styles.elevatorDestination,
                    ]}>
                    <IconSymbol
                      name="shippingbox.fill"
                      color={visitor.delivery_destination === 'portaria' ? '#1976d2' : '#7b1fa2'}
                      size={16}
                    />
                    <Text
                      style={[
                        styles.deliveryDestination,
                        visitor.delivery_destination === 'portaria'
                          ? styles.porterDestinationText
                          : styles.elevatorDestinationText,
                      ]}>
                      {visitor.delivery_destination === 'portaria'
                        ? 'Deixada na portaria'
                        : 'Enviada pelo elevador'}
                    </Text>
                  </View>
                )}
                <View style={styles.historyStatusContainer}>
                  <IconSymbol
                    name={getStatusIcon(visitor.notification_status)}
                    color={
                      visitor.notification_status === 'approved'
                        ? '#4CAF50'
                        : visitor.notification_status === 'pending'
                          ? '#FF9800'
                          : '#f44336'
                    }
                    size={16}
                  />
                  <Text style={styles.historyStatus}>
                    {getStatusText(visitor.notification_status)}
                  </Text>
                </View>
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  section: { marginBottom: 10 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 15,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 10,
  },
  loadingText: { marginLeft: 10, fontSize: 12, color: '#666' },
  errorContainer: {
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  errorTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  errorText: { fontSize: 12, color: '#d32f2f', textAlign: 'center', flex: 1 },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  retryButtonText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  emptyText: { fontSize: 12, color: '#666', textAlign: 'center' },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  historyDetails: { fontSize: 12, color: '#666', marginBottom: 4 },
  historyStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  historyStatus: { fontSize: 12, color: '#4CAF50', fontWeight: 'bold' },
  deliveryHistoryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    backgroundColor: '#f8fbff',
  },
  deliveryDestinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    justifyContent: 'center',
  },
  deliveryDestination: {
    fontSize: 12,
    fontWeight: '600',
  },
  porterDestination: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  porterDestinationText: {
    color: '#1976d2',
  },
  elevatorDestination: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1,
    borderColor: '#ce93d8',
  },
  elevatorDestinationText: {
    color: '#7b1fa2',
  },
  buildingApartmentInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  buildingApartmentInfo: { fontSize: 12, color: '#4CAF50', fontWeight: '500' },
  approvedByInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  approvedByInfo: { fontSize: 12, color: '#2196F3', fontStyle: 'italic' },
  refreshButton: { padding: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
});
