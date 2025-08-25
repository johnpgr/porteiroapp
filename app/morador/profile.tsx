import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '~/hooks/useAuth';
import { flattenStyles } from '~/utils/styles';
import BottomNav from '~/components/BottomNav';

interface MoradorProfileData {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date: string;
  apartment_number: string;
  building_id: string;
  avatar_url: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export default function MoradorProfile() {
  const { user, signOut } = useAuth();
  const [, setProfile] = useState<MoradorProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    birth_date: '',
    apartment_number: '',
    avatar_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchProfile = useCallback(async () => {
    try {
      console.log('🔍 DEBUG - User obtido:', user?.id);
      
      if (!user?.id) {
        console.log('❌ DEBUG - Usuário não autenticado');
        return;
      }

      // Log para debug - verificar todos os perfis existentes
      console.log('🔍 DEBUG - Buscando todos os perfis para debug...');
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');
      
      console.log('📊 DEBUG - Todos os perfis na tabela:', allProfiles);
      console.log('📊 DEBUG - Erro ao buscar todos os perfis:', allProfilesError);

      // First get profile by user_id
      console.log('🔍 DEBUG - Executando query para buscar perfil do usuário:', user.id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('📊 DEBUG - Dados do perfil retornados:', profileData);
      console.log('❌ DEBUG - Erro do perfil:', profileError);

      if (profileError) {
        console.error('❌ Erro detalhado ao buscar perfil:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          user_id_buscado: user.id
        });
        Alert.alert('Erro', `Perfil não encontrado. Verifique se seu cadastro está completo. ${profileError.message}`);
        return;
      }

      // Then get apartment info using apartment_residents table
      console.log('🏠 DEBUG - Buscando informações do apartamento para profile_id:', profileData.id);
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select(`
          apartments!inner(
            number,
            building_id
          )
        `)
        .eq('profile_id', profileData.id)
        .single();

      console.log('🏠 DEBUG - Dados do apartamento retornados:', apartmentData);
      console.log('❌ DEBUG - Erro do apartamento:', apartmentError);

      const data = {
         ...profileData,
         apartments: apartmentData?.apartments || null
       };

       if (apartmentError) {
         console.warn('❌ Aviso ao buscar apartamento:', apartmentError);
         // Continue mesmo se não encontrar apartamento
       }

      const profileDataMapped: MoradorProfileData = {
        id: data.id,
        user_id: data.user_id,
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        apartment_number: data.apartments?.number || '',
        building_id: data.apartments?.building_id || '',
        avatar_url: data.avatar_url || '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_phone: data.emergency_contact_phone || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      console.log('✅ DEBUG - Perfil mapeado com sucesso:', profileDataMapped);
      setProfile(profileDataMapped);
      setFormData({
        full_name: profileDataMapped.full_name,
        email: profileDataMapped.email,
        phone: profileDataMapped.phone,
        cpf: profileDataMapped.cpf,
        birth_date: profileDataMapped.birth_date,
        apartment_number: profileDataMapped.apartment_number,
        avatar_url: profileDataMapped.avatar_url,
        emergency_contact_name: profileDataMapped.emergency_contact_name || '',
        emergency_contact_phone: profileDataMapped.emergency_contact_phone || '',
      });
    } catch (error) {
      console.error('❌ Erro geral ao buscar perfil:', {
        error,
        message: error.message,
        stack: error.stack
      });
      Alert.alert('Erro', `Erro interno do servidor: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      Alert.alert('Erro de Validação', 'Nome completo é obrigatório');
      return false;
    }
    if (formData.phone && !/^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/.test(formData.phone.replace(/\D/g, ''))) {
      Alert.alert('Erro de Validação', 'Formato de telefone inválido');
      return false;
    }
    if (formData.birth_date && !/^\d{2}\/\d{2}\/\d{4}$/.test(formData.birth_date)) {
      Alert.alert('Erro de Validação', 'Data de nascimento deve estar no formato DD/MM/AAAA');
      return false;
    }
    if (formData.emergency_contact_phone && !/^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/.test(formData.emergency_contact_phone.replace(/\D/g, ''))) {
      Alert.alert('Erro de Validação', 'Formato de telefone do contato de emergência inválido');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Erro', 'Usuário não autenticado');
        return;
      }

      if (!validateForm()) {
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          birth_date: formData.birth_date.trim(),
          avatar_url: formData.avatar_url,
          emergency_contact_name: formData.emergency_contact_name.trim(),
          emergency_contact_phone: formData.emergency_contact_phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        if (error.code === 'PGRST116') {
          Alert.alert('Erro', 'Perfil não encontrado');
        } else if (error.code === '23505') {
          Alert.alert('Erro', 'Dados duplicados encontrados');
        } else {
          Alert.alert('Erro', `Não foi possível salvar as alterações: ${error.message}`);
        }
        return;
      }

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setIsEditing(false);
      fetchProfile();
    } catch (err) {
      console.error('Erro interno:', err);
      Alert.alert('Erro', 'Erro interno do servidor');
    }
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFormData({ ...formData, avatar_url: result.assets[0].uri });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };

  const handleDeleteProfile = async () => {
    Alert.alert(
      'Excluir Perfil',
      'ATENÇÃO: Esta ação irá excluir permanentemente seu perfil e todos os dados associados. Esta ação não pode ser desfeita. Tem certeza que deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.id) {
                Alert.alert('Erro', 'Usuário não autenticado');
                return;
              }

              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('user_id', user.id);

              if (error) {
                console.error('Erro ao excluir perfil:', error);
                Alert.alert('Erro', `Não foi possível excluir o perfil: ${error.message}`);
                return;
              }

              Alert.alert('Sucesso', 'Perfil excluído com sucesso!', [
                {
                  text: 'OK',
                  onPress: async () => {
                    await signOut();
                    router.replace('/');
                  },
                },
              ]);
            } catch (err) {
              console.error('Erro interno:', err);
              Alert.alert('Erro', 'Erro interno do servidor');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert('Confirmar Logout', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/');
          } catch {
            Alert.alert('Erro', 'Falha ao fazer logout');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ProtectedRoute redirectTo="/morador/login" userType="morador">
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando perfil...</Text>
          </View>
        </SafeAreaView>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>👤 Meu Perfil</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => (isEditing ? handleSave() : setIsEditing(true))}>
              <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={isEditing ? handleImagePicker : undefined}>
                {formData.avatar_url ? (
                  <Image source={{ uri: formData.avatar_url }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={60} color="#ccc" />
                  </View>
                )}
                {isEditing && (
                  <View style={styles.photoOverlay}>
                    <Ionicons name="camera" size={24} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.photoLabel}>Foto do Perfil</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Informações Pessoais</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nome Completo</Text>
                <TextInput
                  style={flattenStyles([styles.input, !isEditing && styles.inputDisabled])}
                  value={formData.full_name}
                  onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                  editable={isEditing}
                  placeholder="Digite seu nome completo"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={flattenStyles([styles.input, styles.inputDisabled])}
                  value={formData.email}
                  editable={false}
                  placeholder="Email não pode ser alterado"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Telefone</Text>
                <TextInput
                  style={flattenStyles([styles.input, !isEditing && styles.inputDisabled])}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  editable={isEditing}
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CPF</Text>
                <TextInput
                  style={flattenStyles([styles.input, styles.inputDisabled])}
                  value={formData.cpf}
                  editable={false}
                  placeholder="CPF não pode ser alterado"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Data de Nascimento</Text>
                <TextInput
                  style={flattenStyles([styles.input, !isEditing && styles.inputDisabled])}
                  value={formData.birth_date}
                  onChangeText={(text) => setFormData({ ...formData, birth_date: text })}
                  editable={isEditing}
                  placeholder="DD/MM/AAAA"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏠 Informações do Apartamento</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Número do Apartamento</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={formData.apartment_number}
                  editable={false}
                  placeholder="Apartamento não pode ser alterado"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🚨 Contato de Emergência</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nome do Contato</Text>
                <TextInput
                  style={flattenStyles([styles.input, !isEditing && styles.inputDisabled])}
                  value={formData.emergency_contact_name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, emergency_contact_name: text })
                  }
                  editable={isEditing}
                  placeholder="Nome do contato de emergência"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Telefone do Contato</Text>
                <TextInput
                  style={flattenStyles([styles.input, !isEditing && styles.inputDisabled])}
                  value={formData.emergency_contact_phone}
                  onChangeText={(text) =>
                    setFormData({ ...formData, emergency_contact_phone: text })
                  }
                  editable={isEditing}
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProfile}>
                <Ionicons name="trash" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>Excluir Perfil</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out" size={20} color="#fff" />
                <Text style={styles.logoutButtonText}>Sair da Conta</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        <BottomNav activeTab="profile" />
      </SafeAreaView>
    </ProtectedRoute>
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
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    padding: 8,
  },
  photoLabel: {
    fontSize: 14,
    color: '#666',
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
    marginBottom: 15,
  },
  field: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  logoutButton: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
