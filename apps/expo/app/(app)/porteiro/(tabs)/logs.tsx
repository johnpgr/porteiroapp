import type { RealtimeChannel } from "@porteiroapp/supabase";
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Container } from '~/components/Container';
import { useAuth } from '~/hooks/useAuth';
import { useNotifications } from '~/hooks/useNotifications';
import { flattenStyles } from '~/utils/styles';
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

// Interface para logs de visitantes do histórico (index.tsx)
interface HistoricoVisitorLog {
  id: string;
  visitor_id: string | null;
  apartment_id: string;
  log_time: string;
  tipo_log: string;
  purpose?: string | null;
  notification_status: string | null;
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

export default function PorteiroLogsScreen() {
  const { user } = useAuth();
  const { realtimeNotifications, isRealtimeConnected } = useNotifications();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'visitor' | 'delivery' | 'historico'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  
  // Estados específicos para histórico de visitantes (transferidos do index.tsx)
  const [visitorLogs, setVisitorLogs] = useState<HistoricoVisitorLog[]>([]);
  const [loadingVisitorLogs, setLoadingVisitorLogs] = useState(false);
  
  // Estados para sistema de notificações em tempo real
  const [realtimeChannels, setRealtimeChannels] = useState<RealtimeChannel[]>([]);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // Função para enviar notificação push aos porteiros
  const notifyPorteiros = async (message: string, data: any) => {
    // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
    console.log('📱 Push notifications desativadas - log atualizado sem notificação:', message);
    return;
    
    // try {
    //   if (!buildingId) return;

    //   // Buscar todos os porteiros do prédio
    //   const { data: porteiros, error } = await supabase
    //     .from('profiles')
    //     .select('id, expo_push_token')
    //     .eq('user_type', 'porteiro')
    //     .eq('building_id', buildingId)
    //     .not('expo_push_token', 'is', null);

    //   if (error) {
    //     console.error('Erro ao buscar porteiros:', error);
    //     return;
    //   }

    //   // Enviar notificação para cada porteiro
    //   for (const porteiro of porteiros || []) {
    //     if (porteiro.expo_push_token) {
    //       await Notifications.scheduleNotificationAsync({
    //         content: {
    //           title: 'Atualização nos Logs',
    //           body: message,
    //           data: {
    //             ...data,
    //             building_id: buildingId,
    //             timestamp: new Date().toISOString()
    //           }
    //         },
    //         trigger: null
    //       });
    //     }
    //   }
    // } catch (error) {
    //   console.error('Erro ao enviar notificação aos porteiros:', error);
    // }
  };



  const fetchLogs = useCallback(async () => {
    if (!user) return;
    
    try {
      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('user_id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        return;
      }
      
      const promises = [];

      // Buscar logs de visitantes se necessário
      if (filter === 'all' || filter === 'visitor') {
        let visitorQuery = supabase
          .from('visitor_logs')
          .select(
            `
            *,
            apartments!inner(number),
            visitors(name, document, photo_url)
          `
          )
          .eq('building_id', profile.building_id)
          .order('log_time', { ascending: false });

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

          visitorQuery = visitorQuery.gte('log_time', startDate.toISOString());
        }

        promises.push(visitorQuery);
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      // Buscar logs de encomendas se necessário
      if (filter === 'all' || filter === 'delivery') {
        let deliveryQuery = supabase
          .from('deliveries')
          .select(
            `
            *,
            apartments!inner(number)
          `
          )
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
      const visitorLogs: LogEntry[] = (visitorResult.data || []).map((log: any) => {
        const getVisitorStatus = (tipoLog: string, notificationStatus: string) => {
          if (notificationStatus === 'approved') {
            return tipoLog === 'IN' 
              ? { status: 'Entrada autorizada', icon: '✅', color: '#4CAF50' }
              : { status: 'Saída registrada', icon: '🚪', color: '#2196F3' };
          } else if (notificationStatus === 'rejected') {
            return { status: 'Acesso negado', icon: '❌', color: '#F44336' };
          } else if (notificationStatus === 'pending') {
            return { status: 'Aguardando aprovação', icon: '⏳', color: '#FF9800' };
          } else {
            return { status: 'Expirado', icon: '⏰', color: '#666' };
          }
        };

        const statusInfo = getVisitorStatus(log.tipo_log, log.notification_status);
        const visitorName = log.visitors?.name || log.guest_name || 'Visitante';
        const visitorDocument = log.visitors?.document || 'N/A';
        const visitorPhoto = log.visitors?.photo_url;

        return {
          id: log.id,
          type: 'visitor',
          title: visitorName,
          subtitle: `Apto ${log.apartments?.number || 'N/A'} • ${log.tipo_log === 'IN' ? 'Entrada' : 'Saída'}`,
          status: statusInfo.status,
          time: formatDate(log.log_time),
          icon: statusInfo.icon,
          color: statusInfo.color,
          photo_url: visitorPhoto,
          details: [
            `Documento: ${visitorDocument}`,
            `Tipo: ${log.entry_type || 'visitor'}`,
            `Status: ${log.notification_status}`,
            ...(log.purpose ? [`Motivo: ${log.purpose}`] : []),
          ],
        };
      });

      // Processar logs de encomendas
      const deliveryLogs: LogEntry[] = (deliveryResult.data || []).map((delivery: any) => {
        const isDelivered = delivery.status === 'entregue';
        const recipientName = delivery.recipient_name || 'Destinatário';
        const sender = delivery.sender || 'N/A';
        const description = delivery.description || delivery.delivery_description;

        return {
          id: delivery.id,
          type: 'delivery',
          title: `Encomenda - ${recipientName}`,
          subtitle: `Apto ${delivery.apartments?.number || 'N/A'} • ${sender}`,
          status: isDelivered ? 'Entregue' : 'Recebida',
          time: formatDate(
            isDelivered && delivery.delivered_at ? delivery.delivered_at : delivery.created_at
          ),
          icon: isDelivered ? '✅' : '📦',
          color: isDelivered ? '#4CAF50' : '#FF9800',
          details: [
            `Remetente: ${sender}`,
            ...(description ? [`Descrição: ${description}`] : []),
            `Recebida por: ${delivery.received_by || 'N/A'}`,
            ...(isDelivered ? [`Entregue por: ${delivery.delivered_by || 'N/A'}`] : []),
          ],
        };
      });

      // Combinar e ordenar todos os logs por data
      const allLogs = [...visitorLogs, ...deliveryLogs].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      setLogs(allLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, timeFilter, user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Effect para obter o building_id do porteiro logado
  useEffect(() => {
    const getBuildingId = async () => {
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('building_id')
          .eq('id', user.id)
          .single();
        
        if (profile?.building_id) {
          setBuildingId(profile.building_id);
        }
      }
    };
    
    getBuildingId();
  }, [user?.id]);

  // Effect para configurar listeners em tempo real
  useEffect(() => {
    if (!buildingId) return;

    const channels: RealtimeChannel[] = [];

    // Listener para visitor_logs
    const visitorLogsChannel = supabase
      .channel('visitor_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `building_id=eq.${buildingId}`
        },
        async (payload) => {
          console.log('Mudança em visitor_logs:', payload);
          
          const { eventType, new: newRecord, old: oldRecord } = payload;
          let message = '';
          
          const newRecordData = newRecord as Record<string, any> | null;
          const oldRecordData = oldRecord as Record<string, any> | null;
          
          if (eventType === 'INSERT') {
            message = `Novo log de visitante registrado - ${newRecordData?.visitor_name || 'Visitante'}`;
          } else if (eventType === 'UPDATE') {
            if (oldRecordData?.status !== newRecordData?.status) {
              message = `Status do visitante ${newRecordData?.visitor_name || 'Visitante'} alterado para: ${newRecordData?.status}`;
            } else {
              message = `Log do visitante ${newRecordData?.visitor_name || 'Visitante'} foi atualizado`;
            }
          } else if (eventType === 'DELETE') {
            message = `Log de visitante foi removido`;
          }
          
          if (message) {
            await notifyPorteiros(message, {
              type: 'visitor_log',
              visitor_log_id: newRecordData?.id || oldRecordData?.id || '',
              event_type: eventType
            });
          }
          
          // Recarregar dados
          fetchLogs();
        }
      )
      .subscribe();

    // Listener para deliveries
    const deliveriesChannel = supabase
      .channel('deliveries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `building_id=eq.${buildingId}`
        },
        async (payload) => {
          console.log('Mudança em deliveries:', payload);
          
          const { eventType, new: newRecord, old: oldRecord } = payload;
          let message = '';
          
          const newRecordData = newRecord as Record<string, any> | null;
          const oldRecordData = oldRecord as Record<string, any> | null;
          
          if (eventType === 'INSERT') {
            message = `Nova entrega registrada - ${newRecordData?.recipient_name || 'Destinatário'} (Apt. ${newRecordData?.apartment_number || 'N/A'})`;
          } else if (eventType === 'UPDATE') {
            if (oldRecordData?.status !== newRecordData?.status) {
              message = `Status da entrega para ${newRecordData?.recipient_name || 'Destinatário'} alterado para: ${newRecordData?.status}`;
            } else {
              message = `Entrega para ${newRecordData?.recipient_name || 'Destinatário'} foi atualizada`;
            }
          } else if (eventType === 'DELETE') {
            message = `Registro de entrega foi removido`;
          }
          
          if (message) {
            await notifyPorteiros(message, {
              type: 'delivery',
              delivery_id: newRecordData?.id || oldRecordData?.id || '',
              event_type: eventType
            });
          }
          
          // Recarregar dados
          fetchLogs();
        }
      )
      .subscribe();

    channels.push(visitorLogsChannel, deliveriesChannel);
    setRealtimeChannels(channels);

    console.log('✅ Listeners em tempo real configurados para o prédio:', buildingId);
    
    // Cleanup ao desmontar o componente
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setRealtimeChannels([]);
      console.log('🧹 Listeners em tempo real removidos');
    };
  }, [buildingId, fetchLogs]);

  // Atualizar logs quando as notificações mudarem (tempo real)
  useEffect(() => {
    if (realtimeNotifications.length > 0) {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeNotifications]);

  // Função transferida do index.tsx para carregar logs de visitantes do histórico
  const loadVisitorLogs = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoadingVisitorLogs(true);
      
      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('user_id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        return;
      }
      
      // Buscar logs de visitantes do prédio - consulta simples sem joins
      const { data: logs, error: logsError } = await supabase
        .from('visitor_logs')
        .select('id, visitor_id, apartment_id, log_time, tipo_log, purpose, notification_status')
        .eq('building_id', profile.building_id)
        .order('log_time', { ascending: false })
        .limit(50);
        
      if (logsError) {
        console.error('Erro ao carregar logs de visitantes:', logsError);
        return;
      }
      
      setVisitorLogs(logs || []);
    } catch (error) {
      console.error('Erro ao carregar logs de visitantes:', error);
    } finally {
      setLoadingVisitorLogs(false);
    }
  }, [user]);

