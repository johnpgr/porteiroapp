import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';
import BottomNav from '~/components/BottomNav';

// Tipos e interfaces
interface PersonForm {
  full_name: string;
  email: string;
  phone: string;
  person_type: 'familiar' | 'funcionario' | 'autorizado';
  relation: string;
  is_app_user: boolean;
  cpf?: string;
  birth_date?: string;
}

interface Person {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  user_type: string;
  building_id: string;
  cpf?: string;
  birth_date?: string;
  created_at: string;
  is_resident?: boolean;
  is_owner?: boolean;
  relation?: string;
  apartment_number?: string;
  apartment_floor?: number;
  apartment_id?: string;
  resident_id?: string;
}

interface Vehicle {
  id: string;
  license_plate: string;
  brand?: string;
  model?: string;
  color?: string;
  type: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other';
  apartment_id: string;
  created_at: string;
}

const relationOptions = {
  familiar: ['Cônjuge', 'Familia', 'Funcionário'],
  funcionario: ['Empregada doméstica', 'Babá', 'Cuidador(a)', 'Outro funcionário'],
  autorizado: ['Amigo', 'Prestador de serviço', 'Outro autorizado']
};

// Função utilitária para formatação de placa de veículo
const formatLicensePlate = (input: string): string => {
  // Remove todos os caracteres que não são letras ou números
  const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (cleanInput.length === 0) return '';
  
  // Detecta o formato baseado no padrão de entrada
  if (cleanInput.length <= 3) {
    // Apenas letras iniciais
    return cleanInput.replace(/[^A-Z]/g, '');
  } else if (cleanInput.length === 4) {
    // 3 letras + 1 caractere - pode ser formato antigo (número) ou Mercosul (número)
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const fourthChar = cleanInput.slice(3, 4);
    return `${letters}-${fourthChar}`;
  } else if (cleanInput.length === 5) {
    // Detecta se é formato Mercosul (AAA-1A) ou antigo (AAA-11)
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const fourthChar = cleanInput.slice(3, 4);
    const fifthChar = cleanInput.slice(4, 5);
    
    // Se o 5º caractere é letra, é formato Mercosul
    if (/[A-Z]/.test(fifthChar)) {
      return `${letters}-${fourthChar}${fifthChar}`;
    } else {
      // Formato antigo
      return `${letters}-${fourthChar}${fifthChar}`;
    }
  } else if (cleanInput.length === 6) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const numbers = cleanInput.slice(3, 6);
    
    // Verifica se é formato Mercosul (AAA-1A1)
    if (/^[0-9][A-Z][0-9]$/.test(numbers)) {
      return `${letters}-${numbers}`;
    } else {
      // Formato antigo (AAA-111)
      return `${letters}-${numbers.replace(/[^0-9]/g, '')}`;
    }
  } else if (cleanInput.length >= 7) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const remaining = cleanInput.slice(3);
    
    // Verifica se é formato Mercosul (AAA-1A11)
    if (/^[0-9][A-Z][0-9]{2}/.test(remaining)) {
      return `${letters}-${remaining.slice(0, 4)}`;
    } else {
      // Formato antigo (AAA-1111)
      const numbers = remaining.replace(/[^0-9]/g, '').slice(0, 4);
      return `${letters}-${numbers}`;
    }
  }
  
  return cleanInput;
};

// Função para validar placa brasileira
const isValidLicensePlate = (plate: string): boolean => {
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // Formato antigo: AAA1111
  const oldFormat = /^[A-Z]{3}[0-9]{4}$/.test(cleanPlate);
  
  // Formato Mercosul: AAA1A11
  const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleanPlate);
  
  return oldFormat || mercosulFormat;
};

