'use client';

import { useState, useEffect } from 'react';
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
  Settings,
  Bell,
  Home,
  Edit,
  Trash2,
  LogOut,
  Users,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Car,
  User,
  Phone,
  MapPin,
  Calendar,
  X,
  Download,
  Save,
  AlertTriangle
} from 'lucide-react';

// Tipos para o dashboard
type DashboardTab = 'home' | 'notifications' | 'profile' | 'settings';

interface FormErrors {
  email?: string;
  password?: string;
}

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  apartment?: string;
  building?: string;
  profile_type?: string;
  created_at?: string;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { user, signIn, signOut, loading, isSuperAdmin, isAdmin } = useAuth();
  
  // Estados do formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Estados do dashboard
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Funções de validação
  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'Email é obrigatório';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email inválido';
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Senha é obrigatória';
    if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validação em tempo real
  useEffect(() => {
    if (email && formErrors.email) {
      const emailError = validateEmail(email);
      if (!emailError) {
        setFormErrors(prev => ({ ...prev, email: undefined }));
      }
    }
  }, [email, formErrors.email]);

  useEffect(() => {
    if (password && formErrors.password) {
      const passwordError = validatePassword(password);
      if (!passwordError) {
        setFormErrors(prev => ({ ...prev, password: undefined }));
      }
    }
  }, [password, formErrors.password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      await signIn(email, password);
      setSuccessMessage('Login realizado com sucesso!');
      
      // Carregar perfil do usuário
      await loadUserProfile();
      
    } catch (error: any) {
      console.error('Erro no login:', error);
      setError(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar perfil do usuário
  const loadUserProfile = async () => {
    if (!user) return;
    
    setIsLoadingProfile(true);
    try {
      const response = await fetch('/api/user-profile', {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      });
      
      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Carregar perfil quando usuário fizer login
  useEffect(() => {
    if (user && !userProfile) {
      loadUserProfile();
    }
  }, [user]);

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

  // Renderizar aba inicial (home)
  const renderHomeTab = () => (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bem-vindo de volta!</h2>
            <p className="text-gray-600">Aqui está um resumo das suas atividades</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Notificações Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Visitantes Hoje</p>
              <p className="text-2xl font-bold text-gray-900">7</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status do Sistema</p>
              <p className="text-sm font-medium text-green-600">Operacional</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações da Conta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Email</label>
              <p className="text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Tipo de Perfil</label>
              <p className="text-gray-900">{user.user_metadata?.profile_type || 'Usuário'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-medium">Ativo</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Último Acesso</label>
              <p className="text-gray-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      {(isSuperAdmin() || isAdmin()) && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Ações Administrativas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isSuperAdmin() && (
              <button
                onClick={() => router.push('/admin/manage-admins')}
                className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Gerenciar Administradores
              </button>
            )}
            <button
              onClick={() => router.push('/admin/manage-buildings')}
              className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Building className="w-4 h-4 mr-2" />
              Gerenciar Prédios
            </button>
            <button
              onClick={() => router.push('/admin/manage-residents')}
              className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <UserIcon className="w-4 h-4 mr-2" />
              Gerenciar Moradores
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar aba de notificações
  const renderNotificationsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notificações</h2>
            <p className="text-gray-600">Gerencie suas notificações e histórico de visitantes</p>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Notificações Pendentes */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-yellow-600" />
          Notificações Pendentes
        </h3>
        
        <div className="space-y-4">
          {/* Notification Card 1 */}
          <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Visitante Aguardando</span>
                  <span className="text-xs text-gray-500">há 5 min</span>
                </div>
                <p className="text-gray-700 mb-2">João Silva deseja visitar o apartamento 101</p>
                <div className="text-sm text-gray-600">
                  <p><strong>Documento:</strong> 123.456.789-00</p>
                  <p><strong>Motivo:</strong> Visita social</p>
                </div>
              </div>
              <div className="flex space-x-2 ml-4">
                <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
                  Aprovar
                </button>
                <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
                  Rejeitar
                </button>
              </div>
            </div>
          </div>

          {/* Notification Card 2 */}
          <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Entrega Pendente</span>
                  <span className="text-xs text-gray-500">há 15 min</span>
                </div>
                <p className="text-gray-700 mb-2">Entregador da Amazon para apartamento 205</p>
                <div className="text-sm text-gray-600">
                  <p><strong>Empresa:</strong> Amazon</p>
                  <p><strong>Destinatário:</strong> Maria Santos</p>
                </div>
              </div>
              <div className="flex space-x-2 ml-4">
                <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
                  Aprovar
                </button>
                <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
                  Rejeitar
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma notificação pendente no momento</p>
          </div>
        </div>
      </div>

      {/* Histórico de Visitantes */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" />
            Histórico de Visitantes
          </h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Ver todos
          </button>
        </div>
        
        <div className="space-y-4">
          {/* History Card 1 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Visita Aprovada</span>
                  <span className="text-xs text-gray-500">hoje às 14:30</span>
                </div>
                <p className="text-gray-700 mb-2">Carlos Oliveira visitou apartamento 303</p>
                <div className="text-sm text-gray-600">
                  <p><strong>Documento:</strong> 987.654.321-00</p>
                  <p><strong>Duração:</strong> 2h 15min</p>
                  <p><strong>Status:</strong> <span className="text-green-600">Finalizada</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* History Card 2 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Visita Rejeitada</span>
                  <span className="text-xs text-gray-500">ontem às 16:45</span>
                </div>
                <p className="text-gray-700 mb-2">Tentativa de visita não autorizada</p>
                <div className="text-sm text-gray-600">
                  <p><strong>Motivo:</strong> Morador não estava presente</p>
                  <p><strong>Status:</strong> <span className="text-red-600">Rejeitada</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* History Card 3 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Entrega Realizada</span>
                  <span className="text-xs text-gray-500">ontem às 10:20</span>
                </div>
                <p className="text-gray-700 mb-2">Correios entregou encomenda para apt 150</p>
                <div className="text-sm text-gray-600">
                  <p><strong>Empresa:</strong> Correios</p>
                  <p><strong>Destinatário:</strong> Ana Costa</p>
                  <p><strong>Status:</strong> <span className="text-blue-600">Entregue</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizar aba de perfil
  const renderProfileTab = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
      name: user.user_metadata?.name || '',
      email: user.email || '',
      phone: user.user_metadata?.phone || '',
      apartment: user.user_metadata?.apartment || '',
      building: user.user_metadata?.building || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveProfile = async () => {
      setIsSaving(true);
      try {
        // Aqui você implementaria a lógica para salvar no Supabase
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulação
        setIsEditing(false);
        // Mostrar mensagem de sucesso
      } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        // Mostrar mensagem de erro
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Meu Perfil</h2>
              <p className="text-gray-600">Gerencie suas informações pessoais</p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>{isEditing ? 'Cancelar' : 'Editar'}</span>
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Avatar Section */}
            <div className="md:col-span-2 flex items-center space-x-6 pb-6 border-b border-gray-200">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{profileData.name || 'Usuário'}</h3>
                <p className="text-gray-600">{profileData.email}</p>
                {isEditing && (
                  <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Alterar foto
                  </button>
                )}
              </div>
            </div>

            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite seu nome completo"
                />
              ) : (
                <p className="text-gray-900 py-2">{profileData.name || 'Não informado'}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <p className="text-gray-900 py-2">{profileData.email}</p>
              <p className="text-xs text-gray-500">O email não pode ser alterado</p>
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(11) 99999-9999"
                />
              ) : (
                <p className="text-gray-900 py-2">{profileData.phone || 'Não informado'}</p>
              )}
            </div>

            {/* Apartment Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apartamento
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.apartment}
                  onChange={(e) => setProfileData({...profileData, apartment: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 101, 205A"
                />
              ) : (
                <p className="text-gray-900 py-2">{profileData.apartment || 'Não informado'}</p>
              )}
            </div>

            {/* Building Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prédio/Bloco
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.building}
                  onChange={(e) => setProfileData({...profileData, building: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Bloco A, Torre 1"
                />
              ) : (
                <p className="text-gray-900 py-2">{profileData.building || 'Não informado'}</p>
              )}
            </div>

            {/* Profile Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Perfil
              </label>
              <p className="text-gray-900 py-2">{user.user_metadata?.profile_type || 'Usuário'}</p>
              <p className="text-xs text-gray-500">O tipo de perfil é definido pelo administrador</p>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Account Security */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Segurança da Conta
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Alterar Senha</p>
                <p className="text-sm text-gray-600">Última alteração há 30 dias</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Alterar
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Autenticação em Duas Etapas</p>
                <p className="text-sm text-gray-600">Adicione uma camada extra de segurança</p>
              </div>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                Configurar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar aba de configurações
  const renderSettingsTab = () => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAccount = async () => {
      if (deleteConfirmText !== 'EXCLUIR') {
        return;
      }
      
      setIsDeleting(true);
      try {
        // Aqui você implementaria a lógica para excluir a conta no Supabase
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulação
        // Redirecionar para página de confirmação ou login
        router.push('/login?message=account-deleted');
      } catch (error) {
        console.error('Erro ao excluir conta:', error);
        // Mostrar mensagem de erro
      } finally {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
      }
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configurações</h2>
            <p className="text-gray-600">Gerencie suas preferências e configurações da conta</p>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Bell className="w-5 h-5 mr-2 text-blue-600" />
            Notificações
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Notificações por Email</p>
                <p className="text-sm text-gray-600">Receba notificações importantes por email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Notificações Push</p>
                <p className="text-sm text-gray-600">Receba notificações em tempo real no navegador</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Notificações de Visitantes</p>
                <p className="text-sm text-gray-600">Seja notificado quando houver visitantes</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-green-600" />
            Privacidade
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Perfil Público</p>
                <p className="text-sm text-gray-600">Permitir que outros moradores vejam seu perfil</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Histórico de Atividades</p>
                <p className="text-sm text-gray-600">Manter registro das suas atividades no sistema</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Download className="w-5 h-5 mr-2 text-purple-600" />
            Gerenciamento de Dados
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Exportar Dados</p>
                <p className="text-sm text-gray-600">Baixe uma cópia de todos os seus dados</p>
              </div>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Exportar
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Limpar Histórico</p>
                <p className="text-sm text-gray-600">Remove todo o histórico de atividades</p>
              </div>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
            Zona de Perigo
          </h3>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-red-900">Excluir Conta</p>
                <p className="text-sm text-red-700 mt-1">
                  Esta ação é irreversível. Todos os seus dados serão permanentemente removidos.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Excluir Conta
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
                <p className="text-gray-600">
                  Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente removidos.
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Digite <strong>EXCLUIR</strong> para confirmar:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="EXCLUIR"
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'EXCLUIR' || isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Excluindo...
                    </>
                  ) : (
                    'Excluir Conta'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar dashboard completo
  const renderDashboard = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">James Avisa</h1>
                <p className="text-sm text-gray-600">Portaria Virtual</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('home')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'home'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Home className="w-4 h-4" />
                <span>Início</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4" />
                <span>Notificações</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Edit className="w-4 h-4" />
                <span>Meu Perfil</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Configurações</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'notifications' && renderNotificationsTab()}
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>
    </div>
  );

  // Renderizar formulário de login melhorado
  const renderLoginForm = () => (
    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
      <div className="text-center mb-8">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <UserIcon className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          James Avisa
        </h1>
        <p className="text-lg text-gray-600 mb-1">Portaria Virtual</p>
        <p className="text-sm text-gray-500">Faça login para acessar o sistema</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {/* Campo Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className={`h-5 w-5 ${formErrors.email ? 'text-red-400' : 'text-gray-400'}`} />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                formErrors.email 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
              }`}
              placeholder="seu@email.com"
              disabled={isLoading}
            />
          </div>
          {formErrors.email && (
            <p className="text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {formErrors.email}
            </p>
          )}
        </div>

        {/* Campo Senha */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Shield className={`h-5 w-5 ${formErrors.password ? 'text-red-400' : 'text-gray-400'}`} />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`block w-full pl-10 pr-12 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                formErrors.password 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
              }`}
              placeholder="Digite sua senha"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {formErrors.password && (
            <p className="text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {formErrors.password}
            </p>
          )}
        </div>

        {/* Mensagens de erro/sucesso */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Botão de Login */}
        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all duration-200 ${
            isLoading || !email || !password
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          Sistema seguro com criptografia de ponta a ponta
        </p>
      </div>
    </div>
  );

  if (user) {
    return renderDashboard();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {renderLoginForm()}
      </div>
    </div>
  );
}