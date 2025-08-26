import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';

interface PickerOption {
  label: string;
  value: string;
}

interface IOSCompatiblePickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  style?: any;
}

export const IOSCompatiblePicker: React.FC<IOSCompatiblePickerProps> = ({
  selectedValue,
  onValueChange,
  options,
  placeholder = 'Selecione uma opção',
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  
  const selectedOption = options.find(option => option.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (value: string) => {
    onValueChange(value);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.pickerButton, style]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.pickerButtonText, !selectedOption && styles.placeholderText]}>
          {displayText}
        </Text>
        <Text style={styles.dropdownIcon}>▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Selecionar Opção</Text>
              <View style={styles.placeholder} />
            </View>
            
            <ScrollView style={styles.optionsList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionItem,
                    selectedValue === option.value && styles.selectedOption
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedValue === option.value && styles.selectedOptionText
                  ]}>
                    {option.label}
                  </Text>
                  {selectedValue === option.value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

interface TimePickerOption {
  label: string;
  value: number;
}

interface IOSCompatibleTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode: 'date' | 'time';
  onClose: () => void;
  visible: boolean;
}

export const IOSCompatibleTimePicker: React.FC<IOSCompatibleTimePickerProps> = ({
  value,
  onChange,
  mode,
  onClose,
  visible,
}) => {
  const [selectedHour, setSelectedHour] = useState(value.getHours());
  const [selectedMinute, setSelectedMinute] = useState(value.getMinutes());
  const [selectedDay, setSelectedDay] = useState(value.getDate());
  const [selectedMonth, setSelectedMonth] = useState(value.getMonth());
  const [selectedYear, setSelectedYear] = useState(value.getFullYear());

  const hours: TimePickerOption[] = Array.from({ length: 24 }, (_, i) => ({
    label: i.toString().padStart(2, '0'),
    value: i,
  }));

  const minutes: TimePickerOption[] = Array.from({ length: 60 }, (_, i) => ({
    label: i.toString().padStart(2, '0'),
    value: i,
  }));

  const days: TimePickerOption[] = Array.from({ length: 31 }, (_, i) => ({
    label: (i + 1).toString(),
    value: i + 1,
  }));

  const months: TimePickerOption[] = [
    { label: 'Janeiro', value: 0 },
    { label: 'Fevereiro', value: 1 },
    { label: 'Março', value: 2 },
    { label: 'Abril', value: 3 },
    { label: 'Maio', value: 4 },
    { label: 'Junho', value: 5 },
    { label: 'Julho', value: 6 },
    { label: 'Agosto', value: 7 },
    { label: 'Setembro', value: 8 },
    { label: 'Outubro', value: 9 },
    { label: 'Novembro', value: 10 },
    { label: 'Dezembro', value: 11 },
  ];

  const currentYear = new Date().getFullYear();
  const years: TimePickerOption[] = Array.from({ length: 10 }, (_, i) => ({
    label: (currentYear - 5 + i).toString(),
    value: currentYear - 5 + i,
  }));

  const handleConfirm = () => {
    const newDate = new Date(value);
    if (mode === 'time') {
      newDate.setHours(selectedHour, selectedMinute);
    } else {
      newDate.setFullYear(selectedYear, selectedMonth, selectedDay);
    }
    onChange(newDate);
    onClose();
  };

  const renderTimePickerColumn = (options: TimePickerOption[], selectedValue: number, onSelect: (value: number) => void) => (
    <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.pickerItem,
            selectedValue === option.value && styles.selectedPickerItem
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Text style={[
            styles.pickerItemText,
            selectedValue === option.value && styles.selectedPickerItemText
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.timePickerModalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {mode === 'time' ? 'Selecionar Hora' : 'Selecionar Data'}
            </Text>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickerContainer}>
            {mode === 'time' ? (
              <>
                <View style={styles.pickerColumnContainer}>
                  <Text style={styles.pickerLabel}>Hora</Text>
                  {renderTimePickerColumn(hours, selectedHour, setSelectedHour)}
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.pickerColumnContainer}>
                  <Text style={styles.pickerLabel}>Minuto</Text>
                  {renderTimePickerColumn(minutes, selectedMinute, setSelectedMinute)}
                </View>
              </>
            ) : (
              <>
                <View style={styles.pickerColumnContainer}>
                  <Text style={styles.pickerLabel}>Dia</Text>
                  {renderTimePickerColumn(days, selectedDay, setSelectedDay)}
                </View>
                <View style={styles.pickerColumnContainer}>
                  <Text style={styles.pickerLabel}>Mês</Text>
                  {renderTimePickerColumn(months, selectedMonth, setSelectedMonth)}
                </View>
                <View style={styles.pickerColumnContainer}>
                  <Text style={styles.pickerLabel}>Ano</Text>
                  {renderTimePickerColumn(years, selectedYear, setSelectedYear)}
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pickerButton: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  timePickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelButton: {
    padding: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  confirmButton: {
    padding: 5,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 60,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f0f8ff',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  pickerContainer: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: 20,
  },
  pickerColumnContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  pickerColumn: {
    flex: 1,
    maxHeight: 200,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  selectedPickerItem: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPickerItemText: {
    color: '#fff',
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    alignSelf: 'center',
    marginTop: 30,
    marginHorizontal: 10,
  },
});