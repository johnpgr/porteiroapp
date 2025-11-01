import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';
import { flattenStyles } from '~/utils/styles';

export default function EmergencyPage() {
  const handleEmergencyCall = (service: string, number: string) => {
    Alert.alert(
      `Ligar para ${service}?`,
      `Você está prestes a ligar para ${service} (${number}). Esta é uma emergência real?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Ligar',
          style: 'destructive',
          onPress: () => {
            Linking.openURL(`tel:${number}`);
          },
        },
      ]
    );
  };

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>⚠️ Emergências</Text>

          <Text style={styles.warningText}>⚠️ Use apenas em situações de emergência real</Text>

          <View style={styles.emergencyButtons}>
            <TouchableOpacity
              style={flattenStyles([styles.emergencyButton, styles.policeButton])}
              onPress={() => handleEmergencyCall('Polícia', '190')}>
              <Text style={styles.emergencyIcon}>🚔</Text>
              <Text style={styles.emergencyTitle}>POLÍCIA</Text>
              <Text style={styles.emergencyNumber}>190</Text>
              <Text style={styles.emergencyDescription}>Crimes, violência, segurança pública</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyles([styles.emergencyButton, styles.fireButton])}
              onPress={() => handleEmergencyCall('Bombeiros', '193')}>
              <Text style={styles.emergencyIcon}>🚒</Text>
              <Text style={styles.emergencyTitle}>BOMBEIROS</Text>
              <Text style={styles.emergencyNumber}>193</Text>
              <Text style={styles.emergencyDescription}>
                Incêndios, resgates, emergências médicas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyles([styles.emergencyButton, styles.civilDefenseButton])}
              onPress={() => handleEmergencyCall('Defesa Civil', '199')}>
              <Text style={styles.emergencyIcon}>🏛️</Text>
              <Text style={styles.emergencyTitle}>DEFESA CIVIL</Text>
              <Text style={styles.emergencyNumber}>199</Text>
              <Text style={styles.emergencyDescription}>
                Desastres naturais, riscos estruturais
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyles([styles.emergencyButton, styles.samuButton])}
              onPress={() => handleEmergencyCall('SAMU', '192')}>
              <Text style={styles.emergencyIcon}>🚑</Text>
              <Text style={styles.emergencyTitle}>SAMU</Text>
              <Text style={styles.emergencyNumber}>192</Text>
              <Text style={styles.emergencyDescription}>Emergências médicas, ambulância</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Instruções:</Text>
            <Text style={styles.instructionText}>• Mantenha a calma e fale claramente</Text>
            <Text style={styles.instructionText}>• Informe sua localização exata</Text>
            <Text style={styles.instructionText}>• Descreva a situação de emergência</Text>
            <Text style={styles.instructionText}>• Siga as orientações do atendente</Text>
            <Text style={styles.instructionText}>• Não desligue até ser orientado</Text>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
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
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 30,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f44336',
  },
  emergencyButtons: {
    gap: 15,
    marginBottom: 30,
  },
  emergencyButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderLeftWidth: 6,
  },
  policeButton: {
    borderLeftColor: '#1976D2',
  },
  fireButton: {
    borderLeftColor: '#f44336',
  },
  civilDefenseButton: {
    borderLeftColor: '#FF9800',
  },
  samuButton: {
    borderLeftColor: '#4CAF50',
  },
  emergencyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emergencyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  emergencyNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 10,
  },
  emergencyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 30,
  },
});
