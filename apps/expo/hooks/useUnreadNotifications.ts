import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNotificationService } from './useNotificationService';
import { useAuth } from './useAuth';

const DEFAULT_POLL_INTERVAL = 60_000;

interface UseUnreadNotificationsOptions {
  pollIntervalMs?: number;
  autoStart?: boolean;
}

interface UseUnreadNotificationsResult {
  unreadCount: number;
  isLoading: boolean;
  refreshUnreadCount: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

/**
 * Lightweight hook that keeps a badge-friendly unread notification count in sync.
 * Relies on the notification logs table via `useNotificationService`.
 */
export function useUnreadNotifications(
  options: UseUnreadNotificationsOptions = {}
): UseUnreadNotificationsResult {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL, autoStart = true } = options;
  const { user } = useAuth();
  const { getNotificationHistory } = useNotificationService();

  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);
  const pollTimerRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    if (!user?.id) {
      setUnreadCount(0);
      setIsLoading(false);
      stopPolling();
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const history = await getNotificationHistory(100);
      if (!isMountedRef.current) {
        return;
      }

      const unread = history.filter((notification) => notification?.status !== 'read').length;
      setUnreadCount(unread);
    } catch (error) {
      // Logging already happens inside the notification service; keep this silent for badges.
      if (__DEV__) {
        console.error('❌ [useUnreadNotifications] Failed to load unread count:', error);
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [getNotificationHistory, stopPolling, user?.id]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current || pollIntervalMs <= 0) {
      return;
    }

    pollTimerRef.current = setInterval(() => {
      refreshUnreadCount().catch(() => {
        // Errors are handled inside refreshUnreadCount; swallow here to keep interval alive.
      });
    }, pollIntervalMs);
  }, [pollIntervalMs, refreshUnreadCount]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    refreshUnreadCount();

    stopPolling();
    if (pollIntervalMs > 0 && user?.id) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [autoStart, pollIntervalMs, refreshUnreadCount, startPolling, stopPolling, user?.id]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        typeof previousState === 'string' &&
        previousState.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        refreshUnreadCount();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [refreshUnreadCount]);

  return {
    unreadCount,
    isLoading,
    refreshUnreadCount,
    startPolling,
    stopPolling,
  };
}
