import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SafeAreaView,
  TextInput,
  Platform,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useLembretes } from '~/hooks/useLembretes';
import { adminAuth, supabase } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FilterOptions {
  status: string;
  prioridade: string;
  tipo: string;
  predio: string;
}

interface BuildingAdmin {
  id: string;
  building_id: string;
  admin_profile_id: string;
  building: {
    name: string;
    address: string;
  };
}

export default function LembretesAdmin() {
  const { 
    lembretes, 
    loading, 
    error, 
    refreshLembretes, 
    deleteLembrete, 
    updateLembrete 
  } = useLembretes();
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLembrete, setEditingLembrete] = useState<any>(null);
  const [formData, setFormData] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [buildingAdmins, setBuildingAdmins] = useState<BuildingAdmin[]>([]);
  const [adminBuildings, setAdminBuildings] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    prioridade: 'all',
    tipo: 'all',
    predio: 'all'
  });

  useEffect(() => {
    checkAdminAuth();
    refreshLembretes();
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        return;
      }
      
      // Usar adminAuth.getAdminBuildings() como nas outras páginas
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      
      if (adminBuildings && adminBuildings.length > 0) {
        // Buscar os building_admins correspondentes para obter os IDs corretos
        const { data: buildingAdminsData, error } = await supabase
          .from('building_admins')
          .select('id, building_id, admin_profile_id')
          .eq('admin_profile_id', currentAdmin.id);

        if (error) {
          console.error('Erro ao buscar building_admins:', error);
          return;
        }

        // Formatar os dados para compatibilidade com o filtro horizontal
        const buildingAdminsFormatted = adminBuildings.map((building: any) => {
          // Encontrar o building_admin correspondente
          const buildingAdmin = buildingAdminsData?.find(ba => ba.building_id === building.id);
          
          return {
            id: buildingAdmin?.id || building.id, // ID do building_admin para filtrar lembretes
            building_id: building.id,
            admin_profile_id: currentAdmin.id,
            building: {
              name: building.name || 'Prédio sem nome',
              address: building.address || ''
            }
          };
        });

        setBuildingAdmins(buildingAdminsFormatted);
        
        // Armazenar IDs dos building_admins para filtrar lembretes
        const buildingAdminIds = buildingAdminsFormatted.map(ba => ba.id);
        setAdminBuildings(buildingAdminIds);
      }
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  };

  const checkAdminAuth = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        Alert.alert('Erro', 'Acesso negado');
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      router.push('/');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLembretes();
    setRefreshing(false);
  };

  const handleDeleteLembrete = (id: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteLembrete(id)
        }
      ]
    );
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pendente' ? 'concluido' : 'pendente';
    await updateLembrete(id, { status: newStatus });
  };

  const handleEditLembrete = (lembrete: any) => {
    setEditingLembrete(lembrete);
    setFormData({
      titulo: lembrete.titulo,
      descricao: lembrete.descricao,
      categoria: lembrete.categoria,
      prioridade: lembrete.prioridade,
      status: lembrete.status,
      data_vencimento: new Date(lembrete.data_vencimento),
      antecedencia_alerta: lembrete.antecedencia_alerta,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLembrete || !formData) return;

    try {
      await updateLembrete(editingLembrete.id, formData);
      setShowEditModal(false);
      setEditingLembrete(null);
      setFormData(null);
      Alert.alert('Sucesso', 'Nota atualizada com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar Nota');
    }
  };

  const showDatePickerModal = () => {
    if (!formData) return;
    
    if (Platform.OS === 'android') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const showTimePickerModal = () => {
    if (!formData) return;
    
    if (Platform.OS === 'android') {
      setShowTimePicker(true);
    } else {
      setShowTimePicker(true);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData((prev: any) => ({ ...prev, data_vencimento: selectedDate }));
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const currentDate = formData.data_vencimento;
      const newDateTime = new Date(currentDate);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setFormData((prev: any) => ({ ...prev, data_vencimento: newDateTime }));
    }
  };

  const getFilteredLembretes = () => {
    return lembretes.filter(lembrete => {
      if (filters.status !== 'all' && lembrete.status !== filters.status) return false;
      if (filters.prioridade !== 'all' && lembrete.prioridade !== filters.prioridade) return false;
      if (filters.tipo !== 'all' && lembrete.categoria !== filters.tipo) return false;
      
      // Filtro por prédio usando building_admin_id
      if (filters.predio !== 'all') {
        return lembrete.building_admin_id === filters.predio;
      }
      
      return true;
    });
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return '#ef4444';
      case 'media': return '#f59e0b';
      case 'baixa': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return '#3b82f6';
      case 'concluido': return '#10b981';
      case 'cancelado': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const renderLembreteItem = ({ item }: { item: any }) => (
    <View style={styles.lembreteCard}>
      <View style={styles.lembreteHeader}>
        <View style={styles.lembreteInfo}>
          <Text style={styles.lembreteTitle}>{item.titulo}</Text>
          <Text style={styles.lembreteDescription} numberOfLines={2}>
            {item.descricao}
          </Text>
        </View>
        <View style={styles.lembreteActions}>
          <TouchableOpacity
            style={[styles.priorityBadge, { backgroundColor: getPrioridadeColor(item.prioridade) }]}
          >
            <Text style={styles.priorityText}>{item.prioridade.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.lembreteDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            {format(new Date(item.data_vencimento), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </Text>
        </View>
       
        <View style={styles.detailRow}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.lembreteFooter}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditLembrete(item)}
        >
          <Ionicons name="create-outline" size={20} color="#2196F3" />
          <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>Editar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteLembrete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filtersContainer}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterOptions}>
                {['all', 'ativo', 'concluido', 'cancelado'].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterOption,
                      filters.status === status && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, status: status as any }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.status === status && styles.filterOptionTextActive
                    ]}>
                      {status === 'all' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Prioridade</Text>
              <View style={styles.filterOptions}>
                {['all', 'baixa', 'media', 'alta'].map(prioridade => (
                  <TouchableOpacity
                    key={prioridade}
                    style={[
                      styles.filterOption,
                      filters.prioridade === prioridade && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, prioridade: prioridade as any }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.prioridade === prioridade && styles.filterOptionTextActive
                    ]}>
                      {prioridade === 'all' ? 'Todas' : prioridade.charAt(0).toUpperCase() + prioridade.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Tipo</Text>
              <View style={styles.filterOptions}>
                {['all', 'manutencao', 'reuniao', 'vencimento', 'outros'].map(tipo => (
                  <TouchableOpacity
                    key={tipo}
                    style={[
                      styles.filterOption,
                      filters.tipo === tipo && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, tipo: tipo as any }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.tipo === tipo && styles.filterOptionTextActive
                    ]}>
                      {tipo === 'all' ? 'Todos' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Prédio</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    filters.predio === 'all' && styles.filterOptionActive
                  ]}
                  onPress={() => setFilters((prev: FilterOptions) => ({ ...prev, predio: 'all' }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.predio === 'all' && styles.filterOptionTextActive
                  ]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                {buildingAdmins.map((buildingAdmin: any) => (
                  <TouchableOpacity
                    key={buildingAdmin.id}
                    style={[
                      styles.filterOption,
                      filters.predio === buildingAdmin.id && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters((prev: FilterOptions) => ({ ...prev, predio: buildingAdmin.id }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.predio === buildingAdmin.id && styles.filterOptionTextActive
                    ]}>
                      {buildingAdmin.building.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.applyFiltersButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyFiltersText}>Aplicar Filtros</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const filteredLembretes = getFilteredLembretes();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notas</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Stats Container */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{lembretes.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {lembretes.filter(l => l.status === 'pendente').length}
            </Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {lembretes.filter(l => l.status === 'concluido').length}
            </Text>
            <Text style={styles.statLabel}>Concluídos</Text>
          </View>
        </View>

        {/* Building Filter */}
        <View style={styles.buildingFilterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.buildingFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.buildingFilterButton,
                filters.predio === 'all' && styles.buildingFilterButtonActive
              ]}
              onPress={() => setFilters(prev => ({ ...prev, predio: 'all' }))}
            >
              <Text style={[
                styles.buildingFilterButtonText,
                filters.predio === 'all' && styles.buildingFilterButtonTextActive
              ]}>
                Todos os prédios
              </Text>
            </TouchableOpacity>
            {buildingAdmins.map((buildingAdmin) => (
              <TouchableOpacity
                key={buildingAdmin.id}
                style={[
                  styles.buildingFilterButton,
                  filters.predio === buildingAdmin.id && styles.buildingFilterButtonActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, predio: buildingAdmin.id }))}
              >
                <Text style={[
                  styles.buildingFilterButtonText,
                  filters.predio === buildingAdmin.id && styles.buildingFilterButtonTextActive
                ]}>
                  {buildingAdmin.building.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Lista de Lembretes */}
        <FlatList
          data={filteredLembretes}
          renderItem={renderLembreteItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>Nenhum nota encontrado</Text>
              <Text style={styles.emptySubtext}>
                {filters.status !== 'all' || filters.prioridade !== 'all' || filters.tipo !== 'all'
                  ? 'Tente ajustar os filtros'
                  : 'Crie sua primeira nota'}
              </Text>
            </View>
          }
        />
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/admin/lembretes/novo')}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {renderFiltersModal()}
      {renderEditModal()}
    </SafeAreaView>
  );

  function renderEditModal() {
    if (!showEditModal || !formData) return null;

    return (
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Nota</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editForm}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Título</Text>
                <TextInput
                  style={styles.input}
                  value={formData.titulo}
                  onChangeText={(text) => setFormData((prev: any) => ({ ...prev, titulo: text }))}
                  placeholder="Digite o título da Nota"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descrição</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.descricao}
                  onChangeText={(text) => setFormData((prev: any) => ({ ...prev, descricao: text }))}
                  placeholder="Descreva os detalhes da Nota"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Categoria</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.categoria}
                      onValueChange={(value) => setFormData((prev: any) => ({ ...prev, categoria: value }))}
                      style={styles.picker}
                    >
                      <Picker.Item label="Manutenção" value="manutencao" />
                      <Picker.Item label="Reunião" value="reuniao" />
                      <Picker.Item label="Pagamento" value="pagamento" />
                      <Picker.Item label="Assembleia" value="assembleia" />
                      <Picker.Item label="Outros" value="outros" />
                    </Picker>
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Prioridade</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.prioridade}
                      onValueChange={(value) => setFormData((prev: any) => ({ ...prev, prioridade: value }))}
                      style={styles.picker}
                    >
                      <Picker.Item label="Baixa" value="baixa" />
                      <Picker.Item label="Média" value="media" />
                      <Picker.Item label="Alta" value="alta" />
                      <Picker.Item label="Urgente" value="urgente" />
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.status}
                    onValueChange={(value) => setFormData((prev: any) => ({ ...prev, status: value }))}
                    style={styles.picker}
                  >
                    <Picker.Item label="Pendente" value="pendente" />
                    <Picker.Item label="Concluído" value="concluido" />
                    <Picker.Item label="Cancelado" value="cancelado" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Data e Hora de Vencimento</Text>
                <View style={styles.dateTimeContainer}>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { flex: 1, marginRight: 8 }]}
                    onPress={showDatePickerModal}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                    <Text style={styles.dateTimeText}>
                      {format(formData.data_vencimento, 'dd/MM/yyyy', { locale: ptBR })}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { flex: 1, marginLeft: 8 }]}
                    onPress={showTimePickerModal}
                  >
                    <Ionicons name="time-outline" size={20} color="#666" />
                    <Text style={styles.dateTimeText}>
                      {format(formData.data_vencimento, 'HH:mm', { locale: ptBR })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.editModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {showDatePicker && (
          <DateTimePicker
            value={formData.data_vencimento}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}
        
        {showTimePicker && (
          <DateTimePicker
            value={formData.data_vencimento}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingVertical: 12,
    backgroundColor: '#FF9800',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  lembreteCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  lembreteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lembreteInfo: {
    flex: 1,
    marginRight: 12,
  },
  lembreteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lembreteDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  lembreteActions: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  lembreteDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  lembreteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  filtersContainer: {
    padding: 20,
  },
  filterGroup: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  filterOptionActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  filterOptionTextActive: {
    color: 'white',
  },
  applyFiltersButton: {
    margin: 20,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFiltersText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  editModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editForm: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
    color: '#374151',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  buildingFilterContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  buildingFilterScroll: {
    flexGrow: 0,
  },
  buildingFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  buildingFilterButtonActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  buildingFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  buildingFilterButtonTextActive: {
    color: '#fff',
  },
});