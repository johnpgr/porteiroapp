import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';
import BottomNav from '~/components/BottomNav';

export default function TelefoneCadastro() {
  const { nome, relacionamento } = useLocalSearchParams<{
    nome: string;
    relacionamento: string;
  }>();
  const [phone, setPhone] = useState('');

  const formatPhone = (text: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = text.replace(/\D/g, '');

    // Aplica a máscara (XX) XXXXX-XXXX
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
  };

  const isValidPhone = () => {
    const numbers = phone.replace(/\D/g, '');
    return numbers.length === 11; // (XX) XXXXX-XXXX
  };

  const handleNext = () => {
    if (!isValidPhone()) {
      Alert.alert(
        'Telefone Inválido',
        'Por favor, insira um número de telefone válido com 11 dígitos.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push({
      pathname: '/morador/cadastro/placa',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: phone,
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
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <View style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>📱 Novo Cadastro</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
            </View>
            <Text style={styles.progressText}>Passo 3 de 8</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>👤 {nome}</Text>
              <Text style={styles.personRelationship}>
                {getRelationshipLabel(relacionamento || '')}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Número de Celular</Text>
              <Text style={styles.sectionDescription}>
                Informe o número de celular para contato
              </Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call" size={24} color="#2196F3" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChangeText={handlePhoneChange}
                    keyboardType="numeric"
                    maxLength={15}
                    autoFocus
                  />
                  {isValidPhone() && (
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
                <Text style={styles.examplesTitle}>📋 Exemplos:</Text>
                <View style={styles.examplesList}>
                  <TouchableOpacity
                    style={styles.exampleItem}
                    onPress={() => setPhone('(11) 99999-9999')}>
                    <Text style={styles.exampleText}>(11) 99999-9999</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exampleItem}
                    onPress={() => setPhone('(21) 98888-7777')}>
                    <Text style={styles.exampleText}>(21) 98888-7777</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  O telefone será usado para notificações e contato em caso de emergência
                </Text>
              </View>

              {phone.length > 0 && !isValidPhone() && (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning" size={20} color="#FF9800" />
                  <Text style={styles.warningText}>
                    Número incompleto. Digite todos os 11 dígitos.
                  </Text>
                </View>
              )}

              {isValidPhone() && (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.successText}>✅ Número válido: {phone}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backFooterButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, !isValidPhone() && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={!isValidPhone()}>
              <Text
                style={[styles.nextButtonText, !isValidPhone() && styles.nextButtonTextDisabled]}>
                Continuar
              </Text>
              <Ionicons name="arrow-forward" size={20} color={isValidPhone() ? '#fff' : '#ccc'} />
            </TouchableOpacity>
          </View>
        </View>
        <BottomNav activeTab="cadastro" />
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
    gap: 12,
  },
  exampleItem: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  exampleText: {
    fontSize: 14,
    color: '#2196F3',
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
  nextButton: {
    flex: 2,
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
