import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, SafeAreaView, ScrollView } from 'react-native';

type FlowStep = 'apartamento' | 'placa' | 'marca' | 'cor' | 'convidado' | 'confirmacao';

interface RegistrarVeiculoProps {
  onClose: () => void;
}

const marcasVeiculos = [
  { id: 'toyota', nome: 'Toyota', icon: '🚗' },
  { id: 'volkswagen', nome: 'Volkswagen', icon: '🚙' },
  { id: 'chevrolet', nome: 'Chevrolet', icon: '🚗' },
  { id: 'ford', nome: 'Ford', icon: '🚙' },
  { id: 'fiat', nome: 'Fiat', icon: '🚗' },
  { id: 'honda', nome: 'Honda', icon: '🚙' },
  { id: 'hyundai', nome: 'Hyundai', icon: '🚗' },
  { id: 'nissan', nome: 'Nissan', icon: '🚙' },
  { id: 'renault', nome: 'Renault', icon: '🚗' },
  { id: 'peugeot', nome: 'Peugeot', icon: '🚙' },
  { id: 'bmw', nome: 'BMW', icon: '🏎️' },
  { id: 'mercedes', nome: 'Mercedes', icon: '🏎️' },
  { id: 'audi', nome: 'Audi', icon: '🏎️' },
  { id: 'outros', nome: 'Outros', icon: '🚗' },
];

const coresVeiculos = [
  { id: 'branco', nome: 'Branco', cor: '#FFFFFF', borda: '#E0E0E0' },
  { id: 'preto', nome: 'Preto', cor: '#000000', borda: '#000000' },
  { id: 'prata', nome: 'Prata', cor: '#C0C0C0', borda: '#A0A0A0' },
  { id: 'cinza', nome: 'Cinza', cor: '#808080', borda: '#606060' },
  { id: 'vermelho', nome: 'Vermelho', cor: '#FF0000', borda: '#CC0000' },
  { id: 'azul', nome: 'Azul', cor: '#0000FF', borda: '#0000CC' },
  { id: 'verde', nome: 'Verde', cor: '#008000', borda: '#006600' },
  { id: 'amarelo', nome: 'Amarelo', cor: '#FFFF00', borda: '#CCCC00' },
  { id: 'marrom', nome: 'Marrom', cor: '#8B4513', borda: '#654321' },
  { id: 'dourado', nome: 'Dourado', cor: '#FFD700', borda: '#B8860B' },
  { id: 'roxo', nome: 'Roxo', cor: '#800080', borda: '#600060' },
  { id: 'outros', nome: 'Outros', cor: '#666666', borda: '#444444' },
];

