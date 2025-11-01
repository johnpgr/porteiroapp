import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '~/components/Modal';
import type { VehicleFormState, VehicleType } from '../types';

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Carro',
  motorcycle: 'Moto',
  truck: 'Caminhão',
  van: 'Van',
  bus: 'Ônibus',
  other: 'Outro',
};

const formatVehicleLicensePlate = (input: string): string => {
  const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  if (cleanInput.length === 0) return '';

  if (cleanInput.length <= 3) {
    return cleanInput.replace(/[^A-Z]/g, '');
  }

  if (cleanInput.length === 4) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const fourthChar = cleanInput.slice(3, 4);
    return `${letters}-${fourthChar}`;
  }

  if (cleanInput.length === 5) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const fourthChar = cleanInput.slice(3, 4);
    const fifthChar = cleanInput.slice(4, 5);
    return `${letters}-${fourthChar}${fifthChar}`;
  }

  if (cleanInput.length === 6) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const numbers = cleanInput.slice(3, 6);

    if (/^[0-9][A-Z][0-9]$/.test(numbers)) {
      return `${letters}-${numbers}`;
    }

    return `${letters}-${numbers.replace(/[^0-9]/g, '')}`;
  }

  const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
  const remaining = cleanInput.slice(3);

  if (/^[0-9][A-Z][0-9]{2}/.test(remaining)) {
    return `${letters}-${remaining.slice(0, 4)}`;
  }

  const numbers = remaining.replace(/[^0-9]/g, '').slice(0, 4);
  return `${letters}-${numbers}`;
};

const getVehicleTypeLabel = (type: VehicleFormState['type']) => {
  if (!type) {
    return 'Selecione o tipo do veículo';
  }

  return VEHICLE_TYPE_LABELS[type];
};

interface VehicleModalProps {
  visible: boolean;
  form: VehicleFormState;
  loading: boolean;
  onClose: () => void;
  onChangeField: (field: keyof VehicleFormState, value: string) => void;
  onSelectType: () => void;
  onSubmit: () => void;
  isSubmitDisabled: boolean;
}

export function VehicleModal({
  visible,
  form,
  loading,
  onClose,
  onChangeField,
  onSelectType,
  onSubmit,
  isSubmitDisabled,
}: VehicleModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Cadastrar Novo Veículo</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Placa do Veículo *</Text>
            <TextInput
              style={styles.input}
              value={form.license_plate}
              onChangeText={(text) =>
                onChangeField('license_plate', formatVehicleLicensePlate(text))
              }
              placeholder="ABC-1234 ou ABC-1A23"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              maxLength={8}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Marca do Veículo</Text>
            <TextInput
              style={styles.input}
              value={form.brand}
              onChangeText={(text) => onChangeField('brand', text)}
              placeholder="Ex: Toyota, Honda, Ford"
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Modelo do Veículo</Text>
            <TextInput
              style={styles.input}
              value={form.model}
              onChangeText={(text) => onChangeField('model', text)}
              placeholder="Ex: Corolla, Civic, Focus"
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cor do Veículo</Text>
            <TextInput
              style={styles.input}
              value={form.color}
              onChangeText={(text) => onChangeField('color', text)}
              placeholder="Ex: Branco, Preto, Prata"
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo do Veículo *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={onSelectType}
              disabled={loading}
            >
              <Text style={form.type ? styles.dropdownText : styles.placeholderText}>
                {getVehicleTypeLabel(form.type)}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitDisabled && styles.disabledButton]}
            onPress={onSubmit}
            disabled={isSubmitDisabled}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Salvando...' : 'Salvar Veículo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flex: 1,
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
