import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../utils/supabase';

interface Building {
  id: string;
  name: string;
  address: string;
}

interface Apartment {
  id: string;
  building_id: string;
  number: string;
  floor: number;
}

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    phone: '',
    building_id: '',
    apartment_id: '',
    apartment_number: '',
    notes: '',
    photo_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [loadingApartments, setLoadingApartments] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [buildingSearchText, setBuildingSearchText] = useState('');
  const [filteredBuildings, setFilteredBuildings] = useState<Building[]>([]);
  const [showBuildingList, setShowBuildingList] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Carregar prédios ao inicializar
  useEffect(() => {
    loadBuildings();
  }, []);

  // Carregar apartamentos quando prédio for selecionado
  useEffect(() => {
    if (formData.building_id) {
      loadApartments(formData.building_id);
    } else {
      setApartments([]);
      setSelectedApartment(null);
      setFormData(prev => ({ ...prev, apartment_id: '', apartment_number: '' }));
    }
  }, [formData.building_id]);

  const loadBuildings = async () => {
    try {
      setLoadingBuildings(true);
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erro ao carregar prédios:', error);
        Alert.alert('Erro', 'Não foi possível carregar os prédios');
        return;
      }

      const buildingsData = data || [];
      setBuildings(buildingsData);
      setFilteredBuildings(buildingsData);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
      Alert.alert('Erro', 'Não foi possível carregar os prédios');
    } finally {
      setLoadingBuildings(false);
    }
  };

  const filterBuildings = (searchText: string) => {
    if (!searchText.trim()) {
      setFilteredBuildings(buildings);
      return;
    }

    const filtered = buildings.filter(building => 
      building.name.toLowerCase().includes(searchText.toLowerCase()) ||
      building.address.toLowerCase().includes(searchText.toLowerCase())
    ).slice(0, 10); // Limitar a 10 resultados

    setFilteredBuildings(filtered);
  };

  const loadApartments = async (buildingId: string) => {
    try {
      setLoadingApartments(true);
      const { data, error } = await supabase
        .from('apartments')
        .select('id, building_id, number, floor')
        .eq('building_id', buildingId)
        .order('number');

      if (error) throw error;
      setApartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar apartamentos:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de apartamentos.');
    } finally {
      setLoadingApartments(false);
    }
  };

  const handleBuildingSelect = (building: Building) => {
    setSelectedBuilding(building);
    setFormData(prev => ({ 
      ...prev, 
      building_id: building.id,
      apartment_id: '',
      apartment_number: ''
    }));
    setSelectedApartment(null);
    setBuildingSearchText(building.name);
    setShowBuildingList(false);
  };

  const handleBuildingSearchChange = (text: string) => {
    setBuildingSearchText(text);
    filterBuildings(text);
    setShowBuildingList(text.length > 0);
    
    // Se o texto foi limpo, limpar também a seleção
    if (!text.trim()) {
      setSelectedBuilding(null);
      setSelectedApartment(null);
      setApartments([]);
    }
  };

  const handleApartmentSelect = (apartment: Apartment) => {
    setSelectedApartment(apartment);
    setFormData(prev => ({ 
      ...prev, 
      apartment_id: apartment.id,
      apartment_number: apartment.number
    }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso à galeria para selecionar uma foto'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

    if (!result.canceled && result.assets[0]) {
      setFormData((prev) => ({ ...prev, photo_url: result.assets[0].uri }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar uma foto');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData((prev) => ({ ...prev, photo_url: result.assets[0].uri }));
    }
  };

  const showImageOptions = () => {
    Alert.alert('Adicionar Foto', 'Escolha uma opção:', [
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Galeria', onPress: pickImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return false;
    }
    if (!formData.document.trim()) {
      Alert.alert('Erro', 'Documento é obrigatório');
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Erro', 'Telefone é obrigatório para contato');
      return false;
    }
    if (!formData.building_id) {
      Alert.alert('Erro', 'Selecione um prédio');
      return false;
    }
    if (!formData.apartment_id) {
      Alert.alert('Erro', 'Selecione um apartamento');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Inserir visitante
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .insert({
          name: formData.name.trim(),
          document: formData.document.trim(),
          phone: formData.phone.trim(),
          photo_url: formData.photo_url || null,
          status: 'pendente',
        })
        .select()
        .single();

      if (visitorError) throw visitorError;

      // Gerar ID único para a sessão de visita
      const visitSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Criar log da atividade com building_id e apartment_id
      await supabase.from('visitor_logs').insert({
        visitor_id: visitor.id,
        building_id: formData.building_id,
        apartment_id: formData.apartment_id,
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: visitSessionId,
        purpose: `Visita ao apartamento ${formData.apartment_number} - ${selectedBuilding?.name}`,
        authorized_by: null,
        status: 'pending',
      });

      // Criar notificação para o morador
      await supabase.from('communications').insert({
        title: 'Novo Visitante Registrado',
        message: `${formData.name} deseja visitá-lo no ${selectedBuilding?.name}, Apt ${formData.apartment_number}. Documento: ${formData.document}`,
        type: 'visitor',
        priority: 'medium',
        building_id: formData.building_id,
        target_apartment: formData.apartment_number.trim(),
        target_user_type: 'morador',
      });

      // Criar notificação para o porteiro (se houver)
      await supabase.from('communications').insert({
        title: 'Visitante Aguardando',
        message: `${formData.name} registrou-se para visitar ${selectedBuilding?.name}, Apt ${formData.apartment_number}`,
        type: 'visitor',
        priority: 'medium',
        building_id: formData.building_id,
        target_user_type: 'porteiro',
      });

      Alert.alert(
        'Registro Realizado! 📱',
        'Seu registro foi enviado ao morador. Aguarde a autorização para acessar o prédio.',
        [
          {
            text: 'Ver Status',
            onPress: () => router.push('/visitante/status'),
          },
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

      // Limpar formulário
      setFormData({
        name: '',
        document: '',
        phone: '',
        building_id: '',
        apartment_id: '',
        apartment_number: '',
        notes: '',
        photo_url: '',
      });
      setSelectedBuilding(null);
      setSelectedApartment(null);
    } catch (error) {
      console.error('Erro ao registrar visitante:', error);
      Alert.alert('Erro', 'Não foi possível realizar o registro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Visita</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Registro Seguro</Text>
          <Text style={styles.infoText}>Seus dados serão enviados ao morador para autorização</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {/* Destination Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏢 Selecione o Destino</Text>
            
            {/* Building Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Prédio *</Text>
              {loadingBuildings ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF9800" />
                  <Text style={styles.loadingText}>Carregando prédios...</Text>
                </View>
              ) : (
                <View>
                  {/* Campo de Busca de Prédio */}
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder={loadingBuildings ? 'Carregando prédios...' : 'Digite para buscar o prédio...'}
                      value={buildingSearchText}
                      onChangeText={handleBuildingSearchChange}
                      onFocus={() => {
                        if (buildingSearchText.length > 0) {
                          setShowBuildingList(true);
                        }
                      }}
                      editable={!loadingBuildings}
                    />
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                  </View>

                  {/* Lista de Prédios Filtrados */}
                  {showBuildingList && filteredBuildings.length > 0 && (
                    <View style={styles.buildingList}>
                      <ScrollView style={styles.buildingScrollView} nestedScrollEnabled>
                        {filteredBuildings.map((building) => (
                          <TouchableOpacity
                            key={building.id}
                            style={[
                              styles.buildingItem,
                              selectedBuilding?.id === building.id && styles.selectedBuildingItem
                            ]}
                            onPress={() => handleBuildingSelect(building)}
                          >
                            <View style={styles.buildingInfo}>
                              <Text style={styles.buildingName}>{building.name}</Text>
                              <Text style={styles.buildingAddress}>{building.address}</Text>
                            </View>
                            {selectedBuilding?.id === building.id && (
                              <Ionicons name="checkmark" size={20} color="#007AFF" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Apartment Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Apartamento *</Text>
              {loadingApartments ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF9800" />
                  <Text style={styles.loadingText}>Carregando apartamentos...</Text>
                </View>
              ) : !formData.building_id ? (
                <View style={styles.disabledDropdown}>
                  <Text style={styles.disabledText}>Selecione um prédio primeiro</Text>
                  <Ionicons name="chevron-down" size={20} color="#ccc" />
                </View>
              ) : (
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity
                    style={[styles.dropdown, selectedApartment && styles.dropdownSelected]}
                    onPress={() => {
                      if (apartments.length === 0) {
                        Alert.alert('Aviso', 'Nenhum apartamento disponível neste prédio');
                        return;
                      }
                      Alert.alert(
                        'Selecionar Apartamento',
                        'Escolha um apartamento:',
                        apartments.map(apartment => ({
                          text: `Apartamento ${apartment.number}${apartment.floor ? ` - ${apartment.floor}º andar` : ''}`,
                          onPress: () => handleApartmentSelect(apartment)
                        })).concat([{ text: 'Cancelar', style: 'cancel' }])
                      );
                    }}
                  >
                    <Text style={[styles.dropdownText, selectedApartment && styles.dropdownTextSelected]}>
                      {selectedApartment ? `Apartamento ${selectedApartment.number}${selectedApartment.floor ? ` - ${selectedApartment.floor}º andar` : ''}` : 'Selecione um apartamento'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={selectedApartment ? '#FF9800' : '#999'} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Photo Section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>📸 Sua Foto</Text>
            <TouchableOpacity style={styles.photoButton} onPress={showImageOptions}>
              {formData.photo_url ? (
                <Image source={{ uri: formData.photo_url }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color="#999" />
                  <Text style={styles.photoPlaceholderText}>Adicionar Foto</Text>
                  <Text style={styles.photoHint}>Recomendado para segurança</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Suas Informações</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="Digite seu nome completo"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Documento (RG/CPF) *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.document}
                onChangeText={(value) => handleInputChange('document', value)}
                placeholder="Digite o número do documento"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefone *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="(11) 99999-9999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Visit Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏠 Informações da Visita</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Número do Apartamento *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.apartment_number}
                onChangeText={(value) => handleInputChange('apartment_number', value)}
                placeholder="Ex: 101, 205, 1504"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Motivo da Visita</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.notes}
                onChangeText={(value) => handleInputChange('notes', value)}
                placeholder="Descreva brevemente o motivo da sua visita..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            <Ionicons name="send" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Enviando...' : 'Registrar Visita'}
            </Text>
          </TouchableOpacity>

          {/* Help Text */}
          <View style={styles.helpCard}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.helpText}>
              📸 Toque no ícone da câmera para adicionar uma foto (obrigatório)
            </Text>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
    paddingTop: 0,
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  photoButton: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  photoHint: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  dropdownContainer: {
    marginBottom: 15,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    minHeight: 50,
  },
  dropdownSelected: {
    borderColor: '#FF9800',
    backgroundColor: '#fff8f0',
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  dropdownTextSelected: {
    color: '#333',
    fontWeight: '500',
  },
  disabledDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    minHeight: 50,
  },
  disabledText: {
    flex: 1,
    fontSize: 16,
    color: '#ccc',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 15,
    marginBottom: 15,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  helpCard: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 10,
    lineHeight: 20,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  searchIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
  },
  buildingList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    maxHeight: 200,
    marginBottom: 15,
  },
  buildingScrollView: {
    maxHeight: 200,
  },
  buildingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedBuildingItem: {
    backgroundColor: '#f0f8ff',
  },
  buildingInfo: {
    flex: 1,
  },
  buildingName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  buildingAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});
