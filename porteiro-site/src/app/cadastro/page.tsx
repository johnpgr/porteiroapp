'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function CadastroSelectionPage() {
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
        <div className="max-w-4xl mx-auto px-4">
          {/* Page Title */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Escolha o Tipo de Cadastro
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Selecione abaixo o tipo de cadastro que você deseja realizar no sistema James Avisa
            </p>
          </div>

          {/* Registration Options */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Resident Registration */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow duration-300">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Cadastro de Morador
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Para moradores que desejam se cadastrar no sistema para autorizar visitantes, 
                  receber notificações e acessar todas as funcionalidades do condomínio.
                </p>
                
                {/* Features List */}
                <div className="text-left mb-8">
                  <h4 className="font-semibold text-gray-900 mb-3">Funcionalidades incluídas:</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Autorização de visitantes
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Notificações por WhatsApp
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Histórico de acessos
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Acesso ao portal do morador
                    </li>
                  </ul>
                </div>

                <Link 
                  href="/cadastro/morador"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 inline-block"
                >
                  Cadastrar como Morador
                </Link>
              </div>
            </div>

            {/* Visitor Registration */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow duration-300 opacity-60">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-500 mb-4">
                  Cadastro de Visitante
                </h3>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Para visitantes que desejam se cadastrar no sistema para facilitar 
                  futuras visitas e agilizar o processo de entrada no condomínio.
                </p>
                
                {/* Features List */}
                <div className="text-left mb-8">
                  <h4 className="font-semibold text-gray-500 mb-3">Funcionalidades incluídas:</h4>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-gray-300 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Cadastro rápido de dados
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-gray-300 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Agilidade no acesso
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-gray-300 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Histórico de visitas
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-gray-300 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Notificações de autorização
                    </li>
                  </ul>
                </div>

                <div className="w-full bg-gray-300 text-gray-500 font-medium py-3 px-6 rounded-lg cursor-not-allowed">
                  Em Breve
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Esta funcionalidade estará disponível em breve
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center mt-12">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Precisa de Ajuda?
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Se você tem dúvidas sobre qual tipo de cadastro escolher ou precisa de suporte, 
                nossa equipe está pronta para ajudar.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm">
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  📧 Suporte por E-mail
                </a>
                <span className="hidden sm:inline text-gray-400">•</span>
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  💬 Chat Online
                </a>
                <span className="hidden sm:inline text-gray-400">•</span>
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  📞 Telefone
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}