import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Device from 'expo-device';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaView } from '~/components/SafeAreaView';
import { ReadOnlyGuard } from '~/components/ReadOnlyGuard';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import * as Linking from 'expo-linking';
import { queueNotification } from '../services/OfflineQueue';
import AnalyticsTracker from '../services/AnalyticsTracker';
import { registerBackgroundNotificationTask } from '../services/backgroundNotificationTask';
// Removed old notification service - using Edge Functions for push notifications
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.error('❌ Erro ao prevenir auto-hide da splash screen:', error);
});

// Register background notification task at module level
// This MUST be called outside of any component to ensure it's registered before app loads
registerBackgroundNotificationTask();

const PENDING_DEEP_LINK_KEY = '@porteiro_app:pending_deep_link';

// Componente interno para gerenciar push tokens
function PushTokenManager() {
  const { user, updatePushToken, isOffline, requireWritable } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const registerPushToken = async () => {
      // Só registra em dispositivos físicos
      if (!Device.isDevice) {
        console.log('🔔 Push notifications não são suportadas em simulador/emulador');
        return;
      }

      // Só registra se o usuário estiver autenticado
      try {
        // Solicitar permissão
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('🚨 Permissão de notificação negada');
          return;
        }

        // Obter push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '74e123bc-f565-44ba-92f0-86fc00cbe0b1',
        });

        const token = tokenData.data;

        // Só atualiza se o token mudou ou não existe
        if (token && token !== user.push_token) {
          try {
            requireWritable();
          } catch (err) {
            console.warn('[PushTokenManager] Modo somente leitura - push token não atualizado');
            return;
          }
          console.log('🔔 Push token obtido:', token);
          await updatePushToken(token);
          console.log('✅ Push token registrado no banco de dados');
          AnalyticsTracker.trackEvent('push_token_registered', { userId: user.id });
        }
      } catch (error) {
        console.error('❌ Erro ao registrar push token:', error);
        AnalyticsTracker.trackEvent('push_token_error', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    registerPushToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, updatePushToken]); // Exclude user.push_token to avoid infinite loops

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (!isOffline) {
        return;
      }

      queueNotification({
        payload: {
          content: notification.request.content,
        },
      })
        .then(() =>
          AnalyticsTracker.trackEvent('auth_notification_queued_offline', {
            identifier: notification.request.identifier,
          })
        )
        .catch((error) => {
          console.error('[OfflineQueue] Falha ao enfileirar notificação offline:', error);
          AnalyticsTracker.trackEvent('auth_notification_queue_error', {
            identifier: notification.request.identifier,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });

    return () => {
      subscription.remove();
    };
  }, [isOffline]);

  return null;
}

function DeepLinkManager() {
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
        console.error('[DeepLink] Erro ao processar deep link:', error);
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
        console.log('[DeepLink] Usuário indisponível, armazenando deep link:', url);
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
      .catch((error) => console.error('[DeepLink] Erro ao recuperar deep link pendente:', error));

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          void handleIncomingLink(url);
        }
      })
      .catch((error) => console.error('[DeepLink] Erro ao obter URL inicial:', error));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleIncomingLink, isDevClientUrl]);

  useEffect(() => {
    if (user && !isOffline && pendingDeepLink) {
      void processDeepLink(pendingDeepLink).then(() => {
        setPendingDeepLink(null);
      });
    }
  }, [isOffline, pendingDeepLink, processDeepLink, user]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('🚀 Iniciando preparação do app...');

        console.log('✅ App pronto, escondendo splash screen');
        setAppReady(true);

        // Esconde a splash screen
        await SplashScreen.hideAsync();
        console.log('✅ Splash screen escondida');
      } catch (error) {
        console.error('❌ Erro ao preparar app:', error);
        // Mesmo com erro, esconde a splash screen
        setAppReady(true);
        SplashScreen.hideAsync().catch((e) => console.error('❌ Erro ao esconder splash:', e));
      }
    }

    if (loaded) {
      prepare();
    }
  }, [loaded]);

  // Configurar handler de notificações
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });

    // Listener para notificações recebidas enquanto app está em foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 [Foreground] Notificação recebida:', notification);
      // A notificação será exibida automaticamente devido ao handler acima
    });

    // Listener para quando usuário clica na notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 [Click] Usuário clicou na notificação:', response);
        const data = response.notification.request.content.data;

        // Navegação baseada no tipo de notificação
        if (data?.type === 'visitor_arrival') {
          // Navegar para tela de autorizações do morador
          router.push('/morador/authorize');
        } else if (data?.type === 'visitor_approved' || data?.type === 'visitor_rejected') {
          // Navegar para tela do porteiro
          router.push('/porteiro');
        }
      }
    );

    // Cleanup
    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  if (!loaded || !appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <AuthProvider>
          <PushTokenManager />
          <DeepLinkManager />
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <ReadOnlyGuard>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
                <Stack.Screen name="porteiro" options={{ headerShown: false }} />
                <Stack.Screen name="morador" options={{ headerShown: false }} />
                <Stack.Screen name="visitante" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </ReadOnlyGuard>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
