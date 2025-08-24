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
import { supabase, adminAuth } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { notificationService } from '~/services/notificationService';

// Interface para dados do morador
interface ResidentData {
  name: string;
  phone: string;
  building: string;
  apartment: string;
}

// Funções auxiliares para validação
const validateBrazilianPhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length === 10 || cleanPhone.length === 11;
};

const formatBrazilianPhone = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    return `+55${cleanPhone}`;
  } else if (cleanPhone.length === 11) {
    return `+55${cleanPhone}`;
  }
  return phone;
};

const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
  
  return true;
};

const formatCPF = (cpf: string): string => {
  const cleanCPF = cpf.replace(/\D/g, '');
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const formatDate = (date: string): string => {
  const cleanDate = date.replace(/\D/g, '');
  if (cleanDate.length <= 2) return cleanDate;
  if (cleanDate.length <= 4) return `${cleanDate.slice(0, 2)}/${cleanDate.slice(2)}`;
  return `${cleanDate.slice(0, 2)}/${cleanDate.slice(2, 4)}/${cleanDate.slice(4, 8)}`;
};

const validateDate = (date: string): boolean => {
  const cleanDate = date.replace(/\D/g, '');
  if (cleanDate.length !== 8) return false;
  
  const day = parseInt(cleanDate.slice(0, 2));
  const month = parseInt(cleanDate.slice(2, 4));
  const year = parseInt(cleanDate.slice(4, 8));
  
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  
  return true;
};

// Função para verificar se a API está configurada (sempre retorna true agora)
const isEvolutionApiConfigured = (): boolean => {
  return true; // A API de notificação cuida da configuração
};

// Função para mostrar alerta de configuração (não mais necessária)
const showConfigurationAlert = (): void => {
  Alert.alert('Configuração', 'API de notificação está sendo usada.');
};

// Interface flexível para refletir divergências atuais entre código e schema
interface User {
  id: string;
  name?: string;              // coluna real
  full_name?: string;         // legado usado no código antigo
  role: 'admin' | 'porteiro' | 'morador';
  user_type?: string | null;  // algumas consultas retornam user_type
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  address?: string | null;
  building_id?: string | null;
  photo_url?: string | null;
  last_login?: string | null;
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
    cpf: '',
    email: '',
    birthDate: '',
    address: '',
    workSchedule: '',
    workDays: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
    workStartTime: '',
    workEndTime: '',
    photoUri: '',
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

  // Função para upload seguro de imagem para o Supabase Storage
  const uploadImageToStorage = async (imageUri: string, userId: string): Promise<string | null> => {
    try {
      console.log('📸 [DEBUG] Iniciando upload - URI:', imageUri);
      console.log('📸 [DEBUG] User ID:', userId);
      
      // Verificar se a URI é válida
      if (!imageUri || !imageUri.startsWith('file://')) {
        throw new Error('URI da imagem inválida');
      }
      
      // Converter URI para blob com timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
      
      const response = await fetch(imageUri, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Falha ao carregar imagem: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('📸 [DEBUG] Blob criado - Tipo:', blob.type, 'Tamanho:', blob.size);
      
      // Validar tipo de arquivo
      if (!blob.type.startsWith('image/')) {
        throw new Error('Arquivo deve ser uma imagem');
      }
      
      // Validar tamanho (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (blob.size > maxSize) {
        throw new Error('Imagem deve ter no máximo 5MB');
      }
      
      // Gerar nome único para o arquivo
      const fileExt = blob.type.split('/')[1] || 'jpg';
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      console.log('📸 [DEBUG] Nome do arquivo:', fileName);
      
      // Upload para o bucket profiles-images com retry
      let uploadAttempts = 0;
      const maxAttempts = 3;
      let uploadError;
      
      while (uploadAttempts < maxAttempts) {
        try {
          uploadAttempts++;
          console.log(`📸 [DEBUG] Tentativa de upload ${uploadAttempts}/${maxAttempts}`);
          
          const { data, error } = await supabase.storage
            .from('profiles-images')
            .upload(fileName, blob, {
              cacheControl: '3600',
              upsert: true
            });
          
          if (error) {
            uploadError = error;
            console.error(`❌ [DEBUG] Erro na tentativa ${uploadAttempts}:`, error);
            
            if (uploadAttempts < maxAttempts) {
              console.log('🔄 [DEBUG] Aguardando antes da próxima tentativa...');
              await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos
              continue;
            }
            throw error;
          }
          
          // Upload bem-sucedido
          console.log('✅ [DEBUG] Upload realizado com sucesso:', data);
          
          // Obter URL pública da imagem
          const { data: { publicUrl } } = supabase.storage
            .from('profiles-images')
            .getPublicUrl(fileName);
          
          console.log('✅ [DEBUG] URL pública gerada:', publicUrl);
          return publicUrl;
          
        } catch (attemptError) {
          uploadError = attemptError;
          console.error(`❌ [DEBUG] Erro na tentativa ${uploadAttempts}:`, attemptError);
          
          if (uploadAttempts < maxAttempts) {
            console.log('🔄 [DEBUG] Aguardando antes da próxima tentativa...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos
          }
        }
      }
      
      throw uploadError || new Error('Falha no upload após múltiplas tentativas');
      
    } catch (error) {
      console.error('❌ [DEBUG] Erro final no upload da imagem:', error);
      
      // Retornar null em vez de lançar erro para permitir que o cadastro continue
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('❌ [DEBUG] Upload cancelado por timeout');
        } else if (error.message.includes('Network request failed')) {
          console.error('❌ [DEBUG] Falha de rede no upload');
        }
      }
      
      return null; // Retorna null em vez de lançar erro
    }
  };

  // Função para seleção e upload automático de foto
  const handleSelectPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];
        
        // Validar tamanho do arquivo (máximo 5MB)
        if (selectedImage.fileSize && selectedImage.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Erro', 'A imagem deve ter no máximo 5MB. Por favor, selecione uma imagem menor.');
          return;
        }
        
        // Atualizar URI local temporariamente para preview
        setNewUser(prev => ({ ...prev, photoUri: selectedImage.uri }));
        
        // Mostrar feedback detalhado
        Alert.alert(
          'Imagem Selecionada', 
          'Foto selecionada com sucesso! A imagem será enviada automaticamente para o servidor quando você salvar o porteiro.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erro ao selecionar foto:', error);
      Alert.alert('Erro', 'Falha ao selecionar foto. Tente novamente.');
    }
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
    brand: '',
    model: '',
    color: '',
    type: 'car',
  });
  const [vehicleOwners, setVehicleOwners] = useState<User[]>([]);
  const [vehicleApartments, setVehicleApartments] = useState<Apartment[]>([]);

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

    const q = searchQuery.toLowerCase();
    const filtered = users.filter((user) => {
      const nm = (user.name || user.full_name || '').toLowerCase();
      return (
        nm.includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.cpf || '').includes(searchQuery) ||
        (user.phone || '').includes(searchQuery) ||
        (user.role || '').toLowerCase().includes(q)
      );
    });
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
        .order('full_name');

      if (error) throw error;

      const usersWithApartments: User[] = (data || []).map((user: any) => ({
        ...user,
        name: user.name || user.full_name,
        role: (user.user_type || user.role || 'morador') as User['role'],
        apartments: user.apartments?.map((ar: any) => ar.apartment) || [],
      }));

      setUsers(usersWithApartments);
      setFilteredUsers(usersWithApartments);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        return;
      }

      // Buscar apenas os prédios que o administrador gerencia
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      setBuildings(adminBuildings || []);
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
    
    if (newUser.type === 'porteiro') {
      // Validações específicas para porteiro
      if (!newUser.cpf.trim()) {
        Alert.alert('Erro', 'CPF é obrigatório para porteiros');
        return false;
      }
      if (!validateCPF(newUser.cpf)) {
        Alert.alert('Erro', 'CPF inválido');
        return false;
      }
      if (!newUser.email.trim()) {
        Alert.alert('Erro', 'E-mail é obrigatório para porteiros');
        return false;
      }
      if (!validateEmail(newUser.email)) {
        Alert.alert('Erro', 'E-mail inválido');
        return false;
      }
      if (!newUser.birthDate.trim()) {
        Alert.alert('Erro', 'Data de nascimento é obrigatória para porteiros');
        return false;
      }
      if (!validateDate(newUser.birthDate)) {
        Alert.alert('Erro', 'Data de nascimento inválida');
        return false;
      }
      if (!newUser.address.trim()) {
        Alert.alert('Erro', 'Endereço é obrigatório para porteiros');
        return false;
      }
      // Validar dias da semana
      const selectedDays = Object.values(newUser.workDays).some(day => day);
      if (!selectedDays) {
        Alert.alert('Erro', 'Pelo menos um dia da semana deve ser selecionado para porteiros');
        return false;
      }
      
      // Validar horários de trabalho
      if (!newUser.workStartTime.trim()) {
        Alert.alert('Erro', 'Horário de início é obrigatório para porteiros');
        return false;
      }
      if (!newUser.workEndTime.trim()) {
        Alert.alert('Erro', 'Horário de fim é obrigatório para porteiros');
        return false;
      }
      
      // Validar formato dos horários (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(newUser.workStartTime)) {
        Alert.alert('Erro', 'Horário de início deve estar no formato HH:MM (ex: 08:00)');
        return false;
      }
      if (!timeRegex.test(newUser.workEndTime)) {
        Alert.alert('Erro', 'Horário de fim deve estar no formato HH:MM (ex: 18:00)');
        return false;
      }
    } else {
      // Validações para morador
      if (!newUser.phone.trim()) {
        Alert.alert('Erro', 'Telefone é obrigatório');
        return false;
      }
      if (!validateBrazilianPhone(newUser.phone)) {
        Alert.alert('Erro', 'Telefone deve estar no formato brasileiro válido');
        return false;
      }
      if (newUser.selectedApartmentIds.length === 0) {
        Alert.alert('Erro', 'Pelo menos um apartamento deve ser selecionado para moradores');
        return false;
      }
    }
    
    if (!newUser.selectedBuildingId) {
      Alert.alert('Erro', 'Prédio é obrigatório');
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
          // @ts-ignore Inserção simplificada mantendo compatibilidade legada
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .insert({
              name: resident.name,
              phone: resident.phone,
              // Campos obrigatórios simulados (ajuste futuro necessário)
              user_id: crypto.randomUUID(),
              email: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}@temp.local`,
            })
            .select()
            .single();

          if (userError) throw userError;

          // Associar ao apartamento
          // @ts-ignore Campos reais da tabela podem diferir; ajuste futuro
          const { error: residentsError } = await supabase.from('apartment_residents').insert({
            profile_id: userData.id,
            apartment_id: resident.selectedApartmentId,
            relationship: 'resident',
            is_primary: false,
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
          errors.push(`${resident.name}: ${error instanceof Error ? error.message : 'Erro'}`);
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
    console.log('🚀 [DEBUG] handleAddUser iniciado');
    console.log('🚀 [DEBUG] sendWhatsApp:', sendWhatsApp);
    console.log('🚀 [DEBUG] newUser.type:', newUser.type);
    console.log('🚀 [DEBUG] newUser.selectedApartmentIds:', newUser.selectedApartmentIds);
    
    if (!validateUser()) {
      return;
    }

    try {
      setLoading(true);
      let authUserId = null;
      
      // Se for porteiro, criar usuário no Supabase Auth primeiro
      if (newUser.type === 'porteiro') {
        console.log('🔐 [DEBUG] Criando login para porteiro...');
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: newUser.email,
          password: '123456', // Senha padrão
          options: {
            data: {
              full_name: newUser.name,
              user_type: 'porteiro'
            }
          }
        });

        if (authError) {
          console.error('❌ [DEBUG] Erro ao criar login:', authError);
          throw new Error(`Erro ao criar login: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('Falha ao criar usuário de autenticação');
        }

        authUserId = authData.user.id;
        console.log('✅ [DEBUG] Login criado com sucesso. User ID:', authUserId);
      }
      
      // Preparar dados base do usuário
      const userData: any = {
        full_name: newUser.name,
        role: newUser.type,
      };

      // Se for porteiro, usar o ID do auth.users
      if (newUser.type === 'porteiro' && authUserId) {
        userData.id = authUserId;
        userData.cpf = newUser.cpf;
        userData.email = newUser.email;
        userData.birth_date = newUser.birthDate;
        userData.address = newUser.address;
        // Formatar horário de expediente expandido
        const selectedDaysNames = Object.entries(newUser.workDays)
          .filter(([_, isSelected]) => isSelected)
          .map(([day, _]) => {
            const dayNames = {
              monday: 'Segunda-feira',
              tuesday: 'Terça-feira', 
              wednesday: 'Quarta-feira',
              thursday: 'Quinta-feira',
              friday: 'Sexta-feira',
              saturday: 'Sábado',
              sunday: 'Domingo'
            };
            return dayNames[day as keyof typeof dayNames];
          });
        
        const formattedSchedule = `${selectedDaysNames.join(', ')}: ${newUser.workStartTime}-${newUser.workEndTime}`;
        userData.work_schedule = formattedSchedule;
        userData.user_type = 'porteiro';
        userData.building_id = newUser.selectedBuildingId;
        
        // Upload da imagem para o Supabase Storage se uma foto foi selecionada
        if (newUser.photoUri) {
          console.log('📸 [DEBUG] Iniciando upload da imagem para o Storage...');
          const imageUrl = await uploadImageToStorage(newUser.photoUri, authUserId);
          
          if (imageUrl) {
            userData.avatar_url = imageUrl;
            console.log('✅ [DEBUG] Upload concluído. URL:', imageUrl);
          } else {
            console.log('⚠️ [DEBUG] Upload da imagem falhou, continuando cadastro sem imagem');
            Alert.alert(
              'Aviso', 
              'Não foi possível fazer upload da imagem. O porteiro será cadastrado sem foto de perfil.',
              [{ text: 'Continuar', style: 'default' }]
            );
            // Continua o cadastro sem a imagem
          }
        }
      } else {
        // Para moradores
        userData.phone = newUser.phone;
      }

      console.log('🚀 [DEBUG] userData criado:', userData);

      const { data: insertedUser, error } = await supabase
        .from('profiles')
        .insert(userData)
        .select()
        .single();

      if (error) {
        // Se houve erro ao inserir o profile e foi criado um usuário auth, fazer rollback
        if (authUserId) {
          console.log('🔄 [DEBUG] Fazendo rollback do usuário auth...');
          // Nota: O Supabase não permite deletar usuários via client, apenas via admin API
          // Em produção, seria necessário usar uma função server-side para isso
        }
        throw error;
      }

      console.log('🚀 [DEBUG] usuário inserido:', insertedUser);

      // Se for morador, associar aos apartamentos selecionados
      if (newUser.type === 'morador' && newUser.selectedApartmentIds.length > 0) {
        const apartmentAssociations = newUser.selectedApartmentIds.map((apartmentId) => ({
          profile_id: insertedUser.id,
          apartment_id: apartmentId,
          relationship: 'resident',
          is_primary: false,
        }));

        console.log('🚀 [DEBUG] apartmentAssociations:', apartmentAssociations);

        // @ts-ignore Inserção em lote conforme estrutura atual
        const { error: associationError } = await supabase
          .from('apartment_residents')
          .insert(apartmentAssociations);

        if (associationError) throw associationError;
        console.log('🚀 [DEBUG] associações de apartamento criadas com sucesso');
      }

      // Enviar WhatsApp APENAS para moradores (porteiros nunca recebem WhatsApp)
      if (sendWhatsApp && newUser.type === 'morador') {
        console.log('🚀 [DEBUG] Condições para WhatsApp atendidas, chamando handleSingleUserWhatsApp');
        await handleSingleUserWhatsApp(insertedUser, newUser.selectedApartmentIds);
      } else {
        console.log('🚀 [DEBUG] WhatsApp não será enviado - sendWhatsApp:', sendWhatsApp, 'tipo:', newUser.type);
      }

      // Mensagem de sucesso específica para cada tipo
      if (newUser.type === 'porteiro') {
        Alert.alert(
          'Porteiro Criado com Sucesso!', 
          `O porteiro ${newUser.name} foi cadastrado e pode fazer login com:\n\nE-mail: ${newUser.email}\nSenha: 123456\n\nO porteiro poderá alterar sua senha após o primeiro login.`
        );
      } else {
        Alert.alert('Sucesso', 'Usuário criado com sucesso');
      }
      
      // Resetar formulário
      setNewUser({
        name: '',
        type: 'morador',
        phone: '',
        cpf: '',
        email: '',
        birthDate: '',
        address: '',
        workSchedule: '',
        workDays: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        },
        workStartTime: '',
        workEndTime: '',
        photoUri: '',
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
            full_name: resident.name,
            phone: resident.phone,
          };

          const { data: insertedUser, error } = await supabase
            .from('profiles')
            .insert(userData)
            .select()
            .single();

          if (error) throw error;

          // Associar ao apartamento
          const { error: associationError } = await supabase.from('apartment_residents').insert({
            profile_id: insertedUser.id,
            apartment_id: apartment.id,
            is_owner: false,
          });

          if (associationError) throw associationError;

          successCount++;

          // Enviar WhatsApp se habilitado
          if (sendWhatsApp) {
            setProcessingStatus(`Enviando WhatsApp para ${resident.name}...`);
            const whatsappResult = await notificationService.sendResidentWhatsApp(resident, whatsappBaseUrl);
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
    console.log('📱 [DEBUG] handleSingleUserWhatsApp iniciado');
    console.log('📱 [DEBUG] sendWhatsApp:', sendWhatsApp);
    console.log('📱 [DEBUG] isEvolutionApiConfigured():', isEvolutionApiConfigured());
    console.log('📱 [DEBUG] userData:', userData);
    console.log('📱 [DEBUG] apartmentIds:', apartmentIds);
    console.log('📱 [DEBUG] whatsappBaseUrl:', whatsappBaseUrl);
    
    if (!sendWhatsApp || !isEvolutionApiConfigured()) {
      console.log('📱 [DEBUG] Condições não atendidas - retornando sem enviar');
      console.log('📱 [DEBUG] sendWhatsApp:', sendWhatsApp);
      console.log('📱 [DEBUG] isEvolutionApiConfigured():', isEvolutionApiConfigured());
      return;
    }

    try {
      console.log('📱 [DEBUG] Iniciando loop pelos apartamentos');
      console.log('📱 [DEBUG] Total de apartamentos disponíveis:', apartments.length);
      console.log('📱 [DEBUG] Total de prédios disponíveis:', buildings.length);
      
      // Para cada apartamento selecionado, enviar WhatsApp
      for (const apartmentId of apartmentIds) {
        console.log('📱 [DEBUG] Processando apartmentId:', apartmentId);
        
        const apartment = apartments.find((a) => a.id === apartmentId);
        console.log('📱 [DEBUG] Apartamento encontrado:', apartment);
        
        const building = buildings.find((b) => b.id === apartment?.building_id);
        console.log('📱 [DEBUG] Prédio encontrado:', building);

        if (apartment && building) {
          const residentData: ResidentData = {
            name: userData.full_name,
            phone: userData.phone,
            building: building.name,
            apartment: apartment.number,
          };

          console.log('📱 [DEBUG] residentData criado:', residentData);
          console.log('📱 [DEBUG] Chamando notificationService.sendResidentWhatsApp...');
          
          const result = await notificationService.sendResidentWhatsApp(residentData, whatsappBaseUrl);
          console.log('📱 [DEBUG] Resultado do sendResidentWhatsApp:', result);
          
          if (!result.success) {
            console.log('📱 [DEBUG] Erro no envio:', result.error);
            Alert.alert('Aviso', `Erro ao enviar WhatsApp: ${result.error}`);
          } else {
            console.log('📱 [DEBUG] WhatsApp enviado com sucesso!');
          }
        } else {
          console.log('📱 [DEBUG] Apartamento ou prédio não encontrado para apartmentId:', apartmentId);
        }
      }
    } catch (error) {
      console.error('📱 [DEBUG] Erro ao enviar WhatsApp:', error);
    }
  };

  const handleAddVehicle = async () => {
    // Normalizar placa (remover espaços e deixar maiúsculas)
    const normalizedPlate = newVehicle.license_plate.trim().toUpperCase();
    
    // Validar apenas campo obrigatório (placa)
    if (!normalizedPlate) {
      Alert.alert('Erro', 'Por favor, preencha a placa do veículo.');
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe veículo com a mesma placa
      const { data: existing, error: checkError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('license_plate', normalizedPlate)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar placa existente:', checkError);
        Alert.alert('Erro', 'Erro ao verificar se o veículo já existe.');
        setLoading(false);
        return;
      }

      if (existing) {
        Alert.alert('Erro', 'Já existe um veículo cadastrado com esta placa.');
        setLoading(false);
        return;
      }

      // Inserir o novo veículo com apartment_id NULL (cadastrado pelo admin)
      const { error } = await supabase.from('vehicles').insert({
        apartment_id: null, // NULL para indicar cadastro pelo admin
        license_plate: normalizedPlate,
        brand: newVehicle.brand?.trim() || null,
        model: newVehicle.model?.trim() || null,
        color: newVehicle.color?.trim() || null,
        type: newVehicle.type || 'car',
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Veículo cadastrado com sucesso!');
      setShowVehicleForm(false);
      setNewVehicle({
        license_plate: '',
        brand: '',
        model: '',
        color: '',
        type: 'car',
      });
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
      <Modal visible={showAddForm} animationType="slide" presentationStyle="fullScreen">
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
                      {getRoleIcon(role)} {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Indefinido'}
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
              <Text style={styles.label}>Telefone {newUser.type === 'morador' ? 'WhatsApp ' : ''}*</Text>
              <TextInput
                style={styles.input}
                placeholder="(11) 99999-9999"
                value={newUser.phone}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
            </View>

            {newUser.type === 'porteiro' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CPF *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="000.000.000-00"
                    value={newUser.cpf}
                    onChangeText={(text) => {
                      const formatted = formatCPF(text);
                      setNewUser((prev) => ({ ...prev, cpf: formatted }));
                    }}
                    keyboardType="numeric"
                    maxLength={14}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mail *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="email@exemplo.com"
                    value={newUser.email}
                    onChangeText={(text) => setNewUser((prev) => ({ ...prev, email: text }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Data de Nascimento *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="DD/MM/AAAA"
                    value={newUser.birthDate}
                    onChangeText={(text) => {
                      const formatted = formatDate(text);
                      setNewUser((prev) => ({ ...prev, birthDate: formatted }));
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Endereço *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Rua, número, bairro, cidade"
                    value={newUser.address}
                    onChangeText={(text) => setNewUser((prev) => ({ ...prev, address: text }))}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Dias da Semana *</Text>
                  <Text style={styles.sublabel}>Selecione os dias de trabalho</Text>
                  <View style={styles.daysContainer}>
                    {[
                      { key: 'monday', label: 'Segunda' },
                      { key: 'tuesday', label: 'Terça' },
                      { key: 'wednesday', label: 'Quarta' },
                      { key: 'thursday', label: 'Quinta' },
                      { key: 'friday', label: 'Sexta' },
                      { key: 'saturday', label: 'Sábado' },
                      { key: 'sunday', label: 'Domingo' },
                    ].map((day) => (
                      <TouchableOpacity
                        key={day.key}
                        style={[
                          styles.dayOption,
                          newUser.workDays[day.key as keyof typeof newUser.workDays] &&
                            styles.dayOptionSelected,
                        ]}
                        onPress={() => {
                          setNewUser((prev) => ({
                            ...prev,
                            workDays: {
                              ...prev.workDays,
                              [day.key]: !prev.workDays[day.key as keyof typeof prev.workDays],
                            },
                          }));
                        }}>
                        <Text
                          style={[
                            styles.dayOptionText,
                            newUser.workDays[day.key as keyof typeof newUser.workDays] &&
                              styles.dayOptionTextSelected,
                          ]}>
                          {newUser.workDays[day.key as keyof typeof newUser.workDays] ? '✅' : '⭕'}{' '}
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Horário de Trabalho *</Text>
                  <View style={styles.timeContainer}>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>Início</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="08:00"
                        value={newUser.workStartTime}
                        onChangeText={(text) => {
                          const formatted = text.replace(/[^0-9:]/g, '').substring(0, 5);
                          if (formatted.length === 2 && !formatted.includes(':')) {
                            setNewUser((prev) => ({ ...prev, workStartTime: formatted + ':' }));
                          } else {
                            setNewUser((prev) => ({ ...prev, workStartTime: formatted }));
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                    <Text style={styles.timeSeparator}>às</Text>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>Fim</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="18:00"
                        value={newUser.workEndTime}
                        onChangeText={(text) => {
                          const formatted = text.replace(/[^0-9:]/g, '').substring(0, 5);
                          if (formatted.length === 2 && !formatted.includes(':')) {
                            setNewUser((prev) => ({ ...prev, workEndTime: formatted + ':' }));
                          } else {
                            setNewUser((prev) => ({ ...prev, workEndTime: formatted }));
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Foto (Opcional)</Text>
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={handleSelectPhoto}>
                    {newUser.photoUri ? (
                      <View style={styles.photoPreview}>
                        <Image source={{ uri: newUser.photoUri }} style={styles.photoImage} />
                        <Text style={styles.photoButtonText}>Alterar Foto</Text>
                      </View>
                    ) : (
                      <Text style={styles.photoButtonText}>📷 Selecionar Foto</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prédio *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newUser.selectedBuildingId}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
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

            {newUser.type === 'morador' && sendWhatsApp && (
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
      <Modal visible={showMultipleForm} animationType="slide" presentationStyle="fullScreen">
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
                    itemStyle={styles.pickerItem}
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
                      itemStyle={styles.pickerItem}
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
      <Modal visible={showVehicleForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
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
            <Text style={styles.label}>Marca do Veículo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Honda, Toyota, Volkswagen"
              value={newVehicle.brand}
              onChangeText={(text) => setNewVehicle((prev) => ({ ...prev, brand: text }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Modelo do Veículo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Civic, Corolla, Gol"
              value={newVehicle.model}
              onChangeText={(text) => setNewVehicle((prev) => ({ ...prev, model: text }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cor do Veículo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Branco, Preto, Prata"
              value={newVehicle.color}
              onChangeText={(text) => setNewVehicle((prev) => ({ ...prev, color: text }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo do Veículo</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newVehicle.type}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                onValueChange={(itemValue) =>
                  setNewVehicle((prev) => ({ ...prev, type: itemValue }))
                }>
                <Picker.Item label="Carro" value="car" />
                <Picker.Item label="Moto" value="motorcycle" />
                <Picker.Item label="Caminhão" value="truck" />
                <Picker.Item label="Van" value="van" />
                <Picker.Item label="Ônibus" value="bus" />
                <Picker.Item label="Outro" value="other" />
              </Picker>
            </View>
          </View>



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
        </SafeAreaView>
      </Modal>

      {filteredUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>👥</Text>
        <Text style={styles.emptyStateTitle}>Não há usuários cadastrados ainda</Text>
        <Text style={styles.emptyStateSubtitle}>Use o botão "Novo Usuário" para adicionar o primeiro usuário</Text>
        </View>
      ) : (
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
                  {user.cpf && <Text style={styles.userCode}>CPF: {user.cpf}</Text>}
                  {user.phone && <Text style={styles.userCode}>Tel: {user.phone}</Text>}
                  {user.email && <Text style={styles.userCode}>Email: {user.email}</Text>}
                  <Text
                    style={[styles.userRole, { color: getRoleColor(user.user_type || user.role) }]}>
                    {(user.user_type || user.role) ? 
                      (user.user_type || user.role).charAt(0).toUpperCase() +
                      (user.user_type || user.role).slice(1) : 'Indefinido'}
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
      )}
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
    minHeight: 60,
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
    width: '100%',
    backgroundColor: 'transparent',
    color: '#000',
  },
  pickerItem: {
    color: '#000',
    fontSize: 16,
    height: 50,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 50,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  photoButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dayOption: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  dayOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayOptionText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  dayOptionTextSelected: {
    color: '#fff',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  timeInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
    maxWidth: 80,
  },
  timeSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 15,
    fontWeight: '500',
  },
});
