import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';

type DayOfWeek = {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
};

const daysOfWeek: DayOfWeek[] = [
  { id: 'monday', label: 'Segunda-feira', shortLabel: 'SEG', icon: '📅' },
  { id: 'tuesday', label: 'Terça-feira', shortLabel: 'TER', icon: '📅' },
  { id: 'wednesday', label: 'Quarta-feira', shortLabel: 'QUA', icon: '📅' },
  { id: 'thursday', label: 'Quinta-feira', shortLabel: 'QUI', icon: '📅' },
  { id: 'friday', label: 'Sexta-feira', shortLabel: 'SEX', icon: '📅' },
  { id: 'saturday', label: 'Sábado', shortLabel: 'SÁB', icon: '🎉' },
  { id: 'sunday', label: 'Domingo', shortLabel: 'DOM', icon: '🎉' },
];

export default function DiasCadastro() {
  const { nome, relacionamento, telefone, placa, acesso, foto } = useLocalSearchParams<{
    nome: string;
    relacionamento: string;
    telefone: string;
    placa: string;
    acesso: string;
    foto: string;
  }>();
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]); // Default to weekdays

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayId)) {
        return prev.filter((id) => id !== dayId);
      } else {
        return [...prev, dayId];
      }
    });
  };

  const selectAllDays = () => {
    setSelectedDays(daysOfWeek.map((day) => day.id));
  };

  const selectWeekdays = () => {
    setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  };

  const selectWeekends = () => {
    setSelectedDays(['saturday', 'sunday']);
  };

  const clearAll = () => {
    setSelectedDays([]);
  };

  const handleNext = () => {
    router.push({
      pathname: '/morador/cadastro/horarios',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: telefone || '',
        placa: placa || '',
        acesso: acesso || '',
        foto: foto || '',
        dias: selectedDays.join(','),
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const getRelationshipLabel = (rel: string) => {
    const relationships: { [key: string]: string } = {
      conjuge: '💑 Cônjuge',
      filho: '👶 Filho(a)',
      pai_mae: '👨‍👩‍👧‍👦 Pai/Mãe',
      irmao: '👫 Irmão/Irmã',
      familiar: '👪 Outro Familiar',
      amigo: '👥 Amigo(a)',
      funcionario: '🏠 Funcionário',
      prestador: '🔧 Prestador de Serviço',
      motorista: '🚗 Motorista',
      outro: '👤 Outro',
    };
    return relationships[rel] || rel;
  };

  const getAccessLabel = (acc: string) => {
    const accessTypes: { [key: string]: string } = {
      sem_acesso: '🚫 Sem Acesso',
      usuario: '👤 Usuário',
      administrador: '👑 Administrador',
    };
    return accessTypes[acc] || acc;
  };

  const getSelectedDaysText = () => {
    if (selectedDays.length === 0) return 'Nenhum dia selecionado';
    if (selectedDays.length === 7) return 'Todos os dias';

    const selectedLabels = selectedDays
      .map((dayId) => {
        const day = daysOfWeek.find((d) => d.id === dayId);
        return day?.shortLabel || '';
      })
      .join(', ');

    return selectedLabels;
  };

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>📅 Novo Cadastro</Text>
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
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Passo 7 de 8</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>👤 {nome}</Text>
            <Text style={styles.personRelationship}>
              {getRelationshipLabel(relacionamento || '')}
            </Text>
            <Text style={styles.personPhone}>📱 {telefone}</Text>
            {placa && <Text style={styles.personPlate}>🚗 {placa}</Text>}
            <Text style={styles.personAccess}>{getAccessLabel(acesso || '')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dias Permitidos</Text>
            <Text style={styles.sectionDescription}>
              Selecione os dias da semana em que esta pessoa pode acessar o condomínio
            </Text>

            <View style={styles.quickActions}>
              <Text style={styles.quickActionsTitle}>🚀 Ações rápidas:</Text>
              <View style={styles.quickActionsList}>
                <TouchableOpacity style={styles.quickActionButton} onPress={selectAllDays}>
                  <Text style={styles.quickActionText}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={selectWeekdays}>
                  <Text style={styles.quickActionText}>Úteis</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={selectWeekends}>
                  <Text style={styles.quickActionText}>Fins de Semana</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                  <Text style={styles.clearButtonText}>Limpar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.daysList} showsVerticalScrollIndicator={false}>
              {daysOfWeek.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayCard, selectedDays.includes(day.id) && styles.dayCardSelected]}
                  onPress={() => toggleDay(day.id)}>
                  <View style={styles.dayIcon}>
                    <Text style={styles.dayIconText}>{day.icon}</Text>
                  </View>

                  <View style={styles.dayInfo}>
                    <Text
                      style={[
                        styles.dayLabel,
                        selectedDays.includes(day.id) && styles.dayLabelSelected,
                      ]}>
                      {day.label}
                    </Text>
                    <Text
                      style={[
                        styles.dayShortLabel,
                        selectedDays.includes(day.id) && styles.dayShortLabelSelected,
                      ]}>
                      {day.shortLabel}
                    </Text>
                  </View>

                  <View style={styles.dayCheck}>
                    {selectedDays.includes(day.id) ? (
                      <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={24} color="#ccc" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.selectedInfo}>
              <Text style={styles.selectedInfoTitle}>📋 Dias selecionados:</Text>
              <Text style={styles.selectedInfoText}>{getSelectedDaysText()}</Text>
            </View>

            <View style={styles.tipContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.tipText}>
                Você pode alterar os dias permitidos posteriormente nas configurações
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
            style={[styles.nextButton, selectedDays.length === 0 && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={selectedDays.length === 0}>
            <Text
              style={[
                styles.nextButtonText,
                selectedDays.length === 0 && styles.nextButtonTextDisabled,
              ]}>
              Continuar
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={selectedDays.length === 0 ? '#ccc' : '#fff'}
            />
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
    backgroundColor: '#2196F3',
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
    width: 25,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  personInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  personRelationship: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPlate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personAccess: {
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
    flex: 1,
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
    marginBottom: 20,
    lineHeight: 22,
  },
  quickActions: {
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickActionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  quickActionText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  clearButton: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '500',
  },
  daysList: {
    flex: 1,
    marginBottom: 20,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  dayCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  dayIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  dayIconText: {
    fontSize: 24,
  },
  dayInfo: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  dayLabelSelected: {
    color: '#2196F3',
  },
  dayShortLabel: {
    fontSize: 14,
    color: '#666',
  },
  dayShortLabelSelected: {
    color: '#1976D2',
  },
  dayCheck: {
    width: 30,
    alignItems: 'center',
  },
  selectedInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  selectedInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectedInfoText: {
    fontSize: 16,
    color: '#2196F3',
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
    backgroundColor: '#2196F3',
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
