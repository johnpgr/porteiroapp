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
    name: '',
    email: '',
    phone: '',
    cpf: '',
    birth_date: '',
    address: '',
    photo_url: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        address: data.address || '',
        photo_url: data.photo_url || '',
      });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          cpf: formData.cpf,
          birth_date: formData.birth_date,
          address: formData.address,
          photo_url: formData.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
      setIsEditing(false);
      fetchProfile();
    } catch (saveError) {
      console.error('Erro ao salvar perfil:', saveError);
      Alert.alert('Erro', 'Falha ao salvar dados do perfil');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        cpf: profile.cpf || '',
        birth_date: profile.birth_date || '',
        address: profile.address || '',
        photo_url: profile.photo_url || '',
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
      setFormData({ ...formData, photo_url: result.assets[0].uri });
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
                {formData.photo_url ? (
                  <Image source={{ uri: formData.photo_url }} style={styles.profilePhoto} />
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
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
                      placeholder="Digite seu nome completo"
                    />
                  ) : (
                    <Text style={styles.value}>{formData.name || 'Não informado'}</Text>
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
                      onChangeText={(text) => setFormData({ ...formData, phone: text })}
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
                      onChangeText={(text) => setFormData({ ...formData, birth_date: text })}
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

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Alterar Senha</Text>
                <Text style={styles.actionButtonArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Notificações</Text>
                <Text style={styles.actionButtonArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

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
});
