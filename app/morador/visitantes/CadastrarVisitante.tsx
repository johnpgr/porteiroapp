import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { router } from 'expo-router';
import { flattenStyles } from '../../../utils/styles';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../hooks/useAuth';

// Função para gerar UUID compatível com React Native
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type FlowStep =
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

interface CadastrarVisitanteProps {
  onClose?: () => void;
  onConfirm?: (message: string) => void;
}

export default function CadastrarVisitante({ onClose, onConfirm }: CadastrarVisitanteProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('tipo');
  const [tipoVisita, setTipoVisita] = useState<TipoVisita | null>(null);
  const [empresaPrestador, setEmpresaPrestador] = useState<EmpresaPrestador | null>(null);
  const [empresaEntrega, setEmpresaEntrega] = useState<EmpresaEntrega | null>(null);
  const [nomeVisitante, setNomeVisitante] = useState('');
  const [cpfVisitante, setCpfVisitante] = useState('');

  // Função para formatar CPF
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

  // Função para remover formatação do CPF
  const cleanCPF = (value: string) => {
    return value.replace(/\D/g, '');
  };

  // Função para validar CPF
  const validateCPF = (cpf: string) => {
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
  const [observacoes, setObservacoes] = useState('');
  const [fotoTirada, setFotoTirada] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
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
          onChangeText={(text) => {
            const formatted = formatCPF(text);
            setCpfVisitante(formatted);
          }}
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
        console.log('🔍 DEBUG: Iniciando processo de cadastro de visitante');
        console.log('🔍 DEBUG: Dados do usuário:', user);
        
        // Verificar conexão com Supabase
        console.log('🔍 DEBUG: Verificando conexão com Supabase...');
        console.log('🔍 DEBUG: Supabase URL:', supabase.supabaseUrl);
        console.log('🔍 DEBUG: Supabase Key (primeiros 10 chars):', supabase.supabaseKey?.substring(0, 10));
        
        // Verificar sessão atual do usuário
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        console.log('🔍 DEBUG: Sessão atual:', { session: session?.session?.user?.id, sessionError });
        
        // Teste de conectividade básica
        console.log('🔍 DEBUG: Testando conectividade básica com Supabase...');
        const { data: testData, error: testError } = await supabase
          .from('apartments')
          .select('count')
          .limit(1);
        console.log('🔍 DEBUG: Teste de conectividade:', { testData, testError });
        
        // Verificar se o usuário está autenticado
        console.log('🔐 Verificando autenticação do usuário...');
        console.log('User object:', user);
        console.log('User ID:', user?.id);
        console.log('User type:', user?.user_type);
        
        if (!user) {
          console.error('❌ Usuário não autenticado');
          Alert.alert('Erro', 'Usuário não autenticado');
          return;
        }

        // Buscar apartment_id do usuário através da tabela apartment_residents
        console.log('🏠 Buscando apartment_id do usuário...');
        const { data: residentData, error: residentError } = await supabase
          .from('apartment_residents')
          .select('apartment_id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (residentError) {
          console.error('❌ Erro ao buscar apartment_id:', residentError);
          Alert.alert('Erro', 'Não foi possível encontrar o apartamento do usuário');
          return;
        }

        if (!residentData?.apartment_id) {
          console.error('❌ Usuário não possui apartment_id');
          Alert.alert('Erro', 'Usuário não está associado a um apartamento');
          return;
        }

        const userApartmentId = residentData.apartment_id;
        console.log('✅ Apartment ID encontrado:', userApartmentId);

        // Buscar informações do apartamento do morador
        console.log('🔍 DEBUG: Buscando dados do apartamento...');
        const { data: apartmentData, error: apartmentError } = await supabase
          .from('apartments')
          .select('id, building_id, number')
          .eq('id', userApartmentId)
          .maybeSingle();

        console.log('🔍 DEBUG: Resultado da busca do apartamento:', { apartmentData, apartmentError });
        
        if (apartmentError || !apartmentData) {
          console.error('❌ DEBUG: Erro detalhado ao buscar apartamento:', {
            message: apartmentError?.message,
            code: apartmentError?.code,
            details: apartmentError?.details,
            hint: apartmentError?.hint,
            apartmentData
          });
          Alert.alert('Erro', 'Apartamento não encontrado.');
          return;
        }
        
        console.log('✅ DEBUG: Apartamento encontrado:', apartmentData);

        // Validar campos obrigatórios
        console.log('🔍 DEBUG: Validando campos obrigatórios:', { nomeVisitante, cpfVisitante });
        if (!nomeVisitante || !cpfVisitante) {
          console.log('❌ DEBUG: Campos obrigatórios não preenchidos');
          Alert.alert('Erro', 'Nome e CPF são obrigatórios.');
          return;
        }
        
        console.log('✅ DEBUG: Campos obrigatórios válidos');

        // Primeiro, inserir ou buscar o visitante
        console.log('🔍 DEBUG: Verificando se visitante já existe...');
        let visitorId;
        const { data: existingVisitor, error: searchVisitorError } = await supabase
          .from('visitors')
          .select('id')
          .eq('document', cpfVisitante)
          .maybeSingle();

        console.log('🔍 DEBUG: Resultado da busca do visitante:', { existingVisitor, searchVisitorError });

        if (existingVisitor) {
          console.log('✅ DEBUG: Visitante já existe, usando ID:', existingVisitor.id);
          visitorId = existingVisitor.id;
        } else {
          console.log('🔍 DEBUG: Visitante não existe, criando novo...');
          // Validar CPF antes da inserção
          if (!validateCPF(cpfVisitante)) {
            Alert.alert('Erro', 'CPF inválido. Por favor, verifique o número digitado.');
            return;
          }

          const visitorData = {
            name: nomeVisitante,
            document: cleanCPF(cpfVisitante), // Salva apenas números no banco
            phone: null,
            photo_url: fotoTirada || null,
            is_active: true
          };
          console.log('🔍 DEBUG: Dados do novo visitante:', visitorData);
          
          // Inserir novo visitante
          const { data: newVisitor, error: visitorError } = await supabase
            .from('visitors')
            .insert(visitorData)
            .select('id')
            .maybeSingle();

          console.log('🔍 DEBUG: Resultado da inserção do visitante:', { newVisitor, visitorError });
          
          if (visitorError || !newVisitor) {
            console.error('❌ DEBUG: Erro detalhado ao inserir visitante:', {
              message: visitorError?.message,
              code: visitorError?.code,
              details: visitorError?.details,
              hint: visitorError?.hint,
              newVisitor
            });
            Alert.alert('Erro', 'Falha ao registrar visitante.');
            return;
          }
          
          console.log('✅ DEBUG: Novo visitante criado com ID:', newVisitor.id);
          visitorId = newVisitor.id;
        }

        // Gerar visit_session_id único como UUID válido
        const visitSessionId = generateUUID();
        console.log('🔍 DEBUG: Visit session ID gerado:', visitSessionId);

        // Determinar o propósito baseado no tipo de visita
        let purpose = tipoVisita;
        if (tipoVisita === 'prestador' && empresaPrestador) {
          purpose = `prestador - ${empresaPrestador.replace('_', ' ')}`;
        } else if (tipoVisita === 'entrega' && empresaEntrega) {
          purpose = `entrega - ${empresaEntrega.replace('_', ' ')}`;
        }
        
        console.log('🔍 DEBUG: Propósito da visita:', purpose);
        console.log('🔍 DEBUG: Observações:', observacoes);

        // Preparar dados do log
        const logData = {
          visitor_id: visitorId,
          apartment_id: userApartmentId,
          building_id: apartmentData.building_id,
          log_time: new Date().toISOString(),
          tipo_log: 'IN', // Entry log type
          visit_session_id: visitSessionId,
          purpose: observacoes || purpose,
          authorized_by: user.id,
          notification_status: 'approved' // Automatically approved for residents
        };
        
        console.log('🔍 DEBUG: Dados do log a serem inseridos:', logData);
        console.log('🔍 DEBUG: Validando tipos dos dados do log:');
        console.log('🔍 DEBUG: - visitor_id tipo:', typeof visitorId, 'valor:', visitorId);
        console.log('🔍 DEBUG: - apartment_id tipo:', typeof apartmentData.id, 'valor:', apartmentData.id);
        console.log('🔍 DEBUG: - building_id tipo:', typeof apartmentData.building_id, 'valor:', apartmentData.building_id);
        console.log('🔍 DEBUG: - authorized_by tipo:', typeof user.id, 'valor:', user.id);
        console.log('🔍 DEBUG: - visit_session_id tipo:', typeof visitSessionId, 'valor:', visitSessionId);

        // Inserir log de entrada na tabela visitor_logs com notification_status aprovado automaticamente
        console.log('🔍 DEBUG: Inserindo log de entrada...');
        const { data: logResult, error: logError } = await supabase
          .from('visitor_logs')
          .insert(logData)
          .select('*');

        console.log('🔍 DEBUG: Resultado da inserção do log:', { logResult, logError });
        
        if (logError) {
          console.error('❌ DEBUG: Erro detalhado ao inserir log de entrada:', {
            message: logError?.message,
            code: logError?.code,
            details: logError?.details,
            hint: logError?.hint,
            logResult
          });
          Alert.alert('Erro', 'Falha ao registrar visitante.');
          return;
        }
        
        console.log('✅ DEBUG: Log de entrada inserido com sucesso:', logResult);

        const message = `${nomeVisitante} foi pré-cadastrado com sucesso para o apartamento ${apartmentData.number}. O visitante está automaticamente aprovado.`;
        console.log('✅ DEBUG: Processo concluído com sucesso:', message);

        if (onConfirm) {
          onConfirm(message);
        } else {
          Alert.alert('✅ Visitante Cadastrado!', message, [
            { 
              text: 'OK', 
              onPress: () => router.push('/morador')
            }
          ]);
        }
      } catch (error) {
        console.error('❌ DEBUG: Erro geral ao cadastrar visitante:', {
          error,
          message: error?.message,
          stack: error?.stack
        });
        Alert.alert('Erro', 'Falha inesperada ao cadastrar visitante. Verifique sua conexão e tente novamente.');
      }
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>✅ Confirmação</Text>
        <Text style={styles.stepSubtitle}>Revise os dados do visitante</Text>

        <View style={styles.summaryContainer}>
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

          <View style={styles.approvalNotice}>
            <Text style={styles.approvalText}>✅ Este visitante será automaticamente aprovado</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.confirmFinalButton} onPress={handleConfirm}>
          <Text style={styles.confirmFinalButtonText}>Confirmar Cadastro</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
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
        return renderTipoStep();
    }
  };

  const getProgressPercentage = () => {
    const steps = ['tipo', 'nome', 'cpf', 'observacoes', 'foto', 'confirmacao'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cadastrar Visitante</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${getProgressPercentage()}%`,
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
  optionsContainer: {
    gap: 15,
  },
  optionButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  socialButton: {
    borderColor: '#4CAF50',
  },
  prestadorButton: {
    borderColor: '#2196F3',
  },
  entregaButton: {
    borderColor: '#FF9800',
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
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
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
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
    marginTop: 20,
  },
  camera: {
    flex: 1,
    minHeight: 400,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonText: {
    fontSize: 32,
  },
  photoTakenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
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
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  approvalNotice: {
    backgroundColor: '#E8F5E8',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  approvalText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmFinalButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmFinalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});