import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import { notificationApi } from '../../services/notificationApi';

// Função para gerar UUID compatível com React Native
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type FlowStep = 'placa' | 'apartamento' | 'empresa' | 'marca' | 'modelo' | 'cor' | 'convidado' | 'confirmacao';

interface VehicleInfo {
  license_plate: string;
  model?: string;
  color?: string;
  apartment_id?: string;
  existing?: boolean;
  apartment_info?: any;
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
  const [availableApartments, setAvailableApartments] = useState<{ id: string; number: string; floor?: string }[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<{id: string, number: string, floor: number | null} | null>(null);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);

  // Get doorman's building_id from their profile
  useEffect(() => {
    const getDoormanBuildingId = async () => {
      if (user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('building_id')
          .eq('id', user.id)
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


  const renderApartamentoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🏠 Apartamento</Text>
      <Text style={styles.stepSubtitle}>Selecione o apartamento de destino</Text>

      {isLoadingApartments ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando apartamentos...</Text>
        </View>
      ) : availableApartments.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Nenhum Apartamento</Text>
          <Text style={styles.errorMessage}>Não há apartamentos cadastrados para este prédio.</Text>
        </View>
      ) : (
        <ScrollView style={styles.apartmentsContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.apartmentsGrid}>
            {availableApartments.map((apartment) => (
              <TouchableOpacity
                key={apartment.id}
                style={[
                  styles.apartmentButton,
                  selectedApartment?.id === apartment.id && styles.apartmentButtonSelected,
                ]}
                onPress={() => {
                  console.log('Selecionando apartamento:', apartment);
                  if (!apartment.id) {
                    Alert.alert('Erro', 'ID do apartamento não encontrado. Tente novamente.');
                    return;
                  }
                  setSelectedApartment(apartment);
                  setApartamento(apartment.number);
                  console.log('Apartamento selecionado com sucesso:', { id: apartment.id, number: apartment.number });
                  setCurrentStep('convidado');
                }}>
                <Text style={styles.apartmentNumber}>Apt {apartment.number}</Text>
                <Text style={styles.apartmentId}>ID: {apartment.id}</Text>
                {apartment.floor && (
                  <Text style={styles.apartmentFloor}>Andar {apartment.floor}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const renderEmpresaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🏢 Empresa/Serviço</Text>
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
      <Text style={styles.stepTitle}>🚗 Placa do Veículo</Text>
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
      <Text style={styles.stepTitle}>🏭 Marca do Veículo</Text>
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
      <Text style={styles.stepTitle}>🚙 Modelo do Veículo</Text>
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
          disabled={!nomeConvidado.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmacaoStep = () => {
    const handleConfirm = async () => {
      try {
        // Validar se apartamento foi selecionado
        if (!selectedApartment || !selectedApartment.id) {
          Alert.alert('Erro', 'Por favor, selecione um apartamento antes de continuar');
          return;
        }

        console.log('Apartamento selecionado:', selectedApartment);

        // VALIDAÇÃO FINAL: Verificar novamente se a placa não é duplicata antes de confirmar
        const cleanPlate = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const { data: finalDuplicateCheck, error: duplicateCheckError } = await supabase
          .from('vehicles')
          .select('license_plate')
          .eq('license_plate', cleanPlate)
          .single();

        if (finalDuplicateCheck && !duplicateCheckError) {
          Alert.alert(
            '❌ Erro de Validação',
            `A placa ${placa} já está cadastrada no sistema. O cadastro não pode ser concluído.`,
            [{ text: 'OK' }]
          );
          return;
        }

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
        
        console.log('Dados do veículo preparados:', vehicleData);
        console.log('selectedApartment atual:', selectedApartment);

        // Verificar se já existe um veículo com esta placa (segunda verificação)
        const { data: existingVehicleByPlate } = await supabase
          .from('vehicles')
          .select('id, license_plate, model, color')
          .eq('license_plate', cleanPlate)
          .single();

        // Se o veículo não existe, criar registro na tabela vehicles primeiro
        if (!vehicleInfo?.existing && !existingVehicleByPlate && marcaSelecionada && corSelecionada) {
          // Validação adicional para garantir que selectedApartment existe
          if (!selectedApartment || !selectedApartment.id) {
            console.error('Erro: selectedApartment não está definido ou não tem ID');
            Alert.alert('Erro', 'Nenhum apartamento foi selecionado. Por favor, selecione um apartamento.');
            return;
          }
          
          console.log('Inserindo veículo com apartment_id:', selectedApartment.id);
          console.log('selectedApartment completo:', selectedApartment);
          
          const vehicleInsertData = {
            license_plate: placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
            brand: marcaSelecionada.nome,
            model: modelo,
            color: corSelecionada.nome,
            apartment_id: selectedApartment?.id || null, // Usar apartment_id selecionado
          };
          
          console.log('Dados que serão inseridos na tabela vehicles:', vehicleInsertData);
          
          const { error: vehicleError } = await supabase
            .from('vehicles')
            .insert(vehicleInsertData);

          if (vehicleError) {
            console.error('Erro ao salvar veículo:', vehicleError);
            Alert.alert('Erro', 'Não foi possível salvar o veículo. Tente novamente.');
            return;
          }
          
          console.log('Veículo inserido com sucesso com apartment_id:', vehicleInsertData.apartment_id);
        } else if (existingVehicleByPlate) {
          console.log('Veículo com placa', placa, 'já existe. Reutilizando dados existentes.');
          // Atualizar vehicleData com os dados do veículo existente
          vehicleData.existing_vehicle = true;
          vehicleData.model = existingVehicleByPlate.model;
          vehicleData.color = existingVehicleByPlate.color;
        }

        // Usar o apartamento selecionado diretamente
        if (!selectedApartment) {
          Alert.alert('Erro', 'Nenhum apartamento foi selecionado.');
          return;
        }

        const apartmentData = {
          id: selectedApartment.id,
          building_id: doormanBuildingId,
          number: selectedApartment.number
        };

        // Criar ou buscar visitante
        let visitorId;
        const { data: existingVisitor } = await supabase
          .from('visitors')
          .select('id')
          .eq('name', nomeConvidado)
          .single();

        if (existingVisitor) {
          visitorId = existingVisitor.id;
        } else {
          const { data: newVisitor, error: visitorError } = await supabase
            .from('visitors')
            .insert({ name: nomeConvidado })
            .select('id')
            .single();

          if (visitorError || !newVisitor) {
            console.error('Erro ao criar visitante:', visitorError);
            Alert.alert('Erro', 'Não foi possível criar o visitante. Tente novamente.');
            return;
          }
          visitorId = newVisitor.id;
        }

        // Salvar no visitor_logs com vehicle_info completo
        const { data: visitorLogData, error } = await supabase
          .from('visitor_logs')
          .insert({
            visitor_id: visitorId,
            apartment_id: apartmentData.id,
            building_id: apartmentData.building_id,
            log_time: new Date().toISOString(),
            tipo_log: 'IN',
            visit_session_id: generateUUID(),
            vehicle_info: vehicleData,
            notification_status: 'pending',
            purpose: hasOwner ? `Veículo vinculado ao apartamento ${vehicleInfo?.apartment_info?.number}` : 'Veículo de visitante'
          })
          .select('id')
          .single();

        if (error) {
          console.error('Erro ao salvar log de visitante:', error);
          Alert.alert('Erro', 'Não foi possível registrar o veículo. Tente novamente.');
          return;
        }

        // Enviar notificação via API (WhatsApp) após registro bem-sucedido
        if (visitorLogData?.id) {
          try {
            // Buscar dados do morador proprietário e do prédio
            const { data: residentData } = await supabase
              .from('apartments')
              .select(`
                id,
                number,
                residents!residents_apartment_id_fkey (
                  full_name,
                  phone
                ),
                buildings (
                  name
                )
              `)
              .eq('id', apartmentData.id)
              .eq('residents.is_owner', true)
              .single();

            if (residentData?.residents?.phone) {
              await notificationApi.sendVisitorNotification({
                visitorLogId: visitorLogData.id,
                visitorName: nomeConvidado,
                residentPhone: residentData.residents.phone,
                residentName: residentData.residents.full_name || 'Morador',
                building: residentData.buildings?.name || 'Prédio',
                apartment: residentData.number,
                vehicleInfo: {
                  licensePlate: placa,
                  brand: marcaSelecionada?.nome || vehicleInfo?.brand,
                  model: modelo || vehicleInfo?.model,
                  color: corSelecionada?.nome || vehicleInfo?.color
                }
              });
            }
          } catch (apiError) {
            console.error('Erro ao enviar notificação via API:', apiError);
            // Não bloquear o fluxo principal em caso de erro na API
          }
        }

        // Preparar mensagem baseada no tipo de veículo
        let message = '';
        if (hasOwner && vehicleInfo?.apartment_info) {
          message = `Veículo ${placa} de ${nomeConvidado} registrado. Veículo vinculado ao apartamento ${vehicleInfo.apartment_info.number || 'N/A'}.`;
        } else {
          message = `Veículo ${placa} de ${nomeConvidado} registrado com sucesso para o apartamento ${selectedApartment.number}.`;
        }

        if (onConfirm) {
          onConfirm(message);
        } else {
          Alert.alert('✅ Veículo Registrado!', message, [{ text: 'OK' }]);
          onClose();
        }
      } catch (error) {
        console.error('Erro ao confirmar registro:', error);
        Alert.alert('Erro', 'Não foi possível registrar o veículo. Tente novamente.');
      }
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

        <TouchableOpacity style={styles.confirmFinalButton} onPress={handleConfirm}>
          <Text style={styles.confirmFinalButtonText}>Confirmar Registro</Text>
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
              {
                width: `${(Object.keys({ placa, apartamento, marca: marcaSelecionada || vehicleInfo?.model, cor: corSelecionada || vehicleInfo?.color, convidado: nomeConvidado, confirmacao: currentStep === 'confirmacao' }).filter(Boolean).length / 6) * 100}%`,
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  vehicleFoundContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
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
    marginTop: 20,
  },
  empresasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  empresaButton: {
    width: '48%',
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
  apartmentButton: {
    width: '48%',
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
});
