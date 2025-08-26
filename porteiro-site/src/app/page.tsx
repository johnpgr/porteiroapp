// Landing Page do PorteiroApp - Sistema de Portaria Digital
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🏢</div>
              <h1 className="text-2xl font-bold text-gray-900">
                PorteiroApp
              </h1>
            </div>
            <div className="flex space-x-4">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                📱 Baixar App
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Sistema de Portaria Digital
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Solução completa para gestão de visitantes, controle de acesso e segurança predial. 
            Modernize sua portaria com tecnologia inteligente e eficiente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#" className="inline-block hover:opacity-80 transition-opacity">
              <Image 
                src="/disponivel-app-store-badge.png" 
                alt="Disponível na App Store" 
                width={200} 
                height={60}
                className="h-15"
              />
            </a>
            <a href="#" className="inline-block hover:opacity-80 transition-opacity">
              <Image 
                src="/disponivel-google-play-badge.png" 
                alt="Disponível no Google Play" 
                width={200} 
                height={60}
                className="h-15"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Benefícios do App - Formato Checklist */}
      <section className="py-16 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              O que o PorteiroApp oferece
            </h3>
            <p className="text-lg text-gray-600">
              Tudo que você precisa para uma portaria moderna e eficiente
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Coluna 1 */}
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Controle de Acesso Inteligente</h4>
                    <p className="text-gray-600">Sistema automatizado para autorização de visitantes</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Notificações em Tempo Real</h4>
                    <p className="text-gray-600">Alertas instantâneos para moradores e administradores</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Histórico Completo</h4>
                    <p className="text-gray-600">Registro detalhado de todas as movimentações</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Interface Intuitiva</h4>
                    <p className="text-gray-600">Fácil de usar para porteiros e moradores</p>
                  </div>
                </div>
              </div>
              
              {/* Coluna 2 */}
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Segurança Avançada</h4>
                    <p className="text-gray-600">Criptografia e proteção de dados garantidas</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Relatórios Detalhados</h4>
                    <p className="text-gray-600">Estatísticas e análises para melhor gestão</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Suporte 24/7</h4>
                    <p className="text-gray-600">Atendimento especializado sempre disponível</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Atualizações Automáticas</h4>
                    <p className="text-gray-600">Sempre com as últimas funcionalidades</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Destaque final */}
            <div className="mt-8 pt-8 border-t border-gray-200 text-center">
              <div className="inline-flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tudo isso em uma única plataforma integrada</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Principais Funcionalidades */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Principais Funcionalidades
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔐</div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Controle de Acesso</h4>
              <p className="text-gray-600">Gerencie entradas e saídas com segurança e praticidade total.</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">👥</div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Gestão de Visitantes</h4>
              <p className="text-gray-600">Cadastre, autorize e monitore visitantes em tempo real.</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔔</div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Notificações</h4>
              <p className="text-gray-600">Receba alertas instantâneos sobre chegadas e autorizações.</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📊</div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Relatórios</h4>
              <p className="text-gray-600">Acompanhe estatísticas e histórico completo de acessos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Por que escolher o PorteiroApp?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="text-2xl">🛡️</div>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Máxima Segurança</h4>
              <p className="text-gray-600">Controle rigoroso de acessos com tecnologia de ponta e criptografia avançada.</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="text-2xl">⚡</div>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Praticidade Total</h4>
              <p className="text-gray-600">Interface intuitiva que facilita o dia a dia de porteiros, moradores e administradores.</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="text-2xl">🚀</div>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">Alta Eficiência</h4>
              <p className="text-gray-600">Automatize processos e reduza tempo de espera com nossa solução inteligente.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Pronto para modernizar sua portaria?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Baixe o PorteiroApp agora e transforme a gestão do seu condomínio!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#" className="inline-block hover:opacity-80 transition-opacity">
              <Image 
                src="/disponivel-app-store-badge.png" 
                alt="Disponível na App Store" 
                width={200} 
                height={60}
                className="h-15"
              />
            </a>
            <a href="#" className="inline-block hover:opacity-80 transition-opacity">
              <Image 
                src="/disponivel-google-play-badge.png" 
                alt="Disponível no Google Play" 
                width={200} 
                height={60}
                className="h-15"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="text-2xl">🏢</div>
            <h4 className="text-xl font-bold text-white">PorteiroApp</h4>
          </div>
          <p className="text-gray-400 mb-4">
            Sistema de Portaria Digital - Segurança e praticidade para seu condomínio
          </p>
          <p className="text-gray-500 text-sm">
            © 2024 PorteiroApp. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
