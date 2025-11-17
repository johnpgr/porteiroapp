import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

type VehicleType = 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other';

interface VehicleForm {
  license_plate: string;
  brand: string;
  model: string;
  color: string;
  type: VehicleType | '';
}

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Carro',
  motorcycle: 'Moto',
  truck: 'Caminhão',
  van: 'Van',
  bus: 'Ônibus',
  other: 'Outro',
};

// Função utilitária para formatação de placa de veículo
const formatLicensePlate = (input: string): string => {
  const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  if (cleanInput.length === 0) return '';

  if (cleanInput.length <= 3) {
    return cleanInput.replace(/[^A-Z]/g, '');
  } else if (cleanInput.length === 4) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const fourthChar = cleanInput.slice(3, 4);
    return `${letters}-${fourthChar}`;
  } else if (cleanInput.length === 5) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const fourthChar = cleanInput.slice(3, 4);
    const fifthChar = cleanInput.slice(4, 5);

    if (/[A-Z]/.test(fifthChar)) {
      return `${letters}-${fourthChar}${fifthChar}`;
    } else {
      return `${letters}-${fourthChar}${fifthChar}`;
    }
  } else if (cleanInput.length === 6) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const numbers = cleanInput.slice(3, 6);

    if (/^[0-9][A-Z][0-9]$/.test(numbers)) {
      return `${letters}-${numbers}`;
    } else {
      return `${letters}-${numbers.replace(/[^0-9]/g, '')}`;
    }
  } else if (cleanInput.length >= 7) {
    const letters = cleanInput.slice(0, 3).replace(/[^A-Z]/g, '');
    const remaining = cleanInput.slice(3);

    if (/^[0-9][A-Z][0-9]{2}/.test(remaining)) {
      return `${letters}-${remaining.slice(0, 4)}`;
    } else {
      const numbers = remaining.replace(/[^0-9]/g, '').slice(0, 4);
      return `${letters}-${numbers}`;
    }
  }

  return cleanInput;
};

// Função para validar placa brasileira
const isValidLicensePlate = (plate: string): boolean => {
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Formato antigo: AAA1111
  const oldFormat = /^[A-Z]{3}[0-9]{4}$/.test(cleanPlate);

  // Formato Mercosul: AAA1A11
  const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleanPlate);

  return oldFormat || mercosulFormat;
};

const getVehicleTypeLabel = (type: VehicleForm['type']) => {
  if (!type) {
    return 'Selecione o tipo do veículo';
  }

  return VEHICLE_TYPE_LABELS[type as VehicleType];
};

