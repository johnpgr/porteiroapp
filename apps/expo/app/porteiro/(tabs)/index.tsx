import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';
import RegistrarEncomenda from '~/components/porteiro/RegistrarEncomenda';
import RegistrarVeiculo from '~/components/porteiro/RegistrarVeiculo';
import RegistrarVisitante from '~/components/porteiro/RegistrarVisitante';
import IntercomModal from '../components/modals/IntercomModal';
import { usePorteiroDashboard } from '~/providers/PorteiroDashboardProvider';
import ConfirmActionModal from '~/components/porteiro/ConfirmActionModal';
import { flattenStyles } from '~/utils/styles';

type ActiveFlow = 'visitante' | 'encomenda' | 'veiculo' | null;

export default function PorteiroChegadaScreen() {
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [showIntercomModal, setShowIntercomModal] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  const {
    shift: { currentShift },
  } = usePorteiroDashboard();

  const checkShiftBeforeAction = (action: () => void, actionName: string = 'esta ação') => {
    if (!currentShift) {
      Alert.alert(
        'Turno Inativo',
        `Você precisa iniciar seu turno para realizar ${actionName}.`
      );
      return;
    }
    action();
  };

  const showConfirmationModal = (message: string) => {
    setConfirmMessage(message);
    setShowConfirmModal(true);
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowConfirmModal(false);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setCountdown(5);
  };

  const handleIntercomCall = () => {
    checkShiftBeforeAction(() => {
      setShowIntercomModal(true);
    }, 'realizar chamadas de interfone');
  };

  const renderChegadaContent = () => (
    <ScrollView contentContainerStyle={styles.buttonsContainer}>
      <TouchableOpacity
        style={flattenStyles([styles.actionButton, styles.visitorButton])}
        onPress={() =>
          checkShiftBeforeAction(() => setActiveFlow('visitante'), 'registrar visitantes')
        }
      >
        <Text style={styles.buttonIcon}>👋</Text>
        <Text style={styles.buttonTitle}>Registrar Visitante</Text>
        <Text style={styles.buttonDescription}>Cadastrar nova visita</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={flattenStyles([styles.actionButton, styles.deliveryButton])}
        onPress={() =>
          checkShiftBeforeAction(() => setActiveFlow('encomenda'), 'registrar encomendas')
        }
      >
        <Text style={styles.buttonIcon}>📦</Text>
        <Text style={styles.buttonTitle}>Registrar Encomenda</Text>
        <Text style={styles.buttonDescription}>Receber entrega</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={flattenStyles([styles.actionButton, styles.vehicleButton])}
        onPress={() =>
          checkShiftBeforeAction(() => setActiveFlow('veiculo'), 'registrar veículos')
        }
      >
        <Text style={styles.buttonIcon}>🚗</Text>
        <Text style={styles.buttonTitle}>Registrar Veículo</Text>
        <Text style={styles.buttonDescription}>Autorizar entrada</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <ProtectedRoute redirectTo="/porteiro/login" userType="porteiro">
      {activeFlow === 'visitante' && (
        <RegistrarVisitante
          onClose={() => setActiveFlow(null)}
          onConfirm={(message: string) => {
            setActiveFlow(null);
            showConfirmationModal(message);
          }}
        />
      )}

      {activeFlow === 'encomenda' && (
        <RegistrarEncomenda
          onClose={() => setActiveFlow(null)}
          onConfirm={(message: string) => {
            setActiveFlow(null);
            showConfirmationModal(message);
          }}
        />
      )}

      {activeFlow === 'veiculo' && (
        <RegistrarVeiculo
          onClose={() => setActiveFlow(null)}
          onConfirm={(message: string) => {
            setActiveFlow(null);
            showConfirmationModal(message);
          }}
        />
      )}

      {!activeFlow && (
        <View style={styles.container}>
          <View style={styles.content}>{renderChegadaContent()}</View>
        </View>
      )}

      <ConfirmActionModal
        visible={showConfirmModal}
        message={confirmMessage}
        countdownSeconds={countdown}
        onClose={closeConfirmModal}
      />

      <IntercomModal visible={showIntercomModal} onClose={() => setShowIntercomModal(false)} />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  buttonsContainer: {
    gap: 16,
    paddingBottom: 32,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  visitorButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  deliveryButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800',
  },
  vehicleButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3',
  },
  buttonIcon: {
    fontSize: 48,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
