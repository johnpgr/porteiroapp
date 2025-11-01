import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ConfirmActionModalProps {
  visible: boolean;
  message: string;
  countdownSeconds?: number;
  onClose: () => void;
}

export function ConfirmActionModal({
  visible,
  message,
  countdownSeconds,
  onClose,
}: ConfirmActionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.title}>Registro Confirmado!</Text>
          <Text style={styles.message}>{message}</Text>
          {typeof countdownSeconds === 'number' && (
            <Text style={styles.countdown}>
              Fechando automaticamente em {countdownSeconds} segundo
              {countdownSeconds === 1 ? '' : 's'}...
            </Text>
          )}
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Fechar Manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1E293B',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  countdown: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ConfirmActionModal;
