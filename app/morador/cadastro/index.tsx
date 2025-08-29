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
import { Picker } from '@react-native-picker/picker';
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

const relationOptions = {
  familiar: ['Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Irmão/Irmã', 'Outro familiar'],
  funcionario: ['Empregada doméstica', 'Babá', 'Cuidador(a)', 'Outro funcionário'],
  autorizado: ['Amigo', 'Prestador de serviço', 'Outro autorizado']
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
    
    if (!formData.relation.trim()) {
      Alert.alert('Erro', 'Relação é obrigatória');
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
            <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Cadastro de Pessoas</Text>
            <Text style={styles.sectionDescription}>
              Cadastre familiares, funcionários e pessoas autorizadas
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                resetForm();
                setShowModal(true);
              }}>
              <Ionicons name="person-add" size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>Cadastrar Nova Pessoa</Text>
            </TouchableOpacity>
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
            <TouchableOpacity 
              onPress={() => {
                resetForm();
                setShowModal(false);
              }}
            >
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingPerson ? 'Editar Pessoa' : 'Nova Pessoa'}
            </Text>
            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={[styles.saveButton, loading && styles.disabledButton]}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Text>
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
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.person_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, person_type: value, relation: '' }))}
                  enabled={!loading}
                >
                  <Picker.Item label="Familiar" value="familiar" />
                  <Picker.Item label="Funcionário" value="funcionario" />
                  <Picker.Item label="Autorizado" value="autorizado" />
                </Picker>
              </View>
            </View>

            {/* Relação */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Relação *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.relation}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relation: value }))}
                  enabled={!loading}
                >
                  <Picker.Item label="Selecione a relação" value="" />
                  {relationOptions[formData.person_type].map((option) => (
                    <Picker.Item key={option} label={option} value={option} />
                  ))}
                </Picker>
              </View>
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

            {/* Checkboxes */}
            <View style={styles.checkboxGroup}>
              <TouchableOpacity 
                style={styles.checkboxRow}
                onPress={() => setFormData(prev => ({ ...prev, is_app_user: !prev.is_app_user }))}
                disabled={loading}
              >
                <View style={[styles.checkbox, formData.is_app_user && styles.checkboxChecked]}>
                  {formData.is_app_user && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>É usuário do aplicativo</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
  };

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/morador')}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>👨‍👩‍👧‍👦 Cadastro</Text>
            <View style={styles.placeholder} />
          </View>
          {renderCadastroTab()}
        </View>
        <BottomNav activeTab="cadastro" />
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
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    color: '#666',
    fontSize: 16,
  },
  saveButton: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
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
});