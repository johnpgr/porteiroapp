import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Container } from '~/components/Container';
import { supabase } from '~/utils/supabase';

interface LogEntry {
  id: string;
  visitor_name: string;
  document: string;
  apartment_number: string;
  action: 'entrada' | 'saida' | 'negado';
  authorized_by?: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
}

export default function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'entrada' | 'saida' | 'negado'>('all');

  useEffect(() => {
    fetchLogs();
  }, [filter, fetchLogs]);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('visitor_logs')
        .select(
          `
          *,
          apartments!inner(number)
        `
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('action', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedLogs =
        data?.map((log) => ({
          ...log,
          apartment_number: log.apartments?.number || 'N/A',
        })) || [];

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'entrada':
        return '#4CAF50';
      case 'saida':
        return '#2196F3';
      case 'negado':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'entrada':
        return '✅';
      case 'saida':
        return '🚪';
      case 'negado':
        return '❌';
      default:
        return '📝';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getFilterCount = (action: string) => {
    if (action === 'all') return logs.length;
    return logs.filter((log) => log.action === action).length;
  };

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📊 Logs do Sistema</Text>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'all', label: 'Todos', icon: '📋' },
                { key: 'entrada', label: 'Entradas', icon: '✅' },
                { key: 'saida', label: 'Saídas', icon: '🚪' },
                { key: 'negado', label: 'Negados', icon: '❌' },
              ].map((filterOption) => (
                <TouchableOpacity
                  key={filterOption.key}
                  style={[
                    styles.filterButton,
                    filter === filterOption.key && styles.filterButtonActive,
                  ]}
                  onPress={() => setFilter(filterOption.key as any)}>
                  <Text
                    style={[
                      styles.filterButtonText,
                      filter === filterOption.key && styles.filterButtonTextActive,
                    ]}>
                    {filterOption.icon} {filterOption.label}
                  </Text>
                  <Text
                    style={[
                      styles.filterCount,
                      filter === filterOption.key && styles.filterCountActive,
                    ]}>
                    {getFilterCount(filterOption.key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView
          style={styles.logsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando logs...</Text>
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>Nenhum log encontrado</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all'
                  ? 'Ainda não há atividades registradas'
                  : `Nenhuma atividade do tipo "${filter}" encontrada`}
              </Text>
            </View>
          ) : (
            logs.map((log) => {
              const { date, time } = formatDate(log.created_at);
              return (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View style={styles.logAction}>
                      <Text style={styles.actionIcon}>{getActionIcon(log.action)}</Text>
                      <Text style={[styles.actionText, { color: getActionColor(log.action) }]}>
                        {log.action.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.logTime}>
                      <Text style={styles.timeText}>{time}</Text>
                      <Text style={styles.dateText}>{date}</Text>
                    </View>
                  </View>

                  <View style={styles.logContent}>
                    <View style={styles.visitorInfo}>
                      <Text style={styles.visitorName}>👤 {log.visitor_name}</Text>
                      <Text style={styles.visitorDocument}>📄 {log.document}</Text>
                      <Text style={styles.apartmentInfo}>
                        🏠 Apartamento {log.apartment_number}
                      </Text>
                    </View>

                    {log.authorized_by && (
                      <View style={styles.authInfo}>
                        <Text style={styles.authLabel}>Autorizado por:</Text>
                        <Text style={styles.authName}>{log.authorized_by}</Text>
                      </View>
                    )}

                    {log.notes && (
                      <View style={styles.notesContainer}>
                        <Text style={styles.notesLabel}>📝 Observações:</Text>
                        <Text style={styles.notesText}>{log.notes}</Text>
                      </View>
                    )}

                    {log.photo_url && (
                      <View style={styles.photoIndicator}>
                        <Text style={styles.photoText}>📷 Foto anexada</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#9C27B0',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  filters: {
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    minWidth: 80,
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  filterCountActive: {
    color: '#fff',
  },
  logsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  logTime: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  logContent: {
    padding: 15,
  },
  visitorInfo: {
    marginBottom: 10,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorDocument: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  apartmentInfo: {
    fontSize: 14,
    color: '#666',
  },
  authInfo: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  authLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  authName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  notesContainer: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  notesLabel: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#856404',
  },
  photoIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoText: {
    fontSize: 12,
    color: '#1976d2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
