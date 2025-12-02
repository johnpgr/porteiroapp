import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Modal } from '~/components/Modal';
import { router } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { supabase, adminAuth } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { whatsAppService } from '~/services/whatsappService';
import * as Crypto from 'expo-crypto';
import { supabaseAdmin } from '~/utils/supabase-admin';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';

// Funções auxiliares para validação (copiadas do arquivo original)
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

// Interface para dados do porteiro
interface PorteiroData {
  name: string;
  phone: string;
  email: string;
  building: string;
  cpf: string;
  work_schedule: string;
  profile_id: string;
  temporary_password?: string; // Senha temporária para porteiros
}

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
    } as any);

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

interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  number: string;
  building_id: string;
}

export default function UsersCreate() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [filteredApartments, setFilteredApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);

  // Estados para WhatsApp
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Bottom sheet refs and state
  const buildingSheetRef = useRef<BottomSheetModalRef>(null);
  const workDaysSheetRef = useRef<BottomSheetModalRef>(null);
  const workTimeSheetRef = useRef<BottomSheetModalRef>(null);

  const [buildingSheetVisible, setBuildingSheetVisible] = useState(false);
  const [workDaysSheetVisible, setWorkDaysSheetVisible] = useState(false);
  const [workTimeSheetVisible, setWorkTimeSheetVisible] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start');

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

  useEffect(() => {
    fetchBuildings();
    fetchApartments();
    // Reset form fields on mount
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
      setApartments((data as unknown as Apartment[]) || []);
    } catch (error) {
      console.error('Erro ao carregar apartamentos:', error);
    }
  };

  // Função para selecionar prédio
  const handleBuildingSelect = (buildingId: string) => {
    setNewUser((prev) => ({ ...prev, selectedBuildingId: buildingId }));
    setShowBuildingModal(false);
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

  // Função para enviar dados via WhatsApp para um único usuário
  const handleSingleUserWhatsApp = async (residentData: ResidentData) => {
    if (!residentData.phone) {
      Alert.alert('Erro', 'Telefone não fornecido para envio de WhatsApp');
      return;
    }

    try {
      console.log('Enviando WhatsApp para:', residentData);

      // Usar o notificationService para enviar WhatsApp
      const result = await whatsAppService.sendResidentWhatsApp({
        name: residentData.name,
        phone: residentData.phone,
        email: residentData.email,
        building: residentData.building,
        apartment: residentData.apartment,
        profile_id: residentData.profile_id,
        temporary_password: residentData.temporary_password || '',
      });

      if (result.success) {
        Alert.alert('Sucesso', `WhatsApp enviado para ${residentData.name}`);
      } else {
        Alert.alert('Erro', result.error || 'Falha ao enviar WhatsApp. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      Alert.alert('Erro', 'Falha ao enviar WhatsApp');
    }
  };

  // Função para enviar WhatsApp para um único porteiro
  const handlePorteiroWhatsApp = async (porteiroData: PorteiroData) => {
    if (!porteiroData.phone) {
      Alert.alert('Erro', 'Telefone não informado');
      return;
    }

    try {
      const result = await whatsAppService.sendPorteiroWhatsApp({
        name: porteiroData.name,
        phone: porteiroData.phone,
        email: porteiroData.email,
        building: porteiroData.building,
        cpf: porteiroData.cpf,
        work_schedule: porteiroData.work_schedule,
        profile_id: porteiroData.profile_id,
        temporary_password: porteiroData.temporary_password,
      });

      if (result.success) {
        Alert.alert('Sucesso', 'Mensagem WhatsApp enviada com sucesso!');
      } else {
        Alert.alert('Erro', result.error || 'Erro ao enviar mensagem WhatsApp');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      Alert.alert('Erro', 'Erro ao enviar mensagem WhatsApp');
    }
  };

  const handleAddUser = async () => {
    if (!validateUser()) {
      return;
    }

    try {
      setLoading(true);

      // Gerar senha temporária para o usuário
      const temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await hashPassword(temporaryPassword);

      const userData = {
        full_name: newUser.name.trim(),
        phone: newUser.phone ? formatBrazilianPhone(newUser.phone) : null,
        email: newUser.email.trim(),
        role: newUser.type,
        user_type: newUser.type,
        cpf: newUser.type === 'porteiro' ? newUser.cpf.replace(/\D/g, '') : null,
        birth_date:
          newUser.type === 'porteiro' && newUser.birthDate
            ? `${newUser.birthDate.slice(6, 10)}-${newUser.birthDate.slice(3, 5)}-${newUser.birthDate.slice(0, 2)}`
            : null,
        address: newUser.type === 'porteiro' ? newUser.address.trim() : null,
        work_schedule:
          newUser.type === 'porteiro'
            ? JSON.stringify({
                days: newUser.workDays,
                startTime: newUser.workStartTime,
                endTime: newUser.workEndTime,
              })
            : null,
        building_id: newUser.selectedBuildingId || null,
        temporary_password_used: false,
      };

      // Verificar se já existe usuário com o mesmo telefone ou email
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .or(`phone.eq.${userData.phone},email.eq.${userData.email}`)
        .single();

      if (existingUser && 'phone' in existingUser) {
        if ((existingUser as any).phone === userData.phone) {
          Alert.alert('Erro', `Telefone já cadastrado para: ${(existingUser as any).full_name}`);
        } else {
          Alert.alert('Erro', `Email já cadastrado para: ${(existingUser as any).full_name}`);
        }
        setLoading(false);
        return;
      }

      // Criar usuário no Supabase Auth primeiro
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name,
          user_type: userData.user_type,
        },
      });

      if (authError) {
        console.error('Erro ao criar usuário no auth:', authError);
        Alert.alert('Erro', `Falha ao criar login: ${authError.message}`);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        Alert.alert('Erro', 'Falha ao criar usuário de autenticação');
        setLoading(false);
        return;
      }

      // Criar perfil com user_id do auth
      const profileData = {
        ...userData,
        user_id: authData.user.id,
      };

      const { data: insertedUser, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData as any)
        .select()
        .single();

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        // Se falhar, deletar o usuário do auth para evitar inconsistência
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error('Erro ao deletar usuário do auth:', deleteError);
        }
        Alert.alert('Erro', `Falha ao criar perfil: ${profileError.message}`);
        setLoading(false);
        return;
      }

      // Armazenar senha temporária
      await storeTemporaryPassword(
        (insertedUser as any).id,
        temporaryPassword,
        hashedPassword,
        userData.phone || ''
      );

      // Se for morador, associar aos apartamentos selecionados
      if (newUser.type === 'morador' && newUser.selectedApartmentIds.length > 0) {
        const apartmentAssociations = newUser.selectedApartmentIds.map((apartmentId) => ({
          profile_id: (insertedUser as any).id,
          apartment_id: apartmentId,
        }));

        const { error: apartmentError } = await supabase
          .from('apartment_residents')
          .insert(apartmentAssociations as any);

        if (apartmentError) {
          console.error('Erro ao associar apartamentos:', apartmentError);
          Alert.alert('Aviso', 'Usuário criado, mas houve erro ao associar apartamentos');
        }
      }

      Keyboard.dismiss();

      // Se sendWhatsApp estiver marcado, enviar automaticamente
      if (sendWhatsApp && newUser.phone) {
        if (newUser.type === 'morador') {
          // Encontrar os nomes do prédio e apartamento para envio
          const building = buildings.find((b) => b.id === newUser.selectedBuildingId);
          const selectedApartments = apartments.filter((apt) =>
            newUser.selectedApartmentIds.includes(apt.id)
          );

          if (building && selectedApartments.length > 0) {
            // Preparar dados para WhatsApp
            const residentData: ResidentData = {
              name: newUser.name,
              phone: newUser.phone,
              email: newUser.email,
              building: building.name,
              apartment: selectedApartments.map((apt) => apt.number).join(', '),
              profile_id: insertedUser.id,
              temporary_password: temporaryPassword,
            };

            await handleSingleUserWhatsApp(residentData);
          }
        } else if (newUser.type === 'porteiro') {
          // Encontrar o nome do prédio para envio
          const building = buildings.find((b) => b.id === newUser.selectedBuildingId);

          if (building) {
            // Preparar dados para WhatsApp do porteiro
            const porteiroData: PorteiroData = {
              name: newUser.name,
              phone: newUser.phone,
              email: newUser.email,
              building: building.name,
              cpf: newUser.cpf,
              work_schedule: `${newUser.workStartTime} - ${newUser.workEndTime}`,
              profile_id: insertedUser.id,
              temporary_password: temporaryPassword,
            };

            await handlePorteiroWhatsApp(porteiroData);
          }
        }

        // Resetar formulário e voltar
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
        router.back();
        return;
      }

      Alert.alert(
        'Sucesso!',
        `${newUser.type === 'morador' ? 'Morador' : 'Porteiro'} criado com sucesso!\n\nSenha temporária: ${temporaryPassword}`,
        [
          {
            text: 'Voltar',
            style: 'cancel',
            onPress: () => {
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
              // Voltar para a tela de usuários
              router.back();
            },
          },
          ...(newUser.phone
            ? [
                {
                  text: 'Enviar WhatsApp',
                  onPress: async () => {
                    if (newUser.type === 'morador') {
                      // Encontrar os nomes do prédio e apartamento para envio
                      const building = buildings.find((b) => b.id === newUser.selectedBuildingId);
                      const selectedApartments = apartments.filter((apt) =>
                        newUser.selectedApartmentIds.includes(apt.id)
                      );

                      if (building && selectedApartments.length > 0) {
                        // Preparar dados para WhatsApp
                        const residentData: ResidentData = {
                          name: newUser.name,
                          phone: newUser.phone,
                          email: newUser.email,
                          building: building.name,
                          apartment: selectedApartments.map((apt) => apt.number).join(', '),
                          profile_id: insertedUser.id,
                          temporary_password: temporaryPassword,
                        };

                        await handleSingleUserWhatsApp(residentData);
                      }
                    } else if (newUser.type === 'porteiro') {
                      // Encontrar o nome do prédio para envio
                      const building = buildings.find((b) => b.id === newUser.selectedBuildingId);

                      if (building) {
                        // Preparar dados para WhatsApp do porteiro
                        const porteiroData: PorteiroData = {
                          name: newUser.name,
                          phone: newUser.phone,
                          email: newUser.email,
                          building: building.name,
                          cpf: newUser.cpf,
                          work_schedule: `${newUser.workStartTime} - ${newUser.workEndTime}`,
                          profile_id: insertedUser.id,
                          temporary_password: temporaryPassword,
                        };

                        await handlePorteiroWhatsApp(porteiroData);
                      }
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
                    // Voltar para a tela de usuários
                    router.back();
                  },
                },
              ]
            : []),
        ]
      );
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      Alert.alert('Erro', 'Falha ao criar usuário. Tente novamente.');
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.title}>✨ Novo Usuário</Text>
          <Text style={styles.subtitle}>Cadastre moradores e porteiros rapidamente</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <KeyboardAwareScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        bottomOffset={40}>
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
                  {getRoleIcon(role)}{' '}
                  {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Indefinido'}
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
          <Text style={styles.label}>
            Telefone {newUser.type === 'morador' ? 'WhatsApp ' : ''}*
          </Text>
          <TextInput
            style={styles.input}
            placeholder="(11) 99999-9999"
            value={newUser.phone}
            onChangeText={(text) => setNewUser((prev) => ({ ...prev, phone: text }))}
            keyboardType="phone-pad"
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

        {/* Campos de prédio e apartamento para moradores */}
        {newUser.type === 'morador' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prédio *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setBuildingSheetVisible(true)}>
                <Text
                  style={[
                    styles.pickerButtonText,
                    !newUser.selectedBuildingId && styles.placeholderText,
                  ]}>
                  {newUser.selectedBuildingId
                    ? buildings.find((b) => b.id === newUser.selectedBuildingId)?.name ||
                      'Selecione um prédio'
                    : 'Selecione um prédio'}
                </Text>
                <Text style={styles.pickerChevron}>▼</Text>
              </TouchableOpacity>
            </View>

            {newUser.selectedBuildingId && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Apartamentos *</Text>
                <Text style={styles.sublabel}>Selecione os apartamentos do morador</Text>
                <View style={styles.apartmentContainer}>
                  {filteredApartments.length > 0 ? (
                    filteredApartments.map((apartment) => (
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
                          {newUser.selectedApartmentIds.includes(apartment.id) ? '✅' : '🏠'}{' '}
                          Apartamento {apartment.number}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.noApartmentsText}>
                      Nenhum apartamento disponível para este prédio
                    </Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}

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
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setWorkDaysSheetVisible(true)}>
                <Text
                  style={[
                    styles.pickerButtonText,
                    !Object.values(newUser.workDays).some((day) => day) && styles.placeholderText,
                  ]}>
                  {Object.values(newUser.workDays).some((day) => day)
                    ? Object.entries(newUser.workDays)
                        .filter(([_, selected]) => selected)
                        .map(([day]) => {
                          const dayLabels: Record<string, string> = {
                            monday: 'Seg',
                            tuesday: 'Ter',
                            wednesday: 'Qua',
                            thursday: 'Qui',
                            friday: 'Sex',
                            saturday: 'Sáb',
                            sunday: 'Dom',
                          };
                          return dayLabels[day];
                        })
                        .join(', ')
                    : 'Selecione os dias'}
                </Text>
                <Text style={styles.pickerChevron}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Horário de Trabalho *</Text>
              <View style={styles.dateTimePickerContainer}>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.dateButtonHalf]}
                  onPress={() => {
                    setTimePickerMode('start');
                    setWorkTimeSheetVisible(true);
                  }}>
                  <Text
                    style={[
                      styles.pickerButtonText,
                      !newUser.workStartTime && styles.placeholderText,
                    ]}>
                    {newUser.workStartTime || 'Início'}
                  </Text>
                  <Text style={styles.pickerChevron}>▼</Text>
                </TouchableOpacity>

                <Text style={styles.timeSeparator}>às</Text>

                <TouchableOpacity
                  style={[styles.pickerButton, styles.dateButtonHalf]}
                  onPress={() => {
                    setTimePickerMode('end');
                    setWorkTimeSheetVisible(true);
                  }}>
                  <Text
                    style={[
                      styles.pickerButtonText,
                      !newUser.workEndTime && styles.placeholderText,
                    ]}>
                    {newUser.workEndTime || 'Fim'}
                  </Text>
                  <Text style={styles.pickerChevron}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Campo de prédio para porteiros */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prédio *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setBuildingSheetVisible(true)}>
                <Text
                  style={[
                    styles.pickerButtonText,
                    !newUser.selectedBuildingId && styles.placeholderText,
                  ]}>
                  {newUser.selectedBuildingId
                    ? buildings.find((b) => b.id === newUser.selectedBuildingId)?.name ||
                      'Selecione um prédio'
                    : 'Selecione um prédio'}
                </Text>
                <Text style={styles.pickerChevron}>▼</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Checkbox para envio de WhatsApp (apenas para moradores) */}
        {newUser.type === 'morador' && newUser.phone && (
          <View style={styles.whatsappCheckboxContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSendWhatsApp(!sendWhatsApp)}>
              <View style={[styles.checkbox, sendWhatsApp && styles.checkboxChecked]}>
                {sendWhatsApp && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Enviar dados de acesso via WhatsApp automaticamente
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botão de ação */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleAddUser}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>✅ Criar Usuário</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Modal de Seleção de Prédios */}
      <Modal visible={showBuildingModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBuildingModal(false)}>
              <Text style={styles.closeButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Selecionar Prédio</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {buildings.map((building) => (
              <TouchableOpacity
                key={building.id}
                style={styles.buildingOption}
                onPress={() => handleBuildingSelect(building.id)}>
                <Text style={styles.buildingOptionText}>{building.name}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Building Selection Bottom Sheet */}
      <BottomSheetModal
        ref={buildingSheetRef}
        visible={buildingSheetVisible}
        onClose={() => setBuildingSheetVisible(false)}
        snapPoints={60}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Selecione um Prédio</Text>
          <Text style={styles.sheetSubtitle}>Escolha o prédio do usuário</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {buildings.length > 0 ? (
            buildings.map((building) => (
              <TouchableOpacity
                key={building.id}
                style={[
                  styles.modalOption,
                  newUser.selectedBuildingId === building.id && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setNewUser((prev) => ({ ...prev, selectedBuildingId: building.id }));
                  setBuildingSheetVisible(false);
                }}>
                <Text
                  style={[
                    styles.modalOptionText,
                    newUser.selectedBuildingId === building.id && styles.modalOptionTextSelected,
                  ]}>
                  {building.name}
                </Text>
                {newUser.selectedBuildingId === building.id && (
                  <Text style={styles.modalCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.bottomSheetEmpty}>
              <Text style={styles.bottomSheetEmptyText}>Nenhum prédio disponível</Text>
            </View>
          )}
        </ScrollView>
      </BottomSheetModal>

      {/* Work Days Selection Bottom Sheet */}
      <BottomSheetModal
        ref={workDaysSheetRef}
        visible={workDaysSheetVisible}
        onClose={() => setWorkDaysSheetVisible(false)}
        snapPoints={65}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Dias de Trabalho</Text>
          <Text style={styles.sheetSubtitle}>Selecione os dias da semana</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {[
            { key: 'monday', label: 'Segunda-feira', emoji: '📅' },
            { key: 'tuesday', label: 'Terça-feira', emoji: '📅' },
            { key: 'wednesday', label: 'Quarta-feira', emoji: '📅' },
            { key: 'thursday', label: 'Quinta-feira', emoji: '📅' },
            { key: 'friday', label: 'Sexta-feira', emoji: '📅' },
            { key: 'saturday', label: 'Sábado', emoji: '📅' },
            { key: 'sunday', label: 'Domingo', emoji: '📅' },
          ].map((day) => (
            <TouchableOpacity
              key={day.key}
              style={[
                styles.modalOption,
                newUser.workDays[day.key as keyof typeof newUser.workDays] &&
                  styles.modalOptionSelected,
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
                  styles.modalOptionText,
                  newUser.workDays[day.key as keyof typeof newUser.workDays] &&
                    styles.modalOptionTextSelected,
                ]}>
                {day.emoji} {day.label}
              </Text>
              {newUser.workDays[day.key as keyof typeof newUser.workDays] && (
                <Text style={styles.modalCheckmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheetModal>

      {/* Work Time Selection Bottom Sheet */}
      <BottomSheetModal
        ref={workTimeSheetRef}
        visible={workTimeSheetVisible}
        onClose={() => setWorkTimeSheetVisible(false)}
        snapPoints={70}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {timePickerMode === 'start' ? 'Horário de Início' : 'Horário de Término'}
          </Text>
          <Text style={styles.sheetSubtitle}>
            Selecione o horário de {timePickerMode === 'start' ? 'início' : 'término'} do trabalho
          </Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {Array.from({ length: 18 }, (_, i) => i + 6).map((hour) =>
            [0, 15, 30, 45].map((minute) => {
              const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
              const isSelected =
                timePickerMode === 'start'
                  ? newUser.workStartTime === timeString
                  : newUser.workEndTime === timeString;

              return (
                <TouchableOpacity
                  key={timeString}
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  onPress={() => {
                    if (timePickerMode === 'start') {
                      setNewUser((prev) => ({ ...prev, workStartTime: timeString }));
                    } else {
                      setNewUser((prev) => ({ ...prev, workEndTime: timeString }));
                    }
                    setWorkTimeSheetVisible(false);
                  }}>
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    🕐 {timeString}
                  </Text>
                  {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FF9800',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTextContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
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
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  sublabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 50,
  },
  dropdownButton: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
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
  apartmentContainer: {
    marginTop: 5,
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
  noApartmentsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
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
  // Estilos para o modal de seleção de prédios
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
    backgroundColor: '#9C27B0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 0,
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
  whatsappCheckboxContainer: {
    marginTop: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  // Picker button styles (from comunicados.tsx)
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 15,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pickerChevron: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  dateTimePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  // Bottom Sheet styles (from comunicados.tsx)
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalCheckmark: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  bottomSheetEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  bottomSheetEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
