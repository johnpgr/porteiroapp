import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import RegistrarVisitante from '~/components/porteiro/RegistrarVisitante';
import { ConfirmActionModal } from '~/components/porteiro/ConfirmActionModal';

export default function RegistrarVisitanteScreen() {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  const handleClose = () => {
    router.back();
  };

  const handleConfirm = (message: string) => {
    setConfirmMessage(message);
    setShowConfirmModal(true);
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowConfirmModal(false);
          router.back();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setCountdown(5);
    router.back();
  };

  return (
    <View style={styles.container}>
      <RegistrarVisitante onClose={handleClose} onConfirm={handleConfirm} />

      <ConfirmActionModal
        visible={showConfirmModal}
        message={confirmMessage}
        countdownSeconds={countdown}
        onClose={closeConfirmModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
