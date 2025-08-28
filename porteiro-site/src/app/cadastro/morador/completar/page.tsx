'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface ProfileData {
  birth_date: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function CompletarCadastroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profile_id');
  
  const [profileData, setProfileData] = useState<ProfileData>({
    birth_date: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!profileId) {
      router.push('/cadastro/morador');
    }
  }, [profileId, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    
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

  const handleEmergencyPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setProfileData(prev => ({ ...prev, emergency_contact_phone: formatted }));
    if (errors.emergency_contact_phone) {
      setErrors(prev => ({ ...prev, emergency_contact_phone: '' }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, photo: 'Por favor, selecione apenas arquivos de imagem' }));
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, photo: 'A imagem deve ter no máximo 5MB' }));
        return;
      }
      
      setSelectedFile(file);
      setErrors(prev => ({ ...prev, photo: '' }));
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!selectedFile || !profileId) return null;
    
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('profile_id', profileId);
    
    try {
      const response = await fetch('/api/upload-profile-photo', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.avatar_url;
      } else {
        const errorData = await response.json();
        setErrors(prev => ({ ...prev, photo: errorData.message || 'Erro ao fazer upload da foto' }));
        return null;
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, photo: 'Erro de conexão ao fazer upload da foto' }));
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!profileData.birth_date) {
      newErrors.birth_date = 'Data de nascimento é obrigatória';
    } else {
      const birthDate = new Date(profileData.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 16 || age > 120) {
        newErrors.birth_date = 'Idade deve estar entre 16 e 120 anos';
      }
    }

    if (!profileData.address.trim()) {
      newErrors.address = 'Endereço é obrigatório';
    }

    if (!profileData.emergency_contact_name.trim()) {
      newErrors.emergency_contact_name = 'Nome do contato de emergência é obrigatório';
    }

    if (!profileData.emergency_contact_phone.trim()) {
      newErrors.emergency_contact_phone = 'Telefone do contato de emergência é obrigatório';
    } else if (!/^\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$/.test(profileData.emergency_contact_phone.replace(/\D/g, ''))) {
      newErrors.emergency_contact_phone = 'Telefone de emergência inválido';
    }

    if (!profileData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (profileData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!profileData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (profileData.password !== profileData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !profileId) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photo first if selected
      let avatarUrl = null;
      if (selectedFile) {
        avatarUrl = await uploadPhoto();
        if (selectedFile && !avatarUrl) {
          // Photo upload failed, don't continue
          setIsSubmitting(false);
          return;
        }
      }

      // Complete profile
      const response = await fetch('/api/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: profileId,
          birth_date: profileData.birth_date,
          address: profileData.address,
          emergency_contact_name: profileData.emergency_contact_name,
          emergency_contact_phone: profileData.emergency_contact_phone.replace(/\D/g, ''),
          password: profileData.password,
          avatar_url: avatarUrl
        }),
      });

      if (response.ok) {
        router.push('/cadastro/morador/sucesso');
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.message || 'Erro ao completar cadastro' });
      }
    } catch (error) {
      setErrors({ submit: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profileId) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <Image 
                src="/logo-james.png" 
                alt="Logo JAMES AVISA" 
                width={40} 
                height={40}
                className="h-10 w-auto"
              />
              <h1 className="text-2xl font-bold text-gray-900">JAMES AVISA</h1>
            </Link>
            <Link 
              href="/login" 
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Fazer Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12">
        <div className="max-w-2xl mx-auto px-4">
          {/* Progress Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-medium text-sm border border-blue-200">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Etapa 2 de 2 - Complete seu perfil
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Complete seu Perfil
              </h2>
              <p className="text-lg text-gray-600">
                Adicione sua foto e informações pessoais para finalizar o cadastro
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Upload */}
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Foto do Perfil (Opcional)
                </label>
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mb-4 overflow-hidden">
                    {previewUrl ? (
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="file"
                    id="photo"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="photo"
                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {selectedFile ? 'Alterar Foto' : 'Selecionar Foto'}
                  </label>
                  {errors.photo && (
                    <p className="mt-2 text-sm text-red-600">{errors.photo}</p>
                  )}
                </div>
              </div>

              {/* Data de Nascimento */}
              <div>
                <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  id="birth_date"
                  name="birth_date"
                  value={profileData.birth_date}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.birth_date ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                />
                {errors.birth_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.birth_date}</p>
                )}
              </div>

              {/* Endereço */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço Completo *
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={profileData.address}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.address ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                )}
              </div>

              {/* Contato de Emergência - Nome */}
              <div>
                <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Contato de Emergência *
                </label>
                <input
                  type="text"
                  id="emergency_contact_name"
                  name="emergency_contact_name"
                  value={profileData.emergency_contact_name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.emergency_contact_name ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Nome completo do contato"
                />
                {errors.emergency_contact_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.emergency_contact_name}</p>
                )}
              </div>

              {/* Contato de Emergência - Telefone */}
              <div>
                <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone do Contato de Emergência *
                </label>
                <input
                  type="tel"
                  id="emergency_contact_phone"
                  name="emergency_contact_phone"
                  value={profileData.emergency_contact_phone}
                  onChange={handleEmergencyPhoneChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.emergency_contact_phone ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
                {errors.emergency_contact_phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.emergency_contact_phone}</p>
                )}
              </div>

              {/* Nova Senha */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Senha *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={profileData.password}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.password ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {/* Confirmar Senha */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Nova Senha *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={profileData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.confirmPassword ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Digite a senha novamente"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || uploadingPhoto}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
              >
                {isSubmitting || uploadingPhoto ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {uploadingPhoto ? 'Enviando foto...' : 'Finalizando cadastro...'}
                  </>
                ) : (
                  'Finalizar Cadastro'
                )}
              </button>
            </form>

            {/* Info Box */}
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="text-lg mr-3">✅</div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Quase pronto!</p>
                  <p className="text-gray-600 text-sm">
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