export default function CadastroTab() {
  const { user } = useAuth();
  
  // Estados do formulário
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [userIsOwner, setUserIsOwner] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  
  // Estados para veículos
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [newVehicle, setNewVehicle] = useState({
    license_plate: '',
    brand: '',
    model: '',
    color: '',
    type: '' as 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other' | ''
  });
  
  // Estados do formulário
  const [formData, setFormData] = useState<PersonForm>({
    full_name: '',
    email: '',
    phone: '',
    person_type: 'familiar',
    relation: '',
    is_app_user: false,
  });
  
  // Carregar pessoas cadastradas
  useEffect(() => {
    if (user?.building_id) {
      fetchPeople();
      fetchVehicles();
    }
  }, [user?.building_id]);

  // Função para buscar pessoas cadastradas
  const fetchPeople = async () => {
    if (!user?.id) {
      console.log('❌ DEBUG: Usuário não encontrado, cancelando busca de pessoas');
      return;
    }
    
    try {
      setLoadingPeople(true);
      
      console.log('🔍 DEBUG: Iniciando busca de pessoas cadastradas');
      console.log('🔍 DEBUG: User ID:', user.id);
      
      // Primeiro, buscar o building_id do usuário logado
      console.log('🔍 DEBUG: Buscando building_id do usuário através de apartment_residents...');
      const { data: userApartmentData, error: userApartmentError } = await supabase
        .from('apartment_residents')
        .select(`
          apartment_id,
          apartments!inner (
            building_id
          )
        `)
        .eq('profile_id', user.id)
        .maybeSingle();
      
      console.log('🔍 DEBUG: Resultado da busca do building_id do usuário:', {
        data: userApartmentData,
        error: userApartmentError
      });
      
      if (userApartmentError || !userApartmentData?.apartments?.building_id) {
        console.error('❌ DEBUG: Erro ao buscar building_id do usuário:', userApartmentError);
        throw new Error('Não foi possível encontrar o prédio do usuário');
      }
      
      const userBuildingId = userApartmentData.apartments.building_id;
      console.log('✅ DEBUG: Building ID do usuário encontrado:', userBuildingId);
      
      // Buscar moradores da tabela apartment_residents com JOIN nas tabelas profiles e apartments
      // Incluir todos os residentes do mesmo prédio
      console.log('🔍 DEBUG: Buscando residentes do mesmo prédio...');
      const { data: residentsData, error } = await supabase
        .from('apartment_residents')
        .select(`
          id,
          profile_id,
          apartment_id,
          is_owner,
          created_at,
          profiles!inner (
            id,
            full_name,
            email,
            phone,
            user_type,
            building_id,
            cpf,
            birth_date,
            relation
          ),
          apartments!inner (
            id,
            number,
            building_id,
            floor
          )
        `)
        .eq('apartments.building_id', userBuildingId);
      
      if (error) throw error;
      
      // Transformar os dados para o formato esperado
      const transformedPeople = (residentsData || []).map((resident: any) => ({
        id: resident.profiles.id,
        full_name: resident.profiles.full_name,
        email: resident.profiles.email,
        phone: resident.profiles.phone,
        user_type: resident.profiles.user_type,
        building_id: resident.profiles.building_id,
        cpf: resident.profiles.cpf,
        birth_date: resident.profiles.birth_date,
        created_at: resident.created_at,
        relation: resident.profiles.relation,
        is_resident: true,
        is_owner: resident.is_owner,
        apartment_number: resident.apartments.number,
        apartment_floor: resident.apartments.floor,
        apartment_id: resident.apartment_id,
        resident_id: resident.id
      }));
      
      // Buscar apartment_id e is_owner do usuário logado
      const { data: userResident } = await supabase
        .from('apartment_residents')
        .select('apartment_id, is_owner')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (userResident) {
        // Definir se o usuário logado é proprietário
        setUserIsOwner(userResident.is_owner || false);
        
        // Mostrar todas as pessoas do mesmo apartamento (incluindo o usuário logado)
        const sameApartmentPeople = transformedPeople.filter(person => 
          person.apartment_id === userResident.apartment_id
        );
        setPeople(sameApartmentPeople);
      } else {
        setUserIsOwner(false);
        setPeople([]);
      }
    } catch (error) {
      console.error('Erro ao buscar pessoas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as pessoas cadastradas');
    } finally {
      setLoadingPeople(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      setLoadingVehicles(true);
      
      if (!user?.id) {
        console.error('User ID não encontrado');
        return;
      }

      // Buscar apartment_id do usuário
      const { data: userResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (residentError || !userResident?.apartment_id) {
        console.error('Erro ao buscar apartment_id do usuário:', residentError);
        return;
      }

      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('apartment_id', userResident.apartment_id)
        .order('created_at', { ascending: false });

      if (vehiclesError) {
        console.error('Erro ao buscar veículos:', vehiclesError);
        return;
      }

      setVehicles(vehiclesData || []);
    } catch (error) {
      console.error('Erro ao buscar veículos:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleAddVehicle = async () => {
    try {
      setLoading(true);
      
      if (!user?.id) {
        alert('Usuário não encontrado');
        return;
      }

      if (!newVehicle.license_plate.trim()) {
        alert('Placa do veículo é obrigatória');
        return;
      }

      if (!newVehicle.type) {
        alert('Tipo do veículo é obrigatório');
        return;
      }

      // Buscar apartment_id do usuário
      const { data: userResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (residentError || !userResident?.apartment_id) {
        console.error('Erro ao buscar apartment_id do usuário:', residentError);
        alert('Erro ao encontrar informações do apartamento. Tente novamente.');
        return;
      }

      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          license_plate: newVehicle.license_plate.trim().toUpperCase(),
          brand: newVehicle.brand.trim() || null,
          model: newVehicle.model.trim() || null,
          color: newVehicle.color.trim() || null,
          type: newVehicle.type,
          apartment_id: userResident.apartment_id
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao cadastrar veículo:', error);
        alert('Erro ao cadastrar veículo. Tente novamente.');
        return;
      }

      // Atualizar lista de veículos
      setVehicles(prev => [data, ...prev]);
      
      // Limpar formulário e fechar modal
      resetVehicleForm();
      setShowVehicleForm(false);
      
      alert('Veículo cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      alert('Erro ao cadastrar veículo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetVehicleForm = () => {
    setNewVehicle({
      license_plate: '',
      brand: '',
      model: '',
      color: '',
      type: ''
    });
  };

  // Função para validar email único
  const validateUniqueEmail = async (email: string, excludeId?: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .neq('id', excludeId || '')
      .maybeSingle();
    
    return !data; // Retorna true se não encontrou (email único)
  };

  // Função para cadastrar nova pessoa
  // Função para validar email
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Função para validar CPF
  const isValidCPF = (cpf: string): boolean => {
    if (!cpf) return true; // CPF é opcional
    
    // Remove caracteres não numéricos
    const numericOnly = cpf.replace(/\D/g, '');
    
    // Verifica se tem exatamente 11 dígitos
    if (numericOnly.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais (CPF inválido)
    if (/^(\d)\1{10}$/.test(numericOnly)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numericOnly.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numericOnly.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numericOnly.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numericOnly.charAt(10))) return false;
    
    return true;
  };

  // Função para validar telefone
  const isValidPhone = (phone: string): boolean => {
    if (!phone) return true; // Telefone é opcional
    const numericOnly = phone.replace(/\D/g, '');
    return numericOnly.length >= 10 && numericOnly.length <= 11;
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert('Erro', 'Informações do usuário não encontradas');
      return;
    }

    // Validações
    if (!formData.full_name.trim()) {
      Alert.alert('Erro', 'Nome completo é obrigatório');
      return;
    }
    
    if (!formData.email.trim()) {
      Alert.alert('Erro', 'Email é obrigatório');
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert('Erro', 'Por favor, insira um email válido');
      return;
    }

    if (!formData.person_type) {
      Alert.alert('Erro', 'Tipo de pessoa é obrigatório');
      return;
    }

    if (formData.cpf && !isValidCPF(formData.cpf)) {
      Alert.alert('Erro', 'CPF inválido. Verifique os dados inseridos.');
      return;
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      Alert.alert('Erro', 'Telefone deve ter entre 10 e 11 dígitos');
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('🔍 DEBUG: Iniciando cadastro/atualização de perfil');
      console.log('🔍 DEBUG: User ID:', user.id);
      
      // Buscar o building_id do usuário logado
      console.log('🔍 DEBUG: Buscando building_id do usuário para cadastro...');
      const { data: userApartmentData, error: userApartmentError } = await supabase
        .from('apartment_residents')
        .select(`
          apartment_id,
          apartments!inner (
            building_id
          )
        `)
        .eq('profile_id', user.id)
        .maybeSingle();
      
      console.log('🔍 DEBUG: Resultado da busca do building_id para cadastro:', {
        data: userApartmentData,
        error: userApartmentError
      });
      
      if (userApartmentError || !userApartmentData?.apartments?.building_id) {
        console.error('❌ DEBUG: Erro ao buscar building_id para cadastro:', userApartmentError);
        Alert.alert('Erro', 'Não foi possível encontrar o prédio do usuário');
        return;
      }
      
      const userBuildingId = userApartmentData.apartments.building_id;
      console.log('✅ DEBUG: Building ID para cadastro encontrado:', userBuildingId);
      
      // Verificar se email é único
      const isEmailUnique = await validateUniqueEmail(formData.email, editingPerson?.id);
      if (!isEmailUnique) {
        Alert.alert('Erro', 'Este email já está cadastrado');
        return;
      }

      let createdUserId = null;
      
      if (formData.is_app_user) {
        // Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: '123456', // Senha padrão
          options: {
            data: {
              full_name: formData.full_name,
            }
          }
        });
        
        if (authError) {
          console.error('Erro ao criar usuário:', authError);
          Alert.alert('Erro', 'Não foi possível criar usuário do app');
          return;
        }
        
        if (authData.user) {
          createdUserId = authData.user.id;
        }
      }

      // Determinar user_type baseado no person_type
      let user_type = 'morador';
      if (formData.person_type === 'funcionario') {
        user_type = 'funcionario';
      }

      // Criar profile - só incluir user_id se foi criado um usuário do app
      const profileData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || null,
        user_type,
        building_id: userBuildingId,
        cpf: formData.cpf || null,
        birth_date: formData.birth_date || null,
        relation: formData.relation || null,
        ...(createdUserId && { user_id: createdUserId }),
      };
      
      console.log('🔍 DEBUG: Dados do perfil a serem salvos:', profileData);

      let profileId: string;
      
      if (editingPerson) {
        // Atualizar pessoa existente
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', editingPerson.id);
        
        if (updateError) throw updateError;
        profileId = editingPerson.id;
      } else {
        // Criar nova pessoa
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select('id')
          .maybeSingle();
        
        if (profileError) throw profileError;
        profileId = newProfile.id;
      }

      // Sempre adicionar em apartment_residents para qualquer tipo de pessoa cadastrada
      if (!editingPerson) {
        console.log('🔍 DEBUG: Iniciando busca do apartment_id do usuário atual:', user.id);
        
        // Buscar apartment_id do usuário atual
        const { data: userResident, error: residentError } = await supabase
          .from('apartment_residents')
          .select('apartment_id')
          .eq('profile_id', user.id)
          .maybeSingle();
        
        console.log('🔍 DEBUG: Resultado da busca apartment_id:', { userResident, residentError });
        
        if (userResident) {
          console.log('🔍 DEBUG: Inserindo nova pessoa em apartment_residents:', {
            apartment_id: userResident.apartment_id,
            profile_id: profileId,
            is_owner: formData.is_owner || false
          });
          
          try {
            const { data: insertResult, error: insertError } = await supabase
              .from('apartment_residents')
              .insert({
                apartment_id: userResident.apartment_id,
                profile_id: profileId,
                is_owner: false
              })
              .select();
            
            console.log('✅ DEBUG: Resultado da inserção em apartment_residents:', { insertResult, insertError });
            
            if (insertError) {
              console.error('❌ DEBUG: Erro ao inserir em apartment_residents:', insertError);
              throw insertError;
            }
          } catch (insertErr) {
            console.error('❌ DEBUG: Erro no try/catch da inserção:', insertErr);
            throw insertErr;
          }
        } else {
          console.log('⚠️ DEBUG: Usuário atual não encontrado em apartment_residents!');
        }
      } else {
        // Se estiver editando, atualizar o registro em apartment_residents se existir
        if (editingPerson.resident_id) {
          await supabase
            .from('apartment_residents')
            .update({
              is_owner: false
            })
            .eq('id', editingPerson.resident_id);
        }
      }

      Alert.alert(
        'Sucesso', 
        editingPerson ? 'Pessoa atualizada com sucesso!' : 'Pessoa cadastrada com sucesso!'
      );
      
      resetForm();
      setShowModal(false);
      fetchPeople();
      
    } catch (error) {
      console.error('Erro ao salvar pessoa:', error);
      Alert.alert('Erro', 'Não foi possível salvar a pessoa');
    } finally {
      setLoading(false);
    }
  };

  // Função para formatar data de nascimento
  const formatBirthDate = (text: string) => {
    // Remove tudo que não é número
    const numbers = text.replace(/\D/g, '');
    
    // Aplica a máscara DD/MM/YYYY
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
    }
  };

  // Função para resetar formulário
  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      person_type: 'familiar',
      relation: '',
      is_app_user: false,
      cpf: '',
      birth_date: ''
    });
    setEditingPerson(null);
  };

  // Função para editar pessoa
  const handleEdit = (person: Person) => {
    setFormData({
      full_name: person.full_name,
      email: person.email,
      phone: person.phone || '',
      person_type: person.user_type === 'funcionario' ? 'funcionario' : 'familiar',
      relation: person.relation || '',
      is_app_user: false, // Não podemos determinar isso facilmente
      cpf: person.cpf,
      birth_date: person.birth_date,
    });
    setEditingPerson(person);
    setShowModal(true);
  };

  // Função para remover pessoa
  const handleDelete = (person: Person) => {
    Alert.alert(
      'Confirmar exclusão',
      `Deseja realmente excluir ${person.full_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Remover de apartment_residents se for residente
              if (person.is_resident && person.resident_id) {
                await supabase
                  .from('apartment_residents')
                  .delete()
                  .eq('id', person.resident_id);
              }
              
              // Remover profile
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', person.id);
              
              if (error) throw error;
              
              Alert.alert('Sucesso', 'Pessoa removida com sucesso!');
              fetchPeople();
            } catch (error) {
              console.error('Erro ao remover pessoa:', error);
              Alert.alert('Erro', 'Não foi possível remover a pessoa');
            }
          }
        }
      ]
    );
  };

  const renderCadastroTab = () => {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Cadastro de Pessoas e Veículos</Text>
            <Text style={styles.sectionDescription}>
              Cadastre familiares, funcionários, pessoas autorizadas e veículos
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.halfButton]}
                onPress={() => {
                  resetForm();
                  setShowModal(true);
                }}>
                <Ionicons name="person-add" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>Cadastrar Nova Pessoa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, styles.halfButton]}
                onPress={() => {
                  resetVehicleForm();
                  setShowVehicleForm(true);
                }}>
                <Ionicons name="car" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>Cadastrar Novo Veículo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Pessoas Cadastradas</Text>
            
            {loadingPeople ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Carregando pessoas...</Text>
              </View>
            ) : (
              <>
                {/* Exibir todas as pessoas cadastradas */}
                {people.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhuma pessoa cadastrada neste apartamento</Text>
                  </View>
                ) : (
                  people.map((person) => {
                    const isCurrentUser = person.id === user?.id;
                    return (
                      <View key={person.id} style={[styles.personCard, isCurrentUser && styles.currentUserCard]}>
                        <Text style={styles.personName}>
                          {person.full_name}
                          {isCurrentUser && ' (Você)'}
                        </Text>
                        <Text style={styles.personRelation}>
                          {person.user_type === 'funcionario' ? '👷 Funcionário' : 
                           person.is_resident ? (person.is_owner ? '🏠 Proprietário' : '👨‍👩‍👧‍👦 Morador') : '👥 Familiar'}
                          {person.relation && ` • ${person.relation}`}
                          {isCurrentUser && ' • Responsável pelo cadastro'}
                        </Text>
                        {person.apartment_number && (
                          <Text style={styles.apartmentInfo}>
                            🏢 Apartamento {person.apartment_number}
                            {person.apartment_floor && ` • ${person.apartment_floor}º andar`}
                          </Text>
                        )}
                        <Text style={styles.personAccess}>
                          📧 {person.email}
                          {person.phone && ` • 📱 ${person.phone}`}
                        </Text>
                        {isCurrentUser && (
                          <Text style={styles.dateInfo}>
                            ℹ️ Você tem acesso à aba de cadastro de pessoas
                          </Text>
                        )}

                        {!isCurrentUser && (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity 
                              style={styles.editButton}
                              onPress={() => handleEdit(person)}
                            >
                              <Text style={styles.editButtonText}>✏️ Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.deleteButton}
                              onPress={() => handleDelete(person)}
                            >
                              <Text style={styles.deleteButtonText}>🗑️ Excluir</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚙 Veículos Cadastrados</Text>
            
            {loadingVehicles ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Carregando veículos...</Text>
              </View>
            ) : (
              <>
                {vehicles.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhum veículo cadastrado</Text>
                  </View>
                ) : (
                  vehicles.map((vehicle) => (
                    <View key={vehicle.id} style={styles.vehicleCard}>
                      <Text style={styles.vehiclePlate}>{formatLicensePlate(vehicle.license_plate || '')}</Text>
                      <Text style={styles.vehicleInfo}>
                        {vehicle.type === 'car' ? '🚗' : vehicle.type === 'motorcycle' ? '🏍️' : '🚚'} 
                        {vehicle.type === 'car' ? 'Carro' : 
                         vehicle.type === 'motorcycle' ? 'Moto' : 
                         vehicle.type === 'truck' ? 'Caminhão' : 
                         vehicle.type === 'van' ? 'Van' : 
                         vehicle.type === 'bus' ? 'Ônibus' : 'Outro'}
                      </Text>
                      {(vehicle.brand || vehicle.model) && (
                        <Text style={styles.vehicleDetails}>
                          {vehicle.brand} {vehicle.model}
                        </Text>
                      )}
                      {vehicle.color && (
                        <Text style={styles.vehicleColor}>🎨 {vehicle.color}</Text>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        </ScrollView>
        
        {/* Modal de Cadastro */}
        <Modal
          visible={showModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            resetForm();
            setShowModal(false);
          }}
        >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingPerson ? 'Editar Pessoa' : 'Nova Pessoa'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                resetForm();
                setShowModal(false);
              }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Nome Completo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome Completo *</Text>
              <TextInput
                style={styles.input}
                value={formData.full_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, full_name: text }))}
                placeholder="Digite o nome completo"
                editable={!loading}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                placeholder="Digite o email"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            {/* Telefone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder="Digite o telefone"
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            {/* Tipo de Pessoa */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Pessoa *</Text>
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => {
                  Alert.alert(
                    'Selecione o Tipo de Pessoa',
                    '',
                    [
                      {
                        text: 'Familiar',
                        onPress: () => setFormData(prev => ({ ...prev, person_type: 'familiar', relation: '' }))
                      },
                      {
                        text: 'Funcionário',
                        onPress: () => setFormData(prev => ({ ...prev, person_type: 'funcionario', relation: '' }))
                      },
                      {
                        text: 'Autorizado',
                        onPress: () => setFormData(prev => ({ ...prev, person_type: 'autorizado', relation: '' }))
                      },
                      {
                        text: 'Cancelar',
                        onPress: () => {}
                      }
                    ],
                    { cancelable: true }
                  );
                }}
                disabled={loading}
              >
                <Text style={[styles.dropdownText, !formData.person_type && styles.placeholderText]}>
                  {formData.person_type === 'familiar' ? 'Familiar' :
                   formData.person_type === 'funcionario' ? 'Funcionário' :
                   formData.person_type === 'autorizado' ? 'Autorizado' : 'Selecione o tipo'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* CPF */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                value={formData.cpf}
                onChangeText={(text) => setFormData(prev => ({ ...prev, cpf: text }))}
                placeholder="Digite o CPF"
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            {/* Data de Nascimento */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data de Nascimento</Text>
              <TextInput
                style={styles.input}
                value={formData.birth_date}
                onChangeText={(text) => {
                  const formattedDate = formatBirthDate(text);
                  setFormData(prev => ({ ...prev, birth_date: formattedDate }));
                }}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
                editable={!loading}
              />
            </View>

          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                resetForm();
                setShowModal(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Cadastro de Veículo */}
      <Modal
        visible={showVehicleForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          resetVehicleForm();
          setShowVehicleForm(false);
        }}
      >
        <View style={styles.vehicleForm}>
          <View style={styles.vehicleHeader}>
            <Text style={styles.vehicleTitle}>Cadastrar Novo Veículo</Text>
            <TouchableOpacity
              style={styles.closeButtonContainer}
              onPress={() => {
                resetVehicleForm();
                setShowVehicleForm(false);
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.vehicleContent}>
            {/* Placa do Veículo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Placa do Veículo *</Text>
              <TextInput
                style={styles.input}
                value={newVehicle.license_plate}
                onChangeText={(text) => {
                  const formattedPlate = formatLicensePlate(text);
                  setNewVehicle(prev => ({ ...prev, license_plate: formattedPlate }));
                }}
                placeholder="ABC-1234 ou ABC-1A23"
                autoCapitalize="characters"
                maxLength={8}
                editable={!loading}
              />
            </View>

            {/* Marca do Veículo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Marca do Veículo</Text>
              <TextInput
                style={styles.input}
                value={newVehicle.brand}
                onChangeText={(text) => setNewVehicle(prev => ({ ...prev, brand: text }))}
                placeholder="Ex: Toyota, Honda, Ford"
                editable={!loading}
              />
            </View>

            {/* Modelo do Veículo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Modelo do Veículo</Text>
              <TextInput
                style={styles.input}
                value={newVehicle.model}
                onChangeText={(text) => setNewVehicle(prev => ({ ...prev, model: text }))}
                placeholder="Ex: Corolla, Civic, Focus"
                editable={!loading}
              />
            </View>

            {/* Cor do Veículo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cor do Veículo</Text>
              <TextInput
                style={styles.input}
                value={newVehicle.color}
                onChangeText={(text) => setNewVehicle(prev => ({ ...prev, color: text }))}
                placeholder="Ex: Branco, Preto, Prata"
                editable={!loading}
              />
            </View>

            {/* Tipo do Veículo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo do Veículo *</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  Alert.alert(
                    'Selecionar Tipo',
                    'Escolha o tipo do veículo:',
                    [
                      { text: 'Carro', onPress: () => setNewVehicle(prev => ({ ...prev, type: 'car' })) },
                      { text: 'Moto', onPress: () => setNewVehicle(prev => ({ ...prev, type: 'motorcycle' })) },
                      { text: 'Cancelar', style: 'cancel' }
                    ]
                  );
                }}
                disabled={loading}
              >
                <Text style={newVehicle.type ? styles.dropdownText : styles.placeholderText}>
                  {newVehicle.type ? 
                    (newVehicle.type === 'car' ? 'Carro' : 
                     newVehicle.type === 'motorcycle' ? 'Moto' : 
                     newVehicle.type === 'truck' ? 'Caminhão' : 
                     newVehicle.type === 'van' ? 'Van' : 
                     newVehicle.type === 'bus' ? 'Ônibus' : 'Outro') : 
                    'Selecione o tipo do veículo'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                resetVehicleForm();
                setShowVehicleForm(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleAddVehicle}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Salvando...' : 'Salvar Veículo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
  };

  // Função para renderizar o cabeçalho
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.alertButton} onPress={() => router.push('/morador/emergency')}>
        <Ionicons name="warning" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.title}>🏠 Morador</Text>
        <Text style={styles.subtitle}>Apartamento 101</Text>
      </View>

      <TouchableOpacity style={styles.avatarButton} onPress={() => setShowAvatarMenu(true)}>
        <Ionicons name="person-circle" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // Modal do menu do avatar
  const renderAvatarMenu = () => (
    <Modal
      visible={showAvatarMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowAvatarMenu(false)}
    >
      <TouchableOpacity 
        style={styles.avatarMenuOverlay} 
        activeOpacity={1} 
        onPress={() => setShowAvatarMenu(false)}
      >
        <View style={styles.avatarMenuContainer}>
          <TouchableOpacity 
            style={styles.avatarMenuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              router.push('/morador/profile');
            }}
          >
            <Ionicons name="person" size={20} color="#333" />
            <Text style={styles.avatarMenuText}>Perfil</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.avatarMenuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              router.push('/morador/configuracoes');
            }}
          >
            <Ionicons name="settings" size={20} color="#333" />
            <Text style={styles.avatarMenuText}>Configurações</Text>
          </TouchableOpacity>
          
          <View style={styles.avatarMenuSeparator} />
          
          <TouchableOpacity 
            style={styles.avatarMenuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              // Implementar logout
            }}
          >
            <Ionicons name="log-out" size={20} color="#f44336" />
            <Text style={[styles.avatarMenuText, { color: '#f44336' }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          {renderHeader()}
          {renderCadastroTab()}
        </View>
        <BottomNav activeTab="cadastro" />
        {renderAvatarMenu()}
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
   title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  placeholder: {
    width: 40,
  },
  alertButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  avatarButton: {
    padding: 4,
  },
  avatarMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  avatarMenuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarMenuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  avatarMenuSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  content: {
    flex: 1,
    paddingVertical: 24,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  personCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  currentUserCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    borderWidth: 2,
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  personRelation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  apartmentInfo: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 4,
    fontWeight: '500',
  },
  personAccess: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dateInfo: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 8,
    flex: 1,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    padding: 8,
    flex: 1,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flex: 1,
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flex: 1,
    marginRight: 8,
  },
  disabledButton: {
    color: '#ccc',
  },
  modalContent: {
    paddingLeft: 24,
    paddingRight: 24,
    marginTop: 24,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  checkboxGroup: {
    marginTop: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  // Estilos para veículos
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 4,
    fontWeight: '500',
  },
  vehicleColor: {
    fontSize: 14,
    color: '#666',
  },
  // Estilos para modal de veículo
  vehicleForm: {
    flex: 1,
    backgroundColor: '#fff',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  vehicleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButtonContainer: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  vehicleContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
});