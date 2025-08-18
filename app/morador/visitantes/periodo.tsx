import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import ProtectedRoute from '~/components/ProtectedRoute';

type VisitType = 'social' | 'service' | 'delivery' | 'car';

const visitTypeLabels = {
  social: '👥 Visita Social',
  service: '🔧 Prestador de Serviço',
  delivery: '📦 Entregador',
  car: '🚗 Carro',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PeriodoVisitante() {
  const { tipo, nome, cpf, foto } = useLocalSearchParams<{ 
    tipo: VisitType; 
    nome: string; 
    cpf: string;
    foto: string;
  }>();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleStartTimeChange = (event: any, time?: Date) => {
    setShowStartTimePicker(false);
    if (time) {
      setStartTime(time);
      // Automatically set end time to 2 hours later
      const newEndTime = new Date(time);
      newEndTime.setHours(time.getHours() + 2);
      setEndTime(newEndTime);
    }
  };

  const handleEndTimeChange = (event: any, time?: Date) => {
    setShowEndTimePicker(false);
    if (time) {
      if (time <= startTime) {
        Alert.alert('Horário inválido', 'O horário de fim deve ser posterior ao horário de início');
        return;
      }
      setEndTime(time);
    }
  };

  const setToday = () => {
    setSelectedDate(new Date());
  };

  const setTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
  };

  const handleNext = () => {
    const now = new Date();
    const visitDateTime = new Date(selectedDate);
    visitDateTime.setHours(startTime.getHours(), startTime.getMinutes());
    
    if (visitDateTime < now) {
      Alert.alert('Data/horário inválido', 'A visita não pode ser agendada para o passado');
      return;
    }
    
    router.push({
      pathname: '/morador/visitantes/observacoes',
      params: { 
        tipo: tipo || 'social',
        nome: nome || '',
        cpf: cpf || '',
        foto: foto || '',
        data: selectedDate.toISOString(),
        horaInicio: startTime.toISOString(),
        horaFim: endTime.toISOString()
      }
    });
  };

  const handleBack = () => {
    router.back();
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isTomorrow = selectedDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

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
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
            </View>
            <Text style={styles.progressText}>Passo 5 de 7</Text>
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
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Período da Visita</Text>
              <Text style={styles.sectionDescription}>
                Defina quando a visita irá acontecer
              </Text>

              <View style={styles.dateSection}>
                <Text style={styles.subsectionTitle}>📅 Data da Visita</Text>
                
                <View style={styles.quickDateButtons}>
                  <TouchableOpacity 
                    style={[styles.quickDateButton, isToday && styles.quickDateButtonActive]}
                    onPress={setToday}
                  >
                    <Text style={[styles.quickDateButtonText, isToday && styles.quickDateButtonTextActive]}>
                      Hoje
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.quickDateButton, isTomorrow && styles.quickDateButtonActive]}
                    onPress={setTomorrow}
                  >
                    <Text style={[styles.quickDateButtonText, isTomorrow && styles.quickDateButtonTextActive]}>
                      Amanhã
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.quickDateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={16} color="#4CAF50" />
                    <Text style={styles.quickDateButtonText}>Outro</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.dateDisplay}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#4CAF50" />
                  <Text style={styles.dateDisplayText}>{formatDate(selectedDate)}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timeSection}>
                <Text style={styles.subsectionTitle}>🕐 Horário da Visita</Text>
                
                <View style={styles.timeContainer}>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={styles.timeLabel}>Início</Text>
                    <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.timeSeparator}>
                    <Text style={styles.timeSeparatorText}>até</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={styles.timeLabel}>Fim</Text>
                    <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  O visitante poderá entrar apenas no período definido
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.backFooterButton}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backFooterButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {showStartTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              display="default"
              onChange={handleStartTimeChange}
            />
          )}

          {showEndTimePicker && (
            <DateTimePicker
              value={endTime}
              mode="time"
              display="default"
              onChange={handleEndTimeChange}
            />
          )}
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
    paddingBottom: 100, // Espaço extra para o footer
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
  dateSection: {
    marginBottom: 30,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  quickDateButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickDateButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  quickDateButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e8',
  },
  quickDateButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginLeft: 4,
  },
  quickDateButtonTextActive: {
    color: '#4CAF50',
  },
  dateDisplay: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  dateDisplayText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
    textTransform: 'capitalize',
  },
  timeSection: {
    marginBottom: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timeSeparator: {
    alignItems: 'center',
  },
  timeSeparatorText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
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
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});