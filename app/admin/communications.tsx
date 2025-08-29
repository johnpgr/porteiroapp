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
  Modal,
  FlatList,
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateError, setDateError] = useState('');
  
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
          onPress={() => {
            setShowCommunicationsModal(true);
            fetchCommunications();
          }}>
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

  const renderCommunicationsModal = () => (
    <Modal
      visible={showCommunicationsModal}
      animationType="slide"
      presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowCommunicationsModal(false)}>
            <Text style={styles.modalCloseText}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>📋 Todos os Comunicados</Text>
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
      </SafeAreaView>
    </Modal>
  );

  const renderPollsModal = () => (
    <Modal
      visible={showPollsModal}
      animationType="slide"
      presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowPollsModal(false)}>
            <Text style={styles.modalCloseText}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>📊 Todas as Enquetes</Text>
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
      </SafeAreaView>
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
      {renderCommunicationsModal()}
      {renderPollsModal()}
      
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/admin')}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navLabel}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin/users')}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>Usuários</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin/logs')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, styles.navItemActive]}
          onPress={() => router.push('/admin/communications')}>
          <Text style={styles.navIcon}>📢</Text>
          <Text style={styles.navLabel}>Avisos</Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginBottom: 8,
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
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
});
