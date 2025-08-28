'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MoradorForm from '@/components/MoradorForm';
import LoadingSpinner from '@/components/LoadingSpinner';

interface QueryParams {
  name?: string;
  phone?: string;
  building?: string;
  apartment?: string;
}

export default function MoradorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [queryParams, setQueryParams] = useState<QueryParams>({});
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Extrair parâmetros de consulta
    const params: QueryParams = {
      name: searchParams.get('name') || undefined,
      phone: searchParams.get('phone') || undefined,
      building: searchParams.get('building') || undefined,
      apartment: searchParams.get('apartment') || undefined
    };

    setQueryParams(params);

    // Se não há parâmetros, redirecionar para a URL externa
    const hasParams = Object.values(params).some(value => value !== undefined);
    
    if (!hasParams) {
      setShouldRedirect(true);
      // Redirecionar após um pequeno delay para evitar problemas de hidratação
      setTimeout(() => {
        window.location.href = 'http://jamesavisa.jamesconcierge.com/morador/';
      }, 100);
    } else {
      setIsLoading(false);
    }
  }, [searchParams]);

  // Função para lidar com sucesso do cadastro
  const handleRegistrationSuccess = () => {
    router.push('/success');
  };

  // Função para lidar com erro do cadastro
  const handleRegistrationError = (error: string) => {
    console.error('Erro no cadastro:', error);
    alert(`Erro no cadastro: ${error}`);
  };

  if (isLoading || shouldRedirect) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12">
        <LoadingSpinner size="lg" color="blue" />
        <p className="mt-4 text-gray-600">
          {shouldRedirect ? 'Redirecionando...' : 'Carregando...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Cadastro de Morador
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Complete seu cadastro para acessar o sistema
            </p>
            {queryParams.building && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Edifício:</strong> {queryParams.building}
                  {queryParams.apartment && (
                    <span className="ml-2">
                      <strong>Apartamento:</strong> {queryParams.apartment}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          <MoradorFormWithParams
            queryParams={queryParams}
            onSuccess={handleRegistrationSuccess}
            onError={handleRegistrationError}
          />
        </div>
      </div>
    </div>
  );
}

// Componente wrapper para o MoradorForm com parâmetros pré-preenchidos
interface MoradorFormWithParamsProps {
  queryParams: QueryParams;
  onSuccess: () => void;
  onError: (error: string) => void;
}

function MoradorFormWithParams({ queryParams, onSuccess, onError }: MoradorFormWithParamsProps) {
  // Criar um tokenData mock para compatibilidade com o MoradorForm existente
  const mockTokenData = {
    id: 'mock-id',
    token: 'mock-token',
    token_type: 'morador',
    entity_id: 'mock-entity',
    entity_type: 'morador',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    used_at: null,
    is_used: false,
    metadata: queryParams,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return (
    <MoradorFormWithPrefilledData
      tokenData={mockTokenData}
      queryParams={queryParams}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

// Versão modificada do MoradorForm com dados pré-preenchidos
interface MoradorFormWithPrefilledDataProps {
  tokenData: any;
  queryParams: QueryParams;
  onSuccess: () => void;
  onError: (error: string) => void;
}

function MoradorFormWithPrefilledData({ tokenData, queryParams, onSuccess, onError }: MoradorFormWithPrefilledDataProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    birthDate: '',
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      building: '',
      apartment: ''
    },
    emergencyContact: {
      name: '',
      phone: ''
    },
    password: '',
    confirmPassword: ''
  });
 
  // Efeito para preencher automaticamente os campos com base nos query params
  useEffect(() => {
    if (queryParams.name || queryParams.phone || queryParams.building || queryParams.apartment) {
      setFormData(prev => ({
        ...prev,
        fullName: queryParams.name || prev.fullName,
        phone: queryParams.phone || prev.phone,
        address: {
          ...prev.address,
          building: queryParams.building || prev.address.building,
          apartment: queryParams.apartment || prev.address.apartment
        }
      }));
    }
  }, [queryParams]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value
      }
    }));
  };

  const handleEmergencyContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [name]: value
      }
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Nome completo é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    if (!formData.cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Para cadastros com parâmetros, usar endpoint diferente ou adaptar o existente
      const response = await fetch('/api/complete-prefilled-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queryParams,
          registrationData: {
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            cpf: formData.cpf,
            birth_date: formData.birthDate || null,
            address: formData.address || null,
            emergency_contact_name: formData.emergencyContact.name || null,
            emergency_contact_phone: formData.emergencyContact.phone || null,
            password: formData.password
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao completar cadastro');
      }

      onSuccess();
    } catch (error) {
      console.error('Registration error:', error);
      onError(error instanceof Error ? error.message : 'Erro ao completar cadastro');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Nome Completo *
          </label>
          <input
            type="text"
            id="fullName"
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.fullName ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email *
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.email ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Telefone *
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.phone ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">
            CPF *
          </label>
          <input
            type="text"
            id="cpf"
            value={formData.cpf}
            onChange={(e) => handleInputChange('cpf', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.cpf ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.cpf && (
            <p className="mt-1 text-sm text-red-600">{errors.cpf}</p>
          )}
        </div>

        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">
            Data de Nascimento
          </label>
          <input
            type="date"
            id="birthDate"
            value={formData.birthDate}
            onChange={(e) => handleInputChange('birthDate', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="building" className="block text-sm font-medium text-gray-700">
            Edifício
          </label>
          <input
            type="text"
            id="building"
            value={formData.address.building}
            onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, building: e.target.value } }))}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="apartment" className="block text-sm font-medium text-gray-700">
            Apartamento
          </label>
          <input
            type="text"
            id="apartment"
            value={formData.address.apartment}
            onChange={(e) => setFormData(prev => ({ ...prev, address: { ...prev.address, apartment: e.target.value } }))}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700">
            Nome do Contato de Emergência
          </label>
          <input
            type="text"
            id="emergencyContactName"
            value={formData.emergencyContact.name}
            onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, name: e.target.value } }))}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700">
            Telefone do Contato de Emergência
          </label>
          <input
            type="tel"
            id="emergencyContactPhone"
            value={formData.emergencyContact.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, phone: e.target.value } }))}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Senha *
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.password ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirmar Senha *
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isSubmitting && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <LoadingSpinner size="sm" color="blue" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Processando seu cadastro...</p>
                <p className="text-xs text-blue-600">Por favor, não feche esta página</p>
              </div>
            </div>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span className="ml-2">Finalizando...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Finalizar Cadastro
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-500 text-center">
          Ao finalizar o cadastro, você concorda com nossos termos de uso
        </p>
      </div>
    </form>
  );
}