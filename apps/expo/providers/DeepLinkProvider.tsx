import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import AnalyticsTracker from '../services/AnalyticsTracker';

const PENDING_DEEP_LINK_KEY = '@porteiro_app:pending_deep_link';

/**
 * Provider that manages deep link routing and persistence.
 * Handles incoming deep links and queues them when user is not authenticated.
 * Processes queued links when user logs in.
 */
export function DeepLinkProvider() {
  const { user, isOffline } = useAuth();
  const router = useRouter();
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);
  const initialisedRef = useRef(false);

  const isDevClientUrl = useCallback((url: string | null | undefined) => {
    if (!url) return false;
    return url.includes('expo-development-client');
  }, []);

  const processDeepLink = useCallback(
    async (url: string) => {
      if (!url) return;

      if (isDevClientUrl(url)) {
        console.log('[DeepLink] Ignoring Expo dev client URL:', url);
        return;
      }

      try {
        const parsed = Linking.parse(url);
        if (parsed?.path) {
          let route = `/${parsed.path}`;
          const params = parsed.queryParams ?? {};
          const searchParams = new URLSearchParams();

          Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (item != null) {
                  searchParams.append(key, String(item));
                }
              });
            } else if (value != null) {
              searchParams.append(key, String(value));
            }
          });

          const queryString = searchParams.toString();
          if (queryString) {
            route = `${route}?${queryString}`;
          }

          router.push(route as any);
        } else {
          router.push(url as any);
        }
        AnalyticsTracker.trackEvent('auth_deeplink_processed', {
          url,
        });
      } catch (error) {
        console.error('[DeepLink] Error processing deep link:', error);
        AnalyticsTracker.trackEvent('auth_deeplink_error', {
          url,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY).catch(() => {});
      }
    },
    [isDevClientUrl, router]
  );

  const handleIncomingLink = useCallback(
    async (url: string | null) => {
      if (!url) return;
      if (isDevClientUrl(url)) {
        console.log('[DeepLink] Ignoring Expo dev client URL (incoming):', url);
        await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY).catch(() => {});
        return;
      }

      if (!user || isOffline) {
        console.log('[DeepLink] User unavailable, storing deep link:', url);
        setPendingDeepLink(url);
        await AsyncStorage.setItem(PENDING_DEEP_LINK_KEY, url).catch(() => {});
        AnalyticsTracker.trackEvent('auth_deeplink_queued', {
          url,
        });
        return;
      }

      await processDeepLink(url);
    },
    [isDevClientUrl, isOffline, processDeepLink, user]
  );

  // Initialize deep link listeners
  useEffect(() => {
    if (initialisedRef.current) {
      return;
    }

    initialisedRef.current = true;

    AsyncStorage.getItem(PENDING_DEEP_LINK_KEY)
      .then((stored) => {
        if (stored && !isDevClientUrl(stored)) {
          setPendingDeepLink(stored);
        } else if (stored) {
          console.log('[DeepLink] Ignoring stored Expo dev client URL:', stored);
          AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY).catch(() => {});
        }
      })
      .catch((error) => console.error('[DeepLink] Error recovering pending deep link:', error));

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          void handleIncomingLink(url);
        }
      })
      .catch((error) => console.error('[DeepLink] Error getting initial URL:', error));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleIncomingLink, isDevClientUrl]);

  // Process pending deep links when user logs in
  useEffect(() => {
    if (user && !isOffline && pendingDeepLink) {
      void processDeepLink(pendingDeepLink).then(() => {
        setPendingDeepLink(null);
      });
    }
  }, [isOffline, pendingDeepLink, processDeepLink, user]);

  return null;
}
