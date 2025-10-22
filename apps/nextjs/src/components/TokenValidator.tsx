'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type RegistrationToken = Database['public']['Tables']['registration_tokens']['Row'];

interface TokenValidatorProps {
  token: string;
  expectedType?: 'morador' | 'visitante' | 'visita';
  onValidToken: (tokenData: RegistrationToken) => void;
  onInvalidToken: (error: string) => void;
  children?: React.ReactNode;
}

interface TokenValidationState {
  isLoading: boolean;
  isValid: boolean;
  error: string | null;
  tokenData: RegistrationToken | null;
}

export default function TokenValidator({
  token,
  expectedType,
  onValidToken,
  onInvalidToken,
  children
}: TokenValidatorProps) {
  const [state, setState] = useState<TokenValidationState>({
    isLoading: true,
    isValid: false,
    error: null,
    tokenData: null
  });

  const validateToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Validate token format
      if (!token || token.length < 10) {
        throw new Error('Token inválido ou malformado');
      }

      // Query the database for the token
      const { data: tokenData, error: queryError } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_used', false)
        .single();

      if (queryError) {
        console.error('Token query error:', queryError);
        throw new Error('Token não encontrado ou já utilizado');
      }

      if (!tokenData) {
        throw new Error('Token não encontrado');
      }

      // Check if token has expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      
      if (now > expiresAt) {
        throw new Error('Token expirado');
      }

      // Check token type if specified
      if (expectedType) {
        const typeMapping = {
          'morador': 'user_registration',
          'visitante': 'visitor_registration', 
          'visita': 'visit_approval'
        } as const;
        
        const expectedDbType = typeMapping[expectedType];
        if (tokenData.token_type !== expectedDbType) {
          throw new Error(`Token não é válido para este tipo de cadastro (esperado: ${expectedType}, recebido: ${tokenData.token_type})`);
        }
      }

      // Token is valid
      setState({
        isLoading: false,
        isValid: true,
        error: null,
        tokenData
      });

      onValidToken(tokenData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na validação do token';
      
      setState({
        isLoading: false,
        isValid: false,
        error: errorMessage,
        tokenData: null
      });

      onInvalidToken(errorMessage);
    }
  }, [token, expectedType, onValidToken, onInvalidToken]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Validando Token</h3>
          <p className="text-gray-600">Por favor, aguarde enquanto verificamos a validade do seu token...</p>
          <div className="mt-4 bg-blue-50 rounded-md p-3">
            <p className="text-sm text-blue-700">Este processo pode levar alguns segundos</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!state.isValid || state.error) {
    const getErrorDetails = (error: string) => {
      if (error.includes('expirado')) {
        return {
          title: 'Token Expirado',
          description: 'Este link expirou. Solicite um novo link através do aplicativo.',
          showRetry: false
        };
      }
      if (error.includes('já utilizado')) {
        return {
          title: 'Token Já Utilizado',
          description: 'Este link já foi usado anteriormente. Cada link pode ser usado apenas uma vez.',
          showRetry: false
        };
      }
      if (error.includes('não encontrado')) {
        return {
          title: 'Token Não Encontrado',
          description: 'Este link não é válido ou foi removido do sistema.',
          showRetry: false
        };
      }
      return {
        title: 'Erro de Validação',
        description: error,
        showRetry: true
      };
    };

    const errorDetails = getErrorDetails(state.error || 'Erro desconhecido');

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{errorDetails.title}</h2>
          <p className="text-gray-600 mb-6">{errorDetails.description}</p>
          <div className="space-y-3">
            {errorDetails.showRetry && (
              <button
                onClick={validateToken}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Tentar Novamente
              </button>
            )}
            <Link
              href="/"
              className="block w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Voltar ao Início
            </Link>
          </div>
          {!errorDetails.showRetry && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                💡 Dica: Acesse o aplicativo para gerar um novo link
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Valid token - render children
  return <>{children}</>;
}

// Export types for use in other components
export type { TokenValidationState, RegistrationToken };