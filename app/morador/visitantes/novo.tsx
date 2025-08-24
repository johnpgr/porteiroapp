import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';
import BottomNav from '~/components/BottomNav';
import { flattenStyles } from '~/utils/styles';

type VisitType = 'social' | 'service' | 'delivery' | 'car';

interface VisitTypeOption {
  id: VisitType;
  title: string;
  emoji: string;
  description: string;
  color: string;
}

const visitTypes: VisitTypeOption[] = [
  {
    id: 'social',
    title: 'Visita Social',
    emoji: '👥',
    description: 'Amigos, familiares ou conhecidos',
    color: '#4CAF50',
  },
  {
    id: 'service',
    title: 'Prestador de Serviço',
    emoji: '🔧',
    description: 'Técnicos, reparadores, profissionais',
    color: '#2196F3',
  },
  {
    id: 'delivery',
    title: 'Entregador',
    emoji: '📦',
    description: 'Delivery, encomendas, correios',
    color: '#FF9800',
  },
  {
    id: 'car',
    title: 'Carro',
    emoji: '🚗',
    description: 'Visitante com veículo',
    color: '#9C27B0',
  },
];

export default function NovoVisitante() {
  const [selectedType, setSelectedType] = useState<VisitType | null>(null);

  const handleNext = () => {
    if (!selectedType) return;

    router.push({
      pathname: '/morador/visitantes/nome',
      params: { tipo: selectedType },
    });
  };

  const renderVisitTypeCard = (visitType: VisitTypeOption) => (
    <TouchableOpacity
      key={visitType.id}
      style={[
        styles.typeCard,
        selectedType === visitType.id && styles.typeCardSelected,
        { borderLeftColor: visitType.color },
      ]}
      onPress={() => setSelectedType(visitType.id)}>
      <View style={styles.typeCardContent}>
        <View style={styles.typeCardHeader}>
          <Text style={styles.typeEmoji}>{visitType.emoji}</Text>
          <Text style={styles.typeTitle}>{visitType.title}</Text>
        </View>
        <Text style={styles.typeDescription}>{visitType.description}</Text>
      </View>

      <View style={styles.radioContainer}>
        <View style={[styles.radio, selectedType === visitType.id && styles.radioSelected]}>
          {selectedType === visitType.id && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>👥 Novo Visitante</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={flattenStyles([styles.progressStep, styles.progressStepActive])} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Passo 1 de 7</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Visita</Text>
            <Text style={styles.sectionDescription}>
              Selecione o tipo de visita que melhor descreve o visitante
            </Text>

            <View style={styles.typesContainer}>{visitTypes.map(renderVisitTypeCard)}</View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !selectedType && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!selectedType}>
            <Text style={[styles.nextButtonText, !selectedType && styles.nextButtonTextDisabled]}>
              Continuar
            </Text>
            <Ionicons name="arrow-forward" size={20} color={selectedType ? '#fff' : '#ccc'} />
          </TouchableOpacity>
        </View>
        <BottomNav activeTab="visitantes" />
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
  },
  section: {
    padding: 20,
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
  typesContainer: {
    gap: 16,
  },
  typeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  typeCardSelected: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  typeCardContent: {
    flex: 1,
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  typeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  radioContainer: {
    marginLeft: 16,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  nextButton: {
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
