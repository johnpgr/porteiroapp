import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import BottomNav from '../../components/BottomNav';

interface LogEntry {
  id: string;
  type: 'visitor' | 'communication';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  icon: string;
  color: string;
}

export default function LogsScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'visitor' | 'communication'>('all');

  useEffect(() => {
    fetchLogs();
  }, [user, filter, fetchLogs]);

  const fetchLogs = useCallback(async () => {
    if (!user?.apartment_number) return;

    try {
      const logEntries: LogEntry[] = [];

      // Buscar logs de visitantes
      if (filter === 'all' || filter === 'visitor') {
        const { data: visitorLogs, error: visitorError } = await supabase
          .from('visitor_logs')
          .select(
            `
            *,
            visitors!inner(
              name,
              document,
              apartment_number
            )
          `
          )
          .eq('visitors.apartment_number', user.apartment_number)
          .order('timestamp', { ascending: false })
          .limit(50);

        if (visitorError) throw visitorError;

        visitorLogs?.forEach((log) => {
          const visitor = log.visitors as any;
          logEntries.push({
            id: `visitor_${log.id}`,
            type: 'visitor',
            title: `${visitor.name}`,
            description: getVisitorActionDescription(log.action, log.notes),
            timestamp: log.timestamp,
            status: log.action,
            icon: getVisitorActionIcon(log.action),
            color: getVisitorActionColor(log.action),
          });
        });
      }

      // Buscar comunicações
      if (filter === 'all' || filter === 'communication') {
        const { data: communications, error: commError } = await supabase
          .from('communications')
          .select('*')
          .or(
            `target_apartment.eq.${user.apartment_number},target_user_type.eq.morador,target_apartment.is.null`
          )
          .order('created_at', { ascending: false })
          .limit(50);

        if (commError) throw commError;

        communications?.forEach((comm) => {
          logEntries.push({
            id: `comm_${comm.id}`,
            type: 'communication',
            title: comm.title,
            description: comm.message,
            timestamp: comm.created_at,
            status: comm.type,
            icon: getCommunicationIcon(comm.type),
            color: getCommunicationColor(comm.priority),
          });
        });
      }

      // Ordenar por timestamp
      logEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setLogs(logEntries);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const getVisitorActionDescription = (action: string, notes?: string) => {
    const descriptions: { [key: string]: string } = {
      pending: 'Aguardando autorização',
      approved: 'Visita aprovada',
      denied: 'Visita negada',
      entered: 'Entrou no prédio',
      left: 'Saiu do prédio',
      preregistered: 'Pré-cadastrado',
    };
    return notes || descriptions[action] || action;
  };

  const getVisitorActionIcon = (action: string) => {
    const icons: { [key: string]: string } = {
      pending: 'time',
      approved: 'checkmark-circle',
      denied: 'close-circle',
      entered: 'enter',
      left: 'exit',
      preregistered: 'person-add',
    };
    return icons[action] || 'person';
  };

  const getVisitorActionColor = (action: string) => {
    const colors: { [key: string]: string } = {
      pending: '#FF9800',
      approved: '#4CAF50',
      denied: '#F44336',
      entered: '#2196F3',
      left: '#9E9E9E',
      preregistered: '#4CAF50',
    };
    return colors[action] || '#666';
  };

  const getCommunicationIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      general: 'information-circle',
      emergency: 'warning',
      maintenance: 'construct',
      event: 'calendar',
      visitor: 'person',
    };
    return icons[type] || 'mail';
  };

  const getCommunicationColor = (priority: string) => {
    const colors: { [key: string]: string } = {
      high: '#F44336',
      medium: '#FF9800',
      low: '#4CAF50',
    };
    return colors[priority] || '#2196F3';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Agora há pouco';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`;
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const filteredLogs = logs.filter((log) => filter === 'all' || log.type === filter);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'visitor' && styles.filterTabActive]}
          onPress={() => setFilter('visitor')}>
          <Text style={[styles.filterText, filter === 'visitor' && styles.filterTextActive]}>
            Visitantes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'communication' && styles.filterTabActive]}
          onPress={() => setFilter('communication')}>
          <Text style={[styles.filterText, filter === 'communication' && styles.filterTextActive]}>
            Comunicados
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logs List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando histórico...</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
            <Text style={styles.emptyText}>
              Não há atividades registradas para o filtro selecionado
            </Text>
          </View>
        ) : (
          <View style={styles.logsList}>
            {filteredLogs.map((log, index) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={[styles.logIcon, { backgroundColor: log.color }]}>
                    <Ionicons name={log.icon as any} size={20} color="#fff" />
                  </View>
                  <View style={styles.logContent}>
                    <Text style={styles.logTitle}>{log.title}</Text>
                    <Text style={styles.logDescription} numberOfLines={2}>
                      {log.description}
                    </Text>
                  </View>
                  <Text style={styles.logTime}>{formatTimestamp(log.timestamp)}</Text>
                </View>

                <View style={styles.logFooter}>
                  <View
                    style={[
                      styles.logType,
                      { backgroundColor: log.type === 'visitor' ? '#E3F2FD' : '#F3E5F5' },
                    ]}>
                    <Text
                      style={[
                        styles.logTypeText,
                        { color: log.type === 'visitor' ? '#1976D2' : '#7B1FA2' },
                      ]}>
                      {log.type === 'visitor' ? 'Visitante' : 'Comunicado'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <BottomNav activeTab="logs" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  logsList: {
    padding: 20,
    paddingTop: 0,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  logDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  logTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  logFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  logType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
