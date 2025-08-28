'use client';

import { useState } from 'react';
import TokenValidator from '@/components/TokenValidator';
import VisitaApprovalForm from '@/components/VisitaApprovalForm';

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

interface VisitaApprovalClientProps {
  token: string;
}

export default function VisitaApprovalClient({ token }: VisitaApprovalClientProps) {
  const [validatedTokenData, setValidatedTokenData] = useState<TokenData | null>(null);
  const [approvalComplete, setApprovalComplete] = useState(false);
  const [approvalResult, setApprovalResult] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTokenValidated = (tokenData: TokenData) => {
    setValidatedTokenData(tokenData);
  };

  const handleTokenError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleApprovalSuccess = (result: 'approved' | 'rejected') => {
    setApprovalResult(result);
    setApprovalComplete(true);
  };

  const handleApprovalError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (approvalComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${
                approvalResult === 'approved' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {approvalResult === 'approved' ? (
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                {approvalResult === 'approved' ? 'Visita Aprovada!' : 'Visita Rejeitada'}
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {approvalResult === 'approved' 
                  ? 'A visita foi aprovada com sucesso. O visitante receberá uma confirmação por WhatsApp.'
                  : 'A visita foi rejeitada. O visitante será notificado da decisão por WhatsApp.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Erro
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Aprovação de Visita
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Revise os detalhes da visita e tome sua decisão
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!validatedTokenData ? (
            <TokenValidator
              token={token}
              expectedType="visita"
              onValidToken={handleTokenValidated}
              onInvalidToken={handleTokenError}
            />
          ) : (
            <VisitaApprovalForm
              tokenData={validatedTokenData}
              onSuccess={handleApprovalSuccess}
              onError={handleApprovalError}
            />
          )}
        </div>
      </div>
    </div>
  );
}