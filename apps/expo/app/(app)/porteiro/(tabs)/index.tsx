import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { usePorteiroDashboard } from '~/providers/PorteiroDashboardProvider';
import { flattenStyles } from '~/utils/styles';

export default function PorteiroChegadaScreen() {
  const {
    shift: { currentShift },
  } = usePorteiroDashboard();

  const checkShiftBeforeAction = (action: () => void, actionName: string = 'esta ação') => {
    if (!currentShift) {
      Alert.alert('Turno Inativo', `Você precisa iniciar seu turno para realizar ${actionName}.`);
      return;
    }
    action();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.buttonsContainer}>
          <TouchableOpacity
            style={flattenStyles([styles.actionButton, styles.visitorButton])}
            onPress={() =>
              checkShiftBeforeAction(
                () => router.push('/porteiro/registrar-visitante'),
                'registrar visitantes'
              )
            }>
            <Text style={styles.buttonIcon}>👋</Text>
            <Text style={styles.buttonTitle}>Registrar Visitante</Text>
            <Text style={styles.buttonDescription}>Cadastrar nova visita</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.actionButton, styles.deliveryButton])}
            onPress={() =>
              checkShiftBeforeAction(
                () => router.push('/porteiro/registrar-encomenda'),
                'registrar encomendas'
              )
            }>
            <Text style={styles.buttonIcon}>📦</Text>
            <Text style={styles.buttonTitle}>Registrar Encomenda</Text>
            <Text style={styles.buttonDescription}>Receber entrega</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.actionButton, styles.vehicleButton])}
            onPress={() =>
              checkShiftBeforeAction(
                () => router.push('/porteiro/registrar-veiculo'),
                'registrar veículos'
              )
            }>
            <Text style={styles.buttonIcon}>🚗</Text>
            <Text style={styles.buttonTitle}>Registrar Veículo</Text>
            <Text style={styles.buttonDescription}>Autorizar entrada</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
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
