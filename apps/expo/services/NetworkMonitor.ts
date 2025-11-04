import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

const isStateOnline = (state: NetInfoState): boolean => {
  const { isConnected, isInternetReachable } = state;
  if (isInternetReachable === null) {
    return Boolean(isConnected);
  }
  return Boolean(isConnected) && Boolean(isInternetReachable);
};

export const useNetworkState = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const updateStatus = (state: NetInfoState) => {
      if (!mounted) return;
      const online = isStateOnline(state);
      setIsOnline(online);
      console.log('[Network]', online ? 'Online' : 'Offline', state.type);
    };

    NetInfo.fetch().then(updateStatus).catch((error) => {
      console.error('[Network] Failed initial fetch:', error);
    });

    const unsubscribe = NetInfo.addEventListener(updateStatus);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return isOnline;
};

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Max retries exceeded');
};
