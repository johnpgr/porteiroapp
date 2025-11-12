import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { flattenStyles } from '~/utils/styles';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import { isRegularUser } from '~/types/auth.types';
import { uploadVisitorPhoto } from '~/services/photoUploadService';
import { notificationApi } from '~/services/notificationApi';
import { notifyResidentsVisitorArrival } from '~/services/pushNotificationService';
import PreAuthorizedGuestsList from './PreAuthorizedGuestsList';
import { CameraModal } from '~/components/shared/CameraModal';

type FlowStep =
  | 'apartamento'
  | 'preauthorized'
  | 'tipo'
  | 'empresa_prestador'
  | 'empresa_entrega'
  | 'nome'
  | 'cpf'
  | 'observacoes'
  | 'foto'
  | 'confirmacao';
type TipoVisita = 'social' | 'prestador' | 'entrega';
type EmpresaPrestador =
  | 'claro'
  | 'vivo'
  | 'encanador'
  | 'bombeiro_hidraulico'
  | 'dedetizacao'
  | 'eletricista'
  | 'pintor'
  | 'marceneiro';
type EmpresaEntrega =
  | 'rappi'
  | 'ifood'
  | 'uber_eats'
  | 'mercado_livre'
  | 'amazon'
  | 'correios'
  | 'outro';

interface Apartment {
  id: string;
  number: string;
  floor: number;
}

interface Building {
  id: string;
  name: string;
  address: string;
}

interface RegistrarVisitanteProps {
  onClose: () => void;
  onConfirm?: (message: string) => void;
}

// Funções auxiliares para CPF
const formatCPF = (value: string) => {
  // Remove tudo que não é dígito
  const cleanValue = value.replace(/\D/g, '');

  // Limita a 11 dígitos
  const limitedValue = cleanValue.slice(0, 11);

  // Aplica a máscara XXX.XXX.XXX-XX
  if (limitedValue.length <= 3) {
    return limitedValue;
  } else if (limitedValue.length <= 6) {
    return `${limitedValue.slice(0, 3)}.${limitedValue.slice(3)}`;
  } else if (limitedValue.length <= 9) {
    return `${limitedValue.slice(0, 3)}.${limitedValue.slice(3, 6)}.${limitedValue.slice(6)}`;
  } else {
    return `${limitedValue.slice(0, 3)}.${limitedValue.slice(3, 6)}.${limitedValue.slice(6, 9)}-${limitedValue.slice(9)}`;
  }
};

const cleanCPF = (value: string) => {
  return value.replace(/\D/g, '');
};

const isValidCPF = (cpf: string) => {
  const cleanedCPF = cleanCPF(cpf);

  // Verifica se tem exatamente 11 dígitos
  if (cleanedCPF.length !== 11) {
    return false;
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanedCPF)) {
    return false;
  }

  // Validação básica do CPF
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanedCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanedCPF.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanedCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanedCPF.charAt(10))) return false;

  return true;
};

