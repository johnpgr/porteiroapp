import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, AppState } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { useAuth } from '~/hooks/useAuth';
import useAgoraHook from '~/hooks/useAgora';
import IncomingCallModal from '~/components/IncomingCallModal';

import { Ionicons } from '@expo/vector-icons';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';
import { useUserApartment } from '~/hooks/useUserApartment';

export default function MoradorLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user, signOut } = useAuth();
  const { apartmentNumber, loading: apartmentLoading } = useUserApartment();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const shouldHideHeader =
    pathname === '/morador/login' ||
    pathname.startsWith('/morador/cadastro/') ||
    pathname.startsWith('/morador/visitantes/');

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/');
          } catch (error) {
            console.error('Erro ao realizar logout:', error);
          }
        },
      },
    ]);
  };

  const profileMenuItems: ProfileMenuItem[] = [
    {
      label: 'Ver/Editar Perfil',
      iconName: 'person',
      onPress: () => router.push('/morador/profile'),
    },
    {
      label: 'Cadastro',
      iconName: 'create',
      onPress: () => router.push('/morador/cadastro'),
    },
    {
      label: 'Logout',
      iconName: 'log-out',
      iconColor: '#f44336',
      destructive: true,
      onPress: handleLogout,
    },
  ];

  // Initialize Agora hook with current user context
  const agoraContext = useAgoraHook({
    currentUser: user ? {
      id: user.id,
      userType: 'morador',
      displayName: (user as any)?.user_metadata?.full_name || user.email || null
    } : null,
    appId: process.env.EXPO_PUBLIC_AGORA_APP_ID,
  });

  // Refs para listeners
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);
  const lastNotificationCallIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  

  // 📞 CONFIGURAR LISTENERS PARA CHAMADAS DE INTERFONE
  // Push notifications serve para alertar o usuário quando o app está em background.
  // O useAgora hook gerencia o estado da chamada via RTM quando o app está em foreground.
  useEffect(() => {
    if (!user?.id) {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      return;
    }

    // 🔍 CHECK FOR INITIAL NOTIFICATION: Handle notification that launched the app
    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response) {
          console.log('📞 [MoradorLayout] No initial notification found');
          return;
        }

        const payload = response.notification.request.content.data as Record<string, unknown>;
        if (payload?.type !== 'intercom_call') {
          console.log('📞 [MoradorLayout] Initial notification is not intercom call');
          return;
        }

        const callId = payload?.callId as string | undefined;
        if (callId && typeof callId === 'string') {
          console.log(`📞 [MoradorLayout] App launched by notification for call ${callId}`);
          lastNotificationCallIdRef.current = callId;

          // Small delay to ensure Agora context is ready
          setTimeout(() => {
            void agoraContext.checkForActiveCall(callId).catch((error) => {
              console.error('❌ [MoradorLayout] Error checking initial notification call:', error);
            });
          }, 1000);
        }
      } catch (error) {
        console.error('❌ [MoradorLayout] Error checking initial notification:', error);
      }
    };

    void checkInitialNotification();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const payload = notification.request.content.data as Record<string, unknown>;
      if (payload?.type !== 'intercom_call') {
        return;
      }

      console.log('📞 [MoradorLayout] Push notification de interfone recebida (foreground)');

      // Extract callId and attempt recovery
      const callId = payload?.callId as string | undefined;
      if (callId && typeof callId === 'string') {
        console.log(`📞 [MoradorLayout] Foreground notification for call ${callId}`);
        lastNotificationCallIdRef.current = callId;

        // Attempt to recover call state (RTM might be delayed)
        void agoraContext.checkForActiveCall(callId).catch((error) => {
          console.error('❌ [MoradorLayout] Error checking active call:', error);
        });
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = response.notification.request.content.data as Record<string, unknown>;
      if (payload?.type !== 'intercom_call') {
        return;
      }

      console.log(
        '📞 [MoradorLayout] Usuário interagiu com notificação de chamada:',
        response.actionIdentifier
      );

      // Extract callId and recover call state
      const callId = payload?.callId as string | undefined;
      if (callId && typeof callId === 'string') {
        console.log(`📞 [MoradorLayout] User tapped notification for call ${callId}`);
        lastNotificationCallIdRef.current = callId;

        void agoraContext.checkForActiveCall(callId).catch((error) => {
          console.error('❌ [MoradorLayout] Error recovering call from notification:', error);
        });
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      lastNotificationCallIdRef.current = null;
    };
  }, [user?.id, agoraContext.checkForActiveCall]);

  // 📞 APP STATE LISTENER: Check for pending calls when app comes to foreground
  useEffect(() => {
    if (!user?.id) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('🔄 [MoradorLayout] App became active');

        // If we have a pending notification callId, check for active call
        const pendingCallId = lastNotificationCallIdRef.current;
        if (pendingCallId) {
          console.log(`📞 [MoradorLayout] Checking pending call ${pendingCallId}`);

          void agoraContext.checkForActiveCall(pendingCallId).catch((error) => {
            console.error('❌ [MoradorLayout] Error checking pending call:', error);
          });

          // Clear the ref after attempting recovery
          // Don't clear immediately to allow for retry if needed
          setTimeout(() => {
            if (lastNotificationCallIdRef.current === pendingCallId) {
              lastNotificationCallIdRef.current = null;
            }
          }, 5000);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user?.id, agoraContext.checkForActiveCall]);

  return (
    <View style={styles.container}>
      {!shouldHideHeader && (
        <>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => router.push('/morador/emergency')}
            >
              <Ionicons name="warning" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.title}>🏠 Morador</Text>
              <Text style={styles.subtitle}>
                {apartmentLoading
                  ? 'Carregando...'
                  : apartmentNumber
                    ? `Apartamento ${apartmentNumber}`
                    : 'Apartamento não encontrado'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => setShowProfileMenu(true)}
            >
              <Ionicons name='person-circle' size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          <ProfileMenu
            visible={showProfileMenu}
            onClose={() => setShowProfileMenu(false)}
            items={profileMenuItems}
            placement="top-right"
          />
        </>
      )}

      <View style={styles.stackContainer}>
        <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="EnquetesTab" />
          <Stack.Screen name="authorize" />
          <Stack.Screen name="avisos" />
          <Stack.Screen name="configuracoes" />
          <Stack.Screen name="login" />
          <Stack.Screen name="logs" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="preregister" />
          <Stack.Screen name="testes" />
        </Stack>
      </View>

      {/* 📞 MODAL DE CHAMADA DE INTERFONE via useAgora + IncomingCallModal */}
      <IncomingCallModal agoraContext={agoraContext} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  alertButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarButton: {
    padding: 4,
  },
  stackContainer: {
    flex: 1,
  },
});
