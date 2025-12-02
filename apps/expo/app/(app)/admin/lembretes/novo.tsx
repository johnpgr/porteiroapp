import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';
import { router } from 'expo-router';
import { useLembretes } from '~/hooks/useLembretes';
import { adminAuth, supabase } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BuildingAdmin {
  id: string;
  building_id: string;
  admin_profile_id: string;
  building: {
    name: string;
    address: string;
  };
}

interface FormData {
  titulo: string;
  descricao: string;
  tipo: 'manutencao' | 'reuniao' | 'pagamento' | 'assembleia' | 'outros';
  prioridade: 'baixa' | 'media' | 'alta';
  data_vencimento: Date;
  building_admin_id: string;
}

const initialFormData: FormData = {
  titulo: '',
  descricao: '',
  tipo: 'outros',
  prioridade: 'media',
  data_vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  building_admin_id: '',
};

export default function NovoLembrete() {
  const { createLembrete, loading } = useLembretes();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [showPrioridadePicker, setShowPrioridadePicker] = useState(false);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [buildingAdmins, setBuildingAdmins] = useState<BuildingAdmin[]>([]);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Bottom sheet refs
  const dateSheetRef = useRef<BottomSheetModalRef>(null);
  const timeSheetRef = useRef<BottomSheetModalRef>(null);
  const tipoSheetRef = useRef<BottomSheetModalRef>(null);
  const prioridadeSheetRef = useRef<BottomSheetModalRef>(null);
  const buildingSheetRef = useRef<BottomSheetModalRef>(null);

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

      // Load building_admins for the admin
      const { data: buildingAdminsData, error } = await supabase
        .from('building_admins')
        .select(
          `
          id,
          building_id,
          admin_profile_id,
          buildings (
            name,
            address
          )
        `
        )
        .eq('admin_profile_id', currentAdmin.id);

      if (error) {
        console.error('Erro ao buscar building_admins:', error);
        return;
      }

      const buildingAdminsFormatted =
        buildingAdminsData?.map((item: any) => ({
          id: item.id,
          building_id: item.building_id,
          admin_profile_id: item.admin_profile_id,
          building: item.buildings,
        })) || [];

      setBuildingAdmins(buildingAdminsFormatted);

      // Set the first building_admin as default if available
      if (buildingAdminsFormatted.length > 0) {
        setFormData((prev) => ({ ...prev, building_admin_id: buildingAdminsFormatted[0].id }));
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

    if (!formData.building_admin_id) {
      newErrors.building_admin_id = 'Prédio é obrigatório';
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
        building_admin_id: formData.building_admin_id,
      };

      await createLembrete(lembreteData);
      Alert.alert('Sucesso', 'Nota criado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
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
        shortLabel: format(date, 'dd/MM/yyyy', { locale: ptBR }),
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
          value: { hour, minute },
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
    setFormData((prev) => ({ ...prev, data_vencimento: newDate }));
    setShowDatePicker(false);
  };

  const updateTime = (time: { hour: number; minute: number }) => {
    const newDate = new Date(formData.data_vencimento);
    newDate.setHours(time.hour);
    newDate.setMinutes(time.minute);
    setFormData((prev) => ({ ...prev, data_vencimento: newDate }));
    setShowTimePicker(false);
  };

  const getTipoLabel = (tipo: string) => {
    const tipos: { [key: string]: string } = {
      manutencao: 'Manutenção',
      reuniao: 'Reunião',
      pagamento: 'Pagamento',
      assembleia: 'Assembleia',
      outros: 'Outros',
    };
    return tipos[tipo] || 'Outros';
  };

  const getPrioridadeLabel = (prioridade: string) => {
    const prioridades: { [key: string]: string } = {
      baixa: 'Baixa',
      media: 'Média',
      alta: 'Alta',
    };
    return prioridades[prioridade] || 'Média';
  };

  const getBuildingName = (buildingAdminId: string) => {
    const buildingAdmin = buildingAdmins.find((ba: any) => ba.id === buildingAdminId);
    return buildingAdmin ? buildingAdmin.building.name : 'Selecionar prédio';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>📝 Nova Nota</Text>
          <Text style={styles.headerSubtitle}>Criar lembrete</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={[styles.input, errors.titulo && styles.inputError]}
              value={formData.titulo}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, titulo: text }))}
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
              onChangeText={(text) => setFormData((prev) => ({ ...prev, descricao: text }))}
              placeholder="Descreva os detalhes da Nota"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            {errors.descricao && <Text style={styles.errorText}>{errors.descricao}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Prédio *</Text>
            <TouchableOpacity
              style={[styles.pickerButton, errors.building_admin_id && styles.inputError]}
              onPress={() => setShowBuildingPicker(true)}>
              <Text style={styles.pickerButtonText}>
                {getBuildingName(formData.building_admin_id)}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </TouchableOpacity>
            {errors.building_admin_id && (
              <Text style={styles.errorText}>{errors.building_admin_id}</Text>
            )}
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Tipo</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTipoPicker(true)}>
                <Text style={styles.pickerButtonText}>{getTipoLabel(formData.tipo)}</Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Prioridade</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPrioridadePicker(true)}>
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
                onPress={showDatePickerModal}>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text style={styles.dateTimeText}>
                  {format(formData.data_vencimento, 'dd/MM/yyyy', { locale: ptBR })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateTimeButton, { flex: 1, marginLeft: 8 }]}
                onPress={showTimePickerModal}>
                <Ionicons name="time-outline" size={20} color="#6b7280" />
                <Text style={styles.dateTimeText}>
                  {format(formData.data_vencimento, 'HH:mm', { locale: ptBR })}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.data_vencimento && <Text style={styles.errorText}>Data deve ser futura</Text>}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            <Text style={styles.submitButtonText}>{loading ? 'Criando...' : 'Criar Nota'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Sheet Modals */}
      <BottomSheetModal
        ref={dateSheetRef}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        snapPoints={65}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Selecionar Data</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {generateDateOptions().map((item, index) => {
            const isSelected = format(formData.data_vencimento, 'dd/MM/yyyy') === item.shortLabel;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => updateDate(item.value)}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {item.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={timeSheetRef}
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        snapPoints={70}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Selecionar Hora</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {generateTimeOptions().map((item, index) => {
            const isSelected = format(formData.data_vencimento, 'HH:mm') === item.label;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => updateTime(item.value)}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {item.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={tipoSheetRef}
        visible={showTipoPicker}
        onClose={() => setShowTipoPicker(false)}
        snapPoints={45}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Tipo da Nota</Text>
          <Text style={styles.sheetSubtitle}>Escolha a categoria</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {[
            { label: 'Manutenção', value: 'manutencao' },
            { label: 'Reunião', value: 'reuniao' },
            { label: 'Pagamento', value: 'pagamento' },
            { label: 'Assembleia', value: 'assembleia' },
            { label: 'Outros', value: 'outros' },
          ].map((item) => {
            const isSelected = formData.tipo === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => {
                  setFormData((prev) => ({ ...prev, tipo: item.value as any }));
                  setShowTipoPicker(false);
                }}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {item.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={prioridadeSheetRef}
        visible={showPrioridadePicker}
        onClose={() => setShowPrioridadePicker(false)}
        snapPoints={40}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Prioridade</Text>
          <Text style={styles.sheetSubtitle}>Defina a urgência</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {[
            { label: 'Baixa', value: 'baixa' },
            { label: 'Média', value: 'media' },
            { label: 'Alta', value: 'alta' },
          ].map((item) => {
            const isSelected = formData.prioridade === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                onPress={() => {
                  setFormData((prev) => ({ ...prev, prioridade: item.value as any }));
                  setShowPrioridadePicker(false);
                }}>
                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                  {item.label}
                </Text>
                {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={buildingSheetRef}
        visible={showBuildingPicker}
        onClose={() => setShowBuildingPicker(false)}
        snapPoints={60}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Prédio da Nota</Text>
        </View>
        <ScrollView style={styles.modalScrollView}>
          {buildingAdmins.length === 0 ? (
            <View style={styles.bottomSheetEmpty}>
              <Text style={styles.bottomSheetEmptyText}>Nenhum prédio disponível.</Text>
            </View>
          ) : (
            buildingAdmins.map((buildingAdmin) => {
              const isSelected = formData.building_admin_id === buildingAdmin.id;
              return (
                <TouchableOpacity
                  key={buildingAdmin.id}
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  onPress={() => {
                    setFormData((prev) => ({ ...prev, building_admin_id: buildingAdmin.id }));
                    setShowBuildingPicker(false);
                  }}>
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    {buildingAdmin.building.name}
                  </Text>
                  {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTextContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
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
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
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
  modalScrollView: {
    flex: 1,
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
  modalCheckmark: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSheetEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  bottomSheetEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
