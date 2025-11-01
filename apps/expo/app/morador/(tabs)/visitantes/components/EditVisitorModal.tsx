import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Modal } from '~/components/Modal';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { PreRegistrationData } from '../types';
import { formatDate, formatTime } from '../utils';

interface EditVisitorModalProps {
  visible: boolean;
  insets: EdgeInsets;
  editData: PreRegistrationData;
  setEditData: React.Dispatch<React.SetStateAction<PreRegistrationData>>;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const EditVisitorModal: React.FC<EditVisitorModalProps> = ({
  visible,
  insets,
  editData,
  setEditData,
  isSubmitting,
  onSubmit,
  onClose,
}) => {
  return (
      <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Visitante</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.textInput}
                value={editData.name}
                onChangeText={(text) => setEditData((prev) => ({ ...prev, name: text }))}
                placeholder="Digite o nome completo do visitante"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefone *</Text>
              <TextInput
                style={styles.textInput}
                value={editData.phone}
                onChangeText={(text) => setEditData((prev) => ({ ...prev, phone: text }))}
                placeholder="(XX) 9XXXX-XXXX"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Acesso *</Text>
              <View style={styles.visitorTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.access_type === 'direto' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() => setEditData((prev) => ({ ...prev, access_type: 'direto' }))}>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.access_type === 'direto' && styles.visitorTypeButtonTextActive,
                    ]}>
                    Direto
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.access_type === 'com_aprovacao' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() =>
                    setEditData((prev) => ({ ...prev, access_type: 'com_aprovacao' }))
                  }>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.access_type === 'com_aprovacao' &&
                        styles.visitorTypeButtonTextActive,
                    ]}>
                    Com Aprovação
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Visitante *</Text>
              <View style={styles.visitorTypeSelector}>
                {/* <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.visit_type === 'comum' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() => setEditData((prev) => ({ ...prev, visit_type: 'comum' }))}>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'comum' && styles.visitorTypeButtonTextActive,
                    ]}>
                    Comum
                  </Text>
                </TouchableOpacity> */}

                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.visit_type === 'frequente' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() =>
                    setEditData((prev) => ({ ...prev, visit_type: 'frequente' }))
                  }>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'frequente' &&
                        styles.visitorTypeButtonTextActive,
                    ]}>
                    Frequente
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.visit_type === 'pontual' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() =>
                    setEditData((prev) => ({ ...prev, visit_type: 'pontual' }))
                  }>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'pontual' &&
                        styles.visitorTypeButtonTextActive,
                    ]}>
                    Pontual
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.visit_type === 'prestador_servico' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() =>
                    setEditData((prev) => ({ ...prev, visit_type: 'prestador_servico' }))
                  }>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'prestador_servico' &&
                        styles.visitorTypeButtonTextActive,
                    ]}>
                    Prestador de Serviço
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Visita *</Text>
              <View style={styles.visitorTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.visit_type === 'pontual' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() => setEditData((prev) => ({ ...prev, visit_type: 'pontual' }))}>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'pontual' && styles.visitorTypeButtonTextActive,
                    ]}>
                    Pontual
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    editData.visit_type === 'frequente' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() => setEditData((prev) => ({ ...prev, visit_type: 'frequente' }))}>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'frequente' && styles.visitorTypeButtonTextActive,
                    ]}>
                    Frequente
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Campos condicionais para visita pontual */}
            {editData.visit_type === 'pontual' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Data da Visita *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editData.visit_date}
                    onChangeText={(text) => {
                      const formattedDate = formatDate(text);
                      setEditData((prev) => ({ ...prev, visit_date: formattedDate }));
                    }}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>

                <View style={styles.timeInputRow}>
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.inputLabel}>Horário de Início da Pré-liberação *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.visit_start_time}
                      onChangeText={(text) => {
                        const formattedTime = formatTime(text);
                        setEditData((prev) => ({ ...prev, visit_start_time: formattedTime }));
                      }}
                      placeholder="HH:MM (ex: 15:00)"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>

                  <View style={styles.timeInputGroup}>
                    <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.visit_end_time}
                      onChangeText={(text) => {
                        const formattedTime = formatTime(text);
                        setEditData((prev) => ({ ...prev, visit_end_time: formattedTime }));
                      }}
                      placeholder="HH:MM (ex: 18:00)"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Campos condicionais para visita frequente */}
            {editData.visit_type === 'frequente' && (
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
                        const isSelected = editData.allowed_days?.includes(dayValue);
                        return (
                          <TouchableOpacity
                            key={dayValue}
                            style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                            onPress={() => {
                              const currentDays = editData.allowed_days || [];
                              const newDays = isSelected
                                ? currentDays.filter((d) => d !== dayValue)
                                : [...currentDays, dayValue];
                              setEditData((prev) => ({ ...prev, allowed_days: newDays }));
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
                    <Text style={styles.inputLabel}>Horário de Início *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.visit_start_time}
                      onChangeText={(text) => {
                        const formattedTime = formatTime(text);
                        setEditData((prev) => ({ ...prev, visit_start_time: formattedTime }));
                      }}
                      placeholder="HH:MM (ex: 08:00)"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>

                  <View style={styles.timeInputGroup}>
                    <Text style={styles.inputLabel}>Horário de Fim *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.visit_end_time}
                      onChangeText={(text) => {
                        const formattedTime = formatTime(text);
                        setEditData((prev) => ({ ...prev, visit_end_time: formattedTime }));
                      }}
                      placeholder="HH:MM (ex: 18:00)"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={isSubmitting}>
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>  );
};

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
