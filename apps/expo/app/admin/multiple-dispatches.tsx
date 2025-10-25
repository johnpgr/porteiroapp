import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Modal } from '~/components/Modal';
import { router } from 'expo-router';
import { supabase, adminAuth } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import notificationService from '~/services/whatsappService';
import * as Crypto from 'expo-crypto';
import { supabaseAdmin } from '~/utils/supabase-admin';

// Interfaces
interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  number: string;
  building_id: string;
}

interface MultipleResident {
  name: string;
  phone: string;
  email: string;
  selectedBuildingId: string;
  selectedApartmentId: string;
}

interface ResidentData {
  name: string;
  phone: string;
  email: string;
  building: string;
  apartment: string;
  profile_id: string;
  temporary_password?: string;
}

// Função para validação de telefone brasileiro
const validateBrazilianPhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length === 10 || cleanPhone.length === 11;
};

// Função para formatar telefone brasileiro
const formatBrazilianPhone = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 11) {
    return `+55${cleanPhone}`;
  } else if (cleanPhone.length === 10) {
    return `+55${cleanPhone}`;
  }
  return phone;
};

// Função para validar email
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Função para gerar senha temporária
const generateTemporaryPassword = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Função para hash da senha
const hashPassword = async (password: string): Promise<string> => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
};

// Função para armazenar senha temporária
const storeTemporaryPassword = async (
  profileId: string,
  plainPassword: string,
  hashedPassword: string,
  phoneNumber: string
): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas

  const { error } = await supabase.from('temporary_passwords').insert({
    profile_id: profileId,
    password_hash: hashedPassword,
    plain_password: plainPassword,
    phone_number: phoneNumber,
    used: false,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw error;
  }
};

