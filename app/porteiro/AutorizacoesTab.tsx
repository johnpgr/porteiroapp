import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { supabase } from '~/utils/supabase';
import { flattenStyles } from '~/utils/styles';
import { useAuth } from '~/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';

// Interface para logs de atividades otimizada
type ActivityEntry = {
  id: string;
  type: 'delivery' | 'visit';
  title: string;
  subtitle: string;
  status: string;
  time: string;
  icon: string;
  color: string;
  photo_url?: string;
  details: string[];
  actions?: {
    primary?: {
      label: string;
      action: () => void;
      color: string;
    };
    secondary?: {
      label: string;
      action: () => void;
      color: string;
    };
  };
};

interface AutorizacoesTabProps {
  // Estados para a aba Autorizações
  autorizacoes: any[];
  loadingAutorizacoes: boolean;
  authSearchQuery: string;
  setAuthSearchQuery: (query: string) => void;
  filteredAutorizacoes: any[];
  
  // Estados para dados dos logs na aba Autorizações
  logs: any[];
  loadingLogs: boolean;
  pendingDeliveries: any[];
  scheduledVisits: any[];
  
  // Estados para modal de confirmação
  showConfirmModal: boolean;
  setShowConfirmModal: (show: boolean) => void;
  confirmMessage: string;
  countdown: number;
  selectedAuth: any;
  setSelectedAuth: (auth: any) => void;
  
  // Funções
  openImageModal: (imageUrl: string) => void;
  loadAutorizacoes: () => void;
  showConfirmationModal: (message: string) => void;
  
  // Dados do usuário e porteiro
  user: any;
  porteiroData: any;
}

