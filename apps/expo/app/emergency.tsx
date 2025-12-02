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
import { router } from 'expo-router';
import { flattenStyles } from '~/utils/styles';
import { IconSymbol } from '~/components/ui/IconSymbol';

export default function EmergencyScreen() {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" color="#fff" size={30} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <View style={styles.titleContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" color="#fff" size={24} />
            <Text style={styles.title}>Emergência</Text>
          </View>
          <Text style={styles.subtitle}>Contatos de Emergência</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.warningContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" color="#f44336" size={20} />
          <Text style={styles.warningText}>Use apenas em situações de emergência real</Text>
        </View>

        <View style={styles.emergencyButtons}>
          <TouchableOpacity
            style={flattenStyles([styles.emergencyButton, styles.policeButton])}
            onPress={() => handleEmergencyCall('Polícia', '190')}>
            <IconSymbol name="shield.fill" color="#1976D2" size={40} />
            <Text style={styles.emergencyTitle}>POLÍCIA</Text>
            <Text style={styles.emergencyNumber}>190</Text>
            <Text style={styles.emergencyDescription}>Crimes, violência, segurança pública</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.emergencyButton, styles.fireButton])}
            onPress={() => handleEmergencyCall('Bombeiros', '193')}>
            <IconSymbol name="exclamationmark.triangle.fill" color="#f44336" size={40} />
            <Text style={styles.emergencyTitle}>BOMBEIROS</Text>
            <Text style={styles.emergencyNumber}>193</Text>
            <Text style={styles.emergencyDescription}>
              Incêndios, resgates, emergências médicas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.emergencyButton, styles.civilDefenseButton])}
            onPress={() => handleEmergencyCall('Defesa Civil', '199')}>
            <IconSymbol name="building.2.fill" color="#FF9800" size={40} />
            <Text style={styles.emergencyTitle}>DEFESA CIVIL</Text>
            <Text style={styles.emergencyNumber}>199</Text>
            <Text style={styles.emergencyDescription}>
              Desastres naturais, riscos estruturais
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.emergencyButton, styles.samuButton])}
            onPress={() => handleEmergencyCall('SAMU', '192')}>
            <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={40} />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#f44336',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    paddingHorizontal: 20,
    gap: 50,
    paddingVertical: 30,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 30,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f44336',
  },
  warningText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f44336',
    textAlign: 'center',
    flex: 1,
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
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    marginTop: 10,
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
  },
  instructionsTitle: {
    fontSize: 16,
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
