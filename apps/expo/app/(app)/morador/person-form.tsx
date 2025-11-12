import React, { useState, useRef } from 'react';
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
import { IconSymbol } from '~/components/ui/IconSymbol';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

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

const relationOptions = {
  familiar: ['Cônjuge', 'Familia', 'Funcionário'],
  funcionario: ['Empregada doméstica', 'Babá', 'Cuidador(a)', 'Outro funcionário'],
  autorizado: ['Amigo', 'Prestador de serviço', 'Outro autorizado']
};

// Função para validar email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Função para validar CPF
const isValidCPF = (cpf: string): boolean => {
  if (!cpf) return true;
  const numericOnly = cpf.replace(/\D/g, '');
  if (numericOnly.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numericOnly)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numericOnly.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numericOnly.charAt(9))) return false;

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
  if (!phone) return true;
  const numericOnly = phone.replace(/\D/g, '');
  return numericOnly.length >= 10 && numericOnly.length <= 11;
};

// Função para formatar data de nascimento
const formatBirthDate = (text: string) => {
  const numbers = text.replace(/\D/g, '');
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

export default function PersonFormScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const typeSheetRef = useRef<BottomSheetModalRef>(null);

  const [formData, setFormData] = useState<PersonForm>({
    full_name: '',
    email: '',
    phone: '',
    person_type: 'familiar',
    relation: '',
    is_app_user: false,
  });

  const handleSelectType = (type: 'familiar' | 'funcionario' | 'autorizado') => {
    setFormData(prev => ({ ...prev, person_type: type, relation: '' }));
    setShowTypePicker(false);
  };

  const validateUniqueEmail = async (email: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return !data;
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

      if (userApartmentError || !userApartmentData?.apartments?.building_id) {
        Alert.alert('Erro', 'Não foi possível encontrar o prédio do usuário');
        return;
      }

      const userBuildingId = userApartmentData.apartments.building_id;

      const isEmailUnique = await validateUniqueEmail(formData.email);
      if (!isEmailUnique) {
        Alert.alert('Erro', 'Este email já está cadastrado');
        return;
      }

      let createdUserId = null;

      if (formData.is_app_user) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: '123456',
          options: {
            data: {
              full_name: formData.full_name,
            }
          }
        });

        if (authError) {
          Alert.alert('Erro', 'Não foi possível criar usuário do app');
          return;
        }

        if (authData.user) {
          createdUserId = authData.user.id;
        }
      }

      let user_type = 'morador';
      if (formData.person_type === 'funcionario') {
        user_type = 'funcionario';
      }

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

      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select('id')
        .maybeSingle();

      if (profileError) throw profileError;
      if (!newProfile) {
        throw new Error('Falha ao criar perfil');
      }

      const { data: userResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (userResident) {
        const { error: insertError } = await supabase
          .from('apartment_residents')
          .insert({
            apartment_id: userResident.apartment_id,
            profile_id: newProfile.id,
            is_owner: false,
            is_primary: false,
          });

        if (insertError) throw insertError;
      }

      Alert.alert('Sucesso', 'Pessoa cadastrada com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);

    } catch (error) {
      console.error('Erro ao salvar pessoa:', error);
      Alert.alert('Erro', 'Não foi possível salvar a pessoa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>👤 Nova Pessoa</Text>
          <Text style={styles.headerSubtitle}>Cadastrar pessoa</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Pessoa *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowTypePicker(true)}
            disabled={loading}
          >
            <Text style={[styles.dropdownText, !formData.person_type && styles.placeholderText]}>
              {formData.person_type === 'familiar' ? 'Familiar' :
               formData.person_type === 'funcionario' ? 'Funcionário' :
               formData.person_type === 'autorizado' ? 'Autorizado' : 'Selecione o tipo'}
            </Text>
            <IconSymbol name="chevron.down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

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

        <View style={styles.submitContainer}>
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
      </ScrollView>

      <BottomSheetModal
        ref={typeSheetRef}
        visible={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        snapPoints={40}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Tipo de Pessoa</Text>
          <Text style={styles.sheetSubtitle}>Escolha uma das opções</Text>
        </View>
        <ScrollView style={styles.sheetContent}>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('familiar')}>
            <Text style={styles.sheetOptionText}>👨‍👩‍👧‍👦 Familiar</Text>
            {formData.person_type === 'familiar' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('funcionario')}>
            <Text style={styles.sheetOptionText}>👷 Funcionário</Text>
            {formData.person_type === 'funcionario' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('autorizado')}>
            <Text style={styles.sheetOptionText}>✅ Autorizado</Text>
            {formData.person_type === 'autorizado' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
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
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  submitContainer: {
    marginTop: 24,
    marginBottom: 32,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
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
  sheetContent: {
    maxHeight: 400,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sheetOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  sheetCheckmark: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '700',
  },
});
