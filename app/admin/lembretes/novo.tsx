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
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useLembretes } from '~/hooks/useLembretes';
import { adminAuth } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FormData {
  titulo: string;
  descricao: string;
  tipo: 'manutencao' | 'reuniao' | 'vencimento' | 'outros';
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
        'Lembrete criado com sucesso!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Erro ao criar lembrete:', error);
      Alert.alert('Erro', 'Falha ao criar lembrete. Tente novamente.');
    }
  };

  const showDatePickerModal = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: formData.data_vencimento,
        onChange: (event, selectedDate) => {
          if (selectedDate) {
            setFormData(prev => ({ ...prev, data_vencimento: selectedDate }));
          }
        },
        mode: 'date',
        minimumDate: new Date(),
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const showTimePickerModal = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: formData.data_vencimento,
        onChange: (event, selectedDate) => {
          if (selectedDate) {
            setFormData(prev => ({ ...prev, data_vencimento: selectedDate }));
          }
        },
        mode: 'time',
        is24Hour: true,
      });
    } else {
      setShowTimePicker(true);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        setFormData(prev => ({ ...prev, data_vencimento: selectedDate }));
      }
    }
    setShowDatePicker(false);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        setFormData(prev => ({ ...prev, data_vencimento: selectedDate }));
      }
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Lembrete</Text>
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
              placeholder="Digite o título do lembrete"
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
              placeholder="Descreva os detalhes do lembrete"
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
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.tipo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Manutenção" value="manutencao" />
                  <Picker.Item label="Reunião" value="reuniao" />
                  <Picker.Item label="Vencimento" value="vencimento" />
                  <Picker.Item label="Outros" value="outros" />
                </Picker>
              </View>
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Prioridade</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.prioridade}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, prioridade: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Baixa" value="baixa" />
                  <Picker.Item label="Média" value="media" />
                  <Picker.Item label="Alta" value="alta" />
                </Picker>
              </View>
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
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.notificar_antes}
                onValueChange={(value) => setFormData(prev => ({ ...prev, notificar_antes: value }))}
                style={styles.picker}
              >
                <Picker.Item label="15 minutos antes" value={15} />
                <Picker.Item label="30 minutos antes" value={30} />
                <Picker.Item label="1 hora antes" value={60} />
                <Picker.Item label="2 horas antes" value={120} />
                <Picker.Item label="1 dia antes" value={1440} />
                <Picker.Item label="2 dias antes" value={2880} />
                <Picker.Item label="1 semana antes" value={10080} />
              </Picker>
            </View>
          </View>

          {formData.recorrente && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Frequência de Recorrência</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.frequencia_recorrencia || 'mensal'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, frequencia_recorrencia: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Diária" value="diaria" />
                  <Picker.Item label="Semanal" value="semanal" />
                  <Picker.Item label="Mensal" value="mensal" />
                  <Picker.Item label="Anual" value="anual" />
                </Picker>
              </View>
            </View>
          )}
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
            {loading ? 'Criando...' : 'Criar Lembrete'}
          </Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={formData.data_vencimento}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        </View>
      )}

      {showTimePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={formData.data_vencimento}
            mode="time"
            display="default"
            onChange={onTimeChange}
            is24Hour={true}
          />
        </View>
      )}
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
});