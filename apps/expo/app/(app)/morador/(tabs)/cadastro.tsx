import type { Database } from '@porteiroapp/common/supabase';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '~/hooks/useAuth';
import { isRegularUser } from '~/types/auth.types';
import { supabase } from '~/utils/supabase';

// Database types
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type VehicleRow = Database['public']['Tables']['vehicles']['Row'];
type ApartmentResidentRow = Database['public']['Tables']['apartment_residents']['Row'];
type ApartmentRow = Database['public']['Tables']['apartments']['Row'];

// Form interface
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

// Extended Person type with joined data
type Person = ProfileRow & {
  is_resident?: boolean;
  is_owner?: boolean;
  apartment_number?: string;
  apartment_floor?: number | null;
  apartment_id?: string;
  resident_id?: string;
};

// Vehicle type from database - keep null values as they come from DB
type Vehicle = Omit<VehicleRow, 'type' | 'ownership_type'> & {
  type: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other';
  ownership_type: 'visita' | 'proprietario';
};

const relationOptions = {
  familiar: ['Cônjuge', 'Familia', 'Funcionário'],
  funcionario: ['Empregada doméstica', 'Babá', 'Cuidador(a)', 'Outro funcionário'],
  autorizado: ['Amigo', 'Prestador de serviço', 'Outro autorizado'],
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

export function CadastroTabContent() {
  const { user } = useAuth();

  // Estados do formulário
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [userIsOwner, setUserIsOwner] = useState(false);

  // Estados para veículos
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Carregar pessoas cadastradas
  useEffect(() => {
    if (user && isRegularUser(user) && user.building_id) {
      fetchPeople();
      fetchVehicles();
    }
  }, [user]);

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
      if (!user.id) {
        console.error('❌ DEBUG: profile_id não encontrado');
        throw new Error('Informações do perfil não encontradas');
      }
      const { data: userApartmentData, error: userApartmentError } = await supabase
        .from('apartment_residents')
        .select(
          `
          apartment_id,
          apartments!inner (
            building_id
          )
        `
        )
        .eq('profile_id', user.id)
        .maybeSingle();

      console.log('🔍 DEBUG: Resultado da busca do building_id do usuário:', {
        data: userApartmentData,
        error: userApartmentError,
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
        .select(
          `
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
        `
        )
        .eq('apartments.building_id', userBuildingId);

      if (error) throw error;

      // Transformar os dados para o formato esperado
      const transformedPeople: Person[] = (residentsData || []).map((resident: any) => ({
        ...resident.profiles,
        created_at: resident.created_at,
        is_resident: true,
        is_owner: resident.is_owner,
        apartment_number: resident.apartments.number,
        apartment_floor: resident.apartments.floor,
        apartment_id: resident.apartment_id,
        resident_id: resident.id,
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
        const sameApartmentPeople = transformedPeople.filter(
          (person) => person.apartment_id === userResident.apartment_id
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
      if (!user.id) {
        console.error('User profile_id não encontrado');
        return;
      }
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
        .eq('ownership_type', 'proprietario')
        .order('created_at', { ascending: false });

      if (vehiclesError) {
        console.error('Erro ao buscar veículos:', vehiclesError);
        return;
      }

      // Transform vehicles to match Vehicle type
      const transformedVehicles: Vehicle[] = (vehiclesData || []).map((v) => ({
        ...v,
        type: (v.type as Vehicle['type']) || 'car',
        ownership_type: v.ownership_type as 'visita' | 'proprietario',
      }));
      setVehicles(transformedVehicles);
    } catch (error) {
      console.error('Erro ao buscar veículos:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o veículo ${formatLicensePlate(vehicle.license_plate)}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);

              if (error) {
                console.error('Erro ao excluir veículo:', error);
                alert('Erro ao excluir veículo. Tente novamente.');
                return;
              }

              // Remover veículo da lista local
              setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
              alert('Veículo excluído com sucesso!');
            } catch (error) {
              console.error('Erro ao excluir veículo:', error);
              alert('Erro ao excluir veículo. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  // Função para remover pessoa
  const handleDelete = (person: Person) => {
    Alert.alert('Confirmar exclusão', `Deseja realmente excluir ${person.full_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            // Remover de apartment_residents se for residente
            if (person.is_resident && person.resident_id) {
              await supabase.from('apartment_residents').delete().eq('id', person.resident_id);
            }

            // Remover profile
            const { error } = await supabase.from('profiles').delete().eq('id', person.id);

            if (error) throw error;

            Alert.alert('Sucesso', 'Pessoa removida com sucesso!');
            fetchPeople();
          } catch (error) {
            console.error('Erro ao remover pessoa:', error);
            Alert.alert('Erro', 'Não foi possível remover a pessoa');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
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
                onPress={() => router.push('/morador/person-form')}>
                <Text style={styles.buttonEmoji}>👤</Text>
                <Text style={styles.primaryButtonText}>Nova Pessoa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, styles.halfButton]}
                onPress={() => router.push('/morador/owner-vehicle')}>
                <Text style={styles.buttonEmoji}>🚗</Text>
                <Text style={styles.primaryButtonText}>Novo Veículo</Text>
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
                    <Text style={styles.emptyText}>
                      Nenhuma pessoa cadastrada neste apartamento
                    </Text>
                  </View>
                ) : (
                  people.map((person) => {
                    const isCurrentUser = person.id === user?.id;
                    return (
                      <View
                        key={person.id}
                        style={[styles.personCard, isCurrentUser && styles.currentUserCard]}>
                        <Text style={styles.personName}>
                          {person.full_name}
                          {isCurrentUser && ' (Você)'}
                        </Text>
                        <Text style={styles.personRelation}>
                          {person.user_type === 'funcionario'
                            ? '👷 Funcionário'
                            : person.is_resident
                              ? person.is_owner
                                ? '🏠 Proprietário'
                                : '👨‍👩‍👧‍👦 Morador'
                              : '👥 Familiar'}
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
                              style={styles.deleteButton}
                              onPress={() => handleDelete(person)}>
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
                      <View>
                        <Text style={styles.vehiclePlate}>
                          {formatLicensePlate(vehicle.license_plate || '')}
                        </Text>
                        <Text style={styles.vehicleInfo}>
                          Tipo: {vehicle.type === 'car' ? 'Carro' : 'Moto'}
                        </Text>
                        {(vehicle.brand || vehicle.model) && (
                          <View style={styles.vehicleDetailsRow}>
                            {vehicle.brand && (
                              <Text style={styles.vehicleDetails}>Marca: {vehicle.brand}</Text>
                            )}
                            {vehicle.model && (
                              <Text style={styles.vehicleDetails}>Modelo: {vehicle.model}</Text>
                            )}
                          </View>
                        )}
                        {vehicle.color && (
                          <Text style={styles.vehicleColor}>🎨Cor: {vehicle.color}</Text>
                        )}
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteVehicle(vehicle)}>
                          <Text style={styles.deleteButtonText}>🗑️ Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export default function CadastroScreen() {
  return (
    <CadastroTabContent />
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  section: {
    // backgroundColor: '#fff',
    padding: 20,
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
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
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
    opacity: 0.5,
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
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
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
  vehicleDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#4CAF50',
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
  buttonEmoji: {
    fontSize: 18,
    color: '#fff',
    marginRight: 8,
  },
});
