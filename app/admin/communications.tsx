import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, adminAuth } from '~/utils/supabase';

interface Building {
  id: string;
  name: string;
}

interface PollOption {
  id: string;
  text: string;
}

interface Communication {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  created_at: string;
  building: {
    name: string;
  };
}

interface Poll {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  created_at: string;
  building: {
    name: string;
  };
  poll_options: {
    id: string;
    option_text: string;
    votes_count: number;
    percentage: number;
  }[];
  total_votes: number;
}

export default function Communications() {
  const [activeTab, setActiveTab] = useState<'communications' | 'polls'>('communications');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [communication, setCommunication] = useState({
    title: '',
    content: '',
    type: 'notice',
    priority: 'normal',
    building_id: '',
    created_by: '',
  });
  const [poll, setPoll] = useState({
    title: '',
    description: '',
    expires_at: '',
    building_id: '',
    created_by: '',
  });
  const [pollOptions, setPollOptions] = useState<PollOption[]>([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateError, setDateError] = useState('');
  
  // Estados dos modais dos pickers
  const [showCommunicationTypePicker, setShowCommunicationTypePicker] = useState(false);
  const [showCommunicationPriorityPicker, setShowCommunicationPriorityPicker] = useState(false);
  const [showCommunicationBuildingPicker, setShowCommunicationBuildingPicker] = useState(false);
  const [showPollBuildingPicker, setShowPollBuildingPicker] = useState(false);
  
  // Modal states
  const [showCommunicationsModal, setShowCommunicationsModal] = useState(false);
  const [showPollsModal, setShowPollsModal] = useState(false);
  const [communicationsList, setCommunicationsList] = useState<Communication[]>([]);
  const [pollsList, setPollsList] = useState<Poll[]>([]);
  const [loadingCommunications, setLoadingCommunications] = useState(false);
  const [loadingPolls, setLoadingPolls] = useState(false);

  useEffect(() => {
    fetchBuildings();
    fetchAdminId();
  }, []);

  // Funções helper para obter labels
  const getCommunicationTypeLabel = (type: string) => {
    const types = {
      notice: 'Aviso',
      emergency: 'Emergência', 
      maintenance: 'Manutenção',
      event: 'Evento'
    };
    return types[type as keyof typeof types] || 'Aviso';
  };

  const getCommunicationPriorityLabel = (priority: string) => {
    const priorities = {
      low: 'Baixa',
      normal: 'Normal',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return priorities[priority as keyof typeof priorities] || 'Normal';
  };

  const getBuildingLabel = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    return building?.name || 'Selecione o Prédio';
  };

  // Funções para gerar opções de data e hora
  const generateDateOptions = () => {
    const options = [];
    const today = new Date();
    
    // Adicionar "Hoje" se ainda há tempo
    const todayEndOfDay = new Date(today);
    todayEndOfDay.setHours(23, 59, 59, 999);
    if (today.getHours() < 22) {
      options.push({
        label: 'Hoje',
        value: today
      });
    }
    
    // Adicionar "Amanhã"
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    options.push({
      label: 'Amanhã',
      value: tomorrow
    });
    
    // Adicionar próximos 7 dias da semana
    for (let i = 2; i <= 8; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      options.push({
        label: date.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit'
        }),
        value: date
      });
    }
    
    // Adicionar próximas 4 semanas
    for (let week = 2; week <= 5; week++) {
      for (let day = 1; day <= 7; day++) {
        const date = new Date(today);
        date.setDate(today.getDate() + (week * 7) + day);
        
        options.push({
          label: date.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          value: date
        });
      }
    }
    
    // Adicionar próximos 3 meses (primeiros dias de cada mês)
    for (let month = 1; month <= 3; month++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() + month, 1);
      
      options.push({
        label: `1° de ${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        value: date
      });
      
      // Meio do mês
      const midMonth = new Date(date);
      midMonth.setDate(15);
      options.push({
        label: `15 de ${midMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        value: midMonth
      });
      
      // Final do mês
      const endMonth = new Date(date);
      endMonth.setMonth(endMonth.getMonth() + 1, 0); // Último dia do mês
      options.push({
        label: `${endMonth.getDate()} de ${endMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        value: endMonth
      });
    }
    
    return options;
  };

  const generateTimeOptions = () => {
    const options = [];
    
    // Todas as opções de 5 em 5 minutos das 6h às 23h55
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        options.push({
          label: timeString,
          value: { hour, minute },
          isCommon: false
        });
      }
    }
    
    return options;
  };

  // Funções para atualizar data e hora das enquetes
  const updatePollDate = (newDate: Date) => {
    const currentTime = poll.expires_at ? new Date(poll.expires_at) : new Date();
    const updatedDate = new Date(newDate);
    
    if (poll.expires_at) {
      updatedDate.setHours(currentTime.getHours(), currentTime.getMinutes());
    } else {
      updatedDate.setHours(23, 59);
    }
    
    setPoll(prev => ({ ...prev, expires_at: updatedDate.toISOString() }));
    setShowDatePicker(false);
  };

  const updatePollTime = (timeValue: { hour: number; minute: number }) => {
    const currentDate = poll.expires_at ? new Date(poll.expires_at) : new Date();
    currentDate.setHours(timeValue.hour, timeValue.minute, 0, 0);
    
    setPoll(prev => ({ ...prev, expires_at: currentDate.toISOString() }));
    setShowTimePicker(false);
  };

  const fetchBuildings = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
        return;
      }
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      setBuildings(adminBuildings || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  };

  const fetchAdminId = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (currentAdmin) {
        setCommunication((prev) => ({ ...prev, created_by: currentAdmin.id }));
        setPoll((prev) => ({ ...prev, created_by: currentAdmin.id }));
      }
    } catch (error) {
      console.error('Erro ao obter ID do administrador:', error);
    }
  };

  const fetchCommunications = async () => {
    setLoadingCommunications(true);
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        Alert.alert('Erro', 'Administrador não encontrado');
        router.push('/');
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map(building => building.id) || [];

      if (buildingIds.length === 0) {
        setCommunicationsList([]);
        return;
      }

      const { data, error } = await supabase
        .from('communications')
        .select(`
          id,
          title,
          content,
          type,
          priority,
          created_at,
          building:buildings(name)
        `)
        .in('building_id', buildingIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunicationsList(data || []);
    } catch (error) {
      console.error('Erro ao carregar comunicados:', error);
      Alert.alert('Erro', 'Falha ao carregar comunicados');
    } finally {
      setLoadingCommunications(false);
    }
  };

  const fetchPolls = async () => {
    setLoadingPolls(true);
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        Alert.alert('Erro', 'Administrador não encontrado');
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map(building => building.id) || [];

      if (buildingIds.length === 0) {
        setPollsList([]);
        return;
      }

      const { data, error } = await supabase
        .from('polls')
        .select(`
          id,
          title,
          description,
          expires_at,
          created_at,
          building_id,
          poll_options(id, option_text)
        `)
        .in('building_id', buildingIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Para cada enquete, buscar contagem de votos
      const pollsWithVotes = await Promise.all(
        (data || []).map(async (poll: any) => {
          // Buscar votos para cada opção da enquete
          const optionsWithVotes = await Promise.all(
            (poll.poll_options || []).map(async (option: any) => {
              const { count, error: countError } = await supabase
                .from('poll_votes')
                .select('*', { count: 'exact', head: true })
                .eq('poll_option_id', option.id);

              if (countError) {
                console.error('Erro ao contar votos:', countError);
                return { ...option, votes_count: 0 };
              }

              return { ...option, votes_count: count || 0 };
            })
          );

          // Calcular total de votos e porcentagens
          const totalVotes = optionsWithVotes.reduce((sum, opt) => sum + opt.votes_count, 0);
          const optionsWithPercentages = optionsWithVotes.map(option => ({
            ...option,
            percentage: totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0
          }));

          return {
            ...poll,
            poll_options: optionsWithPercentages,
            total_votes: totalVotes
          };
        })
      );

      // Mapear nome do prédio manualmente para evitar dependência de relacionamento PostgREST
      const buildingNameMap = Object.fromEntries((adminBuildings || []).map((b: any) => [b.id, (b as any).name]));
      const normalized = pollsWithVotes.map((p: any) => ({
        ...p,
        building: { name: buildingNameMap[p.building_id] || '' },
      }));

      setPollsList(normalized);
    } catch (error) {
      console.error('Erro ao carregar enquetes:', error);
      Alert.alert('Erro', 'Falha ao carregar enquetes');
    } finally {
      setLoadingPolls(false);
    }
  };

  const addPollOption = () => {
    const newId = (pollOptions.length + 1).toString();
    setPollOptions([...pollOptions, { id: newId, text: '' }]);
  };

  const removePollOption = (id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter(option => option.id !== id));
    }
  };

  const updatePollOption = (id: string, text: string) => {
    setPollOptions(pollOptions.map(option => 
      option.id === id ? { ...option, text } : option
    ));
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateForDatabase = (date: Date) => {
    return date.toISOString();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const now = new Date();
      if (selectedDate <= now) {
        Alert.alert('Data inválida', 'Por favor, selecione uma data futura.');
        return;
      }
      
      setPoll(prev => ({
        ...prev,
        expires_at: selectedDate.toISOString()
      }));
    }
  };

  const showDatePickerModal = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: poll.expires_at ? new Date(poll.expires_at) : new Date(),
        onChange: onDateChange,
        mode: 'datetime',
        is24Hour: true,
        minimumDate: new Date(),
      });
    } else {
      setShowDatePicker(true);
    }
  };

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // Função para enviar notificações push para moradores e porteiros
  const sendPushNotifications = async (buildingId: string, title: string, body: string, type: 'communication' | 'poll', itemId?: string) => {
    // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS - retorna 0 usuários notificados
    console.log('📱 Push notifications desativadas - comunicado/enquete criado sem notificação');
    return 0;
    
    // try {
    //   // Buscar moradores do prédio
    //   const { data: residents, error: residentsError } = await supabase
    //     .from('apartment_residents')
    //     .select(`
    //       profiles!inner(
    //         id,
    //         full_name,
    //         expo_push_token
    //       ),
    //       apartments!inner(
    //         building_id
    //       )
    //     `)
    //     .eq('apartments.building_id', buildingId)
    //     .not('profiles.expo_push_token', 'is', null);

    //   if (residentsError) {
    //     console.error('Erro ao buscar moradores:', residentsError);
    //   }

    //   // Apenas moradores recebem comunicados - porteiros removidos conforme solicitado
    //   const allUsers = [
    //     ...(residents?.map(r => r.profiles) || [])
    //   ].filter(user => user.expo_push_token);

    //   console.log(`Enviando notificações para ${allUsers.length} usuários`);

    //   // Enviar notificação para cada usuário
    //   for (const user of allUsers) {
    //     try {
    //       await Notifications.scheduleNotificationAsync({
    //         content: {
    //           title,
    //           body,
    //           data: {
    //             type,
    //             building_id: buildingId,
    //             item_id: itemId,
    //             user_id: user.id
    //           },
    //         },
    //         trigger: null, // Imediato
    //       });

    //       console.log(`📱 Notificação enviada para ${user.full_name || user.id}`);
    //     } catch (pushError) {
    //       console.error(`❌ Erro ao enviar push para usuário ${user.id}:`, pushError);
    //     }
    //   }

    //   return allUsers.length;
    // } catch (error) {
    //   console.error('❌ Erro geral ao enviar notificações push:', error);
    //   return 0;
    // }
  };

  const handleSendCommunication = async () => {
    if (!communication.title || !communication.content || !communication.building_id || !communication.created_by) {
      Alert.alert('Erro', 'Título, conteúdo, prédio e criador são obrigatórios');
      return;
    }

    try {
      const { data: communicationData, error } = await supabase.from('communications').insert({
        title: communication.title,
        content: communication.content,
        type: communication.type,
        priority: communication.priority,
        building_id: communication.building_id,
        created_by: communication.created_by,
      }).select('id').single();

      if (error) throw error;

      // Enviar notificações push
      const typeEmoji = {
        notice: '📢',
        emergency: '🚨',
        maintenance: '🔧',
        event: '🎉'
      }[communication.type] || '📢';

      const priorityText = communication.priority === 'high' ? ' [URGENTE]' : '';
      const notificationTitle = `${typeEmoji} Novo Comunicado${priorityText}`;
      const notificationBody = `${communication.title}\n${communication.content.substring(0, 100)}${communication.content.length > 100 ? '...' : ''}`;

      const notificationsSent = await sendPushNotifications(
        communication.building_id,
        notificationTitle,
        notificationBody,
        'communication',
        communicationData.id
      );

      Alert.alert('Sucesso', `Comunicado enviado com sucesso para ${notificationsSent} usuários`);
      setCommunication({
        title: '',
        content: '',
        type: 'notice',
        priority: 'normal',
        building_id: '',
        created_by: communication.created_by, // Keep created_by for subsequent sends
      });
    } catch (error) {
      Alert.alert('Erro', 'Falha ao enviar comunicado: ' + error.message);
      console.log('Erro', 'Falha ao enviar comunicado: ' + error.message);
    }
  };

  const handleCreatePoll = async () => {
    if (!poll.title || !poll.description || !poll.building_id || !poll.created_by || !poll.expires_at) {
      Alert.alert('Erro', 'Título, descrição, prédio, data de expiração e criador são obrigatórios');
      return;
    }

    // Validação adicional da data de expiração
    const expirationDate = new Date(poll.expires_at);
    const now = new Date();
    if (expirationDate <= now) {
      Alert.alert('Erro', 'A data de expiração deve ser posterior à data atual');
      return;
    }

    const validOptions = pollOptions.filter(option => option.text.trim() !== '');
    if (validOptions.length < 2) {
      Alert.alert('Erro', 'É necessário pelo menos 2 opções de resposta');
      return;
    }

    try {
      // Inserir a enquete
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .insert({
          title: poll.title,
          question: poll.description, // Campo obrigatório 'question'
          description: poll.description,
          expires_at: poll.expires_at,
          building_id: poll.building_id,
          created_by: poll.created_by,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Inserir as opções da enquete
      const optionsToInsert = validOptions.map(option => ({
        poll_id: pollData.id,
        option_text: option.text,
      }));

      const { error: optionsError } = await supabase
        .from('poll_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      // Enviar notificações push
      const expirationDateFormatted = new Date(poll.expires_at).toLocaleDateString('pt-BR');
      const notificationTitle = '📊 Nova Enquete Disponível';
      const notificationBody = `${poll.title}\n${poll.description.substring(0, 80)}${poll.description.length > 80 ? '...' : ''}\nExpira em: ${expirationDateFormatted}`;

      const notificationsSent = await sendPushNotifications(
        poll.building_id,
        notificationTitle,
        notificationBody,
        'poll',
        pollData.id
      );

      Alert.alert('Sucesso', `Enquete criada com sucesso e enviada para moradores`);
      setPoll({
        title: '',
        description: '',
        expires_at: '',
        building_id: '',
        created_by: poll.created_by, // Keep created_by for subsequent polls
      });
      setPollOptions([{ id: '1', text: '' }, { id: '2', text: '' }]);
      setSelectedDate(new Date());
      setDateError('');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar enquete: ' + error.message);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
      <Text style={styles.title}>
        {activeTab === 'communications' ? '📢 Comunicados' : '📊 Enquetes'}
      </Text>
      </View>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'communications' && styles.activeTab]}
          onPress={() => setActiveTab('communications')}>
          <Text style={[styles.tabText, activeTab === 'communications' && styles.activeTabText]}>
            Comunicados
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'polls' && styles.activeTab]}
          onPress={() => setActiveTab('polls')}>
          <Text style={[styles.tabText, activeTab === 'polls' && styles.activeTabText]}>
            Enquetes
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCommunications = () => (
    <View style={[styles.content, { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
      <View style={{ alignItems: 'center' }}>
        <Image 
          source={require('../../assets/logo-james-fundo.png')} 
          style={{ width: 120, height: 120, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
          Este recurso não está disponível neste plano
        </Text>
      </View>
    </View>
  );

  const renderCommunicationsModal = () => (
    <Modal
      visible={showCommunicationsModal}
      animationType="slide"
      presentationStyle="fullScreen">
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowCommunicationsModal(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>📋 Comunicados</Text>
        </View>
        
        {loadingCommunications ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando comunicados...</Text>
          </View>
        ) : (
          <FlatList
            data={communicationsList}
            keyExtractor={(item) => item.id}
            style={styles.modalContent}
            renderItem={({ item }) => (
              <View style={styles.communicationItem}>
                <View style={styles.communicationHeader}>
                  <Text style={styles.communicationTitle}>{item.title}</Text>
                  <View style={styles.communicationMeta}>
                    <Text style={styles.communicationType}>
                      {item.type === 'notice' ? '📢 Aviso' :
                       item.type === 'emergency' ? '🚨 Emergência' :
                       item.type === 'maintenance' ? '🔧 Manutenção' : '🎉 Evento'}
                    </Text>
                    <Text style={styles.communicationPriority}>
                      {item.priority === 'high' ? '🔴 Alta' :
                       item.priority === 'low' ? '🟢 Baixa' : '🟡 Normal'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.communicationContent}>{item.content}</Text>
                <View style={styles.communicationFooter}>
                  <Text style={styles.communicationBuilding}>🏢 {item.building?.name}</Text>
                  <Text style={styles.communicationDate}>
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhum comunicado encontrado</Text>
              </View>
            }
          />
        )}
    </Modal>
  );

  const renderPollsModal = () => (
    <Modal
      visible={showPollsModal}
      animationType="slide"
      presentationStyle="fullScreen">
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowPollsModal(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>📊 Enquetes</Text>
        </View>
        
        {loadingPolls ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando enquetes...</Text>
          </View>
        ) : (
          <FlatList
            data={pollsList}
            keyExtractor={(item) => item.id}
            style={styles.modalContent}
            renderItem={({ item }) => (
              <View style={styles.pollItem}>
                <View style={styles.pollHeader}>
                  <Text style={styles.pollTitle}>{item.title}</Text>
                  <Text style={styles.pollStatus}>
                    {new Date(item.expires_at) > new Date() ? '🟢 Ativa' : '🔴 Expirada'}
                  </Text>
                </View>
                <Text style={styles.pollDescription}>{item.description}</Text>
                
                <View style={styles.pollOptions}>
                  <Text style={styles.pollOptionsTitle}>Opções e Resultados:</Text>
                  {item.poll_options?.map((option, index) => (
                    <View key={option.id} style={styles.pollOptionContainer}>
                      <Text style={styles.pollOption}>
                        {index + 1}. {option.option_text}
                      </Text>
                      <View style={styles.pollVoteInfo}>
                        <Text style={styles.pollVoteCount}>
                          {option.votes_count} votos ({option.percentage}%)
                        </Text>
                        <View style={styles.pollProgressBar}>
                          <View 
                            style={[
                              styles.pollProgressFill, 
                              { width: `${option.percentage}%` }
                            ]} 
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
                
                <View style={styles.pollTotalVotes}>
                  <Text style={styles.pollTotalVotesText}>
                    📊 Total de votos: {item.total_votes}
                  </Text>
                </View>
                
                <View style={styles.pollFooter}>
                  <Text style={styles.pollBuilding}>🏢 {item.building?.name}</Text>
                  <Text style={styles.pollDate}>
                    Expira: {new Date(item.expires_at).toLocaleString('pt-BR')}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhuma enquete encontrada</Text>
              </View>
            }
          />
        )}
    </Modal>
  );

  const renderPolls = () => (
    <ScrollView style={styles.content}>
      <View style={styles.communicationsHeader}>
        <TouchableOpacity
          style={styles.listCommunicationsButton}
          onPress={() => {
            setShowPollsModal(true);
            fetchPolls();
          }}>
          <Text style={styles.listCommunicationsButtonText}>📊 Listar Todas as Enquetes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.communicationForm}>
        <Text style={styles.formTitle}>Criar Enquete</Text>

        <TextInput
          style={styles.input}
          placeholder="Título da enquete"
          value={poll.title}
          onChangeText={(text) => setPoll((prev) => ({ ...prev, title: text }))}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Descrição da enquete"
          value={poll.description}
          onChangeText={(text) => setPoll((prev) => ({ ...prev, description: text }))}
          multiline
          numberOfLines={3}
        />

        <View style={styles.datePickerContainer}>
          <Text style={styles.dateLabel}>Data de Expiração:</Text>
          <View style={styles.dateTimePickerContainer}>
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 1, marginRight: 8 }]} 
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {poll.expires_at 
                  ? new Date(poll.expires_at).toLocaleDateString('pt-BR') 
                  : 'Selecionar data'
                }
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 1, marginLeft: 8 }]} 
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {poll.expires_at 
                  ? new Date(poll.expires_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) 
                  : 'Selecionar hora'
                }
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>
          </View>
          {dateError ? (
            <Text style={styles.errorText}>{dateError}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPollBuildingPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getBuildingLabel(poll.building_id)}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.optionsTitle}>Opções de Resposta:</Text>
        {pollOptions.map((option, index) => (
          <View key={option.id} style={styles.optionContainer}>
            <TextInput
              style={[styles.input, styles.optionInput]}
              placeholder={`Opção ${index + 1}`}
              value={option.text}
              onChangeText={(text) => updatePollOption(option.id, text)}
            />
            {pollOptions.length > 2 && (
              <TouchableOpacity
                style={styles.removeOptionButton}
                onPress={() => removePollOption(option.id)}>
                <Text style={styles.removeOptionText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addOptionButton} onPress={addPollOption}>
          <Text style={styles.addOptionText}>+ Adicionar Opção</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendButton} onPress={handleCreatePoll}>
          <Text style={styles.sendButtonText}>Criar Enquete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {activeTab === 'communications' ? renderCommunications() : renderPolls()}
      {renderCommunicationsModal()}
      {renderPollsModal()}
      
      {/* Modal para Tipo de Comunicação */}
      <Modal
        visible={showCommunicationTypePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCommunicationTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Tipo</Text>
              <TouchableOpacity onPress={() => setShowCommunicationTypePicker(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {[
                { label: 'Aviso', value: 'notice' },
                { label: 'Emergência', value: 'emergency' },
                { label: 'Manutenção', value: 'maintenance' },
                { label: 'Evento', value: 'event' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalOption,
                    communication.type === item.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setCommunication(prev => ({ ...prev, type: item.value }));
                    setShowCommunicationTypePicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    communication.type === item.value && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {communication.type === item.value && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Prioridade de Comunicação */}
      <Modal
        visible={showCommunicationPriorityPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCommunicationPriorityPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Prioridade</Text>
              <TouchableOpacity onPress={() => setShowCommunicationPriorityPicker(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {[
                { label: 'Baixa', value: 'low' },
                { label: 'Normal', value: 'normal' },
                { label: 'Alta', value: 'high' },
                { label: 'Urgente', value: 'urgent' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalOption,
                    communication.priority === item.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setCommunication(prev => ({ ...prev, priority: item.value }));
                    setShowCommunicationPriorityPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    communication.priority === item.value && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {communication.priority === item.value && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Prédio de Comunicação */}
      <Modal
        visible={showCommunicationBuildingPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCommunicationBuildingPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Prédio</Text>
              <TouchableOpacity onPress={() => setShowCommunicationBuildingPicker(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {buildings.map((building) => (
                <TouchableOpacity
                  key={building.id}
                  style={[
                    styles.modalOption,
                    communication.building_id === building.id && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setCommunication(prev => ({ ...prev, building_id: building.id }));
                    setShowCommunicationBuildingPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    communication.building_id === building.id && styles.modalOptionTextSelected
                  ]}>
                    {building.name}
                  </Text>
                  {communication.building_id === building.id && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Prédio de Enquete */}
      <Modal
        visible={showPollBuildingPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPollBuildingPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Prédio</Text>
              <TouchableOpacity onPress={() => setShowPollBuildingPicker(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {buildings.map((building) => (
                <TouchableOpacity
                  key={building.id}
                  style={[
                    styles.modalOption,
                    poll.building_id === building.id && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setPoll(prev => ({ ...prev, building_id: building.id }));
                    setShowPollBuildingPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    poll.building_id === building.id && styles.modalOptionTextSelected
                  ]}>
                    {building.name}
                  </Text>
                  {poll.building_id === building.id && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Data */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Data</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {generateDateOptions().map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalOption,
                    poll.expires_at && new Date(poll.expires_at).toDateString() === item.value.toDateString() && styles.modalOptionSelected
                  ]}
                  onPress={() => updatePollDate(item.value)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    poll.expires_at && new Date(poll.expires_at).toDateString() === item.value.toDateString() && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {poll.expires_at && new Date(poll.expires_at).toDateString() === item.value.toDateString() && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Hora */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Hora</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {generateTimeOptions().map((item, index) => {
                const currentTime = poll.expires_at ? new Date(poll.expires_at) : null;
                const isSelected = currentTime && 
                  currentTime.getHours() === item.value.hour && 
                  currentTime.getMinutes() === item.value.minute;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.modalOption,
                      isSelected && styles.modalOptionSelected
                    ]}
                    onPress={() => updatePollTime(item.value)}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextSelected
                    ]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Text style={styles.modalCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingBottom: 15,
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: "center",
    flexDirection: "row",
    paddingTop: 20,
    gap: 34,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FF9800',
  },
  content: {
    flex: 1,
  },
  communicationsHeader: {
    padding: 20,
    paddingBottom: 0,
  },
  listCommunicationsButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  listCommunicationsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  communicationForm: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    minHeight: 50,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    minHeight: 50,
    justifyContent: 'center',
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 5,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  removeOptionButton: {
    backgroundColor: '#f44336',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addOptionButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  addOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerContainer: {
    marginBottom: 15,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    minHeight: 50,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#FF9800',
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 33,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginRight: 80,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Communication item styles
  communicationItem: {
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
  communicationHeader: {
    marginBottom: 8,
  },
  communicationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  communicationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  communicationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  communicationPriority: {
    fontSize: 14,
    fontWeight: '600',
  },
  communicationContent: {
    fontSize: 16,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  communicationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  communicationBuilding: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  communicationDate: {
    fontSize: 12,
    color: '#999',
  },
  // Poll item styles
  pollItem: {
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
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pollTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
    marginBottom: 16,
  },
  pollStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  pollDescription: {
    fontSize: 16,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  pollOptions: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pollOptionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  pollOption: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    paddingLeft: 8,
  },
  pollOptionContainer: {
    marginBottom: 8,
  },
  pollVoteInfo: {
    marginTop: 4,
    paddingLeft: 8,
  },
  pollVoteCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  pollProgressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  pollProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  pollTotalVotes: {
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  pollTotalVotesText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
  },
  pollFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  pollBuilding: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  pollDate: {
    fontSize: 12,
    color: '#999',
  },
  // Estilos dos modais dos pickers
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
    minWidth: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalCheckmark: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  modalSeparator: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  modalSeparatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOptionCommon: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  modalOptionTextCommon: {
    color: '#92400e',
    fontWeight: '600',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 15,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pickerChevron: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  dateTimePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Estilos da mensagem de manutenção
  maintenanceContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    letterSpacing: 1,
  },
  maintenanceIcon: {
    marginBottom: 20,
    backgroundColor: '#fef3c7',
    borderRadius: 50,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maintenanceIconText: {
    fontSize: 36,
  },
  maintenanceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  maintenanceMessage: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    fontWeight: '500',
  },
  maintenanceSubMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  maintenanceFooter: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    width: '100%',
  },
  maintenanceFooterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  maintenanceTime: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