export default function MultipleDispatchesScreen() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Estados para múltiplos residentes
  const [multipleResidents, setMultipleResidents] = useState<MultipleResident[]>([
    { name: '', phone: '', email: '', selectedBuildingId: '', selectedApartmentId: '' },
  ]);

  // Estados para modais de seleção de prédios
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [buildingModalContext, setBuildingModalContext] = useState<{
    residentIndex: number;
  } | null>(null);

  // Estados para modais de seleção de apartamentos
  const [showApartmentModal, setShowApartmentModal] = useState(false);
  const [apartmentModalContext, setApartmentModalContext] = useState<{
    residentIndex: number;
  } | null>(null);

  useEffect(() => {
    fetchBuildings();
    fetchApartments();
  }, []);

  const fetchBuildings = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        Alert.alert('Erro', 'Usuário não autenticado');
        return;
      }

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
      setApartments((data || []) as unknown as Apartment[]);
    } catch (error) {
      console.error('Erro ao carregar apartamentos:', error);
    }
  };

  // Função para abrir modal de seleção de prédio
  const openBuildingModal = (residentIndex: number) => {
    setBuildingModalContext({ residentIndex });
    setShowBuildingModal(true);
  };

  // Função para selecionar prédio
  const handleBuildingSelect = (buildingId: string) => {
    if (buildingModalContext) {
      const updated = [...multipleResidents];
      updated[buildingModalContext.residentIndex] = {
        ...updated[buildingModalContext.residentIndex],
        selectedBuildingId: buildingId,
        selectedApartmentId: '', // Resetar apartamento quando mudar prédio
      };
      setMultipleResidents(updated);
    }
    setShowBuildingModal(false);
    setBuildingModalContext(null);
  };

  // Função para abrir modal de seleção de apartamento
  const openApartmentModal = (residentIndex: number) => {
    setApartmentModalContext({ residentIndex });
    setShowApartmentModal(true);
  };

  // Função para selecionar apartamento
  const handleApartmentSelect = (apartmentId: string) => {
    if (apartmentModalContext) {
      const updated = [...multipleResidents];
      updated[apartmentModalContext.residentIndex] = {
        ...updated[apartmentModalContext.residentIndex],
        selectedApartmentId: apartmentId,
      };
      setMultipleResidents(updated);
    }
    setShowApartmentModal(false);
    setApartmentModalContext(null);
  };

  const addMultipleResident = () => {
    setMultipleResidents([
      ...multipleResidents,
      { name: '', phone: '', email: '', selectedBuildingId: '', selectedApartmentId: '' },
    ]);
  };

  const removeMultipleResident = (index: number) => {
    if (multipleResidents.length > 1) {
      const updated = multipleResidents.filter((_, i) => i !== index);
      setMultipleResidents(updated);
    }
  };

  const updateMultipleResident = (index: number, field: keyof MultipleResident, value: string) => {
    const updated = [...multipleResidents];
    updated[index] = { ...updated[index], [field]: value };
    setMultipleResidents(updated);
  };

  const validateMultipleResidents = () => {
    const phoneNumbers = new Set();
    const apartmentIds = new Set();
    
    for (let i = 0; i < multipleResidents.length; i++) {
      const resident = multipleResidents[i];
      
      // Validação de nome
      if (!resident.name.trim()) {
        Alert.alert('Erro', `Morador ${i + 1}: Nome é obrigatório`);
        return false;
      }
      
      if (resident.name.trim().length < 2) {
        Alert.alert('Erro', `Morador ${i + 1}: Nome deve ter pelo menos 2 caracteres`);
        return false;
      }
      
      // Validação de telefone
      if (!resident.phone.trim()) {
        Alert.alert('Erro', `Morador ${i + 1}: Telefone é obrigatório`);
        return false;
      }
      
      if (!validateBrazilianPhone(resident.phone)) {
        Alert.alert('Erro', `Morador ${i + 1}: Formato de telefone inválido. Use (11) 99999-9999`);
        return false;
      }
      
      // Verificar telefones duplicados
      const formattedPhone = formatBrazilianPhone(resident.phone);
      if (phoneNumbers.has(formattedPhone)) {
        Alert.alert('Erro', `Morador ${i + 1}: Telefone duplicado na lista`);
        return false;
      }
      phoneNumbers.add(formattedPhone);
      
      // Validação de email
      if (!resident.email.trim()) {
        Alert.alert('Erro', `Morador ${i + 1}: Email é obrigatório`);
        return false;
      }
      
      if (!validateEmail(resident.email.trim())) {
        Alert.alert('Erro', `Morador ${i + 1}: Formato de email inválido`);
        return false;
      }
      
      // Validação de prédio
      if (!resident.selectedBuildingId) {
        Alert.alert('Erro', `Morador ${i + 1}: Selecione um prédio`);
        return false;
      }
      
      // Validação de apartamento
      if (!resident.selectedApartmentId) {
        Alert.alert('Erro', `Morador ${i + 1}: Selecione um apartamento`);
        return false;
      }
      
      // Verificar apartamentos duplicados
      if (apartmentIds.has(resident.selectedApartmentId)) {
        Alert.alert('Erro', `Apartamento duplicado na lista (Morador ${i + 1})`);
        return false;
      }
      apartmentIds.add(resident.selectedApartmentId);
      
      // Validar se o apartamento pertence ao prédio selecionado
      const apartment = apartments.find(apt => apt.id === resident.selectedApartmentId);
      if (apartment && apartment.building_id !== resident.selectedBuildingId) {
        Alert.alert('Erro', `Morador ${i + 1}: Apartamento não pertence ao prédio selecionado`);
        return false;
      }
    }
    
    return true;
  };

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
          
          if (processedPhones.has(formattedPhone)) {
            errors.push(`${resident.name}: Telefone duplicado interno`);
            errorCount++;
            continue;
          }
          
          // Verificar se já existe no banco de dados
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('phone', formattedPhone as any)
            .single();
            
          if (existingProfile && 'full_name' in existingProfile) {
            errors.push(`${resident.name}: Telefone já cadastrado para ${existingProfile.full_name}`);
            errorCount++;
            continue;
          }
          
          processedPhones.add(formattedPhone);
          validatedResidents.push({ ...resident, formattedPhone });
          
        } catch (validationError) {
          errorCount++;
          errors.push(`${resident.name}: Erro na validação - ${validationError instanceof Error ? validationError.message : 'Erro desconhecido'}`);
        }
      }

      if (validatedResidents.length === 0) {
        Alert.alert('Erro', 'Nenhum usuário válido para processar');
        return;
      }

      // Segunda fase: Criação individual com sequência correta
      setProcessingStatus(`Processando ${validatedResidents.length} usuários individualmente...`);
      const usersWithPasswords = [];
      
      for (let i = 0; i < validatedResidents.length; i++) {
        const resident = validatedResidents[i];
        setProcessingStatus(`Processando ${resident.name} (${i + 1}/${validatedResidents.length})...`);
        
        try {
          // Gerar senha temporária
          const temporaryPassword = generateTemporaryPassword();
          const hashedPassword = await hashPassword(temporaryPassword);

          // Criar usuário no Supabase Auth
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: resident.email,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              full_name: resident.name,
              user_type: 'morador'
            }
          });

          if (authError) {
            throw new Error(`Erro ao criar login: ${authError.message}`);
          }

          if (!authData.user) {
            throw new Error('Falha ao criar usuário de autenticação');
          }

          // Criar perfil na tabela profiles
          const profileData = {
            user_id: authData.user.id,
            full_name: resident.name,
            phone: resident.formattedPhone,
            email: resident.email,
            role: 'morador',
            user_type: 'morador',
            building_id: resident.selectedBuildingId,
            temporary_password_used: false,
          };

          const { data: insertedUser, error: profileError } = await supabase
            .from('profiles')
            .insert(profileData as any)
            .select()
            .single();

          if (profileError) {
            console.error('Erro ao criar perfil:', profileError);
            // Fazer rollback do usuário auth
            try {
              await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            } catch (deleteError) {
              console.error('Erro ao deletar usuário do auth:', deleteError);
            }
            throw new Error(`Erro ao criar perfil: ${profileError.message}`);
          }

          // Verificar se o usuário foi inserido corretamente
          if (!insertedUser || !('id' in insertedUser)) {
            throw new Error('Falha ao criar perfil do usuário');
          }

          // Armazenar senha temporária
          await storeTemporaryPassword((insertedUser as any).id, temporaryPassword, hashedPassword, resident.formattedPhone);

          // Adicionar senha temporária ao objeto para uso no WhatsApp
          (insertedUser as any).temporary_password = temporaryPassword;
          (insertedUser as any).user_id = authData.user.id;

          usersWithPasswords.push({ user: insertedUser as any, resident, temporaryPassword });
          successCount++;
          
        } catch (userError) {
          errorCount++;
          const errorMessage = userError instanceof Error ? userError.message : 'Erro desconhecido';
          errors.push(`${resident.name}: ${errorMessage}`);
          console.error(`Erro ao processar usuário ${resident.name}:`, userError);
        }
      }

      // Terceira fase: Inserção em lote das associações de apartamentos
      setProcessingStatus('Associando apartamentos em lote...');
      const apartmentAssociations = usersWithPasswords.map(({ user, resident }) => ({
        profile_id: user.id,
        apartment_id: resident.selectedApartmentId,
        relationship: 'resident',
        is_primary: false,
      }));
      
      const { data: insertedAssociations, error: associationsError } = await supabase
        .from('apartment_residents')
        .insert(apartmentAssociations as any)
        .select();

      if (associationsError) {
        console.error('Erro na inserção em lote de apartamentos:', associationsError);
        // Se falhar em lote, tentar individualmente
        for (let i = 0; i < usersWithPasswords.length; i++) {
          const { user, resident } = usersWithPasswords[i];
          try {
            const { error: individualAssocError } = await supabase
              .from('apartment_residents')
              .insert({
                profile_id: user.id,
                apartment_id: resident.selectedApartmentId,
                relationship: 'resident',
                is_primary: false,
              } as any);
            
            if (individualAssocError) {
              throw individualAssocError;
            }
            
            successfulUsers.push({ user, resident });
          } catch (indivError) {
            errorCount++;
            errors.push(`${resident.name}: Erro ao associar apartamento - ${indivError instanceof Error ? indivError.message : 'Erro desconhecido'}`);
          }
        }
      } else {
        // Sucesso na inserção em lote
        console.log('Apartamentos associados em lote:', insertedAssociations?.length);
        usersWithPasswords.forEach(({ user, resident }) => {
          successfulUsers.push({ user, resident });
        });
      }

      // Quarta fase: Envio de WhatsApp em lote (sempre ativado)
      if (successfulUsers.length > 0) {
        setProcessingStatus('Preparando notificações WhatsApp em lote...');
        
        try {
          for (const { user, resident } of successfulUsers) {
            setProcessingStatus(`Enviando WhatsApp para ${resident.name}...`);
            
            const apartment = apartments.find(apt => apt.id === resident.selectedApartmentId);
            const building = buildings.find(b => b.id === resident.selectedBuildingId);
            
            if (apartment && building) {
              const residentDataWithPassword: ResidentData = {
                name: resident.name,
                phone: resident.formattedPhone,
                email: resident.email,
                building: building.name,
                apartment: apartment.number,
                profile_id: user.id,
                temporary_password: user.temporary_password
              };

              const whatsappResult = await notificationService.sendResidentWhatsApp(residentDataWithPassword);
              if (!whatsappResult.success) {
                errors.push(`${resident.name}: WhatsApp - ${whatsappResult.error}`);
              }
            }
          }
        } catch (whatsappError) {
          console.error('Erro geral no envio de WhatsApp:', whatsappError);
          errors.push('Erro geral no envio de WhatsApp em lote');
        }
      }

      // Mostrar resultado detalhado
      setProcessingStatus('Processamento concluído!');
      
      let message = `Processamento de ${multipleResidents.length} usuários concluído!\n\n`;
      message += `✅ Sucessos: ${successCount}\n`;
      message += `❌ Erros: ${errorCount}`;
      
      if (errors.length > 0) {
        message += `\n\n📋 Detalhes dos erros:`;
        message += `\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n... e mais ${errors.length - 5} erros`;
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
      }
    } catch (error) {
      console.error('Erro geral:', error);
      Alert.alert('Erro', `Erro ao processar cadastros: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  if (loading && !isProcessing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Carregando dados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>👥 Múltiplos Disparos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>



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
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={resident.email}
                onChangeText={(value) => updateMultipleResident(index, 'email', value)}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prédio *</Text>
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => openBuildingModal(index)}
              >
                <Text style={[styles.dropdownText, !resident.selectedBuildingId && styles.placeholderText]}>
                  {resident.selectedBuildingId 
                    ? buildings.find(b => b.id === resident.selectedBuildingId)?.name || 'Selecione um prédio'
                    : 'Selecione um prédio'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {resident.selectedBuildingId && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Apartamento *</Text>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => openApartmentModal(index)}
                >
                  <Text style={[styles.dropdownText, !resident.selectedApartmentId && styles.placeholderText]}>
                    {resident.selectedApartmentId 
                      ? apartments.find(a => a.id === resident.selectedApartmentId)?.number || 'Selecione um apartamento'
                      : 'Selecione um apartamento'
                    }
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Botão de processar */}
        <TouchableOpacity
          style={[styles.processButton, isProcessing && styles.disabledButton]}
          onPress={handleMultipleResidents}
          disabled={isProcessing}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.processButtonText}>📤 Processar Múltiplos Disparos</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Status de Processamento */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.processingText}>{processingStatus}</Text>
          </View>
        </View>
      </Modal>

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
                onPress={() => handleBuildingSelect(building.id)}
              >
                <Text style={styles.buildingOptionText}>{building.name}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de Seleção de Apartamentos */}
      <Modal visible={showApartmentModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowApartmentModal(false)}>
              <Text style={styles.closeButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Selecionar Apartamento</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {apartmentModalContext && apartments
              .filter(apartment => {
                const resident = multipleResidents[apartmentModalContext.residentIndex];
                return apartment.building_id === resident.selectedBuildingId;
              })
              .map((apartment) => (
                <TouchableOpacity
                  key={apartment.id}
                  style={styles.buildingOption}
                  onPress={() => handleApartmentSelect(apartment.id)}
                >
                  <Text style={styles.buildingOptionText}>Apartamento {apartment.number}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              ))
            }
          </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },

  residentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  residentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  residentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  residentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    fontSize: 20,
    color: '#007AFF',
    padding: 4,
  },
  removeButton: {
    fontSize: 20,
    color: '#FF3B30',
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  processButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  processButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  processingModal: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    margin: 40,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  buildingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  buildingOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});