export default function RegistrarVeiculo({ onClose }: RegistrarVeiculoProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('apartamento');
  const [apartamento, setApartamento] = useState('');
  const [placa, setPlaca] = useState('');
  const [marcaSelecionada, setMarcaSelecionada] = useState<typeof marcasVeiculos[0] | null>(null);
  const [corSelecionada, setCorSelecionada] = useState<typeof coresVeiculos[0] | null>(null);
  const [nomeConvidado, setNomeConvidado] = useState('');

  const formatPlaca = (text: string) => {
    // Remove caracteres não alfanuméricos
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Formato brasileiro: ABC-1234 ou ABC1D23
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return cleaned.slice(0, 3) + '-' + cleaned.slice(3);
    } else {
      return cleaned.slice(0, 3) + '-' + cleaned.slice(3, 7);
    }
  };

  const renderNumericKeypad = (value: string, setValue: (val: string) => void, onNext: () => void) => (
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
            onPress={() => setValue(value + num.toString())}
          >
            <Text style={styles.keypadButtonText}>{num}</Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity
          style={styles.keypadButton}
          onPress={() => setValue(value.slice(0, -1))}
        >
          <Text style={styles.keypadButtonText}>⌫</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.keypadButton, styles.confirmButton]}
          onPress={onNext}
          disabled={!value}
        >
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
          setCurrentStep('placa');
        }
      })}
    </View>
  );

  const renderPlacaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🚗 Placa do Veículo</Text>
      <Text style={styles.stepSubtitle}>Digite a placa do veículo</Text>
      
      <View style={styles.inputContainer}>
        <View style={styles.placaContainer}>
          <Text style={styles.placaLabel}>BRASIL</Text>
          <TextInput
            style={styles.placaInput}
            value={placa}
            onChangeText={(text) => setPlaca(formatPlaca(text))}
            placeholder="ABC-1234"
            autoFocus
            autoCapitalize="characters"
            maxLength={8}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.nextButton, !placa && styles.nextButtonDisabled]}
          onPress={() => {
            if (placa.trim()) {
              setCurrentStep('marca');
            }
          }}
          disabled={!placa.trim()}
        >
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMarcaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🏭 Marca do Veículo</Text>
      <Text style={styles.stepSubtitle}>Selecione a marca do veículo</Text>
      
      <ScrollView style={styles.marcasContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.marcasGrid}>
          {marcasVeiculos.map((marca) => (
            <TouchableOpacity
              key={marca.id}
              style={[
                styles.marcaButton,
                marcaSelecionada?.id === marca.id && styles.marcaButtonSelected
              ]}
              onPress={() => {
                setMarcaSelecionada(marca);
                setCurrentStep('cor');
              }}
            >
              <Text style={styles.marcaIcon}>{marca.icon}</Text>
              <Text style={styles.marcaNome}>{marca.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderCorStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🎨 Cor do Veículo</Text>
      <Text style={styles.stepSubtitle}>Selecione a cor do veículo</Text>
      
      <ScrollView style={styles.coresContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.coresGrid}>
          {coresVeiculos.map((cor) => (
            <TouchableOpacity
              key={cor.id}
              style={[
                styles.corButton,
                { borderColor: cor.borda },
                corSelecionada?.id === cor.id && styles.corButtonSelected
              ]}
              onPress={() => {
                setCorSelecionada(cor);
                setCurrentStep('convidado');
              }}
            >
              <View 
                style={[
                  styles.corCircle, 
                  { backgroundColor: cor.cor, borderColor: cor.borda }
                ]} 
              />
              <Text style={styles.corNome}>{cor.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderConvidadoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>👤 Nome do Convidado</Text>
      <Text style={styles.stepSubtitle}>Digite o nome da pessoa associada ao veículo</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={nomeConvidado}
          onChangeText={setNomeConvidado}
          placeholder="Nome do convidado"
          autoFocus
          autoCapitalize="words"
        />
        
        <TouchableOpacity
          style={[styles.nextButton, !nomeConvidado && styles.nextButtonDisabled]}
          onPress={() => {
            if (nomeConvidado.trim()) {
              setCurrentStep('confirmacao');
            }
          }}
          disabled={!nomeConvidado.trim()}
        >
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmacaoStep = () => {
    const handleConfirm = () => {
      // Aqui você implementaria a lógica para salvar os dados
      Alert.alert(
        '✅ Veículo Registrado!',
        `O apartamento ${apartamento} foi notificado sobre a chegada do veículo ${placa} de ${nomeConvidado}.`,
        [{ text: 'OK' }]
      );
      
      // Fechar automaticamente após 3 segundos
      setTimeout(() => {
        onClose();
      }, 3000);
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>✅ Confirmação</Text>
        <Text style={styles.stepSubtitle}>Revise os dados do veículo</Text>
        
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Apartamento:</Text>
            <Text style={styles.summaryValue}>{apartamento}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Placa:</Text>
            <Text style={styles.summaryValue}>{placa}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Marca:</Text>
            <Text style={styles.summaryValue}>{marcaSelecionada?.nome}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Cor:</Text>
            <View style={styles.summaryCorContainer}>
              <View 
                style={[
                  styles.summaryCorCircle, 
                  { backgroundColor: corSelecionada?.cor, borderColor: corSelecionada?.borda }
                ]} 
              />
              <Text style={styles.summaryValue}>{corSelecionada?.nome}</Text>
            </View>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Convidado:</Text>
            <Text style={styles.summaryValue}>{nomeConvidado}</Text>
          </View>
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
      case 'placa':
        return renderPlacaStep();
      case 'marca':
        return renderMarcaStep();
      case 'cor':
        return renderCorStep();
      case 'convidado':
        return renderConvidadoStep();
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
        <Text style={styles.headerTitle}>Registrar Veículo</Text>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(Object.keys({apartamento, placa, marca: marcaSelecionada, cor: corSelecionada, convidado: nomeConvidado, confirmacao: currentStep === 'confirmacao'}).filter(Boolean).length / 6) * 100}%` }
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
    backgroundColor: '#2196F3',
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
    backgroundColor: '#2196F3',
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
    backgroundColor: '#2196F3',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  inputContainer: {
    gap: 20,
  },
  placaContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
    overflow: 'hidden',
  },
  placaLabel: {
    backgroundColor: '#2196F3',
    color: '#fff',
    textAlign: 'center',
    padding: 8,
    fontSize: 12,
    fontWeight: 'bold',
  },
  placaInput: {
    padding: 15,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  textInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  nextButton: {
    backgroundColor: '#2196F3',
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
  marcasContainer: {
    flex: 1,
  },
  marcasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  marcaButton: {
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
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  marcaButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  marcaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  marcaNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  coresContainer: {
    flex: 1,
  },
  coresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  corButton: {
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
  corButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  corCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 2,
  },
  corNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
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
  },
  summaryCorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryCorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  confirmFinalButton: {
    backgroundColor: '#2196F3',
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