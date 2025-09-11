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
  Platform,
} from 'react-native';
import { supabase } from '~/utils/supabase';
import { flattenStyles } from '~/utils/styles';
import { useAuth } from '~/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import { usePorteiroNotifications } from '~/hooks/usePorteiroNotifications';
import * as Notifications from 'expo-notifications';

console.log('🚀 AUTORIZACOES TAB LOADED');

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
  loadAutorizacoes,
  showConfirmationModal,
  user,
  porteiroData,
}) => {
  // Estados
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'delivery' | 'visit'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [buildingId, setBuildingId] = useState<string | null>('03406637-506c-4bfe-938d-9de46806aa19');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [visitorLogsSubscription, setVisitorLogsSubscription] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'visitors' | 'preauthorized'>('visitors');
  
  console.log('🚀 [AutorizacoesTab] Iniciando hook usePorteiroNotifications com buildingId:', buildingId);
  
  // Hook de notificações em tempo real
  const {
    notifications,
    unreadCount,
    isListening,
    startListening,
    stopListening,
    error: notificationsError,
    refreshNotifications
  } = usePorteiroNotifications(buildingId, user?.id);
  
  console.log('🔍 [AutorizacoesTab] Hook carregado - isListening:', isListening, 'notifications:', notifications.length, 'unreadCount:', unreadCount, 'error:', notificationsError);
  


  // Effect para obter o building_id do porteiro logado
  useEffect(() => {
    const getBuildingId = async () => {
      if (user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('building_id')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Erro ao buscar building_id:', error);
          // Usar o buildingId padrão em caso de erro
          setBuildingId('03406637-506c-4bfe-938d-9de46806aa19');
          return;
        }
        
        if (profile?.building_id) {
          setBuildingId(profile.building_id);
        } else {
          // Usar o buildingId padrão se não encontrar no perfil
          setBuildingId('03406637-506c-4bfe-938d-9de46806aa19');
          console.log('Building ID padrão aplicado: 03406637-506c-4bfe-938d-9de46806aa19');
        }
      } else {
        // Usar o buildingId padrão se não houver usuário
        setBuildingId('03406637-506c-4bfe-938d-9de46806aa19');
      }
    };
    
    getBuildingId();
  }, [user?.id]);
  
  // Effect para recarregar atividades quando houver mudanças nas notificações
  // Movido para depois da definição de fetchActivities

  // Função para formatar data de forma otimizada
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = date.getTime() - now.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const absDiffInMinutes = Math.abs(diffInMinutes);
    
    // Se é futuro (diffInMinutes > 0)
    if (diffInMinutes > 0) {
      if (absDiffInMinutes < 60) {
        return `daqui a ${absDiffInMinutes} min`;
      } else if (absDiffInMinutes < 1440) {
        const hours = Math.floor(absDiffInMinutes / 60);
        return `daqui a ${hours}h`;
      } else if (absDiffInMinutes < 10080) { // 7 dias
        const days = Math.floor(absDiffInMinutes / 1440);
        return `daqui a ${days} dia${days > 1 ? 's' : ''}`;
      } else if (absDiffInMinutes < 43200) { // 30 dias
        const weeks = Math.floor(absDiffInMinutes / 10080);
        return `daqui a ${weeks} semana${weeks > 1 ? 's' : ''}`;
      } else {
        const months = Math.floor(absDiffInMinutes / 43200);
        return `daqui a ${months} ${months === 1 ? 'mês' : 'meses'}`;
      }
    }
    // Se é passado (diffInMinutes <= 0)
    else {
      if (absDiffInMinutes < 1) {
        return 'Agora';
      } else if (absDiffInMinutes < 60) {
        return `há ${absDiffInMinutes} min`;
      } else if (absDiffInMinutes < 1440) {
        const hours = Math.floor(absDiffInMinutes / 60);
        return `há ${hours}h`;
      } else if (absDiffInMinutes < 10080) { // 7 dias
        const days = Math.floor(absDiffInMinutes / 1440);
        return `há ${days} dia${days > 1 ? 's' : ''}`;  
      } else if (absDiffInMinutes < 43200) { // 30 dias
        const weeks = Math.floor(absDiffInMinutes / 10080);
        return `há ${weeks} semana${weeks > 1 ? 's' : ''}`;
      } else {
        const months = Math.floor(absDiffInMinutes / 43200);
        return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
      }
    }
  };

  // Função para buscar visitor_logs do Supabase
  const fetchVisitorLogs = async () => {
    if (!buildingId) {
      console.warn('⚠️ BuildingId não disponível para buscar visitor_logs');
      return;
    }

    try {
      console.log('🔄 Buscando visitor_logs para buildingId:', buildingId);
      
      let visitorLogsQuery = supabase
        .from('visitor_logs')
        .select(`
          *,
          apartments!inner(number),
          visitors(name)
        `)
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false });

      // Aplicar filtro de tempo baseado no timeFilter
      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;
        
        switch (timeFilter) {
          case 'today':
            // Para hoje: apenas logs do dia atual até o momento presente
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(); // Usar o momento atual como limite superior
            break;
          case 'week':
            // Para semana: logs da semana atual (domingo a sábado)
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            startDate = weekStart;
            endDate = new Date(weekStart);
            endDate.setDate(weekStart.getDate() + 7);
            break;
          case 'month':
            // Para mês: logs do mês atual
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
          default:
            // Para 'all': últimos 30 dias
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            endDate = new Date();
        }

        // Aplicar filtro de data rigoroso
        visitorLogsQuery = visitorLogsQuery
          .gte('created_at', startDate.toISOString())
          .lt('created_at', endDate.toISOString());
      } else {
        // Para 'all': últimos 30 dias
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        visitorLogsQuery = visitorLogsQuery.gte('created_at', thirtyDaysAgo.toISOString());
      }

      const { data, error } = await visitorLogsQuery;

      if (error) {
        console.error('❌ Erro ao buscar visitor_logs:', error);
        // Não interromper o fluxo, apenas logar o erro
        return;
      }

      // Processar dados para incluir número do apartamento e nome do visitante
      const processedLogs = (data || []).map(log => ({
        ...log,
        apartment_number: log.apartments?.number || 'N/A',
        visitor_name: log.visitors?.name || log.guest_name || log.visitor_name || 'Visitante'
      }));

      setVisitorLogs(processedLogs);
      console.log('✅ Visitor logs carregados:', processedLogs?.length || 0, `registros (filtro: ${timeFilter})`);
      
      // Manter funcionalidade de horários de trabalho (08:00-18:00)
      const currentHour = new Date().getHours();
      const isWorkingHours = currentHour >= 8 && currentHour <= 18;
      console.log('🕐 Horário atual:', currentHour, 'Horário de trabalho (08:00-18:00):', isWorkingHours);
      
    } catch (error) {
      console.error('❌ Erro crítico ao buscar visitor_logs:', error);
      // Em caso de erro crítico, não quebrar a aplicação
      setVisitorLogs([]);
    }
  };

  // Função para enviar notificação push
  const sendPushNotification = async (logData: any, eventType: string) => {
    try {
      // Verificar se as notificações estão habilitadas
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Permissões de notificação não concedidas');
        return;
      }

      // Verificar horário de trabalho antes de enviar notificação
      const currentHour = new Date().getHours();
      const isWorkingHours = currentHour >= 8 && currentHour <= 18;
      
      if (!isWorkingHours) {
        console.log('🕐 Fora do horário de trabalho (08:00-18:00), notificação não enviada');
        return;
      }

      // Buscar informações completas do visitante se necessário
      let visitorName = logData?.visitor_name || logData?.guest_name || 'Visitante';
      let apartmentNumber = logData?.apartment_number;
      
      // Se não temos o nome do visitante e temos visitor_id, buscar no Supabase
      if ((!visitorName || visitorName === 'Visitante') && logData?.visitor_id) {
        try {
          const { data: visitorData } = await supabase
            .from('visitors')
            .select('name')
            .eq('id', logData.visitor_id)
            .single();
          
          visitorName = visitorData?.name || logData?.guest_name || 'Visitante';
        } catch (error) {
          console.warn('⚠️ Erro ao buscar nome do visitante:', error);
        }
      }
      
      // Se não temos o número do apartamento, buscar no Supabase
      if (!apartmentNumber || apartmentNumber === 'N/A') {
        try {
          const { data: apartmentData } = await supabase
            .from('apartments')
            .select('number')
            .eq('id', logData?.apartment_id)
            .single();
          
          apartmentNumber = apartmentData?.number || 'N/A';
        } catch (error) {
          console.warn('⚠️ Erro ao buscar número do apartamento:', error);
          apartmentNumber = 'N/A';
        }
      }
      
      // Formatar número do apartamento para exibição
      const displayApartment = apartmentNumber && apartmentNumber !== 'N/A' 
        ? `apartamento ${apartmentNumber}` 
        : 'apartamento não identificado';

      // Criar mensagens personalizadas e amigáveis
      let title = '';
      let body = '';
      
      if (eventType === 'INSERT') {
        // Nova entrada de visitante
        title = '🔔 Novo Visitante Registrado';
        body = `${visitorName} foi registrado para visita ao ${displayApartment}.`;
      } else if (eventType === 'UPDATE') {
        // Atualização do status do visitante
        const status = logData?.notification_status;
        
        if (status === 'approved') {
          title = '✅ Visitante Autorizado';
          body = `O visitante ${visitorName} foi autorizado a entrar no ${displayApartment}.`;
        } else if (status === 'rejected') {
          title = '❌ Visitante Não Autorizado';
          body = `A entrada do visitante ${visitorName} no ${displayApartment} foi negada.`;
        } else {
          title = '🔄 Status do Visitante Atualizado';
          body = `O status do visitante ${visitorName} para o ${displayApartment} foi atualizado.`;
        }
      }
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            logId: logData?.id || 'unknown',
            buildingId: buildingId,
            eventType,
            visitorName: logData?.visitor_name,
            apartmentNumber: logData?.apartment_number,
            notificationStatus: logData?.notification_status,
            timestamp: new Date().toISOString(),
            workingHours: '08:00-18:00'
          },
        },
        trigger: null, // Enviar imediatamente
      });
      
      console.log('📱 Push notification enviada:', { title, body, eventType, workingHours: isWorkingHours });
    } catch (error) {
      console.error('❌ Erro ao enviar push notification:', error);
      // Não interromper o fluxo em caso de erro de notificação
    }
  };

  // Função para configurar subscription em tempo real para visitor_logs
  const setupVisitorLogsSubscription = () => {
    if (!buildingId) {
      console.warn('⚠️ BuildingId não disponível para configurar subscription');
      return;
    }

    try {
      // Remove subscription anterior se existir
      if (visitorLogsSubscription) {
        console.log('🔄 Removendo subscription anterior');
        visitorLogsSubscription.unsubscribe();
      }

      console.log('🔗 Configurando subscription para visitor_logs, buildingId:', buildingId);
      
      const subscription = supabase
        .channel(`visitor_logs_changes_${buildingId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitor_logs',
            filter: `building_id=eq.${buildingId}`
          },
          async (payload) => {
            try {
              console.log('📡 Mudança em visitor_logs:', payload.eventType, payload);
              
              // Recarregar dados quando houver mudanças
              await fetchVisitorLogs();
              
              // Enviar notificação push automática
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                console.log('🔔 Nova atualização em visitor_logs - disparando notificação');
                await sendPushNotification(payload.new || payload.old, payload.eventType);
                
                // Log de building ID e schedule para auditoria
                console.log('📋 Log de auditoria:', {
                  buildingId,
                  eventType: payload.eventType,
                  timestamp: new Date().toISOString(),
                  workSchedule: '08:00-18:00'
                });
              }
            } catch (error) {
              console.error('❌ Erro ao processar mudança em visitor_logs:', error);
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Status da subscription:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Subscription para visitor_logs ativa');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Erro na subscription de visitor_logs');
          }
        });

      setVisitorLogsSubscription(subscription);
      console.log('✅ Subscription para visitor_logs configurada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao configurar subscription para visitor_logs:', error);
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

  // Inicializar visitor_logs e subscription
  useEffect(() => {
    if (buildingId) {
      console.log('🔄 Inicializando visitor_logs para buildingId:', buildingId);
      fetchVisitorLogs();
      setupVisitorLogsSubscription();
    }

    return () => {
      if (visitorLogsSubscription) {
        console.log('🔕 Removendo subscription de visitor_logs');
        visitorLogsSubscription.unsubscribe();
      }
    };
  }, [buildingId]);

  // Inicializar notificações quando o building_id estiver disponível
  useEffect(() => {
    console.log('🔄 [AutorizacoesTab] useEffect notificações - buildingId:', buildingId, 'user.id:', user?.id, 'isListening:', isListening);
    
    // Só iniciar se não estiver já escutando e tiver os dados necessários
    if (buildingId && user?.id && !isListening) {
      console.log('✅ [AutorizacoesTab] Iniciando listeners de notificação...');
      startListening();
    } else if (!buildingId || !user?.id) {
      console.log('❌ [AutorizacoesTab] Não pode iniciar listeners - buildingId:', buildingId, 'user.id:', user?.id);
    } else if (isListening) {
      console.log('ℹ️ [AutorizacoesTab] Listeners já estão ativos');
    }
    
    // Cleanup apenas quando o componente for desmontado ou buildingId/user mudar
    return () => {
      if (isListening) {
        console.log('🛑 [AutorizacoesTab] Parando listeners de notificação...');
        stopListening();
      }
    };
  }, [buildingId, user?.id]); // Removidas as funções das dependências para evitar recursão

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
          let endDate: Date;
          
          switch (timeFilter) {
            case 'today':
              // Para hoje: apenas eventos do dia atual
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
              break;
            case 'week':
              // Para semana: eventos da semana atual (domingo a sábado)
              const weekStart = new Date(now);
              weekStart.setDate(now.getDate() - now.getDay());
              weekStart.setHours(0, 0, 0, 0);
              startDate = weekStart;
              endDate = new Date(weekStart);
              endDate.setDate(weekStart.getDate() + 7);
              break;
            case 'month':
              // Para mês: eventos do mês atual
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              break;
            default:
              startDate = new Date(0);
              endDate = new Date();
          }

          // Aplicar filtro de data rigoroso
          deliveryQuery = deliveryQuery
            .gte('created_at', startDate.toISOString())
            .lt('created_at', endDate.toISOString());
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

        // Aplicar filtro de tempo para visitas
        if (timeFilter !== 'all') {
          const now = new Date();
          let startDate: Date;
          let endDate: Date;
          
          switch (timeFilter) {
            case 'today':
              // Para hoje: apenas visitas do dia atual
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
              break;
            case 'week':
              // Para semana: visitas da semana atual (domingo a sábado)
              const weekStart = new Date(now);
              weekStart.setDate(now.getDate() - now.getDay());
              weekStart.setHours(0, 0, 0, 0);
              startDate = weekStart;
              endDate = new Date(weekStart);
              endDate.setDate(weekStart.getDate() + 7);
              break;
            case 'month':
              // Para mês: visitas do mês atual
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              break;
            default:
              startDate = new Date(0);
              endDate = new Date();
          }

          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          const startDateTimeStr = startDate.toISOString();
          const endDateTimeStr = endDate.toISOString();
          
          // Filtrar por visit_date (data agendada) ou created_at (data de criação) de forma rigorosa
          visitQuery = visitQuery.or(
            `visit_date.gte.${startDateStr},visit_date.lt.${endDateStr},created_at.gte.${startDateTimeStr},created_at.lt.${endDateTimeStr}`
          );
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

  // Effect para carregar visitor_logs quando timeFilter mudar
  useEffect(() => {
    if (buildingId) {
      console.log('🔄 [AutorizacoesTab] TimeFilter mudou para:', timeFilter, '- recarregando visitor_logs');
      fetchVisitorLogs();
    }
  }, [timeFilter, buildingId]);

  // Effect para recarregar atividades quando houver mudanças nas notificações
  useEffect(() => {
    console.log('🔄 [AutorizacoesTab] useEffect notificações mudaram - count:', notifications.length);
    
    if (notifications.length > 0) {
      console.log('✅ [AutorizacoesTab] Recarregando atividades devido a novas notificações...');
      // Recarregar atividades quando houver novas notificações
      fetchActivities();
    }
  }, [notifications.length, fetchActivities]);

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

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  // Funções auxiliares para LogCard
  const formatLogTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatLogDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'autorizado':
      case 'approved':
        return '#4CAF50';
      case 'negado':
      case 'denied':
      case 'rejected':
        return '#f44336';
      case 'pendente':
      case 'pending':
        return '#FF9800';
      default:
        return '#2196F3';
    }
  };

  // Função para obter status baseado no notification_status
  const getVisitorLogStatus = (notificationStatus: string, tipoLog: string) => {
    switch (notificationStatus?.toLowerCase()) {
      case 'approved':
        return {
          text: 'Aprovado',
          color: '#4CAF50',
          icon: '✅'
        };
      case 'rejected':
        return {
          text: 'Rejeitado', 
          color: '#F44336',
          icon: '❌'
        };
      case 'pending':
        return {
          text: 'Pendente',
          color: '#FF9800', 
          icon: '⏳'
        };
      default:
        return {
          text: 'Registrado',
          color: '#2196F3',
          icon: '📝'
        };
    }
  };

  const getLogIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'visitor':
      case 'visitante':
        return '👤';
      case 'delivery':
      case 'entrega':
        return '📦';
      default:
        return '🏠';
    }
  };

  const getDisplayType = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'visitor':
        return 'visitante';
      case 'delivery':
        return 'entrega';
      default:
        return type || 'visitante';
    }
  };

  // Função para avisar morador
  const handleNotifyResident = async (activityId: string) => {
    try {
      const activity = activities.find(a => a.id === activityId);
      if (!activity) return;

      // Buscar dados do visitante para verificar o access_type
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*, apartments(number)')
        .eq('id', activityId)
        .single();

      if (visitorError) {
        console.error('Erro ao buscar dados do visitante:', visitorError);
        Alert.alert('Erro', 'Não foi possível encontrar os dados do visitante');
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

      // Criar automaticamente um novo registro no visitor_logs
      const logData = {
        visitor_id: activityId,
        building_id: buildingId,
        apartment_id: visitorData.apartment_id,
        guest_name: visitorData.name || activity.title.replace('👤 ', ''),
        entry_type: 'visitor',
        notification_status: 'pending',
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: generateUUID(),
        authorized_by: user?.id || 'Porteiro',
        purpose: `Notificação de chegada do visitante - Aguardando aprovação do morador`,
        photo_url: visitorData.photo_url
      };

      const { error: insertError } = await supabase
        .from('visitor_logs')
        .insert(logData);

      if (insertError) {
        console.error('Erro ao criar registro no visitor_logs:', insertError);
        Alert.alert('Erro', 'Não foi possível criar o registro de visita');
        return;
      }

      // Enviar notificação push para o morador
      // TODO: Implementar envio de push notification
      console.log('Enviando notificação push para o morador...');

      const statusMessage = visitorData.access_type === 'com_aprovacao' 
        ? 'Morador notificado! Aguardando aprovação.' 
        : 'Visitante autorizado e morador notificado!';

      Alert.alert('Sucesso', statusMessage);
      fetchActivities(); // Recarregar atividades
      fetchVisitorLogs(); // Recarregar logs
    } catch (error) {
      console.error('Erro ao notificar morador:', error);
      Alert.alert('Erro', 'Não foi possível notificar o morador');
    }
  };

  // Função para check de entrada
  const handleCheckIn = async (activityId: string) => {
    try {
      const activity = activities.find(a => a.id === activityId);
      if (!activity) return;

      // Buscar dados completos do visitante
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', activityId)
        .single();

      if (visitorError || !visitorData) {
        console.error('Erro ao buscar dados do visitante:', visitorError);
        Alert.alert('Erro', 'Não foi possível encontrar os dados do visitante');
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

      // Criar dados do log baseado no access_type
      const logData = {
        visitor_id: activityId,
        building_id: buildingId,
        apartment_id: visitorData.apartment_id,
        guest_name: visitorData.name || activity.title.replace('👤 ', ''),
        entry_type: 'visitor',
        notification_status: 'approved',
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: generateUUID(),
        authorized_by: user?.id || 'Porteiro',
        purpose: `Check-in confirmado pelo porteiro - Visitante pré-cadastrado autorizado por: ${user?.email || porteiroData?.full_name || 'Porteiro'}`,
        photo_url: visitorData.photo_url
      };

      // Registrar entrada aprovada no visitor_logs
      const { error } = await supabase
        .from('visitor_logs')
        .insert(logData);

      if (error) {
        console.error('Erro ao registrar entrada:', error);
        Alert.alert('Erro', 'Não foi possível registrar a entrada');
        return;
      }

      Alert.alert('Sucesso', 'Entrada registrada com sucesso! O morador será notificado.');
      fetchActivities(); // Recarregar atividades
      fetchVisitorLogs(); // Recarregar logs
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      Alert.alert('Erro', 'Não foi possível registrar a entrada');
    }
  };

  // Componente LogCard
  const LogCard = ({ log }: { log: any }) => {
    const isExpanded = expandedCards.has(log.id);
    const statusInfo = getVisitorLogStatus(log.notification_status, log.tipo_log);
    const logIcon = getLogIcon(log.entry_type);
    
    return (
      <TouchableOpacity
        style={styles.logCard}
        onPress={() => toggleCardExpansion(log.id)}
      >
        <View style={styles.logHeader}>
          <View style={styles.logIcon}>
            <Text style={styles.iconText}>{statusInfo.icon}</Text>
          </View>
          <View style={styles.logInfo}>
            <Text style={styles.logTitle} numberOfLines={1}>
              {log.guest_name || log.visitor_name || log.delivery_recipient || 'Visitante'}
            </Text>
            <Text style={styles.logSubtitle} numberOfLines={1}>
              {log.apartment_number ? `Apto ${log.apartment_number}` : 'Apartamento N/A'}
              {log.tipo_log && ` • ${log.tipo_log === 'IN' ? 'Entrada' : 'Saída'}`}
            </Text>
            <View style={styles.logMeta}>
              <Text style={[styles.logStatus, { color: statusInfo.color }]}>
                {statusInfo.text}
              </Text>
              <Text style={styles.logTime}>
                {formatLogTime(log.log_time || log.created_at)} • {formatLogDate(log.log_time || log.created_at)}
              </Text>
            </View>
          </View>
          {log.photo_url && (
            <View style={styles.photoContainer}>
              <TouchableOpacity onPress={() => openImageModal(log.photo_url)}>
                <Image
                  source={{ uri: log.photo_url }}
                  style={styles.logPhoto}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {isExpanded && (
          <View style={styles.logDetails}>
            {log.visitors?.document && (
              <Text style={styles.detailText}>📄 Documento: {log.visitors.document}</Text>
            )}
            {log.visitor_phone && (
              <Text style={styles.detailText}>📞 Telefone: {log.visitor_phone}</Text>
            )}
            {log.entry_type && (
              <Text style={styles.detailText}>🏷️ Tipo: {getDisplayType(log.entry_type)}</Text>
            )}
            {log.purpose && (
              <Text style={styles.detailText}>📝 Propósito: {log.purpose}</Text>
            )}
            {log.delivery_destination && (
              <Text style={styles.detailText}>📍 Destino: {log.delivery_destination}</Text>
            )}
            {/* Exibir "Autorizado por" apenas quando status for aprovado */}
            {log.notification_status === 'approved' && log.authorized_by && (
              <Text style={styles.detailText}>✅ Autorizado por: {log.authorized_by}</Text>
            )}
            <Text style={styles.detailText}>🕐 Registrado: {formatLogDate(log.log_time || log.created_at)} às {formatLogTime(log.log_time || log.created_at)}</Text>
          </View>
        )}
        
        <TouchableOpacity style={styles.expandIndicator}>
          <Text style={styles.expandText}>
            {isExpanded ? '▲ Menos detalhes' : '▼ Mais detalhes'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
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

        {/* Toggle para alternar entre seções */}
        <View style={styles.sectionToggleContainer}>
          <TouchableOpacity
            style={[styles.sectionToggleButton, activeSection === 'visitors' && styles.sectionToggleButtonActive]}
            onPress={() => setActiveSection('visitors')}>
            <Text style={[styles.sectionToggleButtonText, activeSection === 'visitors' && styles.sectionToggleButtonTextActive]}>
              👤 Visitantes 
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionToggleButton, activeSection === 'preauthorized' && styles.sectionToggleButtonActive]}
            onPress={() => setActiveSection('preauthorized')}>
            <Text style={[styles.sectionToggleButtonText, activeSection === 'preauthorized' && styles.sectionToggleButtonTextActive]}>
              ✅ Pré-autorizados 
            </Text>
          </TouchableOpacity>
        </View>

        {/* Seção de Visitantes */}
        {activeSection === 'visitors' && (
          <>
            <Text style={styles.sectionTitle}>Visitantes</Text>
            {/* Lista de Visitor Logs */}
        <View style={styles.logsList}>
          {visitorLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Não há registros de visitantes para exibir
              </Text>
            </View>
          ) : (
            visitorLogs.map((log) => (
              <LogCard key={log.id} log={log} />
            ))
          )}
        </View>
          </>
        )}

        {/* Seção de Convidados Pré-autorizados */}
        {activeSection === 'preauthorized' && (
          <>
            <Text style={styles.sectionTitle}>Convidados Pré-autorizados</Text>
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
                  {activity.details.map((detail, index) => (
                    <Text key={index} style={styles.activityDetail}>{detail}</Text>
                  ))}
                  
                  {/* Botão Ver Foto */}
                  <TouchableOpacity 
                    style={styles.viewPhotoActionButton}
                    onPress={() => activity.photo_url ? openImageModal(activity.photo_url) : Alert.alert('Sem Foto', 'Visitante está sem foto')}>
                    <Text style={styles.viewPhotoActionButtonText}>
                      📷 Ver Foto
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Avisar Morador */}
                  <TouchableOpacity 
                    style={styles.notifyResidentButton}
                    onPress={() => handleNotifyResident(activity.id)}>
                    <Text style={styles.notifyResidentButtonText}>
                      🔔 Avisar Morador
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Check de Entrada (para visitas diretas) */}
                  {activity.status === 'direto' && (
                    <TouchableOpacity 
                      style={styles.checkInButton}
                      onPress={() => handleCheckIn(activity.id)}>
                      <Text style={styles.checkInButtonText}>
                        ✅ Check de Entrada
                      </Text>
                    </TouchableOpacity>
                  )}
                  
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
          </>
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

      {/* Modal de Imagem */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalBackground}
            activeOpacity={1}
            onPress={closeImageModal}>
            <View style={styles.imageModalContent}>
              <TouchableOpacity 
                style={styles.closeImageButton}
                onPress={closeImageModal}>
                <Text style={styles.closeImageButtonText}>✕</Text>
              </TouchableOpacity>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  Subtitle: {
    fontSize: 18,
    marginVertical: 10,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    marginVertical: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  sectionToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 4,
  },
  sectionToggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionToggleButtonActive: {
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionToggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sectionToggleButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
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
    paddingVertical: 20,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingLeft: 8,
  },
  visitorPhotoSmall: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  viewPhotoButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewPhotoButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  placeholderPhoto: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  closeImageButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
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
  viewPhotoActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginTop: 14,
  },
  viewPhotoActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
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
  // Estilos para LogCard
  logsList: {
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  logInfo: {
    flex: 1,
    marginRight: 12,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  logTime: {
    fontSize: 12,
    color: '#999',
  },
  photoContainer: {
    width: 60,
    height: 60,
  },
  logPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  logDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  expandIndicator: {
    marginTop: 12,
    alignItems: 'center',
  },
  expandText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  // Estilos para os novos botões
  notifyResidentButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FF9800',
    marginTop: 8,
  },
  notifyResidentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  checkInButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
  checkInButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AutorizacoesTab;