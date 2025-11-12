import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { MultipleVisitor, PreRegistrationData } from '~/components/morador/visitantes/types';
import { formatDate, formatTime } from '~/components/morador/visitantes/utils';

type RegistrationMode = 'individual' | 'multiple';

export default function PreRegistrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State management moved from parent
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('individual');
  const [preRegistrationData, setPreRegistrationData] = useState<PreRegistrationData>({
    name: '',
    phone: '',
    visit_type: 'pontual',
    access_type: 'com_aprovacao',
    visit_date: '',
    visit_start_time: '',
    visit_end_time: '',
    allowed_days: [],
    max_simultaneous_visits: 1,
    validity_start: '',
    validity_end: '',
  });
  const [multipleVisitors, setMultipleVisitors] = useState<MultipleVisitor[]>([
    { name: '', phone: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handler functions moved from parent
  const handleSelectRegistrationMode = useCallback((mode: RegistrationMode) => {
    setRegistrationMode(mode);
    if (mode === 'individual') {
      setMultipleVisitors([{ name: '', phone: '' }]);
    } else if (mode === 'multiple' && multipleVisitors.length === 0) {
      setMultipleVisitors([{ name: '', phone: '' }]);
    }
  }, [multipleVisitors.length]);

  const addMultipleVisitor = useCallback(() => {
    setMultipleVisitors((prev) => [...prev, { name: '', phone: '' }]);
  }, []);

  const removeMultipleVisitor = useCallback((index: number) => {
    setMultipleVisitors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMultipleVisitor = useCallback(
    (index: number, field: keyof MultipleVisitor, value: string) => {
      setMultipleVisitors((prev) => {
        const newVisitors = [...prev];
        newVisitors[index] = { ...newVisitors[index], [field]: value };
        return newVisitors;
      });
    },
    []
  );

  const handleSubmitIndividual = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // TODO: Submit logic will be handled by parent screen via callback or hook
      // Reset form on success
      setPreRegistrationData({
        name: '',
        phone: '',
        visit_type: 'pontual',
        access_type: 'com_aprovacao',
        visit_date: '',
        visit_start_time: '',
        visit_end_time: '',
        allowed_days: [],
        max_simultaneous_visits: 1,
        validity_start: '',
        validity_end: '',
      });
      setRegistrationMode('individual');
      router.back();
    } catch (error) {
      console.error('Erro ao submeter cadastro individual:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [preRegistrationData, isSubmitting, router]);

  const handleSubmitMultiple = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // TODO: Submit logic will be handled by parent screen via callback or hook
      // Reset form on success
      setPreRegistrationData({
        name: '',
        phone: '',
        visit_type: 'pontual',
        access_type: 'com_aprovacao',
        visit_date: '',
        visit_start_time: '',
        visit_end_time: '',
        allowed_days: [],
        max_simultaneous_visits: 1,
        validity_start: '',
        validity_end: '',
      });
      setMultipleVisitors([{ name: '', phone: '' }]);
      setRegistrationMode('individual');
      router.back();
    } catch (error) {
      console.error('Erro ao submeter cadastro múltiplo:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [preRegistrationData, multipleVisitors, isSubmitting, router]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <View style={styles.modalOverlay}>
      <View
        style={[styles.modalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pré-cadastro de Visitantes</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Toggle para modo de cadastro */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Modo de Cadastro</Text>
            <View style={styles.registrationModeSelector}>
              <TouchableOpacity
                style={[
                  styles.registrationModeButton,
                  registrationMode === 'individual' && styles.registrationModeButtonActive,
                ]}
                onPress={() => handleSelectRegistrationMode('individual')}>
                <Ionicons
                  name="person"
                  size={20}
                  color={registrationMode === 'individual' ? '#fff' : '#4CAF50'}
                />
                <Text
                  style={[
                    styles.registrationModeButtonText,
                    registrationMode === 'individual' && styles.registrationModeButtonTextActive,
                  ]}>
                  Individual
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.registrationModeButton,
                  registrationMode === 'multiple' && styles.registrationModeButtonActive,
                ]}
                onPress={() => handleSelectRegistrationMode('multiple')}>
                <Ionicons
                  name="people"
                  size={20}
                  color={registrationMode === 'multiple' ? '#fff' : '#4CAF50'}
                />
                <Text
                  style={[
                    styles.registrationModeButtonText,
                    registrationMode === 'multiple' && styles.registrationModeButtonTextActive,
                  ]}>
                  Múltiplos
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Campos para cadastro individual */}
          {registrationMode === 'individual' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.textInput}
                  value={preRegistrationData.name}
                  onChangeText={(text) =>
                    setPreRegistrationData((prev) => ({ ...prev, name: text }))
                  }
                  placeholder="Digite o nome completo do visitante"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Telefone *</Text>
                <TextInput
                  style={styles.textInput}
                  value={preRegistrationData.phone}
                  maxLength={15}
                  onChangeText={(text) => {
                    // Remove tudo que não é dígito
                    const cleaned = text.replace(/\D/g, '');
                    // Limita a 11 dígitos
                    const limited = cleaned.slice(0, 11);
                    // Aplica a formatação (XX) 9XXXX-XXXX
                    let formatted = limited;
                    if (limited.length > 6) {
                      formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}${limited.slice(3, 7)}-${limited.slice(7)}`;
                    } else if (limited.length > 2) {
                      formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
                    } else if (limited.length > 0) {
                      formatted = `(${limited}`;
                    }
                    setPreRegistrationData((prev) => ({ ...prev, phone: formatted }));
                  }}
                  placeholder="(XX) 9XXXX-XXXX"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </>
          )}

          {/* Campos para cadastro múltiplo */}
          {registrationMode === 'multiple' && (
            <View style={styles.inputGroup}>
              <View style={styles.multipleVisitorsHeader}>
                <Text style={styles.inputLabel}>Visitantes *</Text>
                <TouchableOpacity style={styles.addVisitorButton} onPress={addMultipleVisitor}>
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <Text style={styles.addVisitorButtonText}>Adicionar</Text>
                </TouchableOpacity>
              </View>

              {multipleVisitors.map((visitor, index) => (
                <View key={index} style={styles.multipleVisitorItem}>
                  <View style={styles.multipleVisitorHeader}>
                    <Text style={styles.multipleVisitorTitle}>Visitante {index + 1}</Text>
                    {multipleVisitors.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeVisitorButton}
                        onPress={() => removeMultipleVisitor(index)}>
                        <Ionicons name="trash" size={20} color="#f44336" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.multipleVisitorFields}>
                    <View style={styles.multipleVisitorField}>
                      <Text style={styles.multipleVisitorFieldLabel}>Nome *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={visitor.name}
                        onChangeText={(text) => updateMultipleVisitor(index, 'name', text)}
                        placeholder="Nome completo"
                        placeholderTextColor="#999"
                      />
                    </View>

                    <View style={styles.multipleVisitorField}>
                      <Text style={styles.multipleVisitorFieldLabel}>Telefone *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={visitor.phone}
                        maxLength={15}
                        onChangeText={(text) => {
                          // Remove tudo que não é dígito
                          const cleaned = text.replace(/\D/g, '');
                          // Limita a 11 dígitos
                          const limited = cleaned.slice(0, 11);
                          // Aplica a formatação (XX) 9XXXX-XXXX
                          let formatted = limited;
                          if (limited.length > 6) {
                            formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}${limited.slice(3, 7)}-${limited.slice(7)}`;
                          } else if (limited.length > 2) {
                            formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
                          } else if (limited.length > 0) {
                            formatted = `(${limited}`;
                          }
                          updateMultipleVisitor(index, 'phone', formatted);
                        }}
                        placeholder="(XX) 9XXXX-XXXX"
                        placeholderTextColor="#999"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Indicador de processamento para múltiplos visitantes */}
              {isSubmitting && registrationMode === 'multiple' && (
                <View style={styles.processingIndicator}>
                  <ActivityIndicator size="small" color="#4CAF50" />
                  <Text style={styles.processingText}>Processando visitantes...</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tipo de Visita *</Text>
            <View style={styles.visitorTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.visitorTypeButton,
                  preRegistrationData.visit_type === 'pontual' && styles.visitorTypeButtonActive,
                ]}
                onPress={() =>
                  setPreRegistrationData((prev) => ({ ...prev, visit_type: 'pontual' }))
                }>
                <Text
                  style={[
                    styles.visitorTypeButtonText,
                    preRegistrationData.visit_type === 'pontual' &&
                      styles.visitorTypeButtonTextActive,
                  ]}>
                  Pontual
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visitorTypeButton,
                  preRegistrationData.visit_type === 'frequente' &&
                    styles.visitorTypeButtonActive,
                ]}
                onPress={() =>
                  setPreRegistrationData((prev) => ({ ...prev, visit_type: 'frequente' }))
                }>
                <Text
                  style={[
                    styles.visitorTypeButtonText,
                    preRegistrationData.visit_type === 'frequente' &&
                      styles.visitorTypeButtonTextActive,
                  ]}>
                  Frequente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visitorTypeButton,
                  preRegistrationData.visit_type === 'prestador_servico' &&
                    styles.visitorTypeButtonActive,
                ]}
                onPress={() =>
                  setPreRegistrationData((prev) => ({
                    ...prev,
                    visit_type: 'prestador_servico',
                  }))
                }>
                <Text
                  style={[
                    styles.visitorTypeButtonText,
                    preRegistrationData.visit_type === 'prestador_servico' &&
                      styles.visitorTypeButtonTextActive,
                  ]}>
                  Serviço
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tipo de Aprovação *</Text>
            <View style={styles.visitorTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.visitorTypeButton,
                  preRegistrationData.access_type === 'com_aprovacao' &&
                    styles.visitorTypeButtonActive,
                ]}
                onPress={() =>
                  setPreRegistrationData((prev) => ({
                    ...prev,
                    access_type: 'com_aprovacao',
                  }))
                }>
                <Text
                  style={[
                    styles.visitorTypeButtonText,
                    preRegistrationData.access_type === 'com_aprovacao' &&
                      styles.visitorTypeButtonTextActive,
                  ]}>
                  Com Aprovação
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visitorTypeButton,
                  preRegistrationData.access_type === 'direto' && styles.visitorTypeButtonActive,
                ]}
                onPress={() =>
                  setPreRegistrationData((prev) => ({ ...prev, access_type: 'direto' }))
                }>
                <Text
                  style={[
                    styles.visitorTypeButtonText,
                    preRegistrationData.access_type === 'direto' &&
                      styles.visitorTypeButtonTextActive,
                  ]}>
                  Liberação Direta
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Campos condicionais para visita pontual */}
          {preRegistrationData.visit_type === 'pontual' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Data da Visita *</Text>
                <TextInput
                  style={styles.textInput}
                  value={preRegistrationData.visit_date}
                  onChangeText={(text) => {
                    const formattedDate = formatDate(text);
                    setPreRegistrationData((prev) => ({
                      ...prev,
                      visit_date: formattedDate,
                    }));
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View style={styles.timeInputRow}>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.inputLabel}>
                    Horário de Início da Pré-liberação (opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={preRegistrationData.visit_start_time}
                    onChangeText={(text) => {
                      const formattedTime = formatTime(text);
                      setPreRegistrationData((prev) => ({
                        ...prev,
                        visit_start_time: formattedTime,
                      }));
                    }}
                    placeholder="HH:MM (ex: 15:00)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>

                <View style={styles.timeInputGroup}>
                  <Text style={styles.inputLabel}>
                    Horário de Fim da Pré-liberação (opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={preRegistrationData.visit_end_time}
                    onChangeText={(text) => {
                      const formattedTime = formatTime(text);
                      setPreRegistrationData((prev) => ({
                        ...prev,
                        visit_end_time: formattedTime,
                      }));
                    }}
                    placeholder="HH:MM (ex: 18:00)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  💡 Dica: Deixe os campos de horário em branco para liberação 24h (visitante pode
                  entrar a qualquer hora do dia)
                </Text>
              </View>
            </>
          )}

          {/* Campos condicionais para visita frequente */}
          {preRegistrationData.visit_type === 'frequente' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Dias da Semana Permitidos *</Text>
                <View style={styles.daysSelector}>
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(
                    (day, index) => {
                      const dayValue = [
                        'monday',
                        'tuesday',
                        'wednesday',
                        'thursday',
                        'friday',
                        'saturday',
                        'sunday',
                      ][index];
                      const isSelected = preRegistrationData.allowed_days?.includes(dayValue);
                      return (
                        <TouchableOpacity
                          key={dayValue}
                          style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                          onPress={() => {
                            const currentDays = preRegistrationData.allowed_days || [];
                            const newDays = isSelected
                              ? currentDays.filter((d) => d !== dayValue)
                              : [...currentDays, dayValue];
                            setPreRegistrationData((prev) => ({
                              ...prev,
                              allowed_days: newDays,
                            }));
                          }}>
                          <Text
                            style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextActive,
                            ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>
              </View>

              <View style={styles.timeInputRow}>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.inputLabel}>
                    Horário de Início da Pré-liberação (opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={preRegistrationData.visit_start_time}
                    onChangeText={(text) => {
                      const formattedTime = formatTime(text);
                      setPreRegistrationData((prev) => ({
                        ...prev,
                        visit_start_time: formattedTime,
                      }));
                    }}
                    placeholder="HH:MM (ex: 08:00)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>

                <View style={styles.timeInputGroup}>
                  <Text style={styles.inputLabel}>
                    Horário de Fim da Pré-liberação (opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={preRegistrationData.visit_end_time}
                    onChangeText={(text) => {
                      const formattedTime = formatTime(text);
                      setPreRegistrationData((prev) => ({
                        ...prev,
                        visit_end_time: formattedTime,
                      }));
                    }}
                    placeholder="HH:MM (ex: 18:00)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  💡 Dica: Deixe os campos de horário em branco para liberação 24h (visitante pode
                  entrar a qualquer hora do dia)
                </Text>
              </View>
            </>
          )}

          {/* Campos condicionais para prestador de serviço */}
          {preRegistrationData.visit_type === 'prestador_servico' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Data da Visita *</Text>
                <TextInput
                  style={styles.textInput}
                  value={preRegistrationData.visit_date}
                  onChangeText={(text) => {
                    const formattedDate = formatDate(text);
                    setPreRegistrationData((prev) => ({
                      ...prev,
                      visit_date: formattedDate,
                    }));
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View style={styles.timeInputRow}>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.inputLabel}>
                    Horário de Início da Pré-liberação (opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={preRegistrationData.visit_start_time}
                    onChangeText={(text) => {
                      const formattedTime = formatTime(text);
                      setPreRegistrationData((prev) => ({
                        ...prev,
                        visit_start_time: formattedTime,
                      }));
                    }}
                    placeholder="HH:MM (ex: 08:00)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>

                <View style={styles.timeInputGroup}>
                  <Text style={styles.inputLabel}>
                    Horário de Fim da Pré-liberação (opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={preRegistrationData.visit_end_time}
                    onChangeText={(text) => {
                      const formattedTime = formatTime(text);
                      setPreRegistrationData((prev) => ({
                        ...prev,
                        visit_end_time: formattedTime,
                      }));
                    }}
                    placeholder="HH:MM (ex: 18:00)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  💡 Dica: Deixe os campos de horário em branco para liberação 24h (visitante pode
                  entrar a qualquer hora do dia)
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={() =>
              registrationMode === 'individual'
                ? handleSubmitIndividual()
                : handleSubmitMultiple()
            }
            disabled={isSubmitting}>
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? registrationMode === 'multiple'
                  ? 'Processando...'
                  : 'Enviando...'
                : 'Cadastrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  modalBody: {
    paddingHorizontal: 20,
    flex: 1,
  },
  inputGroup: {
    marginTop: 12,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  registrationModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  registrationModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'transparent',
    gap: 8,
  },
  registrationModeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  registrationModeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
  },
  registrationModeButtonTextActive: {
    color: '#fff',
  },
  multipleVisitorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addVisitorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f0f8f0',
    gap: 6,
  },
  addVisitorButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  multipleVisitorItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  multipleVisitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  multipleVisitorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeVisitorButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#ffebee',
  },
  multipleVisitorFields: {
    gap: 12,
  },
  multipleVisitorField: {
    gap: 6,
  },
  multipleVisitorFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  visitorTypeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  visitorTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  visitorTypeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  visitorTypeButtonText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    color: '#666',
  },
  visitorTypeButtonTextActive: {
    color: '#fff',
  },
  infoBox: {
    padding: 12,
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputGroup: {
    marginBottom: 36,
    flex: 1,
  },
  daysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    minWidth: 70,
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
