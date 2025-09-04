'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/utils/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { toast } from 'sonner';

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

// Interface para notificações pendentes
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

interface NotificationResponse {
  action: 'approve' | 'reject';
  reason?: string;
  delivery_destination?: 'portaria' | 'elevador' | 'apartamento';
}
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
  // Novos campos da tabela profiles
  cpf?: string;
  address?: string;
  birth_date?: string;
  work_schedule?: string;
  role?: string;
  user_type?: string;
  relation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_complete?: boolean;
  building_address?: string;
  floor?: number;
  is_owner?: boolean;
  relationship?: string;
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
  
  // Estados para o histórico de visitantes
  const [visitorsHistory, setVisitorsHistory] = useState<VisitorHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Estados para notificações pendentes
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  
  // Estados para exclusão de conta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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
  }, [email]);

  useEffect(() => {
    if (password && formErrors.password) {
      const passwordError = validatePassword(password);
      if (!passwordError) {
        setFormErrors(prev => ({ ...prev, password: undefined }));
      }
    }
  }, [password]);

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
      
    } catch (error: any) {
      console.error('Erro no login:', error);
      setError(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para buscar dados completos do usuário com JOIN
  const fetchUserCompleteData = async () => {
    if (!user) return { 
      apartment: '', 
      building: '', 
      fullName: '', 
      phone: '', 
      email: '', 
      relationship: '',
      isOwner: false,
      floor: null,
      cpf: '',
      address: '',
      birth_date: '',
      work_schedule: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      buildingAddress: '',
      userType: '',
      role: '',
      avatar_url: ''
    };
    
    try {
      // Buscar dados completos com JOIN entre todas as tabelas relevantes
      const { data: userData, error: userError } = await supabase
        .from('apartment_residents')
        .select(`
          apartment_id,
          is_owner,
          relationship,
          profiles (
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
            avatar_url
          ),
          apartments (
            id,
            number,
            floor,
            buildings (
              id,
              name,
              address
            )
          )
        `)
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (userError || !userData) {
        console.warn('Usuário não possui apartamento associado:', userError?.message);
        
        // Tentar buscar dados diretamente da tabela profiles
        const { data: profileData, error: profileError } = await supabase
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
        
        if (profileError || !profileData) {
          return { 
            apartment: '', 
            building: '', 
            fullName: user.user_metadata?.name || '',
            phone: user.user_metadata?.phone || '',
            email: user.email || '',
            relationship: '',
            isOwner: false,
            floor: null,
            cpf: '',
            address: '',
            birth_date: '',
            work_schedule: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            buildingAddress: '',
            userType: '',
            role: '',
            avatar_url: ''
          };
        }
        
        // Retornar dados apenas do perfil (sem apartamento)
        return {
          apartment: '',
          building: profileData.buildings?.name || '',
          buildingAddress: profileData.buildings?.address || '',
          floor: null,
          fullName: profileData.full_name || user.user_metadata?.name || '',
          phone: profileData.phone || user.user_metadata?.phone || '',
          email: profileData.email || user.email || '',
          cpf: profileData.cpf || '',
          address: profileData.address || '',
          birth_date: profileData.birth_date || '',
          work_schedule: profileData.work_schedule || '',
          emergency_contact_name: profileData.emergency_contact_name || '',
          emergency_contact_phone: profileData.emergency_contact_phone || '',
          relationship: '',
          isOwner: false,
          userType: profileData.user_type || '',
          role: profileData.role || '',
          avatar_url: profileData.avatar_url || ''
        };
      }
      
      const apartment = userData.apartments?.number || '';
      const building = userData.apartments?.buildings?.name || '';
      const buildingAddress = userData.apartments?.buildings?.address || '';
      const floor = userData.apartments?.floor;
      const fullName = userData.profiles?.full_name || user.user_metadata?.name || '';
      const phone = userData.profiles?.phone || user.user_metadata?.phone || '';
      const email = userData.profiles?.email || user.email || '';
      const cpf = userData.profiles?.cpf || '';
      const address = userData.profiles?.address || '';
      const birth_date = userData.profiles?.birth_date || '';
      const work_schedule = userData.profiles?.work_schedule || '';
      const emergency_contact_name = userData.profiles?.emergency_contact_name || '';
      const emergency_contact_phone = userData.profiles?.emergency_contact_phone || '';
      const relationship = userData.relationship || '';
      const isOwner = userData.is_owner || false;
      const userType = userData.profiles?.user_type || '';
      const role = userData.profiles?.role || '';
      const avatar_url = userData.profiles?.avatar_url || '';
      
      return { 
        apartment, 
        building, 
        buildingAddress,
        floor,
        fullName, 
        phone,
        email,
        cpf,
        address,
        birth_date,
        work_schedule,
        emergency_contact_name,
        emergency_contact_phone,
        relationship,
        isOwner,
        userType,
        role,
        avatar_url
      };
    } catch (error) {
      console.error('Erro ao buscar dados completos do usuário:', error);
      return { 
        apartment: '', 
        building: '', 
        fullName: user.user_metadata?.name || '',
        phone: user.user_metadata?.phone || '',
        email: user.email || '',
        relationship: '',
        isOwner: false,
        floor: null,
        cpf: '',
        address: '',
        birth_date: '',
        work_schedule: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        buildingAddress: '',
        userType: '',
        role: '',
        avatar_url: ''
      };
    }
  };

  // Função removida: loadUserProfile não é mais necessária

  // Função para buscar histórico de visitantes
  const fetchVisitorsHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    setHistoryError(null);
    
    try {
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
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
          guest_name,
          log_time,
          notification_status,
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
        visitor_name: log.guest_name || log.visitors?.name || 'Nome não informado',
        visitor_document: log.visitors?.document || 'Documento não informado',
        log_time: log.log_time,
        purpose: log.purpose || 'Visita',
        notification_status: log.notification_status as 'approved' | 'rejected' | 'pending',
        visitor_phone: log.visitors?.phone
      }));
      
      setVisitorsHistory(formattedHistory);
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error);
      setHistoryError(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Função para buscar notificações pendentes
  const fetchPendingNotifications = async () => {
    if (!apartmentId) return;
    
    setLoadingNotifications(true);
    setNotificationsError(null);
    
    try {
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          guest_name,
          log_time,
          purpose,
          notification_status,
          visitors (
            name,
            document,
            phone
          )
        `)
        .eq('apartment_id', apartmentId)
        .eq('notification_status', 'pending')
        .order('log_time', { ascending: false });
      
      if (notificationsError) {
        throw new Error('Erro ao buscar notificações pendentes');
      }
      
      const formattedNotifications: PendingNotification[] = notificationsData.map(notification => ({
        id: notification.id,
        entry_type: 'visitor',
        notification_status: notification.notification_status,
        notification_sent_at: notification.log_time,
        expires_at: notification.log_time,
        apartment_id: apartmentId,
        guest_name: notification.guest_name || notification.visitors?.name || 'Nome não informado',
        purpose: notification.purpose || 'Visita',
        visitor_id: notification.visitors?.id,
        building_id: '',
        created_at: notification.log_time,
        log_time: notification.log_time,
        visitors: notification.visitors
      }));
      
      setPendingNotifications(formattedNotifications);
    } catch (error: any) {
      console.error('Erro ao buscar notificações:', error);
      setNotificationsError(error.message);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Função para responder notificação
  const respondToNotification = async (notificationId: string, response: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('visitor_logs')
        .update({ 
          notification_status: response,
          resident_response_at: new Date().toISOString(),
          resident_response_by: user.id
        })
        .eq('id', notificationId);
      
      if (error) {
        console.error('Erro ao responder notificação:', error);
        setMessage('Erro ao responder notificação');
        setMessageType('error');
        return;
      }
      
      // Atualizar lista de notificações
      setPendingNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
      
      // Recarregar histórico para mostrar a atualização
      await fetchVisitorsHistory();
      
      setMessage(`Notificação ${response === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      setMessageType('success');
      
    } catch (error: any) {
      console.error('Erro ao responder notificação:', error);
      setMessage('Erro ao responder notificação');
      setMessageType('error');
    }
  };

  // Carregar dados quando apartmentId estiver disponível
  useEffect(() => {
    if (apartmentId) {
      fetchPendingNotifications();
    }
  }, [apartmentId]);

  // Carregar dados do usuário quando fizer login
  useEffect(() => {
    const loadUserData = async () => {
      if (user && !userProfile) {
        setIsLoadingProfile(true);
        try {
          const userData = await fetchUserCompleteData();
          setUserProfile({
            id: user.id,
            email: userData.email,
            full_name: userData.fullName,
            phone: userData.phone,
            apartment: userData.apartment,
            building: userData.building,
            avatar_url: userData.avatar_url
          });
        } catch (error) {
          console.error('Erro ao carregar dados do usuário:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };
    
    loadUserData();
  }, [user]);

  // Carregar dados quando usuário fizer login (apenas uma vez)
  useEffect(() => {
    if (user && visitorsHistory.length === 0 && !loadingHistory) {
      fetchVisitorsHistory();
    }
  }, [user]);

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
              <p className="text-gray-900">{user.user_metadata?.user_type || 'Usuário'}</p>
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
        
        {loadingNotifications ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Carregando notificações...</p>
          </div>
        ) : notificationsError ? (
          <div className="text-center py-8 text-red-500">
            <p>Erro ao carregar notificações: {notificationsError}</p>
            <button 
              onClick={fetchPendingNotifications}
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
              <div key={notification.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-900">Visitante Aguardando</span>
                      <span className="text-xs text-gray-500">
                        {formatDate(notification.log_time)}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2 text-sm sm:text-base">{notification.guest_name} deseja visitar</p>
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <p><strong>Documento:</strong> {notification.visitors?.document || 'Não informado'}</p>
                      <p><strong>Motivo:</strong> {notification.purpose}</p>
                      {notification.visitors?.phone && (
                        <p><strong>Telefone:</strong> {notification.visitors.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2 sm:ml-4">
                    <button 
                      onClick={() => respondToNotification(notification.id, 'approved')}
                      className="flex-1 sm:flex-none px-3 py-2 bg-green-600 text-white text-xs sm:text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      Aprovar
                    </button>
                    <button 
                      onClick={() => respondToNotification(notification.id, 'rejected')}
                      className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white text-xs sm:text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
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
                <div key={visit.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
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
  // Função renderProfileTab removida - não é mais necessária

  // Função renderSettingsTab removida - não é mais necessária

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
                  <img 
                    src={userProfile.avatar_url} 
                    alt="Avatar do usuário" 
                    className="w-full h-full object-cover"
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
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'notifications' && renderNotificationsTab()}
      </div>

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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