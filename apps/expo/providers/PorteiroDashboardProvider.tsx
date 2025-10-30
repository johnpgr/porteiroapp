import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '~/hooks/useAuth';
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

interface PorteiroDashboardContextValue {
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

  refreshAll: () => Promise<void>;
}

const PorteiroDashboardContext = createContext<PorteiroDashboardContextValue | undefined>(
  undefined
);

export function PorteiroDashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

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
      refreshAll,
    }),
    [
      authorizations,
      communications,
      loadingAuthorizations,
      loadingCommunications,
      loadingLogs,
      logsPayload.logs,
      logsPayload.pendingDeliveries,
      logsPayload.scheduledVisits,
      refreshAll,
      refreshAuthorizations,
      refreshCommunications,
      refreshLogs,
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
