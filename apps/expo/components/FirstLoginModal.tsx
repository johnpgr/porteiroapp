import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Modal } from '~/components/Modal';
import { Ionicons } from '@expo/vector-icons';
import { useFirstLogin } from '../hooks/useFirstLogin';
import { useAuth } from '../hooks/useAuth';
import { CPFValidationService } from '../services/CPFValidationService';
import { PhotoUpload } from './PhotoUpload';
import { supabase } from '../utils/supabase';

interface FirstLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface FormData {
  full_name: string;
  cpf: string;
  birth_date: string;
  phone: string;
  photoUri: string | null;
}

export const FirstLoginModal: React.FC<FirstLoginModalProps> = ({
  visible,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<'personal' | 'contact' | 'emergency' | 'photo'>('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    cpf: '',
    birth_date: '',
    phone: '',
    photoUri: null,
  });
  
  const { completeFirstLogin, profileData, isLoading: hookLoading, error: hookError } = useFirstLogin();
  const { user, signOut } = useAuth();

  // Verificação de segurança para dados nulos
  useEffect(() => {
    if (visible && profileData && typeof profileData === 'object' && profileData !== null) {
      console.log('🔍 DEBUG FirstLoginModal - Profile data recebido:', profileData);
      
      // Verificar se profileData tem as propriedades esperadas
      const safeProfileData = {
        full_name: (profileData as any)?.full_name || '',
        cpf: (profileData as any)?.cpf || '',
        phone: (profileData as any)?.phone || '',
        birth_date: (profileData as any)?.birth_date || '',
        emergency_contact_name: (profileData as any)?.emergency_contact_name || '',
        emergency_contact_phone: (profileData as any)?.emergency_contact_phone || '',
      };
      
      console.log('🔍 DEBUG FirstLoginModal - Safe profile data:', safeProfileData);
      
      // Se já existe dados do perfil, pré-preencher o formulário
      setFormData(prev => ({
        ...prev,
        ...safeProfileData
      }));
    }
  }, [visible, profileData]);

  // Reset state when modal opens and load buildings
  useEffect(() => {
    if (visible) {
      setStep('personal');
      setFormData({
        full_name: '',
        cpf: '',
        phone: '',
        birth_date: '',
        photoUri: null,
      });
      setErrors({});
      setIsLoading(false);
    }
  }, [visible]);



  // Update form data
  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors && errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Format CPF as user types
  const handleCpfChange = (text: string) => {
    const formattedCpf = CPFValidationService.formatAsTyping(text);
    updateFormData('cpf', formattedCpf);
  };

  // Format phone as user types
  const handlePhoneChange = (text: string) => {
    const formattedPhone = text.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    updateFormData('phone', formattedPhone);
  };



  // Format birth date as user types
  const handleBirthDateChange = (text: string) => {
    const formattedDate = text.replace(/\D/g, '').replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3');
    updateFormData('birth_date', formattedDate);
  };

  const handlePhotoSelected = (uri: string) => {
    console.log('📸 DEBUG FirstLoginModal - Foto selecionada:', uri);
    updateFormData('photoUri', uri);
  };

  // Validate current step
  const validateCurrentStep = (): boolean => {
    const newErrors: Partial<FormData> = {};

    switch (step) {
      case 'personal':
        if (!formData.full_name.trim()) newErrors.full_name = 'Nome completo é obrigatório';
        if (!formData.cpf.trim()) {
          newErrors.cpf = 'CPF é obrigatório';
        } else {
          const cleanCpf = CPFValidationService.clean(formData.cpf);
          if (!CPFValidationService.isValid(cleanCpf)) {
            newErrors.cpf = 'CPF inválido';
          }
        }
        if (!formData.birth_date.trim()) {
          newErrors.birth_date = 'Data de nascimento é obrigatória';
        } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formData.birth_date)) {
          newErrors.birth_date = 'Data deve estar no formato DD/MM/AAAA';
        }
        break;

      case 'contact':
        if (!formData.phone.trim()) {
          newErrors.phone = 'Telefone é obrigatório';
        } else if (formData.phone.replace(/\D/g, '').length < 10) {
          newErrors.phone = 'Telefone deve ter pelo menos 10 dígitos';
        }
        break;



      case 'photo':
        if (!formData.photoUri) {
          Alert.alert('Erro', 'Por favor, tire uma foto para continuar.');
          return false;
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigate to next step
  const handleNext = () => {
    if (!validateCurrentStep()) return;

    const steps: ('personal' | 'contact' | 'photo')[] = [
      'personal', 'contact', 'photo'
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  // Navigate to previous step
  const handleBack = () => {
    const steps: ('personal' | 'contact' | 'photo')[] = [
      'personal', 'contact', 'photo'
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    } else {
      onClose();
    }
  };

  // Handle logout with confirmation and robust error handling
  const handleLogout = () => {
    Alert.alert(
      'Confirmar Logout',
      'Tem certeza que deseja sair? Você perderá o progresso atual do cadastro.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            // Mostrar loading durante logout
            setIsLoading(true);
            
            try {
              console.log('🚪 [FirstLoginModal] Iniciando logout...');
              
              // Timeout para evitar travamento em caso de problemas de rede
              const logoutPromise = signOut();
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
              );
              
              await Promise.race([logoutPromise, timeoutPromise]);
              
              console.log('✅ [FirstLoginModal] Logout realizado com sucesso');
              onClose();
              
            } catch (error: any) {
              console.error('❌ [FirstLoginModal] Erro durante logout:', error);
              
              // Verificar se é erro de rede ou timeout
              const isNetworkError = error?.message?.includes('Network request failed') || 
                                   error?.message?.includes('Timeout') ||
                                   error?.name?.includes('AuthRetryableFetchError');
              
              if (isNetworkError) {
                console.log('🌐 [FirstLoginModal] Erro de rede detectado, executando logout local...');
                
                // Fallback: logout local mesmo com erro de rede
                try {
                  // Limpar dados locais diretamente
                  await import('../services/TokenStorage').then(({ TokenStorage }) => 
                    TokenStorage.clearAll()
                  );
                  
                  console.log('🧹 [FirstLoginModal] Dados locais limpos com sucesso');
                  
                  Alert.alert(
                    'Logout Realizado',
                    'Você foi desconectado com sucesso. Devido a problemas de conectividade, alguns dados podem não ter sido sincronizados com o servidor.',
                    [{ 
                      text: 'OK', 
                      onPress: () => onClose()
                    }]
                  );
                  
                } catch (fallbackError) {
                  console.error('❌ [FirstLoginModal] Erro no fallback de logout:', fallbackError);
                  
                  Alert.alert(
                    'Forçar Saída',
                    'Houve um problema ao fazer logout. Deseja forçar a saída? Isso pode deixar alguns dados não sincronizados.',
                    [
                      {
                        text: 'Cancelar',
                        style: 'cancel'
                      },
                      {
                        text: 'Forçar Saída',
                        style: 'destructive',
                        onPress: () => {
                          console.log('🔄 [FirstLoginModal] Forçando logout...');
                          onClose();
                        }
                      }
                    ]
                  );
                }
              } else {
                // Outros tipos de erro
                Alert.alert(
                  'Erro no Logout',
                  'Ocorreu um erro inesperado ao fazer logout. Tente novamente.',
                  [
                    {
                      text: 'Tentar Novamente',
                      onPress: () => handleLogout()
                    },
                    {
                      text: 'Forçar Saída',
                      style: 'destructive',
                      onPress: () => onClose()
                    }
                  ]
                );
              }
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Complete profile
  const handleComplete = async () => {
    console.log('🚀 DEBUG FirstLoginModal - Iniciando handleComplete');
    console.log('📋 DEBUG FirstLoginModal - Form data:', formData);
    
    if (!validateCurrentStep()) return;

    const cleanCpf = CPFValidationService.clean(formData.cpf);
    
    console.log('📋 DEBUG FirstLoginModal - Dados que serão enviados:', {
      cpf: cleanCpf,
      photoUri: formData.photoUri,
      full_name: formData.full_name,
      phone: formData.phone,
      birth_date: formData.birth_date,
      emergency_contact_name: formData.emergency_contact_name,
      emergency_contact_phone: formData.emergency_contact_phone,
    });
    
    setIsLoading(true);
    
    try {
      // Verificar se o CPF já existe no sistema antes de tentar salvar
      console.log('🔍 DEBUG FirstLoginModal - Verificando se CPF já existe:', cleanCpf);
      
      if (user?.id) {
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id, cpf')
          .eq('cpf', cleanCpf)
          .neq('id', user.id) // Excluir o próprio usuário
          .maybeSingle();
        
        if (checkError) {
          console.warn('⚠️ DEBUG FirstLoginModal - Erro ao verificar CPF:', checkError);
        }
        
        if (existingProfile) {
          console.log('❌ DEBUG FirstLoginModal - CPF já existe:', existingProfile);
          Alert.alert(
            'CPF Já Cadastrado',
            'Este CPF já está cadastrado no sistema. Por favor, verifique se você já possui uma conta ou entre em contato com o administrador.',
            [{ text: 'OK', style: 'default' }]
          );
          setIsLoading(false);
          return;
        }
      }
      
      console.log('🔄 DEBUG FirstLoginModal - CPF disponível, chamando completeFirstLogin...');
      const result = await completeFirstLogin({
        cpf: cleanCpf,
        photoUri: formData.photoUri,
        full_name: formData.full_name,
        phone: formData.phone,
        birth_date: formData.birth_date,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
      });

      console.log('📊 DEBUG FirstLoginModal - Resultado recebido:', result);

      if (result.success) {
        console.log('✅ DEBUG FirstLoginModal - Sucesso!');
        Alert.alert(
          'Sucesso!',
          'Seu perfil foi completado com sucesso.',
          [{ text: 'OK', onPress: onComplete }]
        );
      } else {
        console.log('❌ DEBUG FirstLoginModal - Erro:', result.error);
        
        // Verificar se é erro específico de CPF duplicado
        if (result.error && result.error.includes('CPF já está cadastrado')) {
          Alert.alert(
            'CPF Já Cadastrado', 
            result.error,
            [
              { text: 'OK', style: 'default' }
            ]
          );
        } else {
          Alert.alert('Erro', result.error || 'Erro ao completar perfil');
        }
      }
    } catch (error) {
      console.error('❌ DEBUG FirstLoginModal - Erro capturado:', error);
      Alert.alert('Erro', 'Erro inesperado ao completar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  // Render input field with error handling
  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: 'default' | 'numeric' | 'phone-pad' = 'default',
    maxLength?: number,
    error?: string,
    autoFocus?: boolean
  ) => {
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#1F2937"
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={true}
          selectTextOnFocus={true}
          autoCorrect={false}
          autoCapitalize={keyboardType === 'phone-pad' ? 'none' : 'words'}
          autoFocus={autoFocus}
          clearButtonMode="while-editing"
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  };

  // Render personal data step
  const renderPersonalStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <Ionicons name="person-outline" size={48} color="#007AFF" />
        <Text style={styles.title}>Dados Pessoais</Text>
        <Text style={styles.subtitle}>
          Vamos começar com suas informações básicas
        </Text>
      </View>

      {renderInput(
        'Nome Completo',
        formData.full_name,
        (text) => updateFormData('full_name', text),
        'Digite seu nome completo',
        'default',
        undefined,
        errors?.full_name
      )}

      {renderInput(
        'CPF',
        formData.cpf,
        handleCpfChange,
        '000.000.000-00',
        'numeric',
        14,
        errors?.cpf
      )}

      {renderInput(
        'Data de Nascimento',
        formData.birth_date,
        handleBirthDateChange,
        'DD/MM/AAAA',
        'numeric',
        10,
        errors?.birth_date
      )}

      <TouchableOpacity
        style={[styles.button, (!formData.full_name || !formData.cpf || !formData.birth_date) ? styles.buttonDisabled : null]}
        onPress={handleNext}
        disabled={!formData.full_name || !formData.cpf || !formData.birth_date}
      >
        <Text style={styles.buttonText}>Continuar</Text>
        <Ionicons name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );

  // Render contact step
  const renderContactStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <Ionicons name="call-outline" size={48} color="#007AFF" />
        <Text style={styles.title}>Informações de Contato</Text>
        <Text style={styles.subtitle}>
          Como podemos entrar em contato com você?
        </Text>
      </View>

      {renderInput(
        'Telefone',
        formData.phone,
        handlePhoneChange,
        '(11) 99999-9999',
        'phone-pad',
        15,
        errors?.phone
      )}

      <TouchableOpacity
        style={[styles.button, !formData.phone ? styles.buttonDisabled : null]}
        onPress={handleNext}
        disabled={!formData.phone}
      >
        <Text style={styles.buttonText}>Continuar</Text>
        <Ionicons name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );





  // Render photo step
  const renderPhotoStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <Ionicons name="camera-outline" size={48} color="#007AFF" />
        <Text style={styles.title}>Foto do Perfil</Text>
        <Text style={styles.subtitle}>
          Adicione uma foto para completar seu perfil. Ela será usada para sua identificação no condomínio.
        </Text>
        <Text style={styles.photoHint}>
          📱 Você pode tirar uma nova foto ou escolher uma da sua galeria. As permissões serão solicitadas quando necessário.
        </Text>
      </View>

      <PhotoUpload
        onPhotoSelected={handlePhotoSelected}
        photoUri={formData.photoUri}
        style={styles.photoUpload}
      />

      <TouchableOpacity
        style={[styles.button, !formData.photoUri ? styles.buttonDisabled : null]}
        onPress={handleComplete}
        disabled={!formData.photoUri || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text style={styles.buttonText}>Finalizar</Text>
            <Ionicons name="checkmark" size={20} color="white" />
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  // Get current step info for progress bar
  const getStepInfo = () => {
    const steps = [
      { key: 'personal', title: 'Dados Pessoais', icon: 'person-outline' },
      { key: 'contact', title: 'Contato', icon: 'call-outline' },
      { key: 'photo', title: 'Foto', icon: 'camera-outline' }
    ];
    
    const currentIndex = steps.findIndex(s => s.key === step);
    return { steps, currentIndex, total: steps.length };
  };

  // Render current step
  const renderCurrentStep = () => {
    switch (step) {
      case 'personal':
        return renderPersonalStep();
      case 'contact':
        return renderContactStep();
      case 'photo':
        return renderPhotoStep();
      default:
        return renderPersonalStep();
    }
  };

  const { steps, currentIndex } = getStepInfo();

  // Renderizar loading ou erro se necessário
  if (hookLoading) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando dados do perfil...</Text>
        </View>
      </Modal>
    );
  }

  if (hookError) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, styles.centerContent]}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorTitle}>Erro ao carregar dados</Text>
          <Text style={styles.errorDescription}>{hookError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleBack}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleLogout} style={styles.backButton}>
            <Ionicons name="log-out" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((currentIndex + 1) / steps.length) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentIndex + 1} de {steps.length}
            </Text>
          </View>
        </View>

        {/* Step Indicators */}
        <View style={styles.stepIndicators}>
          {steps.map((stepInfo, index) => (
            <View key={stepInfo.key} style={styles.stepIndicator}>
              <View
                style={[
                  styles.stepCircle,
                  index <= currentIndex ? styles.stepCircleActive : styles.stepCircleInactive,
                ]}
              >
                <Ionicons
                  name={stepInfo.icon as any}
                  size={16}
                  color={index <= currentIndex ? '#007AFF' : '#C7C7CC'}
                />
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  index <= currentIndex ? styles.stepLabelActive : styles.stepLabelInactive,
                ]}
              >
                {stepInfo.title}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled={true}
          scrollEnabled={true}
        >
          {renderCurrentStep()}
        </ScrollView>


      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressBar: {
    width: 120,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  stepCircleInactive: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#C7C7CC',
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#007AFF',
  },
  stepLabelInactive: {
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  photoHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  },
  pickerContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    color: '#1C1C1E',
  },
  photoUpload: {
    marginBottom: 20,
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
