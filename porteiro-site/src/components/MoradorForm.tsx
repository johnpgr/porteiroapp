'use client';

import { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

import { Json } from '@/types/database';

interface TokenData {
  id: string;
  token: string;
  token_type: string;
  entity_id: string;
  entity_type: string;
  expires_at: string;
  used_at: string | null;
  is_used: boolean;
  metadata?: Json | null;
  created_at: string;
  updated_at: string;
}

interface MoradorFormProps {
  tokenData: TokenData;
  onSuccess: () => void;
  onError: (error: string) => void;
}

type MoradorFormData = {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  password: string;
  confirmPassword: string;
};

export default function MoradorForm({ tokenData, onSuccess, onError }: MoradorFormProps) {
  const [formData, setFormData] = useState<MoradorFormData>({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    birth_date: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    password: '',
    confirmPassword: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<MoradorFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<MoradorFormData> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome completo é obrigatório';
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
      const response = await fetch('/api/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenData.token,
          registrationData: {
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            cpf: formData.cpf,
            birth_date: formData.birth_date || null,
            address: formData.address || null,
            emergency_contact_name: formData.emergency_contact_name || null,
            emergency_contact_phone: formData.emergency_contact_phone || null,
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

  const handleInputChange = (field: keyof MoradorFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
            Nome Completo *
          </label>
          <input
            type="text"
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleInputChange('full_name', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.full_name ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.full_name && (
            <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
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
          <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">
            Data de Nascimento
          </label>
          <input
            type="date"
            id="birth_date"
            value={formData.birth_date}
            onChange={(e) => handleInputChange('birth_date', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Endereço
          </label>
          <input
            type="text"
            id="address"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700">
            Nome do Contato de Emergência
          </label>
          <input
            type="text"
            id="emergency_contact_name"
            value={formData.emergency_contact_name}
            onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">
            Telefone do Contato de Emergência
          </label>
          <input
            type="tel"
            id="emergency_contact_phone"
            value={formData.emergency_contact_phone}
            onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
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