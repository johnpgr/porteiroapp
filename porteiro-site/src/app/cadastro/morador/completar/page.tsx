'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PhotoUpload from '@/components/PhotoUpload';

import { toast } from 'sonner';

interface ProfileData {
  full_name: string;
  email: string;
  cpf: string;
  birth_date: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  full_name?: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  password?: string;
  confirmPassword?: string;
  photo?: string;
  submit?: string;
  [key: string]: string | undefined;
}

interface Profile {
  id: string;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  avatar_url?: string | null;
  building_id?: string | null;
  role?: string | null;
  user_type?: string | null;
  profile_complete?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TemporaryPassword {
  id: string;
  profile_id: string;
  password_hash: string;
  plain_password: string;
  used: boolean | null;
  created_at: string | null;
  used_at: string | null;
  expires_at: string | null;
  phone_number?: string;
}

export default function CompletarCadastroPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  
  // Estados para autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authenticatedProfile, setAuthenticatedProfile] = useState<Profile | null>(null);
  
  // Estados para busca automática por telefone
  const [isSearchingByPhone, setIsSearchingByPhone] = useState(false);
  const [phoneSearchSuccess, setPhoneSearchSuccess] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [formData, setFormData] = useState<ProfileData>({
    full_name: '',
    email: '',
    cpf: '',
    birth_date: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    password: '',
    confirmPassword: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [errors, setErrors] = useState<FormErrors>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Estados para controlar visibilidade das senhas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Controle para evitar buscas repetidas por telefone (cooldown)
  const lastSearchedPhoneRef = useRef<string>('');
  const lastSearchAtRef = useRef<number>(0);
  const lastSearchEmptyRef = useRef<boolean>(false);
  const [lastSearchEmpty, setLastSearchEmpty] = useState(false);
  // Timeout de segurança para evitar loading infinito
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get profile_id from URL on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlProfileId = urlParams.get('profile_id');
      console.log('Profile ID extraído da URL:', urlProfileId);
      setProfileId(urlProfileId);
    }
  }, []);

  // Debounce para busca automática por telefone
  useEffect(() => {
    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Se não há profileId, não está autenticado, não está buscando e o telefone tem pelo menos 10 dígitos
    if (!profileId && !isAuthenticated && !isSearchingByPhone && !isAuthenticating && authPhone) {
      const cleanPhone = authPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        debounceTimerRef.current = setTimeout(() => {
          // Cooldown de 30s para o mesmo número quando a última busca foi vazia
          const COOLDOWN_MS = 30000;
          const clean = cleanPhone;
          if (
            lastSearchedPhoneRef.current === clean &&
            lastSearchEmptyRef.current &&
            Date.now() - lastSearchAtRef.current < COOLDOWN_MS
          ) {
            return;
          }
          searchProfileByPhone(authPhone, true);
        }, 1500); // 1.5 segundos de debounce
      }
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [authPhone, profileId, isAuthenticated, isSearchingByPhone, isAuthenticating]);

  // Função otimizada para buscar profile_id usando o número de celular
  const searchProfileByPhone = async (phoneNumber: string, isAutoSearch = false) => {
    try {
      if (isAutoSearch) {
        setIsSearchingByPhone(true);
      } else {
        setIsAuthenticating(true);
      }
      setAuthError(null);
      setPhoneSearchSuccess(false);
      setLastSearchEmpty(false);
      // Inicia um timeout de segurança (8s) para evitar loading infinito
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setIsSearchingByPhone(false);
        setIsAuthenticating(false);
        setPhoneSearchSuccess(false);
        setAuthError('A busca está demorando mais que o esperado. Tente novamente em instantes.');
        toast.info('A busca está demorando mais que o esperado. Tente novamente em instantes.', { duration: 4000 });
        const clean = phoneNumber.replace(/\D/g, '');
        lastSearchedPhoneRef.current = clean;
        lastSearchAtRef.current = Date.now();
        lastSearchEmptyRef.current = true;
        setLastSearchEmpty(true);
      }, 8000);

      // Limpar e formatar o número de celular
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Verificar se o telefone tem pelo menos 10 dígitos
      if (cleanPhone.length < 10) {
        if (!isAutoSearch) {
          throw new Error('Número de telefone deve ter pelo menos 10 dígitos');
        }
        return;
      }
      
      console.log('🔍 Buscando perfil para telefone:', cleanPhone);

      // Montar variações do número (para diferentes formatos salvos)
      const phoneVariations = [
        cleanPhone,
        cleanPhone.slice(-11), // Últimos 11 dígitos (com DDD)
        cleanPhone.slice(-10)  // Últimos 10 dígitos (sem DDD)
      ].filter(v => v.length >= 10);

      // 1) Buscar o perfil pelo telefone na tabela profiles
      const { data: profileMatches, error: profileError } = await supabase
        .from('profiles')
        .select('id, phone')
        .or(phoneVariations.map(variation => `phone.eq.${variation}`).join(','))
        .limit(1);

      if (profileError) {
        console.error('❌ Erro ao consultar perfis:', profileError);
        throw new Error('Erro ao buscar dados do perfil');
      }

      // Flags para atualizar cooldown
      let foundSomething = false;
      let hasActiveTempPassword = false;

      if (!profileMatches || profileMatches.length === 0) {
        // Nenhum perfil com este telefone: atualizar cooldown para evitar loop
        lastSearchedPhoneRef.current = cleanPhone;
        lastSearchAtRef.current = Date.now();
        lastSearchEmptyRef.current = true;
        if (!isAutoSearch) {
          throw new Error('Nenhum perfil encontrado para este celular.');
        }
        return;
      }

      const matchedProfile = profileMatches[0];
      foundSomething = true;

      // 2) Verificar se existe senha temporária ativa para este profile_id (opcional nesta etapa)
      const { data: activeTemp, error: tempErr } = await supabase
        .from('temporary_passwords')
        .select('id, profile_id, plain_password, used, expires_at, status')
        .eq('profile_id', matchedProfile.id)
        .eq('used', false)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .limit(1);

      if (tempErr) {
        console.warn('⚠️ Erro ao consultar senhas temporárias (continuando):', tempErr);
      }

      hasActiveTempPassword = !!(activeTemp && activeTemp.length > 0);

      // Definir o profileId encontrado
      setProfileId(matchedProfile.id);
      setPhoneSearchSuccess(true);

      // Feedback ao usuário
      if (isAutoSearch) {
        toast.success('✅ Perfil encontrado! Digite sua senha para continuar.', { duration: 3000 });
      } else {
        toast.success('✅ Perfil encontrado! Agora digite sua senha.', { duration: 3000 });
      }

      if (!hasActiveTempPassword) {
        toast.info('Não encontramos uma senha temporária ativa agora. Verifique seu WhatsApp pelo código.', { duration: 4000 });
      }

      // Atualizar controles de cooldown
      lastSearchedPhoneRef.current = cleanPhone;
      lastSearchAtRef.current = Date.now();
      lastSearchEmptyRef.current = !hasActiveTempPassword;
      
    } catch (error: unknown) {
      console.error('💥 Erro ao buscar perfil por telefone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar perfil';
      if (!isAutoSearch) {
        setAuthError(errorMessage);
        toast.error(errorMessage, { duration: 4000 });
      }
      // Atualizar cooldown para evitar buscas repetidas em caso de erro
      const clean = phoneNumber.replace(/\D/g, '');
      lastSearchedPhoneRef.current = clean;
      lastSearchAtRef.current = Date.now();
      lastSearchEmptyRef.current = true;
      setPhoneSearchSuccess(false);
      setProfileId(null);
    } finally {
      // Sempre resetar o estado de loading
      setIsSearchingByPhone(false);
      setIsAuthenticating(false);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    }
  };

  // Função para autenticar com celular e senha
  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);

    // Se não há profileId, tentar buscar usando o celular
    if (!profileId) {
      if (!authPhone) {
        setAuthError('Por favor, informe o número do celular');
        setIsAuthenticating(false);
        return;
      }
      
      // Buscar profileId usando o celular
      await searchProfileByPhone(authPhone);
      return; // A função searchProfileByPhone já define o profileId, então retornamos aqui
    }

    try {
      // Validar senha (6 dígitos)
      if (!/^\d{6}$/.test(authPassword)) {
        throw new Error('A senha deve conter exatamente 6 dígitos');
      }

      // Buscar registros de senha temporária ativos para este profile
      const { data: filteredData, error: filteredError } = await supabase
        .from('temporary_passwords')
        .select('id, profile_id, plain_password, used, expires_at, status')
        .eq('profile_id', profileId)
        .eq('used', false)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .limit(1);

      if (filteredError) {
        throw new Error('Erro ao verificar senha temporária');
      }

      if (!filteredData || filteredData.length === 0) {
        // Atualizar cooldown baseado no telefone informado
        const clean = authPhone.replace(/\D/g, '');
        lastSearchedPhoneRef.current = clean;
        lastSearchAtRef.current = Date.now();
        lastSearchEmptyRef.current = true;
        throw new Error('Senha temporária não encontrada ou expirada');
      }

      const tempPassword = filteredData[0] as TemporaryPassword;

      // Verificar se a senha está correta
      if (authPassword !== tempPassword.plain_password) {
        throw new Error('Senha incorreta');
      }

      // Validar se a senha temporária é válida (não usada e não expirada)
      if (tempPassword.used) {
        throw new Error('Esta senha temporária já foi utilizada');
      }

      const now = new Date();
      if (!tempPassword.expires_at) {
        throw new Error('Data de expiração não definida');
      }
      const expiresAt = new Date(tempPassword.expires_at);
      if (now > expiresAt) {
        throw new Error('Esta senha temporária expirou');
      }

      // Buscar dados completos do perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError || !profile) {
        throw new Error('Perfil não encontrado');
      }

      // Verificar se o perfil já foi completado
      if (profile.profile_complete) {
        throw new Error('Este perfil já foi completado');
      }

      // Armazenar dados do perfil autenticado
      setAuthenticatedProfile(profile);
      
      // Pré-preencher dados existentes do perfil
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        email: profile.email || '',
        cpf: profile.cpf || '',
        birth_date: profile.birth_date || '',
        address: profile.address || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || ''
      }));
      
      // Se o perfil já tem uma foto, definir o photoUrl
      if (profile.avatar_url) {
        setPhotoUrl(profile.avatar_url);
      }
      
      setIsAuthenticated(true);
      toast.success('Autenticação realizada com sucesso!');
    } catch (error: unknown) {
      console.error('Erro na autenticação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na autenticação';
      setAuthError(errorMessage);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const formatPhone = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    return cleanValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  // Função para formatar telefone na autenticação
  const formatAuthPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const handleEmergencyPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({ ...prev, emergency_contact_phone: formatted }));
    if (errors.emergency_contact_phone) {
      setErrors(prev => ({ ...prev, emergency_contact_phone: '' }));
    }
  };

  const handlePhotoUpload = (url: string) => {
    setPhotoUrl(url);
    setErrors(prev => ({ ...prev, photo: '' }));
  };

  const handlePhotoRemove = () => {
    setPhotoUrl('');
  };

  // Funções de navegação entre etapas
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => {
    if (step <= currentStep || completedSteps.has(step - 1)) {
      setCurrentStep(step);
    }
  };

  // Validação por etapa
  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) {
      return validateStep1();
    } else if (currentStep === 2) {
      return validateStep2();
    } else if (currentStep === 3) {
      return validateStep3();
    }
    return true;
  };

  const validateForm = (): boolean => {
    console.log('🔍 Iniciando validação completa do formulário...');
    
    // Valida todas as etapas para o submit final
    const step1Valid = validateStep1();
    console.log('📝 Validação Etapa 1 (Dados Pessoais):', step1Valid);
    
    const step2Valid = validateStep2();
    console.log('📝 Validação Etapa 2 (Endereço e Contato):', step2Valid);
    
    const step3Valid = validateStep3();
    console.log('📝 Validação Etapa 3 (Senha):', step3Valid);
    
    const newErrors: FormErrors = {};
    // Verificar se há foto: photoUrl ou avatar existente no perfil
    const hasPhoto = photoUrl || authenticatedProfile?.avatar_url;
    console.log('📸 Validação da foto:', {
      photoUrl: !!photoUrl,
      avatarUrl: !!authenticatedProfile?.avatar_url,
      hasPhoto
    });
    
    if (!hasPhoto) {
      newErrors.photo = 'Foto de perfil é obrigatória';
      console.log('❌ Erro: Foto de perfil é obrigatória');
    }
    
    setErrors(prev => ({ ...prev, ...newErrors }));
    const photoValid = Object.keys(newErrors).length === 0;
    const isValid = step1Valid && step2Valid && step3Valid && photoValid;
    
    console.log('📊 Resultado final da validação:', {
      step1Valid,
      step2Valid,
      step3Valid,
      photoValid,
      isValid
    });
    
    return isValid;
  };

  const validateStep1 = (): boolean => {
    console.log('🔍 Validando Etapa 1 - Dados Pessoais:', {
      full_name: formData.full_name,
      email: formData.email,
      cpf: formData.cpf,
      birth_date: formData.birth_date
    });
    
    const newErrors: FormErrors = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome completo é obrigatório';
      console.log('❌ Erro: Nome completo é obrigatório');
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Nome deve ter pelo menos 2 caracteres';
      console.log('❌ Erro: Nome deve ter pelo menos 2 caracteres');
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
      console.log('❌ Erro: Email é obrigatório');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato de email inválido';
      console.log('❌ Erro: Formato de email inválido');
    }

    if (!formData.cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
      console.log('❌ Erro: CPF é obrigatório');
    } else {
      const cpfNumbers = formData.cpf.replace(/\D/g, '');
      if (cpfNumbers.length !== 11) {
        newErrors.cpf = 'CPF deve ter 11 dígitos';
        console.log('❌ Erro: CPF deve ter 11 dígitos, atual:', cpfNumbers.length);
      }
    }

    if (!formData.birth_date) {
      newErrors.birth_date = 'Data de nascimento é obrigatória';
      console.log('❌ Erro: Data de nascimento é obrigatória');
    } else {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 16 || age > 120) {
        newErrors.birth_date = 'Idade deve estar entre 16 e 120 anos';
        console.log('❌ Erro: Idade deve estar entre 16 e 120 anos, atual:', age);
      }
    }
    
    console.log('📝 Erros da Etapa 1:', newErrors);
    setErrors(prev => ({ ...prev, ...newErrors }));
    const isValid = Object.keys(newErrors).length === 0;
    console.log('✅ Etapa 1 válida:', isValid);
    return isValid;
  };

  const validateStep2 = (): boolean => {
    console.log('🔍 Validando Etapa 2 - Endereço e Contato:', {
      address: formData.address,
      emergency_contact_name: formData.emergency_contact_name,
      emergency_contact_phone: formData.emergency_contact_phone
    });
    
    const newErrors: FormErrors = {};
    
    if (!formData.address.trim()) {
      newErrors.address = 'Endereço é obrigatório';
      console.log('❌ Erro: Endereço é obrigatório');
    }

    if (!formData.emergency_contact_name.trim()) {
      newErrors.emergency_contact_name = 'Nome do contato de emergência é obrigatório';
      console.log('❌ Erro: Nome do contato de emergência é obrigatório');
    }

    if (!formData.emergency_contact_phone.trim()) {
      newErrors.emergency_contact_phone = 'Telefone do contato de emergência é obrigatório';
      console.log('❌ Erro: Telefone do contato de emergência é obrigatório');
    } else if (!/^\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$/.test(formData.emergency_contact_phone.replace(/\D/g, ''))) {
      newErrors.emergency_contact_phone = 'Telefone de emergência inválido';
      console.log('❌ Erro: Telefone de emergência inválido, valor:', formData.emergency_contact_phone);
    }
    
    console.log('📝 Erros da Etapa 2:', newErrors);
    setErrors(prev => ({ ...prev, ...newErrors }));
    const isValid = Object.keys(newErrors).length === 0;
    console.log('✅ Etapa 2 válida:', isValid);
    return isValid;
  };

  const validateStep3 = (): boolean => {
    console.log('🔍 Validando Etapa 3 - Senhas:', {
      password: formData.password ? `[${formData.password.length} caracteres]` : 'vazio',
      confirmPassword: formData.confirmPassword ? `[${formData.confirmPassword.length} caracteres]` : 'vazio',
      passwordsMatch: formData.password === formData.confirmPassword
    });
    
    const newErrors: FormErrors = {};
    
    // Validação da senha
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
      console.log('❌ Erro: Senha é obrigatória');
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
      console.log('❌ Erro: Senha deve ter pelo menos 6 caracteres, atual:', formData.password.length);
    } else if (formData.password.length > 50) {
      newErrors.password = 'Senha deve ter no máximo 50 caracteres';
      console.log('❌ Erro: Senha deve ter no máximo 50 caracteres, atual:', formData.password.length);
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número';
      console.log('❌ Erro: Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número');
    }

    // Validação da confirmação de senha
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
      console.log('❌ Erro: Confirmação de senha é obrigatória');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
      console.log('❌ Erro: Senhas não coincidem');
    }
    
    console.log('📝 Erros da Etapa 3:', newErrors);
    setErrors(prev => ({ ...prev, ...newErrors }));
    const isValid = Object.keys(newErrors).length === 0;
    console.log('✅ Etapa 3 válida:', isValid);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🚀 handleSubmit chamado!');
    e.preventDefault();
    
    // Limpar erros anteriores
    setErrors({});
    
    console.log('📋 Dados do formulário:', formData);
    console.log('👤 Perfil autenticado:', authenticatedProfile);
    
    // Validação completa do formulário
    if (!validateForm()) {
      console.log('❌ Validação falhou');
      toast.error('Por favor, corrija os erros no formulário antes de continuar.');
      return;
    }
    
    if (!authenticatedProfile?.id) {
      console.log('❌ Perfil não encontrado');
      setErrors({ submit: 'Erro de autenticação. Tente fazer login novamente.' });
      return;
    }

    setIsSubmitting(true);
    toast.loading('Finalizando seu cadastro...', { id: 'submit-toast' });

    try {
      // Log do status da autenticação
      console.log('🔐 Status da autenticação:', {
        isAuthenticated,
        authenticatedProfile: authenticatedProfile,
        profileId: authenticatedProfile?.id
      });

      // Usar a URL da foto já carregada pelo componente PhotoUpload
      const avatarUrl = photoUrl || authenticatedProfile?.avatar_url;
      console.log('📸 URL da foto para salvar:', avatarUrl);

      // Preparar dados para a API
      const apiPayload = {
        profile_id: authenticatedProfile.id,
        full_name: formData.full_name,
        email: formData.email,
        cpf: formData.cpf,
        birth_date: formData.birth_date,
        address: formData.address,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        password: formData.password,
        avatar_url: avatarUrl
      };
      
      console.log('🌐 Chamando API complete-morador-profile:', {
        url: '/api/complete-morador-profile',
        method: 'POST',
        payload: {
          ...apiPayload,
          password: '[REDACTED]', // Não logar a senha
          cpf: formData.cpf ? '[REDACTED]' : null // Não logar o CPF completo
        }
      });
      
      // Chamar a API para completar o perfil e criar o usuário
      const response = await fetch('/api/complete-morador-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });
      
      console.log('📡 Resposta da API recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        // Cadastro concluído com sucesso - agora apagar a temporary_password
        try {
          const { error: deleteError } = await supabase
            .from('temporary_passwords')
            .delete()
            .eq('profile_id', authenticatedProfile.id);

          if (deleteError) {
            console.warn('⚠️ Aviso: Não foi possível apagar temporary_password:', deleteError);
          } else {
            console.log('🗑️ Temporary_password apagada com sucesso após cadastro completo');
          }
        } catch (tempPasswordError) {
          console.error('⚠️ Erro ao remover temporary password:', tempPasswordError);
          // Não bloquear o fluxo se houver erro na remoção da temporary password
        }
      } else {
        let errorData = {};
        let errorMessage = 'Erro ao completar cadastro';
        
        try {
          // Tentar parsear a resposta como JSON
          errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`;
        } catch (parseError) {
          // Se não conseguir parsear como JSON, usar informações da resposta HTTP
          console.error('❌ Erro ao parsear resposta de erro:', parseError);
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
          errorData = {
            status: response.status,
            statusText: response.statusText,
            url: response.url
          };
        }
        
        console.error('❌ Erro na API:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorData: errorData,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        toast.error(errorMessage, { id: 'submit-toast' });
        setErrors({ submit: errorMessage });
        return;
      }

      console.log('✅ Cadastro completado com sucesso!');
      toast.success('Cadastro finalizado com sucesso! Redirecionando...', { id: 'submit-toast' });
      
      // Aguardar um pouco para mostrar a mensagem de sucesso
      setTimeout(() => {
        router.push('/cadastro/morador/sucesso');
      }, 1500);
    } catch (error) {
      console.error('💥 Erro não tratado no handleSubmit:', {
        error: error,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        cause: error instanceof Error ? error.cause : undefined,
        timestamp: new Date().toISOString(),
        formData: {
          profile_id: authenticatedProfile?.id,
          full_name: formData.full_name,
          email: formData.email,
          // Não logar dados sensíveis como CPF e senha
          has_cpf: !!formData.cpf,
          has_password: !!formData.password
        }
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      let userFriendlyMessage;
      
      if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        userFriendlyMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage = 'Tempo limite excedido. Tente novamente.';
      } else if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        userFriendlyMessage = 'Erro na comunicação com o servidor. Tente novamente.';
      } else {
        userFriendlyMessage = 'Erro interno do sistema. Tente novamente em alguns instantes.';
      }
      
      toast.error(userFriendlyMessage, { id: 'submit-toast' });
      setErrors({ submit: userFriendlyMessage });
    } finally {
      setIsSubmitting(false);
    }
  };



  // Mostrar tela de autenticação se não estiver autenticado
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto bg-white rounded-xl shadow-md p-8 relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Acesso de Morador</h2>
            <p className="text-lg text-gray-600">Digite seu telefone e senha temporária para acessar o sistema e completar seu cadastro</p>
          </div>

          <form onSubmit={handleAuthentication} className="space-y-6">
            <div>
              <label htmlFor="authPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Número de Telefone
                {isSearchingByPhone && (
                  <span className="ml-2 text-blue-600 text-xs">
                    <div className="inline-flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
                      Buscando perfil...
                    </div>
                  </span>
                )}
                {phoneSearchSuccess && (
                  <span className="ml-2 text-green-600 text-xs">
                    <div className="inline-flex items-center">
                      <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Perfil encontrado!
                    </div>
                  </span>
                )}
                {!isSearchingByPhone && !phoneSearchSuccess && lastSearchEmpty && (
                  <span className="ml-2 text-yellow-600 text-xs">
                    <div className="inline-flex items-center">
                      <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.592c.75 1.335-.213 2.989-1.743 2.989H3.482c-1.53 0-2.493-1.654-1.743-2.989L8.257 3.1z" clipRule="evenodd" />
                      </svg>
                      Nenhum perfil ativo encontrado recentemente para este número. Aguarde alguns segundos e tente novamente.
                    </div>
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  id="authPhone"
                  type="tel"
                  value={authPhone}
                  onChange={(e) => {
                    const newPhone = formatAuthPhone(e.target.value);
                    setAuthPhone(newPhone);
                    // Reset estados quando o usuário digita
                    if (newPhone !== authPhone) {
                      setPhoneSearchSuccess(false);
                      setAuthError(null);
                      setProfileId(null);
                    }
                  }}
                  placeholder="(91) 98194-1219"
                  className={`w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    phoneSearchSuccess 
                      ? 'border-green-300 bg-green-50' 
                      : isSearchingByPhone 
                      ? 'border-blue-300 bg-blue-50' 
                      : authError
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  required
                />
                {/* Ícone de status no campo */}
                {isSearchingByPhone && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
                  </div>
                )}
                {phoneSearchSuccess && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="authPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Senha Temporária (6 dígitos)
              </label>
              <div className="relative">
                <input
                  id="authPassword"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className={`w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-center text-lg tracking-widest ${
                    authError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  maxLength={6}
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-700 text-sm">{authError}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating || !authPhone || !authPassword || !phoneSearchSuccess || isSearchingByPhone}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition-colors duration-200"
            >
              {isAuthenticating || isSearchingByPhone ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white"></div>
                </div>
              ) : !phoneSearchSuccess ? (
                <div className="flex items-center justify-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Aguardando perfil...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Entrar no Sistema
                </div>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Não recebeu a senha? Verifique seu WhatsApp ou entre em contato com a administração.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderizar o formulário principal após autenticação

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-indigo-400/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity duration-200">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">JAMES AVISA</h1>
                <p className="text-gray-600 text-sm">Sistema de Portaria Inteligente</p>
              </div>
            </Link>
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <p className="text-lg font-semibold text-gray-900">Cadastro de Morador</p>
                <p className="text-gray-600 text-sm">Complete seu perfil</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative py-12">
        <div className="max-w-2xl mx-auto px-4">
          {/* Progress Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg font-medium text-sm shadow-md">
              <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              Etapa 2 de 2 - Complete seu perfil
            </div>
            <p className="text-gray-600 mt-4 text-lg">Você está quase terminando! Preencha os dados abaixo para finalizar seu cadastro.</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Complete seu Perfil
              </h2>
              <p className="text-lg text-gray-600 max-w-lg mx-auto">
                Adicione sua foto e informações pessoais para finalizar o cadastro no sistema
              </p>
            </div>



            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => goToStep(step)}
                    disabled={step > currentStep && !completedSteps.has(step - 1)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 ${
                      step === currentStep
                        ? 'bg-blue-600 text-white shadow-lg'
                        : step < currentStep || completedSteps.has(step)
                        ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {step < currentStep || completedSteps.has(step) ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      step
                    )}
                  </button>
                  {step < totalSteps && (
                    <div className={`w-16 h-1 mx-2 rounded-full transition-all duration-200 ${
                      step < currentStep || completedSteps.has(step) ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Step 1: Dados Pessoais */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Dados Pessoais</h2>
                    <p className="text-gray-600">Vamos começar com suas informações básicas</p>
                  </div>

                  {/* Foto de Perfil */}
                  <div className="flex flex-col items-center space-y-4 mb-8">
                    <PhotoUpload
                      onPhotoUpload={handlePhotoUpload}
                      onPhotoRemove={handlePhotoRemove}
                      initialPhotoUrl={photoUrl}
                      userId={authenticatedProfile?.id || 'temp'}
                      onUploadingChange={setUploadingPhoto}
                    />
                    {errors.photo && (
                      <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.photo}</p>
                    )}
                  </div>

                  {/* Campos de Dados Pessoais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700 mb-2">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        id="full_name"
                        name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 focus:border-blue-500 transition-colors duration-200 ${
                          errors.full_name ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="Digite seu nome completo"
                      />
                      {errors.full_name && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.full_name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 focus:border-blue-500 transition-colors duration-200 ${
                          errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="seu@email.com"
                      />
                      {errors.email && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="cpf" className="block text-sm font-semibold text-gray-700 mb-2">
                        CPF *
                      </label>
                      <input
                        type="text"
                        id="cpf"
                        name="cpf"
                        value={formData.cpf}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 focus:border-blue-500 transition-colors duration-200 ${
                          errors.cpf ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="000.000.000-00"
                      />
                      {errors.cpf && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.cpf}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="birth_date" className="block text-sm font-semibold text-gray-700 mb-2">
                        Data de Nascimento *
                      </label>
                      <input
                        type="date"
                        id="birth_date"
                        name="birth_date"
                        value={formData.birth_date}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 focus:border-blue-500 transition-colors duration-200 ${
                          errors.birth_date ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      />
                      {errors.birth_date && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.birth_date}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Endereço e Contatos */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Endereço &amp; Contatos</h2>
                    <p className="text-gray-600">Informações de localização e emergência</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                        Endereço Completo *
                      </label>
                      <textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleTextareaChange}
                        rows={3}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-500 focus:border-blue-500 transition-all duration-200 resize-none ${
                          errors.address ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="Rua, número, complemento, bairro, cidade - UF"
                      />
                      {errors.address && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.address}</p>
                      )}
                    </div>

                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                      <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Contato de Emergência
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="emergency_contact_name" className="block text-sm font-semibold text-gray-700 mb-2">
                            Nome do Contato *
                          </label>
                          <input
                            type="text"
                            id="emergency_contact_name"
                            name="emergency_contact_name"
                            value={formData.emergency_contact_name}
                            onChange={handleInputChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-500 focus:border-blue-500 transition-all duration-200 ${
                              errors.emergency_contact_name ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            placeholder="Nome completo"
                          />
                          {errors.emergency_contact_name && (
                            <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.emergency_contact_name}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="emergency_contact_phone" className="block text-sm font-semibold text-gray-700 mb-2">
                            Telefone do Contato *
                          </label>
                          <input
                            type="tel"
                            id="emergency_contact_phone"
                            name="emergency_contact_phone"
                            value={formData.emergency_contact_phone}
                            onChange={handleEmergencyPhoneChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-500 focus:border-blue-500 transition-all duration-200 ${
                              errors.emergency_contact_phone ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            placeholder="(00) 00000-0000"
                          />
                          {errors.emergency_contact_phone && (
                            <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.emergency_contact_phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Senha */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Definir Senha</h2>
                    <p className="text-gray-600">Crie uma senha segura para sua conta</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                        Nova Senha *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 focus:border-blue-500 transition-colors duration-200 ${
                            errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          placeholder="Digite sua nova senha"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.password}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirmar Nova Senha *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 focus:border-blue-500 transition-colors duration-200 ${
                            errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          placeholder="Confirme sua nova senha"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                          {showConfirmPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.confirmPassword}</p>
                      )}
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-start">
                        <svg className="w-4 h-4 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-medium text-green-900 mb-1">Quase pronto!</h4>
                          <p className="text-sm text-green-700">
                            Após definir sua senha, você terá acesso completo ao sistema e poderá gerenciar todas as funcionalidades disponíveis.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-600">{errors.submit}</p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-8 border-t border-gray-200">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className={`group px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${
                    currentStep === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Anterior
                  </div>
                </button>

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="group px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      Próximo
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || uploadingPhoto}
                    className="group px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    {isSubmitting || uploadingPhoto ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Finalizar Cadastro
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </form>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-blue-900 text-sm">Quase pronto!</p>
                  <p className="text-blue-700 text-sm">
                    Após finalizar o cadastro, você receberá uma confirmação e poderá fazer login no sistema com suas novas credenciais.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Image 
              src="/logo-james.png" 
              alt="Logo JAMES AVISA" 
              width={32} 
              height={32}
              className="h-8 w-auto bg-white rounded-full p-1"
            />
            <h4 className="text-xl font-bold text-white">JAMES AVISA</h4>
          </div>
          <p className="text-gray-400 text-sm">
            © 2025 JAMES AVISA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}