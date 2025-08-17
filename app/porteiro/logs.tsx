import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Container } from '~/components/Container';
import { supabase } from '~/utils/supabase';

interface VisitorLog {
  id: string;
  visitor_name: string;
  document: string;
  apartment_id: string;
  action: 'entrada' | 'saida' | 'negado';
  authorized_by?: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
  apartments?: {
    number: string;
  };
}

interface DeliveryLog {
  id: string;
  recipient_name: string;
  apartment_id: string;
  sender: string;
  description?: string;
  status: 'recebida' | 'entregue';
  received_by?: string;
  delivered_by?: string;
  delivered_at?: string;
  created_at: string;
  apartments?: {
    number: string;
  };
}

type LogEntry = {
  id: string;
  type: 'visitor' | 'delivery';
  title: string;
  subtitle: string;
  status: string;
  time: string;
  icon: string;
  color: string;
  photo_url?: string;
  details: string[];
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'visitor' | 'delivery'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    fetchLogs();
  }, [filter, timeFilter]);

  const fetchLogs = async () => {
    try {
      const promises = [];
      
      // Buscar logs de visitantes se necessário
      if (filter === 'all' || filter === 'visitor') {
        let visitorQuery = supabase
          .from('visitor_logs')
          .select(`
            *,
            apartments!inner(number)
          `)
          .order('created_at', { ascending: false });

        // Aplicar filtro de tempo
        if (timeFilter !== 'all') {
          const now = new Date();
          let startDate: Date;
          
          switch (timeFilter) {
            case 'today':
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              break;
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            default:
              startDate = new Date(0);
          }
          
          visitorQuery = visitorQuery.gte('created_at', startDate.toISOString());
        }

        promises.push(visitorQuery);
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      // Buscar logs de encomendas se necessário
      if (filter === 'all' || filter === 'delivery') {
        let deliveryQuery = supabase
          .from('deliveries')
          .select(`
            *,
            apartments!inner(number)
          `)
          .order('created_at', { ascending: false });

        // Aplicar filtro de tempo
        if (timeFilter !== 'all') {
          const now = new Date();
          let startDate: Date;
          
          switch (timeFilter) {
            case 'today':
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              break;
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            default:
              startDate = new Date(0);
          }
          
          deliveryQuery = deliveryQuery.gte('created_at', startDate.toISOString());
        }

        promises.push(deliveryQuery);
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      const [visitorResult, deliveryResult] = await Promise.all(promises);

      if (visitorResult.error) throw visitorResult.error;
      if (deliveryResult.error) throw deliveryResult.error;

      // Processar logs de visitantes
      const visitorLogs: LogEntry[] = (visitorResult.data || []).map((log: VisitorLog) => {
        const getVisitorStatus = (action: string) => {
          switch (action) {
            case 'entrada': return { status: 'Entrada autorizada', icon: '✅', color: '#4CAF50' };
            case 'saida': return { status: 'Saída registrada', icon: '🚪', color: '#2196F3' };
            case 'negado': return { status: 'Acesso negado', icon: '❌', color: '#F44336' };
            default: return { status: 'Pendente', icon: '⏳', color: '#FF9800' };
          }
        };

        const statusInfo = getVisitorStatus(log.action);
        
        return {
          id: log.id,
          type: 'visitor',
          title: log.visitor_name,
          subtitle: `Apto ${log.apartments?.number || 'N/A'}`,
          status: statusInfo.status,
          time: formatDate(log.created_at),
          icon: statusInfo.icon,
          color: statusInfo.color,
          photo_url: log.photo_url,
          details: [
            `Documento: ${log.document}`,
            `Autorizado por: ${log.authorized_by || 'N/A'}`,
            ...(log.notes ? [`Observações: ${log.notes}`] : [])
          ]
        };
      });

      // Processar logs de encomendas
      const deliveryLogs: LogEntry[] = (deliveryResult.data || []).map((delivery: DeliveryLog) => {
        const isDelivered = delivery.status === 'entregue';
        
        return {
          id: delivery.id,
          type: 'delivery',
          title: `Encomenda - ${delivery.recipient_name}`,
          subtitle: `Apto ${delivery.apartments?.number || 'N/A'} • ${delivery.sender}`,
          status: isDelivered ? 'Entregue' : 'Recebida',
          time: formatDate(isDelivered && delivery.delivered_at ? delivery.delivered_at : delivery.created_at),
          icon: isDelivered ? '✅' : '📦',
          color: isDelivered ? '#4CAF50' : '#FF9800',
          details: [
            `Remetente: ${delivery.sender}`,
            ...(delivery.description ? [`Descrição: ${delivery.description}`] : []),
            `Recebida por: ${delivery.received_by || 'N/A'}`,
            ...(isDelivered ? [`Entregue por: ${delivery.delivered_by || 'N/A'}`] : [])
          ]
        };
      });

      // Combinar e ordenar todos os logs por data
      const allLogs = [...visitorLogs, ...deliveryLogs]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setLogs(allLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} min atrás`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getFilterCount = (filterType: string) => {
    if (filterType === 'all') return logs.length;
    return logs.filter(log => log.type === filterType).length;
  };

  const LogCard = ({ log }: { log: LogEntry }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <TouchableOpacity 
        style={styles.logCard}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.logHeader}>
          <View style={styles.logIcon}>
            <Text style={[styles.iconText, { color: log.color }]}>{log.icon}</Text>
          </View>
          
          <View style={styles.logInfo}>
            <Text style={styles.logTitle}>{log.title}</Text>
            <Text style={styles.logSubtitle}>{log.subtitle}</Text>
            <View style={styles.logMeta}>
              <Text style={[styles.logStatus, { color: log.color }]}>{log.status}</Text>
              <Text style={styles.logTime}>{log.time}</Text>
            </View>
          </View>

          {log.photo_url && (
            <View style={styles.photoContainer}>
              <Image source={{ uri: log.photo_url }} style={styles.logPhoto} />
            </View>
          )}
        </View>

        {expanded && (
          <View style={styles.logDetails}>
            {log.details.map((detail, index) => (
              <Text key={index} style={styles.detailText}>• {detail}</Text>
            ))}
          </View>
        )}

        <View style={styles.expandIndicator}>
          <Text style={styles.expandText}>
            {expanded ? '▲ Menos detalhes' : '▼ Mais detalhes'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📋 Histórico de Atividades</Text>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'all', label: 'Todas', icon: '📋' },
                { key: 'visitor', label: 'Visitantes', icon: '👥' },
                { key: 'delivery', label: 'Encomendas', icon: '📦' }
              ].map((filterOption) => (
                <TouchableOpacity
                  key={filterOption.key}
                  style={[
                    styles.filterButton,
                    filter === filterOption.key && styles.filterButtonActive
                  ]}
                  onPress={() => setFilter(filterOption.key as any)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filter === filterOption.key && styles.filterButtonTextActive
                  ]}>
                    {filterOption.icon} {filterOption.label}
                  </Text>
                  <Text style={[
                    styles.filterCount,
                    filter === filterOption.key && styles.filterCountActive
                  ]}>
                    {getFilterCount(filterOption.key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.timeFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'today', label: 'Hoje' },
                { key: 'week', label: 'Semana' },
                { key: 'month', label: 'Mês' },
                { key: 'all', label: 'Tudo' }
              ].map((timeOption) => (
                <TouchableOpacity
                  key={timeOption.key}
                  style={[
                    styles.timeFilterButton,
                    timeFilter === timeOption.key && styles.timeFilterButtonActive
                  ]}
                  onPress={() => setTimeFilter(timeOption.key as any)}
                >
                  <Text style={[
                    styles.timeFilterButtonText,
                    timeFilter === timeOption.key && styles.timeFilterButtonTextActive
                  ]}>
                    {timeOption.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView style={styles.logsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando histórico...</Text>
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Nenhuma atividade encontrada</Text>
              <Text style={styles.emptySubtext}>
                Não há registros para o período e filtros selecionados
              </Text>
            </View>
          ) : (
            logs.map((log) => (
              <LogCard key={`${log.type}-${log.id}`} log={log} />
            ))
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
    backgroundColor: '#2196F3',
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
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  timeFilters: {
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
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
  timeFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
  },
  timeFilterButtonActive: {
    backgroundColor: '#2196F3',
  },
  timeFilterButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  timeFilterButtonTextActive: {
    color: '#fff',
  },
  logsList: {
    flex: 1,
    paddingHorizontal: 20,
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
  logCard: {
    backgroundColor: '#fff',
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  logInfo: {
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  logSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  logMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logTime: {
    fontSize: 12,
    color: '#999',
  },
  photoContainer: {
    marginLeft: 8,
  },
  logPhoto: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  logDetails: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  expandIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  expandText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
});