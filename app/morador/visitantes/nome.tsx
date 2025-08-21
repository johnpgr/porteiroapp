import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';

type VisitType = 'social' | 'service' | 'delivery' | 'car';

const visitTypeLabels = {
  social: '👥 Visita Social',
  service: '🔧 Prestador de Serviço',
  delivery: '📦 Entregador',
  car: '🚗 Carro',
};

export default function NomeVisitante() {
  const { tipo } = useLocalSearchParams<{ tipo: VisitType }>();
  const [nome, setNome] = useState('');

  const handleNext = () => {
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Por favor, digite o nome do visitante');
      return;
    }

    router.push({
      pathname: '/morador/visitantes/cpf',
      params: {
        tipo: tipo || 'social',
        nome: nome.trim(),
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>👥 Novo Visitante</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Passo 2 de 7</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.typeIndicator}>
            <Text style={styles.typeIndicatorText}>
              {visitTypeLabels[tipo as VisitType] || '👥 Visita Social'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nome do Visitante</Text>
            <Text style={styles.sectionDescription}>
              Digite o nome completo da pessoa que irá visitar
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Ex: João Silva Santos"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={100}
              />
              <Text style={styles.inputHelper}>{nome.length}/100 caracteres</Text>
            </View>

            <View style={styles.tipContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.tipText}>
                Digite o nome completo para facilitar a identificação na portaria
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.backFooterButtonText}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, !nome.trim() && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!nome.trim()}>
            <Text style={[styles.nextButtonText, !nome.trim() && styles.nextButtonTextDisabled]}>
              Continuar
            </Text>
            <Ionicons name="arrow-forward" size={20} color={nome.trim() ? '#fff' : '#ccc'} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressStep: {
    width: 30,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  typeIndicator: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  typeIndicatorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputHelper: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 12,
  },
  backFooterButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextButtonTextDisabled: {
    color: '#ccc',
  },
});
