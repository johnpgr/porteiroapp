import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';
import * as Crypto from 'expo-crypto';

type FlowStep = 'apartamento' | 'empresa' | 'destinatario' | 'descricao' | 'observacoes' | 'foto' | 'confirmacao';

interface RegistrarEncomendaProps {
  onClose: () => void;
  onConfirm?: (message: string) => void;
}

const empresasEntrega = [
  { id: 'ifood', nome: 'iFood', icon: '🍔', cor: '#EA1D2C' },
  { id: 'rappi', nome: 'Rappi', icon: '🛵', cor: '#FF441F' },
  { id: 'mercadolivre', nome: 'Mercado Livre', icon: '🛒', cor: '#FFE600' },
  { id: 'shopee', nome: 'Shopee', icon: '🛍️', cor: '#EE4D2D' },
  { id: 'aliexpress', nome: 'AliExpress', icon: '📦', cor: '#FF6A00' },
  { id: 'amazon', nome: 'Amazon', icon: '📋', cor: '#FF9900' },
  { id: 'correios', nome: 'Correios', icon: '📮', cor: '#FFD700' },
  { id: 'uber', nome: 'Uber Eats', icon: '🚗', cor: '#000000' },
  { id: 'outros', nome: 'Outros', icon: '📦', cor: '#666666' },
];

