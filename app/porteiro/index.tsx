import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  Image,
} from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';
import RegistrarVisitante from '~/components/porteiro/RegistrarVisitante';
import RegistrarEncomenda from '~/components/porteiro/RegistrarEncomenda';
import RegistrarVeiculo from '~/components/porteiro/RegistrarVeiculo';
import AutorizacoesTab from './AutorizacoesTab';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';
import { flattenStyles } from '~/utils/styles';
import { useAuth } from '~/hooks/useAuth';
import ActivityLogs from './logs';

// Interfaces para integração com logs
interface VisitorLog {
  id: string;
  visitor_name: string;
  document: string;
  apartment_id: string;
  action: 'entrada' | 'saida' | 'negado';
  authorized_by?: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
  apartments?: {
    number: string;
  };
}

interface DeliveryLog {
  id: string;
  recipient_name: string;
  apartment_id: string;
  sender: string;
  description?: string;
  status: 'recebida' | 'entregue';
  received_by?: string;
  delivered_by?: string;
  delivered_at?: string;
  created_at: string;
  apartments?: {
    number: string;
  };
}

type LogEntry = {
  id: string;
  type: 'visitor' | 'delivery';
  title: string;
  subtitle: string;
  status: string;
  time: string;
  icon: string;
  color: string;
  photo_url?: string;
  details: string[];
};

type TabType = 'chegada' | 'autorizacoes' | 'consulta' | 'avisos' | 'logs';

