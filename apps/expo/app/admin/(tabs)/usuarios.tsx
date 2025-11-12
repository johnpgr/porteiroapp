import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '~/components/Modal';
import { adminAuth, supabase } from '~/utils/supabase';
import type { Tables } from '@porteiroapp/common/supabase';
import * as Crypto from 'expo-crypto';
import {whatsAppService} from '~/services/whatsappService';
import { supabaseAdmin } from '~/utils/supabase-admin';
import { isApiAvailable, sendBulkWhatsAppMessages } from '~/utils/whatsapp';

// Interface para dados do morador
interface ResidentData {
  name: string;
  phone: string;
  email: string;
  building: string;
  apartment: string;
  profile_id: string;
  temporary_password?: string; // Senha temporária para moradores
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

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

// Função para verificar se a API local está disponível
const isLocalApiAvailable = (): boolean => {
  return true; // A API local está sempre disponível em localhost:3001
};

// Função para mostrar alerta de configuração (não mais necessária)
const showConfigurationAlert = (): void => {
  Alert.alert('Configuração', 'API de notificação está sendo usada.');
};

// Função para gerar senha temporária aleatória de 6 dígitos numéricos
const generateTemporaryPassword = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Função para criar hash da senha usando expo-crypto
const hashPassword = async (password: string): Promise<string> => {
  // Usar SHA-256 para criar hash da senha
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return hash;
};

// Função para armazenar senha temporária no banco de dados
const storeTemporaryPassword = async (
  profileId: string,
  plainPassword: string,
  hashedPassword: string,
  phoneNumber: string
): Promise<void> => {
  try {
    const { error } = await supabase.from('temporary_passwords').insert({
      profile_id: profileId,
      password_hash: hashedPassword,
      plain_password: plainPassword,
      phone_number: phoneNumber,
      used: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
    });

    if (error) {
      console.error('Erro ao armazenar senha temporária:', error);
      throw error;
    }

    console.log('✅ Senha temporária armazenada com sucesso para o perfil:', profileId);
  } catch (error) {
    console.error('❌ Erro ao armazenar senha temporária:', error);
    throw error;
  }
};

// Type aliases from database schema
type ProfileRow = Tables<'profiles'>;
type BuildingRow = Tables<'buildings'>;
type ApartmentRow = Tables<'apartments'>;
// Extended types for queries with relations (using Pick to select only queried fields)
type ProfileWithApartments = Pick<
  ProfileRow,
  'id' | 'full_name' | 'phone' | 'email' | 'cpf' | 'created_at' | 'building_id'
> & {
  role: 'admin' | 'porteiro' | 'morador';
  avatar_url?: string | null;
  user_type?: string | null;
  birth_date?: string | null;
  address?: string | null;
  last_seen?: string | null;
  apartments?: {
    apartment?: {
      id: string;
      number: string;
      building_id: string;
    };
  }[];
};

export default function AdminUsersScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [users, setUsers] = useState<ProfileWithApartments[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filteredApartments, setFilteredApartments] = useState<ApartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    name: '',
    type: 'morador' as 'morador' | 'porteiro',
    phone: '',
    // Campos apenas para porteiros
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
    { name: '', phone: '', email: '', selectedBuildingId: '', selectedApartmentId: '' },
  ]);

  const openAddUserModal = () => {
    router.push('/admin/(modals)/users-create');
  };

  const openMultipleModal = () => {
    router.push('/admin/(modals)/multiple-dispatches');
  };

  const openUserListScreen = () => {
    router.push('/admin/(modals)/users');
  };

  const openVehicleListScreen = () => {
    router.push('/admin/(modals)/vehicles');
  };

  const openVehicleFormScreen = () => {
    router.push('/admin/(modals)/vehicle-form');
  };

  // Função para carregar usuários criados pelo admin logado
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
        signal: controller.signal,
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
              upsert: true,
            });

          if (error) {
            uploadError = error;
            console.error(`❌ [DEBUG] Erro na tentativa ${uploadAttempts}:`, error);

            if (uploadAttempts < maxAttempts) {
              console.log('🔄 [DEBUG] Aguardando antes da próxima tentativa...');
              await new Promise((resolve) => setTimeout(resolve, 2000)); // Aguardar 2 segundos
              continue;
            }
            throw error;
          }

          // Upload bem-sucedido
          console.log('✅ [DEBUG] Upload realizado com sucesso:', data);

          // Obter URL pública da imagem
          const {
            data: { publicUrl },
          } = supabase.storage.from('profiles-images').getPublicUrl(fileName);

          console.log('✅ [DEBUG] URL pública gerada:', publicUrl);
          return publicUrl;
        } catch (attemptError) {
          uploadError = attemptError;
          console.error(`❌ [DEBUG] Erro na tentativa ${uploadAttempts}:`, attemptError);

          if (uploadAttempts < maxAttempts) {
            console.log('🔄 [DEBUG] Aguardando antes da próxima tentativa...');
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Aguardar 2 segundos
          }
        }
      }

      throw uploadError || new Error('Falha no upload após múltiplas tentativas');
    } catch (error) {
      console.error('❌ [DEBUG] Erro final no upload da imagem:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('❌ [DEBUG] Upload cancelado por timeout');
        } else if (error.message.includes('Network request failed')) {
          console.error('❌ [DEBUG] Falha de rede no upload');
        }
      }

      return null;
    }
  };

  // Upload da imagem - função pode ser usada no futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSelectPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];

        // Validar tamanho do arquivo (máximo 5MB)
        if (selectedImage.fileSize && selectedImage.fileSize > 5 * 1024 * 1024) {
          Alert.alert(
            'Erro',
            'A imagem deve ter no máximo 5MB. Por favor, selecione uma imagem menor.'
          );
          return;
        }

        // Atualizar URI local temporariamente para preview
        setNewUser((prev) => ({ ...prev, photoUri: selectedImage.uri }));

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
  const [bulkResidents, setBulkResidents] = useState<ResidentData[]>([]);
  const [sendWhatsApp] = useState(true);
  const [whatsappBaseUrl] = useState('https://jamesavisa.jamesconcierge.com');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
        return;
      }

      // Buscar apenas os prédios gerenciados pelo administrador atual
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map((b) => b.id) || [];

      if (buildingIds.length === 0) {
        console.log('Nenhum prédio encontrado para este administrador');
        setUsers([]);
        return;
      }

      // Selects para relacionamento: um com LEFT (para incluir usuários sem apartamento)
      // e outro com INNER (para garantir moradores de apartamentos dos prédios do admin)
      const nestedSelectLeft = `
          *,
          apartments:apartment_residents(
            apartment:apartments(
              id,
              number,
              building_id
            )
          )
        `;

      const nestedSelectInner = `
          *,
          apartments:apartment_residents(
            apartment:apartments!inner(
              id,
              number,
              building_id
            )
          )
        `;

      // Duas consultas para evitar erro de sintaxe no PostgREST e combinar OR entre tabela base e relação aninhada
      const [baseRes, residentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(nestedSelectLeft)
          .in('building_id', buildingIds)
          .order('full_name'),
        supabase
          .from('profiles')
          .select(nestedSelectInner)
          .filter('apartment_residents.apartments.building_id', 'in', `(${buildingIds.join(',')})`)
          .order('full_name'),
      ]);

      if (baseRes.error) throw baseRes.error;
      if (residentsRes.error) throw residentsRes.error;

      // Mesclar e remover duplicados por id
      const merged = [...(baseRes.data || []), ...(residentsRes.data || [])];
      const uniqByIdMap = new Map<string, any>();
      for (const u of merged) uniqByIdMap.set(u.id, u);
      const combinedData = Array.from(uniqByIdMap.values());

      const usersWithApartments: ProfileWithApartments[] = (combinedData || [])
        .map((user: any) => ({
          ...user,
          name: user.name || user.full_name,
          role: (user.user_type || user.role || 'morador') as ProfileWithApartments['role'],
          apartments:
            user.apartments
              ?.map((ar: any) => ar.apartment)
              .filter((apt: any) => buildingIds.includes(apt.building_id)) || [],
        }))
        .filter((user: ProfileWithApartments) => {
          // Filtrar usuários que têm pelo menos um apartamento nos prédios gerenciados
          // ou que são porteiros/admins associados aos prédios
          return (
            (user.apartments && user.apartments.length > 0) ||
            (user.building_id && buildingIds.includes(user.building_id)) ||
            user.role === 'admin'
          );
        });

      setUsers(usersWithApartments);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Removed router from dependencies as it doesn't change

  const fetchBuildings = async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
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
      setApartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar apartamentos:', error);
    }
  };

  useEffect(() => {
    fetchBuildings();
    fetchApartments();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  useEffect(() => {
    if (newUser.selectedBuildingId) {
      const filtered = apartments.filter((apt) => apt.building_id === newUser.selectedBuildingId);
      setFilteredApartments(filtered);
      setNewUser((prev) => ({ ...prev, selectedApartmentIds: [] }));
    } else {
      setFilteredApartments([]);
    }
  }, [newUser.selectedBuildingId, apartments]);

  // Função para selecionar imagem - pode ser usada no futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    // Validação de e-mail obrigatório para todos os tipos
    if (!newUser.email.trim()) {
      Alert.alert('Erro', 'E-mail é obrigatório');
      return false;
    }
    if (!validateEmail(newUser.email)) {
      Alert.alert('Erro', 'E-mail inválido');
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
      const selectedDays = Object.values(newUser.workDays).some((day) => day);
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
      // Validações para morador - nome, telefone, prédio e apartamento obrigatórios
      if (!newUser.phone.trim()) {
        Alert.alert('Erro', 'Telefone é obrigatório');
        return false;
      }
      if (!validateBrazilianPhone(newUser.phone)) {
        Alert.alert('Erro', 'Telefone deve estar no formato brasileiro válido');
        return false;
      }
      if (!newUser.selectedBuildingId) {
        Alert.alert('Erro', 'Prédio é obrigatório para moradores');
        return false;
      }
      if (newUser.selectedApartmentIds.length === 0) {
        Alert.alert('Erro', 'Pelo menos um apartamento deve ser selecionado para moradores');
        return false;
      }
    }

    return true;
  };

  const validateMultipleResidents = () => {
    const phoneNumbers = new Set();
    const apartmentIds = new Set();

    for (let i = 0; i < multipleResidents.length; i++) {
      const resident = multipleResidents[i];

      // Validação de nome
      if (!resident.name.trim()) {
        Alert.alert('Erro', `Nome é obrigatório para o morador ${i + 1}`);
        return false;
      }

      if (resident.name.trim().length < 2) {
        Alert.alert('Erro', `Nome deve ter pelo menos 2 caracteres para o morador ${i + 1}`);
        return false;
      }

      // Validação de telefone
      if (!resident.phone.trim()) {
        Alert.alert('Erro', `Telefone é obrigatório para o morador ${i + 1}`);
        return false;
      }

      if (!validateBrazilianPhone(resident.phone)) {
        Alert.alert(
          'Erro',
          `Telefone inválido para o morador ${i + 1}. Use o formato (11) 99999-9999`
        );
        return false;
      }

      // Verificar telefones duplicados
      const formattedPhone = formatBrazilianPhone(resident.phone);
      if (phoneNumbers.has(formattedPhone)) {
        Alert.alert(
          'Erro',
          `Telefone duplicado encontrado no morador ${i + 1}. Cada morador deve ter um telefone único.`
        );
        return false;
      }
      phoneNumbers.add(formattedPhone);

      // Validação de email
      if (!resident.email.trim()) {
        Alert.alert('Erro', `Email é obrigatório para o morador ${i + 1}`);
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resident.email.trim())) {
        Alert.alert(
          'Erro',
          `Email inválido para o morador ${i + 1}. Use o formato email@exemplo.com`
        );
        return false;
      }

      // Validação de prédio
      if (!resident.selectedBuildingId) {
        Alert.alert('Erro', `Prédio é obrigatório para o morador ${i + 1}`);
        return false;
      }

      // Validação de apartamento
      if (!resident.selectedApartmentId) {
        Alert.alert('Erro', `Apartamento é obrigatório para o morador ${i + 1}`);
        return false;
      }

      // Verificar apartamentos duplicados
      if (apartmentIds.has(resident.selectedApartmentId)) {
        Alert.alert(
          'Erro',
          `Apartamento duplicado encontrado no morador ${i + 1}. Cada morador deve ter um apartamento único.`
        );
        return false;
      }
      apartmentIds.add(resident.selectedApartmentId);

      // Validar se o apartamento pertence ao prédio selecionado
      const apartment = apartments.find((apt) => apt.id === resident.selectedApartmentId);
      if (apartment && apartment.building_id !== resident.selectedBuildingId) {
        Alert.alert(
          'Erro',
          `Apartamento selecionado não pertence ao prédio escolhido para o morador ${i + 1}`
        );
        return false;
      }
    }

    return true;
  };

  // Funções auxiliares para múltiplos residentes - podem ser usadas no futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addMultipleResident = () => {
    setMultipleResidents([
      ...multipleResidents,
      { name: '', phone: '', email: '', selectedBuildingId: '', selectedApartmentId: '' },
    ]);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeMultipleResident = (index: number) => {
    if (multipleResidents.length > 1) {
      const updated = multipleResidents.filter((_, i) => i !== index);
      setMultipleResidents(updated);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateMultipleResident = (index: number, field: string, value: string) => {
    const updated = [...multipleResidents];
    updated[index] = { ...updated[index], [field]: value };
    setMultipleResidents(updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMultipleResidents = async () => {
    if (!validateMultipleResidents()) {
      return;
    }

    try {
      setLoading(true);
      setIsProcessing(true);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const processedPhones = new Set();
      const successfulUsers: any[] = [];

      // Primeira fase: Validação e preparação dos dados
      setProcessingStatus('Validando dados e verificando duplicatas...');
      const validatedResidents = [];

      for (const resident of multipleResidents) {
        try {
          const formattedPhone = formatBrazilianPhone(resident.phone);

          // Verificar duplicatas no lote
          if (processedPhones.has(formattedPhone)) {
            throw new Error('Telefone duplicado neste lote');
          }
          processedPhones.add(formattedPhone);

          // Verificar se já existe no banco
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('phone', formattedPhone)
            .single();

          if (existingProfile) {
            throw new Error(`Telefone já cadastrado para: ${existingProfile.full_name}`);
          }

          validatedResidents.push({
            ...resident,
            formattedPhone,
            userData: {
              full_name: resident.name.trim(),
              phone: formattedPhone,
              email: resident.email.trim(),
              role: 'morador',
              user_type: 'morador',
            },
          });
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          errors.push(`${resident.name}: ${errorMessage}`);
        }
      }

      if (validatedResidents.length === 0) {
        throw new Error('Nenhum morador válido para processar');
      }

      // Segunda fase: Criação individual com sequência correta (auth.users -> profiles -> temporary_passwords)
      setProcessingStatus(`Processando ${validatedResidents.length} usuários individualmente...`);
      const usersWithPasswords = [];

      for (let i = 0; i < validatedResidents.length; i++) {
        const resident = validatedResidents[i];

        try {
          console.log(
            `🔐 [DEBUG] === INICIANDO PROCESSAMENTO ${i + 1}/${validatedResidents.length}: ${resident.name} ===`
          );

          // Passo 1: Gerar senha temporária
          console.log('🔐 [DEBUG] Passo 1: Gerando senha temporária para:', resident.name);
          const temporaryPassword = generateTemporaryPassword();
          const hashedPassword = await hashPassword(temporaryPassword);
          console.log(
            '🔐 [DEBUG] Senha gerada:',
            temporaryPassword,
            'Hash:',
            hashedPassword.substring(0, 10) + '...'
          );

          // Passo 2: Criar usuário no Supabase Auth PRIMEIRO
          console.log('🔐 [DEBUG] Passo 2: Criando usuário no auth.users para:', resident.name);
          console.log('🔐 [DEBUG] Email:', resident.email.trim(), 'Senha:', temporaryPassword);

          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: resident.email.trim(),
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              full_name: resident.name.trim(),
              user_type: 'morador',
            },
          });

          if (authError) {
            console.error('❌ [DEBUG] ERRO no auth.users para', resident.name, ':', authError);
            console.error('❌ [DEBUG] Detalhes do erro:', JSON.stringify(authError, null, 2));
            throw new Error(`Erro ao criar login: ${authError.message}`);
          }

          if (!authData.user) {
            console.error('❌ [DEBUG] authData.user é null para:', resident.name);
            throw new Error('Falha ao criar usuário de autenticação - dados nulos');
          }

          console.log('✅ [DEBUG] Passo 2 CONCLUÍDO - Auth User ID:', authData.user.id);
          console.log('✅ [DEBUG] Auth User Email:', authData.user.email);

          // Passo 3: Criar perfil com user_id do auth
          console.log('🔐 [DEBUG] Passo 3: Criando perfil para:', resident.name);
          const profileData = {
            ...resident.userData,
            user_id: authData.user.id,
            temporary_password_used: false,
          };

          const { data: insertedUser, error: profileError } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single();

          if (profileError) {
            console.error('❌ [DEBUG] ERRO ao criar perfil para', resident.name, ':', profileError);
            // Se falhar, deletar o usuário do auth para evitar inconsistência
            try {
              await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
              console.log('🔄 [DEBUG] Usuário do auth deletado devido ao erro no perfil');
            } catch (deleteError) {
              console.error('❌ [DEBUG] Erro ao deletar usuário do auth:', deleteError);
            }
            throw new Error(`Erro ao criar perfil: ${profileError.message}`);
          }

          console.log('✅ [DEBUG] Passo 3 CONCLUÍDO - Profile ID:', insertedUser.id);

          // Passo 4: Armazenar senha temporária
          console.log('🔐 [DEBUG] Passo 4: Armazenando senha temporária para:', resident.name);
          await storeTemporaryPassword(
            insertedUser.id,
            temporaryPassword,
            hashedPassword,
            resident.formattedPhone
          );
          console.log('✅ [DEBUG] Passo 4 CONCLUÍDO - Senha temporária armazenada');

          // Adicionar dados extras para uso posterior
          const userWithExtras = {
            ...insertedUser,
            temporary_password: temporaryPassword,
          };
          usersWithPasswords.push({ user: userWithExtras, resident });

          console.log(
            `✅ [DEBUG] === USUÁRIO ${i + 1} PROCESSADO COM SUCESSO: ${resident.name} ===`
          );
          console.log(
            '✅ [DEBUG] Auth ID:',
            authData.user.id,
            'Profile ID:',
            insertedUser.id,
            'Senha:',
            temporaryPassword
          );
        } catch (userError) {
          console.error(`❌ [DEBUG] === ERRO NO USUÁRIO ${i + 1}: ${resident.name} ===`);
          console.error('❌ [DEBUG] Erro completo:', userError);
          errorCount++;
          errors.push(
            `${resident.name}: ${userError instanceof Error ? userError.message : 'Erro na configuração de autenticação'}`
          );
        }
      }

      console.log(`🔐 [DEBUG] === RESUMO DA FASE 2 ===`);
      console.log(`🔐 [DEBUG] Usuários processados com sucesso: ${usersWithPasswords.length}`);
      console.log(`🔐 [DEBUG] Usuários com erro: ${errorCount}`);

      // Quarta fase: Verificação de apartamentos existentes
      setProcessingStatus('Verificando apartamentos...');
      // Verificar se apartamentos já possuem moradores (apenas logging)
      await Promise.allSettled(
        usersWithPasswords.map(async ({ resident }) => {
          const { data: existingResident } = await supabase
            .from('apartment_residents')
            .select('profile_id, profiles!inner(full_name)')
            .eq('apartment_id', resident.selectedApartmentId)
            .single();

          if (existingResident) {
            console.warn('⚠️ [DEBUG] Apartamento já possui morador:', existingResident);
          }

          return { apartmentId: resident.selectedApartmentId, existing: existingResident };
        })
      );

      // Quinta fase: Inserção em lote das associações de apartamentos
      setProcessingStatus('Associando apartamentos em lote...');
      const apartmentAssociations = usersWithPasswords.map(({ user, resident }) => ({
        profile_id: user.id,
        apartment_id: resident.selectedApartmentId,
        relationship: 'resident',
        is_primary: false,
      }));

      const { data: insertedAssociations, error: associationsError } = await supabase
        .from('apartment_residents')
        .insert(apartmentAssociations)
        .select();

      if (associationsError) {
        console.error('❌ [DEBUG] Erro na inserção em lote de apartamentos:', associationsError);
        // Se falhar em lote, tentar individualmente
        for (let i = 0; i < usersWithPasswords.length; i++) {
          const { user, resident } = usersWithPasswords[i];
          try {
            const { error: individualError } = await supabase.from('apartment_residents').insert({
              profile_id: user.id,
              apartment_id: resident.selectedApartmentId,
              relationship: 'resident',
              is_primary: false,
            });

            if (individualError) {
              throw individualError;
            }

            successfulUsers.push({ user, apartmentId: resident.selectedApartmentId });
            successCount++;
            console.log('✅ [DEBUG] Apartamento associado individualmente para:', resident.name);
          } catch (error) {
            console.error('Erro ao associar apartamento individualmente:', error);
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            errors.push(`${resident.name}: ${errorMessage}`);
          }
        }
      } else {
        // Sucesso na inserção em lote
        console.log('✅ [DEBUG] Apartamentos associados em lote:', insertedAssociations?.length);
        usersWithPasswords.forEach(({ user, resident }) => {
          successfulUsers.push({ user, apartmentId: resident.selectedApartmentId });
          successCount++;
        });
      }

      // Quarta fase: Envio de WhatsApp em lote (se habilitado)
      if (sendWhatsApp && successfulUsers.length > 0) {
        setProcessingStatus('Preparando notificações WhatsApp em lote...');

        try {
          // Importar funções de WhatsApp

          // Verificar se a API está disponível
          if (!isApiAvailable()) {
            console.warn('⚠️ API WhatsApp não está disponível');
            errors.push('API WhatsApp não está disponível');
            return;
          }

          // Preparar dados para envio em lote
          const whatsappData = [];

          for (const { user, apartmentId } of successfulUsers) {
            try {
              // Buscar dados do apartamento e prédio
              const { data: apartment } = await supabase
                .from('apartments')
                .select('number, building_id, buildings(name)')
                .eq('id', apartmentId)
                .single();

              // Buscar senha temporária do usuário
              const { data: passwordData } = await supabase
                .from('temporary_passwords')
                .select('plain_password')
                .eq('profile_id', user.id)
                .eq('used', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (apartment && apartment.buildings) {
                whatsappData.push({
                  name: user.full_name,
                  phone: user.phone,
                  email: user.email, // Adicionar email para evitar erro da API
                  building: apartment.buildings.name,
                  apartment: apartment.number,
                  profile_id: user.id,
                  temporaryPassword: passwordData?.plain_password || 'Senha não encontrada',
                });
              }
            } catch (dataError) {
              console.error('❌ Erro ao buscar dados para WhatsApp:', dataError);
              errors.push(`${user.full_name}: Erro ao preparar dados para WhatsApp`);
            }
          }

          if (whatsappData.length > 0) {
            setProcessingStatus(`Enviando ${whatsappData.length} notificações WhatsApp...`);
            console.log(
              '📱 [DEBUG] Enviando WhatsApp em lote para',
              whatsappData.length,
              'usuários'
            );

            const bulkResult = await sendBulkWhatsAppMessages(whatsappData);

            console.log('📱 [DEBUG] Resultado do envio em lote:', bulkResult);

            // Adicionar erros do envio em lote aos erros gerais
            if (bulkResult.errors.length > 0) {
              errors.push(...bulkResult.errors.map((error) => `WhatsApp: ${error}`));
            }

            setProcessingStatus(
              `WhatsApp: ${bulkResult.success} enviados, ${bulkResult.failed} falharam`
            );
          }
        } catch (whatsappError) {
          console.error('❌ [DEBUG] Erro no envio em lote de WhatsApp:', whatsappError);
          errors.push('Erro geral no envio de notificações WhatsApp');
        }
      }

      // Mostrar resultado detalhado
      setProcessingStatus('Processamento concluído!');

      // Categorizar erros por tipo
      const validationErrors = errors.filter((error) => error.includes('Validação'));
      const profileErrors = errors.filter(
        (error) => error.includes('perfil') || error.includes('Perfil')
      );
      const apartmentErrors = errors.filter(
        (error) => error.includes('apartamento') || error.includes('Apartamento')
      );
      const whatsappErrors = errors.filter((error) => error.includes('WhatsApp'));
      const otherErrors = errors.filter(
        (error) =>
          !validationErrors.includes(error) &&
          !profileErrors.includes(error) &&
          !apartmentErrors.includes(error) &&
          !whatsappErrors.includes(error)
      );

      let message = `Processamento de ${multipleResidents.length} usuários concluído!\n\n`;
      message += `✅ Sucessos: ${successCount}\n`;
      message += `❌ Erros: ${errorCount}`;

      if (errors.length > 0) {
        message += `\n\n📋 Detalhes dos erros:`;

        if (validationErrors.length > 0) {
          message += `\n\n🔍 Validação (${validationErrors.length}):`;
          message += `\n${validationErrors.slice(0, 3).join('\n')}`;
          if (validationErrors.length > 3) {
            message += `\n... e mais ${validationErrors.length - 3}`;
          }
        }

        if (profileErrors.length > 0) {
          message += `\n\n👤 Criação de perfis (${profileErrors.length}):`;
          message += `\n${profileErrors.slice(0, 2).join('\n')}`;
          if (profileErrors.length > 2) {
            message += `\n... e mais ${profileErrors.length - 2}`;
          }
        }

        if (apartmentErrors.length > 0) {
          message += `\n\n🏠 Associação de apartamentos (${apartmentErrors.length}):`;
          message += `\n${apartmentErrors.slice(0, 2).join('\n')}`;
          if (apartmentErrors.length > 2) {
            message += `\n... e mais ${apartmentErrors.length - 2}`;
          }
        }

        if (whatsappErrors.length > 0) {
          message += `\n\n📱 Notificações WhatsApp (${whatsappErrors.length}):`;
          message += `\n${whatsappErrors.slice(0, 2).join('\n')}`;
          if (whatsappErrors.length > 2) {
            message += `\n... e mais ${whatsappErrors.length - 2}`;
          }
        }

        if (otherErrors.length > 0) {
          message += `\n\n⚠️ Outros erros (${otherErrors.length}):`;
          message += `\n${otherErrors.slice(0, 2).join('\n')}`;
          if (otherErrors.length > 2) {
            message += `\n... e mais ${otherErrors.length - 2}`;
          }
        }
      }

      // Determinar título e estilo do alerta
      let alertTitle = 'Processamento Concluído';
      if (successCount === 0) {
        alertTitle = 'Erro no Processamento';
      } else if (errorCount > 0) {
        alertTitle = 'Processamento Parcial';
      }

      Alert.alert(alertTitle, message, [{ text: 'OK' }]);

      if (successCount > 0) {
        // Limpar formulário
        setMultipleResidents([
          { name: '', phone: '', email: '', selectedBuildingId: '', selectedApartmentId: '' },
        ]);
        fetchUsers();
      }
    } catch (error) {
      console.error('Erro geral:', error);
      Alert.alert(
        'Erro',
        `Erro ao processar cadastros: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    } finally {
      setLoading(false);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Função para adicionar usuário - pode ser usada no futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      // Gerar uma única senha temporária para usar tanto no auth quanto na tabela temporary_passwords
      const temporaryPassword = generateTemporaryPassword();
      console.log('🔐 [DEBUG] Senha temporária única gerada:', temporaryPassword);

      // Criar usuário no Supabase Auth usando admin client (não causa login automático)
      console.log('🔐 [DEBUG] Criando login no auth.users com admin client...');
      console.log('🔐 [DEBUG] Email:', newUser.email);
      console.log('🔐 [DEBUG] Nome:', newUser.name);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newUser.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: newUser.name,
          user_type: newUser.type,
        },
      });

      if (authError) {
        console.error('❌ [DEBUG] Erro ao criar login:', authError);
        console.error('❌ [DEBUG] Detalhes do erro:', JSON.stringify(authError, null, 2));
        throw new Error(`Erro ao criar login: ${authError.message}`);
      }

      if (!authData.user) {
        console.error('❌ [DEBUG] authData.user é null ou undefined');
        console.error('❌ [DEBUG] authData completo:', JSON.stringify(authData, null, 2));
        throw new Error('Falha ao criar usuário de autenticação');
      }

      authUserId = authData.user.id;
      console.log('✅ [DEBUG] Login criado com sucesso. User ID:', authUserId);
      console.log('✅ [DEBUG] authData.user completo:', JSON.stringify(authData.user, null, 2));
      console.log('✅ [DEBUG] Admin não foi deslogado - usando createUser em vez de signUp');

      // Preparar dados base do usuário
      const userData: any = {
        full_name: newUser.name,
        role: newUser.type,
      };

      // Se for porteiro, usar o ID do auth.users
      if (newUser.type === 'porteiro' && authUserId) {
        userData.user_id = authUserId;
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
              sunday: 'Domingo',
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
        // Para moradores - dados completos incluindo user_id
        userData.phone = newUser.phone;
        userData.cpf = newUser.cpf;
        userData.email = newUser.email;
        userData.user_id = authUserId;
        userData.user_type = 'morador';
        userData.building_id = newUser.selectedBuildingId;
      }

      console.log('🚀 [DEBUG] userData criado:', JSON.stringify(userData, null, 2));
      console.log('🚀 [DEBUG] Inserindo na tabela profiles...');

      const { data: insertedUser, error } = await supabase
        .from('profiles')
        .insert(userData)
        .select()
        .single();

      if (error) {
        console.error('❌ [DEBUG] Erro ao inserir na tabela profiles:', error);
        console.error('❌ [DEBUG] Detalhes do erro:', JSON.stringify(error, null, 2));
        console.error('❌ [DEBUG] userData que causou erro:', JSON.stringify(userData, null, 2));

        // Se houve erro ao inserir o profile e foi criado um usuário auth, fazer rollback
        if (authUserId) {
          console.log('🔄 [DEBUG] Fazendo rollback do usuário auth...');
          // Nota: O Supabase não permite deletar usuários via client, apenas via admin API
          // Em produção, seria necessário usar uma função server-side para isso
        }
        throw error;
      }

      console.log('✅ [DEBUG] Usuário inserido com sucesso na tabela profiles');
      console.log('✅ [DEBUG] insertedUser:', JSON.stringify(insertedUser, null, 2));
      console.log('✅ [DEBUG] Verificando vinculação - user_id no profile:', insertedUser?.user_id);
      console.log('✅ [DEBUG] Verificando vinculação - authUserId original:', authUserId);

      // Se for morador, associar aos apartamentos selecionados e armazenar senha temporária
      if (newUser.type === 'morador') {
        // Usar a mesma senha temporária já gerada para o auth.users
        console.log('🔐 [DEBUG] Armazenando senha temporária para morador...');
        const hashedPassword = await hashPassword(temporaryPassword);

        try {
          // Armazenar senha temporária na tabela temporary_passwords
          await storeTemporaryPassword(
            insertedUser.id,
            temporaryPassword,
            hashedPassword,
            newUser.phone
          );

          // Se há apartamentos selecionados, criar associações
          if (newUser.selectedApartmentIds.length > 0) {
            const apartmentAssociations = newUser.selectedApartmentIds.map((apartmentId) => ({
              profile_id: insertedUser.id,
              apartment_id: apartmentId,
              relationship: 'resident',
              is_primary: false,
            }));

            console.log('🚀 [DEBUG] apartmentAssociations:', apartmentAssociations);

            const { error: associationError } = await supabase
              .from('apartment_residents')
              .insert(apartmentAssociations);

            if (associationError) {
              // Se falhar, deletar senha temporária e perfil
              await supabase.from('temporary_passwords').delete().eq('profile_id', insertedUser.id);
              await supabase.from('profiles').delete().eq('id', insertedUser.id);
              throw associationError;
            }
            console.log('🚀 [DEBUG] associações de apartamento criadas com sucesso');
          }

          console.log('✅ [DEBUG] Senha temporária gerada e armazenada com sucesso');

          // Reatribuir senha temporária para uso posterior
          (insertedUser as any).temporary_password = temporaryPassword;

          console.log('🔑 [DEBUG] Senha temporária atribuída ao insertedUser:', {
            id: insertedUser.id,
            temporary_password: temporaryPassword,
          });
        } catch (error) {
          console.error('❌ [DEBUG] Erro ao criar morador:', error);
          // Deletar o perfil se tudo falhar
          await supabase.from('profiles').delete().eq('id', insertedUser.id);
          throw new Error('Erro ao criar morador com senha temporária. Operação cancelada.');
        }
      }

      // Enviar WhatsApp APENAS para moradores (porteiros nunca recebem WhatsApp)
      if (sendWhatsApp && newUser.type === 'morador') {
        console.log(
          '🚀 [DEBUG] Condições para WhatsApp atendidas, chamando handleSingleUserWhatsApp'
        );
        await handleSingleUserWhatsApp(insertedUser, newUser.selectedApartmentIds);
      } else {
        console.log(
          '🚀 [DEBUG] WhatsApp não será enviado - sendWhatsApp:',
          sendWhatsApp,
          'tipo:',
          newUser.type
        );
      }

      // Mensagem de sucesso específica para cada tipo
      if (newUser.type === 'porteiro') {
        Alert.alert(
          'Porteiro Criado com Sucesso!',
          `O porteiro ${newUser.name} foi cadastrado e pode fazer login com:\n\nE-mail: ${newUser.email}\nSenha: ${temporaryPassword}\n\nO porteiro poderá alterar sua senha após o primeiro login.`
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
      fetchUsers();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);

      // Verificar se é erro de usuário já existente
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'user_already_exists'
      ) {
        Alert.alert(
          'E-mail já cadastrado',
          `O e-mail ${newUser.email} já está cadastrado no sistema. Por favor, use um e-mail diferente.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert('Erro', 'Falha ao criar usuário');
      }
    } finally {
      setLoading(false);
    }
  };

  // Funções para cadastro em massa - podem ser usadas no futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addBulkResident = () => {
    setBulkResidents([
      ...bulkResidents,
      {
        name: '',
        phone: '',
        email: '',
        building: '',
        apartment: '',
        profile_id: '',
      },
    ]);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeBulkResident = (index: number) => {
    setBulkResidents(bulkResidents.filter((_, i) => i !== index));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBulkRegistration = async () => {
    if (!validateBulkResidents()) return;

    if (sendWhatsApp && !isLocalApiAvailable()) {
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

          // Gerar senha temporária
          const temporaryPassword = generateTemporaryPassword();
          const hashedPassword = await hashPassword(temporaryPassword);

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

          // Armazenar senha temporária
          await storeTemporaryPassword(
            insertedUser.id,
            temporaryPassword,
            hashedPassword,
            resident.phone
          );

          // Associar ao apartamento
          const { error: associationError } = await supabase.from('apartment_residents').insert({
            profile_id: insertedUser.id,
            apartment_id: apartment.id,
            relationship: 'resident',
            is_owner: false,
          });

          if (associationError) throw associationError;

          successCount++;

          // Enviar WhatsApp se habilitado
          if (sendWhatsApp) {
            setProcessingStatus(`Enviando WhatsApp para ${resident.name}...`);
            // WhatsApp functionality removed - using only Edge Functions for push notifications
            // const residentDataWithPassword = {
            //   name: resident.name,
            //   phone: resident.phone,
            //   building: building.name,
            //   apartment: apartment.number,
            //   profile_id: insertedUser.id,
            //   temporaryPassword: temporaryPassword,
            // };
            // const whatsappResult = await sendWhatsAppMessage(residentDataWithPassword, whatsappBaseUrl);
            // if (!whatsappResult.success) {
            //   errors.push(`${resident.name}: WhatsApp - ${whatsappResult.error}`);
            // }
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
        fetchUsers();
      }
    } catch {
      Alert.alert('Erro', 'Falha no cadastro em massa');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleSingleUserWhatsApp = async (userData: any, apartmentIds: string[]) => {
    console.log('📱 [DEBUG] handleSingleUserWhatsApp iniciado');
    console.log('📱 [DEBUG] sendWhatsApp:', sendWhatsApp);
    console.log('📱 [DEBUG] isLocalApiAvailable():', isLocalApiAvailable());
    console.log('📱 [DEBUG] userData:', userData);
    console.log('📱 [DEBUG] apartmentIds:', apartmentIds);
    console.log('📱 [DEBUG] whatsappBaseUrl:', whatsappBaseUrl);

    if (!sendWhatsApp || !isLocalApiAvailable()) {
      console.log('📱 [DEBUG] Condições não atendidas - retornando sem enviar');
      console.log('📱 [DEBUG] sendWhatsApp:', sendWhatsApp);
      console.log('📱 [DEBUG] isLocalApiAvailable():', isLocalApiAvailable());
      return;
    }

    try {
      console.log('📱 [DEBUG] Iniciando loop pelos apartamentos');
      console.log('📱 [DEBUG] Total de apartamentos disponíveis:', apartments.length);
      console.log('📱 [DEBUG] Total de prédios disponíveis:', buildings.length);

      // NOVO: Buscar senha temporária no Supabase caso não esteja presente em userData
      let recoveredTemporaryPassword: string | undefined = userData.temporary_password;
      if (!recoveredTemporaryPassword) {
        try {
          console.log('🔎 [DEBUG] Buscando senha temporária no Supabase...');
          const { data: tempPassRow, error: tempPassError } = await supabase
            .from('temporary_passwords')
            .select('plain_password')
            .eq('profile_id', userData.id)
            .eq('used', false)
            .order('expires_at', { ascending: false })
            .limit(1)
            .single();

          if (tempPassError) {
            console.log('⚠️ [DEBUG] Não foi possível recuperar a senha temporária:', tempPassError);
          } else {
            recoveredTemporaryPassword = (tempPassRow as any)?.plain_password as string | undefined;
            console.log(
              '🔑 [DEBUG] Senha temporária recuperada do Supabase:',
              recoveredTemporaryPassword
            );
          }
        } catch (e) {
          console.log('⚠️ [DEBUG] Exceção ao recuperar senha temporária do Supabase:', e);
        }
      }

      // Para cada apartamento selecionado, enviar WhatsApp
      for (const apartmentId of apartmentIds) {
        console.log('📱 [DEBUG] Processando apartmentId:', apartmentId);

        const apartment = apartments.find((a) => a.id === apartmentId);
        console.log('📱 [DEBUG] Apartamento encontrado:', apartment);

        const building = buildings.find((b) => b.id === apartment?.building_id);
        console.log('📱 [DEBUG] Prédio encontrado:', building);

        if (apartment && building) {
          const residentData: ResidentData = {
            name: userData.full_name || userData.name || '',
            phone: userData.phone || '',
            email: userData.email || '',
            building: building.name,
            apartment: apartment.number,
            profile_id: userData.id, // Incluir profile_id obrigatório
            temporary_password: recoveredTemporaryPassword, // Incluir senha temporária recuperada
          };

          console.log('🔑 [DEBUG] Dados do residente para WhatsApp:', {
            name: residentData.name,
            phone: residentData.phone,
            building: residentData.building,
            apartment: residentData.apartment,
            temporary_password: residentData.temporary_password,
          });

          console.log('📱 [DEBUG] residentData criado:', residentData);
          console.log('📱 [DEBUG] Chamando notificationService.sendResidentWhatsApp...');

          const result = await whatsAppService.sendResidentWhatsApp(residentData);
          console.log('📱 [DEBUG] Resultado do sendResidentWhatsApp:', result);

          if (!result.success) {
            console.log('📱 [DEBUG] Erro no envio:', result.error);
            Alert.alert('Aviso', `Erro ao enviar WhatsApp: ${result.error}`);
          } else {
            console.log('📱 [DEBUG] WhatsApp enviado com sucesso!');
          }
        } else {
          console.log(
            '📱 [DEBUG] Apartamento ou prédio não encontrado para apartmentId:',
            apartmentId
          );
        }
      }
    } catch (error) {
      console.error('📱 [DEBUG] Erro ao enviar WhatsApp:', error);
    }
  };

  // Funções auxiliares para UI - podem ser usadas no futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando usuários...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>👥 Gerenciar Usuários</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.addButton} onPress={openAddUserModal}>
          <Text style={styles.addButtonText}>➕ Novo Usuário</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.multipleButton} onPress={openMultipleModal}>
          <Text style={styles.multipleButtonText}>👥 Múltiplos Disparos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listUsersButton} onPress={openUserListScreen}>
          <Text style={styles.listUsersButtonText}>📋 Listar Usuários</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.vehicleButton} onPress={openVehicleFormScreen}>
          <Text style={styles.vehicleButtonText}>🚗 Adicionar Veículo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listVehiclesButton} onPress={openVehicleListScreen}>
          <Text style={styles.listVehiclesButtonText}>🚙 Listar Veículos</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Status de Processamento */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.processingText}>{processingStatus}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 20,
    backgroundColor: '#9C27B0',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
    fontSize: 18,
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
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    minHeight: 50,
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
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 50,
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
  dropdownButton: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
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
    backgroundColor: '#FF9800',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 24,
    color: '#fff',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  multipleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listUsersButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listUsersButtonText: {
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
  listVehiclesButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  listVehiclesButtonText: {
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
  closeButtonContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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

  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  paginationButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#adb5bd',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Estilos para o modal de listagem de usuários
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  buildingFilterContainer: {
    marginBottom: 16,
  },
  buildingFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  userListContainer: {
    flex: 1,
  },
  userListItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userListInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userListIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  userListDetails: {
    flex: 1,
  },
  userListName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userListPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userListEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userListCpf: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userListApartments: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 2,
  },
  userListDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyListState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyListIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  buildingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  buildingOptionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  // Novos estilos otimizados para o modal de veículos
  vehicleHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vehicleHeaderText: {
    flex: 1,
  },
  vehicleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  vehicleScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requiredIndicator: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  inputFilled: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  inputRequired: {
    borderColor: '#ffcdd2',
    backgroundColor: '#fff5f5',
  },
  dropdownFilled: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  submitContainer: {
    marginTop: 20,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLoadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  validationText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  // Estilos modernos para os cards de veículos
  vehicleList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  vehicleCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleMainInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: 1,
  },
  vehicleType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontWeight: '500',
  },
  vehicleStatusBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  vehicleStatusText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  vehicleCardBody: {
    padding: 16,
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  vehicleInfoItem: {
    flex: 1,
    marginRight: 8,
  },
  vehicleInfoLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginBottom: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  vehicleCardFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
    paddingTop: 12,
  },
  vehicleCreatedDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyVehicleState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyVehicleStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyVehicleStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
