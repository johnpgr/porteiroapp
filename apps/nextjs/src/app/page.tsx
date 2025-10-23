'use client';
// Landing Page do JAMES AVISA - Sistema de Portaria Digital
import Image from 'next/image';

export default function HomePage() {
  const scrollToListaEspera = () => {
    const element = document.getElementById('lista-espera');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Badges Promocionais */}
      <div className="bg-gradient-to-r from-green-500 to-blue-500 py-2">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-center">
            <div className="flex items-center space-x-2 text-white font-medium text-sm">
              <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">🎉 OFERTA EXCLUSIVA</span>
              <span>Os primeiros 100 condomínios inscritos ganham acesso gratuito ao app!</span>
            </div>
            <div className="flex items-center space-x-2 text-white font-medium text-sm">
              <span className="bg-red-500 px-2 py-1 rounded-full text-xs font-bold animate-pulse">⚡ ATENÇÃO</span>
              <span>Alta demanda — garanta seu acesso prioritário agora!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image 
                src="/logo-james.png" 
                alt="Logo JAMES AVISA" 
                width={40} 
                height={40}
                className="h-10 w-auto"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                James Avisa 
              </h1>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={scrollToListaEspera}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                🚀 Cadastre-se na lista de espera
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-blue-50 py-16 md:py-24 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-green-500/5"></div>
        <div className="absolute top-10 right-10 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <div className="mb-8">
            <Image 
              src="/logo-james.png" 
              alt="Logo JAMES AVISA" 
              width={80} 
              height={80}
              className="h-16 md:h-20 w-auto mx-auto animate-pulse"
            />
          </div>
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
           <span className="text-blue-600">James Avisa</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Tecnologia de ponta para gestão inteligente de visitantes, entregas e moradores.
          </p>
          
          {/* Enhanced CTA Section */}
          <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-3xl p-8 md:p-12 shadow-2xl mb-8 transform transition-all duration-300">
            <div className="flex flex-col items-center space-y-6">
              {/* Prominent CTA Text */}
              <div className="text-center">
                <h3 className="text-2xl md:text-4xl font-bold text-white mb-2 animate-bounce">
                  📱 BAIXE AGORA
                </h3>
                <p className="text-blue-100 text-lg md:text-xl font-medium">
                  Disponível gratuitamente nas lojas de aplicativos
                </p>
              </div>
              
              {/* Arrow pointing down */}
              <div className="animate-pulse">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              
              {/* Enhanced App Store Badges */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <a 
                  target='_blank' 
                  href="https://apps.apple.com/br/app/james-avisa/id6752514993" 
                  className="group relative transform hover:scale-110 transition-all duration-300 hover:rotate-1 focus:outline-none focus:ring-4 focus:ring-white/50 rounded-2xl"
                >
                  <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                  <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
                    <Image 
                      src="/disponivel-app-store-badge.png" 
                      alt="Disponível na App Store" 
                      width={220} 
                      height={65}
                      className="h-16 md:h-18 w-auto filter drop-shadow-lg"
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    GRÁTIS
                  </div>
                </a>
                
                <a 
                  target='_blank' 
                  href="https://play.google.com/store/apps/details?id=com.porteiroapp.notifications&hl=pt_BR" 
                  className="group relative transform hover:scale-110 transition-all duration-300 hover:-rotate-1 focus:outline-none focus:ring-4 focus:ring-white/50 rounded-2xl"
                >
                  <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                  <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
                    <Image 
                      src="/disponivel-google-play-badge.png" 
                      alt="Disponível no Google Play" 
                      width={220} 
                      height={65}
                      className="h-16 md:h-18 w-auto filter drop-shadow-lg"
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    GRÁTIS
                  </div>
                </a>
              </div>
              
            </div>
          </div>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 text-gray-500 text-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              <span>100% Gratuito</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Seguro &amp; Confiável</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios do App - Formato Checklist */}
      <section className="py-16 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              O que o James Avisa oferece
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
            Por que escolher o James Avisa?
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

      {/* Lista de Espera CTA */}
      <section id="lista-espera" className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          {/* Badge promocional */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-medium text-sm border border-blue-200">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Os 100 primeiros cadastrados receberão o aplicativo gratuitamente
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Lado esquerdo - Texto promocional */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Cadastre-se na Lista de Espera
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Seja um dos primeiros a ter acesso ao James Avisa e transforme a comunicação do seu condomínio.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-lg mr-3">⏰</div>
                  <div>
                    <p className="font-semibold text-gray-900">Estamos com muita demanda no momento</p>
                    <p className="text-gray-600 text-sm">Garanta seu acesso prioritário</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lado direito - Formulário */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Preencha seus dados
                </h3>
                <p className="text-gray-600 text-sm">
                  Entraremos em contato quando o sistema estiver disponível
                </p>
              </div>

              <form className="space-y-4">
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    id="nome"
                    name="nome"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 text-gray-500 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 text-gray-500 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone/WhatsApp *
                  </label>
                  <input
                    type="tel"
                    id="telefone"
                    name="telefone"
                    required
                    className="w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label htmlFor="condominio" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Condomínio/Empresa *
                  </label>
                  <input
                    type="text"
                    id="condominio"
                    name="condominio"
                    required
                    className="w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Nome do seu condomínio ou empresa"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200"
                >
                  Quero acesso antecipado
                </button>
              </form>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  Seus dados estão seguros conosco. Não compartilhamos com terceiros.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-blue-600 via-blue-700 to-green-600 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-green-300/20 rounded-full blur-2xl"></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="mb-8">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              Pronto para modernizar sua portaria?
            </h3>
            <p className="text-xl md:text-2xl text-blue-100 mb-2 font-medium">
              Baixe o James Avisa agora e transforme a gestão do seu condomínio!
            </p>
          </div>
          
          {/* Enhanced CTA with prominent "BAIXE AGORA" */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/20 shadow-2xl mb-6">
            <div className="flex flex-col items-center space-y-6">
              {/* Prominent CTA Text */}
              <div className="text-center">
                <h4 className="text-2xl md:text-3xl font-bold text-white mb-2 animate-pulse">
                  🚀 BAIXE AGORA - É GRÁTIS!
                </h4>
                <p className="text-blue-100 text-lg font-medium">
                  Junte-se a milhares de condomínios que já usam
                </p>
              </div>
              
              {/* Enhanced App Store Badges */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <a 
                  target='_blank' 
                  href="https://apps.apple.com/br/app/james-avisa/id6752514993" 
                  className="group relative transform hover:scale-110 transition-all duration-300 hover:rotate-2 focus:outline-none focus:ring-4 focus:ring-white/50 rounded-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-white/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                  <div className="relative bg-white/20 backdrop-blur-sm rounded-2xl p-3 border border-white/30 shadow-xl">
                    <Image 
                      src="/disponivel-app-store-badge.png" 
                      alt="Disponível na App Store" 
                      width={240} 
                      height={70}
                      className="h-16 md:h-20 w-auto filter drop-shadow-2xl"
                    />
                  </div>
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-bounce shadow-lg">
                    GRÁTIS
                  </div>
                </a>
                
                <a 
                  target='_blank' 
                  href="https://play.google.com/store/apps/details?id=com.porteiroapp.notifications&hl=pt_BR" 
                  className="group relative transform hover:scale-110 transition-all duration-300 hover:-rotate-2 focus:outline-none focus:ring-4 focus:ring-white/50 rounded-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-white/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                  <div className="relative bg-white/20 backdrop-blur-sm rounded-2xl p-3 border border-white/30 shadow-xl">
                    <Image 
                      src="/disponivel-google-play-badge.png" 
                      alt="Disponível no Google Play" 
                      width={240} 
                      height={70}
                      className="h-16 md:h-20 w-auto filter drop-shadow-2xl"
                    />
                  </div>
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-bounce shadow-lg">
                    GRÁTIS
                  </div>
                </a>
              </div>
              
            </div>
          </div>
          
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Image 
              src="/logo-james.png" 
              alt="Logo JAMES AVISA" 
              width={32} 
              height={32}
              className="h-8 w-auto bg-white rounded-full p-1"
            />
            <h4 className="text-xl font-bold text-white">JAMES AVISA</h4>
          </div>
          <p className="text-gray-400 mb-4">
            Sua portaria digital em tempo real - Segurança e praticidade para seu condomínio
          </p>
          <div className="mb-4">
            <h4 className="font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="http://jamesavisa.jamesconcierge.com/morador/politicas" className="hover:text-white">Políticas de Privacidade</a></li>
              <li><a href="http://jamesavisa.jamesconcierge.com/morador/termos" className="hover:text-white">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-white">Cookies</a></li>
            </ul>
          </div>
          <p className="text-gray-500 text-sm">
            © 2025 JAMES AVISA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
