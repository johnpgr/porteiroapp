import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';
import BottomNav from '~/components/BottomNav';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

export default function VeiculoCadastro() {
  const { user } = useAuth();
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPlate = (text: string) => {
    // Remove caracteres especiais e converte para maiúsculo
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Formato brasileiro: ABC1234 ou ABC1D23 (Mercosul)
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
    }
  };

  const handlePlateChange = (text: string) => {
    const formatted = formatPlate(text);
    setPlate(formatted);
  };

  const isValidPlate = () => {
    const cleaned = plate.replace(/[^A-Za-z0-9]/g, '');
    // Formato antigo: ABC1234 (7 caracteres) ou Mercosul: ABC1D23 (7 caracteres)
    return cleaned.length === 7;
  };

  const isFormValid = () => {
    return isValidPlate() && brand.trim() && model.trim() && color.trim();
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não identificado.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Buscar apartment_id do usuário através da tabela apartment_residents
      const { data: residentData, error: residentError } = await (supabase as any)
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (residentError) {
        console.error('Erro ao buscar apartment_id:', residentError);
        Alert.alert('Erro', 'Não foi possível encontrar o apartamento do usuário');
        return;
      }

      if (!residentData?.apartment_id) {
        Alert.alert('Erro', 'Usuário não está associado a um apartamento');
        return;
      }

      const userApartmentId = residentData.apartment_id;
      
      const vehicleData = {
        license_plate: plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
        model: `${brand.trim()} ${model.trim()}`.trim(),
        color: color.trim(),
        apartment_id: userApartmentId,
      };

      const { error } = await (supabase as any)
        .from('vehicles')
        .insert([vehicleData]);

      if (error) {
        console.error('Erro ao cadastrar veículo:', error);
        if (error.code === '23505') {
          Alert.alert('Erro', 'Esta placa já está cadastrada no sistema.');
        } else {
          Alert.alert('Erro', 'Não foi possível cadastrar o veículo. Tente novamente.');
        }
        return;
      }

      Alert.alert(
        'Sucesso!',
        'Veículo cadastrado com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      Alert.alert('Erro', 'Erro interno. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Cadastrar Veículo</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚗 Dados do Veículo</Text>
            <Text style={styles.sectionDescription}>
              Cadastre seu veículo para facilitar o acesso ao condomínio
            </Text>

            {/* Placa */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Placa do Veículo *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="car" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={plate}
                  onChangeText={handlePlateChange}
                  placeholder="ABC-1234"
                  placeholderTextColor="#999"
                  maxLength={8}
                  autoCapitalize="characters"
                />
                {isValidPlate() && (
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.validIcon} />
                )}
              </View>
            </View>

            {/* Marca */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Marca *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="business" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="Ex: Toyota, Honda, Volkswagen"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Modelo */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Modelo *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="car-sport" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={model}
                  onChangeText={setModel}
                  placeholder="Ex: Corolla, Civic, Gol"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Cor */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Cor *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="color-palette" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={color}
                  onChangeText={setColor}
                  placeholder="Ex: Branco, Preto, Prata"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Ano (opcional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Ano (opcional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={year}
                  onChangeText={setYear}
                  placeholder="Ex: 2020"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>

            {/* Exemplos de placa */}
            <View style={styles.examplesContainer}>
              <Text style={styles.examplesTitle}>Formatos aceitos:</Text>
              <View style={styles.examplesList}>
                <View style={styles.exampleItem}>
                  <Text style={styles.exampleLabel}>Formato Antigo</Text>
                  <Text style={styles.exampleText}>ABC-1234</Text>
                </View>
                <View style={styles.exampleItem}>
                  <Text style={styles.exampleLabel}>Mercosul</Text>
                  <Text style={styles.exampleText}>ABC-1D23</Text>
                </View>
              </View>
            </View>

            {/* Informação importante */}
            <View style={styles.tipContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.tipText}>
                O veículo será associado ao seu apartamento e facilitará o acesso ao condomínio.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backFooterButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.backFooterButtonText}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormValid() && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text
                  style={[
                    styles.submitButtonText,
                    !isFormValid() && styles.submitButtonTextDisabled,
                  ]}
                >
                  Cadastrar
                </Text>
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={isFormValid() ? "#fff" : "#ccc"}
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        <BottomNav />
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 16,
  },
  validIcon: {
    marginLeft: 12,
  },
  examplesContainer: {
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  examplesList: {
    flexDirection: 'row',
    gap: 16,
  },
  exampleItem: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  exampleLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 12,
  },
  backFooterButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  submitButton: {
    flex: 1.5,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  submitButtonTextDisabled: {
    color: '#ccc',
  },
});