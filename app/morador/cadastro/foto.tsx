import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ProtectedRoute from '~/components/ProtectedRoute';

export default function FotoCadastro() {
  const { nome, relacionamento, telefone, placa, acesso } = useLocalSearchParams<{
    nome: string;
    relacionamento: string;
    telefone: string;
    placa: string;
    acesso: string;
  }>();
  const [photo, setPhoto] = useState<string | null>(null);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permissões Necessárias',
        'Precisamos de permissão para acessar a câmera e galeria de fotos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
  };

  const handleNext = () => {
    router.push({
      pathname: '/morador/cadastro/dias',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: telefone || '',
        placa: placa || '',
        acesso: acesso || '',
        foto: photo || '',
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/morador/cadastro/dias',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: telefone || '',
        placa: placa || '',
        acesso: acesso || '',
        foto: '',
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const getRelationshipLabel = (rel: string) => {
    const relationships: { [key: string]: string } = {
      conjuge: '💑 Cônjuge',
      filho: '👶 Filho(a)',
      pai_mae: '👨‍👩‍👧‍👦 Pai/Mãe',
      irmao: '👫 Irmão/Irmã',
      familiar: '👪 Outro Familiar',
      amigo: '👥 Amigo(a)',
      funcionario: '🏠 Funcionário',
      prestador: '🔧 Prestador de Serviço',
      motorista: '🚗 Motorista',
      outro: '👤 Outro',
    };
    return relationships[rel] || rel;
  };

  const getAccessLabel = (acc: string) => {
    const accessTypes: { [key: string]: string } = {
      sem_acesso: '🚫 Sem Acesso',
      usuario: '👤 Usuário',
      administrador: '👑 Administrador',
    };
    return accessTypes[acc] || acc;
  };

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>📷 Novo Cadastro</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
            </View>
            <Text style={styles.progressText}>Passo 6 de 8</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>👤 {nome}</Text>
              <Text style={styles.personRelationship}>
                {getRelationshipLabel(relacionamento || '')}
              </Text>
              <Text style={styles.personPhone}>📱 {telefone}</Text>
              {placa && <Text style={styles.personPlate}>🚗 {placa}</Text>}
              <Text style={styles.personAccess}>{getAccessLabel(acesso || '')}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Foto da Pessoa</Text>
              <Text style={styles.sectionDescription}>
                Adicione uma foto para facilitar a identificação (opcional)
              </Text>

              <View style={styles.photoContainer}>
                {photo ? (
                  <View style={styles.photoWrapper}>
                    <Image source={{ uri: photo }} style={styles.photo} />
                    <TouchableOpacity style={styles.removePhotoButton} onPress={removePhoto}>
                      <Ionicons name="close-circle" size={32} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.noPhotoContainer}>
                    <Ionicons name="person" size={80} color="#ccc" />
                    <Text style={styles.noPhotoText}>Nenhuma foto selecionada</Text>
                  </View>
                )}
              </View>

              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color="#2196F3" />
                  <Text style={styles.photoButtonText}>Tirar Foto</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                  <Ionicons name="images" size={24} color="#2196F3" />
                  <Text style={styles.photoButtonText}>Galeria</Text>
                </TouchableOpacity>
              </View>

              {photo && (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.successText}>✅ Foto adicionada com sucesso!</Text>
                </View>
              )}

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  A foto ajuda na identificação da pessoa pelos porteiros e sistema de segurança
                </Text>
              </View>

              <View style={styles.examplesContainer}>
                <Text style={styles.examplesTitle}>💡 Dicas para uma boa foto:</Text>
                <View style={styles.tipsList}>
                  <View style={styles.tipItem}>
                    <Ionicons name="checkmark" size={16} color="#4CAF50" />
                    <Text style={styles.tipItemText}>Rosto bem visível e centralizado</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Ionicons name="checkmark" size={16} color="#4CAF50" />
                    <Text style={styles.tipItemText}>Boa iluminação</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Ionicons name="checkmark" size={16} color="#4CAF50" />
                    <Text style={styles.tipItemText}>Fundo neutro</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Ionicons name="checkmark" size={16} color="#4CAF50" />
                    <Text style={styles.tipItemText}>Pessoa olhando para a câmera</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.backFooterButtonText}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Pular</Text>
            <Ionicons name="arrow-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
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
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressStep: {
    width: 25,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  personInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  personRelationship: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPlate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personAccess: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  noPhotoContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  photoButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    minWidth: 120,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
    marginTop: 8,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  examplesContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipItemText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 8,
  },
  backFooterButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextButton: {
    flex: 1.5,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
