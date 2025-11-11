import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import PorteiroTopBar from './PorteiroTopBar';
import { ShiftModal } from './ShiftModal';
import { useAuth } from '~/hooks/useAuth';
import { usePorteiroDashboard } from '~/providers/PorteiroDashboardProvider';
import { supabase } from '~/utils/supabase';

interface PorteiroData {
  name: string;
  initials: string;
  shift_start?: string;
  shift_end?: string;
  building_id?: string;
}

export default function PorteiroTabsHeader() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [porteiroData, setPorteiroData] = useState<PorteiroData | null>(null);
  const [loadingPorteiro, setLoadingPorteiro] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

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
  const shiftControlEnabled = true;

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
        .eq('user_id', user.id)
        .eq('user_type', 'porteiro')
        .single();

      if (profileError) {
        const nameParts = (user.email || 'user@porteiro.app').split('@')[0].split('.');
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
        const nameParts = (profile.full_name || user.email || 'Porteiro').split(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2);
        const schedule = parseWorkSchedule(profile.work_schedule);

        setPorteiroData({
          name: profile.full_name || user.email || 'Porteiro',
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
      loadPorteiroData();
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
  }, [shiftReady, refreshShiftAction, user?.id, buildingId, shiftControlEnabled]);
  

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
  }, [authLoading, loadingPorteiro, shiftReady, initialShiftCheckDone, shiftLoading, isInitializing]);

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
  }, [currentShift, isInitializing, isModalMandatory, shiftReady, shiftLoading, showShiftModal]);

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

  const handlePanicButton = () => {
    router.push('/porteiro/emergency');
  };

  const handleNotifications = () => {
    router.push('/porteiro/avisos');
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

  return (
    <>
      <PorteiroTopBar
        porteiroData={porteiroData}
        loadingPorteiro={loadingPorteiro}
        connectionError={connectionError}
        isInitializing={isInitializing}
        onLogout={handleLogout}
        onShiftControlPress={() => {
          if (!isInitializing) {
            setShowShiftModal(true);
          }
        }}
        onPanicPress={handlePanicButton}
        onNotificationsPress={handleNotifications}
        unreadNotifications={unreadCount}
        checkShiftBeforeAction={checkShiftBeforeAction}
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
    </>
  );
}