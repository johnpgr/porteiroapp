'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from 'lucide-react';

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
  
  // Buscar perfil por telefone com debounce
  useEffect(() => {
    if (phone.replace(/\D/g, '').length === 11) {
      const timeoutId = setTimeout(async () => {
        setIsSearching(true);
        try {
          // Buscar na tabela visitor_temporary_passwords
          const phoneNumbers = phone.replace(/\D/g, '');
          const last11Digits = phoneNumbers.slice(-11);
          
          const { data, error } = await supabase
            .from('visitor_temporary_passwords')
            .select('visitor_id, visitor_phone, visitor_name, hashed_password, plain_password')
            .eq('used', false)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString())
            .ilike('visitor_phone', `%${last11Digits}`);
          
          if (data && data.length > 0 && !error) {
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
            setProfileFound(false);
            setProfileData({});
          }
        } catch (err) {
          console.error('Erro ao buscar perfil:', err);
          setProfileFound(false);
        } finally {
          setIsSearching(false);
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      setProfileFound(false);
      setProfileData({});
    }
  }, [phone]);
  
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
      console.error('Erro no upload:', err);
      setError('Erro ao fazer upload da foto');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Função de submissão final
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Iniciando submissão do formulário...');
    console.log('Dados do formulário:', formData);
    console.log('Dados do perfil:', profileData);
    
    if (!validateForm()) {
      console.log('Validação do formulário falhou');
      return;
    }
    
    setIsSubmitting(true);
    setError(''); // Limpar erros anteriores
    
    try {
      if (!profileData.id) {
        throw new Error('ID do visitante não encontrado');
      }
      
      console.log('Atualizando perfil do visitante com ID:', profileData.id);
      
      // Atualizar perfil do visitante com CPF e foto
      const updateData = {
          document: formData.document.replace(/\D/g, ''), // Salvar apenas números
          photo_url: profileData.photo_url,
          status: 'aprovado',
          updated_at: new Date().toISOString()
        };
      
      console.log('Dados para atualização:', updateData);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('visitors')
        .update(updateData)
        .eq('id', profileData.id)
        .select();
      
      if (updateError) {
        console.error('Erro na atualização do visitante:', updateError);
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }
      
      console.log('Perfil atualizado com sucesso:', updateResult);
      
      // Marcar a senha temporária como usada
      console.log('Marcando senha temporária como usada...');
      const { error: passwordError } = await supabase
        .from('visitor_temporary_passwords')
        .update({
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('visitor_id', profileData.id)
        .eq('used', false);
      
      if (passwordError) {
        console.warn('Erro ao marcar senha como usada:', passwordError.message);
      } else {
        console.log('Senha temporária marcada como usada com sucesso');
      }
      
      console.log('Redirecionando para página de sucesso...');
      // Redirecionar para página de sucesso
      router.push('/cadastro/sucesso?tipo=visitante');
    } catch (err: any) {
      console.error('Erro detalhado ao finalizar cadastro:');
      console.error('Tipo do erro:', typeof err);
      console.error('Mensagem do erro:', err?.message || 'Erro desconhecido');
      console.error('Stack do erro:', err?.stack);
      console.error('Objeto completo do erro:', JSON.stringify(err, null, 2));
      
      const errorMessage = err?.message || 'Erro desconhecido ao finalizar cadastro';
      setError(`Erro ao finalizar cadastro: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">J</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">JAMES AVISA</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-md mx-auto px-4 py-6">
        {!isAuthenticated ? (
          /* Tela de Login */
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Complete seu Cadastro
              </h2>
              <p className="text-gray-600">
                Digite seu telefone e senha temporária
              </p>
            </div>

            {isSearching && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-blue-800 text-sm">Buscando perfil...</p>
                </div>
              </div>
            )}

            {profileFound && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-800 text-sm">✓ Perfil encontrado! Faça login para continuar.</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha Temporária
                </label>
                <input
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite a senha temporária"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Formulário Principal Simplificado */
          <div className="space-y-6">
            {/* Formulário Simples */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Complete seu Cadastro
                </h2>
                <p className="text-gray-600">
                  Adicione seu CPF e foto para finalizar
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Upload de Foto */}
                <div className="text-center">
                  <div className="mb-4">
                    {profileData.photo_url ? (
                      <img
                        src={profileData.photo_url}
                        alt="Foto do perfil"
                        className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-gray-200"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                        <User className="w-12 h-12 text-gray-400" />
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
                    className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    {isUploading ? 'Enviando...' : profileData.photo_url ? 'Alterar foto' : 'Adicionar foto *'}
                  </button>
                  {errors.photo && (
                    <p className="text-red-600 text-sm mt-2">{errors.photo}</p>
                  )}
                </div>

                {/* Campo CPF */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF *
                  </label>
                  <input
                    type="text"
                    name="document"
                    value={formData.document}
                    onChange={handleCPFChange}
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg ${
                      errors.document ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {errors.document && (
                    <p className="text-red-600 text-sm mt-1">{errors.document}</p>
                  )}
                  <p className="text-gray-600 text-sm mt-2">
                    O CPF é obrigatório para garantir a segurança e identificação no condomínio.
                  </p>
                </div>

                {/* Botão de Submissão */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        <span>Finalizando...</span>
                      </>
                    ) : isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        <span>Enviando foto...</span>
                      </>
                    ) : (
                      <span>Finalizar Cadastro</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Informações de Segurança */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm text-center">
                Seus dados são protegidos e utilizados apenas para identificação no condomínio.
              </p>
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
    </div>
  );
}