import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function EmergencyScreen() {
  const handleEmergencyCall = (number: string, service: string) => {
    Alert.alert(
      'Chamada de Emergência',
      `Deseja ligar para ${service} (${number})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ligar',
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${number}`),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🚨 Emergência</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Warning Section */}
        <View style={styles.warningSection}>
          <Ionicons name="warning" size={32} color="#F44336" />
          <Text style={styles.warningTitle}>ATENÇÃO</Text>
          <Text style={styles.warningText}>
            Use apenas em situações de emergência real. Chamadas falsas podem resultar em multas.
          </Text>
        </View>

        {/* Emergency Buttons */}
        <View style={styles.emergencySection}>
          <Text style={styles.sectionTitle}>Números de Emergência</Text>
          
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => handleEmergencyCall('190', 'Polícia')}
          >
            <Ionicons name="shield" size={24} color="#fff" />
            <View style={styles.buttonContent}>
              <Text style={styles.emergencyButtonTitle}>Polícia</Text>
              <Text style={styles.emergencyButtonNumber}>190</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => handleEmergencyCall('193', 'Bombeiros')}
          >
            <Ionicons name="flame" size={24} color="#fff" />
            <View style={styles.buttonContent}>
              <Text style={styles.emergencyButtonTitle}>Bombeiros</Text>
              <Text style={styles.emergencyButtonNumber}>193</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => handleEmergencyCall('192', 'SAMU')}
          >
            <Ionicons name="medical" size={24} color="#fff" />
            <View style={styles.buttonContent}>
              <Text style={styles.emergencyButtonTitle}>SAMU</Text>
              <Text style={styles.emergencyButtonNumber}>192</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => handleEmergencyCall('199', 'Defesa Civil')}
          >
            <Ionicons name="construct" size={24} color="#fff" />
            <View style={styles.buttonContent}>
              <Text style={styles.emergencyButtonTitle}>Defesa Civil</Text>
              <Text style={styles.emergencyButtonNumber}>199</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.sectionTitle}>📋 Instruções</Text>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>1.</Text>
            <Text style={styles.instructionText}>
              Mantenha a calma e fale claramente
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>2.</Text>
            <Text style={styles.instructionText}>
              Informe sua localização exata
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>3.</Text>
            <Text style={styles.instructionText}>
              Descreva a situação de emergência
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>4.</Text>
            <Text style={styles.instructionText}>
              Siga as orientações do atendente
            </Text>
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F44336',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  warningSection: {
    backgroundColor: '#FFEBEE',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F44336',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 10,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
    lineHeight: 20,
  },
  emergencySection: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  emergencyButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonContent: {
    marginLeft: 15,
    flex: 1,
  },
  emergencyButtonTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  emergencyButtonNumber: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
  instructionsSection: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
    marginRight: 10,
    minWidth: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
});