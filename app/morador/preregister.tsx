import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import BottomNav from '../../components/BottomNav';

export default function PreregisterScreen() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    phone: '',
    notes: '',
    photo_url: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso à galeria para selecionar uma foto'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData((prev) => ({ ...prev, photo_url: result.assets[0].uri }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar uma foto');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData((prev) => ({ ...prev, photo_url: result.assets[0].uri }));
    }
  };

  const showImageOptions = () => {
    Alert.alert('Adicionar Foto', 'Escolha uma opção:', [
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Galeria', onPress: pickImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return false;
    }
    if (!formData.document.trim()) {
      Alert.alert('Erro', 'Documento é obrigatório');
      return false;
    }
    if (!user?.apartment_number) {
      Alert.alert('Erro', 'Número do apartamento não encontrado');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Inserir visitante pré-cadastrado
      const { error } = await supabase.from('visitors').insert({
        name: formData.name.trim(),
        document: formData.document.trim(),
        phone: formData.phone.trim() || null,
        photo_url: formData.photo_url || null,
        access_type: 'com_aprovacao', // Tipo de acesso padrão
      });

      if (error) throw error;

      // Criar log da atividade
      await supabase.from('visitor_logs').insert({
        visitor_id: null, // Será preenchido pelo trigger
        action: 'preregistered',
        performed_by: user!.id,
        notes: `Visitante pré-cadastrado pelo morador do apt. ${user!.apartment_number}`,
        timestamp: new Date().toISOString(),
      });

      // Criar notificação para o porteiro
      await supabase.from('communications').insert({
        title: 'Visitante Pré-cadastrado',
        message: `${formData.name} foi pré-cadastrado pelo morador do apt. ${user!.apartment_number}`,
        type: 'visitor',
        priority: 'low',
        target_user_type: 'porteiro',
        created_by: user!.id,
      });

      Alert.alert(
        'Sucesso!',
        'Visitante pré-cadastrado com sucesso. Ele poderá acessar o prédio apresentando o documento.',
        [{ text: 'OK', onPress: () => router.back() }]
      );

      // Limpar formulário
      setFormData({
        name: '',
        document: '',
        phone: '',
        notes: '',
        photo_url: '',
      });
    } catch (error) {
      console.error('Erro ao pré-cadastrar visitante:', error);
      Alert.alert('Erro', 'Não foi possível pré-cadastrar o visitante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pré-cadastro</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="person-add" size={24} color="#4CAF50" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Pré-cadastro de Visitantes</Text>
          <Text style={styles.infoText}>
            Cadastre visitantes com antecedência para facilitar o acesso
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {/* Photo Section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Foto do Visitante</Text>
            <TouchableOpacity style={styles.photoButton} onPress={showImageOptions}>
              {formData.photo_url ? (
                <Image source={{ uri: formData.photo_url }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color="#999" />
                  <Text style={styles.photoPlaceholderText}>Adicionar Foto</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações Pessoais</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="Digite o nome completo"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Documento (RG/CPF) *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.document}
                onChangeText={(value) => handleInputChange('document', value)}
                placeholder="Digite o número do documento"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefone</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="(11) 99999-9999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Additional Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações Adicionais</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Observações</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.notes}
                onChangeText={(value) => handleInputChange('notes', value)}
                placeholder="Observações sobre o visitante..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Cadastrando...' : 'Pré-cadastrar Visitante'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BottomNav activeTab="preregister" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
    paddingTop: 0,
  },
  photoSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  photoButton: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
