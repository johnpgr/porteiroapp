import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export function PlacaCadastro() {
  const { nome, relacionamento, telefone } = useLocalSearchParams<{
    nome: string;
    relacionamento: string;
    telefone: string;
  }>();
  const [plate, setPlate] = useState('');

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

  const handleNext = () => {
    router.push({
      pathname: '/morador/cadastro_steps/acesso',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: telefone || '',
        placa: plate || '',
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/morador/cadastro_steps/acesso',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: telefone || '',
        placa: '',
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const getRelationshipLabel = (rel: string) => {
    const relationships: { [key: string]: string } = {
      conjuge: '💑 Cônjuge',
      filho: '👶 Filho(a)',
      pai_mae: '👨‍👩‍👧‍👦 Pai/Mãe',
      irmao: '👫 Irmão/Irmã',
      familiar: '👪 Outro Familiar',
      amigo: '👥 Amigo(a)',
      funcionario: '🏠 Funcionário',
      prestador: '🔧 Prestador de Serviço',
      motorista: '🚗 Motorista',
      outro: '👤 Outro',
    };
    return relationships[rel] || rel;
  };

  return (
    <View style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>🚗 Novo Cadastro</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
            </View>
            <Text style={styles.progressText}>Passo 4 de 8</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>👤 {nome}</Text>
              <Text style={styles.personRelationship}>
                {getRelationshipLabel(relacionamento || '')}
              </Text>
              <Text style={styles.personPhone}>📱 {telefone}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Placa do Veículo</Text>
              <Text style={styles.sectionDescription}>Informe a placa do carro (opcional)</Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="car" size={24} color="#2196F3" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="ABC-1234"
                    value={plate}
                    onChangeText={handlePlateChange}
                    maxLength={8}
                    autoCapitalize="characters"
                    autoFocus
                  />
                  {isValidPlate() && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#4CAF50"
                      style={styles.validIcon}
                    />
                  )}
                </View>
              </View>

              <View style={styles.examplesContainer}>
                <Text style={styles.examplesTitle}>📋 Exemplos de formatos:</Text>
                <View style={styles.examplesList}>
                  <View style={styles.exampleItem}>
                    <Text style={styles.exampleLabel}>Formato Antigo:</Text>
                    <Text style={styles.exampleText}>ABC-1234</Text>
                  </View>
                  <View style={styles.exampleItem}>
                    <Text style={styles.exampleLabel}>Mercosul:</Text>
                    <Text style={styles.exampleText}>ABC-1D23</Text>
                  </View>
                </View>
              </View>

              <View style={styles.quickButtons}>
                <Text style={styles.quickButtonsTitle}>🚀 Ações rápidas:</Text>
                <View style={styles.quickButtonsList}>
                  <TouchableOpacity style={styles.quickButton} onPress={() => setPlate('ABC-1234')}>
                    <Text style={styles.quickButtonText}>Exemplo 1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickButton} onPress={() => setPlate('XYZ-5A67')}>
                    <Text style={styles.quickButtonText}>Exemplo 2</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearButton} onPress={() => setPlate('')}>
                    <Text style={styles.clearButtonText}>Limpar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  A placa é opcional e será usada para controle de acesso de veículos
                </Text>
              </View>

              {plate.length > 0 && !isValidPlate() && (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning" size={20} color="#FF9800" />
                  <Text style={styles.warningText}>Formato inválido. Use ABC-1234 ou ABC-1D23</Text>
                </View>
              )}

              {isValidPlate() && (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.successText}>✅ Placa válida: {plate}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backFooterButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Pular</Text>
              <Ionicons name="arrow-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.nextButton,
                plate.length > 0 && !isValidPlate() && styles.nextButtonDisabled,
              ]}
              onPress={handleNext}
              disabled={plate.length > 0 && !isValidPlate()}>
              <Text
                style={[
                  styles.nextButtonText,
                  plate.length > 0 && !isValidPlate() && styles.nextButtonTextDisabled,
                ]}>
                Continuar
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={plate.length > 0 && !isValidPlate() ? '#ccc' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressStep: {
    width: 25,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  personInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  personRelationship: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPhone: {
    fontSize: 14,
    color: '#666',
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
    flex: 1,
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
    fontSize: 18,
    color: '#333',
    paddingVertical: 16,
    fontWeight: '500',
    textAlign: 'center',
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
  quickButtons: {
    marginBottom: 20,
  },
  quickButtonsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickButtonsList: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  quickButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  clearButton: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '500',
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 8,
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
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextButton: {
    flex: 1.5,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextButtonTextDisabled: {
    color: '#ccc',
  },
});

export default PlacaCadastro;
