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
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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

export default function Polls() {
  const [buildings, setBuildings] = useState<Building[]>([]);
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
  const [showPollBuildingPicker, setShowPollBuildingPicker] = useState(false);
  
  // Modal states
  const [showPollsModal, setShowPollsModal] = useState(false);
  const [pollsList, setPollsList] = useState<Poll[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);

  useEffect(() => {
    fetchBuildings();
    fetchAdminId();
  }, []);

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
        setPoll((prev) => ({ ...prev, created_by: currentAdmin.id }));
      }
    } catch (error) {
      console.error('Erro ao obter ID do administrador:', error);
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
      // DateTimePickerAndroid.open({
      //   value: poll.expires_at ? new Date(poll.expires_at) : new Date(),
      //   onChange: onDateChange,
      //   mode: 'datetime',
      //   is24Hour: true,
      //   minimumDate: new Date(),
      // });
    } else {
      setShowDatePicker(true);
    }
  };

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  const sendPushNotifications = async (buildingId: string, title: string, body: string, type: 'poll', itemId?: string) => {
    console.log('📱 Push notifications desativadas - enquete criada sem notificação');
    return 0;
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
        created_by: poll.created_by,
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
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Criar Enquete</Text>
      <View style={styles.headerButtons}>
        <TouchableOpacity 
          onPress={() => router.push('/admin/communications')}
          style={[styles.viewButton, { marginRight: 8 }]}
        >
          <Text style={styles.viewButtonText}>Comunicações</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => {
            fetchPolls();
            setShowPollsModal(true);
          }}
          style={styles.viewButton}
        >
          <Text style={styles.viewButtonText}>Ver Enquetes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPollForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Nova Enquete</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          value={poll.title}
          onChangeText={(text) => setPoll(prev => ({ ...prev, title: text }))}
          placeholder="Digite o título da enquete"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Descrição *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={poll.description}
          onChangeText={(text) => setPoll(prev => ({ ...prev, description: text }))}
          placeholder="Digite a descrição da enquete"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prédio *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowPollBuildingPicker(true)}
        >
          <Text style={styles.pickerText}>
            {getBuildingLabel(poll.building_id)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Data de Expiração *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={showDatePickerModal}
        >
          <Text style={styles.pickerText}>
            {poll.expires_at ? formatDateForDisplay(new Date(poll.expires_at)) : 'Selecionar data e hora'}
          </Text>
          <Text style={styles.pickerArrow}>📅</Text>
        </TouchableOpacity>
        {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Opções de Resposta *</Text>
        {pollOptions.map((option, index) => (
          <View key={option.id} style={styles.optionContainer}>
            <TextInput
              style={[styles.input, styles.optionInput]}
              value={option.text}
              onChangeText={(text) => updatePollOption(option.id, text)}
              placeholder={`Opção ${index + 1}`}
              placeholderTextColor="#999"
            />
            {pollOptions.length > 2 && (
              <TouchableOpacity
                style={styles.removeOptionButton}
                onPress={() => removePollOption(option.id)}
              >
                <Text style={styles.removeOptionText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addOptionButton} onPress={addPollOption}>
          <Text style={styles.addOptionText}>+ Adicionar Opção</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.createButton} onPress={handleCreatePoll}>
        <Text style={styles.createButtonText}>Criar Enquete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPollBuildingPicker = () => (
    <Modal
      visible={showPollBuildingPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPollBuildingPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Selecionar Prédio</Text>
          {buildings.map((building) => (
            <TouchableOpacity
              key={building.id}
              style={styles.modalOption}
              onPress={() => {
                setPoll(prev => ({ ...prev, building_id: building.id }));
                setShowPollBuildingPicker(false);
              }}
            >
              <Text style={styles.modalOptionText}>{building.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowPollBuildingPicker(false)}
          >
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderPollsModal = () => (
    <Modal
      visible={showPollsModal}
      animationType="slide"
      onRequestClose={() => setShowPollsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalHeaderTitle}>Enquetes Criadas</Text>
          <TouchableOpacity
            onPress={() => setShowPollsModal(false)}
            style={styles.modalCloseButton}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        {loadingPolls ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando enquetes...</Text>
          </View>
        ) : (
          <FlatList
            data={pollsList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.pollItem}>
                <View style={styles.pollHeader}>
                  <Text style={styles.pollTitle}>{item.title}</Text>
                  <Text style={styles.pollDate}>
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <Text style={styles.pollDescription}>{item.description}</Text>
                <Text style={styles.pollExpiry}>
                  Expira em: {new Date(item.expires_at).toLocaleDateString('pt-BR')}
                </Text>
                <View style={styles.pollOptions}>
                  {item.poll_options.map((option) => (
                    <View key={option.id} style={styles.pollOptionItem}>
                      <Text style={styles.pollOptionText}>{option.option_text}</Text>
                      <Text style={styles.pollOptionVotes}>
                        {option.votes_count} votos ({option.percentage}%)
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.pollFooter}>
                  <Text style={styles.pollTotalVotes}>
                    Total: {item.total_votes} votos
                  </Text>
                  <Text style={styles.pollBuilding}>
                    {item.building?.name}
                  </Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderPollForm()}
      </ScrollView>
      
      {showDatePicker && (
        <DateTimePicker
          value={poll.expires_at ? new Date(poll.expires_at) : new Date()}
          mode="datetime"
          is24Hour={true}
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}
      
      {renderPollBuildingPicker()}
      {renderPollsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
    marginRight: 10,
  },
  removeOptionButton: {
    backgroundColor: '#ff4444',
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
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addOptionText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalCancelButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#666',
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
  listContainer: {
    padding: 20,
  },
  pollItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  pollDate: {
    fontSize: 12,
    color: '#666',
  },
  pollDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  pollExpiry: {
    fontSize: 12,
    color: '#ff6600',
    marginBottom: 10,
    fontWeight: '500',
  },
  pollOptions: {
    marginBottom: 10,
  },
  pollOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    marginBottom: 4,
  },
  pollOptionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  pollOptionVotes: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  pollFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  pollTotalVotes: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
  pollBuilding: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});