  // Funções auxiliares transferidas do index.tsx
  const getIconeTipoLog = (tipoLog: string) => {
    switch (tipoLog) {
      case 'IN':
        return '🔵'; // Entrada
      case 'OUT':
        return '🔴'; // Saída
      default:
        return '👤';
    }
  };

  const getCorStatus = (notification_status: string) => {
    switch (notification_status) {
      case 'approved':
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const formatDateTimeHistorico = (dateTime: string) => {
    const date = new Date(dateTime);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
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
      // Manual date formatting to avoid Hermes locale issues
      const day = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return `${day} ${time}`;
    }
  };

  const getFilterCount = (filterType: string) => {
    if (filterType === 'all') return logs.length;
    if (filterType === 'historico') return visitorLogs.length;
    return logs.filter((log) => log.type === filterType).length;
  };

  const LogCard = ({ log }: { log: LogEntry }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <TouchableOpacity
        style={styles.logCard}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <View style={styles.logHeader}>
          <View style={styles.logIcon}>
            <Text style={flattenStyles([styles.iconText, { color: log.color }])}>{log.icon}</Text>
          </View>

          <View style={styles.logInfo}>
            <Text style={styles.logTitle}>{log.title}</Text>
            <Text style={styles.logSubtitle}>{log.subtitle}</Text>
            <View style={styles.logMeta}>
              <Text style={flattenStyles([styles.logStatus, { color: log.color }])}>
                {log.status}
              </Text>
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
              <Text key={index} style={styles.detailText}>
                • {detail}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={() => setExpanded(!expanded)}  style={styles.expandIndicator}>
          <Text style={styles.expandText}>{expanded ? '▲ Menos detalhes' : '▼ Mais detalhes'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📋 Histórico de Atividades</Text>
           <Text style={styles.subtitle}>Buscar moradores e veículos cadastrados</Text>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'all', label: 'Todas', icon: '📋' },
                { key: 'visitor', label: 'Visitantes', icon: '👥' },
                { key: 'delivery', label: 'Encomendas', icon: '📦' },
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

        <View style={styles.timeFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'today', label: 'Hoje' },
                { key: 'week', label: 'Semana' },
                { key: 'month', label: 'Mês' },
                { key: 'all', label: 'Tudo' },
              ].map((timeOption) => (
                <TouchableOpacity
                  key={timeOption.key}
                  style={[
                    styles.timeFilterButton,
                    timeFilter === timeOption.key && styles.timeFilterButtonActive,
                  ]}
                  onPress={() => setTimeFilter(timeOption.key as any)}>
                  <Text
                    style={[
                      styles.timeFilterButtonText,
                      timeFilter === timeOption.key && styles.timeFilterButtonTextActive,
                    ]}>
                    {timeOption.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView style={styles.logsList}>
          {(loading || (filter === 'historico' && loadingVisitorLogs)) ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando histórico...</Text>
            </View>
          ) : filter === 'historico' ? (
            visitorLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>Nenhum histórico encontrado</Text>
              </View>
            ) : (
              visitorLogs.map((log) => (
                <View key={log.id} style={styles.historicoCard}>
                  <View style={styles.historicoHeader}>
                    <Text style={styles.historicoIcon}>
                      {getIconeTipoLog(log.tipo_log)}
                    </Text>
                    <View style={styles.historicoInfo}>
                      <Text style={styles.historicoAcao}>
                        {log.tipo_log === 'IN' ? 'Entrada' : 'Saída'} de Visitante
                      </Text>
                      <Text style={styles.historicoDetalhes}>
                        Apartamento: {log.apartment_id}
                      </Text>
                      {log.purpose && (
                        <Text style={styles.historicoDetalhes}>
                          Motivo: {log.purpose}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.historicoDateTime}>
                    <Text style={styles.historicoDateTime}>
                      {formatDateTimeHistorico(log.log_time)}
                    </Text>
                    <View style={[
                      styles.historicoStatusBadge,
                      { backgroundColor: getCorStatus(log.notification_status || '') }
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {log.notification_status === 'approved' ? 'Aprovado' :
                         log.notification_status === 'pending' ? 'Pendente' :
                         log.notification_status === 'rejected' ? 'Rejeitado' : 'N/A'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )
          ) : logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Nenhuma atividade encontrada</Text>
              <Text style={styles.emptySubtext}>
                Não há registros para o período e filtros selecionados
              </Text>
            </View>
          ) : (
            logs.map((log) => <LogCard key={`${log.type}-${log.id}`} log={log} />)
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginVertical: 5,
    color: '#fff',
    textAlign: 'center',
  },
  filters: {
    paddingVertical: 20,
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
  
  // Estilos transferidos do index.tsx para o histórico
  historicoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historicoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historicoIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  historicoInfo: {
    flex: 1,
  },
  historicoAcao: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historicoDetalhes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  historicoDateTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  historicoStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
