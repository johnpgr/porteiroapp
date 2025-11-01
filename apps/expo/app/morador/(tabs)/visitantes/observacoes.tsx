import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
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

const quickObservations = [
  '🔧 Manutenção do ar condicionado',
  '📦 Entrega de encomenda',
  '🏠 Visita familiar',
  '👨‍💼 Reunião de trabalho',
  '🎂 Festa de aniversário',
  '🍕 Entrega de comida',
  '🚗 Lavagem do carro',
  '📺 Instalação de TV',
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ObservacoesVisitante() {
  const { tipo, nome, cpf, foto, data, horaInicio, horaFim } = useLocalSearchParams<{
    tipo: VisitType;
    nome: string;
    cpf: string;
    foto: string;
    data: string;
    horaInicio: string;
    horaFim: string;
  }>();

  const [observacoes, setObservacoes] = useState('');
  const [autoAuthorize, setAutoAuthorize] = useState(false);

  const addQuickObservation = (observation: string) => {
    if (observacoes.trim()) {
      setObservacoes((prev) => prev + '\n' + observation);
    } else {
      setObservacoes(observation);
    }
  };

  const handleNext = () => {
    router.push({
      pathname: '/morador/visitantes/confirmacao',
      params: {
        tipo: tipo || 'social',
        nome: nome || '',
        cpf: cpf || '',
        foto: foto || '',
        data: data || '',
        horaInicio: horaInicio || '',
        horaFim: horaFim || '',
        observacoes: observacoes.trim(),
        autoAuthorize: autoAuthorize.toString(),
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/morador/visitantes/confirmacao',
      params: {
        tipo: tipo || 'social',
        nome: nome || '',
        cpf: cpf || '',
        foto: foto || '',
        data: data || '',
        horaInicio: horaInicio || '',
        horaFim: horaFim || '',
        observacoes: '',
        autoAuthorize: autoAuthorize.toString(),
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <View style={styles.container}>
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
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Passo 6 de 7</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.typeIndicator}>
            <Text style={styles.typeIndicatorText}>
              {visitTypeLabels[tipo as VisitType] || '👥 Visita Social'}
            </Text>
          </View>

          <View style={styles.visitorInfo}>
            <Text style={styles.visitorName}>👤 {nome}</Text>
            {cpf && <Text style={styles.visitorCpf}>📄 {cpf}</Text>}
            {data && (
              <Text style={styles.visitorDate}>
                📅 {formatDate(data)} • 🕐 {formatTime(horaInicio || '')} -{' '}
                {formatTime(horaFim || '')}
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.sectionDescription}>
              Adicione informações extras sobre a visita (opcional)
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Observações</Text>
              <TextInput
                style={styles.textArea}
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Ex: Visitante irá trazer equipamentos para manutenção..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.inputHelper}>{observacoes.length}/500 caracteres</Text>
            </View>

            <View style={styles.quickObservationsContainer}>
              <Text style={styles.quickObservationsTitle}>💡 Sugestões Rápidas</Text>
              <View style={styles.quickObservationsGrid}>
                {quickObservations.map((observation, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickObservationButton}
                    onPress={() => addQuickObservation(observation)}>
                    <Text style={styles.quickObservationText}>{observation}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.autoAuthorizeContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAutoAuthorize(!autoAuthorize)}>
                <View style={[styles.checkbox, autoAuthorize && styles.checkboxChecked]}>
                  {autoAuthorize && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.checkboxTextContainer}>
                  <Text style={styles.checkboxTitle}>🚪 Autorizar entrada automaticamente</Text>
                  <Text style={styles.checkboxDescription}>
                    O visitante poderá entrar sem aprovação manual no período definido
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.tipContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.tipText}>
                As observações ajudam o porteiro a identificar o motivo da visita
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.backFooterButtonText}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Pular</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
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
    marginBottom: 12,
    alignItems: 'center',
  },
  typeIndicatorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  visitorInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorCpf: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorDate: {
    fontSize: 14,
    color: '#666',
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
    marginBottom: 20,
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
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    minHeight: 100,
  },
  inputHelper: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  quickObservationsContainer: {
    marginBottom: 30,
  },
  quickObservationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickObservationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickObservationButton: {
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  quickObservationText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  autoAuthorizeContainer: {
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#FF9800',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
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
    gap: 8,
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
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
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
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
