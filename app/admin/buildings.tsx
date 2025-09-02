import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase, adminAuth } from '~/utils/supabase';
import { flattenStyles } from '~/utils/styles';

interface Building {
  id: string;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export default function BuildingsManagement() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBuilding, setNewBuilding] = useState({
    name: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
        setBuildings([]);
        return;
      }

      // Buscar apenas os prédios gerenciados por este administrador
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      setBuildings(adminBuildings || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
      Alert.alert('Erro', 'Falha ao carregar lista de prédios');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuilding = async () => {
    if (!newBuilding.name.trim()) {
      Alert.alert('Erro', 'Nome do prédio é obrigatório');
      return;
    }

    if (!newBuilding.address.trim()) {
      Alert.alert('Erro', 'Endereço é obrigatório');
      return;
    }

    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        Alert.alert('Erro', 'Não foi possível identificar o administrador atual');
        return;
      }

      // Inserir o novo prédio
      const { data: buildingData, error: buildingError } = await supabase
        .from('buildings')
        .insert({
          name: newBuilding.name.trim(),
          address: newBuilding.address.trim(),
        })
        .select()
        .single();

      if (buildingError) throw buildingError;

      // Vincular o administrador ao prédio
      const assignmentSuccess = await adminAuth.assignAdminToBuilding(
        currentAdmin.id,
        buildingData.id
      );

      if (!assignmentSuccess) {
        // Se falhou a vinculação, remover o prédio criado
        await supabase.from('buildings').delete().eq('id', buildingData.id);
        throw new Error('Falha ao vincular administrador ao prédio');
      }

      Alert.alert('Sucesso', 'Prédio cadastrado com sucesso');
      setNewBuilding({ name: '', address: '' });
      setShowAddForm(false);
      fetchBuildings();
    } catch (error) {
      console.error('Erro ao cadastrar prédio:', error);
      Alert.alert('Erro', 'Falha ao cadastrar prédio');
    }
  };

  const handleDeleteBuilding = async (buildingId: string, buildingName: string) => {
    try {
      // Verificar se existem apartamentos vinculados ao prédio
      const { data: apartments, error: apartmentsError } = await supabase
        .from('apartments')
        .select('id')
        .eq('building_id', buildingId)
        .limit(1);

      if (apartmentsError) {
        console.error('Erro ao verificar apartamentos:', apartmentsError);
        Alert.alert('Erro', 'Não foi possível verificar as dependências do prédio');
        return;
      }

      // Verificar se existem moradores vinculados ao prédio
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('building_id', buildingId)
        .limit(1);

      if (profilesError) {
        console.error('Erro ao verificar moradores:', profilesError);
        Alert.alert('Erro', 'Não foi possível verificar as dependências do prédio');
        return;
      }

      // Se existem dependências, mostrar mensagem de erro
      if (apartments && apartments.length > 0 || profiles && profiles.length > 0) {
        Alert.alert(
          'Erro ao excluir prédio',
          'Não foi possível completar a ação porque existem registros vinculados a este prédio na tabela "profiles". Para prosseguir com a exclusão, é necessário primeiro remover todos os apartamentos e moradores associados a este prédio. Verifique e resolva essas dependências antes de tentar excluir novamente.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Se não há dependências, prosseguir com a exclusão
      Alert.alert(
        'Confirmar Exclusão',
        `Tem certeza que deseja excluir o prédio "${buildingName}"?\n\nEsta ação não pode ser desfeita.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase.from('buildings').delete().eq('id', buildingId);

                if (error) throw error;

                Alert.alert('Sucesso', 'Prédio excluído com sucesso');
                fetchBuildings();
              } catch (error) {
                console.error('Erro ao excluir prédio:', error);
                Alert.alert('Erro', 'Falha ao excluir prédio');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao verificar dependências:', error);
      Alert.alert('Erro', 'Não foi possível verificar as dependências do prédio');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/admin')}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Gerenciar Prédios</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addButtonText}>{showAddForm ? 'Cancelar' : '+ Novo'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.formTitle}>Novo Prédio</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do Prédio *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Edifício Residencial São Paulo"
                  value={newBuilding.name}
                  onChangeText={(text) => setNewBuilding((prev) => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Endereço Completo *</Text>
                <TextInput
                  style={flattenStyles([styles.input, styles.textArea])}
                  placeholder="Ex: Rua das Flores, 123 - Centro - São Paulo/SP - CEP: 01234-567"
                  value={newBuilding.address}
                  onChangeText={(text) => setNewBuilding((prev) => ({ ...prev, address: text }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleAddBuilding}>
                <Text style={styles.submitButtonText}>Cadastrar Prédio</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.buildingsList}>
            <Text style={styles.sectionTitle}>Prédios Cadastrados ({buildings.length})</Text>

            {buildings.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>🏢</Text>
                <Text style={styles.emptyStateTitle}>Nenhum prédio cadastrado</Text>
                <Text style={styles.emptyStateDescription}>
                  Clique em &quot;+ Novo&quot; para cadastrar o primeiro prédio
                </Text>
              </View>
            ) : (
              buildings.map((building) => (
                <View key={building.id} style={styles.buildingCard}>
                  <View style={styles.buildingInfo}>
                    <Text style={styles.buildingName}>{building.name}</Text>
                    <Text style={styles.buildingAddress}>{building.address}</Text>
                    <Text style={styles.buildingDate}>
                      Cadastrado em: {new Date(building.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => router.push(`/admin/buildings/edit/${building.id}`)}>
                      <Text style={styles.editButtonText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteBuilding(building.id, building.name)}>
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
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
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  addForm: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
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
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buildingsList: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 1,
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  buildingCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buildingInfo: {
    flex: 1,
  },
  buildingName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  buildingAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 18,
  },
  buildingDate: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
  },
  editButtonText: {
    fontSize: 18,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    fontSize: 18,
  },
});
