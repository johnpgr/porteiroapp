import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '~/hooks/useAuth';
import { useShiftControl } from '~/hooks/useShiftControl';
import { usePorteiroNotifications } from '~/hooks/usePorteiroNotifications';
import { getPorteiroBuildingId } from '~/services/porteiro/building.service';
import {
  fetchPorteiroCommunications,
  PorteiroCommunication,
} from '~/services/porteiro/communications.service';
import {
  fetchPorteiroAuthorizations,
  PorteiroAuthorization,
} from '~/services/porteiro/authorizations.service';
import {
  fetchPorteiroLogs,
  PorteiroLogEntry,
  PorteiroLogsPayload,
} from '~/services/porteiro/logs.service';
import type { PorteiroShift } from '~/services/shiftService';

interface PorteiroDashboardContextValue {
  buildingId: string | null;

  communications: PorteiroCommunication[];
  loadingCommunications: boolean;
  refreshCommunications: () => Promise<void>;

  authorizations: PorteiroAuthorization[];
  loadingAuthorizations: boolean;
  refreshAuthorizations: () => Promise<void>;

  logs: PorteiroLogEntry[];
  pendingDeliveries: PorteiroLogEntry[];
  scheduledVisits: PorteiroLogEntry[];
  loadingLogs: boolean;
  refreshLogs: () => Promise<void>;

  shift: {
    currentShift: PorteiroShift | null;
    shiftLoading: boolean;
    startShift: () => Promise<void>;
    endShift: () => Promise<void>;
    refreshShift: () => Promise<void>;
    canStartShift: boolean;
    validationError: string | null;
    isRealtimeConnected: boolean;
  };

  notifications: {
    notifications: ReturnType<typeof usePorteiroNotifications>['notifications'];
    unreadCount: number;
    isListening: boolean;
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
    refreshNotifications: () => Promise<void>;
  };

  refreshAll: () => Promise<void>;
}

const PorteiroDashboardContext = createContext<PorteiroDashboardContextValue | undefined>(undefined);