export default function OwnerVehicleScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const typeSheetRef = useRef<BottomSheetModalRef>(null);

  const [formData, setFormData] = useState<VehicleForm>({
    license_plate: '',
    brand: '',
    model: '',
    color: '',
    type: '',
  });

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleSelectType = useCallback((type: VehicleType) => {
    setFormData((prev) => ({ ...prev, type }));
    setShowTypePicker(false);
  }, []);

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert('Erro', 'Informações do usuário não encontradas');
      return;
    }

    if (!formData.license_plate.trim()) {
      Alert.alert('Erro', 'Placa do veículo é obrigatória');
      return;
    }

    if (!isValidLicensePlate(formData.license_plate)) {
      Alert.alert('Erro', 'Placa do veículo inválida. Use o formato ABC-1234 ou ABC-1A23');
      return;
    }

    if (!formData.type) {
      Alert.alert('Erro', 'Tipo do veículo é obrigatório');
      return;
    }

    try {
      setLoading(true);

      // Buscar apartment_id do usuário
      const { data: userResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (residentError || !userResident?.apartment_id) {
        Alert.alert('Erro', 'Não foi possível encontrar o apartamento do usuário');
        return;
      }

      const { error } = await supabase
        .from('vehicles')
        .insert({
          license_plate: formData.license_plate.trim().toUpperCase(),
          brand: formData.brand.trim() || null,
          model: formData.model.trim() || null,
          color: formData.color.trim() || null,
          type: formData.type,
          apartment_id: userResident.apartment_id,
          ownership_type: 'proprietario'
        });

      if (error) {
        console.error('Erro ao cadastrar veículo:', error);
        if (error.code === '23505') {
          Alert.alert('Erro', 'Esta placa já está cadastrada no sistema');
        } else {
          Alert.alert('Erro', 'Não foi possível cadastrar o veículo. Tente novamente.');
        }
        return;
      }

      Alert.alert('Sucesso', 'Veículo cadastrado com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      Alert.alert('Erro', 'Erro ao cadastrar veículo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose} disabled={loading}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <View style={styles.headerTitleContainer}>
            <IconSymbol name="car.fill" color="#fff" size={20} />
            <Text style={styles.headerTitle}>Novo Veículo</Text>
          </View>
          <Text style={styles.headerSubtitle}>Cadastrar veículo</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
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
            value={formData.license_plate}
            onChangeText={(text) =>
              setFormData((prev) => ({ ...prev, license_plate: formatLicensePlate(text) }))
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
            value={formData.brand}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, brand: text }))}
            placeholder="Ex: Toyota, Honda, Ford"
            placeholderTextColor="#999"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Modelo do Veículo</Text>
          <TextInput
            style={styles.input}
            value={formData.model}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, model: text }))}
            placeholder="Ex: Corolla, Civic, Focus"
            placeholderTextColor="#999"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cor do Veículo</Text>
          <TextInput
            style={styles.input}
            value={formData.color}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, color: text }))}
            placeholder="Ex: Branco, Preto, Prata"
            placeholderTextColor="#999"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo do Veículo *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowTypePicker(true)}
            disabled={loading}
          >
            <Text style={formData.type ? styles.dropdownText : styles.placeholderText}>
              {getVehicleTypeLabel(formData.type)}
            </Text>
            <IconSymbol name="chevron.down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Salvando...' : 'Salvar Veículo'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomSheetModal
        ref={typeSheetRef}
        visible={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        snapPoints={50}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Tipo do Veículo</Text>
          <Text style={styles.sheetSubtitle}>Escolha o tipo do veículo</Text>
        </View>
        <ScrollView style={styles.sheetContent}>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('car')}>
            <View style={styles.sheetOptionContent}>
              <IconSymbol name="car.fill" color="#111827" size={20} />
              <Text style={styles.sheetOptionText}>Carro</Text>
            </View>
            {formData.type === 'car' && <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={20} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('motorcycle')}>
            <View style={styles.sheetOptionContent}>
              <IconSymbol name="bicycle" color="#111827" size={20} />
              <Text style={styles.sheetOptionText}>Moto</Text>
            </View>
            {formData.type === 'motorcycle' && <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={20} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('truck')}>
            <View style={styles.sheetOptionContent}>
              <IconSymbol name="truck.box.fill" color="#111827" size={20} />
              <Text style={styles.sheetOptionText}>Caminhão</Text>
            </View>
            {formData.type === 'truck' && <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={20} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('van')}>
            <View style={styles.sheetOptionContent}>
              <IconSymbol name="car.2.fill" color="#111827" size={20} />
              <Text style={styles.sheetOptionText}>Van</Text>
            </View>
            {formData.type === 'van' && <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={20} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('bus')}>
            <View style={styles.sheetOptionContent}>
              <IconSymbol name="bus" color="#111827" size={20} />
              <Text style={styles.sheetOptionText}>Ônibus</Text>
            </View>
            {formData.type === 'bus' && <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={20} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('other')}>
            <View style={styles.sheetOptionContent}>
              <IconSymbol name="car.fill" color="#111827" size={20} />
              <Text style={styles.sheetOptionText}>Outro</Text>
            </View>
            {formData.type === 'other' && <IconSymbol name="checkmark.circle.fill" color="#4CAF50" size={20} />}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTextContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
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
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  submitContainer: {
    marginTop: 24,
    marginBottom: 32,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
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
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  sheetContent: {
    maxHeight: 400,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sheetOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sheetOptionText: {
    fontSize: 14,
    color: '#111827',
  },
});
