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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../utils/supabase';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    phone: '',
    apartment_number: '',
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!formData.apartment_number.trim()) {
      Alert.alert('Erro', 'Número do apartamento é obrigatório');
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Erro', 'Telefone é obrigatório para contato');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Verificar se o apartamento existe
      const { data: apartment, error: aptError } = await supabase
        .from('apartments')
        .select('number')
        .eq('number', formData.apartment_number.trim())
        .single();

      if (aptError || !apartment) {
        Alert.alert('Erro', 'Apartamento não encontrado. Verifique o número informado.');
        return;
      }

      // Inserir visitante
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .insert({
          name: formData.name.trim(),
          document: formData.document.trim(),
          phone: formData.phone.trim(),
          apartment_number: formData.apartment_number.trim(),
          photo_url: formData.photo_url || null,
          notes: formData.notes.trim() || 'Registro via acesso sem porteiro',
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (visitorError) throw visitorError;

      // Criar log da atividade
      await supabase.from('visitor_logs').insert({
        visitor_id: visitor.id,
        action: 'registered',
        performed_by: null, // Registro próprio
        notes: 'Visitante registrado via acesso sem porteiro',
        timestamp: new Date().toISOString(),
      });

      // Criar notificação para o morador
      await supabase.from('communications').insert({
        title: 'Novo Visitante Registrado',
        message: `${formData.name} deseja visitá-lo. Documento: ${formData.document}`,
        type: 'visitor',
        priority: 'medium',
        target_apartment: formData.apartment_number.trim(),
        target_user_type: 'morador',
      });

      // Criar notificação para o porteiro (se houver)
      await supabase.from('communications').insert({
        title: 'Visitante Aguardando',
        message: `${formData.name} registrou-se para visitar o apt. ${formData.apartment_number}`,
        type: 'visitor',
        priority: 'medium',
        target_user_type: 'porteiro',
      });

      Alert.alert(
        'Registro Realizado! 📱',
        'Seu registro foi enviado ao morador. Aguarde a autorização para acessar o prédio.',
        [
          {
            text: 'Ver Status',
            onPress: () => router.push('/visitante/status'),
          },
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

      // Limpar formulário
      setFormData({
        name: '',
        document: '',
        phone: '',
        apartment_number: '',
        notes: '',
        photo_url: '',
      });
    } catch (error) {
      console.error('Erro ao registrar visitante:', error);
      Alert.alert('Erro', 'Não foi possível realizar o registro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Visita</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Registro Seguro</Text>
          <Text style={styles.infoText}>Seus dados serão enviados ao morador para autorização</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {/* Photo Section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>📸 Sua Foto</Text>
            <TouchableOpacity style={styles.photoButton} onPress={showImageOptions}>
              {formData.photo_url ? (
                <Image source={{ uri: formData.photo_url }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color="#999" />
                  <Text style={styles.photoPlaceholderText}>Adicionar Foto</Text>
                  <Text style={styles.photoHint}>Recomendado para segurança</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Suas Informações</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="Digite seu nome completo"
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
              <Text style={styles.inputLabel}>Telefone *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="(11) 99999-9999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Visit Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏠 Informações da Visita</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Número do Apartamento *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.apartment_number}
                onChangeText={(value) => handleInputChange('apartment_number', value)}
                placeholder="Ex: 101, 205, 1504"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Motivo da Visita</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.notes}
                onChangeText={(value) => handleInputChange('notes', value)}
                placeholder="Descreva brevemente o motivo da sua visita..."
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
            <Ionicons name="send" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Enviando...' : 'Registrar Visita'}
            </Text>
          </TouchableOpacity>

          {/* Help Text */}
          <View style={styles.helpCard}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.helpText}>
              📸 Toque no ícone da câmera para adicionar uma foto (obrigatório)
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
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
    alignItems: 'center',
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
  photoHint: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
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
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
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
  helpCard: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 10,
    lineHeight: 20,
  },
});
