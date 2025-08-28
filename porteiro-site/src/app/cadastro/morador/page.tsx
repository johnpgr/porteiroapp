'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  building_name: string;
  apartment_number: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function CadastroMoradorPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    building_name: '',
    apartment_number: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    
    // Check for repeated digits
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Validate CPF algorithm
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
    
    return true;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome completo é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    } else if (!/^\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Telefone inválido';
    }

    if (!formData.cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!validateCPF(formData.cpf)) {
      newErrors.cpf = 'CPF inválido';
    }

    if (!formData.building_name.trim()) {
      newErrors.building_name = 'Nome do condomínio é obrigatório';
    }

    if (!formData.apartment_number.trim()) {
      newErrors.apartment_number = 'Número do apartamento é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const formatCPF = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    return cleanValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, cpf: formatted }));
    if (errors.cpf) {
      setErrors(prev => ({ ...prev, cpf: '' }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/register-resident', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone.replace(/\D/g, ''),
          cpf: formData.cpf.replace(/\D/g, ''),
          building_name: formData.building_name,
          apartment_number: formData.apartment_number
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Redirect to completion page with profile ID
        router.push(`/cadastro/morador/completar?profile_id=${result.profile_id}`);
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.message || 'Erro ao processar cadastro' });
      }
    } catch (error) {
      setErrors({ submit: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              Já tenho conta
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12">
        <div className="max-w-2xl mx-auto px-4">
          {/* Badge promocional */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full font-medium text-sm border border-green-200">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Cadastro simplificado - Sem necessidade de token
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Cadastro de Morador
              </h2>
              <p className="text-lg text-gray-600">
                Preencha seus dados para criar sua conta no James Avisa
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome Completo */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.full_name ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Seu nome completo"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
                )}
              </div>

              {/* E-mail */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.email ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="seu@email.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* Telefone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone/WhatsApp *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.phone ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>

              {/* CPF */}
              <div>
                <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
                  CPF *
                </label>
                <input
                  type="text"
                  id="cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleCPFChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.cpf ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {errors.cpf && (
                  <p className="mt-1 text-sm text-red-600">{errors.cpf}</p>
                )}
              </div>

              {/* Nome do Condomínio */}
              <div>
                <label htmlFor="building_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Condomínio *
                </label>
                <input
                  type="text"
                  id="building_name"
                  name="building_name"
                  value={formData.building_name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.building_name ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Nome do seu condomínio"
                />
                {errors.building_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.building_name}</p>
                )}
              </div>

              {/* Número do Apartamento */}
              <div>
                <label htmlFor="apartment_number" className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Apartamento *
                </label>
                <input
                  type="text"
                  id="apartment_number"
                  name="apartment_number"
                  value={formData.apartment_number}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.apartment_number ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900'
                  }`}
                  placeholder="Ex: 101, 205, Casa 15"
                />
                {errors.apartment_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.apartment_number}</p>
                )}
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                  </>
                ) : (
                  'Continuar Cadastro'
                )}
              </button>
            </form>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="text-lg mr-3">ℹ️</div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Próximos passos</p>
                  <p className="text-gray-600 text-sm">
                    Após preencher estes dados, você receberá suas credenciais de acesso por WhatsApp e poderá completar seu perfil com foto e informações adicionais.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Seus dados estão seguros conosco. Leia nossa{' '}
                <Link href="/politicas" className="text-blue-600 hover:text-blue-700">
                  Política de Privacidade
                </Link>
                {' '}e{' '}
                <Link href="/termos" className="text-blue-600 hover:text-blue-700">
                  Termos de Uso
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 mt-12">
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
          <p className="text-gray-400 text-sm">
            © 2025 JAMES AVISA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}