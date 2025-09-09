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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<any | null>(null);
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
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Função para upload robusto de foto usando FileSystem
  const uploadPhotoToStorage = async (photoUri: string): Promise<string | null> => {
    const maxRetries = 3;
    const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [AdminProfile] Tentativa ${attempt}/${maxRetries} de upload da foto`);
        
        // Obter usuário atual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          throw new Error('Usuário não autenticado');
        }
        
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const fileName = `${user.id}/${timestamp}_${randomId}.jpeg`;
        
        console.log('🔄 [AdminProfile] Nome do arquivo:', fileName);
        console.log('🔄 [AdminProfile] URI da foto:', photoUri);

        // Upload direto com FileSystem.uploadAsync
        console.log('🔄 [AdminProfile] Tentando upload direto com FileSystem.uploadAsync...');
        
        const uploadUrl = `${supabaseUrl}/storage/v1/object/user-photos/${fileName}`;
        console.log('🔄 [AdminProfile] URL de upload:', uploadUrl);
        
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, photoUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('🔄 [AdminProfile] Resultado do FileSystem upload:', uploadResult);

        if (uploadResult.status === 200) {
          // Construir URL pública da imagem
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/user-photos/${fileName}`;
          console.log('✅ [AdminProfile] Upload concluído com sucesso:', publicUrl);
          return publicUrl;
        } else {
          throw new Error(`Upload falhou com status ${uploadResult.status}`);
        }

      } catch (error) {
        console.error(`❌ [AdminProfile] Erro na tentativa ${attempt}:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Falha no upload após ${maxRetries} tentativas: ${(error as any)?.message || 'Erro desconhecido'}`);
        }
        
        // Aguardar antes da próxima tentativa
        const delay = 1000 * attempt;
        console.log(`⏳ [AdminProfile] Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  };

  const fetchProfile = useCallback(async () => {
    console.log('🔄 [AdminProfile] Iniciando busca do perfil...');
    setLoading(true);
    
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ [AdminProfile] Erro de autenticação:', authError);
        throw new Error('Erro de autenticação');
      }
      
      if (!user) {
        console.warn('⚠️ [AdminProfile] Usuário não encontrado');
        Alert.alert('Erro', 'Usuário não autenticado');
        router.replace('/admin/login');
        return;
      }
      
      console.log('✅ [AdminProfile] Usuário autenticado:', user.id);
      
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', user.id as any)
        .eq('role', 'admin' as any)
        .single();
      
      if (error) {
        console.error('❌ [AdminProfile] Erro ao buscar perfil:', error);
        if (error.code === 'PGRST116' || error.message?.includes('JSON object')) {
          Alert.alert('Erro', 'Perfil de administrador não encontrado. Verifique se seu perfil foi criado corretamente.');
        } else {
          throw error;
        }
        return;
      }
      
      // Perfil encontrado
      setProfile(data);
      
      setFormData({
        full_name: (data as any).full_name || '',
        email: (data as any).email || '',
        phone: (data as any).phone || '',
        cpf: (data as any).cpf || '',
        birth_date: (data as any).birth_date ? formatDateForInput((data as any).birth_date) : '',
        address: (data as any).address || '',
        avatar_url: (data as any).avatar_url || '',
        emergency_contact_name: (data as any).emergency_contact_name || '',
        emergency_contact_phone: (data as any).emergency_contact_phone || '',
      });
      
    } catch (error: any) {
      console.error('❌ [AdminProfile] Erro geral:', error);
      Alert.alert('Erro', error.message || 'Falha ao carregar dados do perfil');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Função para formatar data para exibição no input (DD/MM/AAAA)
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  // Função para formatar data de nascimento automaticamente
  const formatBirthDate = (text: string): string => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };
  
  // Função para formatar telefone
  const formatPhone = (text: string): string => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };
  
  // Função para formatar CPF
  const formatCPF = (text: string): string => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };
  
  // Validações
  const validateFullName = (name: string): boolean => {
    return name.trim().length >= 2 && /^[a-zA-ZÀ-ÿ\s]+$/.test(name.trim());
  };
  
  const validatePhone = (phone: string): boolean => {
    const numbers = phone.replace(/\D/g, '');
    return numbers.length === 10 || numbers.length === 11;
  };
  
  const validateBirthDate = (date: string): boolean => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
    const [day, month, year] = date.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    return birthDate < today && year > 1900;
  };
  
  const validateCPF = (cpf: string): boolean => {
    const numbers = cpf.replace(/\D/g, '');
    return numbers.length === 11;
  };

  // Validação de senha
  const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Deve ter pelo menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Deve conter pelo menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Deve conter pelo menos uma letra minúscula');
    }
    if (!/\d/.test(password)) {
      errors.push('Deve conter pelo menos um número');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Deve conter pelo menos um caractere especial');
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const handleSave = async () => {
    console.log('💾 [AdminProfile] Iniciando salvamento do perfil...');
    
    if (!profile) {
      console.error('❌ [AdminProfile] Perfil não encontrado');
      Alert.alert('Erro', 'Perfil não encontrado');
      return;
    }
    
    // Validações
    if (!validateFullName(formData.full_name)) {
      Alert.alert('Erro de Validação', 'Nome deve ter pelo menos 2 caracteres e conter apenas letras');
      return;
    }
    
    if (formData.phone && !validatePhone(formData.phone)) {
      Alert.alert('Erro de Validação', 'Telefone deve ter 10 ou 11 dígitos');
      return;
    }
    
    if (formData.birth_date && !validateBirthDate(formData.birth_date)) {
      Alert.alert('Erro de Validação', 'Data de nascimento inválida. Use o formato DD/MM/AAAA');
      return;
    }
    
    if (formData.cpf && !validateCPF(formData.cpf)) {
      Alert.alert('Erro de Validação', 'CPF deve ter 11 dígitos');
      return;
    }
    
    if (formData.emergency_contact_phone && !validatePhone(formData.emergency_contact_phone)) {
      Alert.alert('Erro de Validação', 'Telefone de emergência deve ter 10 ou 11 dígitos');
      return;
    }
    
    try {
      console.log('📝 [AdminProfile] Dados para atualização:', formData);
      
      // Converter data de nascimento para formato ISO
      let birthDateISO = null;
      if (formData.birth_date) {
        const [day, month, year] = formData.birth_date.split('/');
        birthDateISO = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString().split('T')[0];
      }
      
      const updateData = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.replace(/\D/g, ''),
        cpf: formData.cpf.replace(/\D/g, ''),
        birth_date: birthDateISO,
        address: formData.address.trim(),
        avatar_url: formData.avatar_url,
        emergency_contact_name: formData.emergency_contact_name.trim(),
        emergency_contact_phone: formData.emergency_contact_phone.replace(/\D/g, ''),
        updated_at: new Date().toISOString(),
      };
      
      console.log('🔄 [AdminProfile] Executando update no Supabase...');
      
      const { data, error } = await supabase
        .from('admin_profiles')
        .update(updateData as any)
        .eq('user_id', profile.user_id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [AdminProfile] Erro no update:', error);
        
        if (error.code === '23505') {
          Alert.alert('Erro', 'Dados duplicados. Verifique CPF e e-mail.');
        } else if (error.code === 'PGRST116') {
          Alert.alert('Erro', 'Perfil não encontrado');
        } else {
          throw error;
        }
        return;
      }
      
      console.log('✅ [AdminProfile] Perfil atualizado com sucesso:', data);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
      setIsEditing(false);
      await fetchProfile();
      
    } catch (error: any) {
      console.error('❌ [AdminProfile] Erro geral no salvamento:', error);
      Alert.alert('Erro', error.message || 'Falha ao salvar alterações');
    }
  };

  const handleImagePicker = async () => {
    console.log('📷 [AdminProfile] Iniciando seleção de foto...');
    
    // Obter usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    setPhotoUploading(true);
    try {
      // Verificar permissões
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessário permitir acesso à galeria para alterar a foto do perfil.'
        );
        return;
      }

      // Selecionar imagem
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const photoUri = result.assets[0].uri;
      console.log('� [AdminProfile] Foto selecionada:', photoUri);

      // Fazer upload da imagem
      const uploadedUrl = await uploadPhotoToStorage(photoUri);
      
      if (uploadedUrl) {
        // Atualizar o avatar_url no banco de dados
        const { error } = await supabase
          .from('admin_profiles')
          .update({ avatar_url: uploadedUrl } as any)
          .eq('user_id', user.id as any);

        if (error) {
          console.error('❌ [AdminProfile] Erro ao atualizar avatar no banco:', error);
          Alert.alert('Erro', 'Não foi possível atualizar a foto no perfil');
          return;
        }

        setFormData({ ...formData, avatar_url: uploadedUrl });
        Alert.alert('Sucesso', 'Foto atualizada com sucesso!');
      } else {
        Alert.alert('Erro', 'Não foi possível fazer upload da foto');
      }
    } catch (error: any) {
      console.error('❌ [AdminProfile] Erro no upload da foto:', error);
      Alert.alert('Erro', 'Erro interno ao fazer upload da foto');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    // Obter usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !formData.avatar_url) return;

    Alert.alert(
      'Remover Foto',
      'Tem certeza que deseja remover sua foto de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setPhotoUploading(true);
            try {
              // Atualizar o avatar_url no banco de dados
              const { error } = await supabase
                .from('admin_profiles')
                .update({ avatar_url: null } as any)
                .eq('user_id', user.id as any);

              if (error) {
                console.error('❌ [AdminProfile] Erro ao remover avatar do banco:', error);
                Alert.alert('Erro', 'Não foi possível remover a foto do perfil');
                return;
              }

              setFormData({ ...formData, avatar_url: '' });
              Alert.alert('Sucesso', 'Foto removida com sucesso!');
            } catch (error: any) {
              console.error('❌ [AdminProfile] Erro ao remover foto:', error);
              Alert.alert('Erro', 'Erro interno ao remover foto');
            } finally {
              setPhotoUploading(false);
            }
          },
        },
      ]
    );
  };
  
  const handleDeleteProfile = async () => {
    console.log('🗑️ [AdminProfile] Solicitação de exclusão de perfil...');
    
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir permanentemente seu perfil? Esta ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Última Confirmação',
              'Esta é sua última chance. Deseja realmente excluir seu perfil permanentemente?',
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                },
                {
                  text: 'Sim, Excluir',
                  style: 'destructive',
                  onPress: confirmDeleteProfile,
                },
              ]
            );
          },
        },
      ]
    );
  };
  
  const confirmDeleteProfile = async () => {
    if (!profile) {
      Alert.alert('Erro', 'Perfil não encontrado');
      return;
    }
    
    try {
      console.log('🔄 [AdminProfile] Executando exclusão do perfil...');
      
      const { error } = await supabase
        .from('admin_profiles')
        .delete()
        .eq('user_id', profile.user_id);
      
      if (error) {
        console.error('❌ [AdminProfile] Erro ao excluir perfil:', error);
        throw error;
      }
      
      console.log('✅ [AdminProfile] Perfil excluído com sucesso');
      
      // Fazer logout após exclusão
      await supabase.auth.signOut();
      
      Alert.alert(
        'Perfil Excluído',
        'Seu perfil foi excluído permanentemente.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/admin/login'),
          },
        ]
      );
      
    } catch (error: any) {
      console.error('❌ [AdminProfile] Erro geral na exclusão:', error);
      Alert.alert('Erro', error.message || 'Falha ao excluir perfil');
    }
  };

  const handleChangePassword = async () => {
    console.log('🔐 [AdminProfile] Iniciando alteração de senha...');
    
    // Validações
    if (!passwordData.currentPassword) {
      Alert.alert('Erro', 'Digite sua senha atual');
      return;
    }
    
    if (!passwordData.newPassword) {
      Alert.alert('Erro', 'Digite sua nova senha');
      return;
    }
    
    if (!passwordData.confirmPassword) {
      Alert.alert('Erro', 'Confirme sua nova senha');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }
    
    const passwordValidation = validatePassword(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      Alert.alert('Erro', 'A nova senha não atende aos requisitos:\n\n' + passwordValidation.errors.join('\n'));
      return;
    }
    
    if (passwordData.currentPassword === passwordData.newPassword) {
      Alert.alert('Erro', 'A nova senha deve ser diferente da senha atual');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      // Primeiro, verificar a senha atual fazendo login
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Tentar fazer login com a senha atual para verificar se está correta
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: passwordData.currentPassword,
      });
      
      if (signInError) {
        Alert.alert('Erro', 'Senha atual incorreta');
        return;
      }
      
      // Atualizar a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (updateError) {
        console.error('❌ [AdminProfile] Erro ao atualizar senha:', updateError);
        throw updateError;
      }
      
      console.log('✅ [AdminProfile] Senha alterada com sucesso');
      
      // Limpar os campos
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      setShowPasswordSection(false);
      
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      
    } catch (error: any) {
      console.error('❌ [AdminProfile] Erro geral na alteração de senha:', error);
      Alert.alert('Erro', error.message || 'Falha ao alterar senha');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    console.log('🚪 [AdminProfile] Iniciando logout...');
    
    Alert.alert(
      'Confirmar Saída',
      'Deseja realmente sair da sua conta?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'default',
          onPress: async () => {
            try {
              console.log('🔄 [AdminProfile] Executando logout...');
              await supabase.auth.signOut();
              console.log('✅ [AdminProfile] Logout realizado com sucesso');
              router.replace('/admin/login');
            } catch (error: any) {
              console.error('❌ [AdminProfile] Erro no logout:', error);
              Alert.alert('Erro', error.message || 'Falha ao sair da conta');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Meu Perfil</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editButtonText}>{isEditing ? 'Cancelar' : 'Editar'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.photoContainer}>
              {(isEditing ? formData.avatar_url : profile?.avatar_url) ? (
                <Image
                  source={{ uri: isEditing ? formData.avatar_url : profile?.avatar_url }}
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={styles.defaultPhoto}>
                  <Text style={styles.defaultPhotoText}>👨‍💼</Text>
                </View>
              )}
              {isEditing && (
                <>
                  <TouchableOpacity 
                    style={[styles.changePhotoButton, photoUploading && styles.disabledButton]} 
                    onPress={handleImagePicker}
                    disabled={photoUploading}
                  >
                    {photoUploading ? (
                      <ActivityIndicator size="small" color="#666" />
                    ) : (
                      <Text style={styles.changePhotoText}>📷 Alterar Foto</Text>
                    )}
                  </TouchableOpacity>
                  
                  {formData.avatar_url && (
                    <TouchableOpacity 
                      style={[styles.removePhotoButton, photoUploading && styles.disabledButton]} 
                      onPress={handleRemovePhoto}
                      disabled={photoUploading}
                    >
                      <Text style={styles.removePhotoText}>🗑️ Remover Foto</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.full_name}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, full_name: text }))}
                    placeholder="Digite seu nome completo"
                  />
                ) : (
                  <Text style={styles.value}>{profile?.full_name || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, email: text }))}
                    placeholder="Digite seu e-mail"
                    keyboardType="email-address"
                  />
                ) : (
                  <Text style={styles.value}>{profile?.email || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, phone: formatPhone(text) }))}
                    placeholder="Digite seu telefone"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.value}>{profile?.phone || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.cpf}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, cpf: formatCPF(text) }))}
                    placeholder="Digite seu CPF"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.value}>{profile?.cpf || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Data de Nascimento</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.birth_date}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, birth_date: formatBirthDate(text) }))}
                    placeholder="DD/MM/AAAA"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.value}>
                    {profile?.birth_date
                      ? new Date(profile.birth_date).toLocaleDateString('pt-BR')
                      : 'Não informado'}
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Endereço</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData.address}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, address: text }))}
                    placeholder="Digite seu endereço completo"
                    multiline
                    numberOfLines={3}
                  />
                ) : (
                  <Text style={styles.value}>{profile?.address || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do Contato de Emergência</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.emergency_contact_name}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, emergency_contact_name: text }))}
                    placeholder="Nome do contato de emergência"
                  />
                ) : (
                  <Text style={styles.value}>{profile?.emergency_contact_name || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone de Emergência</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData.emergency_contact_phone}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, emergency_contact_phone: formatPhone(text) }))}
                    placeholder="Telefone do contato de emergência"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.value}>{profile?.emergency_contact_phone || 'Não informado'}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="shield-checkmark" size={16} color="#666" /> Cargo
                </Text>
                <Text style={styles.value}>Administrador</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="checkmark-circle" size={16} color={profile?.is_active ? '#4CAF50' : '#f44336'} /> Status
                </Text>
                <Text style={[styles.value, { color: profile?.is_active ? '#4CAF50' : '#f44336' }]}>
                  {profile?.is_active ? '✅ Ativo' : '❌ Inativo'}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="time" size={16} color="#666" /> Último Acesso
                </Text>
                <Text style={styles.value}>
                  {profile?.last_login
                    ? new Date(profile.last_login).toLocaleString('pt-BR')
                    : 'Nunca'}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="calendar" size={16} color="#666" /> Membro desde
                </Text>
                <Text style={styles.value}>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('pt-BR')
                    : 'Não informado'}
                </Text>
              </View>
            </View>

            {isEditing && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.saveButtonText}>Salvar Alterações</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Configurações da Conta</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPasswordSection(!showPasswordSection)}>
              <Ionicons name="lock-closed" size={20} color="#666" />
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
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                    placeholder="Digite sua senha atual"
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nova Senha</Text>
                  <TextInput
                    style={styles.input}
                    value={passwordData.newPassword}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                    placeholder="Digite sua nova senha"
                    secureTextEntry
                  />
                  {passwordData.newPassword && (
                    <View style={styles.passwordRequirements}>
                      <Text style={styles.requirementsTitle}>Requisitos da senha:</Text>
                      {validatePassword(passwordData.newPassword).errors.map((error, index) => (
                        <Text key={index} style={styles.requirementError}>• {error}</Text>
                      ))}
                      {validatePassword(passwordData.newPassword).isValid && (
                        <Text style={styles.requirementSuccess}>✓ Senha válida</Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmar Nova Senha</Text>
                  <TextInput
                    style={styles.input}
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                    placeholder="Confirme sua nova senha"
                    secureTextEntry
                  />
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <Text style={styles.requirementError}>• As senhas não coincidem</Text>
                  )}
                </View>

                <TouchableOpacity 
                  style={[styles.changePasswordButton, passwordLoading && styles.disabledButton]} 
                  onPress={handleChangePassword}
                  disabled={passwordLoading}
                >
                  {passwordLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="white" />
                      <Text style={styles.changePasswordButtonText}>Alterar Senha</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#ffebee' }]}
              onPress={handleDeleteProfile}>
              <Ionicons name="trash" size={20} color="#f44336" />
              <Text style={[styles.actionButtonText, { color: '#f44336' }]}>Excluir Perfil Permanentemente</Text>
              <Text style={styles.actionButtonArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out" size={20} color="white" />
              <Text style={styles.logoutButtonText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingBottom: 15,
    paddingTop: 15,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
  },
  saveButtonText: {
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
    gap: 10,
  },
  dangerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#ffebee',
    marginBottom: 10,
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  dangerText: {
    fontSize: 16,
    color: '#f44336',
    fontWeight: '500',
    flex: 1,
  },
  emergencySection: {
    backgroundColor: '#fff8e1',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  systemSection: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  passwordSection: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  passwordSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  passwordRequirements: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  requirementError: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 4,
  },
  requirementSuccess: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
  },
  changePasswordButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  changePasswordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  removePhotoButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  removePhotoText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
});
