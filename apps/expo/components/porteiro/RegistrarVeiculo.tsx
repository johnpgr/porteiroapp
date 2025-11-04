import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '~/components/Modal';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import { notificationApi } from '../../services/notificationApi';
import { notifyResidentsVisitorArrival } from '../../services/pushNotificationService';

// Função para gerar UUID compatível com React Native
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type FlowStep = 'placa' | 'apartamento' | 'empresa' | 'marca' | 'modelo' | 'cor' | 'convidado' | 'confirmacao';

interface ApartmentInfo {
  id: string;
  number: string | number;
  floor?: number | null;
  building_id: string;
}

interface VehicleInfo {
  license_plate: string;
  model?: string;
  color?: string;
  brand?: string;
  apartment_id?: string | null;
  existing?: boolean;
  apartment_info?: ApartmentInfo;
}

interface RegistrarVeiculoProps {
  onClose: () => void;
  onConfirm?: (message: string) => void;
}

const empresasPrestadoras = [
  { id: 'claro', nome: 'Claro', icon: '📡', cor: '#E60000' },
  { id: 'vivo', nome: 'Vivo', icon: '📶', cor: '#660099' },
  { id: 'tim', nome: 'TIM', icon: '📱', cor: '#0066CC' },
  { id: 'oi', nome: 'Oi', icon: '📞', cor: '#FFD700' },
  { id: 'net', nome: 'NET/Claro', icon: '📺', cor: '#E60000' },
  { id: 'sky', nome: 'SKY', icon: '📡', cor: '#0066CC' },
  { id: 'encanador', nome: 'Encanador', icon: '🔧', cor: '#4CAF50' },
  { id: 'eletricista', nome: 'Eletricista', icon: '⚡', cor: '#FF9800' },
  { id: 'gas', nome: 'Gás', icon: '🔥', cor: '#FF5722' },
  { id: 'limpeza', nome: 'Limpeza', icon: '🧽', cor: '#2196F3' },
  { id: 'manutencao', nome: 'Manutenção', icon: '🔨', cor: '#795548' },
  { id: 'seguranca', nome: 'Segurança', icon: '🛡️', cor: '#607D8B' },
  { id: 'delivery', nome: 'Delivery', icon: '🛵', cor: '#FF6B35' },
  { id: 'outros', nome: 'Outros', icon: '🏢', cor: '#666666' },
];

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

