import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import type { VehicleFormState, VehicleType } from '~/components/morador/visitantes/types';

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

export default function VehicleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<VehicleFormState>({
    license_plate: '',
    brand: '',
    model: '',
    color: '',
    type: '',
  });
  const [loading, setLoading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const typeSheetRef = useRef<BottomSheetModalRef>(null);

  const resetForm = useCallback(() => {
    setForm({
      license_plate: '',
      brand: '',
      model: '',
      color: '',
      type: '',
    });
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    router.back();
  }, [resetForm, router]);

  const handleChangeField = useCallback((field: keyof VehicleFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectType = useCallback((type: VehicleType) => {
    setForm((prev) => ({ ...prev, type }));
    setShowTypePicker(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    const sanitizedPlate = form.license_plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (!sanitizedPlate || sanitizedPlate.length !== 7) {
      Alert.alert('Erro', 'Informe uma placa válida com 7 caracteres.');
      return;
    }

    if (!form.type) {
      Alert.alert('Erro', 'Selecione o tipo do veículo.');
      return;
    }

    setLoading(true);
    try {
      // Get user's apartment_id
      if (!user?.id) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        Alert.alert('Erro', 'Erro ao buscar perfil do usuário.');
        return;
      }

      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', profileData.id)
        .maybeSingle();

      if (apartmentError || !apartmentData?.apartment_id) {
        Alert.alert('Erro', 'Não foi possível encontrar o apartamento do usuário.');
        return;
      }

      const { error } = await supabase.from('vehicles').insert({
        license_plate: form.license_plate,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        color: form.color.trim() || null,
        type: form.type,
        apartment_id: apartmentData.apartment_id,
        ownership_type: 'visita',
      });

      if (error) {
        console.error('Erro ao cadastrar veículo:', error);
        if (error.code === '23505') {
          Alert.alert('Erro', 'Esta placa já está cadastrada no sistema.');
        } else {
          Alert.alert('Erro', 'Não foi possível cadastrar o veículo. Tente novamente.');
        }
        return;
      }

      Alert.alert('Sucesso', 'Veículo cadastrado com sucesso!', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      Alert.alert('Erro', 'Erro interno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [form, loading, handleClose, user]);

  const sanitizedVehiclePlate = form.license_plate.replace(/[^A-Za-z0-9]/g, '');
  const isSubmitDisabled = sanitizedVehiclePlate.length !== 7 || !Boolean(form.type) || loading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose} disabled={loading}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>🚗 Cadastrar Veículo</Text>
          <Text style={styles.headerSubtitle}>Adicionar novo veículo</Text>
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
            value={form.license_plate}
            onChangeText={(text) =>
              handleChangeField('license_plate', formatVehicleLicensePlate(text))
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
            onChangeText={(text) => handleChangeField('brand', text)}
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
            onChangeText={(text) => handleChangeField('model', text)}
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
            onChangeText={(text) => handleChangeField('color', text)}
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
            <Text style={form.type ? styles.dropdownText : styles.placeholderText}>
              {getVehicleTypeLabel(form.type)}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitDisabled && styles.disabledButton]}
            onPress={() => handleSubmit()}
            disabled={isSubmitDisabled}>
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
            <Text style={styles.sheetOptionText}>🚗 Carro</Text>
            {form.type === 'car' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('motorcycle')}>
            <Text style={styles.sheetOptionText}>🏍️ Moto</Text>
            {form.type === 'motorcycle' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('truck')}>
            <Text style={styles.sheetOptionText}>🚛 Caminhão</Text>
            {form.type === 'truck' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('van')}>
            <Text style={styles.sheetOptionText}>🚐 Van</Text>
            {form.type === 'van' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('bus')}>
            <Text style={styles.sheetOptionText}>🚌 Ônibus</Text>
            {form.type === 'bus' && <Text style={styles.sheetCheckmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => handleSelectType('other')}>
            <Text style={styles.sheetOptionText}>🚙 Outro</Text>
            {form.type === 'other' && <Text style={styles.sheetCheckmark}>✓</Text>}
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 13,
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
  sheetOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  sheetCheckmark: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '700',
  },
});
