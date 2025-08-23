import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, adminAuth } from '~/utils/supabase';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

interface Building {
  id: string;
  name: string;
}

interface PollOption {
  id: string;
  text: string;
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    fetchBuildings();
    fetchAdminId();
  }, []);

  const fetchBuildings = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
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

  const handleSendCommunication = async () => {
    if (!communication.title || !communication.content || !communication.building_id || !communication.created_by) {
      Alert.alert('Erro', 'Título, conteúdo, prédio e criador são obrigatórios');
      return;
    }

    try {
      const { error } = await supabase.from('communications').insert({
        title: communication.title,
        content: communication.content,
        type: communication.type,
        priority: communication.priority,
        building_id: communication.building_id,
        created_by: communication.created_by,
      });

      if (error) throw error;
      Alert.alert('Sucesso', 'Comunicado enviado com sucesso');
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

      Alert.alert('Sucesso', 'Enquete criada com sucesso');
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
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>
        {activeTab === 'communications' ? '📢 Comunicados' : '📊 Enquetes'}
      </Text>
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
          onPress={() => router.push('/admin/communications')}>
          <Text style={styles.listCommunicationsButtonText}>📋 Listar Todos os Comunicados</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.communicationForm}>
        <Text style={styles.formTitle}>Enviar Comunicado</Text>

        <TextInput
          style={styles.input}
          placeholder="Título do comunicado"
          value={communication.title}
          onChangeText={(text) => setCommunication((prev) => ({ ...prev, title: text }))}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Conteúdo detalhado"
          value={communication.content}
          onChangeText={(text) => setCommunication((prev) => ({ ...prev, content: text }))}
          multiline
          numberOfLines={4}
        />

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={communication.type}
            onValueChange={(value) =>
              setCommunication((prev) => ({ ...prev, type: value }))
            }>
            <Picker.Item label="Tipo: Aviso" value="notice" />
            <Picker.Item label="Tipo: Emergência" value="emergency" />
            <Picker.Item label="Tipo: Manutenção" value="maintenance" />
            <Picker.Item label="Tipo: Evento" value="event" />
          </Picker>
        </View>

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={communication.priority}
            onValueChange={(value) =>
              setCommunication((prev) => ({ ...prev, priority: value }))
            }>
            <Picker.Item label="Prioridade: Normal" value="normal" />
            <Picker.Item label="Prioridade: Alta" value="high" />
            <Picker.Item label="Prioridade: Baixa" value="low" />
          </Picker>
        </View>

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={communication.building_id}
            onValueChange={(value) =>
              setCommunication((prev) => ({ ...prev, building_id: value }))
            }>
            <Picker.Item label="Selecione o Prédio" value="" />
            {buildings.map((building) => (
              <Picker.Item key={building.id} label={building.name} value={building.id} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity style={styles.sendButton} onPress={handleSendCommunication}>
          <Text style={styles.sendButtonText}>Enviar Comunicado</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderPolls = () => (
    <ScrollView style={styles.content}>
      <View style={styles.communicationsHeader}>
        <TouchableOpacity
          style={styles.listCommunicationsButton}
          onPress={() => router.push('/admin/polls')}>
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
          <TouchableOpacity style={styles.dateButton} onPress={showDatePickerModal}>
            <Text style={styles.dateButtonText}>
              {poll.expires_at ? formatDateForDisplay(new Date(poll.expires_at)) : 'Selecionar data e hora'}
            </Text>
          </TouchableOpacity>
          {dateError ? (
            <Text style={styles.errorText}>{dateError}</Text>
          ) : null}
        </View>

        {Platform.OS === 'ios' && showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={poll.expires_at ? new Date(poll.expires_at) : new Date()}
            mode="datetime"
            is24Hour={true}
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={poll.building_id}
            onValueChange={(value) =>
              setPoll((prev) => ({ ...prev, building_id: value }))
            }>
            <Picker.Item label="Selecione o Prédio" value="" />
            {buildings.map((building) => (
              <Picker.Item key={building.id} label={building.name} value={building.id} />
            ))}
          </Picker>
        </View>

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
    paddingHorizontal: 20,
    paddingTop: 10,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
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
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fff',
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
    paddingHorizontal: 12,
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
    marginBottom: 10,
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
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
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
});
