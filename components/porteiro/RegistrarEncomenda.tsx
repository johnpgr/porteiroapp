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

type FlowStep = 'apartamento' | 'empresa' | 'entregador' | 'observacoes' | 'foto' | 'confirmacao';

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
  const [currentStep, setCurrentStep] = useState<FlowStep>('apartamento');
  const [apartamento, setApartamento] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<(typeof empresasEntrega)[0] | null>(
    null
  );
  const [nomeEntregador, setNomeEntregador] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoTirada, setFotoTirada] = useState(false);
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
                setCurrentStep('entregador');
              }}>
              <Text style={styles.empresaIcon}>{empresa.icon}</Text>
              <Text style={styles.empresaNome}>{empresa.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderEntregadorStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>👤 Entregador</Text>
      <Text style={styles.stepSubtitle}>Digite o nome do entregador</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={nomeEntregador}
          onChangeText={setNomeEntregador}
          placeholder="Nome do entregador"
          autoFocus
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.nextButton, !nomeEntregador && styles.nextButtonDisabled]}
          onPress={() => {
            if (nomeEntregador.trim()) {
              setCurrentStep('observacoes');
            }
          }}
          disabled={!nomeEntregador.trim()}>
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
            <CameraView style={styles.camera} facing="back">
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
            </CameraView>
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
    const handleConfirm = () => {
      // Aqui você implementaria a lógica para salvar os dados
      const message = `O apartamento ${apartamento} foi notificado sobre a chegada da encomenda ${empresaSelecionada?.nome}.`;

      if (onConfirm) {
        onConfirm(message);
      } else {
        Alert.alert('✅ Encomenda Registrada!', message, [{ text: 'OK' }]);
        onClose();
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
            <Text style={styles.summaryLabel}>Entregador:</Text>
            <Text style={styles.summaryValue}>{nomeEntregador}</Text>
          </View>

          {observacoes && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Observações:</Text>
              <Text style={styles.summaryValue}>{observacoes}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.confirmFinalButton} onPress={handleConfirm}>
          <Text style={styles.confirmFinalButtonText}>Confirmar Registro</Text>
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
      case 'entregador':
        return renderEntregadorStep();
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
                width: `${(Object.keys({ apartamento, empresa: empresaSelecionada, entregador: nomeEntregador, observacoes: true, foto: fotoTirada, confirmacao: currentStep === 'confirmacao' }).filter(Boolean).length / 6) * 100}%`,
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
    flex: 1,
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
  confirmFinalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