export default function RegistrarVeiculo({ onClose, onConfirm }: RegistrarVeiculoProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('placa');
  const [apartamento, setApartamento] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<
    (typeof empresasPrestadoras)[0] | null
  >(null);
  const [placa, setPlaca] = useState('');
  const [marcaSelecionada, setMarcaSelecionada] = useState<(typeof marcasVeiculos)[0] | null>(null);
  const [modelo, setModelo] = useState('');
  const [corSelecionada, setCorSelecionada] = useState<(typeof coresVeiculos)[0] | null>(null);
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [hasOwner, setHasOwner] = useState(false);
  const [duplicatePlateError, setDuplicatePlateError] = useState(false);
  const [duplicatePlateMessage, setDuplicatePlateMessage] = useState('');
  const [doormanBuildingId, setDoormanBuildingId] = useState<string | null>(null);
  const [availableApartments, setAvailableApartments] = useState<{ id: string; number: string; floor?: number | null }[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<{id: string, number: string, floor: number | null} | null>(null);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get doorman's building_id from their profile
  useEffect(() => {
    const getDoormanBuildingId = async () => {
      if (user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('building_id')
          .eq('user_id', user.id)
          .single();

        if (profile && profile.building_id) {
          setDoormanBuildingId(profile.building_id);
        } else {
          console.error('Erro ao buscar building_id do porteiro:', error);
          Alert.alert('Erro', 'Não foi possível identificar o prédio do porteiro.');
        }
      }
    };

    getDoormanBuildingId();
  }, [user]);

  // Fetch available apartments for the doorman's building
  useEffect(() => {
    const fetchAvailableApartments = async () => {
      if (doormanBuildingId) {
        setIsLoadingApartments(true);
        try {
          const { data: apartments, error } = await supabase
            .from('apartments')
            .select('id, number, floor')
            .eq('building_id', doormanBuildingId)
            .order('number');

          if (error) {
            console.error('Erro ao buscar apartamentos:', error);
            Alert.alert('Erro', 'Não foi possível carregar os apartamentos.');
          } else {
            setAvailableApartments(apartments || []);
          }
        } catch (error) {
          console.error('Erro ao buscar apartamentos:', error);
          Alert.alert('Erro', 'Não foi possível carregar os apartamentos.');
        } finally {
          setIsLoadingApartments(false);
        }
      }
    };

    fetchAvailableApartments();
  }, [doormanBuildingId]);

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

  const checkForDuplicatePlate = async (licensePlate: string) => {
    if (!licensePlate || licensePlate.length < 7) {
      setDuplicatePlateError(false);
      setDuplicatePlateMessage('');
      return false;
    }
    
    try {
      const cleanPlate = licensePlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      
      // Verificar se já existe um veículo com esta placa
      const { data: existingVehicle, error } = await supabase
        .from('vehicles')
        .select('license_plate')
        .eq('license_plate', cleanPlate)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao verificar placa duplicada:', error);
        return false;
      }

      if (existingVehicle) {
        setDuplicatePlateError(true);
        setDuplicatePlateMessage(`❌ PLACA JÁ CADASTRADA\n\nA placa ${licensePlate} já está registrada no sistema. Não é possível cadastrar novamente como visitante.\n\nPor favor, verifique a placa ou entre em contato com a administração.`);
        // Limpar informações do veículo quando duplicata for detectada
        setVehicleInfo(null);
        setIsLoadingVehicle(false);
        return true; // Retorna true indicando que é duplicata
      } else {
        setDuplicatePlateError(false);
        setDuplicatePlateMessage('');
        return false; // Retorna false indicando que não é duplicata
      }
    } catch (error) {
      console.error('Erro ao verificar placa duplicada:', error);
      return false;
    }
  };

  const searchVehicleByPlate = async (licensePlate: string) => {
    if (!licensePlate || licensePlate.length < 7) return;
    
    setIsLoadingVehicle(true);
    try {
      const cleanPlate = licensePlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      
      // Buscar veículo e informações do apartamento
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          apartments(
            id,
            number,
            floor,
            building_id
          )
        `)
        .eq('license_plate', cleanPlate)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar veículo:', error);
        return;
      }

      if (vehicle) {
        setVehicleInfo({
          license_plate: vehicle.license_plate,
          model: vehicle.model || undefined,
          color: vehicle.color || undefined,
          apartment_id: vehicle.apartment_id,
          existing: true,
          apartment_info: vehicle.apartments || undefined
        });
        setHasOwner(!!vehicle.apartment_id);
        
        // Se o veículo existe e tem apartamento vinculado, pré-preencher apartamento
        if (vehicle.apartment_id && vehicle.apartments && vehicle.apartments.number) {
          setApartamento(vehicle.apartments.number.toString());
        }
      } else {
        // Veículo não existe, precisa cadastrar informações
        setVehicleInfo({
          license_plate: cleanPlate,
          existing: false
        });
        setHasOwner(false);
      }
    } catch (error) {
      console.error('Erro ao buscar veículo:', error);
      console.log()
    } finally {
      setIsLoadingVehicle(false);
    }
  };



  // Carregar prédios quando necessário


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
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map((item, index) => {
          const isBackspace = item === '⌫';
          const isConfirm = item === '✓';
          const num = typeof item === 'number' ? item : null;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.keypadButton,
                isConfirm && styles.confirmButton
              ]}
              onPress={() => {
                if (isBackspace) {
                  setValue(value.slice(0, -1));
                } else if (isConfirm) {
                  onNext();
                } else if (num !== null) {
                  setValue(value + num.toString());
                }
              }}
              disabled={isConfirm && !value}>
              <Text style={isConfirm ? styles.confirmButtonText : styles.keypadButtonText}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderApartamentoStep = () => {
    const handleApartmentConfirm = async () => {
      if (!apartamento) {
        Alert.alert('Erro', 'Digite o número do apartamento.');
        return;
      }

      // Buscar o apartamento pelo número digitado
      const foundApartment = availableApartments.find(
        (apt) => apt.number === apartamento
      );

      if (!foundApartment) {
        Alert.alert(
          'Erro',
          `Apartamento ${apartamento} não encontrado. Verifique o número e tente novamente.`
        );
        return;
      }

      if (!foundApartment.id) {
        Alert.alert('Erro', 'Apartamento inválido. Tente novamente.');
        return;
      }

      // Validar se há moradores cadastrados no apartamento
      try {
        console.log('🔍 [RegistrarVeiculo] Verificando moradores no apartamento:', foundApartment.id);
        
        const { data: residents, error: residentsError } = await supabase
          .from('apartment_residents')
          .select('profile_id')
          .eq('apartment_id', foundApartment.id)
          .limit(1);

        if (residentsError) {
          console.error('❌ [RegistrarVeiculo] Erro ao verificar moradores:', residentsError);
          Alert.alert('Erro', 'Não foi possível verificar os moradores do apartamento. Tente novamente.');
          return;
        }

        if (!residents || residents.length === 0) {
          console.log('⚠️ [RegistrarVeiculo] Nenhum morador encontrado no apartamento:', apartamento);
          Alert.alert(
            'Apartamento sem Residentes',
            `Não há residentes cadastrados no apartamento ${apartamento}. Não é possível registrar veículos para este apartamento.`,
            [{ text: 'OK' }]
          );
          return;
        }

        console.log('✅ [RegistrarVeiculo] Moradores encontrados no apartamento:', residents.length);
      } catch (error) {
        console.error('❌ [RegistrarVeiculo] Erro na validação de moradores:', error);
        Alert.alert('Erro', 'Erro ao validar apartamento. Tente novamente.');
        return;
      }

      console.log('Selecionando apartamento:', foundApartment);
      setSelectedApartment({
        id: foundApartment.id,
        number: foundApartment.number,
        floor: foundApartment.floor || null
      });
      console.log('Apartamento selecionado com sucesso:', {
        id: foundApartment.id,
        number: foundApartment.number,
      });
      setCurrentStep('convidado');
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Apartamento</Text>
        <Text style={styles.stepSubtitle}>Digite o número do apartamento</Text>

        {isLoadingApartments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Carregando apartamentos...</Text>
          </View>
        ) : availableApartments.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>⚠️ Nenhum Apartamento</Text>
            <Text style={styles.errorMessage}>
              Não há apartamentos cadastrados para este prédio.
            </Text>
          </View>
        ) : (
          renderNumericKeypad(apartamento, setApartamento, handleApartmentConfirm)
        )}
      </View>
    );
  };

  const renderEmpresaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Empresa/Serviço</Text>
      <Text style={styles.stepSubtitle}>Selecione a empresa ou tipo de serviço</Text>

      <ScrollView style={styles.empresasContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.empresasGrid}>
          {empresasPrestadoras.map((empresa) => (
            <TouchableOpacity
              key={empresa.id}
              style={[
                styles.empresaButton,
                { borderColor: empresa.cor },
                empresaSelecionada?.id === empresa.id && { backgroundColor: empresa.cor + '20' },
              ]}
              onPress={() => {
                setEmpresaSelecionada(empresa);
                setCurrentStep('placa');
              }}>
              <Text style={styles.empresaIcon}>{empresa.icon}</Text>
              <Text style={styles.empresaNome}>{empresa.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderPlacaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Placa do Veículo</Text>
      <Text style={styles.stepSubtitle}>Digite a placa do veículo para verificar se já existe</Text>

      <View style={styles.inputContainer}>
        <View style={styles.placaContainer}>
          <Text style={styles.placaLabel}>BRASIL</Text>
          <TextInput
            style={styles.placaInput}
            value={placa}
            onChangeText={async (text) => {
              const formatted = formatPlaca(text);
              setPlaca(formatted);
              
              // Limpar erros anteriores quando o usuário começar a digitar
              if (duplicatePlateError) {
                setDuplicatePlateError(false);
                setDuplicatePlateMessage('');
                setVehicleInfo(null);
              }
              
              const cleaned = text.replace(/[^A-Za-z0-9]/g, '');
              if (cleaned.length >= 7) {
                // Primeiro verificar se é duplicata
                const isDuplicate = await checkForDuplicatePlate(formatted);
                
                // Só buscar informações do veículo se NÃO for duplicata
                if (!isDuplicate) {
                  await searchVehicleByPlate(formatted);
                }
              }
            }}
            placeholder="ABC-1234"
            autoFocus
            autoCapitalize="characters"
            maxLength={8}
          />
        </View>

        {isLoadingVehicle && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.loadingText}>Verificando placa...</Text>
          </View>
        )}

        {duplicatePlateError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>❌ Placa Duplicada</Text>
            <Text style={styles.errorMessage}>{duplicatePlateMessage}</Text>
          </View>
        )}

        {vehicleInfo && vehicleInfo.existing && !duplicatePlateError && (
          <View style={styles.vehicleFoundContainer}>
            <Text style={styles.vehicleFoundTitle}>✅ Veículo Encontrado!</Text>
            <Text style={styles.vehicleFoundText}>
              {hasOwner ? 'Veículo vinculado a um morador' : 'Veículo sem morador vinculado'}
            </Text>
            {vehicleInfo.model && <Text style={styles.vehicleFoundDetail}>Modelo: {vehicleInfo.model}</Text>}
            {vehicleInfo.color && <Text style={styles.vehicleFoundDetail}>Cor: {vehicleInfo.color}</Text>}
          </View>
        )}

        <TouchableOpacity
          style={[styles.nextButton, (!placa || isLoadingVehicle || duplicatePlateError || !vehicleInfo) && styles.nextButtonDisabled]}
          onPress={() => {
            // BLOQUEIO ABSOLUTO: Não permitir continuar se há erro de duplicata
            if (duplicatePlateError) {
              Alert.alert(
                '❌ Placa Duplicada',
                'Esta placa já está cadastrada no sistema. Não é possível prosseguir com o cadastro.',
                [{ text: 'OK' }]
              );
              return;
            }
            
            if (placa.trim() && !isLoadingVehicle && !duplicatePlateError && vehicleInfo) {
              // Só permitir continuar se não há erro de duplicata e há informações do veículo
              if (vehicleInfo.existing) {
                // Veículo existe, ir direto para apartamento (prédio já definido automaticamente)
                setCurrentStep('apartamento');
              } else {
                // Veículo não existe, ir para marca
                setCurrentStep('marca');
              }
            }
          }}
          disabled={!placa.trim() || isLoadingVehicle || duplicatePlateError || !vehicleInfo}>
          <Text style={styles.nextButtonText}>
            {isLoadingVehicle ? 'Verificando...' : duplicatePlateError ? '❌ PLACA JÁ CADASTRADA' : 'Continuar →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMarcaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Marca do Veículo</Text>
      <Text style={styles.stepSubtitle}>Selecione a marca do veículo (novo registro)</Text>

      <ScrollView style={styles.marcasContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.marcasGrid}>
          {marcasVeiculos.map((marca) => (
            <TouchableOpacity
              key={marca.id}
              style={[
                styles.marcaButton,
                marcaSelecionada?.id === marca.id && styles.marcaButtonSelected,
              ]}
              onPress={() => {
                setMarcaSelecionada(marca);
                setCurrentStep('modelo');
              }}>
              <Text style={styles.marcaIcon}>{marca.icon}</Text>
              <Text style={styles.marcaNome}>{marca.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderModeloStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Modelo do Veículo</Text>
      <Text style={styles.stepSubtitle}>Digite o modelo do veículo</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={modelo}
          onChangeText={setModelo}
          placeholder="Ex: Civic, Corolla, Gol..."
          autoFocus
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.nextButton, !modelo.trim() && styles.nextButtonDisabled]}
          onPress={() => {
            if (modelo.trim()) {
              setCurrentStep('cor');
            }
          }}
          disabled={!modelo.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCorStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Cor do Veículo</Text>
      <Text style={styles.stepSubtitle}>Selecione a cor do veículo</Text>

      <ScrollView style={styles.coresContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.coresGrid}>
          {coresVeiculos.map((cor) => (
            <TouchableOpacity
              key={cor.id}
              style={[
                styles.corButton,
                { borderColor: cor.borda },
                corSelecionada?.id === cor.id && styles.corButtonSelected,
              ]}
              onPress={() => {
                setCorSelecionada(cor);
                setCurrentStep('apartamento');
              }}>
              <View
                style={[styles.corCircle, { backgroundColor: cor.cor, borderColor: cor.borda }]}
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
      <Text style={styles.stepTitle}>Nome do Convidado</Text>
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
          disabled={!nomeConvidado.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleConfirm = async () => {
    // 🚫 PROTEÇÃO CRÍTICA: Prevenir múltiplas execuções
    if (isSubmitting) {
      console.log('⚠️ [RegistrarVeiculo] Tentativa de submissão duplicada bloqueada');
      return;
    }

    try {
      setIsSubmitting(true);

      // Validar se apartamento foi selecionado
      if (!selectedApartment || !selectedApartment.id) {
        console.error('❌ [RegistrarVeiculo] Apartamento não selecionado:', selectedApartment);
        Alert.alert('Erro', 'Por favor, selecione um apartamento antes de continuar');
        setIsSubmitting(false);
        return;
      }

      console.log('✅ [RegistrarVeiculo] Apartamento selecionado:', selectedApartment);

      // VALIDAÇÃO FINAL: Verificar novamente se a placa não é duplicata antes de confirmar
      const cleanPlate = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      console.log('🔍 [RegistrarVeiculo] Verificando duplicata para placa:', cleanPlate);
      
      const { data: finalDuplicateCheck, error: duplicateCheckError } = await supabase
        .from('vehicles')
        .select('license_plate')
        .eq('license_plate', cleanPlate)
        .single();

      if (finalDuplicateCheck && !duplicateCheckError) {
        console.error('❌ [RegistrarVeiculo] Placa duplicada encontrada:', finalDuplicateCheck);
        Alert.alert(
          '❌ Erro de Validação',
          `A placa ${placa} já está cadastrada no sistema. O cadastro não pode ser concluído.`,
          [{ text: 'OK' }]
        );
        setIsSubmitting(false);
        return;
      }
      
      // Se chegou até aqui e há erro de duplicata no estado, também bloquear
      if (duplicatePlateError) {
        console.error('❌ [RegistrarVeiculo] Estado de duplicata ativo - bloqueando registro');
        Alert.alert(
          '❌ Placa Duplicada',
          'Esta placa já está cadastrada no sistema. Não é possível prosseguir com o cadastro.',
          [{ text: 'OK' }]
        );
        setIsSubmitting(false);
        return;
      }
      
      console.log('✅ [RegistrarVeiculo] Verificação de duplicata concluída - placa liberada');

      // Preparar informações completas do veículo para salvar no visitor_logs
      const vehicleData = {
        license_plate: placa,
        brand: marcaSelecionada?.nome || null,
        model: modelo || vehicleInfo?.model || null,
        color: corSelecionada?.nome || vehicleInfo?.color || null,
        existing_vehicle: vehicleInfo?.existing || false,
        has_apartment: hasOwner,
        apartment_id: selectedApartment?.id || null, // Usar apartment_id selecionado
        apartment_number: vehicleInfo?.apartment_info?.number || null
      };
      
      console.log('📋 [RegistrarVeiculo] Dados do veículo preparados:', vehicleData);
      console.log('🏠 [RegistrarVeiculo] selectedApartment atual:', selectedApartment);
      console.log('👤 [RegistrarVeiculo] Nome do convidado:', nomeConvidado);
      console.log('🏢 [RegistrarVeiculo] Building ID do porteiro:', doormanBuildingId);

      // Verificar se já existe um veículo com esta placa (segunda verificação)
      console.log('🔍 [RegistrarVeiculo] Verificando se veículo já existe no banco...');
      const { data: existingVehicleByPlate, error: vehicleCheckError } = await supabase
        .from('vehicles')
        .select('id, license_plate, model, color')
        .eq('license_plate', cleanPlate)
        .single();

      console.log('📊 [RegistrarVeiculo] Resultado da verificação:', { existingVehicleByPlate, vehicleCheckError });

      // Se o veículo não existe, criar registro na tabela vehicles primeiro
      if (!vehicleInfo?.existing && !existingVehicleByPlate && marcaSelecionada && corSelecionada) {
        // Validação adicional para garantir que selectedApartment existe
        if (!selectedApartment || !selectedApartment.id) {
          console.error('❌ [RegistrarVeiculo] Erro: selectedApartment não está definido ou não tem ID');
          Alert.alert('Erro', 'Nenhum apartamento foi selecionado. Por favor, selecione um apartamento.');
          setIsSubmitting(false);
          return;
        }
        
        console.log('➕ [RegistrarVeiculo] Inserindo novo veículo no banco...');
        console.log('🏠 [RegistrarVeiculo] Inserindo veículo com apartment_id:', selectedApartment.id);
        console.log('📋 [RegistrarVeiculo] selectedApartment completo:', selectedApartment);
        
        const vehicleInsertData = {
          license_plate: placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
          brand: marcaSelecionada.nome,
          model: modelo,
          color: corSelecionada.nome,
          apartment_id: selectedApartment?.id || null, // Usar apartment_id selecionado
        };
        
        console.log('📝 [RegistrarVeiculo] Dados que serão inseridos na tabela vehicles:', vehicleInsertData);
        
        const { error: vehicleError } = await supabase
          .from('vehicles')
          .insert(vehicleInsertData);

        if (vehicleError) {
          console.error('❌ [RegistrarVeiculo] Erro ao salvar veículo:', vehicleError);
          Alert.alert('Erro', 'Não foi possível salvar o veículo. Tente novamente.');
          setIsSubmitting(false);
          return;
        }
        
        console.log('✅ [RegistrarVeiculo] Veículo inserido com sucesso com apartment_id:', vehicleInsertData.apartment_id);
      } else if (existingVehicleByPlate) {
        console.log('♻️ [RegistrarVeiculo] Veículo com placa', placa, 'já existe. Reutilizando dados existentes.');
        // Atualizar vehicleData com os dados do veículo existente
        vehicleData.existing_vehicle = true;
        vehicleData.model = existingVehicleByPlate.model;
        vehicleData.color = existingVehicleByPlate.color;
      }

      // Usar o apartamento selecionado diretamente
      if (!selectedApartment) {
        Alert.alert('Erro', 'Nenhum apartamento foi selecionado.');
        setIsSubmitting(false);
        return;
      }

      if (!doormanBuildingId) {
        Alert.alert('Erro', 'Não foi possível identificar o prédio do porteiro.');
        setIsSubmitting(false);
        return;
      }

      const apartmentData = {
        id: selectedApartment.id,
        building_id: doormanBuildingId,
        number: selectedApartment.number
      };

      // Salvar no visitor_logs com vehicle_info completo (sem criar visitante)
      console.log('📝 [RegistrarVeiculo] Registrando entrada no visitor_logs...');
      const logInsertData = {
        visitor_id: null, // Não criar visitante, apenas registrar o log
        apartment_id: apartmentData.id,
        building_id: apartmentData.building_id,
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: generateUUID(),
        vehicle_info: vehicleData,
        notification_status: 'pending',
        purpose: hasOwner ? `Veículo vinculado ao apartamento ${vehicleInfo?.apartment_info?.number}` : 'Veículo de visitante',
        guest_name: nomeConvidado, // Usar guest_name em vez de visitor_name
        entry_type: 'vehicle' // Adicionar tipo de entrada para identificar como veículo
      };
      console.log('📋 [RegistrarVeiculo] Dados do log para inserção:', logInsertData);
      
      const { data: visitorLogData, error } = await supabase
        .from('visitor_logs')
        .insert(logInsertData)
        .select('id')
        .single();

      if (error) {
        console.error('❌ [RegistrarVeiculo] Erro ao salvar log de visitante:', error);
        Alert.alert('Erro', 'Não foi possível registrar o veículo. Tente novamente.');
        setIsSubmitting(false);
        return;
      }

      console.log('✅ [RegistrarVeiculo] Log registrado com sucesso');

      // Enviar notificação push para os moradores via Edge Function
      try {
        console.log('📱 [RegistrarVeiculo] ==================== INICIO PUSH NOTIFICATION ====================');
        console.log('📱 [RegistrarVeiculo] Apartamento ID:', apartmentData.id);
        console.log('📱 [RegistrarVeiculo] Apartamento Number:', apartmentData.number);
        console.log('📱 [RegistrarVeiculo] Convidado:', nomeConvidado);
        console.log('📱 [RegistrarVeiculo] Placa:', placa);

        // Verificar se há moradores com push_token neste apartamento
        const { data: residentsCheck, error: checkError } = await supabase
          .from('apartment_residents')
          .select('profile_id, profiles!inner(id, full_name, push_token, notification_enabled, user_type)')
          .eq('apartment_id', apartmentData.id);

        console.log('🔍 [RegistrarVeiculo] Verificação de moradores:', {
          apartmentId: apartmentData.id,
          residentsCount: residentsCheck?.length,
          error: checkError,
          residents: residentsCheck?.map((r: any) => ({
            name: r.profiles?.full_name,
            user_type: r.profiles?.user_type,
            has_token: !!r.profiles?.push_token,
            notification_enabled: r.profiles?.notification_enabled,
            token_preview: r.profiles?.push_token ? r.profiles.push_token.substring(0, 20) + '...' : null
          }))
        });

        console.log('📱 [RegistrarVeiculo] Chamando notifyResidentsVisitorArrival...');

        const pushResult = await notifyResidentsVisitorArrival({
          apartmentIds: [apartmentData.id],
          visitorName: nomeConvidado,
          apartmentNumber: apartmentData.number,
          purpose: `Veículo: ${placa}${modelo ? ' - ' + modelo : ''}`,
          photoUrl: undefined,
        });

        console.log('📱 [RegistrarVeiculo] Resultado completo do push:', JSON.stringify(pushResult, null, 2));

        if (pushResult.success && pushResult.sent > 0) {
          console.log(`✅ [RegistrarVeiculo] Push notification enviada para ${pushResult.sent} morador(es)`);
        } else {
          console.warn('⚠️ [RegistrarVeiculo] Push notification não enviada:', pushResult.message);
          console.warn('⚠️ [RegistrarVeiculo] Total tokens encontrados:', pushResult.total);
          console.warn('⚠️ [RegistrarVeiculo] Enviados:', pushResult.sent);
          console.warn('⚠️ [RegistrarVeiculo] Falhas:', pushResult.failed);
        }
        console.log('📱 [RegistrarVeiculo] ==================== FIM PUSH NOTIFICATION ====================');
      } catch (pushError) {
        console.error('❌ [RegistrarVeiculo] Erro ao enviar push notification:', pushError);
        console.error('❌ [RegistrarVeiculo] Stack:', pushError instanceof Error ? pushError.stack : 'N/A');
        // Não bloqueia o fluxo se a notificação push falhar
      }

      // 🚫 PROTEÇÃO CRÍTICA WHATSAPP: Verificar se notificação já foi enviada antes de enviar
      console.log('📱 [RegistrarVeiculo] Verificando status da notificação antes de enviar WhatsApp...');
      const currentNotificationStatus = logInsertData.notification_status;
      console.log('📋 [RegistrarVeiculo] Status atual:', currentNotificationStatus);

      // Enviar notificação via API (WhatsApp) APENAS se ainda não foi enviada
      if (visitorLogData?.id && currentNotificationStatus !== 'sent') {
        try {
          console.log('📱 [RegistrarVeiculo] Enviando notificação WhatsApp...');
          console.log('🆔 [RegistrarVeiculo] Visitor log ID:', visitorLogData.id);

          // Buscar dados do morador para notificação
          const { data: residentData } = await supabase
            .from('apartments')
            .select(`
              number,
              apartment_residents!inner(
                profiles!inner(
                  full_name,
                  phone,
                  email
                ),
                is_owner
              ),
              buildings!inner(
                name
              )
            `)
            .eq('id', apartmentData.id)
            .eq('apartment_residents.is_owner', true)
            .single();

          if (residentData && residentData.apartment_residents && residentData.apartment_residents.length > 0) {
            // 🎯 ENVIAR APENAS PARA O PRIMEIRO PROPRIETÁRIO (evitar duplicatas)
            const resident = residentData.apartment_residents[0];
            const building = residentData.buildings;

            if (resident.profiles.phone && building && resident.profiles.full_name) {
              console.log('📱 [RegistrarVeiculo] Enviando WhatsApp para:', resident.profiles.full_name);

              await notificationApi.sendVisitorAuthorization({
                visitorName: nomeConvidado,
                residentName: resident.profiles.full_name,
                residentPhone: resident.profiles.phone,
                residentEmail: resident.profiles.email || '',
                building: building.name,
                apartment: residentData.number
              });

              console.log('✅ [RegistrarVeiculo] Mensagem de autorização WhatsApp enviada com sucesso');

              // Atualizar status da notificação IMEDIATAMENTE para evitar reenvios
              await supabase
                .from('visitor_logs')
                .update({ notification_status: 'sent' })
                .eq('id', visitorLogData.id);

              console.log('✅ [RegistrarVeiculo] Status atualizado para "sent" - notificação bloqueada para reenvios');
            } else {
              console.warn('⚠️ [RegistrarVeiculo] Dados insuficientes para enviar notificação via API');
            }
          } else {
            console.log('⚠️ [RegistrarVeiculo] Morador não encontrado ou sem telefone cadastrado');
          }
        } catch (notificationError) {
          console.error('❌ [RegistrarVeiculo] Erro no processo de notificação:', notificationError);
        }
      } else if (currentNotificationStatus === 'sent') {
        console.log('🚫 [RegistrarVeiculo] WhatsApp JÁ ENVIADO - bloqueando reenvio para evitar duplicatas');
      }

      console.log('🎉 [RegistrarVeiculo] Processo de registro concluído com sucesso!');
      
      // Sucesso - mostrar mensagem e fechar modal
      Alert.alert(
        'Sucesso!',
        `Veículo ${placa} registrado com sucesso para ${nomeConvidado}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              onConfirm?.(`Veículo ${placa} registrado para ${nomeConvidado}`);
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ [RegistrarVeiculo] Erro geral no handleConfirm:', error);
      if (error instanceof Error) {
        console.error('📋 [RegistrarVeiculo] Stack trace:', error.stack);
      }
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsSubmitting(false);
      console.log('🔓 [RegistrarVeiculo] Submissão desbloqueada - isSubmitting = false');
    }
  };

  const renderConfirmacaoStep = () => {

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Confirmação</Text>
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

          {(marcaSelecionada || vehicleInfo?.brand) && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Marca:</Text>
              <Text style={styles.summaryValue}>{marcaSelecionada?.nome || vehicleInfo?.brand}</Text>
            </View>
          )}

          {(modelo || vehicleInfo?.model) && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Modelo:</Text>
              <Text style={styles.summaryValue}>{modelo || vehicleInfo?.model}</Text>
            </View>
          )}

          {(corSelecionada || vehicleInfo?.color) && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cor:</Text>
              <View style={styles.summaryCorContainer}>
                {corSelecionada && (
                  <View
                    style={[
                      styles.summaryCorCircle,
                      { backgroundColor: corSelecionada?.cor, borderColor: corSelecionada?.borda },
                    ]}
                  />
                )}
                <Text style={styles.summaryValue}>{corSelecionada?.nome || vehicleInfo?.color}</Text>
              </View>
            </View>
          )}

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Convidado:</Text>
            <Text style={styles.summaryValue}>{nomeConvidado}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmFinalButton,
            isSubmitting && styles.confirmFinalButtonDisabled
          ]}
          onPress={() => {
            console.log('🔘 [RegistrarVeiculo] Botão Confirmar Registro foi pressionado!');
            handleConfirm();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.confirmFinalButtonText}>Registrando...</Text>
            </View>
          ) : (
            <Text style={styles.confirmFinalButtonText}>Confirmar Registro</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'placa':
        return renderPlacaStep();
      case 'apartamento':
        return renderApartamentoStep();
      case 'empresa':
        return renderEmpresaStep();
      case 'marca':
        return renderMarcaStep();
      case 'modelo':
        return renderModeloStep();
      case 'cor':
        return renderCorStep();
      case 'convidado':
        return renderConvidadoStep();
      case 'confirmacao':
        return renderConfirmacaoStep();
      default:
        return renderPlacaStep();
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Registrar Veículo</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(
                  (['placa', 'apartamento', 'marca', 'modelo', 'cor', 'convidado', 'confirmacao'].indexOf(currentStep) + 1) /
                  7
                ) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {['placa', 'apartamento', 'marca', 'modelo', 'cor', 'convidado', 'confirmacao'].indexOf(currentStep) + 1} de 7
        </Text>
      </View>

      {renderCurrentStep()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
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
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
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
    width: '100%',
    maxWidth: 240,
    alignSelf: 'center',
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
    margin: 5,
  },
  keypadButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
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
    marginTop: 20,
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
  },
  marcaButton: {
    width: '47%',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    minHeight: 100,
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
  },
  corButton: {
    width: '47%',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    minHeight: 100,
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
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  },
  summaryCorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  confirmFinalButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmFinalButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  confirmFinalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  vehicleFoundContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    marginTop: 10,
  },
  vehicleFoundTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 5,
  },
  vehicleFoundText: {
    fontSize: 14,
    color: '#388e3c',
    marginBottom: 5,
  },
  vehicleFoundDetail: {
    fontSize: 12,
    color: '#4caf50',
  },
  empresasContainer: {
    flex: 1,
  },
  empresasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  empresaButton: {
    width: '47%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  empresaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  empresaNome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    marginVertical: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 5,
  },
  errorMessage: {
    fontSize: 14,
    color: '#d32f2f',
  },
  apartmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  apartmentButton: {
    width: '47%',
    backgroundColor: '#fff',
    padding: 15,
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
  apartmentButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  apartmentNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  apartmentId: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  apartmentFloor: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  floorSection: {
    marginBottom: 20,
  },
  floorButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  floorButtonSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e8',
  },
  floorButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  floorButtonIcon: {
    fontSize: 16,
    color: '#666',
  },
});
