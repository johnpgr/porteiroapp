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
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
  status: 'ativo' | 'concluido' | 'cancelado';
  data_vencimento: Date;
  notificar_antes: number;
  recorrente: boolean;
  frequencia_recorrencia?: 'diaria' | 'semanal' | 'mensal' | 'anual';
}

export default function DetalhesLembrete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getLembreteById,
    updateLembrete,
    deleteLembrete,
    getLembreteHistorico,
    loading
  } = useLembretes();

  const [lembrete, setLembrete] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [showHistorico, setShowHistorico] = useState(false);

  useEffect(() => {
    if (id) {
      checkAdminAuth();
      loadLembreteData();
    }
  }, [id]);

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

  const loadLembreteData = async () => {
    try {
      setLoadingData(true);
      const lembreteData = await getLembreteById(id!);
      if (lembreteData) {
        setLembrete(lembreteData);
        setFormData({
          titulo: lembreteData.titulo,
          descricao: lembreteData.descricao,
          tipo: lembreteData.tipo,
          prioridade: lembreteData.prioridade,
          status: lembreteData.status,
          data_vencimento: new Date(lembreteData.data_vencimento),
          notificar_antes: lembreteData.notificar_antes,
          recorrente: lembreteData.recorrente,
          frequencia_recorrencia: lembreteData.frequencia_recorrencia,
        });
        
        // Load historico
        const historicoData = await getLembreteHistorico(id!);
        setHistorico(historicoData || []);
      } else {
        Alert.alert('Erro', 'Lembrete não encontrado');
        router.back();
      }
    } catch (error) {
      console.error('Erro ao carregar lembrete:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do lembrete');
    } finally {
      setLoadingData(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData) return false;
    
    const newErrors: Partial<FormData> = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }

    if (!formData.descricao.trim()) {
      newErrors.descricao = 'Descrição é obrigatória';
    }

    if (formData.data_vencimento <= new Date() && formData.status === 'ativo') {
      newErrors.data_vencimento = new Date('Data deve ser futura para lembretes ativos');
    }

    if (formData.notificar_antes < 0) {
      newErrors.notificar_antes = 0;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!formData || !validateForm()) {
      Alert.alert('Erro', 'Por favor, corrija os campos destacados');
      return;
    }

    try {
      const updateData = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim(),
        tipo: formData.tipo,
        prioridade: formData.prioridade,
        status: formData.status,
        data_vencimento: formData.data_vencimento.toISOString(),
        notificar_antes: formData.notificar_antes,
        recorrente: formData.recorrente,
        frequencia_recorrencia: formData.recorrente ? formData.frequencia_recorrencia : null,
      };

      await updateLembrete(id!, updateData);
      setIsEditing(false);
      await loadLembreteData(); // Reload data
      Alert.alert('Sucesso', 'Lembrete atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar lembrete:', error);
      Alert.alert('Erro', 'Falha ao atualizar lembrete. Tente novamente.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este lembrete? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLembrete(id!);
              Alert.alert(
                'Sucesso',
                'Lembrete excluído com sucesso!',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              console.error('Erro ao excluir lembrete:', error);
              Alert.alert('Erro', 'Falha ao excluir lembrete.');
            }
          }
        }
      ]
    );
  };

  const showDatePickerModal = () => {
    if (!formData) return;
    
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: formData.data_vencimento,
        onChange: (event, selectedDate) => {
          if (selectedDate) {
            setFormData(prev => prev ? { ...prev, data_vencimento: selectedDate } : null);
          }
        },
        mode: 'date',
        minimumDate: formData.status === 'ativo' ? new Date() : undefined,
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const showTimePickerModal = () => {
    if (!formData) return;
    
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: formData.data_vencimento,
        onChange: (event, selectedDate) => {
          if (selectedDate) {
            setFormData(prev => prev ? { ...prev, data_vencimento: selectedDate } : null);
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
    if (Platform.OS === 'ios' && selectedDate) {
      setFormData(prev => prev ? { ...prev, data_vencimento: selectedDate } : null);
    }
    setShowDatePicker(false);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios' && selectedDate) {
      setFormData(prev => prev ? { ...prev, data_vencimento: selectedDate } : null);
    }
    setShowTimePicker(false);
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return '#ef4444';
      case 'media': return '#f59e0b';
      case 'baixa': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return '#3b82f6';
      case 'concluido': return '#10b981';
      case 'cancelado': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Carregando lembrete...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lembrete || !formData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Lembrete não encontrado</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Lembrete' : 'Detalhes do Lembrete'}
        </Text>
        <View style={styles.headerActions}>
          {!isEditing && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="create-outline" size={24} color="#374151" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!isEditing ? (
          // View Mode
          <View style={styles.viewContainer}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lembrete.status) }]}>
                <Text style={styles.statusText}>{lembrete.status.toUpperCase()}</Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPrioridadeColor(lembrete.prioridade) }]}>
                <Text style={styles.priorityText}>{lembrete.prioridade.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.title}>{lembrete.titulo}</Text>
            <Text style={styles.description}>{lembrete.descricao}</Text>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="pricetag-outline" size={20} color="#6b7280" />
                <Text style={styles.detailLabel}>Tipo:</Text>
                <Text style={styles.detailValue}>{lembrete.tipo}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text style={styles.detailLabel}>Vencimento:</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(lembrete.data_vencimento), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="notifications-outline" size={20} color="#6b7280" />
                <Text style={styles.detailLabel}>Notificar:</Text>
                <Text style={styles.detailValue}>
                  {lembrete.notificar_antes < 60
                    ? `${lembrete.notificar_antes} min antes`
                    : lembrete.notificar_antes < 1440
                    ? `${Math.floor(lembrete.notificar_antes / 60)}h antes`
                    : `${Math.floor(lembrete.notificar_antes / 1440)}d antes`}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="repeat-outline" size={20} color="#6b7280" />
                <Text style={styles.detailLabel}>Recorrente:</Text>
                <Text style={styles.detailValue}>
                  {lembrete.recorrente ? lembrete.frequencia_recorrencia || 'Sim' : 'Não'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color="#6b7280" />
                <Text style={styles.detailLabel}>Criado em:</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(lembrete.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </Text>
              </View>
            </View>

            {historico.length > 0 && (
              <View style={styles.historicoContainer}>
                <TouchableOpacity
                  style={styles.historicoHeader}
                  onPress={() => setShowHistorico(!showHistorico)}
                >
                  <Text style={styles.historicoTitle}>Histórico de Alterações</Text>
                  <Ionicons
                    name={showHistorico ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
                
                {showHistorico && (
                  <View style={styles.historicoList}>
                    {historico.map((item, index) => (
                      <View key={index} style={styles.historicoItem}>
                        <Text style={styles.historicoAction}>{item.acao}</Text>
                        <Text style={styles.historicoDate}>
                          {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </Text>
                        {item.detalhes && (
                          <Text style={styles.historicoDetails}>{item.detalhes}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          // Edit Mode
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={[styles.input, errors.titulo && styles.inputError]}
                value={formData.titulo}
                onChangeText={(text) => setFormData(prev => prev ? { ...prev, titulo: text } : null)}
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
                onChangeText={(text) => setFormData(prev => prev ? { ...prev, descricao: text } : null)}
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
                    onValueChange={(value) => setFormData(prev => prev ? { ...prev, tipo: value } : null)}
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
                    onValueChange={(value) => setFormData(prev => prev ? { ...prev, prioridade: value } : null)}
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
              <Text style={styles.label}>Status</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.status}
                  onValueChange={(value) => setFormData(prev => prev ? { ...prev, status: value } : null)}
                  style={styles.picker}
                >
                  <Picker.Item label="Ativo" value="ativo" />
                  <Picker.Item label="Concluído" value="concluido" />
                  <Picker.Item label="Cancelado" value="cancelado" />
                </Picker>
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
                <Text style={styles.errorText}>Data deve ser futura para lembretes ativos</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notificar Antes</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.notificar_antes}
                  onValueChange={(value) => setFormData(prev => prev ? { ...prev, notificar_antes: value } : null)}
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

            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>Lembrete Recorrente</Text>
                <TouchableOpacity
                  style={[styles.switch, formData.recorrente && styles.switchActive]}
                  onPress={() => setFormData(prev => prev ? { ...prev, recorrente: !prev.recorrente } : null)}
                >
                  <View style={[styles.switchThumb, formData.recorrente && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>

            {formData.recorrente && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Frequência de Recorrência</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.frequencia_recorrencia || 'mensal'}
                    onValueChange={(value) => setFormData(prev => prev ? { ...prev, frequencia_recorrencia: value } : null)}
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
        )}
      </ScrollView>

      {isEditing && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setIsEditing(false);
              setFormData({
                titulo: lembrete.titulo,
                descricao: lembrete.descricao,
                tipo: lembrete.tipo,
                prioridade: lembrete.prioridade,
                status: lembrete.status,
                data_vencimento: new Date(lembrete.data_vencimento),
                notificar_antes: lembrete.notificar_antes,
                recorrente: lembrete.recorrente,
                frequencia_recorrencia: lembrete.frequencia_recorrencia,
              });
              setErrors({});
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={formData.data_vencimento}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={formData.status === 'ativo' ? new Date() : undefined}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  viewContainer: {
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  detailsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  historicoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  historicoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historicoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  historicoList: {
    padding: 16,
  },
  historicoItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historicoAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  historicoDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  historicoDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
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
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});