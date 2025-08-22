import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import {
  sendWhatsAppMessage,
  sendBulkWhatsAppMessages,
  validateBrazilianPhone,
  formatBrazilianPhone,
  isEvolutionApiConfigured,
  showConfigurationAlert,
  ResidentData,
} from '~/utils/whatsapp';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'porteiro' | 'morador';
  cpf?: string;
  phone?: string;
  email?: string;
  building_id?: string;
  photo_url?: string;
  last_login?: string;
  created_at: string;
  apartments?: { id: string; number: string; building_id: string }[];
}

interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  number: string;
  building_id: string;
}

interface Vehicle {
  id: string;
  license_plate: string;
  model: string;
  color: string;
  parking_spot?: string;
  owner_id: string;
  building_id: string;
  created_at: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [filteredApartments, setFilteredApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    type: 'morador' as 'morador' | 'porteiro',
    phone: '',
    selectedBuildingId: '',
    selectedApartmentIds: [] as string[],
  });

  const [multipleResidents, setMultipleResidents] = useState([
    { name: '', phone: '', selectedBuildingId: '', selectedApartmentId: '' },
  ]);
  const [showMultipleForm, setShowMultipleForm] = useState(false);

  // Controle de abertura única dos modais
  const closeAllModals = () => {
    setShowAddForm(false);
    setShowMultipleForm(false);
    setShowVehicleForm(false);
    setShowBulkForm(false);
  };

  const openAddUserModal = () => {
    closeAllModals();
    setShowAddForm(true);
  };

  const openMultipleModal = () => {
    closeAllModals();
    setShowMultipleForm(true);
  };

  // Estados para cadastro em massa e WhatsApp
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkResidents, setBulkResidents] = useState<ResidentData[]>([]);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [whatsappBaseUrl, setWhatsappBaseUrl] = useState('https://cadastro.porteiroapp.com');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Estados para cadastro de veículos
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    license_plate: '',
    model: '',
    color: '',
    parking_spot: '',
    selectedBuildingId: '',
    selectedOwnerId: '',
  });
  const [vehicleOwners, setVehicleOwners] = useState<User[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchBuildings();
    fetchApartments();
  }, []);

  useEffect(() => {
    if (newUser.selectedBuildingId) {
      const filtered = apartments.filter((apt) => apt.building_id === newUser.selectedBuildingId);
      console.log('🏢 Prédio selecionado:', newUser.selectedBuildingId);
      console.log('🔍 Total de apartamentos disponíveis:', apartments.length);
      console.log('✅ Apartamentos filtrados para este prédio:', filtered.length);
      console.log('📝 Lista filtrada:', filtered);
      setFilteredApartments(filtered);
      setNewUser((prev) => ({ ...prev, selectedApartmentIds: [] }));
    } else {
      setFilteredApartments([]);
    }
  }, [newUser.selectedBuildingId, apartments]);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery]);

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.cpf?.includes(searchQuery) ||
        user.phone?.includes(searchQuery) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          *,
          apartments:apartment_residents(
            apartment:apartments(
              id,
              number,
              building_id
            )
          )
        `
        )
        .order('name');

      if (error) throw error;

      const usersWithApartments = (data || []).map((user) => ({
        ...user,
        apartments: user.apartments?.map((ar: any) => ar.apartment) || [],
      }));

      setUsers(usersWithApartments);
      setFilteredUsers(usersWithApartments);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase.from('buildings').select('*').order('name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  };

  const fetchApartments = async () => {
    try {
      const { data, error } = await supabase.from('apartments').select('*').order('number');

      if (error) throw error;
      console.log('🏠 Apartamentos carregados do banco:', data?.length || 0);
      console.log('📋 Lista de apartamentos:', data);
      setApartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar apartamentos:', error);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permissão necessária', 'É necessário permitir acesso à galeria de fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewUser((prev) => ({ ...prev, photo_url: result.assets[0].uri }));
    }
  };

  const validateUser = () => {
    if (!newUser.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return false;
    }
    if (!newUser.phone.trim()) {
      Alert.alert('Erro', 'Telefone é obrigatório');
      return false;
    }
    if (!validateBrazilianPhone(newUser.phone)) {
      Alert.alert('Erro', 'Telefone deve estar no formato brasileiro válido');
      return false;
    }
    if (!newUser.selectedBuildingId) {
      Alert.alert('Erro', 'Prédio é obrigatório');
      return false;
    }
    if (newUser.type === 'morador' && newUser.selectedApartmentIds.length === 0) {
      Alert.alert('Erro', 'Pelo menos um apartamento deve ser selecionado para moradores');
      return false;
    }
    return true;
  };

  const validateMultipleResidents = () => {
    for (let i = 0; i < multipleResidents.length; i++) {
      const resident = multipleResidents[i];
      if (!resident.name.trim()) {
        Alert.alert('Erro', `Nome é obrigatório para o morador ${i + 1}`);
        return false;
      }
      if (!resident.phone.trim()) {
        Alert.alert('Erro', `Telefone é obrigatório para o morador ${i + 1}`);
        return false;
      }
      if (!validateBrazilianPhone(resident.phone)) {
        Alert.alert('Erro', `Telefone inválido para o morador ${i + 1}`);
        return false;
      }
      if (!resident.selectedBuildingId) {
        Alert.alert('Erro', `Prédio é obrigatório para o morador ${i + 1}`);
        return false;
      }
      if (!resident.selectedApartmentId) {
        Alert.alert('Erro', `Apartamento é obrigatório para o morador ${i + 1}`);
        return false;
      }
    }
    return true;
  };

  const addMultipleResident = () => {
    setMultipleResidents([
      ...multipleResidents,
      { name: '', phone: '', selectedBuildingId: '', selectedApartmentId: '' },
    ]);
  };

  const removeMultipleResident = (index: number) => {
    if (multipleResidents.length > 1) {
      const updated = multipleResidents.filter((_, i) => i !== index);
      setMultipleResidents(updated);
    }
  };

  const updateMultipleResident = (index: number, field: string, value: string) => {
    const updated = [...multipleResidents];
    updated[index] = { ...updated[index], [field]: value };
    setMultipleResidents(updated);
  };

  const handleMultipleResidents = async () => {
    if (!validateMultipleResidents()) {
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const resident of multipleResidents) {
        try {
          // Criar usuário
          const { data: userData, error: userError } = await supabase
            .from('users')
            .insert({
              name: resident.name,
              phone: resident.phone,
              role: 'morador',
            })
            .select()
            .single();

          if (userError) throw userError;

          // Associar ao apartamento
          const { error: residentsError } = await supabase.from('residents').insert({
            user_id: userData.id,
            apartment_id: resident.selectedApartmentId,
            building_id: resident.selectedBuildingId,
          });

          if (residentsError) throw residentsError;

          // Enviar WhatsApp se habilitado
          if (sendWhatsApp && whatsappBaseUrl) {
            const building = buildings.find((b) => b.id === resident.selectedBuildingId);
            const apartment = apartments.find((a) => a.id === resident.selectedApartmentId);

            if (building && apartment) {
              const residentData: ResidentData = {
                name: resident.name,
                phone: resident.phone,
                building: building.name,
                apartment: apartment.number,
              };
              await sendWhatsAppMessage(residentData, whatsappBaseUrl);
            }
          }

          successCount++;
        } catch (error) {
          console.error('Erro ao cadastrar morador:', error);
          errorCount++;
          errors.push(`${resident.name}: ${error.message}`);
        }
      }

      // Mostrar resultado
      const message = `Cadastro concluído!\n${successCount} moradores cadastrados com sucesso.${errorCount > 0 ? `\n${errorCount} erros encontrados.` : ''}`;
      Alert.alert('Resultado', message);

      if (successCount > 0) {
        // Limpar formulário
        setMultipleResidents([
          { name: '', phone: '', selectedBuildingId: '', selectedApartmentId: '' },
        ]);
        setShowMultipleForm(false);
        fetchUsers();
      }
    } catch (error) {
      console.error('Erro geral:', error);
      Alert.alert('Erro', 'Erro ao processar cadastros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!validateUser()) {
      return;
    }

    try {
      setLoading(true);
      const userData: any = {
        name: newUser.name,
        user_type: newUser.type,
        phone: newUser.phone,
        building_id: newUser.selectedBuildingId,
      };

      const { data: insertedUser, error } = await supabase
        .from('profiles')
        .insert(userData)
        .select()
        .single();

      if (error) throw error;

      // Se for morador, associar aos apartamentos selecionados
      if (newUser.type === 'morador' && newUser.selectedApartmentIds.length > 0) {
        const apartmentAssociations = newUser.selectedApartmentIds.map((apartmentId) => ({
          profile_id: insertedUser.id,
          apartment_id: apartmentId,
          is_owner: false,
        }));

        const { error: associationError } = await supabase
          .from('apartment_residents')
          .insert(apartmentAssociations);

        if (associationError) throw associationError;
      }

      // Enviar WhatsApp apenas para moradores
      if (sendWhatsApp && newUser.type === 'morador') {
        await handleSingleUserWhatsApp(insertedUser, newUser.selectedApartmentIds);
      }

      Alert.alert('Sucesso', 'Usuário criado com sucesso');
      setNewUser({
        name: '',
        type: 'morador',
        phone: '',
        selectedBuildingId: '',
        selectedApartmentIds: [],
      });
      setShowAddForm(false);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      Alert.alert('Erro', 'Falha ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    Alert.alert('Confirmar Exclusão', `Deseja excluir o usuário ${userName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            // Primeiro, remover associações de apartamentos
            await supabase.from('apartment_residents').delete().eq('profile_id', userId);

            // Depois, remover o usuário
            const { error } = await supabase.from('profiles').delete().eq('id', userId);

            if (error) throw error;
            fetchUsers();
          } catch (error) {
            Alert.alert('Erro', 'Falha ao excluir usuário');
          }
        },
      },
    ]);
  };

  // Funções para cadastro em massa e WhatsApp
  const addBulkResident = () => {
    setBulkResidents([...bulkResidents, { name: '', phone: '', building: '', apartment: '' }]);
  };

  const removeBulkResident = (index: number) => {
    setBulkResidents(bulkResidents.filter((_, i) => i !== index));
  };

  const updateBulkResident = (index: number, field: keyof ResidentData, value: string) => {
    const updated = [...bulkResidents];
    updated[index] = { ...updated[index], [field]: value };
    setBulkResidents(updated);
  };

  const validateBulkResidents = (): boolean => {
    for (let i = 0; i < bulkResidents.length; i++) {
      const resident = bulkResidents[i];
      if (!resident.name || !resident.phone || !resident.building || !resident.apartment) {
        Alert.alert('Erro', `Morador ${i + 1}: Todos os campos são obrigatórios`);
        return false;
      }
      if (!validateBrazilianPhone(resident.phone)) {
        Alert.alert('Erro', `Morador ${i + 1}: Número de telefone inválido`);
        return false;
      }
    }
    return true;
  };

  const handleBulkRegistration = async () => {
    if (!validateBulkResidents()) return;

    if (sendWhatsApp && !isEvolutionApiConfigured()) {
      showConfigurationAlert();
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Iniciando cadastro em massa...');

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < bulkResidents.length; i++) {
        const resident = bulkResidents[i];
        setProcessingStatus(`Processando ${resident.name} (${i + 1}/${bulkResidents.length})...`);

        try {
          // Buscar building_id pelo nome
          const building = buildings.find((b) => b.name === resident.building);
          if (!building) {
            errors.push(`${resident.name}: Prédio '${resident.building}' não encontrado`);
            errorCount++;
            continue;
          }

          // Buscar apartment_id pelo número e building_id
          const apartment = apartments.find(
            (a) => a.number === resident.apartment && a.building_id === building.id
          );
          if (!apartment) {
            errors.push(
              `${resident.name}: Apartamento '${resident.apartment}' não encontrado no prédio '${resident.building}'`
            );
            errorCount++;
            continue;
          }

          // Criar usuário
          const userData = {
            name: resident.name,
            user_type: 'morador',
            phone: resident.phone,
            condominium_id: building.id,
            building_id: building.id,
          };

          const { data: insertedUser, error } = await supabase
            .from('profiles')
            .insert(userData)
            .select()
            .single();

          if (error) throw error;

          // Associar ao apartamento
          const { error: associationError } = await supabase.from('residents').insert({
            user_id: insertedUser.id,
            apartment_id: apartment.id,
            is_owner: false,
          });

          if (associationError) throw associationError;

          successCount++;

          // Enviar WhatsApp se habilitado
          if (sendWhatsApp) {
            setProcessingStatus(`Enviando WhatsApp para ${resident.name}...`);
            const whatsappResult = await sendWhatsAppMessage(resident, whatsappBaseUrl);
            if (!whatsappResult.success) {
              errors.push(`${resident.name}: WhatsApp - ${whatsappResult.error}`);
            }
          }
        } catch (error) {
          errorCount++;
          errors.push(
            `${resident.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          );
        }

        // Delay entre processamentos
        if (i < bulkResidents.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Mostrar resultado
      let message = `Cadastro concluído!\n\n✅ Sucessos: ${successCount}\n❌ Erros: ${errorCount}`;
      if (errors.length > 0) {
        message += `\n\nErros:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n... e mais ${errors.length - 5} erros`;
        }
      }

      Alert.alert('Resultado do Cadastro', message);

      if (successCount > 0) {
        setBulkResidents([]);
        setShowBulkForm(false);
        fetchUsers();
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha no cadastro em massa');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleSingleUserWhatsApp = async (userData: any, apartmentIds: string[]) => {
    if (!sendWhatsApp || !isEvolutionApiConfigured()) return;

    try {
      // Para cada apartamento selecionado, enviar WhatsApp
      for (const apartmentId of apartmentIds) {
        const apartment = apartments.find((a) => a.id === apartmentId);
        const building = buildings.find((b) => b.id === apartment?.building_id);

        if (apartment && building) {
          const residentData: ResidentData = {
            name: userData.name,
            phone: userData.phone,
            building: building.name,
            apartment: apartment.number,
          };

          const result = await sendWhatsAppMessage(residentData, whatsappBaseUrl);
          if (!result.success) {
            Alert.alert('Aviso', `Erro ao enviar WhatsApp: ${result.error}`);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.license_plate || !newVehicle.model || !newVehicle.color) {
      Alert.alert(
        'Erro',
        'Por favor, preencha todos os campos obrigatórios (placa, modelo e cor).'
      );
      return;
    }

    if (!newVehicle.selectedBuildingId || !newVehicle.selectedOwnerId) {
      Alert.alert('Erro', 'Por favor, selecione um prédio e proprietário.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('vehicles').insert({
        license_plate: newVehicle.license_plate,
        model: newVehicle.model,
        color: newVehicle.color,
        parking_spot: newVehicle.parking_spot || null,
        owner_id: newVehicle.selectedOwnerId,
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Veículo cadastrado com sucesso!');
      setShowVehicleForm(false);
      setNewVehicle({
        license_plate: '',
        model: '',
        color: '',
        parking_spot: '',
        selectedBuildingId: '',
        selectedOwnerId: '',
      });
      setVehicleOwners([]);
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      Alert.alert('Erro', 'Erro ao cadastrar veículo.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#9C27B0';
      case 'porteiro':
        return '#2196F3';
      case 'morador':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return '👨‍💼';
      case 'porteiro':
        return '🛡️';
      case 'morador':
        return '🏠';
      default:
        return '👤';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando usuários...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>👥 Gerenciar Usuários</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.addButton} onPress={openAddUserModal}>
          <Text style={styles.addButtonText}>➕ Novo Usuário</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.multipleButton} onPress={openMultipleModal}>
          <Text style={styles.multipleButtonText}>👥 Múltiplos Disparos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vehicleButton}
          onPress={() => setShowVehicleForm(!showVehicleForm)}>
          <Text style={styles.vehicleButtonText}>
            {showVehicleForm ? '❌ Cancelar' : '🚗 Adicionar Veículo'}
          </Text>
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Buscar por nome, telefone ou tipo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => filterUsers()}>
            <Text style={styles.searchButtonText}>🔍 Procurar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Novo Usuário */}
      <Modal
        visible={showAddForm}
        animationType="slide"
        presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✨ Novo Usuário</Text>
            <TouchableOpacity onPress={() => setShowAddForm(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}>


          <View style={styles.roleSelector}>
            <Text style={styles.roleLabel}>Tipo de usuário:</Text>
            <View style={styles.roleButtons}>
              {['morador', 'porteiro'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    newUser.type === role && styles.roleButtonActive,
                    { borderColor: getRoleColor(role) },
                  ]}
                  onPress={() => setNewUser((prev) => ({ ...prev, type: role as any }))}>
                  <Text
                    style={[
                      styles.roleButtonText,
                      newUser.type === role && { color: getRoleColor(role) },
                    ]}>
                    {getRoleIcon(role)} {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o nome completo"
              value={newUser.name}
              onChangeText={(text) => setNewUser((prev) => ({ ...prev, name: text }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefone WhatsApp *</Text>
            <TextInput
              style={styles.input}
              placeholder="(11) 99999-9999"
              value={newUser.phone}
              onChangeText={(text) => setNewUser((prev) => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Prédio *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newUser.selectedBuildingId}
                style={styles.picker}
                onValueChange={(itemValue) =>
                  setNewUser((prev) => ({ ...prev, selectedBuildingId: itemValue }))
                }>
                <Picker.Item label="Selecione um prédio" value="" />
                {buildings.map((building) => (
                  <Picker.Item key={building.id} label={building.name} value={building.id} />
                ))}
              </Picker>
            </View>
          </View>

          {newUser.type === 'morador' && newUser.selectedBuildingId && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Apartamentos *</Text>
              <Text style={styles.sublabel}>Selecione um ou mais apartamentos</Text>
              <View style={styles.apartmentsList}>
                {filteredApartments.map((apartment) => (
                  <TouchableOpacity
                    key={apartment.id}
                    style={[
                      styles.apartmentOption,
                      newUser.selectedApartmentIds.includes(apartment.id) &&
                        styles.apartmentOptionSelected,
                    ]}
                    onPress={() => {
                      const isSelected = newUser.selectedApartmentIds.includes(apartment.id);
                      if (isSelected) {
                        setNewUser((prev) => ({
                          ...prev,
                          selectedApartmentIds: prev.selectedApartmentIds.filter(
                            (id) => id !== apartment.id
                          ),
                        }));
                      } else {
                        setNewUser((prev) => ({
                          ...prev,
                          selectedApartmentIds: [...prev.selectedApartmentIds, apartment.id],
                        }));
                      }
                    }}>
                    <Text
                      style={[
                        styles.apartmentOptionText,
                        newUser.selectedApartmentIds.includes(apartment.id) &&
                          styles.apartmentOptionTextSelected,
                      ]}>
                      {newUser.selectedApartmentIds.includes(apartment.id) ? '✅' : '⭕'}{' '}
                      Apartamento {apartment.number}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {newUser.type === 'morador' && (
            <View style={styles.whatsappSection}>
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[styles.checkbox, sendWhatsApp && styles.checkboxChecked]}
                  onPress={() => setSendWhatsApp(!sendWhatsApp)}>
                  {sendWhatsApp && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>📱 Enviar mensagem via WhatsApp</Text>
              </View>

              {sendWhatsApp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>URL Base do Site de Cadastro</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://seusite.com/cadastro"
                    value={whatsappBaseUrl}
                    onChangeText={setWhatsappBaseUrl}
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>
          )}

          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowAddForm(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.disabledButton]}
              onPress={handleAddUser}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>✅ Criar Usuário</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de Múltiplos Disparos */}
      <Modal
        visible={showMultipleForm}
        animationType="slide"
        presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>👥 Múltiplos Disparos</Text>
            <TouchableOpacity onPress={() => setShowMultipleForm(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}>


          {/* Configurações do WhatsApp */}
          <View style={styles.whatsappSection}>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, sendWhatsApp && styles.checkboxChecked]}
                onPress={() => setSendWhatsApp(!sendWhatsApp)}>
                {sendWhatsApp && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>Enviar mensagem via WhatsApp</Text>
            </View>

            {sendWhatsApp && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>URL Base do Site de Cadastro</Text>
                <TextInput
                  style={styles.input}
                  value={whatsappBaseUrl}
                  onChangeText={setWhatsappBaseUrl}
                  placeholder="https://seusite.com/cadastro"
                  autoCapitalize="none"
                />
              </View>
            )}
          </View>

          {/* Lista de moradores */}
          {multipleResidents.map((resident, index) => (
            <View key={index} style={styles.residentCard}>
              <View style={styles.residentHeader}>
                <Text style={styles.residentTitle}>Morador {index + 1}</Text>
                <View style={styles.residentActions}>
                  {multipleResidents.length > 1 && (
                    <TouchableOpacity onPress={() => removeMultipleResident(index)}>
                      <Text style={styles.removeButton}>➖</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={addMultipleResident}>
                    <Text style={styles.addButton}>➕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo *</Text>
                <TextInput
                  style={styles.input}
                  value={resident.name}
                  onChangeText={(value) => updateMultipleResident(index, 'name', value)}
                  placeholder="Nome completo do morador"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone WhatsApp *</Text>
                <TextInput
                  style={styles.input}
                  value={resident.phone}
                  onChangeText={(value) => updateMultipleResident(index, 'phone', value)}
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Prédio *</Text>
                <Picker
                  selectedValue={resident.selectedBuildingId}
                  style={styles.picker}
                  onValueChange={(value) =>
                    updateMultipleResident(index, 'selectedBuildingId', value)
                  }>
                  <Picker.Item label="Selecione um prédio" value="" />
                  {buildings.map((building) => (
                    <Picker.Item key={building.id} label={building.name} value={building.id} />
                  ))}
                </Picker>
              </View>

              {resident.selectedBuildingId && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Apartamento *</Text>
                  <Picker
                    selectedValue={resident.selectedApartmentId}
                    style={styles.picker}
                    onValueChange={(value) =>
                      updateMultipleResident(index, 'selectedApartmentId', value)
                    }>
                    <Picker.Item label="Selecione um apartamento" value="" />
                    {apartments
                      .filter((apt) => apt.building_id === resident.selectedBuildingId)
                      .map((apartment) => (
                        <Picker.Item
                          key={apartment.id}
                          label={apartment.number}
                          value={apartment.id}
                        />
                      ))}
                  </Picker>
                </View>
              )}
            </View>
          ))}

          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowMultipleForm(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton, isProcessing && styles.disabledButton]}
              onPress={handleMultipleResidents}
              disabled={isProcessing}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>📤 Enviar Todos os Disparos</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de Status de Processamento */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.processingText}>{processingStatus}</Text>
          </View>
        </View>
      </Modal>

      {/* Modal de Cadastro de Veículos */}
      {showVehicleForm && (
        <ScrollView
          style={[styles.vehicleForm, { paddingVertical: 20 }]}
          contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.vehicleHeader}>
            <Text style={styles.vehicleTitle}>🚗 Novo Veículo</Text>
            <TouchableOpacity onPress={() => setShowVehicleForm(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Placa do Veículo *</Text>
            <TextInput
              style={styles.input}
              placeholder="ABC-1234"
              value={newVehicle.license_plate}
              onChangeText={(text) =>
                setNewVehicle((prev) => ({ ...prev, license_plate: text.toUpperCase() }))
              }
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Modelo do Veículo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Honda Civic, Toyota Corolla"
              value={newVehicle.model}
              onChangeText={(text) => setNewVehicle((prev) => ({ ...prev, model: text }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cor do Veículo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Branco, Preto, Prata"
              value={newVehicle.color}
              onChangeText={(text) => setNewVehicle((prev) => ({ ...prev, color: text }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vaga de Estacionamento</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: A-15, B-23 (opcional)"
              value={newVehicle.parking_spot}
              onChangeText={(text) => setNewVehicle((prev) => ({ ...prev, parking_spot: text }))}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Prédio *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newVehicle.selectedBuildingId}
                style={styles.picker}
                onValueChange={(itemValue) => {
                  setNewVehicle((prev) => ({
                    ...prev,
                    selectedBuildingId: itemValue,
                    selectedOwnerId: '',
                  }));
                  if (itemValue) {
                    const buildingResidents = users.filter(
                      (user) =>
                        user.role === 'morador' &&
                        user.apartments?.some((apt) => apt.building_id === itemValue)
                    );
                    setVehicleOwners(buildingResidents);
                  } else {
                    setVehicleOwners([]);
                  }
                }}>
                <Picker.Item label="Selecione um prédio" value="" />
                {buildings.map((building) => (
                  <Picker.Item key={building.id} label={building.name} value={building.id} />
                ))}
              </Picker>
            </View>
          </View>

          {newVehicle.selectedBuildingId && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Proprietário (Morador) *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newVehicle.selectedOwnerId}
                  style={styles.picker}
                  onValueChange={(itemValue) =>
                    setNewVehicle((prev) => ({ ...prev, selectedOwnerId: itemValue }))
                  }>
                  <Picker.Item label="Selecione o proprietário" value="" />
                  {vehicleOwners.map((owner) => {
                    const apartmentNumbers =
                      owner.apartments?.map((apt) => apt.number).join(', ') || '';
                    return (
                      <Picker.Item
                        key={owner.id}
                        label={`${owner.name} - Apt: ${apartmentNumbers}`}
                        value={owner.id}
                      />
                    );
                  })}
                </Picker>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleAddVehicle}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.submitButtonText}>🚗 Cadastrar Veículo</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      <ScrollView style={styles.usersList}>
        {filteredUsers.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              {user.photo_url ? (
                <Image source={{ uri: user.photo_url }} style={styles.userPhoto} />
              ) : (
                <Text style={styles.userIcon}>{getRoleIcon(user.role)}</Text>
              )}
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                {user.cpf && <Text style={styles.userInfo}>CPF: {user.cpf}</Text>}
                {user.phone && <Text style={styles.userInfo}>Tel: {user.phone}</Text>}
                {user.email && <Text style={styles.userInfo}>Email: {user.email}</Text>}
                <Text
                  style={[styles.userRole, { color: getRoleColor(user.user_type || user.role) }]}>
                  {(user.user_type || user.role).charAt(0).toUpperCase() +
                    (user.user_type || user.role).slice(1)}
                </Text>
                {user.apartments && user.apartments.length > 0 && (
                  <Text style={styles.userApartments}>
                    Apartamentos: {user.apartments.map((apt) => apt.number).join(', ')}
                  </Text>
                )}
                {user.last_login && (
                  <Text style={styles.lastLogin}>
                    Último acesso: {new Date(user.last_login).toLocaleDateString('pt-BR')}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteUser(user.id, user.name)}>
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
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
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  apartmentsList: {
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
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
    maxHeight: 500,
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
  roleSelector: {
    marginBottom: 25,
  },
  roleLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2c3e50',
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    padding: 15,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  roleButtonActive: {
    backgroundColor: '#e8f4fd',
    borderWidth: 3,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  sublabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  usersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userIcon: {
    fontSize: 32,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userRole: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  lastLogin: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  userApartments: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 10,
  },
  deleteButtonText: {
    fontSize: 20,
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
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 5,
    color: '#333',
  },
  pickerSubLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  picker: {
    height: 50,
    backgroundColor: 'transparent',
  },
  apartmentOption: {
    padding: 15,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  apartmentOptionSelected: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  apartmentOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  apartmentOptionTextSelected: {
    color: '#155724',
    fontWeight: 'bold',
  },
  photoSection: {
    marginBottom: 15,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  photoButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#666',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
  },
  userPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    marginRight: 10,
  },
  bulkActions: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  bulkButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  bulkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    gap: 15,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  whatsappSection: {
    marginTop: 25,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: '#007bff',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  checkmark: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  residentCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  residentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  residentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  removeButton: {
    fontSize: 20,
  },
  addResidentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 20,
  },
  addResidentText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },

  disabledButton: {
    backgroundColor: '#ccc',
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multipleButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multipleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  processingModal: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  processingText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  multipleForm: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  multipleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  multipleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  residentActions: {
    flexDirection: 'row',
    gap: 10,
  },
  addResidentButtonStyle: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  vehicleButton: {
    backgroundColor: '#9C27B0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  vehicleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  vehicleForm: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  vehicleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});