export default function PorteiroDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('chegada');
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState<any>(null);

  // Estados para dados do porteiro
  const [porteiroData, setPorteiroData] = useState<{
    name: string;
    initials: string;
    shift_start?: string;
    shift_end?: string;
  } | null>(null);
  const [loadingPorteiro, setLoadingPorteiro] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  // Guard para evitar recarregar dados do mesmo usuário repetidamente
  const hasLoadedPorteiroDataRef = useRef<string | null>(null);
  const buildingIdRef = useRef<string | null>(null);

  // Estados para a aba Consulta
  const [searchType, setSearchType] = useState<'cpf' | 'placa'>('cpf');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [profileResult, setProfileResult] = useState<any | null>(null);
  const [vehicleResult, setVehicleResult] = useState<any | null>(null);
  
  // Estados para a aba Avisos
  const [communications, setCommunications] = useState<any[]>([]);
  const [loadingCommunications, setLoadingCommunications] = useState(false);
  
  // Estados para a aba Autorizações
  const [autorizacoes, setAutorizacoes] = useState<any[]>([]);
  const [loadingAutorizacoes, setLoadingAutorizacoes] = useState(false);
  const [authSearchQuery, setAuthSearchQuery] = useState('');
  const [filteredAutorizacoes, setFilteredAutorizacoes] = useState<any[]>([]);
  
  // Estados para dados dos logs na aba Autorizações
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [pendingDeliveries, setPendingDeliveries] = useState<LogEntry[]>([]);
  const [scheduledVisits, setScheduledVisits] = useState<LogEntry[]>([]);

  // Estados para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  // Estados para modal de foto
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Função para fechar modal de imagem
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImageUrl(null);
  };

  // Função para processar work_schedule
  const parseWorkSchedule = (workSchedule: string | null) => {
    if (!workSchedule) {
      return { start: '08:00', end: '20:00' };
    }
    
    try {
      // Extrair horário do formato "Segunda-feira, Quarta-feira, Sexta-feira: 08:00-18:00"
      // ou do formato simples "08:00-18:00"
      let timeRange = workSchedule;
      
      // Se contém ":", pegar a parte após os dois pontos
      if (workSchedule.includes(': ')) {
        timeRange = workSchedule.split(': ')[1];
      }
      
      // Verificar se tem o formato HH:MM-HH:MM
      if (!timeRange.includes('-')) {
        return { start: '08:00', end: '20:00' };
      }
      
      const [start, end] = timeRange.split('-').map(time => time.trim());
      
      // Validar formato HH:MM
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const validStart = timeRegex.test(start) ? start : '08:00';
      const validEnd = timeRegex.test(end) ? end : '20:00';
      
      console.log('🔧 parseWorkSchedule - input:', workSchedule, 'output:', { start: validStart, end: validEnd });
      
      return { start: validStart, end: validEnd };
    } catch (error) {
      console.error('Erro ao processar work_schedule:', error);
      return { start: '08:00', end: '20:00' };
    }
  };

  // Função para carregar comunicados
  const loadCommunications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoadingCommunications(true);
      
      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        return;
      }
      
      // Buscar comunicados do prédio
      const { data: comms, error: commsError } = await supabase
        .from('communications')
        .select(`
          id,
          title,
          content,
          type,
          priority,
          created_at,
          created_by,
          admin_profiles!communications_created_by_fkey(
            full_name
          )
        `)
        .eq('building_id', profile.building_id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (commsError) {
        console.error('Erro ao carregar comunicados:', commsError);
        return;
      }
      
      setCommunications(comms || []);
    } catch (error) {
      console.error('Erro ao carregar comunicados:', error);
    } finally {
      setLoadingCommunications(false);
    }
  }, [user?.id]);

  // Função para carregar autorizações (visitantes aprovados)
  const loadAutorizacoes = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoadingAutorizacoes(true);
      
      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        return;
      }
      
      // Buscar visitantes diretamente da tabela 'visitors' com status aprovado
      const { data: visitors, error: visitorsError } = await supabase
        .from('visitors')
        .select(`
          id,
          name,
          document,
          phone,
          visitor_type,
          apartment_id,
          created_at,
          status,
          apartments!inner(
            number,
            building_id
          )
        `)
        .eq('apartments.building_id', profile.building_id)
        .eq('status', 'aprovado')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (visitorsError) {
        console.error('Erro ao carregar visitantes aprovados:', visitorsError);
        return;
      }

      // Transformar dados para o formato esperado pela interface
      const autorizacoesFormatadas = (visitors || []).map(visitor => ({
        id: visitor.id,
        tipo: visitor.visitor_type === 'delivery' ? 'Encomenda' : 'Visitante',
        nomeConvidado: visitor.name || 'N/A',
        moradorAprovador: 'Morador',
        apartamento: visitor.apartments?.number || 'N/A',
        apartamento_id: visitor.apartment_id,
        // Manual date/time formatting to avoid Hermes locale issues
        dataAprovacao: (() => {
          const date = new Date(visitor.created_at);
          return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        })(),
        horaAprovacao: (() => {
          const date = new Date(visitor.created_at);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        })(),
        statusLabel: 'Aprovado',
        statusColor: '#10B981',
        jaAutorizado: false,
        isEncomenda: visitor.visitor_type === 'delivery',
        cpf: visitor.document || '',
        phone: visitor.phone || '',
        visitor_type: visitor.visitor_type || 'comum',
        delivery_destination: visitor.delivery_destination || 'PENDENTE'
      }));
      
      setAutorizacoes(autorizacoesFormatadas);
      setFilteredAutorizacoes(autorizacoesFormatadas);
    } catch (error) {
      console.error('Erro ao carregar autorizações:', error);
    } finally {
      setLoadingAutorizacoes(false);
    }
  }, [user?.id]);

  // Função para filtrar autorizações por nome ou CPF
  const filterAutorizacoes = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredAutorizacoes(autorizacoes);
      return;
    }

    const filtered = autorizacoes.filter(autorizacao => {
      const searchTerm = query.toLowerCase().trim();
      const nome = autorizacao.nomeConvidado?.toLowerCase() || '';
      const cpf = autorizacao.cpf?.replace(/\D/g, '') || '';
      const searchCpf = searchTerm.replace(/\D/g, '');
      
      return nome.includes(searchTerm) || cpf.includes(searchCpf);
    });

    setFilteredAutorizacoes(filtered);
  }, [autorizacoes]);

  // Effect para aplicar filtro quando authSearchQuery ou autorizacoes mudarem
  useEffect(() => {
    filterAutorizacoes(authSearchQuery);
  }, [authSearchQuery, filterAutorizacoes]);

  // Função para formatar data (importada do logs.tsx)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} min atrás`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`;
    } else {
      // Manual date formatting to avoid Hermes locale issues
      const day = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return `${day} ${time}`;
    }
  };

  // Função para buscar dados dos logs (similar ao logs.tsx)
  const fetchLogsData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoadingLogs(true);
      
      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        return;
      }
      
      const promises = [];

      // Buscar logs de visitantes
      const visitorQuery = supabase
        .from('visitor_logs')
        .select(`
          *,
          apartments!inner(number),
          visitors(name, document, photo_url)
        `)
        .eq('building_id', profile.building_id)
        .order('log_time', { ascending: false })
        .limit(20);

      promises.push(visitorQuery);

      // Buscar logs de encomendas
      const deliveryQuery = supabase
        .from('deliveries')
        .select(`
          *,
          apartments!inner(number)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      promises.push(deliveryQuery);

      const [visitorResult, deliveryResult] = await Promise.all(promises);

      if (visitorResult.error) throw visitorResult.error;
      if (deliveryResult.error) throw deliveryResult.error;

      // Processar logs de visitantes
      const visitorLogs: LogEntry[] = (visitorResult.data || []).map((log: any) => {
        const getVisitorStatus = (tipoLog: string, notificationStatus: string) => {
          if (notificationStatus === 'approved') {
            return tipoLog === 'IN' 
              ? { status: 'Entrada autorizada', icon: '✅', color: '#4CAF50' }
              : { status: 'Saída registrada', icon: '🚪', color: '#2196F3' };
          } else if (notificationStatus === 'rejected') {
            return { status: 'Acesso negado', icon: '❌', color: '#F44336' };
          } else if (notificationStatus === 'pending') {
            return { status: 'Aguardando aprovação', icon: '⏳', color: '#FF9800' };
          } else {
            return { status: 'Expirado', icon: '⏰', color: '#666' };
          }
        };

        const statusInfo = getVisitorStatus(log.tipo_log, log.notification_status);
        const visitorName = log.visitors?.name || log.guest_name || 'Visitante';
        const visitorDocument = log.visitors?.document || 'N/A';
        const visitorPhoto = log.visitors?.photo_url;

        return {
          id: log.id,
          type: 'visitor',
          title: visitorName,
          subtitle: `Apto ${log.apartments?.number || 'N/A'} • ${log.tipo_log === 'IN' ? 'Entrada' : 'Saída'}`,
          status: statusInfo.status,
          time: formatDate(log.log_time),
          icon: statusInfo.icon,
          color: statusInfo.color,
          photo_url: visitorPhoto,
          details: [
            `Documento: ${visitorDocument}`,
            `Tipo: ${log.entry_type || 'visitor'}`,
            `Status: ${log.notification_status}`,
            ...(log.purpose ? [`Motivo: ${log.purpose}`] : []),
          ],
        };
      });

      // Processar logs de encomendas
      const deliveryLogs: LogEntry[] = (deliveryResult.data || []).map((delivery: DeliveryLog) => {
        const isDelivered = delivery.status === 'entregue';

        return {
          id: delivery.id,
          type: 'delivery',
          title: `Encomenda - ${delivery.recipient_name}`,
          subtitle: `Apto ${delivery.apartments?.number || 'N/A'} • ${delivery.sender}`,
          status: isDelivered ? 'Entregue' : 'Recebida',
          time: formatDate(
            isDelivered && delivery.delivered_at ? delivery.delivered_at : delivery.created_at
          ),
          icon: isDelivered ? '✅' : '📦',
          color: isDelivered ? '#4CAF50' : '#FF9800',
          details: [
            `Remetente: ${delivery.sender}`,
            ...(delivery.description ? [`Descrição: ${delivery.description}`] : []),
            `Recebida por: ${delivery.received_by || 'N/A'}`,
            ...(isDelivered ? [`Entregue por: ${delivery.delivered_by || 'N/A'}`] : []),
          ],
        };
      });

      // Combinar e ordenar todos os logs por data
      const allLogs = [...visitorLogs, ...deliveryLogs].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      setLogs(allLogs);
      
      // Filtrar entregas pendentes (status 'recebida')
      const pending = deliveryLogs.filter(log => log.status === 'Recebida');
      setPendingDeliveries(pending);
      
      // Filtrar visitas agendadas (status 'pending' ou 'approved')
      const scheduled = visitorLogs.filter(log => 
        log.status === 'Aguardando aprovação' || log.status === 'Entrada autorizada'
      );
      setScheduledVisits(scheduled);
      
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, [user]);

  // Carregar dados do porteiro
  useEffect(() => {
    const loadPorteiroData = async () => {
      if (!user?.id || authLoading) return;
      
      // Guard para evitar execuções repetidas para o mesmo usuário
      if (hasLoadedPorteiroDataRef.current === user.id) {
        return;
      }
      hasLoadedPorteiroDataRef.current = user.id;
      
      try {
        setLoadingPorteiro(true);
        setConnectionError(false);
        
        // Verificar conexão com Supabase
        const { error: connectionError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
          
        if (connectionError) {
          console.error('Erro de conexão:', connectionError);
          setConnectionError(true);
          // permitir nova tentativa em caso de erro de conexão
          hasLoadedPorteiroDataRef.current = null;
          return;
        }
        
        // Buscar dados do perfil do porteiro incluindo work_schedule e building_id
        console.log('🔍 Buscando dados do perfil para usuário:', user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, work_schedule, building_id')
          .eq('id', user.id)
          .eq('user_type', 'porteiro')
          .single();
          
        console.log('📊 Resultado da consulta:', { profile, profileError });
        
        if (profileError) {
          console.error('❌ Erro ao carregar perfil:', profileError);
          // Usar dados básicos do user se não encontrar perfil
          const nameParts = user.email.split('@')[0].split('.');
          const name = nameParts.map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(' ');
          const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
          const schedule = parseWorkSchedule(null);
          
          console.log('⚠️ Usando dados padrão - schedule:', schedule);
          
          setPorteiroData({
            name,
            initials,
            shift_start: schedule.start,
            shift_end: schedule.end
          });
        } else {
          // Usar dados do perfil
          console.log('✅ Perfil encontrado - work_schedule:', profile.work_schedule, 'building_id:', profile.building_id);
          const nameParts = (profile.full_name || profile.email.split('@')[0]).split(' ');
          const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('').slice(0, 2);
          const schedule = parseWorkSchedule(profile.work_schedule);
          
          // Atualizar buildingIdRef com o building_id do porteiro
          if (profile.building_id) {
            buildingIdRef.current = profile.building_id;
            console.log('🏢 Building ID atualizado:', profile.building_id);
          }
          
          console.log('🕐 Schedule processado:', schedule);
          
          setPorteiroData({
            name: profile.full_name || profile.email.split('@')[0],
            initials,
            shift_start: schedule.start,
            shift_end: schedule.end
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados do porteiro:', error);
        setConnectionError(true);
        // permitir nova tentativa em caso de erro
        hasLoadedPorteiroDataRef.current = null;
      } finally {
        setLoadingPorteiro(false);
      }
    };
    
    // Só executar quando user estiver carregado e não estiver em loading
    if (!authLoading && user?.id) {
      // Debounce para evitar chamadas excessivas
      const timeoutId = setTimeout(() => {
        loadPorteiroData();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, authLoading]);
  
  // Carregar comunicados quando a aba avisos for ativada
  useEffect(() => {
    if (activeTab === 'avisos' && user?.id) {
      loadCommunications();
    }
  }, [activeTab, user?.id, loadCommunications]);

  // Carregar autorizações quando a aba autorizações for ativada
  useEffect(() => {
    if (activeTab === 'autorizacoes' && user?.id) {
      loadAutorizacoes();
      fetchLogsData(); // Carregar também os dados dos logs
    }
  }, [activeTab, user?.id, loadAutorizacoes, fetchLogsData]);

  const handlePanicButton = () => {
    router.push('/porteiro/emergency');
  };

  // Função para mostrar modal de confirmação
  const showConfirmationModal = (message: string) => {
    setConfirmMessage(message);
    setShowConfirmModal(true);
    setCountdown(5);

    // Iniciar countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowConfirmModal(false);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Função para fechar modal manualmente
  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setCountdown(5);
  };

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = async () => {
    Alert.alert('Confirmar Logout', 'Deseja realmente sair do sistema?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            router.replace('/porteiro/login');
          } catch (error) {
            console.error('Erro ao fazer logout:', error);
            Alert.alert('Erro', 'Não foi possível fazer logout. Tente novamente.');
          }
        },
      },
    ]);
  };

  const renderTopMenu = () => {
    if (connectionError) {
      return (
        <View style={styles.topMenu}>
          <View style={styles.topMenuLeft}>
            <Text style={styles.welcomeText}>❌ Erro de Conexão</Text>
            <Text style={styles.shiftText}>Verifique sua conexão com a internet</Text>
          </View>
        </View>
      );
    }
    
    if (loadingPorteiro || !porteiroData) {
      return (
        <View style={styles.topMenu}>
          <View style={styles.topMenuLeft}>
            <Text style={styles.welcomeText}>Carregando...</Text>
            <Text style={styles.shiftText}>Aguarde</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>Olá, {porteiroData.name}</Text>
          <Text style={styles.shiftText}>
            Turno: {porteiroData.shift_start} - {porteiroData.shift_end}
          </Text>
        </View>

        <View style={styles.topMenuRight}>
          {/* Botão de Pânico */}
          <TouchableOpacity style={styles.panicButton} onPress={handlePanicButton}>
            <Text style={styles.panicButtonText}>🚨</Text>
          </TouchableOpacity>

          {/* Avatar do Usuário */}
          <TouchableOpacity style={styles.userAvatar} onPress={handleUserMenuToggle}>
            <Text style={styles.avatarText}>{porteiroData.initials}</Text>
          </TouchableOpacity>

          {/* Menu do Usuário */}
          {showUserMenu && (
            <View style={styles.userMenu}>
              <TouchableOpacity
                style={styles.userMenuItem}
                onPress={() => {
                  setShowUserMenu(false);
                  router.push('/porteiro/profile');
                }}>
                <Text style={styles.userMenuIcon}>👤</Text>
                <Text style={styles.userMenuText}>Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.userMenuItem} onPress={handleLogout}>
                <Text style={styles.userMenuIcon}>🚪</Text>
                <Text style={styles.userMenuText}>Logout</Text>
              </TouchableOpacity>
            </View>
           )}


         </View>
      </View>
    );
  };

  const renderChegadaTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>🏠 Chegadas</Text>
        <Text style={styles.headerSubtitle}>Registre visitantes, encomendas e veículos</Text>
      </View> */}

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={flattenStyles([styles.actionButton, styles.visitorButton])}
          onPress={() => setActiveFlow('visitante')}>
          <Text style={styles.buttonIcon}>👋</Text>
          <Text style={styles.buttonTitle}>Registrar Visitante</Text>
          <Text style={styles.buttonDescription}>Cadastrar nova visita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={flattenStyles([styles.actionButton, styles.deliveryButton])}
          onPress={() => setActiveFlow('encomenda')}>
          <Text style={styles.buttonIcon}>📦</Text>
          <Text style={styles.buttonTitle}>Registrar Encomenda</Text>
          <Text style={styles.buttonDescription}>Receber entrega</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={flattenStyles([styles.actionButton, styles.vehicleButton])}
          onPress={() => setActiveFlow('veiculo')}>
          <Text style={styles.buttonIcon}>🚗</Text>
          <Text style={styles.buttonTitle}>Registrar Veículo</Text>
          <Text style={styles.buttonDescription}>Autorizar entrada</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const removerEncomenda = async (autorizacao: any) => {
    Alert.alert(
      'Confirmar Remoção',
      `Tem certeza que deseja remover a encomenda de ${autorizacao.nomeConvidado}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', autorizacao.id);

              if (error) {
                console.error('Erro ao remover encomenda:', error);
                Alert.alert('Erro', 'Não foi possível remover a encomenda.');
                return;
              }

              Alert.alert('Sucesso', 'Encomenda removida com sucesso!');
              loadAutorizacoes();
            } catch (error) {
              console.error('Erro ao remover encomenda:', error);
              Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
            }
          }
        }
      ]
    );
  };

  const confirmarChegada = async (autorizacao: any) => {
    try {
      // Validar horários permitidos
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      
      // Manual day extraction to avoid Hermes locale issues
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      
      const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Verificar se há restrições de horário
      if (autorizacao.visit_start_time && autorizacao.visit_end_time) {
        if (currentTime < autorizacao.visit_start_time || currentTime > autorizacao.visit_end_time) {
          Alert.alert(
            'Horário não permitido',
            `Este visitante só pode entrar entre ${autorizacao.visit_start_time} e ${autorizacao.visit_end_time}.\n\nHorário atual: ${currentTime}`
          );
          return;
        }
      }

      // Verificar data específica para visitas pontuais
      if (autorizacao.visit_type === 'pontual' && autorizacao.visit_date) {
        if (currentDate !== autorizacao.visit_date) {
          // Manual date formatting to avoid Hermes locale issues
          const visitDate = new Date(autorizacao.visit_date);
          const visitDateFormatted = `${visitDate.getDate().toString().padStart(2, '0')}/${(visitDate.getMonth() + 1).toString().padStart(2, '0')}/${visitDate.getFullYear()}`;
          const currentDateFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
          
          Alert.alert(
            'Data não permitida',
            `Este visitante só pode entrar na data: ${visitDateFormatted}\n\nData atual: ${currentDateFormatted}`
          );
          return;
        }
      }

      // Verificar dias permitidos para visitas frequentes
      if (autorizacao.visit_type === 'frequente' && autorizacao.allowed_days && autorizacao.allowed_days.length > 0) {
        if (!autorizacao.allowed_days.includes(currentDay)) {
          const allowedDaysPortuguese = autorizacao.allowed_days.map((day: string) => {
            const dayMap: { [key: string]: string } = {
              'monday': 'Segunda-feira',
              'tuesday': 'Terça-feira',
              'wednesday': 'Quarta-feira',
              'thursday': 'Quinta-feira',
              'friday': 'Sexta-feira',
              'saturday': 'Sábado',
              'sunday': 'Domingo'
            };
            return dayMap[day] || day;
          }).join(', ');
          
          // Manual day name formatting to avoid Hermes locale issues
          const currentDayPortuguese = {
            'sunday': 'Domingo',
            'monday': 'Segunda-feira',
            'tuesday': 'Terça-feira',
            'wednesday': 'Quarta-feira',
            'thursday': 'Quinta-feira',
            'friday': 'Sexta-feira',
            'saturday': 'Sábado'
          }[currentDay] || currentDay;
          
          Alert.alert(
            'Dia não permitido',
            `Este visitante frequente só pode entrar nos dias: ${allowedDaysPortuguese}\n\nHoje é: ${currentDayPortuguese}`
          );
          return;
        }
      }

      // Buscar o building_id do porteiro
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();
        
      if (profileError || !profile?.building_id) {
        console.error('Erro ao buscar building_id do porteiro:', profileError);
        Alert.alert('Erro', 'Não foi possível confirmar a chegada.');
        return;
      }

      // Determinar o novo status baseado no visitor_type
      const visitorType = autorizacao.visitor_type || 'comum';
      const newStatus = visitorType === 'frequente' ? 'aprovado' : 'pendente';

      // Atualizar status do visitante para pendente
      const { error: updateError } = await supabase
        .from('visitors')
        .update({ 
          status: 'pendente'
        })
        .eq('id', autorizacao.id);

      if (updateError) {
        console.error('Erro ao atualizar status do visitante:', updateError);
        Alert.alert('Erro', 'Não foi possível confirmar a chegada do visitante.');
        return;
      }

      // Função para gerar UUID compatível com React Native
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Registrar novo log de entrada (IN)
      const { error: logError } = await supabase
        .from('visitor_logs')
        .insert({
          visitor_id: autorizacao.id,
          apartment_id: autorizacao.apartamento_id,
          building_id: profile.building_id,
          log_time: new Date().toISOString(),
          tipo_log: 'IN',
          visit_session_id: generateUUID(),
          purpose: `ACESSO PRÉ-AUTORIZADO - Visitante já aprovado pelo morador. Porteiro realizou verificação de entrada. Check-in por: ${porteiroData?.name || 'N/A'}. Tipo: ${visitorType}, Status: ${newStatus}`,
          authorized_by: user.id, // ID do porteiro que está confirmando
          guest_name: autorizacao.nomeConvidado, // Nome do visitante para exibição
          entry_type: autorizacao.isEncomenda ? 'delivery' : 'visitor', // Tipo de entrada
          requires_notification: !autorizacao.jaAutorizado, // Se precisa notificar morador
          requires_resident_approval: !autorizacao.jaAutorizado, // Se precisa aprovação do morador
          auto_approved: autorizacao.jaAutorizado || false, // Se foi aprovado automaticamente
          emergency_override: false, // Não é emergência
          notification_status: autorizacao.jaAutorizado ? 'approved' : 'pending', // Status baseado na pré-aprovação
          delivery_destination: autorizacao.isEncomenda ? 'portaria' : null, // Destino se for encomenda
          notification_preferences: '{}' // Configurações padrão
        });

      if (logError) {
        Alert.alert('Erro', 'Não foi possível registrar o log de entrada.');
        return;
      }

      // Mostrar modal de confirmação
      setSelectedAuth(autorizacao);
      showConfirmationModal(
        autorizacao.isEncomenda
          ? `A encomenda de ${autorizacao.nomeConvidado} foi registrada na portaria.`
          : `${autorizacao.nomeConvidado} teve sua chegada confirmada. ${visitorType === 'frequente' ? 'Visitante frequente mantém acesso aprovado.' : 'Visitante comum retorna ao status pendente.'}`
      );

      // Recarregar autorizações após o check-in
      setTimeout(() => {
        loadAutorizacoes();
      }, 1000);

    } catch (error) {
      console.error('Erro ao confirmar chegada:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    }
  };



  const renderConsultaTab = () => {

    // Função para validar CPF com verificação de dígitos verificadores
    const isValidCPF = (cpf: string) => {
      const cleanCPF = cpf.replace(/[^0-9]/g, '');
      
      // Verificar se tem 11 dígitos
      if (cleanCPF.length !== 11) {
        return false;
      }
      
      // Verificar se todos os dígitos são iguais (CPF inválido)
      if (/^(\d)\1{10}$/.test(cleanCPF)) {
        return false;
      }
      
      // Calcular primeiro dígito verificador
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
      }
      let firstDigit = 11 - (sum % 11);
      if (firstDigit >= 10) firstDigit = 0;
      
      // Verificar primeiro dígito
      if (parseInt(cleanCPF.charAt(9)) !== firstDigit) {
        return false;
      }
      
      // Calcular segundo dígito verificador
      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
      }
      let secondDigit = 11 - (sum % 11);
      if (secondDigit >= 10) secondDigit = 0;
      
      // Verificar segundo dígito
      return parseInt(cleanCPF.charAt(10)) === secondDigit;
    };

    // Função para validar placa (formato antigo e Mercosul)
    const isValidPlate = (plate: string) => {
      const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      
      // Verificar se tem 7 caracteres
      if (cleanPlate.length !== 7) {
        return false;
      }
      
      // Formato antigo: ABC1234 (3 letras + 4 números)
      const oldFormat = /^[A-Z]{3}[0-9]{4}$/.test(cleanPlate);
      
      // Formato Mercosul: ABC1D23 (3 letras + 1 número + 1 letra + 2 números)
      const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleanPlate);
      
      return oldFormat || mercosulFormat;
    };

    // Função para formatar CPF
    const formatCPF = (cpf: string) => {
      const cleanCPF = cpf.replace(/[^0-9]/g, '');
      if (cleanCPF.length <= 3) return cleanCPF;
      if (cleanCPF.length <= 6) return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3)}`;
      if (cleanCPF.length <= 9) return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6)}`;
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(9, 11)}`;
    };

    // Função para formatar placa
    const formatPlate = (plate: string) => {
      const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (cleanPlate.length <= 3) return cleanPlate;
      if (cleanPlate.length === 7) {
        // Verificar se é formato Mercosul
        if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleanPlate)) {
          return `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`;
        } else {
          return `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`;
        }
      }
      return `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`;
    };



    // Função para buscar morador por CPF
    const searchByCPF = async (cpf: string) => {
      try {
        const cleanCPF = cpf.replace(/[^0-9]/g, '');
        console.log('Buscando CPF:', cleanCPF);
        
        // Buscar o perfil do morador
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            cpf,
            phone,
            user_type,
            building_id
          `)
          .eq('cpf', cleanCPF)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            return null; // Não encontrado
          }
          console.error('Erro ao buscar perfil:', profileError);
          throw profileError;
        }

        if (!profileData) {
          return null;
        }

        // Buscar informações do apartamento através da tabela apartment_residents
        const { data: residentData, error: residentError } = await supabase
          .from('apartment_residents')
          .select(`
            apartment_id,
            apartments!inner(
              id,
              number,
              building_id,
              buildings!inner(
                id,
                name
              )
            )
          `)
          .eq('profile_id', profileData.id)
          .single();

        if (residentError && residentError.code !== 'PGRST116') {
          console.error('Erro ao buscar dados do apartamento:', residentError);
        }

        // Combinar os dados
        const result = {
          ...profileData,
          apartment: residentData?.apartments ? {
            number: residentData.apartments.number,
            id: residentData.apartments.id
          } : null,
          building: residentData?.apartments?.buildings ? {
            name: residentData.apartments.buildings.name,
            id: residentData.apartments.buildings.id
          } : null,
          type: 'morador'
        };

        console.log('Resultado da busca CPF:', result);
        return result;
      } catch (error) {
        console.error('Erro na busca por CPF:', error);
        throw error;
      }
    };

    // Função para buscar veículo por placa
    const searchByPlate = async (plate: string) => {
      try {
        const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const formattedPlate = formatPlate(plate);
        console.log('Buscando placa:', cleanPlate, 'e formato:', formattedPlate);
        
        // Buscar o veículo com informações do apartamento
        // Busca tanto o formato sem hífen quanto com hífen
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select(`
            id,
            license_plate,
            brand,
            model,
            color,
            type,
            apartment_id,
            apartments!inner(
              id,
              number,
              building_id,
              buildings!inner(
                id,
                name
              )
            )
          `)
          .or(`license_plate.ilike.%${cleanPlate}%,license_plate.ilike.%${formattedPlate}%`)
          .single();

        if (vehicleError) {
          if (vehicleError.code === 'PGRST116') {
            return null; // Não encontrado
          }
          console.error('Erro ao buscar veículo:', vehicleError);
          throw vehicleError;
        }

        if (!vehicleData) {
          return null;
        }

        // Não há mais relação direta com proprietário através de owner_id
        // A relação é feita através do apartment_id

        // Combinar os dados
        const result = {
          ...vehicleData,
          apartment: vehicleData.apartments ? {
            number: vehicleData.apartments.number,
            id: vehicleData.apartments.id
          } : null,
          building: vehicleData.apartments?.buildings ? {
            name: vehicleData.apartments.buildings.name,
            id: vehicleData.apartments.buildings.id
          } : null
        };

        console.log('Resultado da busca placa:', result);
        return result;
      } catch (error) {
        console.error('Erro na busca por placa:', error);
        throw error;
      }
    };



    // Função para lidar com mudança no input
    const handleInputChange = (text: string) => {
      if (searchType === 'cpf') {
        const formatted = formatCPF(text);
        setSearchQuery(formatted);
      } else {
        const formatted = formatPlate(text);
        setSearchQuery(formatted);
      }
    };

    // Função principal de busca
    const realizarBusca = async () => {
      const query = searchQuery.trim();
      
      // Validação de entrada
      if (!query) {
        setSearchError(`Digite ${searchType === 'cpf' ? 'um CPF' : 'uma placa'} para consultar`);
        return;
      }

      if (searchType === 'cpf' && !isValidCPF(query)) {
        setSearchError('CPF inválido. Verifique se possui 11 dígitos e é um CPF válido.');
        return;
      }

      if (searchType === 'placa' && !isValidPlate(query)) {
        setSearchError('Placa inválida. Use formato ABC1234 (antigo) ou ABC1D23 (Mercosul).');
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setProfileResult(null);
      setVehicleResult(null);

      try {
        if (searchType === 'cpf') {
          const result = await searchByCPF(query);
          if (result) {
            setProfileResult(result);
          } else {
            setSearchError('CPF não encontrado no sistema');
          }
        } else {
          const result = await searchByPlate(query);
          if (result) {
            setVehicleResult(result);
          } else {
            setSearchError('Placa não encontrada no sistema');
          }
        }
      } catch (error: any) {
        console.error('Erro na busca:', error);
        
        // Tratamento específico de erros
        if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
          setSearchError('Erro de conexão. Verifique sua internet e tente novamente.');
        } else if (error?.code === 'PGRST301') {
          setSearchError('Erro de permissão no banco de dados. Contate o administrador.');
        } else {
          setSearchError(`Erro ao consultar ${searchType === 'cpf' ? 'CPF' : 'placa'}. Tente novamente.`);
        }
      } finally {
        setIsSearching(false);
      }
    };

    // Função para alternar tipo de busca
    const handleSearchTypeChange = (type: 'cpf' | 'placa') => {
      setSearchType(type);
      setSearchQuery('');
      setSearchError(null);
      setProfileResult(null);
      setVehicleResult(null);
    };



    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔍 Consulta</Text>
          <Text style={styles.headerSubtitle}>Buscar moradores e veículos cadastrados</Text>
        </View>

        <View style={styles.buttonsContainer}>
          {/* Botões de alternância */}
          <View style={styles.searchTypeContainer}>
            <TouchableOpacity
              style={[
                styles.searchTypeButton,
                searchType === 'cpf' && styles.searchTypeButtonActive,
              ]}
              onPress={() => handleSearchTypeChange('cpf')}>
              <Text style={[
                styles.searchTypeButtonText,
                searchType === 'cpf' && styles.searchTypeButtonTextActive,
              ]}>👤 CPF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.searchTypeButton,
                searchType === 'placa' && styles.searchTypeButtonActive,
              ]}
              onPress={() => handleSearchTypeChange('placa')}>
              <Text style={[
                styles.searchTypeButtonText,
                searchType === 'placa' && styles.searchTypeButtonTextActive,
              ]}>🚗 Placa</Text>
            </TouchableOpacity>
          </View>

          {/* Campo de busca */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={searchType === 'cpf' ? 'Digite o CPF (000.000.000-00)' : 'Digite a placa (ABC-1234)'}
              value={searchQuery}
              onChangeText={handleInputChange}
              keyboardType={searchType === 'cpf' ? 'numeric' : 'default'}
              maxLength={searchType === 'cpf' ? 14 : 8}
              editable={!isSearching}
              autoCapitalize={searchType === 'placa' ? 'characters' : 'none'}
            />
            <TouchableOpacity
              style={[
                styles.searchButton,
                isSearching && styles.searchButtonDisabled,
              ]}
              onPress={realizarBusca}
              disabled={isSearching}>
              <Text style={styles.searchButtonText}>
                {isSearching ? '⏳ Consultando...' : '🔍 Consultar'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mensagem de Erro */}
          {searchError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ {searchError}</Text>
            </View>
          )}

          {/* Resultado CPF */}
          {profileResult && (
            <View style={[
              styles.moradorCard,
              profileResult.type === 'visitante_aprovado' && styles.visitanteAprovadoCard
            ]}>
              {/* Header do Card */}
              <View style={styles.moradorCardHeader}>
                <View style={styles.moradorHeaderLeft}>
                  <Text style={styles.moradorIcon}>
                    {profileResult.type === 'visitante_aprovado' ? '👥' : '👤'}
                  </Text>
                  <Text style={styles.moradorHeaderTitle}>
                    {profileResult.type === 'visitante_aprovado' ? 'Visitante Pré-Aprovado' : 'Morador Encontrado'}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  profileResult.type === 'visitante_aprovado' && styles.visitanteStatusBadge
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    profileResult.type === 'visitante_aprovado' && styles.visitanteStatusText
                  ]}>✓ {profileResult.type === 'visitante_aprovado' ? 'Aprovado' : 'Ativo'}</Text>
                </View>
              </View>

              {/* Informações Principais */}
              <View style={styles.moradorMainInfo}>
                <Text style={styles.moradorName}>{profileResult.full_name || profileResult.name}</Text>
                <Text style={styles.moradorLocation}>
                  🏠 Apartamento {profileResult.apartment?.number || 'N/A'} - {profileResult.building?.name || 'N/A'}
                </Text>
              </View>

              {/* Informações Secundárias */}
              <View style={styles.moradorSecondaryInfo}>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>CPF</Text>
                    <Text style={styles.infoValue}>{formatCPF(profileResult.cpf)}</Text>
                  </View>
                  {profileResult.phone && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Telefone</Text>
                      <Text style={styles.infoValue}>{profileResult.phone}</Text>
                    </View>
                  )}
                </View>
                
                {/* Botões de Ação */}
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.photoButton}
                    onPress={() => setShowPhotoModal(true)}
                  >
                    <Text style={styles.photoButtonIcon}>📷</Text>
                    <Text style={styles.photoButtonText}>Ver Foto</Text>
                  </TouchableOpacity>
                  

                </View>
              </View>
            </View>
          )}

          {/* Resultado Placa */}
          {vehicleResult && (
            <View style={styles.moradorCard}>
              {/* Header do Card */}
              <View style={styles.moradorCardHeader}>
                <View style={styles.moradorHeaderLeft}>
                  <Text style={styles.moradorIcon}>🚗</Text>
                  <Text style={styles.moradorHeaderTitle}>Veículo Encontrado</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>✓ Ativo</Text>
                </View>
              </View>

              {/* Informações Principais */}
              <View style={styles.moradorMainInfo}>
                <Text style={styles.moradorName}>{vehicleResult.brand} {vehicleResult.model}</Text>
                <Text style={styles.moradorLocation}>
                  🏠 Apartamento {vehicleResult.apartment?.number || 'N/A'} - {vehicleResult.building?.name || 'N/A'}
                </Text>
              </View>

              {/* Informações Secundárias */}
              <View style={styles.moradorSecondaryInfo}>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Placa</Text>
                    <Text style={styles.infoValue}>{formatPlate(vehicleResult.license_plate)}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Cor</Text>
                    <Text style={styles.infoValue}>{vehicleResult.color}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Tipo</Text>
                    <Text style={styles.infoValue}>{vehicleResult.type || 'Carro'}</Text>
                  </View>

                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderAvisosTab = () => {
    const getIconeAviso = (tipo: string) => {
      switch (tipo) {
        case 'manutencao':
          return '🔧';
        case 'reuniao':
          return '👥';
        case 'obra':
          return '🏗️';
        case 'informativo':
          return 'ℹ️';
        case 'notice':
          return '📢';
        case 'urgent':
          return '🚨';
        case 'maintenance':
          return '🔧';
        case 'meeting':
          return '👥';
        default:
          return '📢';
      }
    };

    const getCorPrioridade = (prioridade: string) => {
      switch (prioridade) {
        case 'alta':
        case 'high':
          return '#FF5722';
        case 'media':
        case 'medium':
          return '#FF9800';
        case 'baixa':
        case 'low':
          return '#4CAF50';
        case 'normal':
        default:
          return '#2196F3';
      }
    };

    const formatDateTime = (dateString: string) => {
      const date = new Date(dateString);
      // Manual date/time formatting to avoid Hermes locale issues
    const day = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return { day, time };
    };

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📢 Avisos</Text>
          <Text style={styles.headerSubtitle}>Comunicados do condomínio</Text>
        </View>

        {loadingCommunications ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando comunicados...</Text>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            {communications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>Nenhum comunicado</Text>
                <Text style={styles.emptySubtitle}>Não há comunicados disponíveis no momento</Text>
              </View>
            ) : (
              communications.map((comunicado) => {
                const { day, time } = formatDateTime(comunicado.created_at);
                const authorName = comunicado.admin_profiles?.full_name || 'Administração';
                
                return (
                  <View
                    key={comunicado.id}
                    style={flattenStyles([
                      styles.avisoCard,
                      { borderLeftColor: getCorPrioridade(comunicado.priority) },
                    ])}>
                    <View style={styles.avisoHeader}>
                      <Text style={styles.avisoIcon}>{getIconeAviso(comunicado.type)}</Text>
                      <View style={styles.avisoInfo}>
                        <Text style={styles.avisoTitle}>{comunicado.title}</Text>
                        <Text style={styles.avisoAuthor}>Por {authorName}</Text>
                        <Text style={styles.avisoDateTime}>
                          {day} às {time}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.avisoDescription}>{comunicado.content}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    );
  };



  // Função para renderizar a aba de logs
  const renderLogsTab = () => {
    return <ActivityLogs />;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chegada':
        return renderChegadaTab();
      case 'autorizacoes':
        return (
          <AutorizacoesTab
            autorizacoes={autorizacoes}
            loadingAutorizacoes={loadingAutorizacoes}
            authSearchQuery={authSearchQuery}
            setAuthSearchQuery={setAuthSearchQuery}
            filteredAutorizacoes={filteredAutorizacoes}
            logs={logs}
            loadingLogs={loadingLogs}
            pendingDeliveries={pendingDeliveries}
            scheduledVisits={scheduledVisits}
            showConfirmModal={showConfirmModal}
            setShowConfirmModal={setShowConfirmModal}
            selectedAuth={selectedAuth}
            countdown={countdown}
            supabase={supabase}
            user={user}
            buildingIdRef={buildingIdRef}
            showConfirmationModal={showConfirmationModal}
          />
        );
      case 'consulta':
        return renderConsultaTab();
      case 'avisos':
        return renderAvisosTab();
      case 'logs':
        return renderLogsTab();
      default:
        return renderChegadaTab();
    }
  };

  return (
    <ProtectedRoute redirectTo="/porteiro/login" userType="porteiro">
      {/* Renderizar fluxos modais */}
      {activeFlow === 'visitante' && (
        <RegistrarVisitante
          onClose={() => setActiveFlow(null)}
          onConfirm={(message: string) => {
            setActiveFlow(null);
            showConfirmationModal(message);
          }}
        />
      )}

      {activeFlow === 'encomenda' && (
        <RegistrarEncomenda
          onClose={() => setActiveFlow(null)}
          onConfirm={(message: string) => {
            setActiveFlow(null);
            showConfirmationModal(message);
          }}
        />
      )}

      {activeFlow === 'veiculo' && (
        <RegistrarVeiculo
          onClose={() => setActiveFlow(null)}
          onConfirm={(message: string) => {
            setActiveFlow(null);
            showConfirmationModal(message);
          }}
        />
      )}

      {!activeFlow && (
        <SafeAreaView style={styles.container}>
          {renderTopMenu()}
          <View style={styles.content}>{renderTabContent()}</View>

          {/* Navegação Inferior Fixa */}
          <View style={styles.bottomNavigation}>
            <TouchableOpacity
              style={flattenStyles([
                styles.navItem,
                activeTab === 'chegada' && styles.navItemActive,
              ])}
              onPress={() => setActiveTab('chegada')}>
              <Text
                style={flattenStyles([
                  styles.navIcon,
                  activeTab === 'chegada' && styles.navIconActive,
                ])}>
                🏠
              </Text>
              <Text
                style={flattenStyles([
                  styles.navLabel,
                  activeTab === 'chegada' && styles.navLabelActive,
                ])}>
                Chegada
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyles([
                styles.navItem,
                activeTab === 'autorizacoes' && styles.navItemActive,
              ])}
              onPress={() => setActiveTab('autorizacoes')}>
              <Text
                style={flattenStyles([
                  styles.navIcon,
                  activeTab === 'autorizacoes' && styles.navIconActive,
                ])}>
                ✅
              </Text>
              <Text
                style={flattenStyles([
                  styles.navLabel,
                  activeTab === 'autorizacoes' && styles.navLabelActive,
                ])}>
                Autorizações
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyles([
                styles.navItem,
                activeTab === 'consulta' && styles.navItemActive,
              ])}
              onPress={() => setActiveTab('consulta')}>
              <Text
                style={flattenStyles([
                  styles.navIcon,
                  activeTab === 'consulta' && styles.navIconActive,
                ])}>
                🔍
              </Text>
              <Text
                style={flattenStyles([
                  styles.navLabel,
                  activeTab === 'consulta' && styles.navLabelActive,
                ])}>
                Consulta
              </Text>
            </TouchableOpacity>



            <TouchableOpacity
              style={flattenStyles([
                styles.navItem,
                activeTab === 'logs' && styles.navItemActive,
              ])}
              onPress={() => setActiveTab('logs')}>
              <Text
                style={flattenStyles([
                  styles.navIcon,
                  activeTab === 'logs' && styles.navIconActive,
                ])}>
                📋
              </Text>
              <Text
                style={flattenStyles([
                  styles.navLabel,
                  activeTab === 'logs' && styles.navLabelActive,
                ])}>
                Logs
              </Text>
            </TouchableOpacity>

          </View>
        </SafeAreaView>
      )}

      {/* Modal de Confirmação */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeConfirmModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.confirmModalIcon}>✅</Text>
            <Text style={styles.confirmModalTitle}>Registro Confirmado!</Text>
            <Text style={styles.confirmModalMessage}>{confirmMessage}</Text>
            <Text style={styles.countdownText}>
              Fechando automaticamente em {countdown} segundos...
            </Text>
            <TouchableOpacity style={styles.closeModalButton} onPress={closeConfirmModal}>
              <Text style={styles.closeModalButtonText}>Fechar Manualmente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Foto do Morador */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}>
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalContainer}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle}>
                {profileResult?.full_name || 'Morador'}
              </Text>
              <TouchableOpacity 
                style={styles.photoModalCloseButton}
                onPress={() => setShowPhotoModal(false)}>
                <Text style={styles.photoModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.photoContainer}>
              {profileResult?.photo_url ? (
                <Image 
                  source={{ uri: profileResult.photo_url }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>👤</Text>
                  <Text style={styles.photoPlaceholderText}>Foto não disponível</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.photoModalButton}
              onPress={() => setShowPhotoModal(false)}>
              <Text style={styles.photoModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Imagem */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}>
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalContainer}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle}>Imagem</Text>
              <TouchableOpacity 
                style={styles.photoModalCloseButton}
                onPress={closeImageModal}>
                <Text style={styles.photoModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.photoContainer}>
              {selectedImageUrl ? (
                <Image 
                  source={{ uri: selectedImageUrl }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>🖼️</Text>
                  <Text style={styles.photoPlaceholderText}>Imagem não disponível</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.photoModalButton}
              onPress={closeImageModal}>
              <Text style={styles.photoModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    marginBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  buttonsContainer: {
    padding: 20,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 5,
  },
  visitorButton: {
    borderLeftColor: '#4CAF50',
  },
  deliveryButton: {
    borderLeftColor: '#FF9800',
  },
  vehicleButton: {
    borderLeftColor: '#2196F3',
  },
  buttonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  buttonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  navItemActive: {
    backgroundColor: '#e3f2fd',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  authorizationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  authCardIcon: {
    fontSize: 32,
    marginRight: 16,
    marginTop: 4,
  },
  authCardInfo: {
    flex: 1,
  },
  authCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    flex: 1,
    marginRight: 8,
  },
  authCardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  authCardTime: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  authCardStatus: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 4,
  },
  authCardSchedule: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  scheduleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  scheduleText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  frequentVisitorTag: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  frequentVisitorText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para status do destino
  destinationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  destinationStatusLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  destinationStatusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'uppercase',
  },
  destinationPending: {
    color: '#FF9800',
    fontStyle: 'italic',
  },
  // Estilos para container de botões
  authCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Estilos para filtros da nova interface
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  filterCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  // Estilos para cartões de atividades
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
  },
  deliveryCard: {
    borderLeftColor: '#FF9800',
  },
  visitCard: {
    borderLeftColor: '#4CAF50',
  },
  activityCardContent: {
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  activityStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statusPending: {
    color: '#FF9800',
  },
  statusApproved: {
    color: '#4CAF50',
  },
  statusRejected: {
    color: '#f44336',
  },
  // Estilos para conteúdo expandido e ações
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  visitorPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 12,
  },
  activityDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  activityActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primaryAction: {
    backgroundColor: '#4CAF50',
  },
  secondaryAction: {
    backgroundColor: '#f44336',
  },
  noActivitiesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noActivitiesIcon: {
    fontSize: 48,
    color: '#ccc',
    marginBottom: 16,
  },
  noActivitiesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
    position: 'relative',
    gap: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearSearchText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  searchButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  resultApartment: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  expandIcon: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  noResultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 5,
    borderLeftColor: '#FF5722',
  },
  noResultIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noResultText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  noResultSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  avisoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
  },
  avisoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avisoIcon: {
    fontSize: 28,
    marginRight: 16,
    marginTop: 2,
  },
  avisoInfo: {
    flex: 1,
  },
  avisoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  avisoAuthor: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  avisoDateTime: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  avisoDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'justify',
  },

  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Estilos para menu superior
  topMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 100,
  },
  topMenuLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  shiftText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  topMenuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  panicButton: {
    backgroundColor: '#FF5722',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  panicButtonText: {
    fontSize: 20,
  },
  userAvatar: {
    backgroundColor: '#2196F3',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userMenu: {
    position: 'absolute',
    top: 50,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 180,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingVertical: 8,
    zIndex: 1000,
  },
  userMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userMenuItemText: {
    fontSize: 14,
    color: '#333',
  },
  userMenuItemLast: {
    borderBottomWidth: 0,
  },
  // Estilos para consulta
  searchTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchTypeButtonActive: {
    backgroundColor: '#2196F3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  searchTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  searchTypeButtonTextActive: {
    color: '#fff',
  },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  resultContent: {
    gap: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  resultValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  statusActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  statusInactive: {
    color: '#FF5722',
    fontWeight: 'bold',
    padding: 8,
    minWidth: 120,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 999999,
  },
  // Novos estilos para cards de morador/veículo
  moradorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  moradorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  moradorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moradorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  moradorHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  moradorMainInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  moradorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  moradorLocation: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  moradorSecondaryInfo: {
    padding: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },

  userMenuIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  userMenuText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  // Novos estilos para autorizações
  authCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  statusTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  authCardStatus: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 4,
  },
  encomendaButton: {
    backgroundColor: '#9C27B0',
  },
  autorizedButton: {
    backgroundColor: '#4CAF50',
  },
  // Estilos do modal de confirmação
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    maxWidth: 350,
  },
  confirmModalIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  countdownText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  closeModalButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    maxWidth: 350,
    width: '100%',
  },
  // Novos estilos para resultados de busca
  resultsSection: {
    marginBottom: 20,
  },
  resultsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 4,
  },
  resultDetail: {
    fontSize: 13,
    color: '#555',
    marginBottom: 3,
  },
  resultBuilding: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
    marginBottom: 2,
  },
  resultType: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
    marginTop: 4,
  },
  // Estilos para filtros de busca
  searchFilters: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  errorText: {
    color: '#FF5722',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  // Estilos para a aba de avisos
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Estilos do modal de foto
  photoModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  photoModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  photoModalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  photoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 200,
  },
  photoModalImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 40,
    width: '100%',
    height: 300,
  },
  photoPlaceholderIcon: {
    fontSize: 64,
    color: '#ccc',
    marginBottom: 10,
  },
  photoPlaceholderText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  photoModalButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  photoModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para os cards de logs
  logSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  logSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 4,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  logInfo: {
    flex: 1,
    marginRight: 12,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  logSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  logMeta: {
    alignItems: 'flex-end',
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  logTime: {
    fontSize: 11,
    color: '#999',
  },
  logPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginTop: 8,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
    marginVertical: 20,
  },
  // Estilos para visitante pré-aprovado
  visitanteAprovadoCard: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  visitanteStatusBadge: {
    backgroundColor: '#4CAF50',
  },
  visitanteStatusText: {
    color: '#fff',
  },
  // Estilos para botões de ação
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  checkinButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  checkinButtonIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  checkinButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

});
