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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [expandedCard, setExpandedCard] = useState(false);

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
    // TODO: Implementar consulta real no Supabase
    const dadosConsulta: any = {};
    // const dadosConsulta = await consultarPessoaOuVeiculo(termoBusca);

    const realizarBusca = () => {
      const query = searchQuery.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const resultado = dadosConsulta[query as keyof typeof dadosConsulta];
      setSearchResult(resultado || null);
      setExpandedCard(false);
    };

    const toggleExpanded = () => {
      setExpandedCard(!expandedCard);
    };

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔍 Consulta</Text>
          <Text style={styles.headerSubtitle}>Buscar por CPF ou placa</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Digite CPF (123.456.789-01) ou placa (ABC-1234)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.searchButton} onPress={realizarBusca}>
              <Text style={styles.searchButtonText}>🔍 Buscar</Text>
            </TouchableOpacity>
          </View>

          {searchResult ? (
            <TouchableOpacity style={styles.resultCard} onPress={toggleExpanded}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>{searchResult.foto}</Text>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle}>
                    {searchResult.tipo === 'pessoa'
                      ? searchResult.nome
                      : `${searchResult.marca} ${searchResult.modelo}`}
                  </Text>
                  <Text style={styles.resultSubtitle}>
                    {searchResult.tipo === 'pessoa'
                      ? `CPF: ${searchResult.cpf}`
                      : `Placa: ${searchResult.placa}`}
                  </Text>
                  {searchResult.apartamento && (
                    <Text style={styles.resultApartment}>
                      Apartamento {searchResult.apartamento}
                    </Text>
                  )}
                </View>
                <Text style={styles.expandIcon}>{expandedCard ? '▼' : '▶'}</Text>
              </View>

              {expandedCard && (
                <View style={styles.expandedContent}>
                  {searchResult.tipo === 'pessoa' ? (
                    <>
                      <Text style={styles.detailItem}>📞 Telefone: {searchResult.telefone}</Text>
                      <Text style={styles.detailItem}>
                        🕒 Última visita: {searchResult.ultimaVisita}
                      </Text>
                      <Text style={styles.detailItem}>
                        📝 Observações: {searchResult.observacoes}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailItem}>🎨 Cor: {searchResult.cor}</Text>
                      <Text style={styles.detailItem}>
                        👤 Proprietário: {searchResult.proprietario}
                      </Text>
                      <Text style={styles.detailItem}>
                        🕒 Última entrada: {searchResult.ultimaEntrada}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ) : (
            searchQuery && (
              <View style={styles.noResultCard}>
                <Text style={styles.noResultIcon}>❌</Text>
                <Text style={styles.noResultText}>Nenhum resultado encontrado</Text>
                <Text style={styles.noResultSubtext}>
                  Verifique se o CPF ou placa estão corretos
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
    );
  };

  const renderAvisosTab = () => {
    // TODO: Carregar avisos reais do Supabase
    const avisos: any[] = [];
    // const avisos = await getAvisosCondominio();

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
        default:
          return '📢';
      }
    };

    const getCorPrioridade = (prioridade: string) => {
      switch (prioridade) {
        case 'alta':
          return '#FF5722';
        case 'media':
          return '#FF9800';
        case 'baixa':
          return '#4CAF50';
        default:
          return '#2196F3';
      }
    };

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📢 Avisos</Text>
          <Text style={styles.headerSubtitle}>Comunicados do condomínio</Text>
        </View>

        <View style={styles.buttonsContainer}>
          {avisos.map((aviso) => (
            <View
              key={aviso.id}
              style={flattenStyles([
                styles.avisoCard,
                { borderLeftColor: getCorPrioridade(aviso.prioridade) },
              ])}>
              <View style={styles.avisoHeader}>
                <Text style={styles.avisoIcon}>{getIconeAviso(aviso.tipo)}</Text>
                <View style={styles.avisoInfo}>
                  <Text style={styles.avisoTitle}>{aviso.titulo}</Text>
                  <Text style={styles.avisoAuthor}>Por {aviso.autor}</Text>
                  <Text style={styles.avisoDateTime}>
                    {aviso.data} às {aviso.hora}
                  </Text>
                </View>
              </View>

              <Text style={styles.avisoDescription}>{aviso.descricao}</Text>
            </View>
          ))}
        </View>
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
  userMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
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
});
