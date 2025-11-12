import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { supabase } from '~/utils/supabase';

const formatLicensePlate = (input: string): string => {
  const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleanInput.length <= 3) return cleanInput;
  if (cleanInput.length <= 7) return `${cleanInput.slice(0, 3)}-${cleanInput.slice(3)}`;
  return cleanInput;
};

export default function VehicleFormModal() {
  const [vehicle, setVehicle] = useState({
    license_plate: '',
    brand: '',
    model: '',
    color: '',
    type: 'car',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleAddVehicle = async () => {
    const normalizedPlate = vehicle.license_plate.trim().toUpperCase();
    if (!normalizedPlate) {
      Alert.alert('Erro', 'Por favor, preencha a placa do veículo.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: existing, error: checkError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('license_plate', normalizedPlate)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        Alert.alert('Erro', 'Já existe um veículo cadastrado com esta placa.');
        return;
      }

      const { error } = await supabase.from('vehicles').insert({
        apartment_id: null,
        license_plate: normalizedPlate,
        brand: vehicle.brand?.trim() || null,
        model: vehicle.model?.trim() || null,
        color: vehicle.color?.trim() || null,
        type: vehicle.type || 'car',
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Veículo cadastrado com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      Alert.alert('Erro', 'Falha ao cadastrar veículo. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVehicleTypeSelection = () => {
    Alert.alert('Selecione o Tipo do Veículo', 'Escolha uma das opções abaixo:', [
      { text: '🚗 Carro', onPress: () => setVehicle((prev) => ({ ...prev, type: 'car' })) },
      {
        text: '🏍️ Moto',
        onPress: () => setVehicle((prev) => ({ ...prev, type: 'motorcycle' })),
      },
      { text: '🚛 Caminhão', onPress: () => setVehicle((prev) => ({ ...prev, type: 'truck' })) },
      { text: '🚐 Van', onPress: () => setVehicle((prev) => ({ ...prev, type: 'van' })) },
      { text: '🚌 Ônibus', onPress: () => setVehicle((prev) => ({ ...prev, type: 'bus' })) },
      { text: '🚙 Outro', onPress: () => setVehicle((prev) => ({ ...prev, type: 'other' })) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>🚗 Cadastrar Novo Veículo</Text>
          <Text style={styles.headerSubtitle}>Preencha as informações obrigatórias abaixo</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Ionicons name="car" size={16} color="#4CAF50" />
            <Text style={styles.label}>Placa do Veículo</Text>
            <Text style={styles.requiredIndicator}>*</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              vehicle.license_plate ? styles.inputFilled : null,
              !vehicle.license_plate && styles.inputRequired,
            ]}
            placeholder="ABC-1234 ou ABC-1A23"
            placeholderTextColor="#999"
            value={vehicle.license_plate}
            onChangeText={(text) =>
              setVehicle((prev) => ({ ...prev, license_plate: formatLicensePlate(text) }))
            }
            autoCapitalize="characters"
            maxLength={8}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Ionicons name="business" size={16} color="#2196F3" />
            <Text style={styles.label}>Marca do Veículo</Text>
          </View>
          <TextInput
            style={[styles.input, vehicle.brand ? styles.inputFilled : null]}
            placeholder="Ex: Honda, Toyota, Volkswagen"
            placeholderTextColor="#999"
            value={vehicle.brand}
            onChangeText={(text) => setVehicle((prev) => ({ ...prev, brand: text }))}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Ionicons name="car-sport-outline" size={16} color="#FF9800" />
            <Text style={styles.label}>Modelo do Veículo</Text>
          </View>
          <TextInput
            style={[styles.input, vehicle.model ? styles.inputFilled : null]}
            placeholder="Ex: Civic, Corolla, Gol"
            placeholderTextColor="#999"
            value={vehicle.model}
            onChangeText={(text) => setVehicle((prev) => ({ ...prev, model: text }))}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Ionicons name="color-palette" size={16} color="#9C27B0" />
            <Text style={styles.label}>Cor do Veículo</Text>
          </View>
          <TextInput
            style={[styles.input, vehicle.color ? styles.inputFilled : null]}
            placeholder="Ex: Branco, Preto, Prata"
            placeholderTextColor="#999"
            value={vehicle.color}
            onChangeText={(text) => setVehicle((prev) => ({ ...prev, color: text }))}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Ionicons name="options" size={16} color="#FF5722" />
            <Text style={styles.label}>Tipo do Veículo</Text>
          </View>
          <TouchableOpacity
            style={[styles.dropdownButton, vehicle.type ? styles.dropdownFilled : null]}
            onPress={handleVehicleTypeSelection}>
            <View style={styles.dropdownContent}>
              <Text style={[styles.dropdownText, !vehicle.type && styles.placeholderText]}>
                {vehicle.type === 'car'
                  ? '🚗 Carro'
                  : vehicle.type === 'motorcycle'
                    ? '🏍️ Moto'
                    : vehicle.type === 'truck'
                      ? '🚛 Caminhão'
                      : vehicle.type === 'van'
                        ? '🚐 Van'
                        : vehicle.type === 'bus'
                          ? '🚌 Ônibus'
                          : '🚙 Outro'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={vehicle.type ? '#4CAF50' : '#999'}
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting && styles.disabledButton,
              !vehicle.license_plate && styles.submitButtonDisabled,
            ]}
            onPress={handleAddVehicle}
            disabled={submitting || !vehicle.license_plate}>
            {submitting ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingButtonText}>Cadastrando...</Text>
              </View>
            ) : (
              <View style={styles.submitContent}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Cadastrar Veículo</Text>
              </View>
            )}
          </TouchableOpacity>
          {!vehicle.license_plate && (
            <Text style={styles.validationText}>⚠️ A placa do veículo é obrigatória</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 20,
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
    padding: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  requiredIndicator: {
    color: '#EF4444',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 14,
    fontSize: 15,
  },
  inputFilled: {
    borderColor: '#4CAF50',
  },
  inputRequired: {
    borderColor: '#F87171',
  },
  dropdownButton: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 14,
    backgroundColor: '#fff',
  },
  dropdownFilled: {
    borderColor: '#4CAF50',
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  submitContainer: {
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  validationText: {
    marginTop: 8,
    fontSize: 13,
    color: '#b45309',
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

