import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../utils/supabase';

interface VisitorData {
  id: string;
  name: string;
  phone: string | null;
  visitor_type: string | null;
  apartment_id: string | null;
  token_expires_at: string | null;
}

// Função para formatar CPF
const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Função para validar CPF
const validateCPF = (cpf: string): boolean => {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 > 9) digit1 = 0;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 > 9) digit2 = 0;
  
  return parseInt(numbers[9]) === digit1 && parseInt(numbers[10]) === digit2;
};

// Função para validar arquivo de imagem
const validateImageFile = (uri: string): boolean => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  const lowerUri = uri.toLowerCase();
  return allowedExtensions.some(ext => lowerUri.includes(ext));
};

// Função para sanitizar entrada de texto
const sanitizeInput = (input: string): string => {
  return input.replace(/[<>"'&]/g, '');
};

export default function CompletarCadastro() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cpf, setCpf] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVisitorData();
  }, []);

  const loadVisitorData = async () => {
    try {
      if (!token) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('registration_token', token)
        .gt('token_expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        console.error('Erro ao carregar dados do visitante:', error);
        setVisitorData(null);
      } else {
        setVisitorData(data);
      }
    } catch (error) {
      console.error('Erro ao carregar visitante:', error);
      setVisitorData(null);
    } finally {
      setLoading(false);
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Selecionar Foto',
      'Como você gostaria de adicionar sua foto?',
      [
        {
          text: 'Câmera',
          onPress: takePhoto,
        },
        {
          text: 'Galeria',
          onPress: pickImage,
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erro', 'Permissão da câmera é necessária!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        if (validateImageFile(imageUri)) {
          setPhotoUri(imageUri);
        } else {
          Alert.alert('Erro', 'Formato de imagem não suportado. Use JPG ou PNG.');
        }
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      Alert.alert('Erro', 'Não foi possível capturar a foto.');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erro', 'Permissão da galeria é necessária!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        if (validateImageFile(imageUri)) {
          setPhotoUri(imageUri);
        } else {
          Alert.alert('Erro', 'Formato de imagem não suportado. Use JPG ou PNG.');
        }
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Validações de segurança
      if (blob.size > 5 * 1024 * 1024) { // 5MB
        Alert.alert('Erro', 'Arquivo muito grande. Máximo 5MB.');
        return null;
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(blob.type)) {
        Alert.alert('Erro', 'Tipo de arquivo não permitido.');
        return null;
      }
      
      const fileName = `visitor_${Date.now()}_${Math.random().toString(36).substring(7)}.${blob.type.split('/')[1]}`;
      
      const { data, error } = await supabase.storage
        .from('visitor-photos')
        .upload(fileName, blob, {
          contentType: blob.type,
          upsert: false
        });

      if (error) {
        console.error('Erro no upload:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('visitor-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro no upload da foto:', error);
      return null;
    }
  };

  const handleCPFChange = (text: string) => {
    const formatted = formatCPF(text);
    setCpf(formatted);
  };

  const handleComplete = async () => {
    if (!visitorData || !photoUri) return;

    setSaving(true);
    try {
      const sanitizedCpf = sanitizeInput(cpf);
      
      // Validar se o token ainda é válido
      if (!visitorData.token_expires_at) {
        Alert.alert('Erro', 'Token inválido.');
        return;
      }
      
      const tokenExpiry = new Date(visitorData.token_expires_at);
      if (tokenExpiry < new Date()) {
        Alert.alert('Erro', 'Token expirado. Solicite um novo link.');
        return;
      }
      
      // Verificar se CPF já existe (se fornecido)
      if (sanitizedCpf) {
        const { data: existingVisitor } = await supabase
          .from('visitors')
          .select('id')
          .eq('cpf', sanitizedCpf.replace(/\D/g, ''))
          .neq('id', visitorData.id)
          .single();
          
        if (existingVisitor) {
          Alert.alert('Erro', 'CPF já cadastrado para outro visitante.');
          return;
        }
      }

      // Upload da foto
      const photoUrl = await uploadPhoto(photoUri);
      if (!photoUrl) {
        Alert.alert('Erro', 'Falha no upload da foto. Tente novamente.');
        return;
      }

      // Atualizar dados do visitante
      const updateData: any = {
        photo_url: photoUrl,
        registration_token: null,
        token_expires_at: null,
        status: 'aprovado',
        updated_at: new Date().toISOString(),
      };

      if (sanitizedCpf) {
        updateData.cpf = sanitizedCpf.replace(/\D/g, '');
      }

      const { error } = await supabase
        .from('visitors')
        .update(updateData)
        .eq('id', visitorData.id);

      if (error) {
        console.error('Erro ao atualizar visitante:', error);
        Alert.alert('Erro', 'Falha ao completar cadastro. Tente novamente.');
        return;
      }

      Alert.alert(
        'Sucesso!',
        'Cadastro completado com sucesso! Você já pode ser identificado pelo porteiro.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao completar cadastro:', error);
      Alert.alert('Erro', 'Falha ao completar cadastro. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (!visitorData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#f44336" />
          <Text style={styles.errorTitle}>Link Inválido</Text>
          <Text style={styles.errorText}>
            Este link de cadastro é inválido ou expirou.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.replace('/')}>
            <Text style={styles.errorButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const numbers = cpf.replace(/\D/g, '');
  const isValidCPF = validateCPF(cpf);
  const isCPFComplete = !cpf || (numbers.length === 11 && isValidCPF);
  const canComplete = photoUri && isCPFComplete;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Completar Cadastro</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.visitorInfo}>
          <Text style={styles.visitorName}>👤 {visitorData.name}</Text>
          <Text style={styles.visitorPhone}>📱 {visitorData.phone}</Text>
          <Text style={styles.visitorType}>
            {visitorData.visitor_type === 'frequente' ? '⭐ Visitante Frequente' : '👥 Visitante Comum'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Foto do Visitante</Text>
          <Text style={styles.sectionDescription}>
            Adicione uma foto atual para identificação
          </Text>

          <View style={styles.photoContainer}>
            {photoUri ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
                <TouchableOpacity style={styles.changePhotoButton} onPress={showImagePicker}>
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.changePhotoText}>Alterar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoButton} onPress={showImagePicker}>
                <Ionicons name="camera" size={48} color="#4CAF50" />
                <Text style={styles.addPhotoText}>Adicionar Foto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 CPF (Opcional)</Text>
          <Text style={styles.sectionDescription}>
            Digite seu CPF para maior segurança
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, !isValidCPF && styles.inputError]}
              value={cpf}
              onChangeText={handleCPFChange}
              placeholder="000.000.000-00"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={14}
            />
            {cpf && !isValidCPF && <Text style={styles.inputErrorText}>❌ CPF inválido</Text>}
            {cpf && isValidCPF && numbers.length === 11 && (
              <Text style={styles.successText}>✅ CPF válido</Text>
            )}
          </View>

          <View style={styles.tipContainer}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.tipText}>
              O CPF é opcional, mas ajuda na identificação e segurança
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeButton, !canComplete && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={!canComplete || saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={[styles.completeButtonText, !canComplete && styles.completeButtonTextDisabled]}>
                Finalizar Cadastro
              </Text>
              <Ionicons name="checkmark" size={20} color={canComplete ? '#fff' : '#ccc'} />
            </>
          )}
        </TouchableOpacity>
      </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  visitorInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visitorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorPhone: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  visitorType: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    position: 'relative',
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  addPhotoButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  addPhotoText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#f44336',
  },
  inputErrorText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 8,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  completeButtonTextDisabled: {
    color: '#ccc',
  },
});