'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TokenValidator from '@/components/TokenValidator';
import MoradorForm from '@/components/MoradorForm';
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

export default function MoradorRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [validatedTokenData, setValidatedTokenData] = useState<TokenData | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const handleTokenValidated = (tokenData: TokenData) => {
    setValidatedTokenData(tokenData);
  };

  const handleTokenError = (error: string) => {
    console.error('Erro na validação do token:', error);
  };

  const handleRegistrationSuccess = () => {
    setRegistrationComplete(true);
  };

  const handleRegistrationError = (error: string) => {
    alert(`Erro no cadastro: ${error}`);
  };

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Cadastro Realizado com Sucesso!
            </h2>
            <p className="text-gray-600 mb-6">
              Seu cadastro foi finalizado. Você receberá um email com as instruções para acessar o sistema.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Finalizar Cadastro de Morador
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Complete seu cadastro para acessar o sistema
            </p>
          </div>

          {!validatedTokenData ? (
            <TokenValidator
              token={token}
              expectedType="morador"
              onValidToken={handleTokenValidated}
              onInvalidToken={handleTokenError}
            />
          ) : (
            <MoradorForm
              tokenData={validatedTokenData}
              onSuccess={handleRegistrationSuccess}
              onError={handleRegistrationError}
            />
          )}
        </div>
      </div>
    </div>
  );
}