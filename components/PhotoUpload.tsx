import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface PhotoUploadProps {
  onPhotoSelected: (uri: string) => void;
  photoUri?: string | null;
  style?: ViewStyle;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onPhotoSelected,
  photoUri,
  style,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permissões Necessárias',
        'Precisamos de acesso à câmera e galeria para continuar.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  };

  const processImage = async (uri: string): Promise<string> => {
    try {
      // Resize and compress the image
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 800, height: 800 } }, // Square format
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      return manipulatedImage.uri;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Erro ao processar imagem');
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsLoading(true);
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const processedUri = await processImage(result.assets[0].uri);
        onPhotoSelected(processedUri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Erro', 'Erro ao tirar foto. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsLoading(true);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const processedUri = await processImage(result.assets[0].uri);
        onPhotoSelected(processedUri);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert('Erro', 'Erro ao selecionar foto. Tente novamente.');
    } finally {
      setIsLoading(false);
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
          onPress: pickFromGallery,
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const removePhoto = () => {
    Alert.alert(
      'Remover Foto',
      'Tem certeza que deseja remover esta foto?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => onPhotoSelected(''),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Foto do Perfil</Text>
      
      <View style={styles.photoContainer}>
        {photoUri ? (
          <View style={styles.photoWrapper}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={removePhoto}
            >
              <Ionicons name="close-circle" size={24} color="#dc3545" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.placeholderContainer}
            onPress={showImagePicker}
            disabled={isLoading}
          >
            <View style={styles.placeholder}>
              <Ionicons
                name="camera-outline"
                size={48}
                color="#6c757d"
              />
              <Text style={styles.placeholderText}>
                {isLoading ? 'Processando...' : 'Toque para adicionar foto'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {photoUri && (
        <TouchableOpacity
          style={styles.changeButton}
          onPress={showImagePicker}
          disabled={isLoading}
        >
          <Ionicons name="camera-outline" size={16} color="#007AFF" />
          <Text style={styles.changeButtonText}>
            {isLoading ? 'Processando...' : 'Alterar Foto'}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.hint}>
        Sua foto será usada para identificação no condomínio
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  photoContainer: {
    marginBottom: 16,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f8f9fa',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  placeholderContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 12,
  },
  changeButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 200,
  },
});