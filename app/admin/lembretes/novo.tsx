import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useLembretes } from '~/hooks/useLembretes';
import { adminAuth } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FormData {
  titulo: string;
  descricao: string;
  tipo: 'manutencao' | 'reuniao' | 'pagamento' | 'assembleia' | 'outros';
  prioridade: 'baixa' | 'media' | 'alta';
  data_vencimento: Date;
  notificar_antes: number;
}

const initialFormData: FormData = {
  titulo: '',
  descricao: '',
  tipo: 'outros',
  prioridade: 'media',
  data_vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  notificar_antes: 60, // 1 hour
};

export default function NovoLembrete() {
  const { createLembrete, loading } = useLembretes();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [showPrioridadePicker, setShowPrioridadePicker] = useState(false);
  const [showNotificacaoPicker, setShowNotificacaoPicker] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        Alert.alert('Erro', 'Acesso negado');
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      router.push('/');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }

    if (!formData.descricao.trim()) {
      newErrors.descricao = 'Descrição é obrigatória';
    }

    if (formData.data_vencimento <= new Date()) {
      newErrors.data_vencimento = new Date('Data deve ser futura');
    }

    if (formData.notificar_antes < 0) {
      newErrors.notificar_antes = 0;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Erro', 'Por favor, corrija os campos destacados');
      return;
    }

    try {
      const lembreteData = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim(),
        categoria: formData.tipo,
        prioridade: formData.prioridade,
        data_vencimento: formData.data_vencimento.toISOString(),
        antecedencia_alerta: formData.notificar_antes,
      };

      await createLembrete(lembreteData);
      Alert.alert(
        'Sucesso',
        'Nota criado com sucesso!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Erro ao criar nota:', error);
      Alert.alert('Erro', 'Falha ao criar nota. Tente novamente.');
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  const showTimePickerModal = () => {
    setShowTimePicker(true);
  };

  const generateDateOptions = () => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      options.push({
        label: format(date, 'dd/MM/yyyy - EEEE', { locale: ptBR }),
        value: date,
        shortLabel: format(date, 'dd/MM/yyyy', { locale: ptBR })
      });
    }
    return options;
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push({
          label: timeString,
          value: { hour, minute }
        });
      }
    }
    return options;
  };

  const updateDate = (selectedDate: Date) => {
    const newDate = new Date(formData.data_vencimento);
    newDate.setFullYear(selectedDate.getFullYear());
    newDate.setMonth(selectedDate.getMonth());
    newDate.setDate(selectedDate.getDate());
    setFormData(prev => ({ ...prev, data_vencimento: newDate }));
    setShowDatePicker(false);
  };

  const updateTime = (time: { hour: number; minute: number }) => {
    const newDate = new Date(formData.data_vencimento);
    newDate.setHours(time.hour);
    newDate.setMinutes(time.minute);
    setFormData(prev => ({ ...prev, data_vencimento: newDate }));
    setShowTimePicker(false);
  };

  const getNotificationText = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutos antes`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hora${hours > 1 ? 's' : ''} antes`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} dia${days > 1 ? 's' : ''} antes`;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const tipos: {[key: string]: string} = {
      manutencao: 'Manutenção',
      reuniao: 'Reunião',
      pagamento: 'Pagamento',
      assembleia: 'Assembleia',
      outros: 'Outros'
    };
    return tipos[tipo] || 'Outros';
  };

  const getPrioridadeLabel = (prioridade: string) => {
    const prioridades: {[key: string]: string} = {
      baixa: 'Baixa',
      media: 'Média',
      alta: 'Alta'
    };
    return prioridades[prioridade] || 'Média';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Nota</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={[styles.input, errors.titulo && styles.inputError]}
              value={formData.titulo}
              onChangeText={(text) => setFormData(prev => ({ ...prev, titulo: text }))}
              placeholder="Digite o título da Nota"
              maxLength={100}
            />
            {errors.titulo && <Text style={styles.errorText}>{errors.titulo}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Descrição *</Text>
            <TextInput
              style={[styles.textArea, errors.descricao && styles.inputError]}
              value={formData.descricao}
              onChangeText={(text) => setFormData(prev => ({ ...prev, descricao: text }))}
              placeholder="Descreva os detalhes da Nota"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            {errors.descricao && <Text style={styles.errorText}>{errors.descricao}</Text>}
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Tipo</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowTipoPicker(true)}
              >
                <Text style={styles.pickerButtonText}>
                  {getTipoLabel(formData.tipo)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Prioridade</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPrioridadePicker(true)}
              >
                <Text style={styles.pickerButtonText}>
                  {getPrioridadeLabel(formData.prioridade)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Data e Hora de Vencimento *</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { flex: 1, marginRight: 8 }]}
                onPress={showDatePickerModal}
              >
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text style={styles.dateTimeText}>
                  {format(formData.data_vencimento, 'dd/MM/yyyy', { locale: ptBR })}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dateTimeButton, { flex: 1, marginLeft: 8 }]}
                onPress={showTimePickerModal}
              >
                <Ionicons name="time-outline" size={20} color="#6b7280" />
                <Text style={styles.dateTimeText}>
                  {format(formData.data_vencimento, 'HH:mm', { locale: ptBR })}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.data_vencimento && (
              <Text style={styles.errorText}>Data deve ser futura</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Notificar Antes</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowNotificacaoPicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {getNotificationText(formData.notificar_antes)}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Criando...' : 'Criar Nota'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal para Data */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Data</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {generateDateOptions().map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalOption,
                    format(formData.data_vencimento, 'dd/MM/yyyy') === item.shortLabel && styles.modalOptionSelected
                  ]}
                  onPress={() => updateDate(item.value)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    format(formData.data_vencimento, 'dd/MM/yyyy') === item.shortLabel && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {format(formData.data_vencimento, 'dd/MM/yyyy') === item.shortLabel && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Hora */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Hora</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {generateTimeOptions().map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalOption,
                    format(formData.data_vencimento, 'HH:mm') === item.label && styles.modalOptionSelected
                  ]}
                  onPress={() => updateTime(item.value)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    format(formData.data_vencimento, 'HH:mm') === item.label && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {format(formData.data_vencimento, 'HH:mm') === item.label && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Tipo */}
      <Modal
        visible={showTipoPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTipoPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Tipo</Text>
              <TouchableOpacity onPress={() => setShowTipoPicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { label: 'Manutenção', value: 'manutencao' },
                { label: 'Reunião', value: 'reuniao' },
                { label: 'Pagamento', value: 'pagamento' },
                { label: 'Assembleia', value: 'assembleia' },
                { label: 'Outros', value: 'outros' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalOption,
                    formData.tipo === item.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, tipo: item.value as any }));
                    setShowTipoPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    formData.tipo === item.value && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {formData.tipo === item.value && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Prioridade */}
      <Modal
        visible={showPrioridadePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPrioridadePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Prioridade</Text>
              <TouchableOpacity onPress={() => setShowPrioridadePicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { label: 'Baixa', value: 'baixa' },
                { label: 'Média', value: 'media' },
                { label: 'Alta', value: 'alta' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalOption,
                    formData.prioridade === item.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, prioridade: item.value as any }));
                    setShowPrioridadePicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    formData.prioridade === item.value && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {formData.prioridade === item.value && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Notificação */}
      <Modal
        visible={showNotificacaoPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotificacaoPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notificar Antes</Text>
              <TouchableOpacity onPress={() => setShowNotificacaoPicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { label: '15 minutos antes', value: 15 },
                { label: '30 minutos antes', value: 30 },
                { label: '1 hora antes', value: 60 },
                { label: '2 horas antes', value: 120 },
                { label: '1 dia antes', value: 1440 },
                { label: '2 dias antes', value: 2880 },
                { label: '1 semana antes', value: 10080 }
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalOption,
                    formData.notificar_antes === item.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, notificar_antes: item.value }));
                    setShowNotificacaoPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    formData.notificar_antes === item.value && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {formData.notificar_antes === item.value && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FF9800',
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    minHeight: 100,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  picker: {
    height: 50,
  },
  dateTimeContainer: {
    flexDirection: 'row',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: '#3b82f6',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  datePickerContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '70%',
    minWidth: '80%',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});