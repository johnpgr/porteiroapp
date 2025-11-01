import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '~/components/Modal';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoCapture: (uri: string, url: string | null) => void;
  uploadFunction: (uri: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  title?: string;
}

export function CameraModal({
  visible,
  onClose,
  onPhotoCapture,
  uploadFunction,
  title = 'Tirar Foto',
}: CameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleClose = () => {
    setPhotoUri(null);
    setPhotoUrl(null);
    setIsUploading(false);
    onClose();
  };

  const handleRequestPermission = async () => {
    try {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permissão Negada',
          'Para tirar fotos, é necessário permitir o acesso à câmera.'
        );
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão da câmera:', error);
      Alert.alert('Erro', 'Não foi possível solicitar permissão da câmera.');
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      setIsUploading(true);
      console.log('🎯 [CameraModal] Iniciando captura de foto...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo?.uri) {
        console.log('🎯 [CameraModal] Foto capturada:', {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
        });

        setPhotoUri(photo.uri);

        // Small delay to ensure file is written
        await new Promise((resolve) => setTimeout(resolve, 200));

        console.log('🎯 [CameraModal] Iniciando upload...');

        try {
          const uploadResult = await uploadFunction(photo.uri);
          console.log('🎯 [CameraModal] Resultado do upload:', uploadResult);

          if (uploadResult.success && uploadResult.url) {
            setPhotoUrl(uploadResult.url);
            console.log('🎯 [CameraModal] Upload realizado com sucesso! URL:', uploadResult.url);
          } else {
            console.error('🎯 [CameraModal] Erro no upload:', uploadResult.error);
            Alert.alert('Erro', `Falha no upload da foto: ${uploadResult.error ?? 'Erro desconhecido'}`);
            setPhotoUri(null);
          }
        } catch (uploadError) {
          console.error('🎯 [CameraModal] Exceção durante upload:', uploadError);
          Alert.alert('Erro', 'Exceção durante upload da foto');
          setPhotoUri(null);
        }
      }
    } catch (error) {
      console.error('🎯 [CameraModal] Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Falha ao capturar foto');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setPhotoUrl(null);
    setIsUploading(false);
  };

  const handleConfirm = () => {
    if (photoUri) {
      onPhotoCapture(photoUri, photoUrl);
      handleClose();
    }
  };

  const handleSkip = () => {
    onPhotoCapture('', null);
    handleClose();
  };

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Carregando Câmera</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Preparando câmera...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionIcon}>🔒</Text>
              <Text style={styles.permissionText}>
                A foto é opcional, mas recomendada como comprovante.
              </Text>

              <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
                <Text style={styles.permissionButtonText}>Permitir Acesso à Câmera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Pular Foto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!photoUri ? (
            <>
              <View style={styles.cameraContainer}>
                <CameraView ref={cameraRef} style={styles.camera} facing="back">
                  <View style={styles.cameraOverlay}>
                    <View style={styles.cameraFrame}>
                      <Text style={styles.cameraInstructions}>
                        Posicione dentro do quadro
                      </Text>
                    </View>

                    <View style={styles.cameraControls}>
                      <TouchableOpacity
                        style={styles.captureButton}
                        onPress={handleTakePhoto}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <View style={styles.captureButtonInner} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </CameraView>
              </View>

              <TouchableOpacity style={styles.skipButtonBottom} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Pular Foto</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.photoSuccessContainer}>
              {photoUri && (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                </View>
              )}

              <View style={styles.photoSuccessIcon}>
                <Text style={styles.photoSuccessEmoji}>✅</Text>
              </View>
              <Text style={styles.photoSuccessTitle}>Foto Capturada!</Text>
              <Text style={styles.photoSuccessText}>
                {isUploading
                  ? 'Enviando foto...'
                  : photoUrl
                  ? 'A foto foi enviada com sucesso.'
                  : 'A foto foi registrada com sucesso.'}
              </Text>

              {isUploading && <ActivityIndicator size="small" color="#4CAF50" />}

              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleRetake}
                  disabled={isUploading}
                >
                  <Text style={styles.cancelButtonText}>Tirar Nova Foto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, isUploading && styles.disabledButton]}
                  onPress={handleConfirm}
                  disabled={isUploading}
                >
                  <Text style={styles.submitButtonText}>
                    {isUploading ? 'Enviando...' : 'Continuar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 20,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  skipButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  skipButtonBottom: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
  },
  cameraFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraInstructions: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cameraControls: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
  },
  photoSuccessContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  photoPreviewContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoSuccessIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoSuccessEmoji: {
    fontSize: 40,
    color: '#fff',
  },
  photoSuccessTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'center',
  },
  photoSuccessText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
