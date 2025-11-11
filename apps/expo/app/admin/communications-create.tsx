import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { Modal } from '~/components/Modal';
import { router } from 'expo-router';
import { supabase, adminAuth } from '~/utils/supabase';
import type { Database } from '@porteiroapp/common/supabase';

type Building = {
  id: string;
  name: string;
};

type CommunicationInsert = Database['public']['Tables']['communications']['Insert'];

export default function CommunicationsCreate() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [communication, setCommunication] = useState<Omit<CommunicationInsert, 'id' | 'created_at' | 'updated_at'>>({
    title: '',
    content: '',
    type: 'notice',
    priority: 'normal',
    building_id: '',
    created_by: '',
  });
  
  // Estados dos modais dos pickers
  const [showCommunicationTypePicker, setShowCommunicationTypePicker] = useState(false);
  const [showCommunicationPriorityPicker, setShowCommunicationPriorityPicker] = useState(false);
  const [showCommunicationBuildingPicker, setShowCommunicationBuildingPicker] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchBuildings();
    fetchAdminId();
  }, []);

  // Funções helper para obter labels
  const getCommunicationTypeLabel = (type: string | null | undefined) => {
    const types = {
      notice: 'Aviso',
      emergency: 'Emergência', 
      maintenance: 'Manutenção',
      event: 'Evento'
    };
    return types[(type || 'notice') as keyof typeof types] || 'Aviso';
  };

  const getCommunicationPriorityLabel = (priority: string | null | undefined) => {
    const priorities = {
      low: 'Baixa',
      normal: 'Normal',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return priorities[(priority || 'normal') as keyof typeof priorities] || 'Normal';
  };

  const getBuildingLabel = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    return building?.name || 'Selecione o Prédio';
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
      }
    } catch (error) {
      console.error('Erro ao obter ID do administrador:', error);
    }
  };

  // PUSH NOTIFICATIONS TEMPORARIAMENTE DESATIVADAS
  const sendPushNotifications = async (buildingId: string, title: string, body: string, type: 'communication', itemId?: string) => {
    console.log('📱 Push notifications desativadas - comunicação criada sem notificação');
    return 0;
  };

  const handleCreateCommunication = async () => {
    if (!communication.title || !communication.content || !communication.building_id || !communication.created_by) {
      Alert.alert('Erro', 'Título, conteúdo, prédio e criador são obrigatórios');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('communications')
        .insert({
          title: communication.title,
          content: communication.content,
          type: communication.type,
          priority: communication.priority,
          building_id: communication.building_id,
          created_by: communication.created_by,
        })
        .select()
        .single();

      if (error) throw error;

      // Enviar notificações push
      const notificationTitle = `📢 ${getCommunicationTypeLabel(communication.type)}`;
      const notificationBody = `${communication.title}\n${communication.content.substring(0, 80)}${communication.content.length > 80 ? '...' : ''}`;

      const notificationsSent = await sendPushNotifications(
        communication.building_id,
        notificationTitle,
        notificationBody,
        'communication',
        data?.id
      );

      Alert.alert(
        'Sucesso', 
        'Comunicação criada com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpar formulário
              setCommunication({
                title: '',
                content: '',
                type: 'notice',
                priority: 'normal',
                building_id: '',
                created_by: communication.created_by,
              });
              // Voltar para a tela anterior
              router.back();
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Erro', 'Falha ao criar comunicação: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nova Comunicação</Text>
        <View style={styles.placeholder} />
      </View>
    </View>
  );

  const renderCommunicationForm = () => (
    <View style={styles.communicationForm}>
      <Text style={styles.formTitle}>Criar Nova Comunicação</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Título *</Text>
        <TextInput
          style={styles.input}
          value={communication.title}
          onChangeText={(text) => setCommunication(prev => ({ ...prev, title: text }))}
          placeholder="Digite o título da comunicação"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Conteúdo *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={communication.content}
          onChangeText={(text) => setCommunication(prev => ({ ...prev, content: text }))}
          placeholder="Digite o conteúdo da comunicação"
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Tipo</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCommunicationTypePicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getCommunicationTypeLabel(communication.type)}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Prioridade</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCommunicationPriorityPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getCommunicationPriorityLabel(communication.priority)}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Prédio *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCommunicationBuildingPicker(true)}
        >
          <Text style={[
            styles.pickerButtonText,
            !communication.building_id && styles.placeholderText
          ]}>
            {getBuildingLabel(communication.building_id)}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.createButton, isSubmitting && styles.createButtonDisabled]} 
        onPress={handleCreateCommunication}
        disabled={isSubmitting}
      >
        <Text style={styles.createButtonText}>
          {isSubmitting ? 'Criando...' : 'Criar Comunicação'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCommunicationTypePicker = () => (
    <Modal
      visible={showCommunicationTypePicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCommunicationTypePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Tipo de Comunicação</Text>
          {[
            { value: 'notice', label: 'Aviso' },
            { value: 'emergency', label: 'Emergência' },
            { value: 'maintenance', label: 'Manutenção' },
            { value: 'event', label: 'Evento' }
          ].map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.modalOption,
                communication.type === type.value && styles.modalOptionSelected
              ]}
              onPress={() => {
                setCommunication(prev => ({ ...prev, type: type.value }));
                setShowCommunicationTypePicker(false);
              }}
            >
              <Text style={[
                styles.modalOptionText,
                communication.type === type.value && styles.modalOptionTextSelected
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowCommunicationTypePicker(false)}
          >
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderCommunicationPriorityPicker = () => (
    <Modal
      visible={showCommunicationPriorityPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCommunicationPriorityPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Prioridade</Text>
          {[
            { value: 'low', label: 'Baixa' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'Alta' },
            { value: 'urgent', label: 'Urgente' }
          ].map((priority) => (
            <TouchableOpacity
              key={priority.value}
              style={[
                styles.modalOption,
                communication.priority === priority.value && styles.modalOptionSelected
              ]}
              onPress={() => {
                setCommunication(prev => ({ ...prev, priority: priority.value }));
                setShowCommunicationPriorityPicker(false);
              }}
            >
              <Text style={[
                styles.modalOptionText,
                communication.priority === priority.value && styles.modalOptionTextSelected
              ]}>
                {priority.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowCommunicationPriorityPicker(false)}
          >
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderCommunicationBuildingPicker = () => (
    <Modal
      visible={showCommunicationBuildingPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCommunicationBuildingPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Selecionar Prédio</Text>
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
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowCommunicationBuildingPicker(false)}
          >
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCommunicationForm()}
      </ScrollView>
      
      {renderCommunicationTypePicker()}
      {renderCommunicationPriorityPicker()}
      {renderCommunicationBuildingPicker()}
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
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: "center",
    flexDirection: "row",
    paddingTop: 20,
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
  },
  placeholder: {
    width: 60, // Para balancear o layout
  },
  content: {
    flex: 1,
  },
  communicationForm: {
    padding: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
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
    backgroundColor: '#fff',
    fontSize: 16,
    minHeight: 50,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  pickerChevron: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
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
    maxHeight: '80%',
    minWidth: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    textAlign: 'center',
  },
  modalOption: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#1976d2',
    fontWeight: '600',
  },
  modalCancelButton: {
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});