export default function RegistrarVisitante({ onClose, onConfirm }: RegistrarVisitanteProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('apartamento');
  const [apartamento, setApartamento] = useState('');
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [availableApartments, setAvailableApartments] = useState<Apartment[]>([]);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);
  const [doormanBuildingId, setDoormanBuildingId] = useState<string | null>(null);
  const [doormanBuildingName, setDoormanBuildingName] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [tipoVisita, setTipoVisita] = useState<TipoVisita | null>(null);
  const [empresaPrestador, setEmpresaPrestador] = useState<EmpresaPrestador | null>(null);
  const [empresaEntrega, setEmpresaEntrega] = useState<EmpresaEntrega | null>(null);
  const [nomeVisitante, setNomeVisitante] = useState('');
  const [cpfVisitante, setCpfVisitante] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoTirada, setFotoTirada] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isCheckingPreAuthorized, setIsCheckingPreAuthorized] = useState(false);
  const [hasPreAuthorizedGuests, setHasPreAuthorizedGuests] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  
  // Visitor destination state
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [visitorDestination, setVisitorDestination] = useState<'portaria' | 'subir' | null>(null);

  // Função para solicitar permissão da câmera
  const requestCameraPermission = async () => {
    try {
      const permission = await requestPermission();
      if (!permission.granted) {
        Alert.alert(
          'Permissão Negada',
          'Para tirar fotos dos visitantes, é necessário permitir o acesso à câmera.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão da câmera:', error);
      Alert.alert('Erro', 'Não foi possível solicitar permissão da câmera.');
    }
  };

  // Obter building_id e nome do prédio do porteiro
  useEffect(() => {
    const getDoormanBuildingInfo = async () => {
      if (user?.id) {
        const { data: profile, error } = await (supabase as any)
          .from('profiles')
          .select('building_id, buildings(name)')
          .eq('user_id', user.id)
          .single();

        if (error || !profile || !profile.building_id) {
          console.error('Erro ao buscar building_id do porteiro:', error);
          Alert.alert('Erro', 'Não foi possível identificar o prédio do porteiro.');
        } else {
          setDoormanBuildingId(profile.building_id);
          setDoormanBuildingName(profile.buildings?.name || 'Prédio não identificado');
        }
      }
    };

    getDoormanBuildingInfo();
  }, [user]);

  // Carregar apartamentos disponíveis
  useEffect(() => {
    const fetchAvailableApartments = async () => {
      const buildingId = doormanBuildingId;
      if (buildingId) {
        setIsLoadingApartments(true);
        try {
          const { data: apartments, error } = await (supabase as any)
            .from('apartments')
            .select('id, number, floor')
            .eq('building_id', buildingId)
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

  // Função para verificar convidados pré-autorizados
  const checkPreAuthorizedGuests = async (apartmentId: string) => {
    if (!apartmentId || !doormanBuildingId) return;

    try {
      setIsCheckingPreAuthorized(true);
      console.log(
        '🔍 [RegistrarVisitante] Verificando convidados pré-autorizados para apartamento:',
        apartmentId
      );

      const { data: visitors, error } = await supabase
        .from('visitors')
        .select('id')
        .eq('apartment_id', apartmentId)
        .in('status', ['pendente', 'aprovado'])
        .limit(1);

      if (error) {
        console.error(
          '❌ [RegistrarVisitante] Erro ao verificar convidados pré-autorizados:',
          error
        );
        setCurrentStep('tipo'); // Continuar fluxo normal em caso de erro
        return;
      }

      const hasGuests = visitors && visitors.length > 0;
      setHasPreAuthorizedGuests(hasGuests);

      if (hasGuests) {
        console.log(
          '✅ [RegistrarVisitante] Convidados pré-autorizados encontrados, exibindo step preauthorized'
        );
        setCurrentStep('preauthorized');
      } else {
        console.log(
          'ℹ️ [RegistrarVisitante] Nenhum convidado pré-autorizado encontrado, seguindo fluxo normal'
        );
        setCurrentStep('tipo');
      }
    } catch (error) {
      console.error('❌ [RegistrarVisitante] Erro inesperado ao verificar convidados:', error);
      setCurrentStep('tipo'); // Continuar fluxo normal em caso de erro
    } finally {
      setIsCheckingPreAuthorized(false);
    }
  };

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
              style={flattenStyles([styles.keypadButton, isConfirm && styles.confirmButton])}
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

  // Função para agrupar apartamentos por andar
  const groupApartmentsByFloor = () => {
    const grouped = availableApartments.reduce(
      (acc, apartment) => {
        const floor = apartment.floor;
        if (!acc[floor]) {
          acc[floor] = [];
        }
        acc[floor].push(apartment);
        return acc;
      },
      {} as Record<number, Apartment[]>
    );

    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((floor) => ({ floor, apartments: grouped[floor] }));
  };

  const renderApartamentoStep = () => {
    const handleApartmentConfirm = async () => {
      if (!apartamento) {
        Alert.alert('Erro', 'Digite o número do apartamento.');
        return;
      }

      // Buscar o apartamento pelo número digitado
      const foundApartment = availableApartments.find((apt) => apt.number === apartamento);

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

      setSelectedApartment(foundApartment);
      console.log('Apartamento selecionado com sucesso:', {
        id: foundApartment.id,
        number: foundApartment.number,
      });

      // Verificar se existem convidados pré-autorizados para este apartamento
      await checkPreAuthorizedGuests(foundApartment.id);
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
            <Text style={styles.errorText}>Não há apartamentos cadastrados neste prédio.</Text>
          </View>
        ) : (
          renderNumericKeypad(apartamento, setApartamento, handleApartmentConfirm)
        )}
      </View>
    );
  };

  const renderEmpresaPrestadorStep = () => {
    const empresas = [
      { id: 'claro', nome: 'Claro', icon: '📱' },
      { id: 'vivo', nome: 'Vivo', icon: '📞' },
      { id: 'encanador', nome: 'Encanador', icon: '🔧' },
      { id: 'bombeiro_hidraulico', nome: 'Bombeiro Hidráulico', icon: '🚰' },
      { id: 'dedetizacao', nome: 'Dedetização', icon: '🐛' },
      { id: 'eletricista', nome: 'Eletricista', icon: '⚡' },
      { id: 'pintor', nome: 'Pintor', icon: '🎨' },
      { id: 'marceneiro', nome: 'Marceneiro', icon: '🪚' },
    ];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Empresa Prestadora</Text>
        <Text style={styles.stepSubtitle}>Qual empresa o prestador representa?</Text>

        <ScrollView style={styles.optionsScrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.optionsContainer}>
            {empresas.map((empresa) => (
              <TouchableOpacity
                key={empresa.id}
                style={flattenStyles([styles.optionButton, styles.prestadorButton])}
                onPress={() => {
                  setEmpresaPrestador(empresa.id as EmpresaPrestador);
                  setCurrentStep('nome');
                }}>
                <Text style={styles.optionIcon}>{empresa.icon}</Text>
                <Text style={styles.optionTitle}>{empresa.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderEmpresaEntregaStep = () => {
    const empresas = [
      { id: 'rappi', nome: 'Rappi', icon: '🛵' },
      { id: 'ifood', nome: 'iFood', icon: '🍔' },
      { id: 'uber_eats', nome: 'Uber Eats', icon: '🚗' },
      { id: 'mercado_livre', nome: 'Mercado Livre', icon: '📦' },
      { id: 'amazon', nome: 'Amazon', icon: '📋' },
      { id: 'correios', nome: 'Correios', icon: '📮' },
      { id: 'outro', nome: 'Outro', icon: '📦' },
    ];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Empresa de Entrega</Text>
        <Text style={styles.stepSubtitle}>Qual empresa de entrega?</Text>

        <ScrollView style={styles.optionsScrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.optionsContainer}>
            {empresas.map((empresa) => (
              <TouchableOpacity
                key={empresa.id}
                style={flattenStyles([styles.optionButton, styles.entregaButton])}
                onPress={() => {
                  setEmpresaEntrega(empresa.id as EmpresaEntrega);
                  setCurrentStep('nome');
                }}>
                <Text style={styles.optionIcon}>{empresa.icon}</Text>
                <Text style={styles.optionTitle}>{empresa.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderTipoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Tipo de Visita</Text>
      <Text style={styles.stepSubtitle}>Selecione o tipo de visita</Text>

      <ScrollView style={styles.optionsScrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={flattenStyles([styles.optionButton, styles.socialButton])}
            onPress={() => {
              setTipoVisita('social');
              setCurrentStep('nome');
            }}>
            <Text style={styles.optionIcon}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.optionTitle}>Social</Text>
            <Text style={styles.optionDescription}>Visita familiar ou amigos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.optionButton, styles.prestadorButton])}
            onPress={() => {
              setTipoVisita('prestador');
              setCurrentStep('empresa_prestador');
            }}>
            <Text style={styles.optionIcon}>🔧</Text>
            <Text style={styles.optionTitle}>Prestador de Serviço</Text>
            <Text style={styles.optionDescription}>Técnico, encanador, etc.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={flattenStyles([styles.optionButton, styles.entregaButton])}
            onPress={() => {
              setTipoVisita('entrega');
              setCurrentStep('empresa_entrega');
            }}>
            <Text style={styles.optionIcon}>📦</Text>
            <Text style={styles.optionTitle}>Serviço de Entrega</Text>
            <Text style={styles.optionDescription}>Entregador de comida, etc.</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const renderNomeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Nome Completo</Text>
      <Text style={styles.stepSubtitle}>Digite o nome do visitante</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={nomeVisitante}
          onChangeText={setNomeVisitante}
          placeholder="Nome completo do visitante"
          autoFocus
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={flattenStyles([styles.nextButton, !nomeVisitante && styles.nextButtonDisabled])}
          onPress={() => {
            if (nomeVisitante.trim()) {
              setCurrentStep('cpf');
            }
          }}
          disabled={!nomeVisitante.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCpfStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>CPF</Text>
      <Text style={styles.stepSubtitle}>Digite o CPF do visitante (opcional)</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={cpfVisitante}
          onChangeText={(text) => {
            const formattedCPF = formatCPF(text);
            setCpfVisitante(formattedCPF);
          }}
          placeholder="000.000.000-00 (opcional)"
          keyboardType="numeric"
          autoFocus
          maxLength={14}
        />

        <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentStep('observacoes')}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>

        {cpfVisitante && !isValidCPF(cpfVisitante) && (
          <Text style={styles.validationWarning}>
            CPF inválido - será salvo em branco se não corrigido
          </Text>
        )}
      </View>
    </View>
  );

  const renderObservacoesStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Observações</Text>
      <Text style={styles.stepSubtitle}>Adicione observações (opcional)</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={flattenStyles([styles.textInput, styles.textArea])}
          value={observacoes}
          onChangeText={setObservacoes}
          placeholder="Observações adicionais..."
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
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Foto do Visitante</Text>
        <Text style={styles.stepSubtitle}>Tire uma foto do visitante (opcional)</Text>

        {fotoTirada && photoUri ? (
          <View style={styles.photoSuccessContainer}>
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            </View>
            <View style={styles.photoSuccessIcon}>
              <Text style={styles.photoSuccessEmoji}>✅</Text>
            </View>
            <Text style={styles.photoSuccessTitle}>Foto capturada com sucesso!</Text>
            <Text style={styles.photoSuccessText}>
              {photoUrl ? 'A foto foi enviada com sucesso.' : 'A foto foi registrada.'}
            </Text>
            <View style={styles.photoButtonsContainer}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => {
                  setFotoTirada(false);
                  setPhotoUri(null);
                  setPhotoUrl(null);
                  setShowCameraModal(true);
                }}>
                <Text style={styles.retakeButtonText}>Tirar Nova Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => setCurrentStep('confirmacao')}>
                <Text style={styles.nextButtonText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cameraPromptContainer}>
            <Text style={styles.cameraPromptIcon}>📸</Text>
            <Text style={styles.cameraPromptText}>
              A foto do visitante é opcional, mas ajuda na identificação.
            </Text>
            <TouchableOpacity style={styles.nextButton} onPress={() => setShowCameraModal(true)}>
              <Text style={styles.nextButtonText}>Abrir Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setCurrentStep('confirmacao')}>
              <Text style={styles.skipButtonText}>Pular Foto</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  
  const handleDestinationConfirm = () => {
    if (!visitorDestination) {
      Alert.alert('Atenção', 'Por favor, selecione o destino do visitante.');
      return;
    }
    
    const destinationText = visitorDestination === 'portaria' ? 'Aguardar na Portaria' : 'Subir para o Apartamento';
    const message = `✅ Visitante registrado!\n\n${nomeVisitante}\nApartamento: ${selectedApartment?.number}\nDestino: ${destinationText}\n\nO morador foi notificado.`;

    setShowDestinationModal(false);
    
    // Reset form after success
    setTimeout(() => {
      setCurrentStep('apartamento');
      setApartamento('');
      setSelectedApartment(null);
      setNomeVisitante('');
      setCpfVisitante('');
      setObservacoes('');
      setFotoTirada(false);
      setVisitorDestination(null);
      
      if (onConfirm) {
        onConfirm(message);
      } else {
        Alert.alert('Sucesso', message, [{ text: 'OK', onPress: onClose }]);
      }
    }, 300);
  };

  const renderConfirmacaoStep = () => {
    const handleConfirm = async () => {
      // 🚫 PROTEÇÃO CRÍTICA: Prevenir múltiplas execuções simultâneas
      if (isSubmitting) {
        console.log('⚠️ [RegistrarVisitante] Tentativa de submissão duplicada BLOQUEADA');
        return;
      }

      setIsSubmitting(true);
      console.log('🔒 [RegistrarVisitante] Submissão bloqueada - isSubmitting = true');

      try {
        // Verificar se o porteiro está logado e tem building_id
        if (!user || !isRegularUser(user) || !user.building_id) {
          Alert.alert('Erro', 'Porteiro não identificado. Faça login novamente.');
          setIsSubmitting(false);
          return;
        }

        // Verificar se um apartamento foi selecionado
        if (!selectedApartment) {
          Alert.alert('Erro', 'Nenhum apartamento selecionado.');
          setIsSubmitting(false);
          return;
        }

        // Validar campos obrigatórios
        if (!nomeVisitante) {
          Alert.alert('Erro', 'Nome é obrigatório.');
          setIsSubmitting(false);
          return;
        }

        // Validar CPF se fornecido
        if (cpfVisitante && !isValidCPF(cpfVisitante)) {
          Alert.alert('Erro', 'CPF fornecido é inválido. Deixe em branco ou corrija.');
          setIsSubmitting(false);
          return;
        }

        // Primeiro, inserir ou buscar o visitante
        let visitorId;
        let existingVisitor = null;

        // Só buscar por CPF se foi fornecido e é válido
        if (cpfVisitante && isValidCPF(cpfVisitante)) {
          const { data } = await (supabase as any)
            .from('visitors')
            .select('id')
            .eq('document', cpfVisitante)
            .single();
          existingVisitor = data;
        }

        if (existingVisitor) {
          visitorId = existingVisitor.id;
        } else {
          // Inserir novo visitante
          const { data: newVisitor, error: visitorError } = await (supabase as any)
            .from('visitors')
            .insert({
              name: nomeVisitante,
              document: cpfVisitante && isValidCPF(cpfVisitante) ? cpfVisitante : null,
              phone: null, // Campo phone da estrutura correta
              photo_url: photoUrl || null,
            })
            .select('id')
            .single();

          if (visitorError || !newVisitor) {
            console.error('Erro ao inserir visitante:', visitorError);
            Alert.alert('Erro', 'Falha ao registrar visitante.');
            setIsSubmitting(false);
            return;
          }
          visitorId = newVisitor.id;
        }

        // Gerar visit_session_id único como UUID válido
        const visitSessionId = Crypto.randomUUID();

        // Determinar o propósito baseado no tipo de visita
        let purpose: string | null = tipoVisita;
        if (tipoVisita === 'prestador' && empresaPrestador) {
          purpose = `prestador - ${empresaPrestador.replace('_', ' ')}`;
        } else if (tipoVisita === 'entrega' && empresaEntrega) {
          purpose = `entrega - ${empresaEntrega.replace('_', ' ')}`;
        }

        let entryType = 'visitor';
        if (tipoVisita === 'entrega') {
          entryType = 'delivery';
        } else if (tipoVisita === 'prestador') {
          entryType = 'visitor';
        }

        const visitorLogData = {
          visitor_id: visitorId,
          apartment_id: selectedApartment.id,
          building_id: (isRegularUser(user) && user.building_id) || '',
          log_time: new Date().toISOString(),
          tipo_log: 'IN',
          visit_session_id: visitSessionId,
          purpose: observacoes || purpose || undefined,
          entry_type: entryType,
          authorized_by: user.id,
          photo_url: photoUrl,
        };

        console.log(
          '💾 Dados do log de visitante a serem salvos:',
          JSON.stringify(visitorLogData, null, 2)
        );
        console.log('💾 PhotoUrl no momento do salvamento:', photoUrl);
        console.log('📋 Dados do visitor_log preparados:', visitorLogData);

        const { data: logData, error: logError } = await (supabase as any)
          .from('visitor_logs')
          .insert(visitorLogData)
          .select('id')
          .single();

        if (logError || !logData) {
          console.error('Erro ao inserir log de entrada:', logError);
          Alert.alert('Erro', 'Falha ao registrar entrada do visitante.');
          setIsSubmitting(false);
          return;
        }

        // Enviar notificação push para os moradores do apartamento via Edge Function
        try {
          console.log(
            '📱 [RegistrarVisitante] ==================== INICIO PUSH NOTIFICATION ===================='
          );
          console.log('📱 [RegistrarVisitante] Apartamento ID:', selectedApartment.id);
          console.log('📱 [RegistrarVisitante] Apartamento Number:', apartamento);
          console.log('📱 [RegistrarVisitante] Visitor Name:', nomeVisitante);

          // Verificar se há moradores com push_token neste apartamento
          const { data: residentsCheck, error: checkError } = await (supabase as any)
            .from('apartment_residents')
            .select(
              'profile_id, profiles!inner(id, full_name, push_token, notification_enabled, user_type)'
            )
            .eq('apartment_id', selectedApartment.id);

          console.log('🔍 [RegistrarVisitante] Verificação de moradores:', {
            apartmentId: selectedApartment.id,
            residentsCount: residentsCheck?.length,
            error: checkError,
            residents: residentsCheck?.map((r: any) => ({
              name: r.profiles?.full_name,
              user_type: r.profiles?.user_type,
              has_token: !!r.profiles?.push_token,
              notification_enabled: r.profiles?.notification_enabled,
              token_preview: r.profiles?.push_token
                ? r.profiles.push_token.substring(0, 20) + '...'
                : null,
            })),
          });

          console.log('📱 [RegistrarVisitante] Chamando notifyResidentsVisitorArrival...');

          const pushResult = await notifyResidentsVisitorArrival({
            apartmentIds: [selectedApartment.id],
            visitorName: nomeVisitante,
            apartmentNumber: apartamento,
            purpose: observacoes || purpose || undefined,
            photoUrl: photoUrl || undefined,
          });

          console.log(
            '📱 [RegistrarVisitante] Resultado completo do push:',
            JSON.stringify(pushResult, null, 2)
          );

          if (pushResult.success && pushResult.sent > 0) {
            console.log(
              `✅ [RegistrarVisitante] Push notification enviada para ${pushResult.sent} morador(es)`
            );
          } else {
            console.warn(
              '⚠️ [RegistrarVisitante] Push notification não enviada:',
              pushResult.message
            );
            console.warn('⚠️ [RegistrarVisitante] Total tokens encontrados:', pushResult.total);
            console.warn('⚠️ [RegistrarVisitante] Enviados:', pushResult.sent);
            console.warn('⚠️ [RegistrarVisitante] Falhas:', pushResult.failed);
          }
          console.log(
            '📱 [RegistrarVisitante] ==================== FIM PUSH NOTIFICATION ===================='
          );
        } catch (pushError) {
          console.error('❌ [RegistrarVisitante] Erro ao enviar push notification:', pushError);
          console.error(
            '❌ [RegistrarVisitante] Stack:',
            pushError instanceof Error ? pushError.stack : 'N/A'
          );
          // Não bloqueia o fluxo se a notificação push falhar
        }

        // 🚫 PROTEÇÃO CRÍTICA WHATSAPP: Verificar se notificação já foi enviada
        console.log('📱 [RegistrarVisitante] Verificando status antes de enviar WhatsApp...');

        // Buscar status atual do visitor_log recém-criado
        const { data: currentLog } = await (supabase as any)
          .from('visitor_logs')
          .select('notification_status')
          .eq('id', logData.id)
          .single();

        const currentStatus = currentLog?.notification_status;
        console.log('📋 [RegistrarVisitante] Status atual da notificação:', currentStatus);

        // Enviar notificação via API (WhatsApp) APENAS se ainda não foi enviada
        if (currentStatus !== 'sent') {
          try {
            console.log('📱 [RegistrarVisitante] Enviando notificação WhatsApp...');

            // Buscar dados do morador proprietário
            const { data: residentData, error: residentError } = await (supabase as any)
              .from('apartments')
              .select(
                `
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
              `
              )
              .eq('id', selectedApartment.id)
              .eq('apartment_residents.is_owner', true)
              .single();

            if (
              residentData &&
              residentData.apartment_residents &&
              residentData.apartment_residents.length > 0
            ) {
              // 🎯 ENVIAR APENAS PARA O PRIMEIRO PROPRIETÁRIO (evitar duplicatas)
              const resident = residentData.apartment_residents[0];
              const building = residentData.buildings;

              if (resident.profiles.phone && building) {
                console.log(
                  '📱 [RegistrarVisitante] Enviando WhatsApp para:',
                  resident.profiles.full_name
                );

                await notificationApi.sendVisitorAuthorization({
                  visitorName: nomeVisitante,
                  residentName: resident.profiles.full_name,
                  residentPhone: resident.profiles.phone,
                  residentEmail: resident.profiles.email || '',
                  building: building.name,
                  apartment: selectedApartment.number,
                });

                console.log(
                  '✅ [RegistrarVisitante] Mensagem de autorização WhatsApp enviada com sucesso'
                );

                // Atualizar status IMEDIATAMENTE para evitar reenvios
                await (supabase as any)
                  .from('visitor_logs')
                  .update({ notification_status: 'sent' })
                  .eq('id', logData.id);

                console.log(
                  '✅ [RegistrarVisitante] Status atualizado para "sent" - bloqueio ativado'
                );
              } else {
                console.warn(
                  '⚠️ [RegistrarVisitante] Dados insuficientes para enviar notificação via API'
                );
              }
            }
          } catch (apiError) {
            console.error('❌ [RegistrarVisitante] Erro ao enviar notificação via API:', apiError);
            // Não bloquear o fluxo se a notificação via API falhar
          }
        } else {
          console.log('🚫 [RegistrarVisitante] WhatsApp JÁ ENVIADO - bloqueando reenvio');
        }

        // Show destination selection modal instead of immediate success
        console.log('✅ [RegistrarVisitante] Visitante registrado - mostrando modal de destino');
        setShowDestinationModal(true);

      } catch (error) {
        console.error('Erro geral ao registrar visitante:', error);
        Alert.alert(
          'Erro',
          'Falha inesperada ao registrar visitante. Verifique sua conexão e tente novamente.'
        );
      } finally {
        setIsSubmitting(false);
        console.log('🔓 [RegistrarVisitante] Submissão desbloqueada - isSubmitting = false');
      }
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Confirmação</Text>
        <Text style={styles.stepSubtitle}>Revise os dados do visitante</Text>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Prédio:</Text>
            <Text style={styles.summaryValue}>{doormanBuildingName}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Apartamento:</Text>
            <Text style={styles.summaryValue}>
              {selectedApartment?.number || 'Não selecionado'}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tipo:</Text>
            <Text style={styles.summaryValue}>
              {tipoVisita === 'social'
                ? 'Social'
                : tipoVisita === 'prestador'
                  ? 'Prestador de Serviço'
                  : 'Serviço de Entrega'}
            </Text>
          </View>

          {(empresaPrestador || empresaEntrega) && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Empresa:</Text>
              <Text style={styles.summaryValue}>
                {empresaPrestador
                  ? empresaPrestador.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  : empresaEntrega?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          )}

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Nome:</Text>
            <Text style={styles.summaryValue}>{nomeVisitante}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>CPF:</Text>
            <Text style={styles.summaryValue}>{cpfVisitante || 'Não informado'}</Text>
          </View>

          {observacoes && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Observações:</Text>
              <Text style={styles.summaryValue}>{observacoes}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.confirmFinalButton, isSubmitting && styles.confirmFinalButtonDisabled]}
          onPress={handleConfirm}
          disabled={isSubmitting}>
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

  const resetForm = () => {
    setCurrentStep('apartamento');
    setApartamento('');
    setSelectedApartment(null);
    setTipoVisita(null);
    setEmpresaPrestador(null);
    setEmpresaEntrega(null);
    setNomeVisitante('');
    setCpfVisitante('');
    setObservacoes('');
    setFotoTirada(false);
    setPhotoUri(null);
    setPhotoUrl(null);
    setIsUploadingPhoto(false);
    setIsCheckingPreAuthorized(false);
    setHasPreAuthorizedGuests(false);
  };

  // Função para renderizar o step de convidados pré-autorizados
  const renderPreAuthorizedStep = () => {
    if (isCheckingPreAuthorized) {
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Verificando Convidados</Text>
          <Text style={styles.stepSubtitle}>
            Aguarde enquanto verificamos se há convidados pré-autorizados...
          </Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        </View>
      );
    }

    if (!selectedApartment || !doormanBuildingId) {
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Erro</Text>
          <Text style={styles.stepSubtitle}>Informações do apartamento não encontradas.</Text>
          <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentStep('tipo')}>
            <Text style={styles.nextButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Convidados Pré-autorizados</Text>
        <Text style={styles.stepSubtitle}>
          Apartamento {selectedApartment.number} - Selecione um convidado ou continue o registro
          normal
        </Text>

        <PreAuthorizedGuestsList
          apartmentId={selectedApartment.id}
          buildingId={doormanBuildingId}
          onGuestSelected={() => {
            // Quando um convidado for selecionado (check-in ou notificação), fechar o modal
            console.log('✅ [RegistrarVisitante] Convidado selecionado, fechando modal');
            onClose();
          }}
        />

        <TouchableOpacity
          style={[styles.nextButton, { marginTop: 20 }]}
          onPress={() => setCurrentStep('tipo')}>
          <Text style={styles.nextButtonText}>Registrar Novo Visitante</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'apartamento':
        return renderApartamentoStep();
      case 'preauthorized':
        return renderPreAuthorizedStep();
      case 'tipo':
        return renderTipoStep();
      case 'empresa_prestador':
        return renderEmpresaPrestadorStep();
      case 'empresa_entrega':
        return renderEmpresaEntregaStep();
      case 'nome':
        return renderNomeStep();
      case 'cpf':
        return renderCpfStep();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <IconSymbol name="chevron.left" color="#fff" size={30} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={styles.title}>👤 Registrar Visitante</Text>
          <Text style={styles.subtitle}>Cadastro de Visitantes</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(() => {
                  const mainSteps = [
                    'apartamento',
                    'tipo',
                    'nome',
                    'cpf',
                    'observacoes',
                    'foto',
                    'confirmacao',
                  ];
                  let stepIndex = mainSteps.indexOf(currentStep);

                  // Handle intermediate steps that aren't in the main flow
                  if (stepIndex === -1) {
                    if (currentStep === 'preauthorized') {
                      stepIndex = 0; // Same as 'apartamento'
                    } else if (
                      currentStep === 'empresa_prestador' ||
                      currentStep === 'empresa_entrega'
                    ) {
                      stepIndex = 1; // Same as 'tipo'
                    }
                  }

                  return ((stepIndex + 1) / mainSteps.length) * 100;
                })()}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {(() => {
            const mainSteps = [
              'apartamento',
              'tipo',
              'nome',
              'cpf',
              'observacoes',
              'foto',
              'confirmacao',
            ];
            let stepIndex = mainSteps.indexOf(currentStep);

            // Handle intermediate steps that aren't in the main flow
            if (stepIndex === -1) {
              if (currentStep === 'preauthorized') {
                stepIndex = 0; // Same as 'apartamento'
              } else if (
                currentStep === 'empresa_prestador' ||
                currentStep === 'empresa_entrega'
              ) {
                stepIndex = 1; // Same as 'tipo'
              }
            }

            return `${stepIndex + 1} de ${mainSteps.length}`;
          })()}
        </Text>
      </View>

      {renderCurrentStep()}

      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onPhotoCapture={(uri, url) => {
          if (uri) {
            setPhotoUri(uri);
            setPhotoUrl(url);
            setFotoTirada(true);
          }
          setCurrentStep('confirmacao');
        }}
        uploadFunction={uploadVisitorPhoto}
        title="Foto do Visitante"
      />

      {/* Destination Selection Modal */}
      <Modal
        visible={showDestinationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDestinationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.destinationModalContainer}>
            <Text style={styles.destinationModalTitle}>👤 Destino do Visitante</Text>
            <Text style={styles.destinationModalSubtitle}>
              Para onde o visitante deve ir?
            </Text>

            <View style={styles.destinationOptions}>
              <TouchableOpacity
                style={[
                  styles.destinationButton,
                  visitorDestination === 'portaria' && styles.destinationButtonSelected
                ]}
                onPress={() => setVisitorDestination('portaria')}
              >
                <Text style={styles.destinationButtonIcon}>🏢</Text>
                <Text style={[
                  styles.destinationButtonText,
                  visitorDestination === 'portaria' && styles.destinationButtonTextSelected
                ]}>
                  Aguardar na Portaria
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.destinationButton,
                  visitorDestination === 'subir' && styles.destinationButtonSelected
                ]}
                onPress={() => setVisitorDestination('subir')}
              >
                <Text style={styles.destinationButtonIcon}>🏠</Text>
                <Text style={[
                  styles.destinationButtonText,
                  visitorDestination === 'subir' && styles.destinationButtonTextSelected
                ]}>
                  Subir para o Apartamento
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.destinationModalActions}>
              <TouchableOpacity
                style={styles.destinationCancelButton}
                onPress={() => {
                  setShowDestinationModal(false);
                  setVisitorDestination(null);
                }}
              >
                <Text style={styles.destinationCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.destinationConfirmButton,
                  !visitorDestination && styles.destinationConfirmButtonDisabled
                ]}
                onPress={handleDestinationConfirm}
                disabled={!visitorDestination}
              >
                <Text style={styles.destinationConfirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    paddingHorizontal: 20,
    gap: 50,
    paddingVertical: 30,
    marginBottom: 10,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
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
    marginBottom: 20,
  },
  keypadContainer: {
    marginTop: 20,
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
    gap: 10,
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
  optionsContainer: {
    gap: 20,
  },
  optionsScrollContainer: {
    flex: 1,
    marginTop: 20,
  },
  optionButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
  },
  socialButton: {
    borderLeftColor: '#4CAF50',
  },
  prestadorButton: {
    borderLeftColor: '#FF9800',
  },
  entregaButton: {
    borderLeftColor: '#2196F3',
  },
  optionIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    gap: 20,
  },
  textInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
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
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  photoPreviewContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#4CAF50',
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
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  apartmentsContainer: {
    flex: 1,
    marginTop: 20,
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
  skipButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  validationWarning: {
    color: '#FF9800',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cameraPromptContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 20,
  },
  cameraPromptIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cameraPromptText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  photoSuccessContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8fff8',
    borderRadius: 20,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  photoSuccessIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoSuccessEmoji: {
    fontSize: 40,
    color: '#fff',
  },
  photoSuccessTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'center',
  },
  photoSuccessText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  // Destination Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  destinationModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  destinationModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  destinationModalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  destinationOptions: {
    gap: 12,
    marginBottom: 24,
  },
  destinationButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destinationButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  destinationButtonIcon: {
    fontSize: 32,
  },
  destinationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  destinationButtonTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  destinationModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  destinationCancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  destinationCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  destinationConfirmButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  destinationConfirmButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  destinationConfirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
