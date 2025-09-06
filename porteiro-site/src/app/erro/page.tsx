'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Suspense } from 'react';

function ErroContent() {
  const searchParams = useSearchParams();
  const tipo = searchParams?.get('tipo');

  const getErrorInfo = () => {
    switch (tipo) {
      case 'token-invalido':
        return {
          title: 'Link Inválido',
          message: 'O link que você acessou é inválido ou está malformado.',
          suggestion: 'Verifique se o link foi copiado corretamente ou solicite um novo link.'
        };
      case 'token-expirado':
        return {
          title: 'Link Expirado',
          message: 'Este link expirou e não pode mais ser utilizado.',
          suggestion: 'Solicite um novo link para continuar com o processo.'
        };
      case 'token-usado':
        return {
          title: 'Link Já Utilizado',
          message: 'Este link já foi utilizado anteriormente.',
          suggestion: 'Se você precisa fazer alterações, solicite um novo link.'
        };
      default:
        return {
          title: 'Erro Inesperado',
          message: 'Ocorreu um erro inesperado ao processar sua solicitação.',
          suggestion: 'Tente novamente em alguns instantes ou entre em contato conosco.'
        };
    }
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600 mb-4">
            {errorInfo.message}
          </p>
          <p className="text-sm text-gray-500">
            {errorInfo.suggestion}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>
          
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Voltar ao Início
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ErroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    }>
      <ErroContent />
    </Suspense>
  );
}