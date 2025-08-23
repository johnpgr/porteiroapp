import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';
import RegistrarVisitante from '~/components/porteiro/RegistrarVisitante';
import RegistrarEncomenda from '~/components/porteiro/RegistrarEncomenda';
import RegistrarVeiculo from '~/components/porteiro/RegistrarVeiculo';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';
import { flattenStyles } from '~/utils/styles';
import { useAuth } from '~/hooks/useAuth';

type TabType = 'chegada' | 'autorizacoes' | 'consulta' | 'avisos' | 'historico';

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
  


  // Estados para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

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
  const loadCommunications = async () => {
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
  };

  // Carregar dados do porteiro
  useEffect(() => {
    const loadPorteiroData = async () => {
      if (!user || authLoading) return;
      
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
          return;
        }
        
        // Buscar dados do perfil do porteiro incluindo work_schedule
        console.log('🔍 Buscando dados do perfil para usuário:', user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, work_schedule')
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
          console.log('✅ Perfil encontrado - work_schedule:', profile.work_schedule);
          const nameParts = (profile.full_name || profile.email.split('@')[0]).split(' ');
          const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('').slice(0, 2);
          const schedule = parseWorkSchedule(profile.work_schedule);
          
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
      } finally {
        setLoadingPorteiro(false);
      }
    };
    
    loadPorteiroData();
  }, [user, authLoading]);
  
  // Carregar comunicados quando a aba avisos for ativada
  useEffect(() => {
    if (activeTab === 'avisos' && user) {
      loadCommunications();
    }
  }, [activeTab, user]);

  const handlePanicButton = () => {
    router.push('/emergency');
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

          {/* Resultado da Consulta */}
          {profileResult && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>✅ Morador Encontrado</Text>
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultName}>{profileResult.name}</Text>
                  <Text style={styles.resultType}>Cadastrado</Text>
                </View>
                <Text style={styles.resultDetail}>🆔 CPF: {profileResult.cpf}</Text>
                 <Text style={styles.resultDetail}>
                   🏠 Apartamento {profileResult.apartment?.number || 'N/A'} - {profileResult.building?.name || 'N/A'}
                 </Text>
                {profileResult.phone && (
                  <Text style={styles.resultDetail}>📱 {profileResult.phone}</Text>
                )}
              </View>
            </View>
          )}

          {/* Mensagem quando não encontrado */}
          {searchError && searchError.includes('não encontrado') && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>❌ Morador Não Encontrado</Text>
              <View style={styles.resultCard}>
                <Text style={styles.resultDetail}>
                  O CPF informado não está cadastrado no sistema.
                </Text>
              </View>
            </View>
          )}
         </View>
      </View>
    );
  };

  const renderChegadaTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏠 Chegadas</Text>
        <Text style={styles.headerSubtitle}>Registre visitantes, encomendas e veículos</Text>
      </View>

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

  const renderAutorizacoesTab = () => {
    // TODO: Carregar autorizações reais do Supabase
    const autorizacoes: any[] = [];
    // const autorizacoes = await getAutorizacoesPendentes();

    const confirmarChegada = (autorizacao: any) => {
      setSelectedAuth(autorizacao);
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

    const getStatusTag = (autorizacao: any) => {
      return (
        <View
          style={flattenStyles([styles.statusTag, { backgroundColor: autorizacao.statusColor }])}>
          <Text style={styles.statusTagText}>{autorizacao.statusLabel}</Text>
        </View>
      );
    };

    return (
      <>
        <ScrollView style={styles.tabContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>✅ Autorizações</Text>
            <Text style={styles.headerSubtitle}>Convidados pré-aprovados e encomendas</Text>
          </View>

          <View style={styles.buttonsContainer}>
            {autorizacoes.map((autorizacao) => (
              <View key={autorizacao.id} style={styles.authorizationCard}>
                <View style={styles.authCardHeader}>
                  <Text style={styles.authCardIcon}>
                    {autorizacao.tipo === 'Visitante'
                      ? '👤'
                      : autorizacao.tipo === 'Prestador de Serviço'
                        ? '🔧'
                        : autorizacao.tipo === 'Convidado'
                          ? '🎉'
                          : autorizacao.tipo === 'Encomenda'
                            ? '📦'
                            : '👤'}
                  </Text>
                  <View style={styles.authCardInfo}>
                    <View style={styles.authCardTitleRow}>
                      <Text style={styles.authCardTitle}>
                        {autorizacao.isEncomenda ? 'Encomenda' : 'Convidado'}{' '}
                        {autorizacao.nomeConvidado}
                      </Text>
                      {getStatusTag(autorizacao)}
                    </View>
                    <Text style={styles.authCardSubtitle}>
                      {autorizacao.isEncomenda
                        ? `Solicitado por ${autorizacao.moradorAprovador} - Apt. ${autorizacao.apartamento}`
                        : `Aprovado por ${autorizacao.moradorAprovador} do Apartamento ${autorizacao.apartamento}`}
                    </Text>
                    <Text style={styles.authCardTime}>
                      {autorizacao.dataAprovacao} às {autorizacao.horaAprovacao}
                    </Text>
                    {autorizacao.jaAutorizado && (
                      <Text style={styles.authCardStatus}>✅ Morador já autorizou a subida</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    autorizacao.isEncomenda && styles.encomendaButton,
                    autorizacao.jaAutorizado && styles.autorizedButton,
                  ]}
                  onPress={() => confirmarChegada(autorizacao)}>
                  <Text style={styles.confirmButtonText}>
                    {autorizacao.isEncomenda
                      ? '📦 Receber Encomenda'
                      : autorizacao.jaAutorizado
                        ? '✅ Liberar Subida'
                        : '✓ Confirmar Chegada'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Modal de Confirmação */}
        {showConfirmModal && selectedAuth && (
          <View style={styles.modalOverlay}>
            <View style={styles.confirmModal}>
              <Text style={styles.confirmModalIcon}>✅</Text>
              <Text style={styles.confirmModalTitle}>Morador Notificado!</Text>
              <Text style={styles.confirmModalMessage}>
                {selectedAuth.isEncomenda
                  ? `A encomenda de ${selectedAuth.nomeConvidado} foi registrada na portaria.`
                  : selectedAuth.jaAutorizado
                    ? `${selectedAuth.nomeConvidado} foi liberado para subir ao apartamento ${selectedAuth.apartamento}.`
                    : `O morador do apartamento ${selectedAuth.apartamento} foi notificado sobre a chegada de ${selectedAuth.nomeConvidado}.`}
              </Text>
              <Text style={styles.countdownText}>Fechando em {countdown} segundos...</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.closeModalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </>
    );
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
            is_owner,
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
          is_owner: residentData?.is_owner || false
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
        console.log('Buscando placa:', cleanPlate);
        
        // Buscar o veículo com informações do apartamento
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
          .eq('license_plate', cleanPlate)
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

        // Buscar o proprietário do veículo através da tabela apartment_residents
        const { data: ownerData, error: ownerError } = await supabase
          .from('apartment_residents')
          .select(`
            profile_id,
            is_owner,
            profiles!inner(
              id,
              full_name,
              phone
            )
          `)
          .eq('apartment_id', vehicleData.apartment_id)
          .eq('is_owner', true)
          .single();

        if (ownerError && ownerError.code !== 'PGRST116') {
          console.error('Erro ao buscar proprietário:', ownerError);
        }

        // Combinar os dados
        const result = {
          ...vehicleData,
          owner: ownerData?.profiles || null,
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
            <View style={styles.moradorCard}>
              {/* Header do Card */}
              <View style={styles.moradorCardHeader}>
                <View style={styles.moradorHeaderLeft}>
                  <Text style={styles.moradorIcon}>👤</Text>
                  <Text style={styles.moradorHeaderTitle}>Morador Encontrado</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>✓ Ativo</Text>
                </View>
              </View>

              {/* Informações Principais */}
              <View style={styles.moradorMainInfo}>
                <Text style={styles.moradorName}>{profileResult.full_name}</Text>
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
                  {vehicleResult.owner?.full_name && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Proprietário</Text>
                      <Text style={styles.infoValue}>{vehicleResult.owner.full_name}</Text>
                    </View>
                  )}
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
      const day = date.toLocaleDateString('pt-BR');
      const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  const renderHistoricoTab = () => {
    // TODO: Carregar histórico real do Supabase
    const historico: any[] = [];
    // const historico = await getHistoricoPorteiro();

    const getIconeAcao = (tipo: string) => {
      switch (tipo) {
        case 'visitante':
          return '👤';
        case 'encomenda':
          return '📦';
        case 'veiculo':
          return '🚗';
        case 'autorizacao':
          return '✅';
        case 'consulta':
          return '🔍';
        case 'sistema':
          return '⚙️';
        default:
          return '📝';
      }
    };

    const getCorStatus = (status: string) => {
      switch (status) {
        case 'concluido':
          return '#4CAF50';
        case 'ativo':
          return '#2196F3';
        case 'pendente':
          return '#FF9800';
        default:
          return '#666';
      }
    };

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📚 Histórico</Text>
          <Text style={styles.headerSubtitle}>Atividades do turno</Text>
        </View>

        <View style={styles.buttonsContainer}>
          {historico.map((item) => (
            <View
              key={item.id}
              style={flattenStyles([
                styles.historicoCard,
                { borderLeftColor: getCorStatus(item.status) },
              ])}>
              <View style={styles.historicoHeader}>
                <Text style={styles.historicoIcon}>{getIconeAcao(item.tipo)}</Text>
                <View style={styles.historicoInfo}>
                  <Text style={styles.historicoAcao}>{item.acao}</Text>
                  <Text style={styles.historicoDetalhes}>{item.detalhes}</Text>
                  <Text style={styles.historicoDateTime}>
                    {item.data} às {item.hora}
                  </Text>
                </View>
                <View
                  style={flattenStyles([
                    styles.statusBadge,
                    { backgroundColor: getCorStatus(item.status) },
                  ])}>
                  <Text style={styles.statusText}>
                    {item.status === 'concluido' ? '✓' : item.status === 'ativo' ? '●' : '⏳'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chegada':
        return renderChegadaTab();
      case 'autorizacoes':
        return renderAutorizacoesTab();
      case 'consulta':
        return renderConsultaTab();
      case 'avisos':
        return renderAvisosTab();
      case 'historico':
        return renderHistoricoTab();
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
                activeTab === 'avisos' && styles.navItemActive,
              ])}
              onPress={() => setActiveTab('avisos')}>
              <Text
                style={flattenStyles([
                  styles.navIcon,
                  activeTab === 'avisos' && styles.navIconActive,
                ])}>
                📢
              </Text>
              <Text
                style={flattenStyles([
                  styles.navLabel,
                  activeTab === 'avisos' && styles.navLabelActive,
                ])}>
                Avisos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={flattenStyles([
                styles.navItem,
                activeTab === 'historico' && styles.navItemActive,
              ])}
              onPress={() => setActiveTab('historico')}>
              <Text
                style={flattenStyles([
                  styles.navIcon,
                  activeTab === 'historico' && styles.navIconActive,
                ])}>
                📚
              </Text>
              <Text
                style={flattenStyles([
                  styles.navLabel,
                  activeTab === 'historico' && styles.navLabelActive,
                ])}>
                Histórico
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
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
    gap: 20,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
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
  confirmButton: {
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
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  // Estilos para histórico
  historicoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historicoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historicoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  historicoInfo: {
    flex: 1,
  },
  historicoAcao: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historicoDetalhes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  historicoDateTime: {
    fontSize: 12,
    color: '#999',
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
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
    marginLeft: 8,
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
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
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
});
