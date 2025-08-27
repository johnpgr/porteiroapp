'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import LoadingSpinner from './LoadingSpinner';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

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

type VisitorData = {
  id: string;
  name: string;
  document: string;
  phone: string;
  photo_url?: string;
  visit_type: string;
  visit_date: string;
  visit_start_time: string;
  visit_end_time: string;
  visitor_type: string;
  status: string;
  created_at: string;
};

interface VisitaApprovalFormProps {
  tokenData: TokenData;
  onSuccess: (result: 'approved' | 'rejected') => void;
  onError: (error: string) => void;
}

export default function VisitaApprovalForm({ tokenData, onSuccess, onError }: VisitaApprovalFormProps) {
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  const fetchVisitorData = useCallback(async () => {
    try {
      const response = await fetch('/api/get-visitor-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenData.token,
          visitorId: tokenData.entity_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar dados do visitante');
      }

      setVisitorData(result.visitor);
    } catch (error) {
      console.error('Error fetching visitor data:', error);
      onError(error instanceof Error ? error.message : 'Erro ao carregar dados do visitante');
    } finally {
      setIsLoading(false);
    }
  }, [tokenData.token, tokenData.entity_id, onError]);

  useEffect(() => {
    fetchVisitorData();
  }, [fetchVisitorData]);

  const handleApproval = async (approved: boolean) => {
    if (!approved && !rejectionReason.trim()) {
      setShowRejectionForm(true);
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/process-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenData.token,
          visitorId: tokenData.entity_id,
          approved,
          rejectionReason: approved ? null : rejectionReason
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar visita');
      }

      onSuccess(approved ? 'approved' : 'rejected');
    } catch (error) {
      console.error('Visit processing error:', error);
      onError(error instanceof Error ? error.message : 'Erro ao processar visita');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // Remove seconds
  };

  const getVisitTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'social': 'Social',
      'delivery': 'Entrega',
      'service': 'Serviço',
      'other': 'Outro'
    };
    return types[type] || type;
  };

  const getVisitorTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'individual': 'Individual',
      'group': 'Grupo'
    };
    return types[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner size="lg" text="Carregando dados da visita..." />
      </div>
    );
  }

  if (!visitorData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar dados da visita</p>
      </div>
    );
  }

  if (showRejectionForm) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Motivo da Rejeição
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Por favor, informe o motivo da rejeição da visita de <strong>{visitorData.name}</strong>
          </p>
        </div>

        <div>
          <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700 mb-2">
            Motivo da rejeição *
          </label>
          <textarea
            id="rejectionReason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Explique o motivo da rejeição..."
          />
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => setShowRejectionForm(false)}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleApproval(false)}
            disabled={!rejectionReason.trim() || isProcessing}
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Processando rejeição...</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>Confirmar Rejeição</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Solicitação de Visita
        </h3>
        <p className="text-sm text-gray-600">
          Revise os detalhes abaixo e aprove ou rejeite a visita
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome do Visitante</label>
            <p className="mt-1 text-sm text-gray-900">{visitorData.name}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Documento</label>
            <p className="mt-1 text-sm text-gray-900">{visitorData.document}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <p className="mt-1 text-sm text-gray-900">{visitorData.phone}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de Visitante</label>
            <p className="mt-1 text-sm text-gray-900">{getVisitorTypeLabel(visitorData.visitor_type)}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de Visita</label>
            <p className="mt-1 text-sm text-gray-900">{getVisitTypeLabel(visitorData.visit_type)}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Data da Visita</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(visitorData.visit_date)}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Horário de Início</label>
            <p className="mt-1 text-sm text-gray-900">{formatTime(visitorData.visit_start_time)}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Horário de Término</label>
            <p className="mt-1 text-sm text-gray-900">{formatTime(visitorData.visit_end_time)}</p>
          </div>
        </div>

        {visitorData.photo_url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto do Visitante</label>
            <Image
              src={visitorData.photo_url}
              alt={`Foto de ${visitorData.name}`}
              width={128}
              height={128}
              className="object-cover rounded-lg border border-gray-300"
            />
          </div>
        )}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={() => handleApproval(false)}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5" />
              <span>Rejeitar Visita</span>
            </>
          )}
        </button>
        
        <button
          onClick={() => handleApproval(true)}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Aprovar Visita</span>
            </>
          )}
        </button>
      </div>
      
      {isProcessing && (
        <div className="text-center">
          <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span>O visitante será notificado via WhatsApp sobre sua decisão</span>
          </p>
        </div>
      )}
    </div>
  );
}