export function PorteiroDashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [fetchingBuilding, setFetchingBuilding] = useState(false);

  const [communications, setCommunications] = useState<PorteiroCommunication[]>([]);
  const [loadingCommunications, setLoadingCommunications] = useState(false);

  const [authorizations, setAuthorizations] = useState<PorteiroAuthorization[]>([]);
  const [loadingAuthorizations, setLoadingAuthorizations] = useState(false);

  const [logsPayload, setLogsPayload] = useState<PorteiroLogsPayload>({
    logs: [],
    pendingDeliveries: [],
    scheduledVisits: [],
  });
  const [loadingLogs, setLoadingLogs] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const resolveBuilding = async () => {
      if (!user?.id) {
        if (active && isMountedRef.current) {
          setBuildingId(null);
        }
        return;
      }

      try {
        setFetchingBuilding(true);
        const id = await getPorteiroBuildingId(user.id);
        if (active && isMountedRef.current) {
          setBuildingId(id);
        }
      } catch (error) {
        console.error('Erro ao buscar building_id do porteiro:', error);
        if (active && isMountedRef.current) {
          setBuildingId(null);
        }
      } finally {
        if (active && isMountedRef.current) {
          setFetchingBuilding(false);
        }
      }
    };

    resolveBuilding();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const {
    currentShift,
    isLoading: shiftLoading,
    startShift,
    endShift,
    refreshShiftStatus: refreshShift,
    canStartShift,
    validationError,
    isRealtimeConnected,
  } = useShiftControl({
    porteiroId: user?.id || '',
    buildingId: buildingId || '',
  });

  const {
    notifications,
    unreadCount,
    isListening,
    startListening,
    stopListening,
    refreshNotifications,
  } = usePorteiroNotifications(buildingId, user?.id);

  const refreshCommunications = useCallback(async () => {
    if (!user?.id) {
      if (isMountedRef.current) {
        setCommunications([]);
      }
      return;
    }

    setLoadingCommunications(true);
    try {
      const records = await fetchPorteiroCommunications(user.id);
      if (isMountedRef.current) {
        setCommunications(records);
      }
    } catch (error) {
      console.error('Erro ao carregar comunicados:', error);
    } finally {
      if (isMountedRef.current) {
        setLoadingCommunications(false);
      }
    }
  }, [user?.id]);

  const refreshAuthorizations = useCallback(async () => {
    if (!user?.id) {
      if (isMountedRef.current) {
        setAuthorizations([]);
      }
      return;
    }

    setLoadingAuthorizations(true);
    try {
      const records = await fetchPorteiroAuthorizations(user.id);
      if (isMountedRef.current) {
        setAuthorizations(records);
      }
    } catch (error) {
      console.error('Erro ao carregar autorizações:', error);
    } finally {
      if (isMountedRef.current) {
        setLoadingAuthorizations(false);
      }
    }
  }, [user?.id]);

  const refreshLogs = useCallback(async () => {
    if (!user?.id) {
      if (isMountedRef.current) {
        setLogsPayload({
          logs: [],
          pendingDeliveries: [],
          scheduledVisits: [],
        });
      }
      return;
    }

    setLoadingLogs(true);
    try {
      const payload = await fetchPorteiroLogs(user.id);
      if (isMountedRef.current) {
        setLogsPayload(payload);
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      if (isMountedRef.current) {
        setLoadingLogs(false);
      }
    }
  }, [user?.id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCommunications(), refreshAuthorizations(), refreshLogs()]);
  }, [refreshAuthorizations, refreshCommunications, refreshLogs]);

  useEffect(() => {
    if (user?.id) {
      refreshAll();
    } else if (isMountedRef.current) {
      setCommunications([]);
      setAuthorizations([]);
      setLogsPayload({
        logs: [],
        pendingDeliveries: [],
        scheduledVisits: [],
      });
    }
  }, [user?.id, refreshAll]);

  const contextValue = useMemo<PorteiroDashboardContextValue>(
    () => ({
      buildingId,

      communications,
      loadingCommunications,
      refreshCommunications,

      authorizations,
      loadingAuthorizations,
      refreshAuthorizations,

      logs: logsPayload.logs,
      pendingDeliveries: logsPayload.pendingDeliveries,
      scheduledVisits: logsPayload.scheduledVisits,
      loadingLogs,
      refreshLogs,

      shift: {
        currentShift,
        shiftLoading: shiftLoading || fetchingBuilding,
        startShift,
        endShift,
        refreshShift,
        canStartShift,
        validationError,
        isRealtimeConnected,
      },

      notifications: {
        notifications,
        unreadCount,
        isListening,
        startListening,
        stopListening,
        refreshNotifications,
      },

      refreshAll,
    }),
    [
      buildingId,
      communications,
      loadingCommunications,
      authorizations,
      loadingAuthorizations,
      logsPayload.logs,
      logsPayload.pendingDeliveries,
      logsPayload.scheduledVisits,
      loadingLogs,
      currentShift,
      shiftLoading,
      fetchingBuilding,
      startShift,
      endShift,
      refreshShift,
      canStartShift,
      validationError,
      isRealtimeConnected,
      notifications,
      unreadCount,
      isListening,
      startListening,
      stopListening,
      refreshNotifications,
      refreshCommunications,
      refreshAuthorizations,
      refreshLogs,
      refreshAll,
    ]
  );

  return (
    <PorteiroDashboardContext.Provider value={contextValue}>
      {children}
    </PorteiroDashboardContext.Provider>
  );
}

export function usePorteiroDashboard(): PorteiroDashboardContextValue {
  const context = useContext(PorteiroDashboardContext);
  if (!context) {
    throw new Error('usePorteiroDashboard deve ser usado dentro de um PorteiroDashboardProvider');
  }
  return context;
}
