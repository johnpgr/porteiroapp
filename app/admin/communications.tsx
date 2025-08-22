import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, adminAuth } from '~/utils/supabase';
import { Picker } from '@react-native-picker/picker';
import { flattenStyles } from '~/utils/styles';

interface Communication {
  id: string;
  title: string;
  message: string;
  type: 'geral' | 'emergencia' | 'manutencao' | 'evento';
  priority: 'baixa' | 'media' | 'alta';
  target_apartment?: string;
  building_id?: string;
  created_by: string;
  created_at: string;
  read_by?: string[];
}

interface Building {
  id: string;
  name: string;
}

export default function Communications() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [filteredCommunications, setFilteredCommunications] = useState<Communication[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState('');
  const [newComm, setNewComm] = useState({
    title: '',
    message: '',
    type: 'geral' as 'geral' | 'emergencia' | 'manutencao' | 'evento',
    priority: 'media' as 'baixa' | 'media' | 'alta',
    target_apartment: '',
  });

  useEffect(() => {
    fetchCommunications();
    fetchBuildings();
  }, []);

  useEffect(() => {
    filterCommunications();
  }, [communications, buildingFilter, filterCommunications]);

  const fetchCommunications = async () => {
    try {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunications(data || []);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar comunicados');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Admin não encontrado');
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      setBuildings(adminBuildings || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  };

  const filterCommunications = () => {
    let filtered = communications;

    if (buildingFilter) {
      filtered = filtered.filter((comm) => comm.building_id === buildingFilter);
    }

    setFilteredCommunications(filtered);
  };

  const handleAddCommunication = async () => {
    if (!newComm.title || !newComm.message) {
      Alert.alert('Erro', 'Título e mensagem são obrigatórios');
      return;
    }

    try {
      const { error } = await supabase.from('communications').insert({
        title: newComm.title,
        message: newComm.message,
        type: newComm.type,
        priority: newComm.priority,
        target_apartment: newComm.target_apartment || null,
        created_by: 'admin', // TODO: pegar do contexto de auth
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Comunicado criado com sucesso');
      setNewComm({
        title: '',
        message: '',
        type: 'geral',
        priority: 'media',
        target_apartment: '',
      });
      setShowAddForm(false);
      fetchCommunications();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar comunicado');
    }
  };

  const handleDeleteCommunication = async (commId: string, title: string) => {
    Alert.alert('Confirmar Exclusão', `Deseja excluir o comunicado "${title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('communications').delete().eq('id', commId);

            if (error) throw error;
            fetchCommunications();
          } catch (error) {
            Alert.alert('Erro', 'Falha ao excluir comunicado');
          }
        },
      },
    ]);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'emergencia':
        return '#F44336';
      case 'manutencao':
        return '#FF9800';
      case 'evento':
        return '#9C27B0';
      case 'geral':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'emergencia':
        return '🚨';
      case 'manutencao':
        return '🔧';
      case 'evento':
        return '🎉';
      case 'geral':
        return '📢';
      default:
        return '📝';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta':
        return '#F44336';
      case 'media':
        return '#FF9800';
      case 'baixa':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'alta':
        return '🔴';
      case 'media':
        return '🟡';
      case 'baixa':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando comunicados...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📢 Comunicados</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
          <Text style={styles.addButtonText}>
            {showAddForm ? '❌ Cancelar' : '➕ Novo Comunicado'}
          </Text>
        </TouchableOpacity>

        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Filtrar por prédio:</Text>
          <Picker
            selectedValue={buildingFilter}
            style={styles.picker}
            onValueChange={(itemValue) => setBuildingFilter(itemValue)}>
            <Picker.Item label="Todos os prédios" value="" />
            {buildings.map((building) => (
              <Picker.Item key={building.id} label={building.name} value={building.id} />
            ))}
          </Picker>
        </View>
      </View>

      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>Novo Comunicado</Text>

          <TextInput
            style={styles.input}
            placeholder="Título do comunicado"
            value={newComm.title}
            onChangeText={(text) => setNewComm((prev) => ({ ...prev, title: text }))}
          />

          <TextInput
            style={flattenStyles([styles.input, styles.textArea])}
            placeholder="Mensagem do comunicado"
            value={newComm.message}
            onChangeText={(text) => setNewComm((prev) => ({ ...prev, message: text }))}
            multiline
            numberOfLines={4}
          />

          <View style={styles.selector}>
            <Text style={styles.selectorLabel}>Tipo:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.selectorButtons}>
                {[
                  { key: 'geral', label: 'Geral', icon: '📢' },
                  { key: 'emergencia', label: 'Emergência', icon: '🚨' },
                  { key: 'manutencao', label: 'Manutenção', icon: '🔧' },
                  { key: 'evento', label: 'Evento', icon: '🎉' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={flattenStyles([
                      styles.selectorButton,
                      newComm.type === type.key && styles.selectorButtonActive,
                      { borderColor: getTypeColor(type.key) },
                    ])}
                    onPress={() => setNewComm((prev) => ({ ...prev, type: type.key as any }))}>
                    <Text
                      style={flattenStyles([
                        styles.selectorButtonText,
                        newComm.type === type.key && { color: getTypeColor(type.key) },
                      ])}>
                      {type.icon} {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.selector}>
            <Text style={styles.selectorLabel}>Prioridade:</Text>
            <View style={styles.selectorButtons}>
              {[
                { key: 'baixa', label: 'Baixa', icon: '🟢' },
                { key: 'media', label: 'Média', icon: '🟡' },
                { key: 'alta', label: 'Alta', icon: '🔴' },
              ].map((priority) => (
                <TouchableOpacity
                  key={priority.key}
                  style={flattenStyles([
                    styles.selectorButton,
                    newComm.priority === priority.key && styles.selectorButtonActive,
                    { borderColor: getPriorityColor(priority.key) },
                  ])}
                  onPress={() =>
                    setNewComm((prev) => ({ ...prev, priority: priority.key as any }))
                  }>
                  <Text
                    style={flattenStyles([
                      styles.selectorButtonText,
                      newComm.priority === priority.key && {
                        color: getPriorityColor(priority.key),
                      },
                    ])}>
                    {priority.icon} {priority.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Apartamento específico (opcional)"
            value={newComm.target_apartment}
            onChangeText={(text) => setNewComm((prev) => ({ ...prev, target_apartment: text }))}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleAddCommunication}>
            <Text style={styles.submitButtonText}>📤 Enviar Comunicado</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.commList}>
        {filteredCommunications.map((comm) => {
          const { date, time } = formatDate(comm.created_at);
          return (
            <View key={comm.id} style={styles.commCard}>
              <View style={styles.commHeader}>
                <View style={styles.commType}>
                  <Text style={styles.typeIcon}>{getTypeIcon(comm.type)}</Text>
                  <Text
                    style={flattenStyles([styles.typeText, { color: getTypeColor(comm.type) }])}>
                    {comm.type.charAt(0).toUpperCase() + comm.type.slice(1)}
                  </Text>
                </View>

                <View style={styles.commMeta}>
                  <View style={styles.priority}>
                    <Text style={styles.priorityIcon}>{getPriorityIcon(comm.priority)}</Text>
                    <Text
                      style={flattenStyles([
                        styles.priorityText,
                        { color: getPriorityColor(comm.priority) },
                      ])}>
                      {comm.priority.charAt(0).toUpperCase() + comm.priority.slice(1)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteCommunication(comm.id, comm.title)}>
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.commContent}>
                <Text style={styles.commTitle}>{comm.title}</Text>
                <Text style={styles.commMessage}>{comm.message}</Text>

                {comm.target_apartment && (
                  <View style={styles.targetInfo}>
                    <Text style={styles.targetText}>🏠 Apartamento {comm.target_apartment}</Text>
                  </View>
                )}

                <View style={styles.commFooter}>
                  <Text style={styles.commDate}>
                    {date} às {time}
                  </Text>
                  <Text style={styles.commAuthor}>Por: {comm.created_by}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#9C27B0',
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
  actions: {
    padding: 20,
  },
  filterContainer: {
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    elevation: 2,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  picker: {
    height: 50,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addForm: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
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
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selector: {
    marginBottom: 15,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  selectorButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: '#f0f0f0',
  },
  selectorButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  commHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  commMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priority: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityIcon: {
    fontSize: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  commContent: {
    padding: 15,
  },
  commTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  commMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  targetInfo: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  targetText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  commFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commDate: {
    fontSize: 12,
    color: '#999',
  },
  commAuthor: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
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
});
