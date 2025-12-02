import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';
import { adminAuth, supabase } from '~/utils/supabase';

interface Building {
  id: string;
  name: string;
}

interface PollOption {
  id: string;
  text: string;
}

type CommunicationType = 'notice' | 'emergency' | 'maintenance' | 'event';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface CommunicationFormState {
  title: string;
  content: string;
  type: CommunicationType | undefined;
  priority: Priority | undefined;
  buildingId: string | undefined;
  buildingName: string | undefined;
}

interface PollFormState {
  title: string;
  description: string;
  dateISO: string | undefined;
  time: string | undefined;
  expiresAt: string | undefined;
  buildingId: string | undefined;
  buildingName: string | undefined;
}

type ComunicadosReturnParams = {
  selectedCommunicationId?: string;
  selectedPollId?: string;
};

export default function Communications() {
  const navigation = useNavigation<any>();
  const params = useLocalSearchParams<ComunicadosReturnParams>();

  const [activeTab, setActiveTab] = useState<'communications' | 'polls'>('communications');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [form, setForm] = useState<CommunicationFormState>({
    title: '',
    content: '',
    type: 'notice',
    priority: 'normal',
    buildingId: undefined,
    buildingName: undefined,
  });
  const [adminId, setAdminId] = useState('');
  const [pollForm, setPollForm] = useState<PollFormState>({
    title: '',
    description: '',
    dateISO: undefined,
    time: undefined,
    expiresAt: undefined,
    buildingId: undefined,
    buildingName: undefined,
  });
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' },
  ]);
  const [dateError, setDateError] = useState('');
  const [selectedCommunicationId, setSelectedCommunicationId] = useState<string | undefined>();
  const [selectedPollId, setSelectedPollId] = useState<string | undefined>();

  // Bottom sheet controls
  const typeSheetRef = useRef<BottomSheetModalRef>(null);
  const prioritySheetRef = useRef<BottomSheetModalRef>(null);
  const buildingSheetRef = useRef<BottomSheetModalRef>(null);
  const dateSheetRef = useRef<BottomSheetModalRef>(null);
  const timeSheetRef = useRef<BottomSheetModalRef>(null);

  const [typeSheetVisible, setTypeSheetVisible] = useState(false);
  const [prioritySheetVisible, setPrioritySheetVisible] = useState(false);
  const [buildingSheetVisible, setBuildingSheetVisible] = useState(false);
  const [buildingPickerContext, setBuildingPickerContext] = useState<'communication' | 'poll' | null>(
    null
  );
  const [dateSheetVisible, setDateSheetVisible] = useState(false);
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);

  const clearParam = (key: keyof ComunicadosReturnParams) => {
    if (typeof navigation?.setParams === 'function') {
      navigation.setParams({ [key]: undefined });
      return;
    }
    router.replace({
      pathname: '/admin/comunicados',
      params: {},
    });
  };

  useEffect(() => {
    fetchBuildings();
    fetchAdminId();
  }, []);

  useEffect(() => {
    if (params.selectedCommunicationId) {
      setSelectedCommunicationId(params.selectedCommunicationId);
      clearParam('selectedCommunicationId');
    }
  }, [params.selectedCommunicationId]);

  useEffect(() => {
    if (params.selectedPollId) {
      setSelectedPollId(params.selectedPollId);
      clearParam('selectedPollId');
    }
  }, [params.selectedPollId]);

  const communicationTypeOptions: Array<{ value: CommunicationType; label: string; emoji: string }> =
    [
      { value: 'notice', label: 'Aviso', emoji: '📢' },
      { value: 'emergency', label: 'Emergência', emoji: '🚨' },
      { value: 'maintenance', label: 'Manutenção', emoji: '🔧' },
      { value: 'event', label: 'Evento', emoji: '🎉' },
    ];

  const priorityOptions: Array<{ value: Priority; label: string; emoji: string }> = [
    { value: 'low', label: 'Baixa', emoji: '🟢' },
    { value: 'normal', label: 'Normal', emoji: '🟡' },
    { value: 'high', label: 'Alta', emoji: '🟠' },
    { value: 'urgent', label: 'Urgente', emoji: '🔴' },
  ];

  const openBuildingSheet = (context: 'communication' | 'poll') => {
    setBuildingPickerContext(context);
    setBuildingSheetVisible(true);
  };

  const closeBuildingSheet = () => {
    setBuildingSheetVisible(false);
    setBuildingPickerContext(null);
  };

  // Funções helper para obter labels
  const getCommunicationTypeLabel = (type?: CommunicationType) => {
    const types = {
      notice: 'Aviso',
      emergency: 'Emergência',
      maintenance: 'Manutenção',
      event: 'Evento',
    };
    return type ? types[type] : 'Selecione o tipo';
  };

  const getCommunicationPriorityLabel = (priority?: Priority) => {
    const priorities = {
      low: 'Baixa',
      normal: 'Normal',
      high: 'Alta',
      urgent: 'Urgente',
    };
    return priority ? priorities[priority] : 'Selecione a prioridade';
  };

  const getBuildingLabel = (buildingId?: string, fallback?: string) => {
    if (fallback) return fallback;
    if (!buildingId) return 'Selecione o Prédio';
    const building = buildings.find((b) => b.id === buildingId);
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
        value: today,
      });
    }

    // Adicionar "Amanhã"
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    options.push({
      label: 'Amanhã',
      value: tomorrow,
    });

    // Adicionar próximos 7 dias da semana
    for (let i = 2; i <= 8; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      options.push({
        label: date.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        }),
        value: date,
      });
    }

    // Adicionar próximas 4 semanas
    for (let week = 2; week <= 5; week++) {
      for (let day = 1; day <= 7; day++) {
        const date = new Date(today);
        date.setDate(today.getDate() + week * 7 + day);

        options.push({
          label: date.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          value: date,
        });
      }
    }

    // Adicionar próximos 3 meses (primeiros dias de cada mês)
    for (let month = 1; month <= 3; month++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() + month, 1);

      options.push({
        label: `1° de ${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        value: date,
      });

      // Meio do mês
      const midMonth = new Date(date);
      midMonth.setDate(15);
      options.push({
        label: `15 de ${midMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        value: midMonth,
      });

      // Final do mês
      const endMonth = new Date(date);
      endMonth.setMonth(endMonth.getMonth() + 1, 0); // Último dia do mês
      options.push({
        label: `${endMonth.getDate()} de ${endMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        value: endMonth,
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
          isCommon: false,
        });
      }
    }

    return options;
  };

  const buildDateTimeISO = (dateISO?: string, time?: string) => {
    if (!dateISO) return undefined;
    const [year, month, day] = dateISO.split('-').map(Number);
    const [hour, minute] = (time ?? '23:59').split(':').map(Number);
    const combined = new Date();
    combined.setFullYear(year, (month ?? 1) - 1, day ?? 1);
    combined.setHours(hour ?? 23, minute ?? 59, 0, 0);
    return combined.toISOString();
  };

  // Funções para atualizar data e hora das enquetes
  const updatePollDate = (newDate: Date) => {
    const dateISO = newDate.toISOString().split('T')[0];
    setPollForm((prev) => ({
      ...prev,
      dateISO,
      expiresAt: buildDateTimeISO(dateISO, prev.time),
    }));
    setDateSheetVisible(false);
    setDateError('');
  };

  const updatePollTime = (timeValue: { hour: number; minute: number }) => {
    const timeString = `${timeValue.hour.toString().padStart(2, '0')}:${timeValue.minute
      .toString()
      .padStart(2, '0')}`;
    setPollForm((prev) => ({
      ...prev,
      time: timeString,
      expiresAt: buildDateTimeISO(prev.dateISO, timeString),
    }));
    setTimeSheetVisible(false);
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
        setAdminId(currentAdmin.id);
      }
    } catch (error) {
      console.error('Erro ao obter ID do administrador:', error);
    }
  };

  const addPollOption = () => {
    const newId = (pollOptions.length + 1).toString();
    setPollOptions([...pollOptions, { id: newId, text: '' }]);
  };

  const removePollOption = (id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((option) => option.id !== id));
    }
  };

  const updatePollOption = (id: string, text: string) => {
    setPollOptions(pollOptions.map((option) => (option.id === id ? { ...option, text } : option)));
  };

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  // Função para enviar notificações push para moradores e porteiros
  const sendPushNotifications = async (
    buildingId: string,
    title: string,
    body: string,
    type: 'communication' | 'poll',
    itemId?: string
  ) => {
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
    if (!form.title || !form.content || !form.buildingId || !adminId) {
      Alert.alert('Erro', 'Título, conteúdo, prédio e criador são obrigatórios');
      return;
    }

    try {
      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_profiles')
        .select('id, full_name')
        .eq('id', adminId)
        .single();

      if (adminError || !adminProfile) {
        console.error('🔥 Admin não encontrado:', adminError);
        Alert.alert('Erro', 'Administrador não encontrado. Faça login novamente.');
        return;
      }

      const payload = {
        title: form.title,
        content: form.content,
        type: form.type ?? 'notice',
        priority: form.priority ?? 'normal',
        building_id: form.buildingId as string,
        created_by: adminId,
      };

      const { error } = await supabase.rpc('create_communication', {
        p_title: payload.title,
        p_content: payload.content,
        p_type: payload.type,
        p_priority: payload.priority,
        p_building_id: payload.building_id,
        p_created_by: payload.created_by,
      });

      if (error) {
        console.error('🔥 Erro RPC create_communication:', error);
        const { error: directError } = await supabase.from('communications').insert(payload);
        if (directError) {
          throw directError;
        }
      }

      Alert.alert('Sucesso', 'Comunicado enviado com sucesso!');
      setForm((prev) => ({
        ...prev,
        title: '',
        content: '',
        buildingId: undefined,
        buildingName: undefined,
      }));
    } catch (error: any) {
      console.error('🔥 Erro ao enviar comunicado:', error);
      Alert.alert('Erro', 'Falha ao enviar comunicado: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleCreatePoll = async () => {
    if (
      !pollForm.title ||
      !pollForm.description ||
      !pollForm.buildingId ||
      !adminId ||
      !pollForm.expiresAt
    ) {
      Alert.alert(
        'Erro',
        'Título, descrição, prédio, data de expiração e criador são obrigatórios'
      );
      if (!pollForm.expiresAt) {
        setDateError('Selecione uma data e horário válidos');
      }
      return;
    }

    const expirationDate = new Date(pollForm.expiresAt);
    if (expirationDate <= new Date()) {
      Alert.alert('Erro', 'A data de expiração deve ser posterior à data atual');
      return;
    }

    const validOptions = pollOptions.filter((option) => option.text.trim() !== '');
    if (validOptions.length < 2) {
      Alert.alert('Erro', 'É necessário pelo menos 2 opções de resposta');
      return;
    }

    try {
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .insert({
          title: pollForm.title,
          question: pollForm.description,
          description: pollForm.description,
          expires_at: pollForm.expiresAt,
          building_id: pollForm.buildingId as string,
          created_by: adminId,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      const optionsToInsert = validOptions.map((option) => ({
        poll_id: pollData.id,
        option_text: option.text,
      }));

      const { error: optionsError } = await supabase.from('poll_options').insert(optionsToInsert);

      if (optionsError) throw optionsError;

      const notificationTitle = '📊 Nova Enquete Disponível';
      const notificationBody = `${pollForm.title}
${pollForm.description.substring(0, 80)}${
        pollForm.description.length > 80 ? '...' : ''
      }
Expira em: ${expirationDate.toLocaleDateString('pt-BR')}`;

      await sendPushNotifications(
        pollForm.buildingId as string,
        notificationTitle,
        notificationBody,
        'poll',
        pollData.id
      );

      Alert.alert('Sucesso', `Enquete criada com sucesso e enviada para moradores`);
      setPollForm({
        title: '',
        description: '',
        dateISO: undefined,
        time: undefined,
        expiresAt: undefined,
        buildingId: undefined,
        buildingName: undefined,
      });
      setPollOptions([
        { id: '1', text: '' },
        { id: '2', text: '' },
      ]);
      setDateError('');
    } catch (error) {
      Alert.alert(
        'Erro',
        'Falha ao criar enquete: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      );
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
    <ScrollView style={styles.content}>
      <View style={styles.communicationsHeader}>
        <TouchableOpacity
          style={styles.listCommunicationsButton}
          onPress={() =>
            router.push({
              pathname: '/admin/communications',
              params: { mode: 'select' },
            })
          }>
          <Text style={styles.listCommunicationsButtonText}>📋 Listar Todos os Comunicados</Text>
        </TouchableOpacity>
        {selectedCommunicationId ? (
          <View style={styles.selectionBadge}>
            <Text style={styles.selectionBadgeText}>
              Último selecionado: {selectedCommunicationId}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.communicationForm}>
        <Text style={styles.formTitle}>Criar Comunicado</Text>

        <TextInput
          style={styles.input}
          placeholder="Título do comunicado"
          value={form.title}
          onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Conteúdo do comunicado"
          value={form.content}
          onChangeText={(text) => setForm((prev) => ({ ...prev, content: text }))}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity style={styles.pickerButton} onPress={() => setTypeSheetVisible(true)}>
          <Text style={styles.pickerButtonText}>{getCommunicationTypeLabel(form.type)}</Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setPrioritySheetVisible(true)}>
          <Text style={styles.pickerButtonText}>
            {getCommunicationPriorityLabel(form.priority)}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => openBuildingSheet('communication')}>
          <Text style={styles.pickerButtonText}>
            {form.buildingName || getBuildingLabel(form.buildingId)}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendButton} onPress={handleSendCommunication}>
          <Text style={styles.sendButtonText}>Enviar Comunicado</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderPolls = () => {
    const expirationDateLabel = pollForm.expiresAt
      ? new Date(pollForm.expiresAt).toLocaleDateString('pt-BR')
      : 'Selecionar data';
    const expirationTimeLabel = pollForm.expiresAt
      ? new Date(pollForm.expiresAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Selecionar hora';

    return (
      <ScrollView style={styles.content}>
        <View style={styles.communicationsHeader}>
          <TouchableOpacity
            style={styles.listCommunicationsButton}
            onPress={() =>
            router.push({
                pathname: '/admin/polls',
                params: { mode: 'select' },
              })
            }>
            <Text style={styles.listCommunicationsButtonText}>📊 Listar Todas as Enquetes</Text>
          </TouchableOpacity>
          {selectedPollId ? (
            <View style={styles.selectionBadge}>
              <Text style={styles.selectionBadgeText}>Última selecionada: {selectedPollId}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.communicationForm}>
          <Text style={styles.formTitle}>Criar Enquete</Text>

          <TextInput
            style={styles.input}
            placeholder="Título da enquete"
            value={pollForm.title}
            onChangeText={(text) => setPollForm((prev) => ({ ...prev, title: text }))}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descrição da enquete"
            value={pollForm.description}
            onChangeText={(text) => setPollForm((prev) => ({ ...prev, description: text }))}
            multiline
            numberOfLines={3}
          />

          <View style={styles.datePickerContainer}>
            <Text style={styles.dateLabel}>Data de Expiração:</Text>
            <View style={styles.dateTimePickerContainer}>
              <TouchableOpacity
                style={[styles.pickerButton, styles.dateButtonHalf]}
                onPress={() => setDateSheetVisible(true)}>
                <Text style={styles.pickerButtonText}>{expirationDateLabel}</Text>
                <Text style={styles.pickerChevron}>▼</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickerButton, styles.dateButtonHalf]}
                onPress={() => setTimeSheetVisible(true)}>
                <Text style={styles.pickerButtonText}>{expirationTimeLabel}</Text>
                <Text style={styles.pickerChevron}>▼</Text>
              </TouchableOpacity>
            </View>
            {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => openBuildingSheet('poll')}>
            <Text style={styles.pickerButtonText}>
              {pollForm.buildingName || getBuildingLabel(pollForm.buildingId)}
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
                  <Text style={styles.removeOptionText}>−</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addOptionButton} onPress={addPollOption}>
            <Text style={styles.addOptionText}>Adicionar Opção</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sendButton} onPress={handleCreatePoll}>
            <Text style={styles.sendButtonText}>Criar Enquete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderBottomSheets = () => (
    <>
      <BottomSheetModal
        ref={typeSheetRef}
        visible={typeSheetVisible}
        onClose={() => setTypeSheetVisible(false)}
        snapPoints={45}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Tipo do Comunicado</Text>
          <Text style={styles.sheetSubtitle}>Escolha o tipo que melhor representa o conteúdo</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {communicationTypeOptions.map((option) => {
            const isSelected = form.type === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => {
                  setForm((prev) => ({ ...prev, type: option.value }));
                  setTypeSheetVisible(false);
                }}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {option.emoji} {option.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={prioritySheetRef}
        visible={prioritySheetVisible}
        onClose={() => setPrioritySheetVisible(false)}
        snapPoints={45}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Prioridade</Text>
          <Text style={styles.sheetSubtitle}>Defina a criticidade para os moradores</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {priorityOptions.map((option) => {
            const isSelected = form.priority === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => {
                  setForm((prev) => ({ ...prev, priority: option.value }));
                  setPrioritySheetVisible(false);
                }}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {option.emoji} {option.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={buildingSheetRef}
        visible={buildingSheetVisible}
        onClose={closeBuildingSheet}
        snapPoints={60}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {buildingPickerContext === 'poll' ? 'Prédio da Enquete' : 'Prédio do Comunicado'}
          </Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {buildings.length === 0 ? (
            <View style={styles.bottomSheetEmpty}>
              <Text style={styles.bottomSheetEmptyText}>Nenhum prédio disponível.</Text>
            </View>
          ) : (
            buildings.map((building) => {
              const isCommunication = buildingPickerContext === 'communication';
              const isSelected = isCommunication
                ? form.buildingId === building.id
                : pollForm.buildingId === building.id;
              return (
                <TouchableOpacity
                  key={building.id}
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  onPress={() => {
                    if (isCommunication) {
                      setForm((prev) => ({
                        ...prev,
                        buildingId: building.id,
                        buildingName: building.name,
                      }));
                    } else {
                      setPollForm((prev) => ({
                        ...prev,
                        buildingId: building.id,
                        buildingName: building.name,
                      }));
                    }
                    closeBuildingSheet();
                  }}>
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    {building.name}
                  </Text>
                  {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={dateSheetRef}
        visible={dateSheetVisible}
        onClose={() => setDateSheetVisible(false)}
        snapPoints={65}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Selecionar Data</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {generateDateOptions().map((item, index) => {
            const isSelected =
              pollForm.dateISO &&
              pollForm.dateISO === item.value.toISOString().split('T')[0];
            return (
              <TouchableOpacity
                key={`${item.label}-${index}`}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => updatePollDate(item.value)}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {item.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={timeSheetRef}
        visible={timeSheetVisible}
        onClose={() => setTimeSheetVisible(false)}
        snapPoints={70}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Selecionar Hora</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {generateTimeOptions().map((item, index) => {
            const isSelected = pollForm.time
              ? pollForm.time === item.label
              : false;
            return (
              <TouchableOpacity
                key={`${item.label}-${index}`}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => updatePollTime(item.value)}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {item.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {activeTab === 'communications' ? renderCommunications() : renderPolls()}
      {renderBottomSheets()}
    </View>
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
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
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
    fontSize: 18,
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
  dateButtonHalf: {
    flex: 1,
    marginHorizontal: 4,
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
  selectionBadge: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  selectionBadgeText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '600',
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
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
    minWidth: '80%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  pickerModalCloseText: {
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
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSheetEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  bottomSheetEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
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
