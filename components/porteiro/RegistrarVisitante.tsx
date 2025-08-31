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
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { flattenStyles } from '../../utils/styles';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
// Removido import incorreto do notificationService
import { notificationApi } from '../../services/notificationApi';

type FlowStep =
  | 'apartamento'
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

interface RegistrarVisitanteProps {
  onClose: () => void;
  onConfirm?: (message: string) => void;
}

export default function RegistrarVisitante({ onClose, onConfirm }: RegistrarVisitanteProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('apartamento');
  const [apartamento, setApartamento] = useState('');
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [availableApartments, setAvailableApartments] = useState<Apartment[]>([]);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);
  const [doormanBuildingId, setDoormanBuildingId] = useState<string | null>(null);
  const [tipoVisita, setTipoVisita] = useState<TipoVisita | null>(null);
  const [empresaPrestador, setEmpresaPrestador] = useState<EmpresaPrestador | null>(null);
  const [empresaEntrega, setEmpresaEntrega] = useState<EmpresaEntrega | null>(null);
  const [nomeVisitante, setNomeVisitante] = useState('');
  const [cpfVisitante, setCpfVisitante] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoTirada, setFotoTirada] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Obter building_id do porteiro
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

  // Carregar apartamentos disponíveis
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
          style={flattenStyles([styles.keypadButton, styles.confirmButton])}
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
      <Text style={styles.stepSubtitle}>Selecione o apartamento de destino</Text>

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
                  if (!apartment.id) {
                    Alert.alert('Erro', 'Apartamento inválido. Tente novamente.');
                    return;
                  }
                  setSelectedApartment(apartment);
                  setApartamento(apartment.number);
                  console.log('Apartamento selecionado com sucesso:', { id: apartment.id, number: apartment.number });
                  setCurrentStep('tipo');
                }}>
                <Text style={styles.apartmentNumber}>Apt {apartment.number}</Text>
                <Text style={styles.apartmentId}>ID: {apartment.id}</Text>
                <Text style={styles.apartmentFloor}>Andar {apartment.floor}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

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
        <Text style={styles.stepTitle}>🔧 Empresa Prestadora</Text>
        <Text style={styles.stepSubtitle}>Qual empresa o prestador representa?</Text>

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
        <Text style={styles.stepTitle}>📦 Empresa de Entrega</Text>
        <Text style={styles.stepSubtitle}>Qual empresa de entrega?</Text>

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
      </View>
    );
  };

  const renderTipoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>👥 Tipo de Visita</Text>
      <Text style={styles.stepSubtitle}>Selecione o tipo de visita</Text>

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
    </View>
  );

  const renderNomeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>✏️ Nome Completo</Text>
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
      <Text style={styles.stepTitle}>🆔 CPF</Text>
      <Text style={styles.stepSubtitle}>Digite o CPF do visitante</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={cpfVisitante}
          onChangeText={setCpfVisitante}
          placeholder="000.000.000-00"
          keyboardType="numeric"
          autoFocus
          maxLength={14}
        />

        <TouchableOpacity
          style={flattenStyles([styles.nextButton, !cpfVisitante && styles.nextButtonDisabled])}
          onPress={() => {
            if (cpfVisitante.trim()) {
              setCurrentStep('observacoes');
            }
          }}
          disabled={!cpfVisitante.trim()}>
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
        <Text style={styles.stepTitle}>📸 Foto do Visitante</Text>
        <Text style={styles.stepSubtitle}>Tire uma foto do visitante</Text>

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
    const handleConfirm = async () => {
      try {
        // Verificar se o porteiro está logado e tem building_id
        if (!user || !user.building_id) {
          Alert.alert('Erro', 'Porteiro não identificado. Faça login novamente.');
          return;
        }

        // Verificar se um apartamento foi selecionado
        if (!selectedApartment) {
          Alert.alert('Erro', 'Nenhum apartamento selecionado.');
          return;
        }

        // Validar campos obrigatórios
        if (!nomeVisitante || !cpfVisitante) {
          Alert.alert('Erro', 'Nome e CPF são obrigatórios.');
          return;
        }

        // Primeiro, inserir ou buscar o visitante
        let visitorId;
        const { data: existingVisitor } = await supabase
          .from('visitors')
          .select('id')
          .eq('document', cpfVisitante)
          .single();

        if (existingVisitor) {
          visitorId = existingVisitor.id;
        } else {
          // Inserir novo visitante
          const { data: newVisitor, error: visitorError } = await supabase
            .from('visitors')
            .insert({
              name: nomeVisitante,
              document: cpfVisitante,
              phone: null, // Campo phone da estrutura correta
              photo_url: fotoTirada || null
            })
            .select('id')
            .single();

          if (visitorError || !newVisitor) {
            console.error('Erro ao inserir visitante:', visitorError);
            Alert.alert('Erro', 'Falha ao registrar visitante.');
            return;
          }
          visitorId = newVisitor.id;
        }

        // Gerar visit_session_id único como UUID válido
        const visitSessionId = Crypto.randomUUID();

        // Determinar o propósito baseado no tipo de visita
        let purpose = tipoVisita;
        if (tipoVisita === 'prestador' && empresaPrestador) {
          purpose = `prestador - ${empresaPrestador.replace('_', ' ')}`;
        } else if (tipoVisita === 'entrega' && empresaEntrega) {
          purpose = `entrega - ${empresaEntrega.replace('_', ' ')}`;
        }

        // Determinar entry_type baseado no tipo de visita
        let entryType = 'visitor'; // padrão
        if (tipoVisita === 'entrega') {
          entryType = 'delivery';
        } else if (tipoVisita === 'prestador') {
          entryType = 'service';
        }

        // Inserir log de entrada na tabela visitor_logs
        const { data: logData, error: logError } = await supabase
          .from('visitor_logs')
          .insert({
            visitor_id: visitorId,
            apartment_id: selectedApartment.id,
            building_id: user.building_id,
            log_time: new Date().toISOString(),
            tipo_log: 'IN',
            visit_session_id: visitSessionId,
            purpose: observacoes || purpose,
            entry_type: entryType,
            authorized_by: user.id
          })
          .select('id')
          .single();

        if (logError || !logData) {
          console.error('Erro ao inserir log de entrada:', logError);
          Alert.alert('Erro', 'Falha ao registrar entrada do visitante.');
          return;
        }

        // Notificação removida - usava métodos inexistentes

        // Enviar notificação via API (WhatsApp)
        try {
          // Buscar dados do morador proprietário
          const { data: residentData, error: residentError } = await supabase
            .from('apartments')
            .select(`
              apartment_residents!inner(
                profiles!inner(
                  full_name,
                  phone
                ),
                is_owner
              ),
              buildings!inner(
                name
              )
            `)
            .eq('id', selectedApartment.id)
            .eq('apartment_residents.is_owner', true)
            .single();

          if (residentData && residentData.apartment_residents && residentData.apartment_residents.length > 0) {
            const resident = residentData.apartment_residents[0];
            const building = residentData.buildings;
            
            if (resident.profiles.phone && building) {
              await notificationApi.sendVisitorAuthorization({
                visitorName: nomeVisitante,
                residentName: resident.profiles.full_name,
                residentPhone: resident.profiles.phone,
                building: building.name,
                apartment: selectedApartment.number
              });
              
              console.log('Mensagem de autorização WhatsApp enviada com sucesso');
            } else {
              console.warn('Dados insuficientes para enviar notificação via API');
            }
          }
        } catch (apiError) {
          console.error('Erro ao enviar notificação via API:', apiError);
          // Não bloquear o fluxo se a notificação via API falhar
        }

        const message = `${nomeVisitante} foi registrado com entrada no apartamento ${selectedApartment.number}.`;

        if (onConfirm) {
          onConfirm(message);
        } else {
          Alert.alert('✅ Visitante Registrado!', message, [{ text: 'OK' }]);
          onClose();
        }
      } catch (error) {
        console.error('Erro geral ao registrar visitante:', error);
        Alert.alert('Erro', 'Falha inesperada ao registrar visitante. Verifique sua conexão e tente novamente.');
      }
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>✅ Confirmação</Text>
        <Text style={styles.stepSubtitle}>Revise os dados do visitante</Text>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Apartamento:</Text>
            <Text style={styles.summaryValue}>{selectedApartment?.number || 'Não selecionado'}</Text>
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
            <Text style={styles.summaryValue}>{cpfVisitante}</Text>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Visitante</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(Object.keys({ apartamento, tipo: tipoVisita, nome: nomeVisitante, cpf: cpfVisitante, observacoes: true, foto: fotoTirada, confirmacao: currentStep === 'confirmacao' }).filter(Boolean).length / 7) * 100}%`,
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
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  optionsContainer: {
    gap: 20,
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
    gap: 15,
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
