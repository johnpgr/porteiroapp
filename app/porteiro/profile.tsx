import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Container } from '~/components/Container';
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '~/hooks/useAuth';

export default function PorteiroProfile() {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<PorteiroProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    birth_date: '',
    address: '',
    avatar_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    work_schedule: '',
  });
  const [loading, setLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ Usuário não autenticado');
        return;
      }

      console.log('🔍 Buscando perfil do porteiro para user_id:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_type', 'porteiro')
        .single();

      if (error) {
        console.error('❌ Erro na query do perfil:', error);
        if (error.code === 'PGRST116') {
          Alert.alert('Perfil não encontrado', 'Nenhum perfil de porteiro foi encontrado para este usuário.');
        } else if (error.message.includes('permission denied')) {
          Alert.alert('Erro de Permissão', 'Você não tem permissão para acessar este perfil.');
        } else {
          Alert.alert('Erro', `Falha ao carregar perfil: ${error.message}`);
        }
        return;
      }

      console.log('✅ Perfil encontrado:', data);

      if (!data) {
        Alert.alert('Perfil não encontrado', 'Nenhum perfil de porteiro foi encontrado.');
        return;
      }

      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        address: data.address || '',
        avatar_url: data.avatar_url || '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_phone: data.emergency_contact_phone || '',
        work_schedule: data.work_schedule || '',
      });
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar perfil:', error);
      if (error.message.includes('network') || error.message.includes('fetch')) {
        Alert.alert('Erro de Conexão', 'Verifique sua conexão com a internet e tente novamente.');
      } else if (error.message.includes('timeout')) {
        Alert.alert('Timeout', 'A operação demorou muito para responder. Tente novamente.');
      } else {
        Alert.alert('Erro Inesperado', 'Ocorreu um erro inesperado ao carregar o perfil.');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    // Validação do nome completo
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      Alert.alert('Erro de Validação', 'Nome completo deve ter pelo menos 2 caracteres');
      return false;
    }

    // Validação do telefone
    const phoneRegex = /^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/;
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
      Alert.alert('Erro de Validação', 'Formato de telefone inválido');
      return false;
    }

    // Validação da data de nascimento (formato DD/MM/AAAA)
    if (formData.birth_date) {
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(formData.birth_date)) {
        Alert.alert('Erro de Validação', 'Data de nascimento deve estar no formato DD/MM/AAAA');
        return false;
      }

      const [day, month, year] = formData.birth_date.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      const now = new Date();
      
      if (date > now) {
        Alert.alert('Erro de Validação', 'Data de nascimento não pode ser no futuro');
        return false;
      }

      if (year < 1900 || year > now.getFullYear()) {
        Alert.alert('Erro de Validação', 'Ano de nascimento inválido');
        return false;
      }
    }

    // Validação do telefone de emergência
    if (formData.emergency_contact_phone && !phoneRegex.test(formData.emergency_contact_phone.replace(/\D/g, ''))) {
      Alert.alert('Erro de Validação', 'Formato de telefone de emergência inválido');
      return false;
    }

    // Validação do nome do contato de emergência
    if (formData.emergency_contact_phone && (!formData.emergency_contact_name || formData.emergency_contact_name.trim().length < 2)) {
      Alert.alert('Erro de Validação', 'Nome do contato de emergência é obrigatório quando telefone é informado');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!profile) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado');
        return;
      }

      console.log('💾 Salvando perfil do porteiro para user_id:', user.id);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          cpf: formData.cpf,
          birth_date: formData.birth_date,
          address: formData.address,
          avatar_url: formData.avatar_url,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          work_schedule: formData.work_schedule,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('user_type', 'porteiro');

      if (error) {
        console.error('❌ Erro ao salvar perfil:', error);
        if (error.code === 'PGRST116') {
          Alert.alert('Perfil não encontrado', 'Perfil não encontrado para atualização.');
        } else if (error.message.includes('permission denied')) {
          Alert.alert('Erro de Permissão', 'Você não tem permissão para atualizar este perfil.');
        } else if (error.message.includes('duplicate')) {
          Alert.alert('Dados Duplicados', 'Alguns dados já estão em uso por outro usuário.');
        } else if (error.message.includes('violates check constraint')) {
          Alert.alert('Dados Inválidos', 'Alguns dados não atendem aos critérios de validação.');
        } else {
          Alert.alert('Erro', `Falha ao salvar: ${error.message}`);
        }
        return;
      }

      console.log('✅ Perfil atualizado com sucesso');
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
      setIsEditing(false);
      fetchProfile();
    } catch (saveError) {
      console.error('❌ Erro inesperado ao salvar:', saveError);
      Alert.alert('Erro Inesperado', 'Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        cpf: profile.cpf || '',
        birth_date: profile.birth_date || '',
        address: profile.address || '',
        avatar_url: profile.avatar_url || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        work_schedule: profile.work_schedule || '',
      });
    }
  };

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erro', 'Permissão para acessar galeria é necessária');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData({ ...formData, avatar_url: result.assets[0].uri });
    }
  };

  const handleDeleteProfile = async () => {
    Alert.alert(
      'Excluir Perfil',
      'Esta ação é irreversível. Tem certeza que deseja excluir permanentemente seu perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Erro', 'Usuário não autenticado');
                return;
              }

              console.log('🗑️ Excluindo perfil do porteiro para user_id:', user.id);
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('user_id', user.id)
                .eq('user_type', 'porteiro');

              if (error) {
                console.error('❌ Erro ao excluir perfil:', error);
                throw error;
              }

              console.log('✅ Perfil excluído com sucesso');
              Alert.alert('Sucesso', 'Perfil excluído com sucesso', [
                {
                  text: 'OK',
                  onPress: async () => {
                    await signOut();
                    router.replace('/porteiro/login');
                  },
                },
              ]);
            } catch (error) {
              console.error('❌ Erro ao excluir perfil:', error);
              Alert.alert('Erro', 'Falha ao excluir perfil');
            }
          },
        },
      ]
    );
  };

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
    };
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Erro', 'Todos os campos de senha são obrigatórios.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Erro', 'A nova senha e a confirmação não coincidem.');
      return;
    }

    const validation = validatePassword(passwordData.newPassword);
    if (!validation.isValid) {
      Alert.alert('Erro', 'A nova senha não atende aos critérios de segurança.');
      return;
    }

    setPasswordLoading(true);
    try {
      // Verificar senha atual tentando fazer login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: passwordData.currentPassword
      });

      if (signInError) {
        Alert.alert('Erro', 'Senha atual incorreta.');
        setPasswordLoading(false);
        return;
      }

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) {
        Alert.alert('Erro', 'Não foi possível alterar a senha: ' + updateError.message);
      } else {
        Alert.alert('Sucesso', 'Senha alterada com sucesso!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordSection(false);
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado.');
    } finally {
      setPasswordLoading(false);
    }
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
            router.replace('/porteiro/login');
          } catch {
            Alert.alert('Erro', 'Falha ao fazer logout');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ProtectedRoute redirectTo="/porteiro/login" userType="porteiro">
        <Container>
          <View style={styles.loadingContainer}>
            <Text>Carregando perfil...</Text>
          </View>
        </Container>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute redirectTo="/porteiro/login" userType="porteiro">
      <Container>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Meu Perfil</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => (isEditing ? handleSave() : setIsEditing(true))}>
              <Text style={styles.editButtonText}>{isEditing ? 'Salvar' : 'Editar'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Profile Card */}
            <View style={styles.profileCard}>
              {/* Photo Section */}
              <View style={styles.photoContainer}>
                {formData.avatar_url ? (
                  <Image source={{ uri: formData.avatar_url }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.defaultPhoto}>
                    <Text style={styles.defaultPhotoText}>👤</Text>
                  </View>
                )}
                {isEditing && (
                  <TouchableOpacity style={styles.changePhotoButton} onPress={handleChangePhoto}>
                    <Text style={styles.changePhotoText}>Alterar Foto</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Form */}
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nome Completo</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.full_name}
                      onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                      placeholder="Digite seu nome completo"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.full_name || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="Digite seu email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.email || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Telefone</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.phone}
                      onChangeText={(text) => {
                        const numbers = text.replace(/\D/g, '');
                        let formattedValue;
                        if (numbers.length <= 2) {
                          formattedValue = numbers;
                        } else if (numbers.length <= 7) {
                          formattedValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
                        } else if (numbers.length <= 10) {
                          formattedValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
                        } else {
                          formattedValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
                        }
                        setFormData({ ...formData, phone: formattedValue });
                      }}
                      placeholder="Digite seu telefone"
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.phone || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CPF</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.cpf}
                      onChangeText={(text) => setFormData({ ...formData, cpf: text })}
                      placeholder="Digite seu CPF"
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.cpf || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Data de Nascimento</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.birth_date}
                      onChangeText={(text) => {
                        const numbers = text.replace(/\D/g, '');
                        let formattedValue;
                        if (numbers.length <= 2) {
                          formattedValue = numbers;
                        } else if (numbers.length <= 4) {
                          formattedValue = `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
                        } else {
                          formattedValue = `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
                        }
                        setFormData({ ...formData, birth_date: formattedValue });
                      }}
                      placeholder="DD/MM/AAAA"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.birth_date || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Endereço</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.address}
                      onChangeText={(text) => setFormData({ ...formData, address: text })}
                      placeholder="Digite seu endereço"
                      multiline
                      numberOfLines={3}
                    />
                  ) : (
                    <Text style={styles.value}>{formData.address || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Horário de Trabalho</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.work_schedule}
                      onChangeText={(text) => setFormData({ ...formData, work_schedule: text })}
                      placeholder="Ex: 08:00-18:00"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.work_schedule || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contato de Emergência - Nome</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.emergency_contact_name}
                      onChangeText={(text) => setFormData({ ...formData, emergency_contact_name: text })}
                      placeholder="Nome do contato de emergência"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.emergency_contact_name || 'Não informado'}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contato de Emergência - Telefone</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={formData.emergency_contact_phone}
                      onChangeText={(text) => {
                        const numbers = text.replace(/\D/g, '');
                        let formattedValue;
                        if (numbers.length <= 2) {
                          formattedValue = numbers;
                        } else if (numbers.length <= 7) {
                          formattedValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
                        } else if (numbers.length <= 10) {
                          formattedValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
                        } else {
                          formattedValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
                        }
                        setFormData({ ...formData, emergency_contact_phone: formattedValue });
                      }}
                      placeholder="Telefone do contato de emergência"
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.emergency_contact_phone || 'Não informado'}</Text>
                  )}
                </View>

                {isEditing && (
                  <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Actions Card */}
            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>Configurações</Text>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => setShowPasswordSection(!showPasswordSection)}
              >
                <Text style={styles.actionButtonText}>Alterar Senha</Text>
                <Text style={styles.actionButtonArrow}>{showPasswordSection ? '▼' : '›'}</Text>
              </TouchableOpacity>

              {showPasswordSection && (
                <View style={styles.passwordSection}>
                  <Text style={styles.passwordSectionTitle}>Alteração de Senha</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Senha Atual</Text>
                    <TextInput
                      style={styles.input}
                      value={passwordData.currentPassword}
                      onChangeText={(text) => setPasswordData({...passwordData, currentPassword: text})}
                      secureTextEntry
                      placeholder="Digite sua senha atual"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nova Senha</Text>
                    <TextInput
                      style={styles.input}
                      value={passwordData.newPassword}
                      onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
                      secureTextEntry
                      placeholder="Digite a nova senha"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirmar Nova Senha</Text>
                    <TextInput
                      style={styles.input}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
                      secureTextEntry
                      placeholder="Confirme a nova senha"
                    />
                  </View>

                  {passwordData.newPassword && (
                    <View style={styles.passwordRequirements}>
                      <Text style={styles.requirementsTitle}>Requisitos da senha:</Text>
                      {Object.entries({
                        'Mínimo 8 caracteres': validatePassword(passwordData.newPassword).minLength,
                        'Pelo menos uma letra maiúscula': validatePassword(passwordData.newPassword).hasUpperCase,
                        'Pelo menos uma letra minúscula': validatePassword(passwordData.newPassword).hasLowerCase,
                        'Pelo menos um número': validatePassword(passwordData.newPassword).hasNumbers,
                        'Pelo menos um caractere especial': validatePassword(passwordData.newPassword).hasSpecialChar
                      }).map(([requirement, met]) => (
                        <View key={requirement} style={styles.requirementItem}>
                          <Text style={[styles.requirementIcon, { color: met ? '#4CAF50' : '#f44336' }]}>
                            {met ? '✓' : '✗'}
                          </Text>
                          <Text style={[styles.requirementText, { color: met ? '#4CAF50' : '#f44336' }]}>
                            {requirement}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity 
                    style={[
                      styles.changePasswordButton,
                      (!validatePassword(passwordData.newPassword).isValid || 
                       passwordData.newPassword !== passwordData.confirmPassword || 
                       !passwordData.currentPassword || 
                       passwordLoading) && styles.changePasswordButtonDisabled
                    ]}
                    onPress={handleChangePassword}
                    disabled={!validatePassword(passwordData.newPassword).isValid || 
                             passwordData.newPassword !== passwordData.confirmPassword || 
                             !passwordData.currentPassword || 
                             passwordLoading}
                  >
                    <Text style={styles.changePasswordButtonText}>
                      {passwordLoading ? 'Alterando...' : 'Alterar Senha'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Notificações</Text>
                <Text style={styles.actionButtonArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteProfile}
              >
                <Text style={styles.deleteButtonText}>Excluir Perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Sair da Conta</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Container>
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
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  defaultPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  defaultPhotoText: {
    fontSize: 48,
  },
  changePhotoButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  changePhotoText: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#666',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsCard: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    marginBottom: 10,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  actionButtonArrow: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  logoutButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#ff5722',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  passwordSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  passwordSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  passwordRequirements: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementIcon: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
    width: 16,
  },
  requirementText: {
    fontSize: 12,
    flex: 1,
  },
  changePasswordButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  changePasswordButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  changePasswordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
