import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
// Container removido para eliminar margens laterais
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase } from '~/utils/supabase';

interface Building {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

interface Apartment {
  id: string;
  building_id: string;
  number: string;
  floor?: number;
  created_at: string;
}

export default function EditBuilding() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [editedBuilding, setEditedBuilding] = useState({
    name: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Apartamentos
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loadingApartments, setLoadingApartments] = useState(false);
  const [newApartment, setNewApartment] = useState({ number: '', floor: '' });
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkAdd, setBulkAdd] = useState({ startNumber: '', endNumber: '', floor: '' });

  useEffect(() => {
    if (id) {
      fetchBuilding();
      fetchApartments();
    }
  }, [id]);

  const fetchBuilding = async () => {
    try {
      const { data, error } = await supabase.from('buildings').select('*').eq('id', id).single();

      if (error) throw error;

      setBuilding(data);
      setEditedBuilding({
        name: data.name,
        address: data.address,
      });
    } catch (error) {
      console.error('Erro ao carregar prédio:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do prédio');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchApartments = async () => {
    setLoadingApartments(true);
    try {
      const { data, error } = await supabase
        .from('apartments')
        .select('*')
        .eq('building_id', id)
        .order('number');

      if (error) throw error;
      setApartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar apartamentos:', error);
      Alert.alert('Erro', 'Falha ao carregar apartamentos');
    } finally {
      setLoadingApartments(false);
    }
  };

  const handleAddApartment = async () => {
    if (!newApartment.number.trim()) {
      Alert.alert('Erro', 'Número do apartamento é obrigatório');
      return;
    }

    // Verificar duplicata
    const exists = apartments.some((apt) => apt.number === newApartment.number.trim());
    if (exists) {
      Alert.alert('Erro', 'Já existe um apartamento com este número');
      return;
    }

    try {
      const { error } = await supabase.from('apartments').insert({
        building_id: id,
        number: newApartment.number.trim(),
        floor: newApartment.floor ? parseInt(newApartment.floor) : null,
      });

      if (error) throw error;

      setNewApartment({ number: '', floor: '' });
      fetchApartments();
      Alert.alert('Sucesso', 'Apartamento adicionado com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar apartamento:', error);
      Alert.alert('Erro', 'Falha ao adicionar apartamento');
    }
  };

  const handleBulkAddApartments = async () => {
    if (!bulkAdd.startNumber || !bulkAdd.endNumber) {
      Alert.alert('Erro', 'Números inicial e final são obrigatórios');
      return;
    }

    const start = parseInt(bulkAdd.startNumber);
    const end = parseInt(bulkAdd.endNumber);

    if (isNaN(start) || isNaN(end) || start > end) {
      Alert.alert('Erro', 'Números inválidos');
      return;
    }

    const apartmentsToAdd = [];
    for (let i = start; i <= end; i++) {
      const number = i.toString();
      const exists = apartments.some((apt) => apt.number === number);
      if (!exists) {
        apartmentsToAdd.push({
          building_id: id,
          number,
          floor: bulkAdd.floor ? parseInt(bulkAdd.floor) : null,
        });
      }
    }

    if (apartmentsToAdd.length === 0) {
      Alert.alert('Aviso', 'Todos os apartamentos já existem');
      return;
    }

    try {
      const { error } = await supabase.from('apartments').insert(apartmentsToAdd);

      if (error) throw error;

      setBulkAdd({ startNumber: '', endNumber: '', floor: '' });
      setShowBulkAdd(false);
      fetchApartments();
      Alert.alert('Sucesso', `${apartmentsToAdd.length} apartamentos adicionados`);
    } catch (error) {
      console.error('Erro ao adicionar apartamentos:', error);
      Alert.alert('Erro', 'Falha ao adicionar apartamentos');
    }
  };

  const handleEditApartment = async () => {
    if (!editingApartment || !editingApartment.number.trim()) {
      Alert.alert('Erro', 'Número do apartamento é obrigatório');
      return;
    }

    // Verificar duplicata (exceto o próprio apartamento)
    const exists = apartments.some(
      (apt) => apt.number === editingApartment.number.trim() && apt.id !== editingApartment.id
    );
    if (exists) {
      Alert.alert('Erro', 'Já existe um apartamento com este número');
      return;
    }

    try {
      const { error } = await supabase
        .from('apartments')
        .update({
          number: editingApartment.number.trim(),
          floor: editingApartment.floor || null,
        })
        .eq('id', editingApartment.id);

      if (error) throw error;

      setEditingApartment(null);
      fetchApartments();
      Alert.alert('Sucesso', 'Apartamento atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar apartamento:', error);
      Alert.alert('Erro', 'Falha ao atualizar apartamento');
    }
  };

  const handleDeleteApartment = (apartment: Apartment) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o apartamento ${apartment.number}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('apartments').delete().eq('id', apartment.id);

              if (error) throw error;

              fetchApartments();
              Alert.alert('Sucesso', 'Apartamento excluído com sucesso');
            } catch (error) {
              console.error('Erro ao excluir apartamento:', error);
              Alert.alert('Erro', 'Falha ao excluir apartamento');
            }
          },
        },
      ]
    );
  };

  const handleSaveBuilding = async () => {
    if (!editedBuilding.name.trim()) {
      Alert.alert('Erro', 'Nome do prédio é obrigatório');
      return;
    }

    if (!editedBuilding.address.trim()) {
      Alert.alert('Erro', 'Endereço é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('buildings')
        .update({
          name: editedBuilding.name.trim(),
          address: editedBuilding.address.trim(),
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Sucesso', 'Prédio atualizado com sucesso', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Erro ao atualizar prédio:', error);
      Alert.alert('Erro', 'Falha ao atualizar prédio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (!building) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.loadingContainer}>
          <Text>Prédio não encontrado</Text>
        </View>
      </View>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <View style={styles.fullScreen}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Editar Prédio</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.editForm}>
              <Text style={styles.formTitle}>Editar Informações do Prédio</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do Prédio *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Edifício Residencial São Paulo"
                  value={editedBuilding.name}
                  onChangeText={(text) => setEditedBuilding((prev) => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Endereço Completo *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ex: Rua das Flores, 123 - Centro - São Paulo/SP - CEP: 01234-567"
                  value={editedBuilding.address}
                  onChangeText={(text) => setEditedBuilding((prev) => ({ ...prev, address: text }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.infoGroup}>
                <Text style={styles.infoLabel}>Informações do Sistema</Text>
                <Text style={styles.infoText}>ID: {building.id}</Text>
                <Text style={styles.infoText}>
                  Cadastrado em: {new Date(building.created_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(building.created_at).toLocaleTimeString('pt-BR')}
                </Text>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.back()}
                  disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSaveBuilding}
                  disabled={saving}>
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Seção de Apartamentos */}
            <View style={styles.apartmentsSection}>
              <Text style={styles.sectionTitle}>Apartamentos do Prédio</Text>

              {/* Formulário para adicionar apartamento */}
              <View style={styles.addApartmentForm}>
                <Text style={styles.formSubtitle}>Adicionar Novo Apartamento</Text>

                <View style={styles.apartmentInputRow}>
                  <View style={styles.apartmentInputGroup}>
                    <Text style={styles.label}>Número *</Text>
                    <TextInput
                      style={styles.apartmentInput}
                      placeholder="Ex: 101"
                      value={newApartment.number}
                      onChangeText={(text) =>
                        setNewApartment((prev) => ({ ...prev, number: text }))
                      }
                    />
                  </View>

                  <View style={styles.apartmentInputGroup}>
                    <Text style={styles.label}>Andar</Text>
                    <TextInput
                      style={styles.apartmentInput}
                      placeholder="Ex: 1"
                      value={newApartment.floor}
                      onChangeText={(text) => setNewApartment((prev) => ({ ...prev, floor: text }))}
                      keyboardType="numeric"
                    />
                  </View>

                  <TouchableOpacity style={styles.addButton} onPress={handleAddApartment}>
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bulkAddContainer}>
                  <TouchableOpacity
                    style={styles.bulkAddToggle}
                    onPress={() => setShowBulkAdd(!showBulkAdd)}>
                    <Text style={styles.bulkAddToggleText}>
                      {showBulkAdd ? '− Ocultar' : '+ Adicionar Múltiplos'}
                    </Text>
                  </TouchableOpacity>

                  {showBulkAdd && (
                    <View style={styles.bulkAddForm}>
                      <View style={styles.bulkInputRow}>
                        <View style={styles.bulkInputGroup}>
                          <Text style={styles.label}>De</Text>
                          <TextInput
                            style={styles.bulkInput}
                            placeholder="101"
                            value={bulkAdd.startNumber}
                            onChangeText={(text) =>
                              setBulkAdd((prev) => ({ ...prev, startNumber: text }))
                            }
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={styles.bulkInputGroup}>
                          <Text style={styles.label}>Até</Text>
                          <TextInput
                            style={styles.bulkInput}
                            placeholder="110"
                            value={bulkAdd.endNumber}
                            onChangeText={(text) =>
                              setBulkAdd((prev) => ({ ...prev, endNumber: text }))
                            }
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={styles.bulkInputGroup}>
                          <Text style={styles.label}>Andar</Text>
                          <TextInput
                            style={styles.bulkInput}
                            placeholder="1"
                            value={bulkAdd.floor}
                            onChangeText={(text) =>
                              setBulkAdd((prev) => ({ ...prev, floor: text }))
                            }
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.bulkAddButton}
                        onPress={handleBulkAddApartments}>
                        <Text style={styles.bulkAddButtonText}>Adicionar Apartamentos</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Lista de apartamentos */}
              <View style={styles.apartmentsList}>
                <Text style={styles.formSubtitle}>
                  Apartamentos Cadastrados ({apartments.length})
                </Text>

                {loadingApartments ? (
                  <Text style={styles.loadingText}>Carregando apartamentos...</Text>
                ) : apartments.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum apartamento cadastrado</Text>
                ) : (
                  apartments.map((apartment) => (
                    <View key={apartment.id} style={styles.apartmentItem}>
                      {editingApartment?.id === apartment.id ? (
                        <View style={styles.editingRow}>
                          <TextInput
                            style={styles.editInput}
                            value={editingApartment.number}
                            onChangeText={(text) =>
                              setEditingApartment((prev) =>
                                prev ? { ...prev, number: text } : null
                              )
                            }
                            placeholder="Número"
                          />
                          <TextInput
                            style={styles.editInput}
                            value={editingApartment.floor?.toString() || ''}
                            onChangeText={(text) =>
                              setEditingApartment((prev) =>
                                prev ? { ...prev, floor: text ? parseInt(text) : undefined } : null
                              )
                            }
                            placeholder="Andar"
                            keyboardType="numeric"
                          />
                          <TouchableOpacity
                            style={styles.saveEditButton}
                            onPress={handleEditApartment}>
                            <Text style={styles.saveEditButtonText}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelEditButton}
                            onPress={() => setEditingApartment(null)}>
                            <Text style={styles.cancelEditButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.apartmentRow}>
                          <View style={styles.apartmentInfo}>
                            <Text style={styles.apartmentNumber}>Apt. {apartment.number}</Text>
                            {apartment.floor && (
                              <Text style={styles.apartmentFloor}>Andar {apartment.floor}</Text>
                            )}
                          </View>

                          <View style={styles.apartmentActions}>
                            <TouchableOpacity
                              style={styles.editApartmentButton}
                              onPress={() => setEditingApartment(apartment)}>
                              <Text style={styles.editApartmentButtonText}>✏️</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.deleteApartmentButton}
                              onPress={() => handleDeleteApartment(apartment)}>
                              <Text style={styles.deleteApartmentButtonText}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
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
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  editForm: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
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
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  infoGroup: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para seção de apartamentos
  apartmentsSection: {
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#FF9800',
    paddingBottom: 10,
  },
  addApartmentForm: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  formSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  apartmentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 15,
  },
  apartmentInputGroup: {
    flex: 1,
  },
  apartmentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bulkAddContainer: {
  },
  bulkAddToggle: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  bulkAddToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkAddForm: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bulkInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  bulkInputGroup: {
    flex: 1,
  },
  bulkInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  bulkAddButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  bulkAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  apartmentsList: {
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
  apartmentItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  apartmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  apartmentInfo: {
    flex: 1,
  },
  apartmentNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  apartmentFloor: {
    fontSize: 12,
    color: '#666',
  },
  apartmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editApartmentButton: {
    backgroundColor: '#FF9800',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editApartmentButtonText: {
    fontSize: 14,
  },
  deleteApartmentButton: {
    backgroundColor: '#f44336',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteApartmentButtonText: {
    fontSize: 14,
  },
  editingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  saveEditButton: {
    backgroundColor: '#4CAF50',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelEditButton: {
    backgroundColor: '#f44336',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
