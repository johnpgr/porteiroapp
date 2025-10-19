import React, { useState, useEffect, useCallback } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { flattenStyles } from '~/utils/styles';
import ProtectedRoute from '~/components/ProtectedRoute';
import { useAuth } from '~/hooks/useAuth';
import { useUserApartment } from '~/hooks/useUserApartment';
import { usePendingNotifications } from '~/hooks/usePendingNotifications';
import { NotificationCard } from '~/components/NotificationCard';
import { useFirstLogin } from '~/hooks/useFirstLogin';
import { FirstLoginModal } from '~/components/FirstLoginModal';
import AvisosTab from './avisos';
import VisitantesTab from './visitantes/VisitantesTab';


// Interface para tipagem do histórico de visitantes
interface VisitorHistory {
  id: string;
  visitor_name: string;
  purpose: string;
  log_time: string;
  resident_response_at?: string;
  notification_status: 'approved' | 'pending' | 'denied';
  visitor_document?: string;
  visitor_phone?: string;
  delivery_destination?: string;
  building_name?: string;
  apartment_number?: string;
  approved_by_name?: string;
}

export default function MoradorDashboard() {
  const { user, signOut } = useAuth();
  const { apartmentNumber, loading: apartmentLoading } = useUserApartment();
  const { tab } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('inicio');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  
  // Estados para o histórico de visitantes
  const [visitorsHistory, setVisitorsHistory] = useState<VisitorHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [userApartmentId, setUserApartmentId] = useState<string | null>(null);
  
  // Estados para o modal de notificação
  
  // Hook para notificações pendentes em tempo real
  const {
    notifications: pendingNotifications,
    loading: loadingNotifications,
    error: notificationsError,
    respondToNotification
  } = usePendingNotifications();

  const { isFirstLogin, checkFirstLoginStatus } = useFirstLogin();

  useEffect(() => {
    if (tab && typeof tab === 'string') {
      setActiveTab(tab);
    }
  }, [tab]);

  // Handle navigation for cadastro tab
  useEffect(() => {
    if (activeTab === 'cadastro') {
      router.push('/morador/cadastro');
      setActiveTab('inicio'); // Reset to avoid infinite loop
    }
  }, [activeTab]);

  // Função para buscar o histórico de visitantes
  const fetchVisitorsHistory = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      
      // Primeiro, buscar o apartment_id do usuário
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (apartmentError) {
        console.error('Erro ao buscar apartamento do usuário:', apartmentError.message);
        throw new Error('Erro ao buscar apartamento do usuário: ' + apartmentError.message);
      }
      
      if (!apartmentData?.apartment_id) {
        setVisitorsHistory([]);
        setHistoryError('Nenhum apartamento vinculado à sua conta. Solicite ao síndico/administrador para vincular seu apartamento.');
        setUserApartmentId(null);
        return;
      }

      // Armazenar o apartment_id no estado para uso no subscription
      setUserApartmentId(apartmentData.apartment_id);
      
      // Buscar histórico de visitantes (aprovadas e rejeitadas)
      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          log_time,
          resident_response_at,
          resident_response_by,
          tipo_log,
          purpose,
          notification_status,
          delivery_destination,
          apartment_id,
          visitors (
            id,
            name,
            document,
            phone
          ),
          apartments (
            number,
            buildings (
              name
            )
          )
        `)
        .eq('apartment_id', apartmentData.apartment_id)
        .in('notification_status', ['approved', 'rejected'])
        .order('resident_response_at', { ascending: false, nullsLast: true })
        .order('log_time', { ascending: false })
        .limit(20);
      
      if (visitorsError) {
        console.error('Erro ao buscar histórico de visitantes:', visitorsError.message);
        throw new Error('Erro ao buscar histórico de visitantes: ' + visitorsError.message);
      }
      
      // Buscar nomes dos aprovadores para os logs que têm resident_response_by
      const approverIds = visitorsData?.filter(log => log.resident_response_by).map(log => log.resident_response_by) || [];
      const uniqueApproverIds = [...new Set(approverIds)];
      
      let approverNames = {};
      if (uniqueApproverIds.length > 0) {
        const { data: approversData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueApproverIds);
        
        if (approversData) {
          approverNames = approversData.reduce((acc, profile) => {
            acc[profile.id] = profile.full_name;
            return acc;
          }, {});
        }
      }
      
      // Mapear dados para o formato esperado
      const mappedVisitors = visitorsData?.map((log) => {
        return {
          id: log.id,
          visitor_name: log.visitors?.name || (log.purpose?.includes('entrega') ? 'Entregador' : ''),
          purpose: log.purpose || 'Não informado',
          log_time: log.log_time,
          resident_response_at: log.resident_response_at,
          notification_status: log.notification_status || 'pending',
          delivery_destination: log.delivery_destination,
          building_name: log.apartments?.buildings?.name,
          apartment_number: log.apartments?.number,
          approved_by_name: log.resident_response_by ? approverNames[log.resident_response_by] || 'Usuário não encontrado' : null
        };
      }) || [];
      
      setVisitorsHistory(mappedVisitors);
      
    } catch (error) {
      console.error('Erro ao carregar histórico de visitantes:', error.message);
      setHistoryError('Erro ao carregar histórico de visitantes: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id]);

  // Carregar histórico de visitantes ao montar o componente
  useEffect(() => {
    if (user?.id) {
      fetchVisitorsHistory();
      checkFirstLoginStatus();
    }
  }, [user?.id, checkFirstLoginStatus]);

  // Subscription para atualização automática dos visitor_logs
  useEffect(() => {
    if (!user?.id || !userApartmentId) return;

    // Criar subscription para mudanças na tabela visitor_logs
    const subscription = supabase
      .channel('visitor_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Escutar todos os eventos (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'visitor_logs',
          filter: `apartment_id=eq.${userApartmentId}` // Filtrar apenas logs do apartamento do usuário
        },
        (payload) => {
          console.log('Mudança detectada nos visitor_logs:', payload);
          // Recarregar o histórico quando houver mudanças
          fetchVisitorsHistory();
        }
      )
      .subscribe();

    // Cleanup function para remover o subscription
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id, userApartmentId, fetchVisitorsHistory]);

  // Função para formatar data em português
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
      return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Função para obter ícone do status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return '✅';
      case 'pending':
        return '⏳';
      case 'denied':
      case 'rejected':
        return '❌';
      default:
        return '❓';
    }
  };

  // Função para obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Autorizada';
      case 'pending':
        return 'Pendente';
      case 'denied':
        return 'Negada';
      case 'rejected':
        return 'Rejeitada';
      default:
        return 'Desconhecido';
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.alertButton} onPress={() => router.push('/morador/emergency')}>
        <Ionicons name="warning" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.title}>🏠 Morador</Text>
        <Text style={styles.subtitle}>
          {apartmentLoading ? 'Carregando...' : 
           apartmentNumber ? `Apartamento ${apartmentNumber}` : 'Apartamento não encontrado'}
        </Text>
      </View>

      <TouchableOpacity style={styles.avatarButton} onPress={() => setShowAvatarMenu(true)}>
        <Ionicons name="person-circle" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderAvatarMenu = () => (
    <Modal
      visible={showAvatarMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAvatarMenu(false)}>
      <SafeAreaView style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowAvatarMenu(false)}>
          <View style={styles.avatarMenu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              router.push('/morador/profile');
            }}>
            <Ionicons name="person" size={20} color="#333" />
            <Text style={styles.menuText}>Ver/Editar Perfil</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              handleLogout();
            }}>
            <Ionicons name="log-out" size={20} color="#f44336" />
            <Text style={[styles.menuText, { color: '#f44336' }]}>Logout</Text>
          </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'inicio':
        return renderInicioTab();
      case 'visitantes':
        return <VisitantesTab />;

      case 'avisos':
        return <AvisosTab />;
      default:
        return renderInicioTab();
    }
  };

  const renderInicioTab = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📬 Notificações Pendentes</Text>

        {loadingNotifications && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando notificações...</Text>
          </View>
        )}

        {notificationsError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {notificationsError}</Text>
          </View>
        )}

        {!loadingNotifications && !notificationsError && pendingNotifications.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📭 Nenhuma notificação pendente</Text>
          </View>
        )}

        {!loadingNotifications && !notificationsError && pendingNotifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onRespond={respondToNotification}
          />
        ))}
      </View>



      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 Histórico de Visitantes</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={fetchVisitorsHistory}
            disabled={loadingHistory}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={loadingHistory ? '#ccc' : '#4CAF50'} 
            />
          </TouchableOpacity>
        </View>

        {loadingHistory && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando histórico...</Text>
          </View>
        )}

        {historyError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {historyError}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={fetchVisitorsHistory}
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadingHistory && !historyError && visitorsHistory.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📭 Nenhum visitante registrado ainda</Text>
          </View>
        )}

        {!loadingHistory && !historyError && visitorsHistory.map((visitor) => (
          <View key={visitor.id} style={[
            styles.historyCard,
            visitor.purpose?.includes('entrega') && styles.deliveryHistoryCard
          ]}>
            <Text style={styles.historyTitle}>{visitor.visitor_name}</Text>
            <Text style={styles.historyDetails}>
              {visitor.purpose} • {formatDate(visitor.resident_response_at || visitor.log_time)}
            </Text>
            {(visitor.building_name || visitor.apartment_number) && (
              <Text style={styles.buildingApartmentInfo}>
                🏢 {visitor.building_name || 'Prédio'} - Apt {visitor.apartment_number || 'N/A'}
              </Text>
            )}
            {visitor.approved_by_name && (
              <Text style={styles.approvedByInfo}>
                👤 Aprovado por: {visitor.approved_by_name}
              </Text>
            )}
            {visitor.purpose?.includes('entrega') && visitor.delivery_destination && (
              <Text style={[
                styles.deliveryDestination,
                visitor.delivery_destination === 'portaria' ? styles.porterDestination : styles.elevatorDestination
              ]}>
                {visitor.delivery_destination === 'portaria' ? '📦 Deixada na portaria' : '📦 Enviada pelo elevador'}
              </Text>
            )}
            <Text style={styles.historyStatus}>
              {getStatusIcon(visitor.notification_status)} {getStatusText(visitor.notification_status)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderBottomNavigation = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={[styles.navItem, activeTab === 'inicio' && styles.navItemActive]}
        onPress={() => setActiveTab('inicio')}>
        <Ionicons
          name={activeTab === 'inicio' ? 'home' : 'home-outline'}
          size={24}
          color={activeTab === 'inicio' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'inicio' && styles.navLabelActive]}>
          Início
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === 'visitantes' && styles.navItemActive]}
        onPress={() => setActiveTab('visitantes')}>
        <Ionicons
          name={activeTab === 'visitantes' ? 'people' : 'people-outline'}
          size={24}
          color={activeTab === 'visitantes' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'visitantes' && styles.navLabelActive]}>
          Visitantes
        </Text>
      </TouchableOpacity>



      <TouchableOpacity
        style={[styles.navItem, activeTab === 'cadastro' && styles.navItemActive]}
        onPress={() => setActiveTab('cadastro')}>
        <Ionicons
          name={activeTab === 'cadastro' ? 'person-add' : 'person-add-outline'}
          size={24}
          color={activeTab === 'cadastro' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'cadastro' && styles.navLabelActive]}>
          Cadastro
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === 'avisos' && styles.navItemActive]}
        onPress={() => setActiveTab('avisos')}>
        <Ionicons
          name={activeTab === 'avisos' ? 'notifications' : 'notifications-outline'}
          size={24}
          color={activeTab === 'avisos' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'avisos' && styles.navLabelActive]}>
          Avisos
        </Text>
      </TouchableOpacity>


    </View>
  );

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          {renderHeader()}
          {renderContent()}
          {renderBottomNavigation()}
          {renderAvatarMenu()}
        </View>
        
        <FirstLoginModal
          visible={isFirstLogin}
          onClose={() => {}}
          onComplete={() => {
            checkFirstLoginStatus();
          }}
        />
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  alertButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  avatarButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  denyButton: {
    backgroundColor: '#f44336',
  },
  porterButton: {
    backgroundColor: '#2196F3',
  },
  elevatorButton: {
    backgroundColor: '#FF9800',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  historyDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  deliveryHistoryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    backgroundColor: '#f8fbff',
  },
  deliveryDestination: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    textAlign: 'center',
    overflow: 'hidden',
  },
  porterDestination: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  elevatorDestination: {
    backgroundColor: '#f3e5f5',
    color: '#7b1fa2',
    borderWidth: 1,
    borderColor: '#ce93d8',
  },
  buildingApartmentInfo: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '500',
  },
  approvedByInfo: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
    fontStyle: 'italic',
  },



  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navItemActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  avatarMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  
  // Estilos do modal de notificação
  notificationModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  notificationModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeModalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationModalBody: {
    padding: 20,
    maxHeight: 400,
  },
  notificationPhotoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  notificationPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  notificationDetailItem: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  notificationModalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
