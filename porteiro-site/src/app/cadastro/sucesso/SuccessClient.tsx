'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle, Smartphone, Shield, Users, Clock, ArrowRight, Download, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SuccessClient() {
  const searchParams = useSearchParams();
  const [tipo, setTipo] = useState<'visitante' | 'morador'>('visitante');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const tipoParam = searchParams?.get('tipo') as 'visitante' | 'morador' | null;
    if (tipoParam === 'visitante' || tipoParam === 'morador') {
      setTipo(tipoParam);
    }
    // Animação de entrada
    const enterTimeout = setTimeout(() => setIsVisible(true), 100);
    // Efeito confetti
    const confettiOn = setTimeout(() => setShowConfetti(true), 500);
    const confettiOff = setTimeout(() => setShowConfetti(false), 3000);
    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(confettiOn);
      clearTimeout(confettiOff);
    };
  }, [searchParams]);

  const getContent = () => {
    if (tipo === 'visitante') {
      return {
        title: 'Cadastro de Visitante Concluído!',
        subtitle: 'Seu acesso foi configurado com sucesso',
        description: 'Agora você pode acessar o condomínio de forma rápida e segura.',
        gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
        accentColor: 'emerald',
        icon: '🎉',
        features: [
          { icon: <Smartphone className="w-6 h-6" />, title: 'Acesso Rápido', description: 'Use seu celular para entrar no condomínio' },
          { icon: <Shield className="w-6 h-6" />, title: 'Segurança Total', description: 'Seus dados estão protegidos e criptografados' },
          { icon: <Clock className="w-6 h-6" />, title: 'Disponível 24h', description: 'Acesse a qualquer hora do dia ou da noite' },
        ]
      } as const;
    }
    return {
      title: 'Cadastro de Morador Aprovado!',
      subtitle: 'Bem-vindo ao seu novo lar digital',
      description: 'Agora você tem acesso completo a todas as funcionalidades do condomínio.',
      gradient: 'from-blue-400 via-purple-500 to-indigo-600',
      accentColor: 'blue',
      icon: '🏠',
      features: [
        { icon: <Users className="w-6 h-6" />, title: 'Gestão Completa', description: 'Gerencie visitantes, encomendas e reservas' },
        { icon: <Shield className="w-6 h-6" />, title: 'Controle Total', description: 'Monitore e controle o acesso ao seu apartamento' },
        { icon: <Sparkles className="w-6 h-6" />, title: 'Recursos Premium', description: 'Acesso a todas as funcionalidades exclusivas' },
      ],
      actions: [
        { label: 'Acessar Painel', href: '/dashboard', primary: true, icon: <ArrowRight className="w-5 h-5" /> },
        { label: 'Baixar App', href: '#', primary: false, icon: <Download className="w-5 h-5" /> },
      ],
    } as const;
  };

  const content = getContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-2 h-2 bg-gradient-to-r ${content.gradient} rounded-full animate-bounce`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br ${content.gradient} rounded-full opacity-10 blur-3xl animate-pulse`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr ${content.gradient} rounded-full opacity-10 blur-3xl animate-pulse`} style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 mb-6 shadow-lg border border-white/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-slate-600">Cadastro Concluído</span>
          </div>
        </div>

        {/* Main Content */}
        <div className={`max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Success Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12 mb-8">
            <div className="text-center mb-8">
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br ${content.gradient} rounded-full mb-6 shadow-lg animate-bounce`}>
                <CheckCircle className="w-12 h-12 text-white" />
              </div>

              {/* Title */}
              <h1 className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${content.gradient} bg-clip-text text-transparent mb-4`}>
                {content.title}
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-slate-600">
                {content.subtitle}
              </p>
            </div>

            {/* Description */}
            <div className="text-center mb-8">
              <p className="text-slate-600 max-w-2xl mx-auto">
                {content.description}
              </p>
            </div>

            {/* App Badges */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#" className="transform transition-transform hover:scale-105">
                <Image
                  src="/disponivel-app-store-badge.png"
                  alt="Disponível na App Store"
                  width={200}
                  height={60}
                  className="h-15"
                />
              </a>
              <a href="#" className="transform transition-transform hover:scale-105">
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

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {content.features.map((feature, index) => (
              <div
                key={index}
                className={`
                  bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 
                  transition-all duration-500 hover:scale-105 hover:shadow-xl
                  ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                `}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br ${content.gradient} rounded-xl mb-4 text-white shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Info Card */}
          <div className="bg-gradient-to-r from-slate-50 to-white rounded-2xl p-6 shadow-lg border border-slate-200">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${content.gradient} rounded-lg flex items-center justify-center shadow-lg`}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-2">Informações Importantes</h3>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Mantenha seus dados sempre atualizados</li>
                  <li>• Em caso de dúvidas, entre em contato com a administração</li>
                  <li>• Baixe o aplicativo para ter acesso completo às funcionalidades</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="text-center mt-8">
            <p className="text-slate-500 mb-2">Precisa de ajuda?</p>
            <Link 
              href="/suporte" 
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
            >
              Entre em contato com o suporte
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}