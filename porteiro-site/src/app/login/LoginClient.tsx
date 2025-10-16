'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/utils/useAuth';

import { toast } from 'sonner';
import NotificationCard from '../../components/NotificationCard';
import { usePendingNotifications } from '../../hooks/usePendingNotifications';

// Interface para notificações pendentes (removida - não utilizada)
/*
interface PendingNotification {
  id: string;
  entry_type: 'visitor' | 'delivery' | 'vehicle';
  notification_status: 'pending' | 'approved' | 'rejected' | 'expired';
  notification_sent_at: string;
  expires_at: string;
  apartment_id: string;
  guest_name?: string;
  purpose?: string;
  visitor_id?: string;
  delivery_sender?: string;
  delivery_description?: string;
  delivery_tracking_code?: string;
  license_plate?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_brand?: string;
  building_id: string;
  created_at: string;
  log_time: string;
  visitors?: {
    name: string;
    document: string;
    phone?: string;
  };
}
*/


import {
  Mail,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Building,
  Bell,
  Home,
  Edit,
  Trash2,
  LogOut,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  X,
  Save,
  AlertTriangle,
  Settings
} from 'lucide-react';

// Interface para tipagem do histórico de visitantes
interface VisitorHistory {
  id: string;
  visitor_name: string;
  purpose: string;
  log_time: string;
  notification_status: 'approved' | 'pending' | 'rejected';
  visitor_document?: string;
  visitor_phone?: string;
  delivery_destination?: string;
}

// Tipos para o dashboard
type DashboardTab = 'home' | 'notifications' | 'profile' | 'settings';

interface FormErrors {
  email?: string;
  password?: string;
}

interface UserProfile {
  id: string;
  user_id?: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
  email?: string;
  cpf?: string;
  work_schedule?: string;

  birth_date?: string;
  building_id?: string;
  role?: string;
  user_type?: string;
  relation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  registration_token?: string;
  token_expires_at?: string;
  profile_complete?: boolean;
  temporary_password_used?: boolean;
  expo_push_token?: string;
  first_login_completed?: boolean;
  profile_completion_date?: string;
  photo_verification_status?: string;
  address?: string;
  // Campos relacionados (JOIN com buildings)
  buildings?: {
    id: string;
    name: string;
    address: string;
  };
  // Campos adicionais para compatibilidade
  name?: string;
  profile_type?: string;
  building_address?: string;
  floor?: number;
  is_owner?: boolean;
  relationship?: string;
  is_primary?: boolean;
}

