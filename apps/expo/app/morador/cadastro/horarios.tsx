import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';

type TimeSlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  icon: string;
  description: string;
};

const timeSlots: TimeSlot[] = [
  {
    id: 'full_day',
    label: 'Dia Todo',
    startTime: '00:00',
    endTime: '23:59',
    icon: '🌅',
    description: '24 horas por dia',
  },
  {
    id: 'business_hours',
    label: 'Horário Comercial',
    startTime: '08:00',
    endTime: '18:00',
    icon: '🏢',
    description: '8h às 18h',
  },
  {
    id: 'morning',
    label: 'Manhã',
    startTime: '06:00',
    endTime: '12:00',
    icon: '🌅',
    description: '6h às 12h',
  },
  {
    id: 'afternoon',
    label: 'Tarde',
    startTime: '12:00',
    endTime: '18:00',
    icon: '☀️',
    description: '12h às 18h',
  },
  {
    id: 'evening',
    label: 'Noite',
    startTime: '18:00',
    endTime: '23:59',
    icon: '🌙',
    description: '18h às 23h59',
  },
  {
    id: 'custom',
    label: 'Personalizado',
    startTime: '09:00',
    endTime: '17:00',
    icon: '⚙️',
    description: 'Definir horário específico',
  },
];

export default function HorariosCadastro() {
  const { nome, relacionamento, telefone, placa, acesso, foto, dias } = useLocalSearchParams<{
    nome: string;
    relacionamento: string;
    telefone: string;
    placa: string;
    acesso: string;
    foto: string;
    dias: string;
  }>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('full_day'); // Default to full day
  const [customStartTime, setCustomStartTime] = useState('09:00');
  const [customEndTime, setCustomEndTime] = useState('17:00');
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    setIsLoading(true);

    try {
      // Simulate API call to save the registration
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.alert(
        'Cadastro Realizado! 🎉',
        `${nome} foi cadastrado(a) com sucesso!\n\nVocê pode visualizar e editar este cadastro na lista de pessoas cadastradas.`,
        [
          {
            text: 'Ver Lista',
            onPress: () => router.push('/morador'),
          },
          {
            text: 'Novo Cadastro',
            onPress: () => router.push('/morador/cadastro/novo'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erro no Cadastro', 'Ocorreu um erro ao salvar o cadastro. Tente novamente.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsLoading(false);
    }
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

  const getDaysLabel = (daysString: string) => {
    if (!daysString) return 'Nenhum dia';

    const dayIds = daysString.split(',');
    const dayLabels: { [key: string]: string } = {
      monday: 'SEG',
      tuesday: 'TER',
      wednesday: 'QUA',
      thursday: 'QUI',
      friday: 'SEX',
      saturday: 'SÁB',
      sunday: 'DOM',
    };

    if (dayIds.length === 7) return 'Todos os dias';

    return dayIds.map((id) => dayLabels[id] || '').join(', ');
  };

  const getSelectedTimeSlotData = () => {
    const slot = timeSlots.find((s) => s.id === selectedTimeSlot);
    if (!slot) return null;

    if (selectedTimeSlot === 'custom') {
      return {
        ...slot,
        startTime: customStartTime,
        endTime: customEndTime,
        description: `${customStartTime} às ${customEndTime}`,
      };
    }

    return slot;
  };

  const selectedSlotData = getSelectedTimeSlotData();

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>⏰ Novo Cadastro</Text>
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
            <View style={[styles.progressStep, styles.progressStepActive]} />
          </View>
          <Text style={styles.progressText}>Passo 8 de 8 - Finalização</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>👤 {nome}</Text>
            <Text style={styles.personRelationship}>
              {getRelationshipLabel(relacionamento || '')}
            </Text>
            <Text style={styles.personPhone}>📱 {telefone}</Text>
            {placa && <Text style={styles.personPlate}>🚗 {placa}</Text>}
            <Text style={styles.personAccess}>{getAccessLabel(acesso || '')}</Text>
            <Text style={styles.personDays}>📅 {getDaysLabel(dias || '')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horários Permitidos</Text>
            <Text style={styles.sectionDescription}>
              Defina os horários em que esta pessoa pode acessar o condomínio
            </Text>

            <View style={styles.timeSlotsList}>
              {timeSlots.map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.timeSlotCard,
                    selectedTimeSlot === slot.id && styles.timeSlotCardSelected,
                  ]}
                  onPress={() => setSelectedTimeSlot(slot.id)}>
                  <View style={styles.timeSlotIcon}>
                    <Text style={styles.timeSlotIconText}>{slot.icon}</Text>
                  </View>

                  <View style={styles.timeSlotInfo}>
                    <Text
                      style={[
                        styles.timeSlotLabel,
                        selectedTimeSlot === slot.id && styles.timeSlotLabelSelected,
                      ]}>
                      {slot.label}
                    </Text>
                    <Text
                      style={[
                        styles.timeSlotDescription,
                        selectedTimeSlot === slot.id && styles.timeSlotDescriptionSelected,
                      ]}>
                      {slot.description}
                    </Text>
                  </View>

                  <View style={styles.timeSlotCheck}>
                    {selectedTimeSlot === slot.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {selectedTimeSlot === 'custom' && (
              <View style={styles.customTimeContainer}>
                <Text style={styles.customTimeTitle}>⚙️ Horário Personalizado</Text>
                <View style={styles.customTimeInputs}>
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.timeInputLabel}>Início:</Text>
                    <TouchableOpacity style={styles.timeInput}>
                      <Text style={styles.timeInputText}>{customStartTime}</Text>
                      <Ionicons name="time" size={20} color="#2196F3" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.timeInputGroup}>
                    <Text style={styles.timeInputLabel}>Fim:</Text>
                    <TouchableOpacity style={styles.timeInput}>
                      <Text style={styles.timeInputText}>{customEndTime}</Text>
                      <Ionicons name="time" size={20} color="#2196F3" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.customTimePresets}>
                  <Text style={styles.presetsTitle}>Sugestões:</Text>
                  <View style={styles.presetsList}>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setCustomStartTime('07:00');
                        setCustomEndTime('19:00');
                      }}>
                      <Text style={styles.presetText}>7h-19h</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setCustomStartTime('09:00');
                        setCustomEndTime('17:00');
                      }}>
                      <Text style={styles.presetText}>9h-17h</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setCustomStartTime('14:00');
                        setCustomEndTime('22:00');
                      }}>
                      <Text style={styles.presetText}>14h-22h</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {selectedSlotData && (
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedInfoTitle}>⏰ Horário selecionado:</Text>
                <Text style={styles.selectedInfoText}>
                  {selectedSlotData.icon} {selectedSlotData.label} - {selectedSlotData.description}
                </Text>
              </View>
            )}

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>📋 Resumo do Cadastro</Text>
              <View style={styles.summaryContent}>
                <Text style={styles.summaryItem}>👤 Nome: {nome}</Text>
                <Text style={styles.summaryItem}>
                  👥 Relacionamento:{' '}
                  {getRelationshipLabel(relacionamento || '').replace(/^[^\s]+\s/, '')}
                </Text>
                <Text style={styles.summaryItem}>📱 Telefone: {telefone}</Text>
                {placa && <Text style={styles.summaryItem}>🚗 Placa: {placa}</Text>}
                <Text style={styles.summaryItem}>
                  🔐 Acesso: {getAccessLabel(acesso || '').replace(/^[^\s]+\s/, '')}
                </Text>
                <Text style={styles.summaryItem}>📅 Dias: {getDaysLabel(dias || '')}</Text>
                <Text style={styles.summaryItem}>⏰ Horários: {selectedSlotData?.description}</Text>
              </View>
            </View>

            <View style={styles.tipContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.tipText}>
                Após finalizar, você poderá editar todas essas informações na lista de pessoas
                cadastradas
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.backFooterButtonText}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.finishButton, isLoading && styles.finishButtonDisabled]}
            onPress={handleFinish}
            disabled={isLoading}>
            {isLoading ? (
              <>
                <Text style={styles.finishButtonText}>Salvando...</Text>
                <Ionicons name="hourglass" size={20} color="#fff" />
              </>
            ) : (
              <>
                <Text style={styles.finishButtonText}>Finalizar Cadastro</Text>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </>
            )}
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
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
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
    marginBottom: 2,
  },
  personDays: {
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
    marginBottom: 20,
    lineHeight: 22,
  },
  timeSlotsList: {
    marginBottom: 20,
  },
  timeSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  timeSlotCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  timeSlotIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  timeSlotIconText: {
    fontSize: 24,
  },
  timeSlotInfo: {
    flex: 1,
  },
  timeSlotLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  timeSlotLabelSelected: {
    color: '#2196F3',
  },
  timeSlotDescription: {
    fontSize: 14,
    color: '#666',
  },
  timeSlotDescriptionSelected: {
    color: '#1976D2',
  },
  timeSlotCheck: {
    width: 30,
    alignItems: 'center',
  },
  customTimeContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  customTimeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 16,
    textAlign: 'center',
  },
  customTimeInputs: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeInputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timeInputText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  customTimePresets: {
    marginTop: 8,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  presetsList: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  presetText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  selectedInfo: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  selectedInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  selectedInfoText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryContent: {
    gap: 8,
  },
  summaryItem: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
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
  finishButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
