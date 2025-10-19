import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Image, Modal, ScrollView, TextInput } from 'react-native';
import { supabase } from '../../utils/supabase';
import { notifyResidentOfVisitorArrival } from '../../services/notifyResidentService';
import { notifyResidentsVisitorArrival } from '../../services/pushNotificationService';
import ApartmentSearchModal from './components/modals/ApartmentSearchModal';

const AutorizacoesTab = ({ buildingId, user, filter = 'all', timeFilter: externalTimeFilter }) => {
  const [activities, setActivities] = useState([]);
  const [preAuthorizedVisitors, setPreAuthorizedVisitors] = useState([]);
  const [visitorLogs, setVisitorLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState();
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState();
  const [notifications, setNotifications] = useState([]);
  const [countdown, setCountdown] = useState(5);
  const [activeSection, setActiveSection] = useState('visitors');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState(externalTimeFilter || 'all');
  const [showSearch, setShowSearch] = useState(false);
  const [showApartmentModal, setShowApartmentModal] = useState(false);
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [apartmentVisitors, setApartmentVisitors] = useState([]);

  // Estados para paginação e filtros
  const [visitorLogsPage, setVisitorLogsPage] = useState(0);
  const [preAuthorizedPage, setPreAuthorizedPage] = useState(0);
  const [hasMoreVisitorLogs, setHasMoreVisitorLogs] = useState(true);
  const [hasMorePreAuthorized, setHasMorePreAuthorized] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // pending, approved, all
  const [typeFilter, setTypeFilter] = useState('all'); // direto, com_aprovacao, all
  
  const ITEMS_PER_PAGE = 20;

  // Função auxiliar para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Função para entregar encomenda
  const entregarEncomenda = async (delivery: any) => {
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ entregue: true, received_at: new Date().toISOString() })
        .eq('id', delivery.id);

      if (error) {
        console.error('Erro ao entregar encomenda:', error);
        Alert.alert('Erro', 'Não foi possível marcar a encomenda como entregue');
        return;
      }

      Alert.alert('Sucesso', 'Encomenda marcada como entregue');
      fetchActivities();
    } catch (error) {
      console.error('Erro ao entregar encomenda:', error);
      Alert.alert('Erro', 'Não foi possível entregar a encomenda');
    }
  };

  // Função para remover encomenda
  const removerEncomenda = async (delivery: any) => {
    try {
      Alert.alert(
        'Confirmar Remoção',
        'Tem certeza que deseja remover esta encomenda?',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Remover',
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('deliveries')
                .delete()
                .eq('id', delivery.id);

              if (error) {
                console.error('Erro ao remover encomenda:', error);
                Alert.alert('Erro', 'Não foi possível remover a encomenda');
                return;
              }

              Alert.alert('Sucesso', 'Encomenda removida');
              fetchActivities();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao remover encomenda:', error);
      Alert.alert('Erro', 'Não foi possível remover a encomenda');
    }
  };

  // Função para buscar logs de visitantes
  const fetchVisitorLogs = useCallback(async (page = 0, loadMore = false) => {
    console.log('🔍 [fetchVisitorLogs] INICIANDO - buildingId:', buildingId, 'statusFilter:', statusFilter, 'page:', page);

    if (!buildingId) {
      console.log('⚠️ [fetchVisitorLogs] buildingId não fornecido, abortando');
      return;
    }

    try {
      if (!loadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Criar filtros de data para o dia atual
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Buscar logs de visitantes com informações completas
      let query = supabase
        .from('visitor_logs')
        .select(`
          id,
          visitor_id,
          building_id,
          apartment_id,
          guest_name,
          entry_type,
          notification_status,
          log_time,
          tipo_log,
          purpose,
          photo_url,
          authorized_by,
          resident_response_by,
          created_at,
          visitors(
            name,
            document,
            phone
          ),
          apartments(
            number
          )
        `)
        .eq('building_id', buildingId)
        .gte('log_time', startOfToday.toISOString())
        .lt('log_time', startOfTomorrow.toISOString())
        .order('log_time', { ascending: false });

      // Aplicar filtro de status
      if (statusFilter === 'pending') {
        query = query.eq('notification_status', 'pending');
      } else if (statusFilter === 'approved') {
        query = query.eq('notification_status', 'approved');
      }

      // Aplicar paginação
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE - 1;
      query = query.range(startIndex, endIndex);

      const { data: logsData, error } = await query;

      if (error) {
        console.error('❌ [fetchVisitorLogs] Erro ao buscar visitor_logs:', error);
        console.error('❌ [fetchVisitorLogs] Detalhes do erro:', JSON.stringify(error, null, 2));
        return;
      }

      console.log(`✅ [fetchVisitorLogs] Query executada com sucesso!`);
      console.log(`📊 [fetchVisitorLogs] Total de logs encontrados: ${logsData?.length || 0}`);
      console.log(`📝 [fetchVisitorLogs] Primeiros 3 logs:`, logsData?.slice(0, 3));

      // Buscar nomes dos moradores que autorizaram (resident_response_by)
      const residentIds = logsData?.filter(log => log.resident_response_by).map(log => log.resident_response_by) || [];
      const uniqueResidentIds = [...new Set(residentIds)];

      let residentNames = {} as Record<string, string>;
      if (uniqueResidentIds.length > 0) {
        const { data: residentsData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueResidentIds);

        if (residentsData) {
          residentNames = residentsData.reduce((acc, profile) => {
            acc[profile.id] = profile.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Buscar nomes dos usuários (porteiros/moradores) que constam em authorized_by
      const authorizedIds = logsData?.filter(log => log.authorized_by).map(log => log.authorized_by) || [];
      const uniqueAuthorizedIds = [...new Set(authorizedIds)];

      let authorizedNames = {} as Record<string, string>;
      if (uniqueAuthorizedIds.length > 0) {
        const { data: authorizedProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueAuthorizedIds);

        if (authorizedProfiles) {
          authorizedNames = authorizedProfiles.reduce((acc, profile) => {
            acc[profile.id] = profile.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Mapear dados com nomes dos moradores
      const mappedLogs = logsData?.map(log => ({
        ...log,
        visitor_name: log.visitors?.name || log.guest_name,
        visitor_document: log.visitors?.document,
        visitor_phone: log.visitors?.phone,
        apartment_number: log.apartments?.number,
        resident_response_by_name: log.resident_response_by ? residentNames[log.resident_response_by] : null,
        authorized_by_name: log.authorized_by ? authorizedNames[log.authorized_by] : null
      })) || [];

      console.log(`📦 [fetchVisitorLogs] Logs mapeados: ${mappedLogs.length} itens`);
      console.log(`📦 [fetchVisitorLogs] Primeiros 3 logs mapeados:`, mappedLogs.slice(0, 3));

      // DEBUG: Verificar os nomes mapeados
      mappedLogs.slice(0, 3).forEach(log => {
        console.log(`🔍 [DEBUG] Log ${log.id}:`, {
          resident_response_by: log.resident_response_by,
          resident_response_by_name: log.resident_response_by_name,
          authorized_by: log.authorized_by,
          authorized_by_name: log.authorized_by_name
        });
      });

      // Atualizar estado com paginação
      if (loadMore) {
        setVisitorLogs(prev => [...prev, ...mappedLogs]);
      } else {
        setVisitorLogs(mappedLogs);
        setVisitorLogsPage(0);
      }

      // Verificar se há mais dados
      setHasMoreVisitorLogs(mappedLogs.length === ITEMS_PER_PAGE);
      
      console.log(`✅ [fetchVisitorLogs] Estado visitorLogs atualizado com ${mappedLogs.length} itens`);
    } catch (error) {
      console.error('❌ [fetchVisitorLogs] EXCEÇÃO:', error);
      console.error('❌ [fetchVisitorLogs] Stack trace:', error.stack);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      console.log('🏁 [fetchVisitorLogs] FINALIZADO');
    }
  }, [buildingId, statusFilter]);

  // useEffect para buscar dados quando buildingId ou statusFilter mudarem
  useEffect(() => {
    if (buildingId) {
      fetchVisitorLogs();
    }
  }, [buildingId, statusFilter, fetchVisitorLogs]);

  const confirmarChegada = async (visit) => {
    try {
      const activity = activities.find(a => a.id === visit.id);
      if (!activity) return;

      // Buscar dados completos do visitante
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', visit.id)
        .single();

      if (visitorError || !visitorData) {
        console.error('Erro ao buscar dados do visitante:', visitorError);
        Alert.alert('Erro', 'Não foi possível encontrar os dados do visitante');
        return;
      }

      // Verificar se está fora do horário permitido
      if (visitorData.visit_start_time && visitorData.visit_end_time) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const isOutsideAllowedTime =
          currentTime < visitorData.visit_start_time ||
          currentTime > visitorData.visit_end_time;

        if (isOutsideAllowedTime) {
          // Mostrar popup de confirmação
          const userConfirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Fora do Horário Permitido',
              `Este visitante só pode entrar entre ${visitorData.visit_start_time} e ${visitorData.visit_end_time}.\n\nHorário atual: ${currentTime}\n\nTem certeza que deseja avisar o morador?`,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => resolve(false)
                },
                {
                  text: 'Confirmar',
                  style: 'default',
                  onPress: () => resolve(true)
                }
              ],
              { cancelable: false }
            );
          });

          // Se o usuário cancelou, sair da função
          if (!userConfirmed) {
            return;
          }
        }
      }

      // Função para gerar UUID compatível com React Native
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Buscar o morador responsável pelo apartamento
      // Primeiro tenta buscar o proprietário (is_owner = true)
      let { data: apartmentResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('profile_id, profiles!inner(full_name)')
        .eq('apartment_id', visitorData.apartment_id)
        .eq('is_owner', true)
        .maybeSingle();

      // Se não encontrar proprietário, busca qualquer morador do apartamento
      if (!apartmentResident || residentError) {
        console.log('🔍 [confirmarChegada] Proprietário não encontrado, buscando qualquer morador do apartamento');
        const result = await supabase
          .from('apartment_residents')
          .select('profile_id, profiles!inner(full_name)')
          .eq('apartment_id', visitorData.apartment_id)
          .limit(1)
          .maybeSingle();

        apartmentResident = result.data;
        residentError = result.error;
      }

      let residentId = null;
      let residentName = 'Morador';

      if (apartmentResident && !residentError) {
        residentId = apartmentResident.profile_id;
        residentName = apartmentResident.profiles.full_name;
        console.log(`✅ [confirmarChegada] Morador encontrado: ${residentName} (ID: ${residentId})`);
      } else {
        console.error('❌ [confirmarChegada] Nenhum morador encontrado para apartment_id:', visitorData.apartment_id);
      }

      // Buscar dados do apartamento
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select('number')
        .eq('id', visitorData.apartment_id)
        .single();

      if (apartmentError) {
        console.error('❌ [confirmarChegada] Erro ao buscar dados do apartamento:', apartmentError);
      }

      // Criar dados do log baseado no access_type
      const logData = {
        visitor_id: visit.id,
        building_id: buildingId,
        apartment_id: visitorData.apartment_id,
        guest_name: visitorData.name || activity.title.replace('👤 ', ''),
        entry_type: 'visitor',
        notification_status: 'approved',
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: generateUUID(),
        resident_response_by: residentId,
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

      // Atualizar status do visitante baseado no tipo
      if (visitorData.visit_type === 'pontual' || visitorData.visit_type === 'prestador_servico') {
        console.log(`🔄 Atualizando status do visitante ${visitorData.visit_type} ${visitorData.name} (ID: ${visit.id}) para 'expirado'`);
        
        const { error: updateError } = await supabase
          .from('visitors')
          .update({ status: 'expirado' })
          .eq('id', visit.id);

        if (updateError) {
          console.error('❌ Erro ao atualizar status do visitante:', updateError);
          // Não interromper o fluxo, apenas logar o erro
        } else {
          console.log(`✅ Status do visitante ${visitorData.visit_type} ${visitorData.name} atualizado para 'expirado'`);
        }
      } else if (visitorData.visit_type === 'frequente') {
        console.log(`ℹ️ Visitante frequente ${visitorData.name} mantém status 'pendente'`);
      } else {
        console.log(`ℹ️ Visitante ${visitorData.name} é do tipo '${visitorData.visit_type}', mantendo status atual`);
      }

      // NOVA IMPLEMENTAÇÃO: Disparar notificação para o morador
      try {
        console.log('🔔 [confirmarChegada] Iniciando notificação para morador...');

        // 1. Enviar via WhatsApp/SMS (método antigo)
        const notificationResult = await notifyResidentOfVisitorArrival({
          visitorName: visitorData.name || activity.title.replace('👤 ', ''),
          apartmentNumber: apartmentData?.number || 'N/A',
          buildingId: buildingId,
          visitorId: visit.id,
          purpose: visitorData.purpose || 'Visita',
          photo_url: visitorData.photo_url,
          entry_type: 'visitor'
        });

        if (notificationResult.success) {
          console.log('✅ [confirmarChegada] Notificação WhatsApp enviada com sucesso:', notificationResult.message);
        } else {
          console.warn('⚠️ [confirmarChegada] Falha ao enviar WhatsApp:', notificationResult.message);
        }

        // 2. Enviar Push Notification via Edge Function
        try {
          console.log('📱 [confirmarChegada] Enviando push notification para morador...');
          const pushResult = await notifyResidentsVisitorArrival({
            apartmentIds: [visitorData.apartment_id],
            visitorName: visitorData.name || activity.title.replace('👤 ', ''),
            apartmentNumber: apartmentData?.number || 'N/A',
            purpose: visitorData.purpose || 'Visita',
            photoUrl: visitorData.photo_url
          });

          if (pushResult.success) {
            console.log('✅ [confirmarChegada] Push notification enviada:', `${pushResult.sent} enviada(s), ${pushResult.failed} falha(s)`);
          } else {
            console.warn('⚠️ [confirmarChegada] Falha ao enviar push:', pushResult.message);
          }
        } catch (pushError) {
          console.error('❌ [confirmarChegada] Erro ao enviar push notification:', pushError);
        }

      } catch (notificationError) {
        console.error('❌ [confirmarChegada] Erro ao enviar notificação:', notificationError);
        // Não interromper o fluxo principal, apenas logar o erro
      }

      Alert.alert('Sucesso', 'Entrada registrada com sucesso! O morador foi notificado.');
      fetchPreAuthorizedVisitors(); // Recarregar visitantes pré-autorizados
      fetchVisitorLogs(); // Recarregar logs
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      Alert.alert('Erro', 'Não foi possível registrar a entrada');
    }
  };

  // Nota: Subscriptions em tempo real foram desabilitadas conforme instruções do projeto

  // Função para buscar visitantes pré-autorizados (apenas da tabela visitors)
  const fetchPreAuthorizedVisitors = useCallback(async (page = 0, loadMore = false) => {
    console.log('🔍 [fetchPreAuthorizedVisitors] INICIANDO - buildingId:', buildingId, 'typeFilter:', typeFilter, 'page:', page);

    if (!buildingId) {
      console.log('⚠️ [fetchPreAuthorizedVisitors] buildingId não fornecido, abortando');
      return;
    }

    try {
      if (!loadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Criar filtros de data para o dia atual
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const todayString = startOfToday.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Buscar apenas visitantes da tabela visitors (pré-autorizados pelos moradores)
      let visitQuery = supabase
        .from('visitors')
        .select(`
          *,
          apartments!inner(number, building_id)
        `)
        .eq('apartments.building_id', buildingId)
        .neq('status', 'rejected')
        .neq('status', 'nao_permitido')
        .neq('status', 'não autorizado')
        .neq('status', 'expirado')
        .order('created_at', { ascending: false });

      // Aplicar filtro do dia atual
      // Para visitantes pontuais: filtrar por visit_date = data atual
      // Para visitantes frequentes: verificar se o dia atual está nos allowed_days
      // Para visitantes sem data específica: filtrar por created_at >= início do dia atual
      visitQuery = visitQuery.or(`visit_date.eq.${todayString},and(visit_date.is.null,created_at.gte.${startOfToday.toISOString()})`);

      // Aplicar filtro de tipo
      if (typeFilter === 'direto') {
        visitQuery = visitQuery.eq('access_type', 'direto');
      } else if (typeFilter === 'com_aprovacao') {
        visitQuery = visitQuery.eq('access_type', 'com_aprovacao');
      }

      // Aplicar paginação
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE - 1;
      visitQuery = visitQuery.range(startIndex, endIndex);

      const { data: visitResult, error: visitError } = await visitQuery;

      if (visitError) {
        console.error('❌ [fetchPreAuthorizedVisitors] Erro ao buscar visitors:', visitError);
        return;
      }

      console.log(`✅ [fetchPreAuthorizedVisitors] Visitantes pré-autorizados encontrados: ${visitResult?.length || 0}`);

      // Processar visitantes pré-autorizados (filtrar expirados)
      const visitActivities: ActivityEntry[] = (visitResult || [])
        .filter((visit: any) => visit.status !== 'expirado') // Filtrar visitantes expirados
        .map((visit: any) => {
          const isApproved = visit.status === 'aprovado';
          const isDireto = visit.access_type === 'direto';
          const isPending = visit.status === 'pendente';
          const visitorName = visit.name || 'Visitante';
          const allowDirectAccess = isDireto;

          // Determinar o status exibido
          let displayStatus = isApproved ? 'Aprovado' : isDireto ? 'Entrada Liberada' : isPending ? 'Aguardando resposta' : 'Negado';
          if ((isApproved || isDireto) && allowDirectAccess) {
            displayStatus = 'Entrada Liberada';
          }

          return {
            id: visit.id,
            type: 'visit',
            title: `👤 ${visitorName}`,
            subtitle: `Apto ${visit.apartments?.number || 'N/A'} • ${visit.visit_type === 'frequente' ? 'Visitante Frequente' : 'Visita Pontual'}`,
            status: displayStatus,
            time: formatDate(visit.visit_date || visit.created_at),
            icon: isApproved ? (allowDirectAccess ? '🚀' : '✅') : isPending ? '⏳' : '❌',
            color: allowDirectAccess ? '#4CAF50' : '#FF9800',
            photo_url: visit.photo_url,
            details: [
              `Documento: ${visit.document || 'N/A'}`,
              `Telefone: ${visit.phone || 'N/A'}`,
              `Tipo: ${visit.visit_type === 'frequente' ? 'Visitante Frequente' : 'Visita Pontual'}`,
              ...(visit.visit_date ? [`Data agendada: ${new Date(visit.visit_date).toLocaleDateString('pt-BR')}`] : []),
              ...(visit.visit_start_time && visit.visit_end_time ? [`Horário: ${visit.visit_start_time} - ${visit.visit_end_time}`] : []),
              ...(visit.allowed_days ? [`Dias permitidos: ${visit.allowed_days.join(', ')}`] : []),
            ],
            actions: isApproved ? {
              primary: {
                label: 'Confirmar Entrada',
                action: () => confirmarChegada(visit),
                color: allowDirectAccess ? '#2196F3' : '#4CAF50'
              }
            } : undefined
          };
        });

      // Atualizar estado com paginação
      if (loadMore) {
        setPreAuthorizedVisitors(prev => [...prev, ...visitActivities]);
      } else {
        setPreAuthorizedVisitors(visitActivities);
        setPreAuthorizedPage(0);
      }

      // Verificar se há mais dados
      setHasMorePreAuthorized(visitActivities.length === ITEMS_PER_PAGE);
      
      console.log(`✅ [fetchPreAuthorizedVisitors] ${visitActivities.length} visitantes pré-autorizados processados`);

    } catch (error) {
      console.error('❌ [fetchPreAuthorizedVisitors] Erro:', error);
      Alert.alert('Erro', 'Não foi possível carregar os visitantes pré-autorizados');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildingId, typeFilter]);

  // Esta função não será mais usada - substituída por fetchPreAuthorizedVisitors
  const fetchActivities = useCallback(async () => {
    // Função removida - agora usamos fetchPreAuthorizedVisitors para pré-autorizados
    // e fetchVisitorLogs para logs de visitantes
    console.log('⚠️ [fetchActivities] Função descontinuada - use fetchPreAuthorizedVisitors ou fetchVisitorLogs');
    return;
  }, []);

  // Effect para carregar visitantes pré-autorizados
  useEffect(() => {
    if (buildingId) {
      fetchPreAuthorizedVisitors();
    }
  }, [buildingId, typeFilter, fetchPreAuthorizedVisitors]);

  // Effect para carregar visitor_logs quando timeFilter mudar
  useEffect(() => {
    if (buildingId) {
      console.log('🔄 [AutorizacoesTab] TimeFilter mudou para:', timeFilter, '- recarregando visitor_logs');
      fetchVisitorLogs();
    }
  }, [timeFilter, buildingId]);

  // Effect para recarregar dados quando houver mudanças nas notificações
  useEffect(() => {
    console.log('🔄 [AutorizacoesTab] useEffect notificações mudaram - count:', notifications.length);
    
    if (notifications.length > 0) {
      console.log('✅ [AutorizacoesTab] Recarregando dados devido a novas notificações...');
      // Recarregar ambos os dados quando houver novas notificações
      if (buildingId) {
        fetchPreAuthorizedVisitors();
        fetchVisitorLogs();
      }
    }
  }, [notifications.length, buildingId, fetchPreAuthorizedVisitors, fetchVisitorLogs]);

  // Polling para verificar decisões dos moradores sobre visitantes
  useEffect(() => {
    if (!buildingId || !user?.id) return;

    let lastCheckedIds = new Set<string>();

    const checkVisitorDecisions = async () => {
      try {
        // Buscar visitantes com decisões recentes (aprovados ou rejeitados nos últimos 5 minutos)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data: recentDecisions, error } = await supabase
          .from('visitor_logs')
          .select(`
            id,
            notification_status,
            visitor_id,
            apartment_id,
            visitors!inner(name),
            apartments!inner(number),
            resident_response_at,
            authorized_by,
            profiles!visitor_logs_authorized_by_fkey(full_name)
          `)
          .eq('apartments.building_id', buildingId)
          .in('notification_status', ['approved', 'rejected'])
          .gte('resident_response_at', fiveMinutesAgo)
          .order('resident_response_at', { ascending: false });

        if (error) {
          console.error('❌ [checkVisitorDecisions] Erro ao verificar decisões:', error);
          return;
        }

        if (recentDecisions && recentDecisions.length > 0) {
          // Filtrar apenas decisões novas que ainda não foram notificadas
          const newDecisions = recentDecisions.filter(
            (decision) => !lastCheckedIds.has(decision.id)
          );

          if (newDecisions.length > 0) {
            console.log(`🔔 [checkVisitorDecisions] ${newDecisions.length} novas decisões encontradas`);

            // Exibir alert para cada nova decisão
            newDecisions.forEach((decision) => {
              const visitorName = decision.visitors?.name || 'Visitante';
              const apartmentNumber = decision.apartments?.number || 'N/A';
              const moradorName = decision.profiles?.full_name || 'Morador';
              const isApproved = decision.notification_status === 'approved';

              Alert.alert(
                isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Recusado',
                `O morador ${moradorName} do apartamento ${apartmentNumber} ${isApproved ? 'ACEITOU' : 'RECUSOU'} o visitante ${visitorName}.`,
                [{ text: 'OK' }]
              );

              // Adicionar à lista de IDs já notificados
              lastCheckedIds.add(decision.id);
            });

            // Recarregar dados
            fetchPreAuthorizedVisitors();
            fetchVisitorLogs();
          }
        }
      } catch (error) {
        console.error('❌ [checkVisitorDecisions] Exceção:', error);
      }
    };

    // Verificar imediatamente
    checkVisitorDecisions();

    // Configurar polling a cada 10 segundos
    const intervalId = setInterval(checkVisitorDecisions, 10000);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [buildingId, user?.id, fetchPreAuthorizedVisitors, fetchVisitorLogs]);

  // Função para obter contagem de filtros (apenas para pré-autorizados)
  const getFilterCount = (filterType: 'all' | 'delivery' | 'visit') => {
    if (filterType === 'all') return preAuthorizedVisitors.length;
    return preAuthorizedVisitors.filter(activity => activity.type === filterType).length;
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

  // Função para obter status baseado no notification_status
  const getVisitorLogStatus = (notificationStatus: string, tipoLog: string) => {
    switch (notificationStatus?.toLowerCase()) {
      case 'approved':
        return {
          text: 'ENTRADA LIBERADA',
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
          text: 'Aguardando resposta',
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
      const activity = preAuthorizedVisitors.find(a => a.id === activityId);
      if (!activity) return;

      // Buscar dados do visitante para verificar o access_type e horários
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*, apartments(number)')
        .eq('id', activityId)
        .maybeSingle();

      if (visitorError) {
        console.error('Erro ao buscar dados do visitante:', visitorError);
        Alert.alert('Erro', 'Erro ao acessar dados do visitante');
        return;
      }

      if (!visitorData) {
        console.error('Visitante não encontrado com ID:', activityId);
        Alert.alert('Erro', 'Visitante não encontrado no sistema');
        return;
      }

      // Verificar se está fora do horário permitido
      if (visitorData.visit_start_time && visitorData.visit_end_time) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const isOutsideAllowedTime =
          currentTime < visitorData.visit_start_time ||
          currentTime > visitorData.visit_end_time;

        if (isOutsideAllowedTime) {
          // Mostrar popup de confirmação
          const userConfirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Fora do Horário Permitido',
              `Este visitante só pode entrar entre ${visitorData.visit_start_time} e ${visitorData.visit_end_time}.\n\nHorário atual: ${currentTime}\n\nTem certeza que deseja avisar o morador?`,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => resolve(false)
                },
                {
                  text: 'Confirmar',
                  style: 'default',
                  onPress: () => resolve(true)
                }
              ],
              { cancelable: false }
            );
          });

          // Se o usuário cancelou, sair da função
          if (!userConfirmed) {
            return;
          }
        }
      }

      // Função para gerar UUID compatível com React Native
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Buscar o morador responsável pelo apartamento
      // Primeiro tenta buscar o proprietário (is_owner = true)
      let { data: apartmentResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('profile_id, profiles!inner(full_name)')
        .eq('apartment_id', visitorData.apartment_id)
        .eq('is_owner', true)
        .maybeSingle();

      // Se não encontrar proprietário, busca qualquer morador do apartamento
      if (!apartmentResident || residentError) {
        console.log('🔍 [handleNotifyResident] Proprietário não encontrado, buscando qualquer morador do apartamento');
        const result = await supabase
          .from('apartment_residents')
          .select('profile_id, profiles!inner(full_name)')
          .eq('apartment_id', visitorData.apartment_id)
          .limit(1)
          .maybeSingle();

        apartmentResident = result.data;
        residentError = result.error;
      }

      let residentId = null;
      let residentName = 'Morador';

      if (apartmentResident && !residentError) {
        residentId = apartmentResident.profile_id;
        residentName = apartmentResident.profiles.full_name;
        console.log(`✅ [handleNotifyResident] Morador encontrado: ${residentName} (ID: ${residentId})`);
      } else {
        console.error('❌ [handleNotifyResident] Nenhum morador encontrado para apartment_id:', visitorData.apartment_id);
      }

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
        resident_response_by: residentId,
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

      // Atualizar status do visitante baseado no tipo
      if (visitorData.visit_type === 'pontual' || visitorData.visit_type === 'prestador_servico') {
        console.log(`🔄 Atualizando status do visitante ${visitorData.visit_type} ${visitorData.name} (ID: ${activityId}) para 'expirado'`);
        
        const { error: updateError } = await supabase
          .from('visitors')
          .update({ status: 'expirado' })
          .eq('id', activityId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status do visitante:', updateError);
          // Não interromper o fluxo, apenas logar o erro
        } else {
          console.log(`✅ Status do visitante ${visitorData.visit_type} ${visitorData.name} atualizado para 'expirado'`);
        }
      } else if (visitorData.visit_type === 'frequente') {
        console.log(`ℹ️ Visitante frequente ${visitorData.name} mantém status 'pendente'`);
      } else {
        console.log(`ℹ️ Visitante ${visitorData.name} é do tipo '${visitorData.visit_type}', mantendo status atual`);
      }

      // Enviar notificação push para o morador
      try {
        console.log('📱 [handleNotifyResident] Enviando push notification para morador...');
        const pushResult = await notifyResidentsVisitorArrival({
          apartmentIds: [visitorData.apartment_id],
          visitorName: visitorData.name || activity.title.replace('👤 ', ''),
          apartmentNumber: visitorData.apartments?.number || 'N/A',
          purpose: visitorData.purpose || 'Visita',
          photoUrl: visitorData.photo_url
        });

        if (pushResult.success) {
          console.log('✅ [handleNotifyResident] Push notification enviada:', `${pushResult.sent} enviada(s), ${pushResult.failed} falha(s)`);
        } else {
          console.warn('⚠️ [handleNotifyResident] Falha ao enviar push:', pushResult.message);
        }
      } catch (pushError) {
        console.error('❌ [handleNotifyResident] Erro ao enviar push notification:', pushError);
      }

      const statusMessage = visitorData.access_type === 'com_aprovacao'
        ? 'Morador notificado! Aguardando aprovação.'
        : 'Visitante autorizado e morador notificado!';

      Alert.alert('Sucesso', statusMessage);
      fetchPreAuthorizedVisitors(); // Recarregar visitantes pré-autorizados
      fetchVisitorLogs(); // Recarregar logs
    } catch (error) {
      console.error('Erro ao notificar morador:', error);
      Alert.alert('Erro', 'Não foi possível notificar o morador');
    }
  };

  // Função para check de entrada
  const handleCheckIn = async (activityId: string) => {
    try {
      const activity = preAuthorizedVisitors.find(a => a.id === activityId);
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

      // Buscar o morador responsável pelo apartamento
      // Primeiro tenta buscar o proprietário (is_owner = true)
      let { data: apartmentResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('profile_id, profiles!inner(full_name)')
        .eq('apartment_id', visitorData.apartment_id)
        .eq('is_owner', true)
        .maybeSingle();

      // Se não encontrar proprietário, busca qualquer morador do apartamento
      if (!apartmentResident || residentError) {
        console.log('🔍 [handleCheckIn] Proprietário não encontrado, buscando qualquer morador do apartamento');
        const result = await supabase
          .from('apartment_residents')
          .select('profile_id, profiles!inner(full_name)')
          .eq('apartment_id', visitorData.apartment_id)
          .limit(1)
          .maybeSingle();

        apartmentResident = result.data;
        residentError = result.error;
      }

      let residentId = null;
      let residentName = 'Morador';

      if (apartmentResident && !residentError) {
        residentId = apartmentResident.profile_id;
        residentName = apartmentResident.profiles.full_name;
        console.log(`✅ [handleCheckIn] Morador encontrado: ${residentName} (ID: ${residentId})`);
      } else {
        console.error('❌ [handleCheckIn] Nenhum morador encontrado para apartment_id:', visitorData.apartment_id);
      }

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
        resident_response_by: residentId,
        purpose: `Check-in confirmado pelo porteiro - Visitante pré-cadastrado autorizado por: ${residentName}`,
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

      // Atualizar status do visitante baseado no tipo
      if (visitorData.visit_type === 'pontual' || visitorData.visit_type === 'prestador_servico') {
        console.log(`🔄 Atualizando status do visitante ${visitorData.visit_type} ${visitorData.name} (ID: ${activityId}) para 'expirado'`);
        
        const { error: updateError } = await supabase
          .from('visitors')
          .update({ status: 'expirado' })
          .eq('id', activityId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status do visitante:', updateError);
          // Não interromper o fluxo, apenas logar o erro
        } else {
          console.log(`✅ Status do visitante ${visitorData.name} atualizado para 'expirado'`);
        }
      } else if (visitorData.visit_type === 'frequente') {
        console.log(`ℹ️ Visitante frequente ${visitorData.name} mantém status 'pendente'`);
      } else {
        console.log(`ℹ️ Visitante ${visitorData.name} é do tipo '${visitorData.visit_type}', mantendo status atual`);
      }

      // Buscar dados do apartamento
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select('number')
        .eq('id', visitorData.apartment_id)
        .single();

      if (apartmentError) {
        console.error('❌ [handleCheckIn] Erro ao buscar dados do apartamento:', apartmentError);
      }

      // NOVA IMPLEMENTAÇÃO: Disparar notificação para o morador
      try {
        console.log('🔔 [handleCheckIn] Iniciando notificação para morador...');

        // 1. Enviar via WhatsApp/SMS (método antigo)
        const notificationResult = await notifyResidentOfVisitorArrival({
          visitorName: visitorData.name || activity.title.replace('👤 ', ''),
          apartmentNumber: apartmentData?.number || 'N/A',
          buildingId: buildingId,
          visitorId: activityId,
          purpose: visitorData.purpose || 'Visita',
          photo_url: visitorData.photo_url,
          entry_type: 'visitor'
        });

        if (notificationResult.success) {
          console.log('✅ [handleCheckIn] Notificação WhatsApp enviada com sucesso:', notificationResult.message);
        } else {
          console.warn('⚠️ [handleCheckIn] Falha ao enviar WhatsApp:', notificationResult.message);
        }

        // 2. Enviar Push Notification via Edge Function
        try {
          console.log('📱 [handleCheckIn] Enviando push notification para morador...');
          const pushResult = await notifyResidentsVisitorArrival({
            apartmentIds: [visitorData.apartment_id],
            visitorName: visitorData.name || activity.title.replace('👤 ', ''),
            apartmentNumber: apartmentData?.number || 'N/A',
            purpose: visitorData.purpose || 'Visita',
            photoUrl: visitorData.photo_url
          });

          if (pushResult.success) {
            console.log('✅ [handleCheckIn] Push notification enviada:', `${pushResult.sent} enviada(s), ${pushResult.failed} falha(s)`);
          } else {
            console.warn('⚠️ [handleCheckIn] Falha ao enviar push:', pushResult.message);
          }
        } catch (pushError) {
          console.error('❌ [handleCheckIn] Erro ao enviar push notification:', pushError);
        }

      } catch (notificationError) {
        console.error('❌ [handleCheckIn] Erro ao enviar notificação:', notificationError);
        // Não interromper o fluxo principal, apenas logar o erro
      }

      Alert.alert('Sucesso', 'Entrada registrada com sucesso! O morador foi notificado.');
      fetchActivities(); // Recarregar atividades
      fetchVisitorLogs(); // Recarregar logs
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      Alert.alert('Erro', 'Não foi possível registrar a entrada');
    }
  };

  // Função para buscar visitantes pré-autorizados por apartamento
  const searchVisitorsByApartment = async (aptNumber: string) => {
    if (!aptNumber.trim()) {
      Alert.alert('Erro', 'Digite o número do apartamento');
      return;
    }

    try {
      // Buscar o apartamento pelo número
      const { data: apartment, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('number', aptNumber)
        .eq('building_id', buildingId)
        .single();

      if (aptError || !apartment) {
        Alert.alert('Erro', 'Apartamento não encontrado neste prédio');
        return;
      }

      // Buscar visitantes pré-autorizados deste apartamento
      const { data: visitors, error: visitorsError } = await supabase
        .from('visitors')
        .select(`
          *,
          apartments!inner(number, building_id)
        `)
        .eq('apartment_id', apartment.id)
        .neq('status', 'rejected')
        .neq('status', 'nao_permitido')
        .neq('status', 'não autorizado')
        .neq('status', 'expirado')
        .order('created_at', { ascending: false });

      if (visitorsError) {
        console.error('Erro ao buscar visitantes:', visitorsError);
        Alert.alert('Erro', 'Não foi possível buscar os visitantes');
        return;
      }

      if (!visitors || visitors.length === 0) {
        Alert.alert('Nenhum Visitante', `Não há visitantes pré-autorizados para o apartamento ${aptNumber}`);
        setApartmentVisitors([]);
        return;
      }

      // Processar visitantes da mesma forma que em fetchActivities
      const processedVisitors = visitors.map((visit: any) => {
        const isApproved = visit.status === 'aprovado';
        const isPending = visit.status === 'pendente';
        const visitorName = visit.name || 'Visitante';
        const allowDirectAccess = visit.allow_direct_access === true;

        return {
          id: visit.id,
          type: 'visit',
          title: `👤 ${visitorName}`,
          subtitle: `Apto ${visit.apartments?.number || 'N/A'} • ${visit.visit_type === 'frequente' ? 'Visitante Frequente' : 'Visita Pontual'}`,
          status: isApproved ? (allowDirectAccess ? 'ENTRADA LIBERADA Direta' : 'ENTRADA LIBERADA Direta') : isPending ? 'Pendente' : 'Não Autorizado',
          time: formatDate(visit.visit_date || visit.created_at),
          icon: isApproved ? (allowDirectAccess ? '🚀' : '✅') : isPending ? '⏳' : '❌',
          color: isApproved ? (allowDirectAccess ? '#2196F3' : '#4CAF50') : isPending ? '#FF9800' : '#F44336',
          photo_url: visit.photo_url,
          details: [
            `Documento: ${visit.document || 'N/A'}`,
            `Telefone: ${visit.phone || 'N/A'}`,
            `Tipo: ${visit.visit_type === 'frequente' ? 'Visitante Frequente' : 'Visita Pontual'}`,
            ...(allowDirectAccess ? ['🚀 Pode subir direto (não precisa avisar morador)'] : []),
            ...(visit.visit_date ? [`Data agendada: ${new Date(visit.visit_date).toLocaleDateString('pt-BR')}`] : []),
            ...(visit.visit_start_time && visit.visit_end_time ? [`Horário: ${visit.visit_start_time} - ${visit.visit_end_time}`] : []),
            ...(visit.allowed_days ? [`Dias permitidos: ${visit.allowed_days.join(', ')}`] : []),
          ],
          actions: isApproved ? {
            primary: {
              label: 'Confirmar Entrada',
              action: () => confirmarChegada(visit),
              color: allowDirectAccess ? '#2196F3' : '#4CAF50'
            }
          } : undefined
        };
      });

      setApartmentVisitors(processedVisitors);
      console.log(`✅ Encontrados ${processedVisitors.length} visitante(s) pré-autorizado(s) para o apartamento ${aptNumber}`);
    } catch (error) {
      console.error('Erro ao buscar visitantes do apartamento:', error);
      Alert.alert('Erro', 'Não foi possível buscar os visitantes');
    }
  };

  // Funções auxiliares para o teclado numérico
  const handleNumberPress = (num: string) => {
    setApartmentNumber(prev => prev + num);
  };

  const handleBackspace = () => {
    setApartmentNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setApartmentNumber('');
    setApartmentVisitors([]);
  };

  const handleSearch = () => {
    searchVisitorsByApartment(apartmentNumber);
  };

  const closeApartmentModal = () => {
    setShowApartmentModal(false);
    setApartmentNumber('');
    setApartmentVisitors([]);
  };

  // Componente LogCard
  // Função para filtrar logs de visitantes por nome
  const filteredVisitorLogs = visitorLogs.filter(log => {
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase().trim();
    const visitorName = (log.visitor_name || log.guest_name || '').toLowerCase();

    return visitorName.includes(searchLower);
  });

  // Log para debug
  console.log('🎨 [RENDER] visitorLogs.length:', visitorLogs.length);
  console.log('🎨 [RENDER] filteredVisitorLogs.length:', filteredVisitorLogs.length);
  console.log('🎨 [RENDER] searchQuery:', searchQuery);
  console.log('🎨 [RENDER] activeSection:', activeSection);
  console.log('🎨 [RENDER] loading:', loading);

  // Função para filtrar visitantes pré-autorizados por nome
  const filteredPreAuthorizedVisitors = preAuthorizedVisitors.filter(activity => {
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase().trim();

    // Para visitantes, busca no título (que contém o nome com emoji)
    if (activity.type === 'visit') {
      const visitorName = activity.title.replace('👤 ', '').toLowerCase();
      return visitorName.includes(searchLower);
    }

    return true;
  });

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
            {/* Exibir "Autorizado por" apenas quando status for aprovado; nunca mostrar IDs */}
            {log.notification_status === 'approved' && (log.resident_response_by_name || log.authorized_by_name) && (
              <Text style={styles.detailText}>
                ✅ Autorizado por: {log.resident_response_by_name || log.authorized_by_name}
              </Text>
            )}
            <Text style={styles.detailText}>🕐 Registrado: {formatLogDate(log.log_time || log.created_at)} às {formatLogTime(log.log_time || log.created_at)}</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.expandIndicator}
          onPress={(e) => {
            e.stopPropagation();
            toggleCardExpansion(log.id);
          }}
        >
          <Text style={styles.expandText}>
            {isExpanded ? '▲ Menos detalhes' : '▼ Mais detalhes'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>✅ Autorizações</Text>
          <Text style={styles.headerSubtitle}>Status de entregas e visitas em tempo real</Text>
        </View>

        {/* Filtros dinâmicos baseados na seção ativa */}
        <View style={styles.timeFilterContainer}>
          {activeSection === 'visitors' ? (
            // Filtros de status para visitantes
            <>
              <TouchableOpacity
                style={[styles.timeFilterButton, statusFilter === 'all' && styles.timeFilterButtonActive]}
                onPress={() => setStatusFilter('all')}>
                <Text style={[styles.timeFilterButtonText, statusFilter === 'all' && styles.timeFilterButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeFilterButton, statusFilter === 'pending' && styles.timeFilterButtonActive]}
                onPress={() => setStatusFilter('pending')}>
                <Text style={[styles.timeFilterButtonText, statusFilter === 'pending' && styles.timeFilterButtonTextActive]}>
                  Pendente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeFilterButton, statusFilter === 'approved' && styles.timeFilterButtonActive]}
                onPress={() => setStatusFilter('approved')}>
                <Text style={[styles.timeFilterButtonText, statusFilter === 'approved' && styles.timeFilterButtonTextActive]}>
                  Aprovado
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // Filtros de tipo para pré-autorizados
            <>
              <TouchableOpacity
                style={[styles.timeFilterButton, typeFilter === 'all' && styles.timeFilterButtonActive]}
                onPress={() => setTypeFilter('all')}>
                <Text style={[styles.timeFilterButtonText, typeFilter === 'all' && styles.timeFilterButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeFilterButton, typeFilter === 'direto' && styles.timeFilterButtonActive]}
                onPress={() => setTypeFilter('direto')}>
                <Text style={[styles.timeFilterButtonText, typeFilter === 'direto' && styles.timeFilterButtonTextActive]}>
                  Direto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeFilterButton, typeFilter === 'com_aprovacao' && styles.timeFilterButtonActive]}
                onPress={() => setTypeFilter('com_aprovacao')}>
                <Text style={[styles.timeFilterButtonText, typeFilter === 'com_aprovacao' && styles.timeFilterButtonTextActive]}>
                  Com Aprovação
                </Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.timeFilterButton, showSearch && styles.timeFilterButtonActive]}
            onPress={() => {
              setShowSearch(!showSearch);
              if (showSearch) {
                setSearchQuery('');
              }
            }}>
            <Text style={[styles.timeFilterButtonText, showSearch && styles.timeFilterButtonTextActive]}>
              🔍
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

        {/* Campo de Pesquisa - Condicional */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Buscar por nome..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Seção de Visitantes */}
        {activeSection === 'visitors' && (
          <>
            <Text style={styles.sectionTitle}>Visitantes</Text>
            {/* Lista de Visitor Logs */}
        <View style={styles.logsList}>
          {filteredVisitorLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'Nenhum visitante encontrado' : 'Nenhum registro encontrado'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim()
                  ? `Não há visitantes com o nome "${searchQuery}"`
                  : 'Não há registros de visitantes para exibir'}
              </Text>
            </View>
          ) : (
            <>
              {filteredVisitorLogs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
              {/* Botão Carregar Mais para Visitantes */}
              {hasMoreVisitorLogs && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() => {
                    const nextPage = visitorLogsPage + 1;
                    setVisitorLogsPage(nextPage);
                    fetchVisitorLogs(nextPage, true);
                  }}
                  disabled={loadingMore}>
                  <Text style={styles.loadMoreButtonText}>
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
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
            <Text style={styles.loadingText}>Carregando visitantes pré-autorizados...</Text>
          </View>
        ) : filteredPreAuthorizedVisitors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'Nenhum resultado encontrado' : 'Nenhum visitante pré-autorizado'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? `Não há visitantes pré-autorizados com o nome "${searchQuery}"`
                : 'Não há visitantes pré-autorizados pelos moradores para exibir'
              }
            </Text>
          </View>
        ) : (
          <>
            {filteredPreAuthorizedVisitors.map((activity) => (
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
                    <Text style={[styles.activityStatus, { color: activity.color }]}>{activity.status === 'direto' ? 'ENTRADA LIBERADA' : activity.status}</Text>
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

                    {/* Lógica condicional para botões de ação */}
                    {(() => {
                      // Função auxiliar para determinar se pode entrar diretamente
                      const canEnterDirectly = activity.status === 'direto' || activity.status === 'Entrada Liberada'
                                             
                      
                      if (canEnterDirectly) {
                        // Para visitantes com entrada liberada: apenas botão Confirmar Entrada
                        const isDirectAccess = activity.status === 'direto' || activity.status === 'Entrada Liberada';
                        return (
                          <TouchableOpacity 
                            style={styles.checkInButton}
                            onPress={() => handleCheckIn(activity.id)}>
                            <Text style={styles.checkInButtonText}>
                              ✅ Confirmar Entrada
                            </Text>
                          </TouchableOpacity>
                        );
                      } else {
                        // Para visitantes pendentes ou não autorizados: botão Avisar Morador
                        return (
                          <TouchableOpacity 
                            style={styles.notifyResidentButton}
                            onPress={() => handleNotifyResident(activity.id)}>
                            <Text style={styles.notifyResidentButtonText}>
                              🔔 Avisar Morador
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    })()}
                    
                  </View>
                )}
              </TouchableOpacity>
            ))}
            
            {/* Botão Carregar Mais para Pré-autorizados */}
            {hasMorePreAuthorized && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => {
                  const nextPage = preAuthorizedPage + 1;
                  setPreAuthorizedPage(nextPage);
                  fetchPreAuthorizedVisitors(nextPage, true);
                }}
                disabled={loadingMore}>
                <Text style={styles.loadMoreButtonText}>
                  {loadingMore ? 'Carregando...' : 'Carregar mais'}
                </Text>
              </TouchableOpacity>
            )}
          </>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  Subtitle: {
    fontSize: 14,
    marginVertical: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 16,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    minWidth: 44,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 10,
  },
  clearSearchButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearSearchButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
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
    marginHorizontal: 8, // Reduzido de 12 para 8 para mais espaço
    marginVertical: 12, 
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    padding: 10, // Reduzido de 12 para 10
    alignItems: 'flex-start',
    flexWrap: 'wrap', // Permite quebra de linha
  },
  activityIcon: {
    fontSize: 20, // Reduzido de 22 para 20
    marginRight: 8, // Reduzido de 10 para 8
    width: 32, // Reduzido de 36 para 32
    textAlign: 'center',
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    minWidth: 0, // Permite truncamento
    marginRight: 8, // Adiciona margem para separar do status
  },
  activityTitle: {
    fontSize: 14, // Reduzido de 15 para 14
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3, // Reduzido de 4 para 3
    flexShrink: 1,
    lineHeight: 18, // Adiciona altura de linha consistente
  },
  activitySubtitle: {
    fontSize: 12, // Reduzido de 13 para 12
    color: '#666',
    flexShrink: 1,
    lineHeight: 16, // Adiciona altura de linha consistente
  },
  activityMeta: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 70, // Reduzido de 80 para 70
    maxWidth: 100, // Adiciona largura máxima
  },
  activityStatus: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  activityTime: {
    fontSize: 10, // Reduzido de 11 para 10
    color: '#999',
    textAlign: 'right',
    lineHeight: 14, // Adiciona altura de linha consistente
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
    paddingHorizontal: 8, // Reduzido de 12 para 8
    paddingBottom: 20,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8, // Reduzido de 12 para 8
    padding: 10, // Reduzido de 12 para 10
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
    flexWrap: 'wrap', // Permite quebra de linha se necessário
  },
  logIcon: {
    width: 32, // Reduzido de 36 para 32
    height: 32, // Reduzido de 36 para 32
    borderRadius: 16, // Ajustado proporcionalmente
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // Reduzido de 10 para 8
    flexShrink: 0, // Impede que o ícone encolha
  },
  iconText: {
    fontSize: 14, // Reduzido de 16 para 14
  },
  logInfo: {
    flex: 1,
    marginRight: 6, // Reduzido de 8 para 6
    minWidth: 0, // Permite que o texto seja truncado
  },
  logTitle: {
    fontSize: 14, // Reduzido de 15 para 14
    fontWeight: '600',
    color: '#333',
    marginBottom: 3, // Reduzido de 4 para 3
    flexShrink: 1, // Permite que o título encolha se necessário
    lineHeight: 18, // Adiciona altura de linha consistente
  },
  logSubtitle: {
    fontSize: 12, // Reduzido de 13 para 12
    color: '#666',
    marginBottom: 4, // Reduzido de 6 para 4
    flexShrink: 1,
    lineHeight: 16, // Adiciona altura de linha consistente
  },
  logMeta: {
    flexDirection: 'column', // Mantém em coluna para melhor responsividade
    alignItems: 'flex-end', // Alinhado à direita para melhor layout
    gap: 2, // Reduzido de 4 para 2
    flexShrink: 0,
    minWidth: 120, // Aumentado de 60 para 120 para dar mais espaço ao status
  },
  logStatus: {
    fontSize: 9, // Reduzido para caber melhor em uma linha
    fontWeight: '600',
    textTransform: 'uppercase',
    flexShrink: 0, // Não permite encolher
    minWidth: 120, // Largura mínima para textos longos
    textAlign: 'right',
    lineHeight: 10, // Altura de linha compacta
    numberOfLines: 1, // Força uma única linha
  },
  logTime: {
    fontSize: 10, // Reduzido de 11 para 10
    color: '#999',
    flexShrink: 1,
    textAlign: 'right',
    lineHeight: 12, // Adiciona altura de linha consistente
  },
  photoContainer: {
    width: 44, // Reduzido de 50 para 44
    height: 44, // Reduzido de 50 para 44
    flexShrink: 0,
  },
  logPhoto: {
    width: 44, // Reduzido de 50 para 44
    height: 44, // Reduzido de 50 para 44
    borderRadius: 8,
  },
  logDetails: {
    marginTop: 12, // Reduzido de 16 para 12
    paddingTop: 12, // Reduzido de 16 para 12
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 12, // Reduzido de 14 para 12
    color: '#666',
    marginBottom: 6, // Reduzido de 8 para 6
    lineHeight: 16, // Reduzido de 20 para 16
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
  // Estilos para o botão de busca por apartamento
  apartmentSearchButton: {
    backgroundColor: '#4CAF50',
  },
  // Estilos para o modal de busca por apartamento
  apartmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  apartmentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
  },
  apartmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  apartmentModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  apartmentModalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: 'bold',
  },
  apartmentNumberDisplay: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  apartmentNumberText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    minHeight: 40,
  },
  numericKeypad: {
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadButton: {
    flex: 1,
    aspectRatio: 1.5,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  keypadButtonSpecial: {
    backgroundColor: '#e0e0e0',
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  keypadButtonTextSpecial: {
    fontSize: 20,
    color: '#666',
  },
  apartmentSearchActionButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  apartmentSearchActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  apartmentVisitorsList: {
    flex: 1,
  },
  apartmentVisitorsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadMoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AutorizacoesTab;