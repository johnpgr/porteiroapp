'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Phone, Lock, Shield, CheckCircle, AlertCircle, Camera, FileText, ArrowRight, Loader2, Bug, X } from 'lucide-react';

interface FormData {
  document: string;
}

interface FormErrors {
  document?: string;
  photo?: string;
}

interface ProfileData {
  id?: string;
  phone?: string;
  full_name?: string;
  photo_url?: string;
  hashed_password?: string;
  plain_password?: string;
}

export default function CompleteVisitorRegistration() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados de autenticação
  const [phone, setPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados de busca de perfil
  const [isSearching, setIsSearching] = useState(false);
  const [profileFound, setProfileFound] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({});
  
  // Estados do formulário simplificado
  const [formData, setFormData] = useState<FormData>({
    document: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Estados do debug
  const [showDebug, setShowDebug] = useState(false);
  
  // Controle para evitar buscas repetidas em loop para o mesmo telefone
  const lastSearchedPhoneRef = useRef<string>('');
  const lastSearchResultEmptyRef = useRef<boolean>(false);
  const lastSearchAtRef = useRef<number>(0);
  
  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };
  
  // Função para formatar CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };
  
  // Função para validar CPF
  const validateCPF = (cpf: string) => {
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let digit1 = 11 - (sum % 11);
    if (digit1 > 9) digit1 = 0;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    let digit2 = 11 - (sum % 11);
    if (digit2 > 9) digit2 = 0;
    
    return parseInt(numbers[9]) === digit1 && parseInt(numbers[10]) === digit2;
  };
  
  // Função para validar formulário
  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    // Validação do CPF
    if (!formData.document.trim()) {
      newErrors.document = 'CPF é obrigatório para garantir a segurança do local';
    } else if (!validateCPF(formData.document)) {
      newErrors.document = 'CPF inválido';
    }
    
    // Validação da foto
    if (!profileData.photo_url) {
      newErrors.photo = 'Foto é obrigatória';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Buscar perfil por telefone com debounce e timeout de segurança
  useEffect(() => {
    // Reset imediato dos estados quando telefone muda
    if (phone.replace(/\D/g, '').length < 10) {
      setProfileFound(false);
      setProfileData({});
      setIsSearching(false);
      setError('');
      return;
    }

    // Não buscar se já está autenticado ou carregando
    if (isAuthenticated || isLoading) {
      return;
    }

    // Debounce para busca
    const searchTimeout = setTimeout(async () => {
      // Verificar se ainda é necessário buscar
      const currentCleanPhone = phone.replace(/\D/g, '');
      if (currentCleanPhone.length < 10 || isAuthenticated) {
        return;
      }

      // Evitar re-buscar continuamente o mesmo número que acabou de retornar vazio
      const COOLDOWN_MS = 30000; // 30s sem reconsultar se não encontrou
      if (lastSearchedPhoneRef.current === currentCleanPhone) {
        if (lastSearchResultEmptyRef.current && Date.now() - lastSearchAtRef.current < COOLDOWN_MS) {
          return; // ainda no cooldown, evita loop
        }
      }

      // Registrar tentativa de busca para este telefone
      lastSearchedPhoneRef.current = currentCleanPhone;

      setIsSearching(true);
      setError('');
      setProfileFound(false);
      setProfileData({});
      
      try {
        // Query otimizada: buscar diretamente por telefone usando índice
        const phoneVariations = [
          currentCleanPhone,
          currentCleanPhone.slice(-11), // Últimos 11 dígitos (com DDD)
          currentCleanPhone.slice(-10)  // Últimos 10 dígitos (sem DDD)
        ].filter(v => v.length >= 10);
        
        console.log('🔍 [DEBUG] Buscando perfil:', {
          cleanPhone: currentCleanPhone,
          phoneVariations,
          table: 'visitor_temporary_passwords'
        });
        
        const { data, error } = await supabase
          .from('visitor_temporary_passwords')
          .select('visitor_id, visitor_phone, visitor_name, hashed_password, plain_password, expires_at, used, status')
          .eq('used', false)
          .eq('status', 'active')
          .gte('expires_at', new Date().toISOString())
          .or(phoneVariations.map(variation => `visitor_phone.eq.${variation}`).join(','))
          .limit(1);
          
        console.log('📊 [DEBUG] Resultado da consulta:', {
          data: data?.length || 0,
          error: error?.message || null,
          records: data
        });
        
        if (error) {
          throw new Error(`Erro na busca: ${error.message}`);
        }
        
        // Atualiza carimbo da última busca
        lastSearchAtRef.current = Date.now();

        if (data && data.length > 0) {
          lastSearchResultEmptyRef.current = false;
          const profile = data[0];
          setProfileFound(true);
          setProfileData({
            id: profile.visitor_id,
            phone: profile.visitor_phone,
            full_name: profile.visitor_name,
            hashed_password: profile.hashed_password,
            plain_password: profile.plain_password
          });
        } else {
          lastSearchResultEmptyRef.current = true;
          setProfileFound(false);
          setProfileData({});
        }
      } catch (err: any) {
        console.error('❌ [DEBUG] Erro na busca:', err);
        lastSearchResultEmptyRef.current = true;
        lastSearchAtRef.current = Date.now();
        setProfileFound(false);
        setProfileData({});
        const errorMessage = err?.message || 'Erro ao buscar perfil. Tente novamente.';
        setError(errorMessage);
      } finally {
        console.log('🔄 [DEBUG] Resetando isSearching para false');
        setIsSearching(false);
      }
    }, 1500);
    
    return () => {
      clearTimeout(searchTimeout);
    };
  }, [phone, isAuthenticated, isLoading]);
  
  // Função de login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (!profileFound) {
        throw new Error('Perfil não encontrado. Verifique o telefone.');
      }
      
      // Verificar senha temporária usando a senha da tabela visitor_temporary_passwords
      if (!profileData.plain_password || tempPassword !== profileData.plain_password) {
        throw new Error('Senha temporária inválida.');
      }
      
      // Inicializar formulário vazio
      setFormData({
        document: ''
      });
      
      // Opcional: recuperar informações completas do visitante com visitor_id
      if (profileData.id) {
        const { data: visitorRecord } = await supabase
          .from('visitors')
          .select('id, full_name, phone, document, photo_url')
          .eq('id', profileData.id)
          .single();
        if (visitorRecord) {
          setProfileData(prev => ({
            ...prev,
            full_name: visitorRecord.full_name ?? prev.full_name,
            phone: visitorRecord.phone ?? prev.phone,
            photo_url: visitorRecord.photo_url ?? prev.photo_url
          }));
          if (visitorRecord.document) {
            // Preencher CPF formatado, se existir
            const onlyNums = String(visitorRecord.document).replace(/\D/g, '');
            const formatted = onlyNums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            setFormData({ document: formatted });
          }
        }
      }
      
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para lidar com mudanças no CPF
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const formattedValue = formatCPF(value);
    
    setFormData(prev => ({
      ...prev,
      document: formattedValue
    }));
    
    // Limpar erro do CPF quando usuário começar a digitar
    if (errors.document) {
      setErrors(prev => ({
        ...prev,
        document: undefined
      }));
    }
  };
  
  // Função para upload de foto
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `visitors/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('user-photos')
        .getPublicUrl(filePath);
      
      setProfileData(prev => ({
        ...prev,
        photo_url: publicUrl
      }));
    } catch (err: any) {
      setError('Erro ao fazer upload da foto');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Função de submissão final
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setError(''); // Limpar erros anteriores
    
    try {
      if (!profileData.id) {
        throw new Error('ID do visitante não encontrado');
      }
      
      // Atualizando perfil do visitante
      
      // Atualizar perfil do visitante com CPF e foto
      const updateData = {
          document: formData.document.replace(/\D/g, ''), // Salvar apenas números
          photo_url: profileData.photo_url,
          status: 'aprovado',
          updated_at: new Date().toISOString()
        };
      
      // Preparando dados para atualização
      
      const { data: updateResult, error: updateError } = await supabase
        .from('visitors')
        .update(updateData)
        .eq('id', profileData.id)
        .select();
      
      if (updateError) {
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }
      
      // Marcar a senha temporária como usada
      const { error: passwordError } = await supabase
        .from('visitor_temporary_passwords')
        .update({
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('visitor_id', profileData.id)
        .eq('used', false);
      
      if (passwordError) {
        // Aviso: erro ao marcar senha como usada
      }
      // Redirecionar para página de sucesso
      router.push('/cadastro/sucesso?tipo=visitante');
    } catch (err: any) {
      const errorMessage = err?.message || 'Erro desconhecido ao finalizar cadastro';
      setError(`Erro ao finalizar cadastro: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Conteúdo Principal */}
      <div className="max-w-md mx-auto pt-24 px-6 py-8">
        {!isAuthenticated ? (
          /* Tela de Login */
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 relative overflow-hidden">
            {/* Enhanced decorative background */}
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-50 via-purple-50 to-transparent rounded-full -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-50 via-indigo-50 to-transparent rounded-full translate-y-16 -translate-x-16"></div>
              <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-gradient-to-br from-purple-50 to-transparent rounded-full -translate-x-12 -translate-y-12 opacity-60"></div>
            </div>
            
            <div className="relative p-8">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl transform hover:scale-105 transition-transform duration-200">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                  Acesso de Visitante
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed">
                  Digite seu telefone e senha temporária para acessar o sistema e completar seu cadastro
                </p>
              </div>

              {isSearching && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-6 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <p className="text-blue-800 font-medium">Buscando seu perfil...</p>
                  </div>
                </div>
              )}

              {profileFound && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mb-6 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-green-800 font-medium">Perfil encontrado! Faça login para continuar.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    <span>Número de Telefone</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const newPhone = formatPhone(e.target.value);
                        if (newPhone !== phone) {
                          setPhone(newPhone);
                          // Reset completo dos estados relacionados à busca
                          setProfileFound(false);
                          setError('');
                          setProfileData({});
                          setIsSearching(false);
                        }
                      }}
                      className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200 text-gray-900 text-lg font-medium placeholder-gray-400 ${
                        error ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      required
                    />
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    <span>Senha Temporária</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200 text-lg font-medium placeholder-gray-400 hover:border-gray-300"
                      placeholder="Digite sua senha temporária"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {error && (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-red-700 font-medium">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !profileFound || isSearching || !phone.trim() || !tempPassword.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white py-4 px-6 rounded-2xl hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 disabled:transform-none"
                >
                  {(isLoading || isSearching) ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <span>Acessar Sistema</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Formulário Principal Aprimorado */
          <div className="space-y-8">
            {/* Badge de Progresso Melhorado */}
            <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
              {/* Decorative background */}
              <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
              </div>
              
              <div className="relative">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-bold text-lg tracking-wide">Etapa Final</span>
                </div>
                <p className="text-green-100 font-medium">Quase pronto! Complete os dados abaixo para finalizar</p>
              </div>
            </div>
            
            {/* Formulário Aprimorado */}
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 relative overflow-hidden">
              {/* Enhanced decorative elements */}
              <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-50 via-green-50 to-transparent rounded-full -translate-y-24 translate-x-24"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-50 via-indigo-50 to-transparent rounded-full translate-y-20 -translate-x-20"></div>
                <div className="absolute top-1/3 left-1/3 w-32 h-32 bg-gradient-to-br from-purple-50 to-transparent rounded-full -translate-x-16 -translate-y-16 opacity-40"></div>
              </div>
              
              <div className="relative p-8">
                <div className="text-center mb-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl transform hover:scale-105 transition-transform duration-200">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                    Finalizar Cadastro
                  </h2>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    Adicione seu CPF e foto para completar o processo de identificação
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Upload de Foto Aprimorado */}
                  <div className="text-center">
                    <div className="mb-6">
                      {profileData.photo_url ? (
                        <div className="relative inline-block">
                          <img
                            src={profileData.photo_url}
                            alt="Foto do perfil"
                            className="w-40 h-40 rounded-full mx-auto object-cover border-4 border-white shadow-2xl"
                          />
                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent"></div>
                        </div>
                      ) : (
                        <div className="w-40 h-40 rounded-full mx-auto bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-4 border-white shadow-2xl">
                          <Camera className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-2xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:transform-none"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          <span>{profileData.photo_url ? 'Alterar Foto' : 'Adicionar Foto *'}</span>
                        </>
                      )}
                    </button>
                    {errors.photo && (
                      <div className="mt-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-3">
                        <p className="text-red-600 font-medium text-sm">{errors.photo}</p>
                      </div>
                    )}
                  </div>

                  {/* Campo CPF Aprimorado */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span>Documento CPF *</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="document"
                        value={formData.document}
                        onChange={handleCPFChange}
                        className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 text-lg font-medium placeholder-gray-400 ${
                          errors.document ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                      <FileText className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    {errors.document && (
                      <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-3 mt-3">
                        <p className="text-red-600 font-medium text-sm">{errors.document}</p>
                      </div>
                    )}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mt-4">
                      <div className="flex items-start space-x-3">
                        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-blue-800 text-sm font-medium leading-relaxed">
                          O CPF é obrigatório para garantir a segurança e identificação no condomínio.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Submissão Aprimorado */}
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={isSubmitting || isUploading}
                      className="w-full bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white py-4 px-6 rounded-2xl hover:from-emerald-700 hover:via-green-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 disabled:transform-none"
                    >
                      {(isSubmitting || isUploading) ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <span>Finalizar Cadastro</span>
                          <CheckCircle className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Informações de Segurança Aprimoradas */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-center space-x-3">
                <Shield className="w-6 h-6 text-blue-600" />
                <p className="text-blue-800 font-semibold text-center">
                  Seus dados são protegidos e utilizados apenas para identificação no condomínio.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="text-center text-gray-500 text-sm">
          <p>© 2024 James Avisa. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Botão Flutuante de Debug */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center group relative overflow-hidden"
          title="Ferramentas de Debug"
        >
          {/* Background decorativo */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
          
          {/* Ícone */}
          <div className="relative z-10">
            {showDebug ? (
              <X className="w-6 h-6 transform rotate-0 group-hover:rotate-90 transition-transform duration-300" />
            ) : (
              <Bug className="w-6 h-6 transform group-hover:rotate-12 transition-transform duration-300" />
            )}
          </div>
          
          {/* Pulse effect */}
          <div className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-20"></div>
        </button>

        {/* Painel de Debug */}
        {showDebug && (
          <div className="absolute bottom-16 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform transition-all duration-300 animate-in slide-in-from-bottom-2">
            {/* Header do painel */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bug className="w-5 h-5" />
                  <h3 className="font-bold text-sm">Debug Info</h3>
                </div>
                <button
                  onClick={() => setShowDebug(false)}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conteúdo do painel */}
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {/* Estado de Autenticação */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-700 mb-2 uppercase tracking-wide">Autenticação</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                        {isAuthenticated ? 'Autenticado' : 'Não Autenticado'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Telefone:</span>
                      <span className="font-mono text-gray-800">{phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Perfil Encontrado:</span>
                      <span className={`font-medium ${profileFound ? 'text-green-600' : 'text-red-600'}`}>
                        {profileFound ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dados do Perfil */}
                {profileData && Object.keys(profileData).length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h4 className="font-semibold text-xs text-gray-700 mb-2 uppercase tracking-wide">Dados do Perfil</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID:</span>
                        <span className="font-mono text-gray-800">{profileData.id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nome:</span>
                        <span className="font-medium text-gray-800 truncate ml-2">{profileData.full_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Foto:</span>
                        <span className={`font-medium ${profileData.photo_url ? 'text-green-600' : 'text-red-600'}`}>
                          {profileData.photo_url ? 'Carregada' : 'Não Carregada'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Estados de Loading */}
                <div className="bg-yellow-50 rounded-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-700 mb-2 uppercase tracking-wide">Estados de Loading</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Buscando:</span>
                      <span className={`font-medium ${isSearching ? 'text-orange-600' : 'text-gray-400'}`}>
                        {isSearching ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Carregando:</span>
                      <span className={`font-medium ${isLoading ? 'text-orange-600' : 'text-gray-400'}`}>
                        {isLoading ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Enviando:</span>
                      <span className={`font-medium ${isSubmitting ? 'text-orange-600' : 'text-gray-400'}`}>
                        {isSubmitting ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Upload:</span>
                      <span className={`font-medium ${isUploading ? 'text-orange-600' : 'text-gray-400'}`}>
                        {isUploading ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dados do Formulário */}
                {isAuthenticated && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <h4 className="font-semibold text-xs text-gray-700 mb-2 uppercase tracking-wide">Formulário</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">CPF:</span>
                        <span className="font-mono text-gray-800">{formData.document || 'Vazio'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Erros:</span>
                        <span className={`font-medium ${Object.keys(errors).length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {Object.keys(errors).length > 0 ? Object.keys(errors).join(', ') : 'Nenhum'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensagens de Erro */}
                {error && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <h4 className="font-semibold text-xs text-gray-700 mb-2 uppercase tracking-wide">Erro Atual</h4>
                    <p className="text-xs text-red-600 font-medium break-words">{error}</p>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-700 mb-2 uppercase tracking-wide">Ações de Debug</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        console.log('=== DEBUG INFO ===');
                        console.log('Authenticated:', isAuthenticated);
                        console.log('Phone:', phone);
                        console.log('Profile Found:', profileFound);
                        console.log('Profile Data:', profileData);
                        console.log('Form Data:', formData);
                        console.log('Errors:', errors);
                        console.log('Loading States:', { isSearching, isLoading, isSubmitting, isUploading });
                        console.log('Current Error:', error);
                        console.log('==================');
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 px-3 rounded-lg transition-colors duration-200 font-medium"
                    >
                      Log no Console
                    </button>
                    <button
                      onClick={() => {
                        setError('');
                        setErrors({});
                      }}
                      className="w-full bg-green-500 hover:bg-green-600 text-white text-xs py-2 px-3 rounded-lg transition-colors duration-200 font-medium"
                    >
                      Limpar Erros
                    </button>
                    <button
                      onClick={() => {
                        setPhone('');
                        setTempPassword('');
                        setIsAuthenticated(false);
                        setProfileFound(false);
                        setProfileData({});
                        setFormData({ document: '' });
                        setError('');
                        setErrors({});
                      }}
                      className="w-full bg-red-500 hover:bg-red-600 text-white text-xs py-2 px-3 rounded-lg transition-colors duration-200 font-medium"
                    >
                      Reset Completo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}