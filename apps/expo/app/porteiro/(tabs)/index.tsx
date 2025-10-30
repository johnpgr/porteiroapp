import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';
import ProtectedRoute from '~/components/ProtectedRoute';
import RegistrarEncomenda from '~/components/porteiro/RegistrarEncomenda';
import RegistrarVeiculo from '~/components/porteiro/RegistrarVeiculo';
import RegistrarVisitante from '~/components/porteiro/RegistrarVisitante';
import IntercomModal from '../components/modals/IntercomModal';
import { useAuth } from '~/hooks/useAuth';
import { usePorteiroDashboard } from '~/providers/PorteiroDashboardProvider';
import ConfirmActionModal from '~/components/porteiro/ConfirmActionModal';
import ShiftModal from '~/components/porteiro/ShiftModal';
import { flattenStyles } from '~/utils/styles';
import { supabase } from '~/utils/supabase';

type ActiveFlow = 'visitante' | 'encomenda' | 'veiculo' | null;

interface PorteiroData {
  name: string;
  initials: string;
  shift_start?: string;
  shift_end?: string;
  building_id?: string;
}

export default function PorteiroChegadaScreen() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showIntercomModal, setShowIntercomModal] = useState(false);

  const [porteiroData, setPorteiroData] = useState<PorteiroData | null>(null);
  const [loadingPorteiro, setLoadingPorteiro] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [isModalMandatory, setIsModalMandatory] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initialShiftCheckDone, setInitialShiftCheckDone] = useState(false);

  const hasLoadedPorteiroDataRef = useRef<string | null>(null);
  const hasCompletedInitialLoadRef = useRef(false);

  const {
    buildingId,
    shift: {
      currentShift,
      shiftLoading,
      startShift: startShiftAction,
      endShift: endShiftAction,
      refreshShift: refreshShiftAction,
    },
    notifications: { unreadCount },
  } = usePorteiroDashboard();

  const shiftReady = !!(user?.id && buildingId);

  const parseWorkSchedule = (workSchedule: string | null) => {
    if (!workSchedule) {
      return { start: '08:00', end: '20:00' };
    }

    try {
      let scheduleData;
      try {
        scheduleData = JSON.parse(workSchedule);
      } catch {
        let timeRange = workSchedule;
        if (workSchedule.includes(': ')) {
          timeRange = workSchedule.split(': ')[1];
        }
        if (!timeRange.includes('-')) {
          return { start: '08:00', end: '20:00' };
        }

        const [start, end] = timeRange.split('-').map((time) => time.trim());
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

        return {
          start: timeRegex.test(start) ? start : '08:00',
          end: timeRegex.test(end) ? end : '20:00',
        };
      }

      if (scheduleData && typeof scheduleData === 'object') {
        const startTime = scheduleData.startTime || '08:00';
        const endTime = scheduleData.endTime || '20:00';
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

        return {
          start: timeRegex.test(startTime) ? startTime : '08:00',
          end: timeRegex.test(endTime) ? endTime : '20:00',
        };
      }

      return { start: '08:00', end: '20:00' };
    } catch (error) {
      console.error('Erro ao processar work_schedule:', error);
      return { start: '08:00', end: '20:00' };
    }
  };

  const loadPorteiroData = useCallback(async () => {
    if (!user?.id || authLoading) return;

    if (hasLoadedPorteiroDataRef.current === user.id) {
      return;
    }
    hasLoadedPorteiroDataRef.current = user.id;

    try {
      setLoadingPorteiro(true);
      setConnectionError(false);

      const { error: connectionError } = await supabase.from('profiles').select('id').limit(1);
      if (connectionError) {
        setConnectionError(true);
        hasLoadedPorteiroDataRef.current = null;
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, work_schedule, building_id')
        .eq('id', user.id)
        .eq('user_type', 'porteiro')
        .single();

      if (profileError) {
        const nameParts = user.email.split('@')[0].split('.');
        const name = nameParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('');
        const schedule = parseWorkSchedule(null);

        setPorteiroData({
          name,
          initials,
          shift_start: schedule.start,
          shift_end: schedule.end,
        });
      } else {
        const nameParts = (profile.full_name || user.email.split('@')[0]).split(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2);
        const schedule = parseWorkSchedule(profile.work_schedule);

        setPorteiroData({
          name: profile.full_name || user.email,
          initials,
          shift_start: schedule.start,
          shift_end: schedule.end,
          building_id: profile.building_id ?? undefined,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados do porteiro:', error);
      setConnectionError(true);
      hasLoadedPorteiroDataRef.current = null;
    } finally {
      setLoadingPorteiro(false);
    }
  }, [authLoading, user?.email, user?.id]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      const timeoutId = setTimeout(() => {
        loadPorteiroData();
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [authLoading, loadPorteiroData, user?.id]);

  useEffect(() => {
    let isActive = true;

    if (!shiftControlEnabled) {
      setInitialShiftCheckDone(true);
      return;
    }

    hasCompletedInitialLoadRef.current = false;
    setInitialShiftCheckDone(false);
    setIsInitializing(true);

    const fetchInitialShiftStatus = async () => {
    try {
      await refreshShiftAction();
      } catch (error) {
        console.error('Erro ao atualizar status inicial do turno:', error);
      } finally {
        if (isActive) {
          setInitialShiftCheckDone(true);
        }
      }
    };

    fetchInitialShiftStatus();

    return () => {
      isActive = false;
    };
  }, [shiftReady, refreshShiftAction, user?.id, buildingId]);

  useEffect(() => {
    const stillLoading =
      authLoading || loadingPorteiro || (shiftReady && (!initialShiftCheckDone || shiftLoading));

    if (!hasCompletedInitialLoadRef.current) {
      if (stillLoading) {
        if (!isInitializing) {
          setIsInitializing(true);
        }
      } else {
        hasCompletedInitialLoadRef.current = true;
        if (isInitializing) {
          setIsInitializing(false);
        }
      }
    } else if (isInitializing && !stillLoading) {
      setIsInitializing(false);
    }
  }, [
    authLoading,
    loadingPorteiro,
    shiftReady,
    initialShiftCheckDone,
    shiftLoading,
    isInitializing,
  ]);

  useEffect(() => {
    if (!authLoading && user?.id && porteiroData) {
      setActiveFlow(null);
    }
  }, [authLoading, porteiroData, user?.id]);

  useEffect(() => {
    if (isInitializing || !shiftReady || shiftLoading) {
      if (showShiftModal) {
        setShowShiftModal(false);
      }
      if (isModalMandatory) {
        setIsModalMandatory(false);
      }
      return;
    }

    if (!currentShift) {
      if (!showShiftModal) {
        setShowShiftModal(true);
      }
      if (!isModalMandatory) {
        setIsModalMandatory(true);
      }
      return;
    }

    if (isModalMandatory) {
      setIsModalMandatory(false);
      if (showShiftModal) {
        setShowShiftModal(false);
      }
    }
  }, [
    currentShift,
    isInitializing,
    isModalMandatory,
    shiftReady,
    shiftLoading,
    showShiftModal,
  ]);

  const checkShiftBeforeAction = (action: () => void, actionName: string = 'esta ação') => {
    if (isInitializing) {
      Alert.alert(
        'Verificando turno',
        'Estamos confirmando o status do seu turno. Aguarde alguns instantes e tente novamente.'
      );
      return;
    }

    if (!currentShift) {
      Alert.alert(
        'Turno Inativo',
        `Você precisa iniciar seu turno para realizar ${actionName}. Acesse o controle de turno para iniciar.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setIsModalMandatory(true);
              setShowShiftModal(true);
            },
          },
        ]
      );
      return;
    }

    action();
  };

  const showConfirmationModal = (message: string) => {
    setConfirmMessage(message);
    setShowConfirmModal(true);
    setCountdown(5);

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

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setCountdown(5);
  };

  const handleIntercomCall = () => {
    checkShiftBeforeAction(() => {
      setShowIntercomModal(true);
    }, 'realizar chamadas de interfone');
  };

  const handleUserMenuToggle = () => {
    setShowUserMenu((prev) => !prev);
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
            setShowShiftModal(false);
            setIsModalMandatory(false);
            setInitialShiftCheckDone(false);
            setIsInitializing(true);
            hasCompletedInitialLoadRef.current = false;
            await signOut();
            router.replace('/porteiro/login');
          } catch (error) {
            console.error('Erro ao fazer logout:', error);
            Alert.alert('Erro', 'Não foi possível fazer logout. Tente novamente.');
          }
        },
      },
    ]);
  };

  const handleStartShift = () => {
    Alert.alert('Iniciar Turno', 'Deseja iniciar seu turno de trabalho agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar',
        onPress: async () => {
          try {
            await startShiftAction();
            await refreshShiftAction();
          } catch (error) {
            console.error('Erro ao iniciar turno:', error);
            Alert.alert('Erro', 'Falha ao iniciar turno. Tente novamente.');
          }
        },
      },
    ]);
  };

  const handleEndShift = async () => {
    if (!currentShift) {
      Alert.alert('Erro', 'Nenhum turno ativo encontrado.');
      return;
    }

    await endShiftAction();
    await refreshShiftAction();
  };

  const menuItems: ProfileMenuItem[] = [
    {
      label: 'Ver/Editar Perfil',
      iconName: 'person',
      onPress: () => router.push('/porteiro/profile'),
    },
    {
      label: 'Logs',
      iconName: 'list',
      onPress: () => router.push('/porteiro/(tabs)/logs'),
    },
    {
      label: 'Logout',
      iconName: 'log-out',
      iconColor: '#f44336',
      destructive: true,
      onPress: handleLogout,
    },
  ];

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

    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>
            {porteiroData?.name ? `👋 Olá, ${porteiroData.name}!` : 'Porteiro'}
          </Text>
          {porteiroData?.shift_start && porteiroData.shift_end ? (
            <Text style={styles.shiftText}>
              Turno padrão: {porteiroData.shift_start} - {porteiroData.shift_end}
            </Text>
          ) : (
            <Text style={styles.shiftText}>Horario não definido</Text>
          )}
        </View>

        <View style={styles.topMenuRight}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/porteiro/(tabs)/avisos')}
          >
            <Text style={styles.quickActionIcon}>🔔</Text>
            <Text style={styles.quickActionText}>
              Avisos{unreadCount > 0 ? ` (${Math.min(unreadCount, 99)})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/porteiro/(tabs)/autorizacoes')}
          >
            <Text style={styles.quickActionIcon}>✅</Text>
            <Text style={styles.quickActionText}>Autorizações</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/porteiro/(tabs)/logs')}
          >
            <Text style={styles.quickActionIcon}>📋</Text>
            <Text style={styles.quickActionText}>Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.userAvatar} onPress={handleUserMenuToggle}>
            <Text style={styles.avatarText}>{porteiroData?.initials ?? 'P'}</Text>
          </TouchableOpacity>

          <ProfileMenu
            visible={showUserMenu}
            onClose={() => setShowUserMenu(false)}
            items={menuItems}
            placement="top-right"
          />
        </View>
      </View>
    );
  };

  const renderChegadaContent = () => (
    <ScrollView contentContainerStyle={styles.buttonsContainer}>
      <TouchableOpacity
        style={flattenStyles([styles.actionButton, styles.visitorButton])}
        onPress={() =>
          checkShiftBeforeAction(() => setActiveFlow('visitante'), 'registrar visitantes')
        }
      >
        <Text style={styles.buttonIcon}>👋</Text>
        <Text style={styles.buttonTitle}>Registrar Visitante</Text>
        <Text style={styles.buttonDescription}>Cadastrar nova visita</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={flattenStyles([styles.actionButton, styles.deliveryButton])}
        onPress={() =>
          checkShiftBeforeAction(() => setActiveFlow('encomenda'), 'registrar encomendas')
        }
      >
        <Text style={styles.buttonIcon}>📦</Text>
        <Text style={styles.buttonTitle}>Registrar Encomenda</Text>
        <Text style={styles.buttonDescription}>Receber entrega</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={flattenStyles([styles.actionButton, styles.vehicleButton])}
        onPress={() =>
          checkShiftBeforeAction(() => setActiveFlow('veiculo'), 'registrar veículos')
        }
      >
        <Text style={styles.buttonIcon}>🚗</Text>
        <Text style={styles.buttonTitle}>Registrar Veículo</Text>
        <Text style={styles.buttonDescription}>Autorizar entrada</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.intercomButton} onPress={handleIntercomCall}>
        <Text style={styles.buttonIcon}>📞</Text>
        <Text style={styles.buttonTitle}>Chamar Morador</Text>
        <Text style={styles.buttonDescription}>Abrir painel do interfone</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <ProtectedRoute redirectTo="/porteiro/login" userType="porteiro">
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
        <View style={styles.container}>
          {isInitializing ? (
            <View style={styles.initialOverlay}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.initialOverlayMessage}>Verificando status do turno...</Text>
            </View>
          ) : (
            <>
              {renderTopMenu()}
              <View style={styles.content}>{renderChegadaContent()}</View>
            </>
          )}
        </View>
      )}

      <ConfirmActionModal
        visible={showConfirmModal}
        message={confirmMessage}
        countdownSeconds={countdown}
        onClose={closeConfirmModal}
      />

      <ShiftModal
        visible={!isInitializing && showShiftModal}
        mandatory={isModalMandatory}
        isLoading={shiftLoading}
        currentShift={currentShift}
        onStartShift={handleStartShift}
        onEndShift={handleEndShift}
        onLogout={handleLogout}
        onClose={() => setShowShiftModal(false)}
      />

      <IntercomModal visible={showIntercomModal} onClose={() => setShowIntercomModal(false)} />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  buttonsContainer: {
    gap: 16,
    paddingBottom: 32,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  visitorButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  deliveryButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800',
  },
  vehicleButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3',
  },
  intercomButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#673AB7',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  buttonDescription: {
    fontSize: 14,
    color: '#616161',
  },
  topMenu: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  topMenuLeft: {
    flex: 1,
  },
  topMenuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  shiftText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  quickActionButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: '#1E88E5',
    fontWeight: '600',
  },
  userAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#2196F3',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mandatoryModalWarning: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  mandatoryModalWarningText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  shiftModalContent: {
    gap: 18,
  },
  shiftStatusSection: {
    gap: 12,
  },
  shiftSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  shiftStatusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  shiftStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#F97316',
  },
  shiftStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  shiftDetails: {
    gap: 4,
  },
  shiftDetailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  shiftDetailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  shiftControlsSection: {
    gap: 12,
  },
  shiftActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22C55E',
  },
  shiftEndButton: {
    backgroundColor: '#F97316',
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#EF4444',
  },
  shiftActionIcon: {
    fontSize: 18,
    color: '#fff',
  },
  shiftActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  initialOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  initialOverlayMessage: {
    fontSize: 15,
    color: '#475569',
  },
});