export default function RegistrarEncomenda({ onClose, onConfirm }: RegistrarEncomendaProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('apartamento');
  const [apartamento, setApartamento] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<(typeof empresasEntrega)[0] | null>(
    null
  );
  const [nomeDestinatario, setNomeDestinatario] = useState('');
  const [descricaoEncomenda, setDescricaoEncomenda] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoTirada, setFotoTirada] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const renderNumericKeypad = (
    value: string,
    setValue: (val: string) => void,
    onNext: () => void
  ) => (
    <View style={styles.keypadContainer}>
      <View style={styles.displayContainer}>
        <Text style={styles.displayLabel}>Número do Apartamento</Text>
        <Text style={styles.displayValue}>{value || '___'}</Text>
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
          <TouchableOpacity
            key={num}
            style={styles.keypadButton}
            onPress={() => setValue(value + num.toString())}>
            <Text style={styles.keypadButtonText}>{num}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.keypadButton} onPress={() => setValue(value.slice(0, -1))}>
          <Text style={styles.keypadButtonText}>⌫</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.keypadButton, styles.confirmButton]}
          onPress={onNext}
          disabled={!value}>
          <Text style={styles.confirmButtonText}>✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderApartamentoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🏠 Apartamento</Text>
      <Text style={styles.stepSubtitle}>Digite o número do apartamento</Text>

      {renderNumericKeypad(apartamento, setApartamento, () => {
        if (apartamento) {
          setCurrentStep('empresa');
        }
      })}
    </View>
  );

  const renderEmpresaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🚚 Empresa de Entrega</Text>
      <Text style={styles.stepSubtitle}>Selecione a empresa ou serviço</Text>

      <ScrollView style={styles.empresasContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.empresasGrid}>
          {empresasEntrega.map((empresa) => (
            <TouchableOpacity
              key={empresa.id}
              style={[
                styles.empresaButton,
                { borderColor: empresa.cor },
                empresaSelecionada?.id === empresa.id && { backgroundColor: empresa.cor + '20' },
              ]}
              onPress={() => {
                setEmpresaSelecionada(empresa);
                setCurrentStep('destinatario');
              }}>
              <Text style={styles.empresaIcon}>{empresa.icon}</Text>
              <Text style={styles.empresaNome}>{empresa.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderDestinatarioStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>👤 Destinatário</Text>
      <Text style={styles.stepSubtitle}>Digite o nome do destinatário</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={nomeDestinatario}
          onChangeText={setNomeDestinatario}
          placeholder="Nome do destinatário"
          autoFocus
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.nextButton, !nomeDestinatario && styles.nextButtonDisabled]}
          onPress={() => {
            if (nomeDestinatario.trim()) {
              setCurrentStep('descricao');
            }
          }}
          disabled={!nomeDestinatario.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDescricaoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>📦 Descrição da Encomenda</Text>
      <Text style={styles.stepSubtitle}>Descreva o conteúdo da encomenda</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={descricaoEncomenda}
          onChangeText={setDescricaoEncomenda}
          placeholder="Ex: Caixa com roupas, eletrônicos, documentos..."
          multiline
          numberOfLines={4}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.nextButton, !descricaoEncomenda.trim() && styles.nextButtonDisabled]}
          onPress={() => {
            if (descricaoEncomenda.trim()) {
              setCurrentStep('observacoes');
            }
          }}
          disabled={!descricaoEncomenda.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderObservacoesStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>📝 Observações</Text>
      <Text style={styles.stepSubtitle}>Adicione observações (opcional)</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={observacoes}
          onChangeText={setObservacoes}
          placeholder="Observações sobre a encomenda..."
          multiline
          numberOfLines={4}
          autoFocus
        />

        <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentStep('foto')}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFotoStep = () => {
    if (!cameraPermission) {
      return <Text>Solicitando permissão da câmera...</Text>;
    }

    if (!cameraPermission.granted) {
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>📸 Permissão da Câmera</Text>
          <Text style={styles.stepSubtitle}>Precisamos de acesso à câmera para tirar a foto</Text>
          <TouchableOpacity style={styles.nextButton} onPress={requestCameraPermission}>
            <Text style={styles.nextButtonText}>Permitir Câmera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>📸 Foto da Encomenda</Text>
        <Text style={styles.stepSubtitle}>Tire uma foto da encomenda ou entregador</Text>

        {!fotoTirada ? (
          <View style={styles.cameraContainer}>
            <CameraView style={styles.camera} facing="back" />
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => {
                  setFotoTirada(true);
                  setCurrentStep('confirmacao');
                }}>
                <Text style={styles.captureButtonText}>📸</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.photoTakenContainer}>
            <Text style={styles.photoTakenText}>✅ Foto capturada com sucesso!</Text>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => setCurrentStep('confirmacao')}>
              <Text style={styles.nextButtonText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderConfirmacaoStep = () => {
    const handleConfirm = async () => {
      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado');
        return;
      }

      if (!apartamento || !empresaSelecionada || !nomeDestinatario || !descricaoEncomenda) {
        Alert.alert('Erro', 'Todos os campos obrigatórios devem ser preenchidos');
        return;
      }

      setIsLoading(true);

      try {
        // Validar se o apartamento existe no prédio do porteiro
        const { data: apartmentData, error: apartmentError } = await supabase
          .from('apartments')
          .select('id, number, floor')
          .eq('number', apartamento)
          .eq('building_id', user.building_id)
          .single();

        if (apartmentError) {
          console.error('Erro ao buscar apartamento:', apartmentError);
          Alert.alert(
            'Apartamento não encontrado', 
            `O apartamento ${apartamento} não existe neste prédio. Verifique o número e tente novamente.`
          );
          setIsLoading(false);
          return;
        }

        if (!apartmentData) {
          Alert.alert(
            'Apartamento não encontrado', 
            `O apartamento ${apartamento} não foi encontrado neste prédio.`
          );
          setIsLoading(false);
          return;
        }

        const apartmentId = apartmentData.id;
        const visitSessionId = Crypto.randomUUID();
        const currentTime = new Date().toISOString();

        // Inserir dados na tabela deliveries
        const { error: deliveryError } = await supabase
          .from('deliveries')
          .insert({
            apartment_id: apartmentId,
            building_id: user.building_id,
            recipient_name: nomeDestinatario,
            delivery_company: empresaSelecionada,
            description: descricaoEncomenda,
            status: 'DELIVERED',
            received_at: currentTime,
            notes: observacoes || null
          });

        if (deliveryError) {
          console.error('Erro ao inserir entrega:', deliveryError);
          Alert.alert('Erro ao registrar entrega', 'Não foi possível salvar os dados da entrega. Tente novamente.');
          setIsLoading(false);
          return;
        }

        // Inserir dados na tabela visitor_logs
        const { error: logError } = await supabase
          .from('visitor_logs')
          .insert({
            apartment_id: apartmentId,
            building_id: user.building_id,
            authorized_by: user.id,
            log_time: currentTime,
            tipo_log: 'DELIVERY',
            visit_session_id: visitSessionId,
            purpose: `Entrega: ${descricaoEncomenda}`,
            status: 'COMPLETED'
          });

        if (logError) {
          console.error('Erro ao inserir log:', logError);
          Alert.alert('Erro ao registrar log', 'A entrega foi salva, mas houve um problema ao registrar o log.');
          setIsLoading(false);
          return;
        }

        Alert.alert(
          'Sucesso!', 
          `Encomenda registrada com sucesso para o apartamento ${apartamento}!`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset do formulário
                setApartamento('');
                setEmpresaSelecionada('');
                setNomeDestinatario('');
                setDescricaoEncomenda('');
                setObservacoes('');
                setFotoTirada(null);
                setCurrentStep('apartamento');
              }
            }
          ]
        );
        
      } catch (error) {
        console.error('Erro geral:', error);
        Alert.alert(
          'Erro inesperado', 
          'Ocorreu um erro inesperado. Verifique sua conexão e tente novamente.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>✅ Confirmação</Text>
        <Text style={styles.stepSubtitle}>Revise os dados da encomenda</Text>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Apartamento:</Text>
            <Text style={styles.summaryValue}>{apartamento}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Empresa:</Text>
            <Text style={styles.summaryValue}>{empresaSelecionada?.nome}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Destinatário:</Text>
            <Text style={styles.summaryValue}>{nomeDestinatario}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Descrição:</Text>
            <Text style={styles.summaryValue}>{descricaoEncomenda}</Text>
          </View>

          {observacoes && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Observações:</Text>
              <Text style={styles.summaryValue}>{observacoes}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.confirmFinalButton, isLoading && styles.confirmFinalButtonDisabled]} 
          onPress={handleConfirm}
          disabled={isLoading}>
          <Text style={styles.confirmFinalButtonText}>
            {isLoading ? 'Registrando...' : 'Confirmar Registro'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'apartamento':
        return renderApartamentoStep();
      case 'empresa':
        return renderEmpresaStep();
      case 'destinatario':
        return renderDestinatarioStep();
      case 'descricao':
        return renderDescricaoStep();
      case 'observacoes':
        return renderObservacoesStep();
      case 'foto':
        return renderFotoStep();
      case 'confirmacao':
        return renderConfirmacaoStep();
      default:
        return renderApartamentoStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Encomenda</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(Object.keys({ apartamento, empresa: empresaSelecionada, destinatario: nomeDestinatario, descricao: descricaoEncomenda, observacoes: true, foto: fotoTirada, confirmacao: currentStep === 'confirmacao' }).filter(Boolean).length / 7) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {renderCurrentStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FF9800',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    padding: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 2,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  keypadContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  displayContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  displayLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  displayValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 2,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#FF9800',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  empresasContainer: {
    flex: 1,
  },
  empresasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  empresaButton: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    marginBottom: 15,
  },
  empresaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  empresaNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  inputContainer: {
    gap: 20,
  },
  textInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  nextButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    fontSize: 32,
  },
  photoTakenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  photoTakenText: {
    fontSize: 18,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    gap: 15,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  confirmFinalButton: {
    backgroundColor: '#FF9800',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmFinalButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  confirmFinalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
