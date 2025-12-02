import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFirstLogin } from '~/hooks/useFirstLogin';
import { useAuth } from '~/hooks/useAuth';
import { CPFValidationService } from '~/services/CPFValidationService';
import { PhotoUpload } from '~/components/PhotoUpload';
import { supabase } from '~/utils/supabase';
import { TokenStorage } from '~/services/TokenStorage';

interface FormData {
  full_name: string;
  cpf: string;
  birth_date: string;
  phone: string;
  photoUri: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address: string;
}

export default function FirstLoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'personal' | 'contact' | 'photo'>('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    cpf: '',
    birth_date: '',
    phone: '',
    photoUri: null,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
  });

  const {
    completeFirstLogin,
    profileData,
    isLoading: hookLoading,
    error: hookError,
  } = useFirstLogin();
  const { user, signOut } = useAuth();

  // Pre-fill form with existing profile data
  useEffect(() => {
    if (profileData && typeof profileData === 'object' && profileData !== null) {
      const safeProfileData = {
        full_name: (profileData as any)?.full_name || '',
        cpf: (profileData as any)?.cpf || '',
        phone: (profileData as any)?.phone || '',
        birth_date: (profileData as any)?.birth_date || '',
        emergency_contact_name: (profileData as any)?.emergency_contact_name || '',
        emergency_contact_phone: (profileData as any)?.emergency_contact_phone || '',
      };

      setFormData((prev) => ({
        ...prev,
        ...safeProfileData,
      }));
    }
  }, [profileData]);

  // Update form data
  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors && errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
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

    const steps: ('personal' | 'contact' | 'photo')[] = ['personal', 'contact', 'photo'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  // Navigate to previous step
  const handleBack = () => {
    const steps: ('personal' | 'contact' | 'photo')[] = ['personal', 'contact', 'photo'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  // Handle logout
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
            setIsLoading(true);

            try {
              const logoutPromise = signOut();
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
              );

              await Promise.race([logoutPromise, timeoutPromise]);
              router.replace('/');
            } catch (error: any) {
              const isNetworkError =
                error?.message?.includes('Network request failed') ||
                error?.message?.includes('Timeout');

              if (isNetworkError) {
                try {
                  TokenStorage.clearAll();
                  Alert.alert(
                    'Logout Realizado',
                    'Você foi desconectado com sucesso.',
                    [{ text: 'OK', onPress: () => router.replace('/') }]
                  );
                } catch (fallbackError) {
                  router.replace('/');
                }
              } else {
                Alert.alert('Erro no Logout', 'Ocorreu um erro ao fazer logout.', [
                  { text: 'Tentar Novamente', onPress: () => handleLogout() },
                  { text: 'Forçar Saída', style: 'destructive', onPress: () => router.replace('/') },
                ]);
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
    if (!validateCurrentStep()) return;

    const cleanCpf = CPFValidationService.clean(formData.cpf);
    setIsLoading(true);

    try {
      // Check if CPF already exists
      if (user?.id) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, cpf')
          .eq('cpf', cleanCpf)
          .neq('user_id', user.id)
          .maybeSingle();

        if (existingProfile) {
          Alert.alert(
            'CPF Já Cadastrado',
            'Este CPF já está cadastrado no sistema.',
            [{ text: 'OK' }]
          );
          setIsLoading(false);
          return;
        }
      }

      const result = await completeFirstLogin({
        cpf: cleanCpf,
        photoUri: formData.photoUri,
        full_name: formData.full_name,
        phone: formData.phone,
        birth_date: formData.birth_date,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        address: formData.address,
      });

      if (result.success) {
        Alert.alert('Sucesso!', 'Seu perfil foi completado com sucesso.', [
          { text: 'OK', onPress: () => router.replace('/morador') },
        ]);
      } else {
        if (result.error && result.error.includes('CPF já está cadastrado')) {
          Alert.alert('CPF Já Cadastrado', result.error, [{ text: 'OK' }]);
        } else {
          Alert.alert('Erro', result.error || 'Erro ao completar perfil');
        }
      }
    } catch (error) {
      console.error('Error completing first login:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'personal':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Informações Pessoais</Text>
            <Text style={styles.stepDescription}>
              Complete seu cadastro para acessar todas as funcionalidades
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome Completo *</Text>
              <TextInput
                style={[styles.input, errors.full_name && styles.inputError]}
                value={formData.full_name}
                onChangeText={(text) => updateFormData('full_name', text)}
                placeholder="Digite seu nome completo"
                autoCapitalize="words"
              />
              {errors.full_name && <Text style={styles.errorText}>{errors.full_name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CPF *</Text>
              <TextInput
                style={[styles.input, errors.cpf && styles.inputError]}
                value={formData.cpf}
                onChangeText={handleCpfChange}
                placeholder="000.000.000-00"
                keyboardType="numeric"
                maxLength={14}
              />
              {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data de Nascimento *</Text>
              <TextInput
                style={[styles.input, errors.birth_date && styles.inputError]}
                value={formData.birth_date}
                onChangeText={handleBirthDateChange}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
              {errors.birth_date && <Text style={styles.errorText}>{errors.birth_date}</Text>}
            </View>
          </View>
        );

      case 'contact':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Contato</Text>
            <Text style={styles.stepDescription}>Adicione seus contatos</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefone *</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={handlePhoneChange}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                maxLength={15}
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contato de Emergência</Text>
              <TextInput
                style={styles.input}
                value={formData.emergency_contact_name}
                onChangeText={(text) => updateFormData('emergency_contact_name', text)}
                placeholder="Nome do contato"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefone de Emergência</Text>
              <TextInput
                style={styles.input}
                value={formData.emergency_contact_phone}
                onChangeText={(text) => updateFormData('emergency_contact_phone', text)}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>
        );

      case 'photo':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Foto de Perfil</Text>
            <Text style={styles.stepDescription}>Tire uma foto para seu perfil</Text>

            <PhotoUpload
              photoUri={formData.photoUri}
              onPhotoSelected={handlePhotoSelected}
              style={styles.photoUpload}
            />
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Primeiro Acesso</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  step === 'personal' ? '33%' : step === 'contact' ? '66%' : '100%',
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Etapa {step === 'personal' ? '1' : step === 'contact' ? '2' : '3'} de 3
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        {step !== 'personal' && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleBack}
            disabled={isLoading}>
            <Text style={styles.buttonSecondaryText}>Voltar</Text>
          </TouchableOpacity>
        )}

        {step !== 'photo' ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, step === 'personal' && styles.buttonFull]}
            onPress={handleNext}
            disabled={isLoading}>
            <Text style={styles.buttonPrimaryText}>Próximo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleComplete}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>Concluir</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContent: {
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
  photoUpload: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: '#4CAF50',
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