const AutorizacoesTab: React.FC<AutorizacoesTabProps> = ({
  autorizacoes,
  loadingAutorizacoes,
  authSearchQuery,
  setAuthSearchQuery,
  filteredAutorizacoes,
  logs,
  loadingLogs,
  pendingDeliveries,
  scheduledVisits,
  showConfirmModal,
  setShowConfirmModal,
  confirmMessage,
  countdown,
  selectedAuth,
  setSelectedAuth,
  openImageModal,
  loadAutorizacoes,
  showConfirmationModal,
  user,
  porteiroData,
}) => {
  
  // Estados para a nova estrutura otimizada
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'delivery' | 'visit'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [realtimeChannels, setRealtimeChannels] = useState<RealtimeChannel[]>([]);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
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

  // Função para formatar data de forma otimizada
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      // Corrigir minutos negativos
      if (diffInMinutes < 0) {
        const absDiffInHours = Math.abs(diffInHours);
        if (absDiffInHours < 24) {
          return `Há ${Math.ceil(absDiffInHours)}h`;
        } else {
          const days = Math.floor(absDiffInHours / 24);
          const hours = Math.floor(absDiffInHours % 24);
          return days > 0 ? `Há ${days}d ${hours}h` : `Há ${hours}h`;
        }
      }
      return `${diffInMinutes} min atrás`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`;
    } else {
      const day = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return `${day} ${time}`;
    }
  };

  const removerEncomenda = async (delivery: any) => {
    Alert.alert(
      'Confirmar Remoção',
      `Tem certeza que deseja remover a encomenda de ${delivery.recipient_name || 'destinatário não definido'}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('deliveries')
                .delete()
                .eq('id', delivery.id);

              if (error) {
                console.error('Erro ao remover encomenda:', error);
                Alert.alert('Erro', 'Não foi possível remover a encomenda.');
                return;
              }

              Alert.alert('Sucesso', 'Encomenda removida com sucesso!');
              fetchActivities();
            } catch (error) {
              console.error('Erro ao remover encomenda:', error);
              Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
            }
          }
        }
      ]
    );
  };

  const entregarEncomenda = async (delivery: any) => {
    // Mostrar modal de seleção de destino
    Alert.alert(
      'Destino da Entrega',
      `Para onde deve ser direcionada a entrega de ${delivery.recipient_name || 'destinatário não definido'}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: '🏢 Portaria',
          onPress: () => processarEntrega(delivery, 'portaria')
        },
        {
          text: '🛗 Elevador',
          onPress: () => processarEntrega(delivery, 'elevador')
        }
      ]
    );
  };

  const processarEntrega = async (delivery: any, destino: 'portaria' | 'elevador') => {
    try {
      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id, full_name')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar dados do porteiro:', profileError);
        Alert.alert('Erro', 'Não foi possível confirmar a entrega.');
        return;
      }

      // Atualizar status da entrega para 'delivered' e marcar como entregue
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({ 
          status: 'delivered',
          entregue: true,
          received_at: new Date().toISOString(),
          received_by: user.id
        })
        .eq('id', delivery.id);

      if (updateError) {
        console.error('Erro ao atualizar status da entrega:', updateError);
        Alert.alert('Erro', 'Não foi possível confirmar a entrega.');
        return;
      }

      // Registrar log de entrega na tabela visitor_logs com destino selecionado
      const { error: logError } = await supabase
        .from('visitor_logs')
        .insert({
          delivery_id: delivery.id,
          apartment_id: delivery.apartment_id,
          building_id: profile.building_id,
          log_time: new Date().toISOString(),
          tipo_log: 'IN',
          entry_type: 'delivery',
          delivery_destination: destino,
          authorized_by: user.id,
          guest_name: delivery.recipient_name,
          delivery_sender: delivery.sender_company,
          delivery_description: delivery.description,
          delivery_tracking_code: delivery.tracking_code,
          notification_status: 'approved',
          auto_approved: true,
          requires_notification: false,
          requires_resident_approval: false,
          purpose: `Entrega processada por: ${profile.full_name || 'Porteiro'}. Destino: ${destino === 'portaria' ? 'Portaria' : 'Elevador'}. Remetente: ${delivery.sender_company || 'N/A'}`
        });

      if (logError) {
        console.error('Erro ao registrar log de entrega:', logError);
        // Não bloquear a operação por erro de log
      }

      const destinoTexto = destino === 'portaria' ? 'portaria' : 'elevador';
      Alert.alert('Sucesso', `Entrega de ${delivery.recipient_name || 'destinatário não definido'} direcionada para ${destinoTexto} com sucesso!`);
      fetchActivities();

    } catch (error) {
      console.error('Erro ao confirmar entrega:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  const confirmarChegada = async (autorizacao: any) => {
    try {
      // Validar horários permitidos
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      
      // Manual day extraction to avoid Hermes locale issues
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      
      const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Verificar se há restrições de horário
      if (autorizacao.visit_start_time && autorizacao.visit_end_time) {
        if (currentTime < autorizacao.visit_start_time || currentTime > autorizacao.visit_end_time) {
          Alert.alert(
            'Horário não permitido',
            `Este visitante só pode entrar entre ${autorizacao.visit_start_time} e ${autorizacao.visit_end_time}.\n\nHorário atual: ${currentTime}`
          );
          return;
        }
      }

      // Verificar data específica para visitas pontuais
      if (autorizacao.visit_type === 'pontual' && autorizacao.visit_date) {
        if (currentDate !== autorizacao.visit_date) {
          // Manual date formatting to avoid Hermes locale issues
          const visitDate = new Date(autorizacao.visit_date);
          const visitDateFormatted = `${visitDate.getDate().toString().padStart(2, '0')}/${(visitDate.getMonth() + 1).toString().padStart(2, '0')}/${visitDate.getFullYear()}`;
          const currentDateFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
          
          Alert.alert(
            'Data não permitida',
            `Este visitante só pode entrar na data: ${visitDateFormatted}\n\nData atual: ${currentDateFormatted}`
          );
          return;
        }
      }

      // Verificar dias permitidos para visitas frequentes
      if (autorizacao.visit_type === 'frequente' && autorizacao.allowed_days && autorizacao.allowed_days.length > 0) {
        if (!autorizacao.allowed_days.includes(currentDay)) {
          const allowedDaysPortuguese = autorizacao.allowed_days.map((day: string) => {
            const dayMap: { [key: string]: string } = {
              'monday': 'Segunda-feira',
              'tuesday': 'Terça-feira',
              'wednesday': 'Quarta-feira',
              'thursday': 'Quinta-feira',
              'friday': 'Sexta-feira',
              'saturday': 'Sábado',
              'sunday': 'Domingo'
            };
            return dayMap[day] || day;
          }).join(', ');
          
          // Manual day name formatting to avoid Hermes locale issues
          const currentDayPortuguese = {
            'sunday': 'Domingo',
            'monday': 'Segunda-feira',
            'tuesday': 'Terça-feira',
            'wednesday': 'Quarta-feira',
            'thursday': 'Quinta-feira',
            'friday': 'Sexta-feira',
            'saturday': 'Sábado'
          }[currentDay] || currentDay;
          
          Alert.alert(
            'Dia não permitido',
            `Este visitante frequente só pode entrar nos dias: ${allowedDaysPortuguese}\n\nHoje é: ${currentDayPortuguese}`
          );
          return;
        }
      }

      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        Alert.alert('Erro', 'Não foi possível confirmar a chegada.');
        return;
      }

      // Determinar o novo status baseado no visitor_type
      const visitorType = autorizacao.visitor_type || 'comum';
      const newStatus = visitorType === 'frequente' ? 'aprovado' : 'pendente';

      // Atualizar status do visitante para pendente
      const { error: updateError } = await supabase
        .from('visitors')
        .update({ 
          status: 'pendente'
        })
        .eq('id', autorizacao.id);

      if (updateError) {
        console.error('Erro ao atualizar status do visitante:', updateError);
        Alert.alert('Erro', 'Não foi possível confirmar a chegada do visitante.');
        return;
      }

      // Função para gerar UUID compatível com React Native
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Registrar novo log de entrada (IN)
      const { error: logError } = await supabase
        .from('visitor_logs')
        .insert({
          visitor_id: autorizacao.id,
          apartment_id: autorizacao.apartamento_id,
          building_id: profile.building_id,
          log_time: new Date().toISOString(),
          tipo_log: 'IN',
          visit_session_id: generateUUID(),
          purpose: `ACESSO PRÉ-AUTORIZADO - Visitante já aprovado pelo morador. Porteiro realizou verificação de entrada. Check-in por: ${porteiroData?.full_name || 'N/A'}. Tipo: ${visitorType}, Status: ${newStatus}`,
          authorized_by: user.id, // ID do porteiro que está confirmando
          guest_name: autorizacao.nomeConvidado, // Nome do visitante para exibição
          entry_type: autorizacao.isEncomenda ? 'delivery' : 'visitor', // Tipo de entrada
          requires_notification: !autorizacao.jaAutorizado, // Se precisa notificar morador
          requires_resident_approval: !autorizacao.jaAutorizado, // Se precisa aprovação do morador
          auto_approved: autorizacao.jaAutorizado || false, // Se foi aprovado automaticamente
          emergency_override: false, // Não é emergência
          notification_status: autorizacao.jaAutorizado ? 'approved' : 'pending', // Status baseado na pré-aprovação
          delivery_destination: autorizacao.isEncomenda ? 'portaria' : null, // Destino se for encomenda
          notification_preferences: '{}' // Configurações padrão
        });

      if (logError) {
        Alert.alert('Erro', 'Não foi possível registrar o log de entrada.');
        return;
      }

      // Mostrar modal de confirmação
      setSelectedAuth(autorizacao);
      showConfirmationModal(
        autorizacao.isEncomenda
          ? `A encomenda de ${autorizacao.nomeConvidado} foi registrada na portaria.`
          : `${autorizacao.nomeConvidado} teve sua chegada confirmada. ${visitorType === 'frequente' ? 'Visitante frequente mantém acesso aprovado.' : 'Visitante comum retorna ao status pendente.'}`
      );

      // Recarregar autorizações após o check-in
      setTimeout(() => {
        loadAutorizacoes();
      }, 1000);

    } catch (error) {
      console.error('Erro ao confirmar chegada:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  // Função principal para buscar atividades otimizada
  const fetchActivities = useCallback(async () => {
    if (!user || !buildingId) return;
    
    try {
      setLoading(true);
      const promises = [];

      // Buscar entregas se necessário
      if (filter === 'all' || filter === 'delivery') {
        let deliveryQuery = supabase
          .from('deliveries')
          .select(`
            *,
            apartments!inner(number)
          `)
          .eq('building_id', buildingId)
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

      // Buscar visitas se necessário
      if (filter === 'all' || filter === 'visit') {
        let visitQuery = supabase
          .from('visitors')
          .select(`
            *,
            apartments!inner(number, building_id)
          `)
          .eq('apartments.building_id', buildingId)
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

          visitQuery = visitQuery.gte('visit_date', startDate.toISOString().split('T')[0]);
        }

        promises.push(visitQuery);
      } else {
        promises.push(Promise.resolve({ data: [], error: null }));
      }

      const [deliveryResult, visitResult] = await Promise.all(promises);

      if (deliveryResult.error) throw deliveryResult.error;
      if (visitResult.error) throw visitResult.error;

      // Buscar logs de entrega para obter destinos
      const { data: deliveryLogs } = await supabase
        .from('visitor_logs')
        .select('delivery_id, delivery_destination, purpose')
        .eq('entry_type', 'delivery')
        .eq('building_id', porteiroData?.building_id)
        .not('delivery_id', 'is', null);

      // Processar entregas
      const deliveryActivities: ActivityEntry[] = (deliveryResult.data || []).map((delivery: any) => {
        const isDelivered = delivery.entregue === true;
        const isPending = !delivery.entregue;
        
        // Buscar log de entrega correspondente para obter destino
        const deliveryLog = deliveryLogs?.find(log => log.delivery_id === delivery.id);
        const destino = deliveryLog?.delivery_destination || 'portaria';
        const destinoIcon = destino === 'elevador' ? '🛗' : '🏢';
        const destinoTexto = destino === 'elevador' ? 'Elevador' : 'Portaria';

        return {
          id: delivery.id,
          type: 'delivery',
          title: `📦 ${delivery.recipient_name || 'Destinatário não definido'}`,
          subtitle: `Apto ${delivery.apartments?.number || 'N/A'} • ${delivery.sender_company || 'remetente não definido'}`,
          status: isDelivered ? `Entregue - ${destinoTexto}` : 'Aguardando retirada',
          time: formatDate(isDelivered && delivery.received_at ? delivery.received_at : delivery.created_at),
          icon: isDelivered ? `✅ ${destinoIcon}` : '📦',
          color: isDelivered ? '#4CAF50' : '#FF9800',
          details: [
            `Remetente: ${delivery.sender_company || 'remetente não definido'}`,
            ...(delivery.description ? [`Descrição: ${delivery.description}`] : []),
            `Recebido por: ${delivery.received_by ? 'Porteiro' : 'pendente'}`,
            `Destino: ${destinoTexto} ${destinoIcon}`,
            ...(delivery.tracking_code ? [`Código: ${delivery.tracking_code}`] : []),
            ...(isDelivered && deliveryLog?.purpose ? [`Observações: ${deliveryLog.purpose}`] : []),
          ],
          actions: !isDelivered ? {
            primary: {
              label: 'Entregar',
              action: () => entregarEncomenda(delivery),
              color: '#4CAF50'
            },
            secondary: {
              label: 'Remover',
              action: () => removerEncomenda(delivery),
              color: '#F44336'
            }
          } : undefined
        };
      });

      // Processar visitas
      const visitActivities: ActivityEntry[] = (visitResult.data || []).map((visit: any) => {
        const isApproved = visit.status === 'aprovado';
        const isPending = visit.status === 'pendente';
        const isExpired = visit.status === 'negado';
        const visitorName = visit.name || 'Visitante';

        return {
          id: visit.id,
          type: 'visit',
          title: `👤 ${visitorName}`,
          subtitle: `Apto ${visit.apartments?.number || 'N/A'} • ${visit.visitor_type === 'frequente' ? 'Visitante Frequente' : 'Visita Pontual'}`,
          status: isApproved ? 'Aprovado' : isPending ? 'Aguardando aprovação' : 'Negado',
          time: formatDate(visit.visit_date || visit.created_at),
          icon: isApproved ? '✅' : isPending ? '⏳' : '❌',
          color: isApproved ? '#4CAF50' : isPending ? '#FF9800' : '#F44336',
          photo_url: visit.photo_url,
          details: [
            `Documento: ${visit.document || 'N/A'}`,
            `Telefone: ${visit.phone || 'N/A'}`,
            `Tipo: ${visit.visitor_type === 'frequente' ? 'Visitante Frequente' : 'Visita Pontual'}`,
            ...(visit.visit_date ? [`Data agendada: ${new Date(visit.visit_date).toLocaleDateString('pt-BR')}`] : []),
            ...(visit.visit_start_time && visit.visit_end_time ? [`Horário: ${visit.visit_start_time} - ${visit.visit_end_time}`] : []),
            ...(visit.allowed_days ? [`Dias permitidos: ${visit.allowed_days.join(', ')}`] : []),
          ],
          actions: isApproved ? {
            primary: {
              label: 'Confirmar Entrada',
              action: () => confirmarChegada(visit),
              color: '#4CAF50'
            }
          } : undefined
        };
      });

      // Combinar e ordenar todas as atividades por data
      const allActivities = [...deliveryActivities, ...visitActivities].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      setActivities(allActivities);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, timeFilter, user, buildingId]);

  // Effect para carregar atividades
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Função para obter contagem de filtros
  const getFilterCount = (filterType: 'all' | 'delivery' | 'visit') => {
    if (filterType === 'all') return activities.length;
    return activities.filter(activity => activity.type === filterType).length;
  };

  // Função para alternar expansão de cards
  const toggleCardExpansion = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const getStatusTag = (autorizacao: any) => {
    return (
      <View
        style={[styles.statusTag, { backgroundColor: autorizacao.statusColor }]}>
        <Text style={styles.statusTagText}>{autorizacao.statusLabel}</Text>
      </View>
    );
  };

  return (
    <>
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>✅ Autorizações</Text>
          <Text style={styles.headerSubtitle}>Status de entregas e visitas em tempo real</Text>
        </View>

        {/* Filtros de Tempo */}
        <View style={styles.timeFilterContainer}>
          <TouchableOpacity
            style={[styles.timeFilterButton, timeFilter === 'today' && styles.timeFilterButtonActive]}
            onPress={() => setTimeFilter('today')}>
            <Text style={[styles.timeFilterButtonText, timeFilter === 'today' && styles.timeFilterButtonTextActive]}>
              Hoje
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeFilterButton, timeFilter === 'week' && styles.timeFilterButtonActive]}
            onPress={() => setTimeFilter('week')}>
            <Text style={[styles.timeFilterButtonText, timeFilter === 'week' && styles.timeFilterButtonTextActive]}>
              Semana
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeFilterButton, timeFilter === 'month' && styles.timeFilterButtonActive]}
            onPress={() => setTimeFilter('month')}>
            <Text style={[styles.timeFilterButtonText, timeFilter === 'month' && styles.timeFilterButtonTextActive]}>
              Mês
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeFilterButton, timeFilter === 'all' && styles.timeFilterButtonActive]}
            onPress={() => setTimeFilter('all')}>
            <Text style={[styles.timeFilterButtonText, timeFilter === 'all' && styles.timeFilterButtonTextActive]}>
              Tudo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Atividades */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando atividades...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Nenhuma atividade encontrada</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' 
                ? 'Não há entregas ou visitas para exibir'
                : filter === 'delivery'
                  ? 'Não há entregas para exibir'
                  : 'Não há visitas para exibir'
              }
            </Text>
          </View>
        ) : (
          activities.map((activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityCard}
              onPress={() => toggleCardExpansion(activity.id)}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityIcon}>{activity.icon}</Text>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
                  <Text style={styles.activitySubtitle} numberOfLines={1}>{activity.subtitle}</Text>
                </View>
                <View style={styles.activityMeta}>
                  <Text style={[styles.activityStatus, { color: activity.color }]}>{activity.status}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              </View>
              
              {/* Detalhes expandidos */}
              {expandedCards.has(activity.id) && (
                <View style={styles.activityDetails}>
                  {activity.photo_url && (
                    <TouchableOpacity
                      style={styles.photoContainer}
                      onPress={() => openImageModal(activity.photo_url!)}>
                      <Image source={{ uri: activity.photo_url }} style={styles.visitorPhoto} />
                      <Text style={styles.photoLabel}>📷 Foto do visitante</Text>
                    </TouchableOpacity>
                  )}
                  
                  {activity.details.map((detail, index) => (
                    <Text key={index} style={styles.activityDetail}>{detail}</Text>
                  ))}
                  
                  {/* Botões de ação */}
                  {activity.actions && (
                    <View style={styles.activityActions}>
                      {activity.actions.primary && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: activity.actions.primary.color }]}
                          onPress={activity.actions.primary.action}>
                          <Text style={styles.actionButtonText}>{activity.actions.primary.label}</Text>
                        </TouchableOpacity>
                      )}
                      {activity.actions.secondary && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonSecondary, { borderColor: activity.actions.secondary.color }]}
                          onPress={activity.actions.secondary.action}>
                          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary, { color: activity.actions.secondary.color }]}>
                            {activity.actions.secondary.label}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}


      </ScrollView>

      {/* Modal de Confirmação */}
      {showConfirmModal && selectedAuth && (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmModalIcon}>✅</Text>
            <Text style={styles.confirmModalTitle}>Morador Notificado!</Text>
            <Text style={styles.confirmModalMessage}>
              {selectedAuth.isEncomenda
                ? `A encomenda de ${selectedAuth.nomeConvidado} foi registrada na portaria.`
                : selectedAuth.jaAutorizado
                  ? `${selectedAuth.nomeConvidado} foi liberado para subir ao apartamento ${selectedAuth.apartamento}.`
                  : `O morador do apartamento ${selectedAuth.apartamento} foi notificado sobre a chegada de ${selectedAuth.nomeConvidado}.`}
            </Text>
            <Text style={styles.countdownText}>Fechando em {countdown} segundos...</Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowConfirmModal(false)}>
              <Text style={styles.closeModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
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
  timeFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  activityCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 40,
    textAlign: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  activityMeta: {
    alignItems: 'flex-end',
  },
  activityStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  activityDetails: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  visitorPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 4,
  },
  photoLabel: {
    fontSize: 12,
    color: '#666',
  },
  activityDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  activityActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextSecondary: {
    color: '#666',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    elevation: 10,
  },
  confirmModalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  countdownText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  closeModalButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AutorizacoesTab;