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
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="mb-8">
            <Image 
              src="/logo-james.png" 
              alt="Logo JAMES AVISA" 
              width={80} 
              height={80}
              className="h-20 w-auto mx-auto"
            />
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
           <span className="text-blue-600">James Avisa</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Tecnologia de ponta para gestão inteligente de visitantes, entregas e moradores.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* <a href="#" className="inline-block hover:opacity-80 transition-opacity">
              <Image 
                src="/disponivel-app-store-badge.png" 
                alt="Disponível na App Store" 
                width={200} 
                height={60}
                className="h-15"
              />
            </a> */}
            <a target='_blank' href="https://play.google.com/store/apps/details?id=com.porteiroapp.notifications&hl=pt_BR" className="inline-block hover:opacity-80 transition-opacity">
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
      <section className="py-16 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Pronto para modernizar sua portaria?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Baixe o James Avisa agora e transforme a gestão do seu condomínio!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* <a href="#" className="inline-block hover:opacity-80 transition-opacity">
              <Image 
                src="/disponivel-app-store-badge.png" 
                alt="Disponível na App Store" 
                width={200} 
                height={60}
                className="h-15"
              />
            </a> */}
            <a target='_blank' href="https://play.google.com/store/apps/details?id=com.porteiroapp.notifications&hl=pt_BR" className="inline-block hover:opacity-80 transition-opacity">
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
