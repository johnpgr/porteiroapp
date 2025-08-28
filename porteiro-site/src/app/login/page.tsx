'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, User as UserIcon, Mail, Phone, MapPin, Calendar, UserCheck, Trash2, Save, LogOut } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string;
  cpf: string | null;
  work_schedule: string | null;
  address: string | null;
  birth_date: string | null;
  building_id: string | null;
  role: string | null;
  user_type: string | null;
  relation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  registration_token: string | null;
  token_expires_at: string | null;
}

interface AdminProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

type UserProfile = Profile | AdminProfile;

function isAdminProfile(profile: UserProfile): profile is AdminProfile {
  return 'name' in profile && !('full_name' in profile);
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<Profile> | Partial<AdminProfile>>({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    // Verificar se já existe uma sessão ativa
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
    };

    checkSession();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Primeiro, tenta buscar na tabela 'profiles'
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileData && !profileError) {
        setProfile(profileData);
        setEditedProfile(profileData);
        return;
      }

      // Se não encontrou na tabela 'profiles', tenta buscar na tabela 'admin_profiles'
      const { data: adminData, error: adminError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (adminData && !adminError) {
        setProfile(adminData);
        setEditedProfile(adminData);
        return;
      }

      // Se não encontrou em nenhuma das tabelas
      console.error('Perfil não encontrado em nenhuma tabela:', { profileError, adminError });
      setMessage('Perfil não encontrado. Entre em contato com o administrador.');
      setMessageType('error');
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      setMessage('Erro ao carregar dados do perfil');
      setMessageType('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setMessageType('error');
        return;
      }

      if (data.user) {
        setMessage('Login realizado com sucesso!');
        setMessageType('success');
        
        // Redirecionar para a URL de retorno se existir
        if (returnUrl) {
          setTimeout(() => {
            router.push(decodeURIComponent(returnUrl));
          }, 1000);
        }
      }
    } catch {
      setMessage('Erro inesperado durante o login');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setMessage('Logout realizado com sucesso!');
      setMessageType('success');
    } catch {
      setMessage('Erro ao fazer logout');
      setMessageType('error');
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;

    setLoading(true);
    setMessage('');

    try {
      const tableName = isAdminProfile(profile) ? 'admin_profiles' : 'profiles';
      const updateData = isAdminProfile(profile) ? {
        name: (editedProfile as Partial<AdminProfile>).name,
        phone: editedProfile.phone,
      } : {
        full_name: (editedProfile as Partial<Profile>).full_name,
        phone: editedProfile.phone,
        address: (editedProfile as Partial<Profile>).address,
        birth_date: (editedProfile as Partial<Profile>).birth_date,
        emergency_contact_name: (editedProfile as Partial<Profile>).emergency_contact_name,
        emergency_contact_phone: (editedProfile as Partial<Profile>).emergency_contact_phone,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('user_id', profile.user_id!);

      if (error) {
        setMessage('Erro ao atualizar perfil: ' + error.message);
        setMessageType('error');
        return;
      }

      if (isAdminProfile(profile)) {
        setProfile({ ...profile, ...(editedProfile as Partial<AdminProfile>) });
      } else {
        setProfile({ ...profile, ...(editedProfile as Partial<Profile>) });
      }
      setEditMode(false);
      setMessage('Perfil atualizado com sucesso!');
      setMessageType('success');
    } catch {
      setMessage('Erro inesperado ao atualizar perfil');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !profile) return;

    const confirmDelete = window.confirm(
      'Tem certeza que deseja excluir permanentemente sua conta? Esta ação não pode ser desfeita.'
    );

    if (!confirmDelete) return;

    setLoading(true);
    setMessage('');

    try {
      // Primeiro, deletar o perfil da tabela correta
      const tableName = isAdminProfile(profile) ? 'admin_profiles' : 'profiles';
      const { error: profileError } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', user.id);

      if (profileError) {
        setMessage('Erro ao deletar perfil: ' + profileError.message);
        setMessageType('error');
        return;
      }

      // Depois, deletar o usuário da autenticação
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

      if (authError) {
        setMessage('Erro ao deletar conta: ' + authError.message);
        setMessageType('error');
        return;
      }

      setMessage('Conta excluída com sucesso!');
      setMessageType('success');
      
      // Fazer logout
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch {
      setMessage('Erro inesperado ao excluir conta');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (user && profile) {
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
                    <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
                    <p className="text-blue-100">Gerencie suas informações pessoais</p>
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

            {/* Message */}
            {message && (
              <div className={`px-6 py-4 ${messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            {/* Profile Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <UserIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Informações Básicas
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={isAdminProfile(profile) ? ((editedProfile as Partial<AdminProfile>).name || '') : ((editedProfile as Partial<Profile>).full_name || '')}
                        onChange={(e) => setEditedProfile(isAdminProfile(profile) ?
                          { ...editedProfile, name: e.target.value } :
                          { ...editedProfile, full_name: e.target.value }
                        )}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{isAdminProfile(profile) ? (profile.name || 'Não informado') : (profile.full_name || 'Não informado')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </label>
                    <p className="text-gray-900">{profile.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Phone className="h-4 w-4 mr-1" />
                      Telefone
                    </label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editedProfile.phone || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.phone || 'Não informado'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Data de Nascimento
                    </label>
                    {editMode ? (
                      <input
                        type="date"
                        value={(editedProfile as Partial<Profile>).birth_date || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, birth_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{!isAdminProfile(profile) && (profile as Profile).birth_date ? new Date((profile as Profile).birth_date!).toLocaleDateString('pt-BR') : 'Não informado'}</p>
                    )}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                    Informações Adicionais
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                    {editMode ? (
                      <textarea
                        value={(editedProfile as Partial<Profile>).address || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{!isAdminProfile(profile) ? (profile as Profile).address || 'Não informado' : 'Não aplicável'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <UserCheck className="h-4 w-4 mr-1" />
                      Contato de Emergência
                    </label>
                    {editMode ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Nome"
                          value={(editedProfile as Partial<Profile>).emergency_contact_name || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, emergency_contact_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="tel"
                          placeholder="Telefone"
                          value={(editedProfile as Partial<Profile>).emergency_contact_phone || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, emergency_contact_phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-900">{!isAdminProfile(profile) ? (profile as Profile).emergency_contact_name || 'Não informado' : 'Não aplicável'}</p>
                        <p className="text-gray-600 text-sm">{!isAdminProfile(profile) ? (profile as Profile).emergency_contact_phone || '' : ''}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Usuário</label>
                    {isAdminProfile(profile) ? (
                      <p className="text-gray-900 font-semibold text-blue-600">Administrador</p>
                    ) : (
                      <p className="text-gray-900 capitalize">{!isAdminProfile(profile) ? (profile as Profile).user_type || 'Não informado' : 'Não aplicável'}</p>
                    )}
                  </div>

                  {!isAdminProfile(profile) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Trabalho</label>
                      <p className="text-gray-900">{!isAdminProfile(profile) ? (profile as Profile).work_schedule || 'Não informado' : 'Não aplicável'}</p>
                    </div>
                  )}

                  {!isAdminProfile(profile) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relação</label>
                      <p className="text-gray-900">{!isAdminProfile(profile) ? (profile as Profile).relation || 'Não informado' : 'Não aplicável'}</p>
                    </div>
                  )}


                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-4 justify-between">
                <div className="flex gap-4">
                  {editMode ? (
                    <>
                      <button
                        onClick={handleUpdateProfile}
                        disabled={loading}
                        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg transition-colors"
                      >
                        <Save className="h-4 w-4" />
                        <span>{loading ? 'Salvando...' : 'Salvar'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setEditedProfile(profile);
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Editar Perfil
                    </button>
                  )}
                </div>

                <button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir Conta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center">
            <UserIcon className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Fazer Login</h2>
            <p className="mt-2 text-sm text-gray-600">Acesse sua conta para gerenciar seu perfil</p>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-md ${messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Digite seu email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Senha
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Digite sua senha"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}