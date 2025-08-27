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

interface VisitanteFormProps {
  tokenData: TokenData;
  onSuccess: () => void;
  onError: (error: string) => void;
}

type VisitanteFormData = {
  name: string;
  document: string;
  phone: string;
  photo_url?: string;
  visit_type: 'social' | 'delivery' | 'service' | 'other';
  visit_date: string;
  visit_start_time: string;
  visit_end_time: string;
  visitor_type: 'individual' | 'group';
};

export default function VisitanteForm({ tokenData, onSuccess, onError }: VisitanteFormProps) {
  const [formData, setFormData] = useState<VisitanteFormData>({
    name: '',
    document: '',
    phone: '',
    photo_url: '',
    visit_type: 'social',
    visit_date: '',
    visit_start_time: '',
    visit_end_time: '',
    visitor_type: 'individual'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<VisitanteFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<VisitanteFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.document.trim()) {
      newErrors.document = 'Documento é obrigatório';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    if (!formData.visit_date) {
      newErrors.visit_date = 'Data da visita é obrigatória';
    } else {
      const visitDate = new Date(formData.visit_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (visitDate < today) {
        newErrors.visit_date = 'Data da visita não pode ser no passado';
      }
    }

    if (!formData.visit_start_time) {
      newErrors.visit_start_time = 'Horário de início é obrigatório';
    }

    if (!formData.visit_end_time) {
      newErrors.visit_end_time = 'Horário de término é obrigatório';
    }

    if (formData.visit_start_time && formData.visit_end_time) {
      if (formData.visit_start_time >= formData.visit_end_time) {
        newErrors.visit_end_time = 'Horário de término deve ser após o início';
      }
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
      const response = await fetch('/api/complete-visitor-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenData.token,
          visitorData: {
            name: formData.name,
            document: formData.document,
            phone: formData.phone,
            photo_url: formData.photo_url || null,
            visit_type: formData.visit_type,
            visit_date: formData.visit_date,
            visit_start_time: formData.visit_start_time,
            visit_end_time: formData.visit_end_time,
            visitor_type: formData.visitor_type,
            apartment_id: tokenData.entity_id,
            status: 'pending'
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao completar cadastro de visitante');
      }

      onSuccess();
    } catch (error) {
      console.error('Visitor registration error:', error);
      onError(error instanceof Error ? error.message : 'Erro ao completar cadastro de visitante');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof VisitanteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome Completo *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="document" className="block text-sm font-medium text-gray-700">
            Documento (RG/CPF) *
          </label>
          <input
            type="text"
            id="document"
            value={formData.document}
            onChange={(e) => handleInputChange('document', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.document ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.document && (
            <p className="mt-1 text-sm text-red-600">{errors.document}</p>
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
          <label htmlFor="visitor_type" className="block text-sm font-medium text-gray-700">
            Tipo de Visitante *
          </label>
          <select
            id="visitor_type"
            value={formData.visitor_type}
            onChange={(e) => handleInputChange('visitor_type', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="individual">Individual</option>
            <option value="group">Grupo</option>
          </select>
        </div>

        <div>
          <label htmlFor="visit_type" className="block text-sm font-medium text-gray-700">
            Tipo de Visita *
          </label>
          <select
            id="visit_type"
            value={formData.visit_type}
            onChange={(e) => handleInputChange('visit_type', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="social">Social</option>
            <option value="delivery">Entrega</option>
            <option value="service">Serviço</option>
            <option value="other">Outro</option>
          </select>
        </div>

        <div>
          <label htmlFor="visit_date" className="block text-sm font-medium text-gray-700">
            Data da Visita *
          </label>
          <input
            type="date"
            id="visit_date"
            value={formData.visit_date}
            onChange={(e) => handleInputChange('visit_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.visit_date ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.visit_date && (
            <p className="mt-1 text-sm text-red-600">{errors.visit_date}</p>
          )}
        </div>

        <div>
          <label htmlFor="visit_start_time" className="block text-sm font-medium text-gray-700">
            Horário de Início *
          </label>
          <input
            type="time"
            id="visit_start_time"
            value={formData.visit_start_time}
            onChange={(e) => handleInputChange('visit_start_time', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.visit_start_time ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.visit_start_time && (
            <p className="mt-1 text-sm text-red-600">{errors.visit_start_time}</p>
          )}
        </div>

        <div>
          <label htmlFor="visit_end_time" className="block text-sm font-medium text-gray-700">
            Horário de Término *
          </label>
          <input
            type="time"
            id="visit_end_time"
            value={formData.visit_end_time}
            onChange={(e) => handleInputChange('visit_end_time', e.target.value)}
            className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.visit_end_time ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.visit_end_time && (
            <p className="mt-1 text-sm text-red-600">{errors.visit_end_time}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isSubmitting && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <LoadingSpinner size="sm" color="blue" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Processando cadastro do visitante...</p>
                <p className="text-xs text-blue-600">Aguarde enquanto enviamos sua solicitação</p>
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
              <span className="ml-2">Enviando...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Solicitar Aprovação da Visita
            </>
          )}
        </button>
        
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-xs text-gray-600 text-center">
            ℹ️ Após o envio, o morador receberá uma notificação para aprovar sua visita
          </p>
        </div>
      </div>
    </form>
  );
}