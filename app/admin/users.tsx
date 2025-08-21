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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'porteiro' | 'morador';
  cpf?: string;
  phone?: string;
  email?: string;
  building_id?: string;
  apartment_id?: string;
  photo_url?: string;
  last_login?: string;
  created_at: string;
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
    role: 'morador' as 'admin' | 'porteiro' | 'morador',
    cpf: '',
    phone: '',
    email: '',
    building_id: '',
    apartment_id: '',
    photo_url: '',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchBuildings();
    fetchApartments();
  }, [fetchUsers, fetchBuildings, fetchApartments]);

  useEffect(() => {
    if (newUser.building_id) {
      const filtered = apartments.filter((apt) => apt.building_id === newUser.building_id);
      console.log('🏢 Prédio selecionado:', newUser.building_id);
      console.log('🔍 Total de apartamentos disponíveis:', apartments.length);
      console.log('✅ Apartamentos filtrados para este prédio:', filtered.length);
      console.log('📝 Lista filtrada:', filtered);
      setFilteredApartments(filtered);
      setNewUser((prev) => ({ ...prev, apartment_id: '' }));
    } else {
      setFilteredApartments([]);
    }
  }, [newUser.building_id, apartments]);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, filterUsers]);

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.cpf?.includes(searchQuery) ||
        user.phone?.includes(searchQuery) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase.from('buildings').select('*').order('name');

      if (error) throw error;
      setBuildings(data || []);
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

  const handleAddUser = async () => {
    if (!newUser.name) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }

    if (newUser.role === 'morador' || newUser.role === 'porteiro') {
      if (!newUser.cpf || !newUser.phone || !newUser.email) {
        Alert.alert('Erro', 'CPF, telefone e email são obrigatórios');
        return;
      }
      if (!newUser.building_id) {
        Alert.alert('Erro', 'Prédio é obrigatório');
        return;
      }
      if (newUser.role === 'morador' && !newUser.apartment_id) {
        Alert.alert('Erro', 'Apartamento é obrigatório para moradores');
        return;
      }
    }

    try {
      const userData: any = {
        name: newUser.name,
        role: newUser.role,
        password: newUser.password || null,
      };

      if (newUser.role === 'morador' || newUser.role === 'porteiro') {
        userData.cpf = newUser.cpf;
        userData.phone = newUser.phone;
        userData.email = newUser.email;
        userData.building_id = newUser.building_id;
        userData.photo_url = newUser.photo_url;

        if (newUser.role === 'morador') {
          userData.apartment_id = newUser.apartment_id;
        }
      }

      const { error } = await supabase.from('users').insert(userData);

      if (error) throw error;

      Alert.alert('Sucesso', 'Usuário criado com sucesso');
      setNewUser({
        name: '',
        role: 'morador',
        cpf: '',
        phone: '',
        email: '',
        building_id: '',
        apartment_id: '',
        photo_url: '',
        password: '',
      });
      setShowAddForm(false);
      fetchUsers();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar usuário');
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
            const { error } = await supabase.from('users').delete().eq('id', userId);

            if (error) throw error;
            fetchUsers();
          } catch (error) {
            Alert.alert('Erro', 'Falha ao excluir usuário');
          }
        },
      },
    ]);
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
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
          <Text style={styles.addButtonText}>
            {showAddForm ? '❌ Cancelar' : '➕ Novo Usuário'}
          </Text>
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Buscar por nome, email, CPF, telefone ou tipo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => filterUsers()}>
            <Text style={styles.searchButtonText}>🔍 Procurar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showAddForm && (
        <ScrollView style={styles.addForm}>
          <Text style={styles.formTitle}>Novo Usuário</Text>

          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            value={newUser.name}
            onChangeText={(text) => setNewUser((prev) => ({ ...prev, name: text }))}
          />

          <View style={styles.roleSelector}>
            <Text style={styles.roleLabel}>Tipo de usuário:</Text>
            <View style={styles.roleButtons}>
              {['morador', 'porteiro', 'admin'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    newUser.role === role && styles.roleButtonActive,
                    { borderColor: getRoleColor(role) },
                  ]}
                  onPress={() => setNewUser((prev) => ({ ...prev, role: role as any }))}>
                  <Text
                    style={[
                      styles.roleButtonText,
                      newUser.role === role && { color: getRoleColor(role) },
                    ]}>
                    {getRoleIcon(role)} {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {(newUser.role === 'morador' || newUser.role === 'porteiro') && (
            <>
              <TextInput
                style={styles.input}
                placeholder="CPF"
                value={newUser.cpf}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, cpf: text }))}
                keyboardType="numeric"
                maxLength={14}
              />

              <TextInput
                style={styles.input}
                placeholder="Telefone"
                value={newUser.phone}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={newUser.email}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Prédio:</Text>
                <Picker
                  selectedValue={newUser.building_id}
                  style={styles.picker}
                  onValueChange={(itemValue) =>
                    setNewUser((prev) => ({ ...prev, building_id: itemValue }))
                  }>
                  <Picker.Item label="Selecione um prédio" value="" />
                  {buildings.map((building) => (
                    <Picker.Item key={building.id} label={building.name} value={building.id} />
                  ))}
                </Picker>
              </View>

              {newUser.role === 'morador' && newUser.building_id && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Apartamento:</Text>
                  <Picker
                    selectedValue={newUser.apartment_id}
                    style={styles.picker}
                    onValueChange={(itemValue) =>
                      setNewUser((prev) => ({ ...prev, apartment_id: itemValue }))
                    }>
                    <Picker.Item label="Selecione um apartamento" value="" />
                    {filteredApartments.map((apartment) => (
                      <Picker.Item
                        key={apartment.id}
                        label={apartment.number}
                        value={apartment.id}
                      />
                    ))}
                  </Picker>
                </View>
              )}

              <View style={styles.photoSection}>
                <Text style={styles.photoLabel}>Foto do usuário:</Text>
                <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                  <Text style={styles.photoButtonText}>📷 Selecionar Foto</Text>
                </TouchableOpacity>
                {newUser.photo_url && (
                  <Image source={{ uri: newUser.photo_url }} style={styles.photoPreview} />
                )}
              </View>
            </>
          )}

          {newUser.role !== 'morador' && (
            <TextInput
              style={styles.input}
              placeholder="Senha (opcional)"
              value={newUser.password}
              onChangeText={(text) => setNewUser((prev) => ({ ...prev, password: text }))}
              secureTextEntry
            />
          )}

          <TouchableOpacity style={styles.submitButton} onPress={handleAddUser}>
            <Text style={styles.submitButtonText}>✅ Criar Usuário</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

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
                {user.cpf && <Text style={styles.userInfo}>CPF: {user.cpf}</Text>}
                {user.phone && <Text style={styles.userInfo}>Tel: {user.phone}</Text>}
                {user.email && <Text style={styles.userInfo}>Email: {user.email}</Text>}
                <Text style={[styles.userRole, { color: getRoleColor(user.role) }]}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Text>
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
    marginBottom: 15,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    padding: 10,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#f0f0f0',
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 5,
    color: '#333',
  },
  picker: {
    height: 50,
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
});
