import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Alert } from 'react-native';
import { Container } from '~/components/Container';
import ProtectedRoute from '~/components/ProtectedRoute';
import RegistrarVisitante from '~/components/porteiro/RegistrarVisitante';
import RegistrarEncomenda from '~/components/porteiro/RegistrarEncomenda';
import RegistrarVeiculo from '~/components/porteiro/RegistrarVeiculo';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';

type TabType = 'chegada' | 'autorizacoes' | 'consulta' | 'avisos' | 'historico';

export default function PorteiroDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('chegada');
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Estados para a aba Consulta
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [expandedCard, setExpandedCard] = useState(false);

  const handlePanicButton = () => {
    router.push('/emergency');
  };

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirmar Logout',
      'Deseja realmente sair do sistema?',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
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
          }
        }
      ]
    );
  };

  const renderTopMenu = () => (
    <View style={styles.topMenu}>
      <View style={styles.topMenuLeft}>
        <Text style={styles.welcomeText}>Olá, João Silva</Text>
        <Text style={styles.shiftText}>Turno: 08:00 - 20:00</Text>
      </View>
      
      <View style={styles.topMenuRight}>
        {/* Botão de Pânico */}
        <TouchableOpacity 
          style={styles.panicButton}
          onPress={handlePanicButton}
        >
          <Text style={styles.panicButtonText}>🚨</Text>
        </TouchableOpacity>
        
        {/* Avatar do Usuário */}
        <TouchableOpacity 
          style={styles.userAvatar}
          onPress={handleUserMenuToggle}
        >
          <Text style={styles.avatarText}>JS</Text>
        </TouchableOpacity>
        
        {/* Menu do Usuário */}
        {showUserMenu && (
          <View style={styles.userMenu}>
            <TouchableOpacity 
              style={styles.userMenuItem}
              onPress={() => {
                setShowUserMenu(false);
                router.push('/porteiro/profile');
              }}
            >
              <Text style={styles.userMenuIcon}>👤</Text>
              <Text style={styles.userMenuText}>Perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.userMenuItem}
              onPress={handleLogout}
            >
              <Text style={styles.userMenuIcon}>🚪</Text>
              <Text style={styles.userMenuText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderChegadaTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏠 Chegadas</Text>
        <Text style={styles.headerSubtitle}>Registre visitantes, encomendas e veículos</Text>
      </View>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.visitorButton]}
          onPress={() => setActiveFlow('visitante')}
        >
          <Text style={styles.buttonIcon}>👋</Text>
          <Text style={styles.buttonTitle}>Registrar Visitante</Text>
          <Text style={styles.buttonDescription}>Cadastrar nova visita</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.deliveryButton]}
          onPress={() => setActiveFlow('encomenda')}
        >
          <Text style={styles.buttonIcon}>📦</Text>
          <Text style={styles.buttonTitle}>Registrar Encomenda</Text>
          <Text style={styles.buttonDescription}>Receber entrega</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.vehicleButton]}
          onPress={() => setActiveFlow('veiculo')}
        >
          <Text style={styles.buttonIcon}>🚗</Text>
          <Text style={styles.buttonTitle}>Registrar Veículo</Text>
          <Text style={styles.buttonDescription}>Autorizar entrada</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderAutorizacoesTab = () => {
    // Dados mockados de autorizações pré-aprovadas
    const autorizacoes = [
      {
        id: 1,
        nomeConvidado: 'Carlos Silva',
        moradorAprovador: 'José Silva',
        apartamento: '101',
        dataAprovacao: '2024-01-15',
        horaAprovacao: '14:30',
        tipo: 'Visitante'
      },
      {
        id: 2,
        nomeConvidado: 'Maria Santos',
        moradorAprovador: 'Ana Costa',
        apartamento: '205',
        dataAprovacao: '2024-01-15',
        horaAprovacao: '16:45',
        tipo: 'Prestador de Serviço'
      },
      {
        id: 3,
        nomeConvidado: 'João Oliveira',
        moradorAprovador: 'Pedro Lima',
        apartamento: '304',
        dataAprovacao: '2024-01-15',
        horaAprovacao: '18:20',
        tipo: 'Visitante'
      }
    ];

    const confirmarChegada = (autorizacao: any) => {
      // Aqui seria implementada a lógica para registrar a chegada
      alert(`Chegada confirmada para ${autorizacao.nomeConvidado}`);
    };

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>✅ Autorizações</Text>
          <Text style={styles.headerSubtitle}>Convidados pré-aprovados</Text>
        </View>
        
        <View style={styles.buttonsContainer}>
          {autorizacoes.map((autorizacao) => (
            <View key={autorizacao.id} style={styles.authorizationCard}>
              <View style={styles.authCardHeader}>
                <Text style={styles.authCardIcon}>{autorizacao.tipo === 'Visitante' ? '👤' : '🔧'}</Text>
                <View style={styles.authCardInfo}>
                  <Text style={styles.authCardTitle}>Convidado {autorizacao.nomeConvidado}</Text>
                  <Text style={styles.authCardSubtitle}>
                    Aprovado por {autorizacao.moradorAprovador} do Apartamento {autorizacao.apartamento}
                  </Text>
                  <Text style={styles.authCardTime}>
                    {autorizacao.dataAprovacao} às {autorizacao.horaAprovacao}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={() => confirmarChegada(autorizacao)}
              >
                <Text style={styles.confirmButtonText}>✓ Confirmar Chegada</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderConsultaTab = () => {
    // Dados mockados para consulta
    const dadosConsulta = {
      '12345678901': {
        tipo: 'pessoa',
        nome: 'Carlos Silva',
        cpf: '123.456.789-01',
        apartamento: '101',
        telefone: '(11) 99999-9999',
        foto: '👤',
        ultimaVisita: '2024-01-10 às 15:30',
        observacoes: 'Visitante frequente'
      },
      'ABC1234': {
        tipo: 'veiculo',
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        cor: 'Prata',
        proprietario: 'José Silva',
        apartamento: '101',
        foto: '🚗',
        ultimaEntrada: '2024-01-12 às 08:45'
      }
    };

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
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={realizarBusca}
            >
              <Text style={styles.searchButtonText}>🔍 Buscar</Text>
            </TouchableOpacity>
          </View>

          {searchResult ? (
            <TouchableOpacity 
              style={styles.resultCard}
              onPress={toggleExpanded}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>{searchResult.foto}</Text>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle}>
                    {searchResult.tipo === 'pessoa' ? searchResult.nome : `${searchResult.marca} ${searchResult.modelo}`}
                  </Text>
                  <Text style={styles.resultSubtitle}>
                    {searchResult.tipo === 'pessoa' ? `CPF: ${searchResult.cpf}` : `Placa: ${searchResult.placa}`}
                  </Text>
                  {searchResult.apartamento && (
                    <Text style={styles.resultApartment}>Apartamento {searchResult.apartamento}</Text>
                  )}
                </View>
                <Text style={styles.expandIcon}>{expandedCard ? '▼' : '▶'}</Text>
              </View>
              
              {expandedCard && (
                <View style={styles.expandedContent}>
                  {searchResult.tipo === 'pessoa' ? (
                    <>
                      <Text style={styles.detailItem}>📞 Telefone: {searchResult.telefone}</Text>
                      <Text style={styles.detailItem}>🕒 Última visita: {searchResult.ultimaVisita}</Text>
                      <Text style={styles.detailItem}>📝 Observações: {searchResult.observacoes}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailItem}>🎨 Cor: {searchResult.cor}</Text>
                      <Text style={styles.detailItem}>👤 Proprietário: {searchResult.proprietario}</Text>
                      <Text style={styles.detailItem}>🕒 Última entrada: {searchResult.ultimaEntrada}</Text>
                    </>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ) : searchQuery && (
            <View style={styles.noResultCard}>
              <Text style={styles.noResultIcon}>❌</Text>
              <Text style={styles.noResultText}>Nenhum resultado encontrado</Text>
              <Text style={styles.noResultSubtext}>Verifique se o CPF ou placa estão corretos</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderAvisosTab = () => {
    // Dados mockados de avisos do condomínio
    const avisos = [
      {
        id: 1,
        titulo: 'Manutenção do elevador',
        descricao: 'Manutenção programada para amanhã às 8h. Elevador ficará indisponível das 8h às 17h.',
        data: '2024-01-15',
        hora: '09:30',
        autor: 'Administração',
        tipo: 'manutencao',
        prioridade: 'alta'
      },
      {
        id: 2,
        titulo: 'Limpeza da caixa d\'água',
        descricao: 'Limpeza e desinfecção da caixa d\'água será realizada no próximo sábado. Haverá interrupção no fornecimento de água das 6h às 14h.',
        data: '2024-01-14',
        hora: '14:15',
        autor: 'Síndico João Silva',
        tipo: 'manutencao',
        prioridade: 'alta'
      },
      {
        id: 3,
        titulo: 'Reunião de condomínio',
        descricao: 'Assembleia geral ordinária marcada para o dia 25/01 às 19h no salão de festas. Pauta: aprovação de contas e obras.',
        data: '2024-01-13',
        hora: '16:45',
        autor: 'Administração',
        tipo: 'reuniao',
        prioridade: 'media'
      },
      {
        id: 4,
        titulo: 'Obras na garagem',
        descricao: 'Início das obras de impermeabilização da garagem. Algumas vagas ficarão temporariamente indisponíveis.',
        data: '2024-01-12',
        hora: '11:20',
        autor: 'Síndico João Silva',
        tipo: 'obra',
        prioridade: 'media'
      },
      {
        id: 5,
        titulo: 'Horário de funcionamento da portaria',
        descricao: 'Novo horário de funcionamento da portaria: Segunda a sexta das 6h às 22h, fins de semana das 8h às 20h.',
        data: '2024-01-10',
        hora: '08:00',
        autor: 'Administração',
        tipo: 'informativo',
        prioridade: 'baixa'
      }
    ];

    const getIconeAviso = (tipo: string) => {
      switch (tipo) {
        case 'manutencao': return '🔧';
        case 'reuniao': return '👥';
        case 'obra': return '🏗️';
        case 'informativo': return 'ℹ️';
        default: return '📢';
      }
    };

    const getCorPrioridade = (prioridade: string) => {
      switch (prioridade) {
        case 'alta': return '#FF5722';
        case 'media': return '#FF9800';
        case 'baixa': return '#4CAF50';
        default: return '#2196F3';
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
            <View key={aviso.id} style={[styles.avisoCard, { borderLeftColor: getCorPrioridade(aviso.prioridade) }]}>
              <View style={styles.avisoHeader}>
                <Text style={styles.avisoIcon}>{getIconeAviso(aviso.tipo)}</Text>
                <View style={styles.avisoInfo}>
                  <Text style={styles.avisoTitle}>{aviso.titulo}</Text>
                  <Text style={styles.avisoAuthor}>Por {aviso.autor}</Text>
                  <Text style={styles.avisoDateTime}>{aviso.data} às {aviso.hora}</Text>
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
    // Dados mockados do histórico de ações do porteiro
    const historico = [
      {
        id: 1,
        acao: 'Visitante registrado',
        detalhes: 'Carlos Silva visitando apartamento 101',
        data: '2024-01-15',
        hora: '14:30',
        tipo: 'visitante',
        status: 'concluido'
      },
      {
        id: 2,
        acao: 'Encomenda recebida',
        detalhes: 'Correios - Entregador João Santos para apt 205',
        data: '2024-01-15',
        hora: '13:45',
        tipo: 'encomenda',
        status: 'concluido'
      },
      {
        id: 3,
        acao: 'Autorização confirmada',
        detalhes: 'Chegada confirmada para Maria Santos (apt 205)',
        data: '2024-01-15',
        hora: '12:20',
        tipo: 'autorizacao',
        status: 'concluido'
      },
      {
        id: 4,
        acao: 'Veículo registrado',
        detalhes: 'Toyota Corolla ABC-1234 para apartamento 304',
        data: '2024-01-15',
        hora: '11:15',
        tipo: 'veiculo',
        status: 'concluido'
      },
      {
        id: 5,
        acao: 'Consulta realizada',
        detalhes: 'Busca por CPF 123.456.789-01 - Resultado encontrado',
        data: '2024-01-15',
        hora: '10:30',
        tipo: 'consulta',
        status: 'concluido'
      },
      {
        id: 6,
        acao: 'Início do turno',
        detalhes: 'Porteiro João Silva iniciou turno das 08:00 às 20:00',
        data: '2024-01-15',
        hora: '08:00',
        tipo: 'sistema',
        status: 'ativo'
      }
    ];

    const getIconeAcao = (tipo: string) => {
      switch (tipo) {
        case 'visitante': return '👤';
        case 'encomenda': return '📦';
        case 'veiculo': return '🚗';
        case 'autorizacao': return '✅';
        case 'consulta': return '🔍';
        case 'sistema': return '⚙️';
        default: return '📝';
      }
    };

    const getCorStatus = (status: string) => {
      switch (status) {
        case 'concluido': return '#4CAF50';
        case 'ativo': return '#2196F3';
        case 'pendente': return '#FF9800';
        default: return '#666';
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
            <View key={item.id} style={[styles.historicoCard, { borderLeftColor: getCorStatus(item.status) }]}>
              <View style={styles.historicoHeader}>
                <Text style={styles.historicoIcon}>{getIconeAcao(item.tipo)}</Text>
                <View style={styles.historicoInfo}>
                  <Text style={styles.historicoAcao}>{item.acao}</Text>
                  <Text style={styles.historicoDetalhes}>{item.detalhes}</Text>
                  <Text style={styles.historicoDateTime}>{item.data} às {item.hora}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getCorStatus(item.status) }]}>
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
        <RegistrarVisitante onClose={() => setActiveFlow(null)} />
      )}
      
      {activeFlow === 'encomenda' && (
        <RegistrarEncomenda onClose={() => setActiveFlow(null)} />
      )}
      
      {activeFlow === 'veiculo' && (
        <RegistrarVeiculo onClose={() => setActiveFlow(null)} />
      )}

      {!activeFlow && (
        <SafeAreaView style={styles.container}>
          {renderTopMenu()}
          <View style={styles.content}>
            {renderTabContent()}
          </View>
          
          {/* Navegação Inferior Fixa */}
          <View style={styles.bottomNavigation}>
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'chegada' && styles.navItemActive]}
            onPress={() => setActiveTab('chegada')}
          >
            <Text style={[styles.navIcon, activeTab === 'chegada' && styles.navIconActive]}>🏠</Text>
            <Text style={[styles.navLabel, activeTab === 'chegada' && styles.navLabelActive]}>Chegada</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'autorizacoes' && styles.navItemActive]}
            onPress={() => setActiveTab('autorizacoes')}
          >
            <Text style={[styles.navIcon, activeTab === 'autorizacoes' && styles.navIconActive]}>✅</Text>
            <Text style={[styles.navLabel, activeTab === 'autorizacoes' && styles.navLabelActive]}>Autorizações</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'consulta' && styles.navItemActive]}
            onPress={() => setActiveTab('consulta')}
          >
            <Text style={[styles.navIcon, activeTab === 'consulta' && styles.navIconActive]}>🔍</Text>
            <Text style={[styles.navLabel, activeTab === 'consulta' && styles.navLabelActive]}>Consulta</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'avisos' && styles.navItemActive]}
            onPress={() => setActiveTab('avisos')}
          >
            <Text style={[styles.navIcon, activeTab === 'avisos' && styles.navIconActive]}>📢</Text>
            <Text style={[styles.navLabel, activeTab === 'avisos' && styles.navLabelActive]}>Avisos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'historico' && styles.navItemActive]}
            onPress={() => setActiveTab('historico')}
          >
            <Text style={[styles.navIcon, activeTab === 'historico' && styles.navIconActive]}>📚</Text>
            <Text style={[styles.navLabel, activeTab === 'historico' && styles.navLabelActive]}>Histórico</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      )}
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
    paddingTop: 60,
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
      backgroundColor: '#fff',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
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
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      borderWidth: 1,
      borderColor: '#e0e0e0',
      zIndex: 1000,
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
  });
