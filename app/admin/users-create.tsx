import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, adminAuth } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../../services/notificationService';
import * as Crypto from 'expo-crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';
const supabaseAdmin = createClient(
  'https://ycamhxzumzkpxuhtugxc.supabase.co',
  supabaseServiceRoleKey
);

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

// Função para gerar senha temporária aleatória de 6 dígitos numéricos
const generateTemporaryPassword = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Função para criar hash da senha usando expo-crypto
const hashPassword = async (password: string): Promise<string> => {
  // Usar SHA-256 para criar hash da senha
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
};

// Função para armazenar senha temporária no banco de dados
const storeTemporaryPassword = async (profileId: string, plainPassword: string, hashedPassword: string, phoneNumber: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('temporary_passwords')
      .insert({
        profile_id: profileId,
        password_hash: hashedPassword,
        plain_password: plainPassword,
        phone_number: phoneNumber,
        used: false,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias
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
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  
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
      setWhatsappLoading(true);

      console.log('Enviando WhatsApp para:', residentData);

      // Usar o notificationService para enviar WhatsApp
      const success = await notificationService.sendResidentWhatsApp({
        name: residentData.name,
        phone: residentData.phone,
        email: residentData.email,
        building: residentData.building,
        apartment: residentData.apartment,
        profile_id: residentData.profile_id,
        temporary_password: residentData.temporary_password || ''
      });

      if (success) {
        Alert.alert('Sucesso', `WhatsApp enviado para ${residentData.name}`);
      } else {
        Alert.alert('Erro', 'Falha ao enviar WhatsApp. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      Alert.alert('Erro', 'Falha ao enviar WhatsApp');
    } finally {
      setWhatsappLoading(false);
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
        birth_date: newUser.type === 'porteiro' && newUser.birthDate ? 
          `${newUser.birthDate.slice(6, 10)}-${newUser.birthDate.slice(3, 5)}-${newUser.birthDate.slice(0, 2)}` : null,
        address: newUser.type === 'porteiro' ? newUser.address.trim() : null,
        work_schedule: newUser.type === 'porteiro' ? JSON.stringify({
          days: newUser.workDays,
          startTime: newUser.workStartTime,
          endTime: newUser.workEndTime
        }) : null,
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
          user_type: userData.user_type
        }
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
      await storeTemporaryPassword((insertedUser as any).id, temporaryPassword, hashedPassword, userData.phone || '');

      // Se for morador, associar aos apartamentos selecionados
      if (newUser.type === 'morador' && newUser.selectedApartmentIds.length > 0) {
        const apartmentAssociations = newUser.selectedApartmentIds.map(apartmentId => ({
          profile_id: (insertedUser as any).id,
          apartment_id: apartmentId
        }));

        const { error: apartmentError } = await supabase
          .from('apartment_residents')
          .insert(apartmentAssociations as any);

        if (apartmentError) {
          console.error('Erro ao associar apartamentos:', apartmentError);
          Alert.alert('Aviso', 'Usuário criado, mas houve erro ao associar apartamentos');
        }
      }

      // Se sendWhatsApp estiver marcado e for morador, enviar automaticamente
      if (sendWhatsApp && newUser.type === 'morador' && newUser.phone) {
        // Encontrar os nomes do prédio e apartamento para envio
        const building = buildings.find(b => b.id === newUser.selectedBuildingId);
        const selectedApartments = apartments.filter(apt => 
          newUser.selectedApartmentIds.includes(apt.id)
        );
        
        if (building && selectedApartments.length > 0) {
          // Preparar dados para WhatsApp
          const residentData: ResidentData = {
            name: newUser.name,
            phone: newUser.phone,
            email: newUser.email,
            building: building.name,
            apartment: selectedApartments.map(apt => apt.number).join(', '),
            profile_id: insertedUser.id,
            temporary_password: temporaryPassword
          };

          await handleSingleUserWhatsApp(residentData);
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
            }
          },
          ...(newUser.type === 'morador' && newUser.phone ? [{
            text: 'Enviar WhatsApp',
            onPress: async () => {
              // Encontrar os nomes do prédio e apartamento para envio
              const building = buildings.find(b => b.id === newUser.selectedBuildingId);
              const selectedApartments = apartments.filter(apt => 
                newUser.selectedApartmentIds.includes(apt.id)
              );
              
              if (building && selectedApartments.length > 0) {
                // Preparar dados para WhatsApp
                const residentData: ResidentData = {
                  name: newUser.name,
                  phone: newUser.phone,
                  email: newUser.email,
                  building: building.name,
                  apartment: selectedApartments.map(apt => apt.number).join(', '),
                  profile_id: insertedUser.id,
                  temporary_password: temporaryPassword
                };

                await handleSingleUserWhatsApp(residentData);
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
            }
          }] : [])
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>✨ Novo Usuário</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
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
                style={styles.dropdownButton}
                onPress={() => setShowBuildingModal(true)}
              >
                <Text style={[styles.dropdownText, !newUser.selectedBuildingId && styles.placeholderText]}>
                  {newUser.selectedBuildingId 
                    ? buildings.find(b => b.id === newUser.selectedBuildingId)?.name || 'Selecione um prédio'
                    : 'Selecione um prédio'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
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

            {/* Campo de prédio para porteiros */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prédio *</Text>
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => setShowBuildingModal(true)}
              >
                <Text style={[styles.dropdownText, !newUser.selectedBuildingId && styles.placeholderText]}>
                  {newUser.selectedBuildingId 
                    ? buildings.find(b => b.id === newUser.selectedBuildingId)?.name || 'Selecione um prédio'
                    : 'Selecione um prédio'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Checkbox para envio de WhatsApp (apenas para moradores) */}
      {newUser.type === 'morador' && newUser.phone && (
        <View style={styles.whatsappContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setSendWhatsApp(!sendWhatsApp)}
          >
            <View style={[styles.checkbox, sendWhatsApp && styles.checkboxChecked]}>
              {sendWhatsApp && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <Text style={styles.checkboxLabel}>
              Enviar dados de acesso via WhatsApp automaticamente
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}>
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

      {/* Modal de Seleção de Prédios */}
      <Modal visible={showBuildingModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
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
                onPress={() => handleBuildingSelect(building.id)}
              >
                <Text style={styles.buildingOptionText}>{building.name}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 10,
    backgroundColor: '#9C27B0',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
  footer: {
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
  disabledButton: {
    backgroundColor: '#ccc',
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
  whatsappContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
});
