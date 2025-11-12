import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PorteiroPhotoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    uri?: string;
    title?: string;
    placeholderIcon?: string;
    placeholderText?: string;
    closeLabel?: string;
  }>();

  const {
    uri,
    title = 'Foto',
    placeholderIcon = '👤',
    placeholderText = 'Foto não disponível',
    closeLabel = 'Fechar',
  } = params;

  const imageUri = uri ? decodeURIComponent(uri) : null;

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photoContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>{placeholderIcon}</Text>
              <Text style={styles.placeholderText}>{placeholderText}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={handleClose}>
          <Text style={styles.actionButtonText}>{closeLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: '#666',
  },
  photoContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderIcon: {
    fontSize: 42,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
