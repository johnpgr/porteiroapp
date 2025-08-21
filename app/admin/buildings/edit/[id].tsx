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
import { Container } from '~/components/Container';
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase } from '~/utils/supabase';

interface Building {
  id: string;
  name: string;
  address: string;
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

  useEffect(() => {
    if (id) {
      fetchBuilding();
    }
  }, [id, fetchBuilding]);

  const fetchBuilding = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .eq('id', id)
        .single();

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
        { text: 'OK', onPress: () => router.back() }
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
      <Container>
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      </Container>
    );
  }

  if (!building) {
    return (
      <Container>
        <View style={styles.loadingContainer}>
          <Text>Prédio não encontrado</Text>
        </View>
      </Container>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <Container>
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
                  onChangeText={(text) => setEditedBuilding(prev => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Endereço Completo *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ex: Rua das Flores, 123 - Centro - São Paulo/SP - CEP: 01234-567"
                  value={editedBuilding.address}
                  onChangeText={(text) => setEditedBuilding(prev => ({ ...prev, address: text }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.infoGroup}>
                <Text style={styles.infoLabel}>Informações do Sistema</Text>
                <Text style={styles.infoText}>
                  ID: {building.id}
                </Text>
                <Text style={styles.infoText}>
                  Cadastrado em: {new Date(building.created_at).toLocaleDateString('pt-BR')} às {new Date(building.created_at).toLocaleTimeString('pt-BR')}
                </Text>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => router.back()}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
                  onPress={handleSaveBuilding}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Container>
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
    paddingTop: 50,
    paddingBottom: 15,
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
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  editForm: {
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
});