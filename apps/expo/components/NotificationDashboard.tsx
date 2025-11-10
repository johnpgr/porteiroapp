import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../utils/supabaseUnified';
import { Bell, Users, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react-native';

interface NotificationStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  activeTokens: number;
}

interface NotificationLog {
  id: string;
  notification_id: string;
  user_id: string;
  status: string;
  error_message?: string;
  sent_at: string;
  notification: {
    title: string;
    message: string;
    type: string;
  };
  user: {
    name: string;
    apartment_number: string;
  };
}

export default function NotificationDashboard() {
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    activeTokens: 0
  });
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = setupRealtimeSubscription();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadDashboardData, setupRealtimeSubscription]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadLogs()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = async () => {
    // Carregar estatísticas de notificações
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('status');

    if (notificationsError) {
      console.error('Erro ao carregar notificações:', notificationsError);
      return;
    }

    // Carregar tokens ativos
    const { data: tokens, error: tokensError } = await supabase
      .from('user_notification_tokens')
      .select('id')
      .eq('is_active', true);

    if (tokensError) {
      console.error('Erro ao carregar tokens:', tokensError);
      return;
    }

    const total = notifications?.length || 0;
    const pending = notifications?.filter(n => n.status === 'pending').length || 0;
    const sent = notifications?.filter(n => n.status === 'sent').length || 0;
    const failed = notifications?.filter(n => n.status === 'failed').length || 0;
    const activeTokens = tokens?.length || 0;

    setStats({ total, pending, sent, failed, activeTokens });
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('notification_logs')
      .select(`
        id,
        notification_id,
        user_id,
        status,
        error_message,
        sent_at,
        notifications!inner (
          title,
          message,
          type
        ),
        profiles!inner (
          full_name,
          apartment_residents (
            apartments (
              number
            )
          )
        )
      `)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao carregar logs:', error);
      return;
    }

    const formattedLogs = data?.map(log => ({
      id: log.id,
      notification_id: log.notification_id,
      user_id: log.user_id,
      status: log.status,
      error_message: log.error_message,
      sent_at: log.sent_at,
      notification: {
        title: log.notifications.title,
        message: log.notifications.message,
        type: log.notifications.type
      },
      user: {
        name: log.profiles.full_name,
        apartment_number: (log.profiles.apartment_residents as any)?.[0]?.apartments?.number || 'N/A'
      }
    })) || [];

    setLogs(formattedLogs);
  };

  const setupRealtimeSubscription = useCallback(() => {
    const subscription = supabase
      .channel('notification_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_logs'
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const clearOldLogs = async () => {
    Alert.alert(
      'Limpar Logs Antigos',
      'Deseja remover logs de notificações com mais de 30 dias?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

              const { error } = await supabase
                .from('notification_logs')
                .delete()
                .lt('sent_at', thirtyDaysAgo.toISOString());

              if (error) {
                throw error;
              }

              Alert.alert('Sucesso', 'Logs antigos removidos com sucesso');
              loadLogs();
            } catch (error) {
              console.error('Erro ao limpar logs:', error);
              Alert.alert('Erro', 'Falha ao limpar logs antigos');
            }
          }
        }
      ]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle size={16} color="#10B981" />;
      case 'failed':
        return <AlertCircle size={16} color="#EF4444" />;
      case 'pending':
        return <Clock size={16} color="#F59E0B" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      case 'pending':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (selectedFilter === 'all') return true;
    return log.status === selectedFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard de Notificações</Text>
        <TouchableOpacity onPress={clearOldLogs} style={styles.clearButton}>
          <Trash2 size={20} color="#EF4444" />
          <Text style={styles.clearButtonText}>Limpar Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Bell size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        
        <View style={styles.statCard}>
          <Clock size={24} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendentes</Text>
        </View>
        
        <View style={styles.statCard}>
          <CheckCircle size={24} color="#10B981" />
          <Text style={styles.statNumber}>{stats.sent}</Text>
          <Text style={styles.statLabel}>Enviadas</Text>
        </View>
        
        <View style={styles.statCard}>
          <AlertCircle size={24} color="#EF4444" />
          <Text style={styles.statNumber}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Falharam</Text>
        </View>
        
        <View style={styles.statCard}>
          <Users size={24} color="#8B5CF6" />
          <Text style={styles.statNumber}>{stats.activeTokens}</Text>
          <Text style={styles.statLabel}>Dispositivos</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        {['all', 'pending', 'sent', 'failed'].map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter(filter as any)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === filter && styles.filterButtonTextActive
            ]}>
              {filter === 'all' ? 'Todos' : 
               filter === 'pending' ? 'Pendentes' :
               filter === 'sent' ? 'Enviadas' : 'Falharam'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de Logs */}
      <View style={styles.logsContainer}>
        <Text style={styles.sectionTitle}>Logs Recentes</Text>
        {filteredLogs.map(log => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={styles.logStatus}>
                {getStatusIcon(log.status)}
                <Text style={[styles.logStatusText, { color: getStatusColor(log.status) }]}>
                  {log.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.logDate}>{formatDate(log.sent_at)}</Text>
            </View>
            
            <Text style={styles.logTitle}>{log.notification.title}</Text>
            <Text style={styles.logMessage}>{log.notification.message}</Text>
            
            <View style={styles.logFooter}>
              <Text style={styles.logUser}>
                {log.user.name} - Apt {log.user.apartment_number}
              </Text>
              <Text style={styles.logType}>{log.notification.type}</Text>
            </View>
            
            {log.error_message && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{log.error_message}</Text>
              </View>
            )}
          </View>
        ))}
        
        {filteredLogs.length === 0 && (
          <View style={styles.emptyState}>
            <Bell size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>Nenhum log encontrado</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827'
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  clearButtonText: {
    marginLeft: 4,
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500'
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6B7280',
    marginTop: 50
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '18%',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center'
  },
  filtersContainer: {
    flexDirection: 'row',
    marginBottom: 16
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6'
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280'
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500'
  },
  logsContainer: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  logStatus: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logStatusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600'
  },
  logDate: {
    fontSize: 12,
    color: '#6B7280'
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4
  },
  logMessage: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logUser: {
    fontSize: 12,
    color: '#6B7280'
  },
  logType: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444'
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12
  }
});