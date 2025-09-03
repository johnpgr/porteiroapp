'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/utils/useAuth';
import {
  UserIcon,
  Mail,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Building,
} from 'lucide-react';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { user, signIn, signOut, loading, isSuperAdmin, isAdmin } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      await signIn(email, password);
      setMessage('Login realizado com sucesso!');
      setMessageType('success');
      
      // Redirecionar para a URL de retorno ou dashboard
      setTimeout(() => {
        if (returnUrl) {
          router.push(decodeURIComponent(returnUrl));
        } else {
          router.push('/dashboard');
        }
      }, 1000);
    } catch (error: any) {
      setMessage(error.message || 'Erro ao fazer login');
      setMessageType('error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setMessage('Logout realizado com sucesso!');
      setMessageType('success');
    } catch (error: any) {
      setMessage(error.message || 'Erro ao fazer logout');
      setMessageType('error');
    }
  };

  // Se o usuário já está logado, mostrar dashboard
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  {isSuperAdmin() ? (
                    <ShieldCheck className="h-8 w-8 text-white" />
                  ) : isAdmin() ? (
                    <Shield className="h-8 w-8 text-white" />
                  ) : (
                    <UserIcon className="h-8 w-8 text-white" />
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      {isSuperAdmin() ? 'Super Administrador' : isAdmin() ? 'Administrador' : 'Usuário'}
                    </h1>
                    <p className="text-blue-100">
                      Bem-vindo, {user.full_name || user.name || user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`px-6 py-4 ${
                messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            {/* Dashboard Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* User Info Card */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <UserIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Informações do Usuário
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 mr-2 text-gray-500" />
                      <span>{user.email}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Tipo: {isSuperAdmin() ? 'Super Admin' : isAdmin() ? 'Admin' : 'Usuário'}
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                {(isSuperAdmin() || isAdmin()) && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Building className="h-5 w-5 mr-2 text-blue-600" />
                      Ações Administrativas
                    </h3>
                    <div className="space-y-2">
                      {isSuperAdmin() && (
                        <a href="/admin" className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1 block">
                          Gerenciar Administradores
                        </a>
                      )}
                      <a href="/buildings" className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1 block">
                        Gerenciar Prédios
                      </a>
                      <a href="/residents" className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1 block">
                        Cadastrar Moradores
                      </a>
                      <a href="/visitors" className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1 block">
                        Cadastrar Visitantes
                      </a>
                    </div>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Status do Sistema
                  </h3>
                  <div className="text-sm text-green-600">
                    Sistema operacional
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário está logado, mostrar dashboard
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <UserIcon className="h-8 w-8 text-white" />
                  <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-blue-100">
                      Bem-vindo, {user.name || user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* User Info */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <UserIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Informações do Usuário
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900">{user.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Perfil</label>
                    <p className="text-gray-900">
                      {isSuperAdmin() && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Shield className="h-3 w-3 mr-1" />
                          Super Administrador
                        </span>
                      )}
                      {isAdmin() && !isSuperAdmin() && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Settings className="h-3 w-3 mr-1" />
                          Administrador
                        </span>
                      )}
                      {!isAdmin() && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <UserIcon className="h-3 w-3 mr-1" />
                          Usuário
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <p className="text-gray-900">
                      {user.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Inativo
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-blue-600" />
                    Ações Disponíveis
                  </h3>
                  
                  {isSuperAdmin() && (
                    <div className="space-y-2">
                      <button className="w-full flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <Shield className="h-4 w-4" />
                        <span>Gerenciar Administradores</span>
                      </button>
                      <button className="w-full flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <Building className="h-4 w-4" />
                        <span>Gerenciar Prédios</span>
                      </button>
                    </div>
                  )}
                  
                  {isAdmin() && !isSuperAdmin() && (
                    <div className="space-y-2">
                      <button className="w-full flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <Building className="h-4 w-4" />
                        <span>Gerenciar Meu Prédio</span>
                      </button>
                      <button className="w-full flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <Users className="h-4 w-4" />
                        <span>Gerenciar Moradores</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formulário de login
   return (
     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
       <div className="max-w-md w-full space-y-8">
         <div>
           <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-600">
             <UserIcon className="h-8 w-8 text-white" />
           </div>
           <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
             James Avisa - Portaria Virtual
           </h2>
           <p className="mt-2 text-center text-sm text-gray-600">
             Faça login para acessar o sistema
           </p>
         </div>

         {/* Message */}
         {message && (
           <div className={`rounded-md p-4 ${
             messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
           }`}>
             <p className="text-sm font-medium">{message}</p>
           </div>
         )}

         <form className="mt-8 space-y-6" onSubmit={handleLogin}>
           <div className="rounded-md shadow-sm -space-y-px">
             <div>
               <label htmlFor="email" className="sr-only">
                 Email
               </label>
               <input
                 id="email"
                 name="email"
                 type="email"
                 autoComplete="email"
                 required
                 className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                 placeholder="Email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
               />
             </div>
             <div className="relative">
               <label htmlFor="password" className="sr-only">
                 Senha
               </label>
               <input
                 id="password"
                 name="password"
                 type={showPassword ? 'text' : 'password'}
                 autoComplete="current-password"
                 required
                 className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                 placeholder="Senha"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
               />
               <button
                 type="button"
                 className="absolute inset-y-0 right-0 pr-3 flex items-center"
                 onClick={() => setShowPassword(!showPassword)}
               >
                 {showPassword ? (
                   <EyeOff className="h-4 w-4 text-gray-400" />
                 ) : (
                   <Eye className="h-4 w-4 text-gray-400" />
                 )}
               </button>
             </div>
           </div>

           <div>
             <button
               type="submit"
               disabled={loading}
               className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {loading ? 'Entrando...' : 'Entrar'}
             </button>
           </div>
         </form>
       </div>
     </div>
   );
 }
  }

  // Formulário de login
   return (
     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
       <div className="max-w-md w-full space-y-8">
         <div>
           <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-600">
             <UserIcon className="h-8 w-8 text-white" />
           </div>
           <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
             James Avisa - Portaria Virtual
           </h2>
           <p className="mt-2 text-center text-sm text-gray-600">
             Faça login para acessar o sistema
           </p>
         </div>

         {/* Message */}
         {message && (
           <div className={`rounded-md p-4 ${
             messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
           }`}>
             <p className="text-sm font-medium">{message}</p>
           </div>
         )}

         <form className="mt-8 space-y-6" onSubmit={handleLogin}>
           <div className="rounded-md shadow-sm -space-y-px">
             <div>
               <label htmlFor="email" className="sr-only">
                 Email
               </label>
               <input
                 id="email"
                 name="email"
                 type="email"
                 autoComplete="email"
                 required
                 className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                 placeholder="Email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
               />
             </div>
             <div className="relative">
               <label htmlFor="password" className="sr-only">
                 Senha
               </label>
               <input
                 id="password"
                 name="password"
                 type={showPassword ? 'text' : 'password'}
                 autoComplete="current-password"
                 required
                 className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                 placeholder="Senha"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
               />
               <button
                 type="button"
                 className="absolute inset-y-0 right-0 pr-3 flex items-center"
                 onClick={() => setShowPassword(!showPassword)}
               >
                 {showPassword ? (
                   <EyeOff className="h-4 w-4 text-gray-400" />
                 ) : (
                   <Eye className="h-4 w-4 text-gray-400" />
                 )}
               </button>
             </div>
           </div>

           <div>
             <button
               type="submit"
               disabled={loading}
               className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {loading ? 'Entrando...' : 'Entrar'}
             </button>
           </div>
         </form>
       </div>
     </div>
   );
}