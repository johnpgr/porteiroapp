import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, AppState } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '~/hooks/useAuth';
import useAgoraHook from '~/hooks/useAgora';
import { agoraService } from '~/services/agora/AgoraService';
import IncomingCallModal from '~/components/IncomingCallModal';

import { Ionicons } from '@expo/vector-icons';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';
import { useUserApartment } from '~/hooks/useUserApartment';
import { callKeepService } from '~/services/CallKeepService';
import { supabase } from '~/utils/supabase';
import { callCoordinator } from '~/services/calling/CallCoordinator';

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
  // Use profile_id for RTM identity to match backend invite targets (profiles.id)
  const agoraContext = useAgoraHook({
    currentUser: user
      ? {
          id: (user as any)?.profile_id ?? user.id,
          userType: 'morador',
          displayName: (user as any)?.user_metadata?.full_name || user.email || null,
        }
      : null,
    appId: process.env.EXPO_PUBLIC_AGORA_APP_ID,
  });

  // Refs para listeners
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);
  const lastNotificationCallIdRef = useRef<string | null>(null);

  // Normalize incoming payload (supports Expo payloads that wrap JSON in strings)
  const normalizeIntercomPayload = (raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
    if (!raw || typeof raw !== 'object') return null;
    if ((raw as any).type === 'intercom_call') return raw as Record<string, unknown>;
    // Try parse string fields commonly used by Expo/FCM bridges
    const dataString = (raw as any).dataString;
    const body = (raw as any).body;
    try {
      if (typeof dataString === 'string') {
        const parsed = JSON.parse(dataString);
        if (parsed && parsed.type === 'intercom_call') return parsed;
      }
    } catch {}
    try {
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        if (parsed && parsed.type === 'intercom_call') return parsed;
      }
    } catch {}
    return null;
  };

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // ✅ Initialize CallCoordinator + CallKeep as soon as morador logs in
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const initializeCallSystem = async () => {
      try {
        console.log('[MoradorLayout] 🚀 Initializing call system...');

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('notification_enabled')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('[MoradorLayout] ❌ Failed to fetch notification preference:', error);
        }

        if (!profile || profile.notification_enabled !== true) {
          console.log('[MoradorLayout] ⏭️ Skipping call system - notifications disabled for user');
          return;
        }

        // Set user context for AgoraService (needed by CallCoordinator)
        agoraService.setCurrentUser({
          id: (user as any)?.profile_id ?? user.id,
          userType: 'morador',
          displayName: (user as any)?.user_metadata?.full_name || user.email || null,
        });

        // Initialize RTM standby connection immediately
        console.log('[MoradorLayout] 🔐 Initializing RTM standby...');
        try {
          await agoraService.initializeStandby();
          console.log('[MoradorLayout] ✅ RTM standby initialized');
        } catch (error) {
          console.error('[MoradorLayout] ❌ RTM initialization failed (non-critical):', error);
          // Don't block call system initialization if RTM fails
          // RTM will be retried on-demand when call arrives
        }

        // Initialize CallKeep (may already be initialized from login flow)
        // The initialize() method is idempotent, so safe to call multiple times
        await callKeepService.initialize();
        console.log('[MoradorLayout] ✅ CallKeep initialized');

        // Request permissions (may already be granted from login flow)
        // This is a no-op if permissions were already granted
        const granted = await callKeepService.requestPermissions();
        if (!granted) {
          console.warn('[MoradorLayout] ⚠️ CallKeep permissions denied - falling back to notifications');
        } else {
          console.log('[MoradorLayout] ✅ CallKeep permissions granted');
        }

        // Initialize CallCoordinator (registers CallKeep event handlers)
        callCoordinator.initialize();
        console.log('[MoradorLayout] ✅ CallCoordinator initialized');

        console.log('[MoradorLayout] ✅ Call system ready');
      } catch (error) {
        console.error('[MoradorLayout] ❌ Failed to initialize call system:', error);
        console.warn('[MoradorLayout] ⚠️ Falling back to regular notifications');
      }
    };

    void initializeCallSystem();
  }, [user?.id]);

  // 🔄 CHECK FOR PENDING CALL ON APP STARTUP
  // If user tapped "Answer" on notification while app was killed,
  // the call data is stored in AsyncStorage and we need to recover it
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const checkPendingCall = async () => {
      try {
        console.log('[MoradorLayout] 🔍 Checking for pending call on startup...');
        const pendingData = await AsyncStorage.getItem('@pending_intercom_call');
        
        if (!pendingData) {
          console.log('[MoradorLayout] No pending call found');
          return;
        }

        const callData = JSON.parse(pendingData);
        console.log('[MoradorLayout] 📞 Found pending call:', callData.callId);

        // Check if call is still active
        const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/calls/${callData.callId}/status`);
        const result = await response.json();

        if (result.success && result.data?.status === 'ringing') {
          console.log('[MoradorLayout] ✅ Call still active, recovering...');
          
          // Delegate to CallCoordinator to handle the call
          await callCoordinator.handleIncomingPush({
            callId: callData.callId,
            from: callData.from,
            callerName: callData.callerName || 'Doorman',
            apartmentNumber: callData.apartmentNumber || '',
            buildingName: callData.buildingName || '',
            channelName: callData.channelName,
            timestamp: Date.now(),
          });
        } else {
          console.log('[MoradorLayout] ⏭️ Call no longer active, skipping recovery');
        }

        // Clear pending call data
        await AsyncStorage.removeItem('@pending_intercom_call');
        console.log('[MoradorLayout] ✅ Pending call data cleared');
      } catch (error) {
        console.error('[MoradorLayout] ❌ Error checking pending call:', error);
        // Clear corrupted data
        await AsyncStorage.removeItem('@pending_intercom_call').catch(() => {});
      }
    };

    // Small delay to ensure call system is initialized
    const timeoutId = setTimeout(() => {
      void checkPendingCall();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user?.id]);

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

    // Note: RTM standby is initialized immediately when morador logs in (see above)
    // This ensures instant readiness for incoming intercom calls
    // If RTM initialization fails, it will be retried on-demand when a call arrives

    // 🔍 CHECK FOR INITIAL NOTIFICATION: Handle notification that launched the app
    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response) {
          console.log('📞 [MoradorLayout] No initial notification found');
          return;
        }

        const raw = response.notification.request.content.data as Record<string, unknown>;
        const payload = normalizeIntercomPayload(raw);
        if (!payload) {
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
      const raw = notification.request.content.data as Record<string, unknown>;
      const payload = normalizeIntercomPayload(raw);
      if (!payload) {
        return;
      }

      console.log('📞 [MoradorLayout] Push notification de interfone recebida (foreground)');
      console.log('📞 [MoradorLayout] Delegating to CallCoordinator...');

      // Delegate to CallCoordinator for proper call flow
      // CallCoordinator will: warm RTM → create session → show CallKeep UI
      void callCoordinator.handleIncomingPush({
        callId: (payload.callId as string) || 'unknown',
        from: (payload.from as string) || '',
        callerName: (payload.fromName as string) || (payload.callerName as string) || 'Doorman',
        apartmentNumber: (payload.apartmentNumber as string) || '',
        buildingName: (payload.buildingName as string) || '',
        channelName: (payload.channelName as string) || (payload.channel as string) || `call-${payload.callId}`,
        timestamp: Date.now(),
      }).catch((error) => {
        console.error('❌ [MoradorLayout] CallCoordinator failed to handle push:', error);
      });
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const raw = response.notification.request.content.data as Record<string, unknown>;
      const payload = normalizeIntercomPayload(raw);
      if (!payload) {
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
          <Stack.Screen
            name="settings"
            options={{ headerShown: true, title: 'Ferramentas CallKeep' }}
          />
          <Stack.Screen
            name="callkeep-status"
            options={{ headerShown: true, title: 'Status CallKeep' }}
          />
          <Stack.Screen name="testes" />
        </Stack>
      </View>

      {/* 📞 CHAMADA DE INTERFONE: Hybrid approach
          - CallKeep shows native ringing UI (for background/lockscreen)
          - When user accepts, IncomingCallModal shows (brings app to foreground)
          - IncomingCallModal shows call controls and manages Agora connection
      */}
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
