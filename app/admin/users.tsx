import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { Container } from '~/components/Container';
import { supabase } from '~/utils/supabase';

interface User {
  id: string;
  name: string;
  code: string;
  role: 'admin' | 'porteiro' | 'morador';
  apartment_id?: string;
  last_login?: string;
  created_at: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    code: '',
    role: 'morador' as 'admin' | 'porteiro' | 'morador',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.code) {
      Alert.alert('Erro', 'Nome e código são obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .insert({
          name: newUser.name,
          code: newUser.code,
          role: newUser.role,
          password: newUser.password || null,
        });

      if (error) throw error;

      Alert.alert('Sucesso', 'Usuário criado com sucesso');
      setNewUser({ name: '', code: '', role: 'morador', password: '' });
      setShowAddForm(false);
      fetchUsers();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar usuário');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja excluir o usuário ${userName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

              if (error) throw error;
              fetchUsers();
            } catch (error) {
              Alert.alert('Erro', 'Falha ao excluir usuário');
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#9C27B0';
      case 'porteiro': return '#2196F3';
      case 'morador': return '#4CAF50';
      default: return '#666';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return '👨‍💼';
      case 'porteiro': return '🛡️';
      case 'morador': return '🏠';
      default: return '👤';
    }
  };

  if (loading) {
    return (
      <Container>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando usuários...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>👥 Gerenciar Usuários</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Text style={styles.addButtonText}>
              {showAddForm ? '❌ Cancelar' : '➕ Novo Usuário'}
            </Text>
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Novo Usuário</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              value={newUser.name}
              onChangeText={(text) => setNewUser(prev => ({ ...prev, name: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Código de acesso"
              value={newUser.code}
              onChangeText={(text) => setNewUser(prev => ({ ...prev, code: text }))}
              keyboardType="numeric"
              maxLength={6}
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
                      { borderColor: getRoleColor(role) }
                    ]}
                    onPress={() => setNewUser(prev => ({ ...prev, role: role as any }))}
                  >
                    <Text style={[
                      styles.roleButtonText,
                      newUser.role === role && { color: getRoleColor(role) }
                    ]}>
                      {getRoleIcon(role)} {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {newUser.role !== 'morador' && (
              <TextInput
                style={styles.input}
                placeholder="Senha (opcional)"
                value={newUser.password}
                onChangeText={(text) => setNewUser(prev => ({ ...prev, password: text }))}
                secureTextEntry
              />
            )}
            
            <TouchableOpacity style={styles.submitButton} onPress={handleAddUser}>
              <Text style={styles.submitButtonText}>✅ Criar Usuário</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.usersList}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userIcon}>{getRoleIcon(user.role)}</Text>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userCode}>Código: {user.code}</Text>
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
                onPress={() => handleDeleteUser(user.id, user.name)}
              >
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
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
});