export default function LoginClient() {
  const router = useRouter();
  const { user, signIn, signOut, isSuperAdmin, isAdmin } = useAuth();
  
  // Estados do formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Estados do dashboard
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    birth_date: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    avatar_url: '',
    address: ''
  });
  const [profileErrors, setProfileErrors] = useState<{[key: string]: string}>({});
  
  // Estados adicionais para mensagens (removidos - já declarados acima)
  
  // Estados para o histórico de visitantes
  const [visitorsHistory, setVisitorsHistory] = useState<VisitorHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Estados para notificações pendentes
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  
  // Hook para notificações pendentes
  const {
    notifications: pendingNotifications,
    loading: loadingNotifications,
    error: notificationsError,
    fetchPendingNotifications,
    respondToNotification
  } = usePendingNotifications(apartmentId || undefined);
  
  // Estados adicionais para notificações (removidos - não utilizados)
  // const [respondingToNotification, setRespondingToNotification] = useState<string | null>(null);
  // const [showNotificationDetails, setShowNotificationDetails] = useState<string | null>(null);
  // const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  // const [rejectReason, setRejectReason] = useState('');
  
  // Estados para exclusão de conta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estados para modal de detalhes do visitante
  const [showVisitorDetails, setShowVisitorDetails] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorHistory | null>(null);
  
  // Limpar mensagens após um tempo
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

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
      
    } catch (error: unknown) {
      console.error('Erro no login:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login. Verifique suas credenciais.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  // Função para carregar o perfil do usuário
  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          email,
          cpf,
          address,
          birth_date,
          work_schedule,
          emergency_contact_name,
          emergency_contact_phone,
          user_type,
          role,
          profile_complete,
          avatar_url,
          building_id,
          buildings (
            id,
            name,
            address
          )
        `)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Erro ao carregar perfil:', error);
        throw error;
      }
      
      if (!data) {
        console.error('Perfil não encontrado para o usuário:', user.id);
        throw new Error('Perfil não encontrado');
      }
      
      setUserProfile({
        id: data.id,
        full_name: data.full_name || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        cpf: data.cpf || undefined,
        birth_date: data.birth_date || undefined,
        work_schedule: data.work_schedule || undefined,
        emergency_contact_name: data.emergency_contact_name || undefined,
        emergency_contact_phone: data.emergency_contact_phone || undefined,
        buildings: data.buildings || undefined
      });
      
      // Preencher o formulário de edição com os dados atuais
      setProfileForm({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_phone: data.emergency_contact_phone || '',
        avatar_url: data.avatar_url || '',
        address: data.address || ''
      });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user?.id]);

  // Função para validar o formulário de perfil
  const validateProfileForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!profileForm.full_name.trim()) {
      errors.full_name = 'Nome completo é obrigatório';
    }
    
    if (!profileForm.phone.trim()) {
      errors.phone = 'Telefone é obrigatório';
    } else if (!/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(profileForm.phone)) {
      errors.phone = 'Formato de telefone inválido';
    }
    
    if (!profileForm.cpf.trim()) {
      errors.cpf = 'CPF é obrigatório';
    } else if (!/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(profileForm.cpf)) {
      errors.cpf = 'Formato de CPF inválido';
    }
    

    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Função para atualizar o perfil do usuário
  const updateUserProfile = async () => {
    if (!user?.id || !validateProfileForm()) return;
    
    setEditingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          cpf: profileForm.cpf,
          birth_date: profileForm.birth_date,
          emergency_contact_name: profileForm.emergency_contact_name,
          emergency_contact_phone: profileForm.emergency_contact_phone,
          avatar_url: profileForm.avatar_url,
          address: profileForm.address,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        throw error;
      }
      
      // Recarregar o perfil
      await loadUserProfile();
      setShowEditProfileModal(false);
      setSuccessMessage('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setErrorMessage('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setEditingProfile(false);
    }
  };

  // Função para excluir conta do usuário
  const handleDeleteAccount = async () => {
    if (!user?.id || deleteConfirmText !== 'EXCLUIR') return;
    
    setIsDeleting(true);
    try {
      // Primeiro, excluir dados relacionados do usuário
      const { error: deleteUserError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.id);
      
      if (deleteUserError) {
        console.error('Erro ao excluir perfil:', deleteUserError);
        throw deleteUserError;
      }
      
      // Depois, excluir a conta de autenticação
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (deleteAuthError) {
        console.error('Erro ao excluir conta de autenticação:', deleteAuthError);
        // Mesmo se houver erro na exclusão da auth, continuar com o logout
      }
      
      // Fazer logout
      await signOut();
      
      toast.success('Conta excluída com sucesso!');
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      toast.error('Erro ao excluir conta. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para buscar histórico de visitantes
  const fetchVisitorsHistory = useCallback(async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    setHistoryError(null);
    
    try {
      // Primeiro, buscar o profile_id do usuário na tabela profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError || !profileData) {
        console.warn('Profile não encontrado para user_id:', user.id, profileError?.message);
        setVisitorsHistory([]);
        setApartmentId(null);
        setHistoryError('Profile não encontrado. Entre em contato com a administração.');
        return;
      }
      
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', profileData.id)
        .single();
      
      if (apartmentError || !apartmentData) {
        // Se o usuário não tem apartamento associado, definir lista vazia e retornar
        console.warn('Usuário não possui apartamento associado:', apartmentError?.message);
        setVisitorsHistory([]);
        setApartmentId(null);
        setHistoryError('Usuário não possui apartamento associado. Entre em contato com a administração.');
        return;
      }
      
      setApartmentId(apartmentData.apartment_id);
      
      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          log_time,
          purpose,
          visitors (
            name,
            document,
            phone
          )
        `)
        .eq('apartment_id', apartmentData.apartment_id)
        .order('log_time', { ascending: false })
        .limit(50);
      
      if (visitorsError) {
        throw new Error('Erro ao buscar histórico de visitantes');
      }
      
      const formattedHistory: VisitorHistory[] = visitorsData.map(log => ({
        id: log.id,
        visitor_name: log.visitors?.name || 'Nome não informado',
        visitor_document: log.visitors?.document || 'Documento não informado',
        log_time: log.log_time,
        purpose: log.purpose || 'Visita',
        notification_status: 'approved' as 'approved' | 'rejected' | 'pending',
        visitor_phone: log.visitors?.phone || undefined
      }));
      
      setVisitorsHistory(formattedHistory);
    } catch (error: unknown) {
      console.error('Erro ao buscar histórico:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setHistoryError(errorMessage);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);



  // Função para aprovar com destino de entrega


  // Função para obter ícone do status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <X className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  // Função para obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprovado';
      case 'rejected':
        return 'Rejeitado';
      case 'pending':
        return 'Pendente';
      default:
        return 'Desconhecido';
    }
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // Carregar dados do usuário quando fizer login
  useEffect(() => {
    if (user && !userProfile) {
      loadUserProfile();
    }
  }, [user, userProfile, loadUserProfile]);

  // Carregar dados quando usuário fizer login (apenas uma vez)
  useEffect(() => {
    if (user && visitorsHistory.length === 0 && !loadingHistory) {
      fetchVisitorsHistory();
    }
  }, [user, fetchVisitorsHistory, loadingHistory, visitorsHistory.length]);

  // Função para formatar data em português
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      console.log('Logout realizado com sucesso!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer logout';
      console.error('Erro ao fazer logout:', errorMessage);
    }
  };

  // Renderizar aba inicial (home)
  const renderHomeTab = () => (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
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
              <p className="text-2xl font-bold text-gray-900">
                {loadingNotifications ? '...' : pendingNotifications.length}
              </p>
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
              <p className="text-2xl font-bold text-gray-900">
                {loadingHistory ? '...' : visitorsHistory.filter(visitor => {
                  const today = new Date().toDateString();
                  return new Date(visitor.log_time).toDateString() === today;
                }).length}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
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
              <p className="text-gray-900">{user?.email || 'Email não disponível'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Tipo de Perfil</label>
              <p className="text-gray-900">{user?.user_type || 'Usuário'}</p>
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

      {/* Modal de Edição de Perfil */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Editar Perfil</h3>
              <button 
                onClick={() => {
                  setShowEditProfileModal(false);
                  setProfileErrors({});
                }}
                className="text-gray-400 hover:text-gray-600"
                disabled={editingProfile}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={updateUserProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      profileErrors.full_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Digite seu nome completo"
                    disabled={editingProfile}
                  />
                  {profileErrors.full_name && (
                    <p className="text-red-500 text-sm mt-1">{profileErrors.full_name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      profileErrors.phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="(11) 99999-9999"
                    disabled={editingProfile}
                  />
                  {profileErrors.phone && (
                    <p className="text-red-500 text-sm mt-1">{profileErrors.phone}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF *
                  </label>
                  <input
                    type="text"
                    value={profileForm.cpf}
                    onChange={(e) => setProfileForm({...profileForm, cpf: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      profileErrors.cpf ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="000.000.000-00"
                    disabled={editingProfile}
                  />
                  {profileErrors.cpf && (
                    <p className="text-red-500 text-sm mt-1">{profileErrors.cpf}</p>
                  )}
                </div>
                

                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço Completo
                  </label>
                  <textarea
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Rua, número, bairro, cidade, CEP"
                    rows={3}
                    disabled={editingProfile}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProfileModal(false);
                    setProfileErrors({});
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={editingProfile}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editingProfile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {editingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
       )}

      {/* Modal de Detalhes do Visitante */}
      {showVisitorDetails && selectedVisitor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Detalhes do Visitante</h3>
              <button 
                onClick={() => {
                  setShowVisitorDetails(false);
                  setSelectedVisitor(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Foto do visitante - Removido temporariamente pois visitor_photo não existe na interface */}
              {/* {selectedVisitor.visitor_photo && (
                <div className="flex justify-center mb-4">
                  <Image 
                    src={selectedVisitor.visitor_photo} 
                    alt="Foto do visitante"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                    width={96}
                    height={96}
                  />
                </div>
              )} */}
              
              {/* Informações básicas */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Visitante
                  </label>
                  <p className="text-gray-900 font-medium">{selectedVisitor.visitor_name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Documento
                  </label>
                  <p className="text-gray-900">{selectedVisitor.visitor_document || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <p className="text-gray-900">{selectedVisitor.visitor_phone || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data da Visita
                  </label>
                  <p className="text-gray-900">{formatDate(selectedVisitor.log_time)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="flex items-center">
                    {getStatusIcon(selectedVisitor.notification_status)}
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                      getStatusColor(selectedVisitor.notification_status)
                    }`}>
                      {getStatusText(selectedVisitor.notification_status)}
                    </span>
                  </div>
                </div>
                
                {selectedVisitor.delivery_destination && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Local de Entrega
                    </label>
                    <p className="text-gray-900">
                      {selectedVisitor.delivery_destination === 'apartment' ? 'Apartamento' : 'Portaria'}
                    </p>
                  </div>
                )}
                
                {/* Motivo da recusa - Removido temporariamente pois rejection_reason não existe na interface */}
                {/* {selectedVisitor.rejection_reason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo da Recusa
                    </label>
                    <p className="text-red-600">{selectedVisitor.rejection_reason}</p>
                  </div>
                )} */}
                
                {/* Observações - Removido temporariamente pois notes não existe na interface */}
                {/* {selectedVisitor.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <p className="text-gray-900">{selectedVisitor.notes}</p>
                  </div>
                )} */}
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowVisitorDetails(false);
                  setSelectedVisitor(null);
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
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
              <User className="w-4 h-4 mr-2" />
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
          <button 
            onClick={() => fetchPendingNotifications()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
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
        
        {loadingNotifications ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Carregando notificações...</p>
          </div>
        ) : notificationsError ? (
          <div className="text-center py-8 text-red-500">
            <p>Erro ao carregar notificações: {notificationsError}</p>
            <button 
              onClick={() => fetchPendingNotifications()}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Tentar novamente
            </button>
          </div>
        ) : pendingNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma notificação pendente no momento</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRespond={respondToNotification}
              />
            ))}
          </div>
        )}
      </div>

      {/* Histórico de Visitantes */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
            <Clock className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-blue-600" />
            Histórico de Visitantes
          </h3>
          <button className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium self-start sm:self-auto">
            Ver todos
          </button>
        </div>
        
        <div className="space-y-4">
          {loadingHistory ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : historyError ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Erro ao carregar histórico</p>
              <button
                onClick={fetchVisitorsHistory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : visitorsHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum histórico de visitantes encontrado</p>
            </div>
          ) : (
            visitorsHistory.map((visit) => {
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'approved': return 'bg-green-500';
                  case 'rejected': return 'bg-red-500';
                  case 'completed': return 'bg-blue-500';
                  default: return 'bg-gray-500';
                }
              };

              const getStatusText = (status: string) => {
                switch (status) {
                  case 'approved': return 'Visita Aprovada';
                  case 'rejected': return 'Visita Rejeitada';
                  case 'completed': return 'Visita Finalizada';
                  default: return 'Status Desconhecido';
                }
              };

              const getStatusTextColor = (status: string) => {
                switch (status) {
                  case 'approved': return 'text-green-600';
                  case 'rejected': return 'text-red-600';
                  case 'completed': return 'text-blue-600';
                  default: return 'text-gray-600';
                }
              };

              return (
                <div 
                  key={visit.id} 
                  className="border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setSelectedVisitor(visit);
                    setShowVisitorDetails(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 ${getStatusColor(visit.notification_status)} rounded-full`}></div>
                          <span className="text-xs sm:text-sm font-medium text-gray-900">{getStatusText(visit.notification_status)}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(visit.log_time)}</span>
                      </div>
                      <p className="text-sm sm:text-base text-gray-700 mb-2">
                        {visit.visitor_name} - {visit.purpose}
                      </p>
                      <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                        <p><strong>Documento:</strong> {visit.visitor_document}</p>
                        {visit.visitor_phone && (
                          <p><strong>Telefone:</strong> {visit.visitor_phone}</p>
                        )}
                        <p><strong>Motivo:</strong> {visit.purpose}</p>
                        <p><strong>Status:</strong> <span className={getStatusTextColor(visit.notification_status)}>{getStatusText(visit.notification_status)}</span></p>
                      </div>
                    </div>
                    <div className="ml-2">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  // Atualizar dados do perfil quando o usuário estiver disponível
  useEffect(() => {
    if (user && userProfile) {
      setProfileForm({
        full_name: userProfile.full_name || '',
        email: userProfile.email || user?.email || '',
        phone: userProfile.phone || '',
        cpf: userProfile.cpf || '',
        birth_date: userProfile.birth_date || '',
        emergency_contact_name: userProfile.emergency_contact_name || '',
        emergency_contact_phone: userProfile.emergency_contact_phone || '',
        avatar_url: userProfile.avatar_url || '',
        address: userProfile.address || ''
      });
    }
  }, [user, userProfile]);
  
  // Mostrar mensagens de sucesso/erro
  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    }
  }, [successMessage]);
  
  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
    }
  }, [errorMessage]);
  // Renderizar aba de perfil
  const renderProfileTab = () => {
    const userData = userProfile || {
      email: user?.email || '',
      full_name: '',
      phone: '',
      cpf: '',
      birth_date: '',
      emergency_contact_name: '',
      emergency_contact_phone: ''
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
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Editar</span>
            </button>
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Nome Completo</label>
                <p className="text-gray-900 mt-1">{userData.full_name || 'Não informado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-gray-900 mt-1">{userData.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Telefone</label>
                <p className="text-gray-900 mt-1">{userData.phone || 'Não informado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Data de Nascimento</label>
                <p className="text-gray-900 mt-1">{userData.birth_date || 'Não informado'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">CPF</label>
                <p className="text-gray-900 mt-1">{userData.cpf || 'Não informado'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Contato de Emergência</label>
                <p className="text-gray-900 mt-1">{userData.emergency_contact_name || 'Não informado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Telefone de Emergência</label>
                <p className="text-gray-900 mt-1">{userData.emergency_contact_phone || 'Não informado'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status da Conta</h3>
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="font-medium text-green-900">Conta Ativa</p>
                <p className="text-sm text-green-700">Sua conta está funcionando normalmente</p>
              </div>
            </div>
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>
    );
  };

  // Renderizar aba de configurações
  const renderSettingsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configurações</h2>
          <p className="text-gray-600">Gerencie suas preferências e configurações da conta</p>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacidade</h3>
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Dados Pessoais</h4>
            <p className="text-sm text-gray-600 mb-3">
              Seus dados pessoais são protegidos e utilizados apenas para o funcionamento do sistema.
            </p>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Ver Política de Privacidade
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-900 mb-4">Zona de Perigo</h3>
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="font-medium text-red-900 mb-2">Excluir Conta</h4>
            <p className="text-sm text-red-700 mb-3">
              Uma vez excluída, sua conta não poderá ser recuperada. Esta ação é irreversível.
            </p>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Excluir Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizar dashboard completo
  const renderDashboard = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center relative">
                {userProfile?.avatar_url ? (
                  <Image 
                    src={userProfile.avatar_url} 
                    alt="Avatar do usuário" 
                    className="w-full h-full object-cover"
                    width={40}
                    height={40}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center text-white font-semibold text-sm ${userProfile?.avatar_url ? 'hidden' : 'flex'}`}>
                  {userProfile?.full_name ? 
                    userProfile.full_name.split(' ').map(name => name[0]).join('').substring(0, 2).toUpperCase() :
                    (user?.email ? user.email.substring(0, 2).toUpperCase() : 'JA')
                  }
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isLoadingProfile ? 'Carregando...' : (userProfile?.full_name || user?.email || 'Usuário')}
                </h1>
                <p className="text-sm text-gray-600">Portaria Virtual</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Botão Excluir Conta */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Excluir Conta</span>
                <span className="sm:hidden">Excluir</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
                <span className="sm:hidden">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('home')}
              className={`py-4 px-2 sm:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'home'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Home className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Início</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-2 sm:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Bell className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Notificações</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-2 sm:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <User className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Perfil</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-2 sm:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Settings className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Configurações</span>
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

      {/* Modal de Edição de Perfil */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Editar Perfil</h3>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); updateUserProfile(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        profileErrors.full_name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Digite seu nome completo"
                      disabled={editingProfile}
                    />
                    {profileErrors.full_name && (
                      <p className="text-sm text-red-600 mt-1">{profileErrors.full_name}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-900 bg-gray-50 cursor-not-allowed"
                      placeholder="Email não pode ser alterado"
                      disabled={true}
                      readOnly
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone *
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        profileErrors.phone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="(11) 99999-9999"
                      disabled={editingProfile}
                    />
                    {profileErrors.phone && (
                      <p className="text-sm text-red-600 mt-1">{profileErrors.phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF *
                    </label>
                    <input
                      type="text"
                      value={profileForm.cpf}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, cpf: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        profileErrors.cpf ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="000.000.000-00"
                      disabled={editingProfile}
                    />
                    {profileErrors.cpf && (
                      <p className="text-sm text-red-600 mt-1">{profileErrors.cpf}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Nascimento
                    </label>
                    <input
                      type="text"
                      value={profileForm.birth_date}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, birth_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="DD/MM/AAAA"
                      disabled={editingProfile}
                    />
                  </div>
                  

                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contato de Emergência
                    </label>
                    <input
                      type="text"
                      value={profileForm.emergency_contact_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nome do contato de emergência"
                      disabled={editingProfile}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone de Emergência
                    </label>
                    <input
                      type="tel"
                      value={profileForm.emergency_contact_phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(11) 99999-9999"
                      disabled={editingProfile}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    disabled={editingProfile}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                    disabled={editingProfile}
                  >
                    {editingProfile ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Excluir Conta</h3>
                <p className="text-sm text-gray-600">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Tem certeza de que deseja excluir permanentemente sua conta? Todos os seus dados serão removidos e não poderão ser recuperados.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Atenção:</p>
                    <p className="text-sm text-yellow-700">
                      Esta ação é irreversível. Todos os dados associados à sua conta serão permanentemente excluídos.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="deleteConfirm" className="block text-sm font-medium text-gray-700">
                  Para confirmar, digite <strong>EXCLUIR</strong> no campo abaixo:
                </label>
                <input
                  id="deleteConfirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Digite EXCLUIR"
                  disabled={isDeleting}
                />
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
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

  // Renderizar formulário de login melhorado
  const renderLoginForm = () => (
    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
      <div className="text-center mb-8">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <User className="w-10 h-10 text-white" />
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
              className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
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
              className={`block w-full pl-10 pr-12 py-3 border rounded-lg shadow-sm text-gray-900 placeholder:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
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