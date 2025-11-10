import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '~/hooks/useAuth';
import { agoraService } from '~/services/agora/AgoraService';

import { Ionicons } from '@expo/vector-icons';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';
import { useUserApartment } from '~/hooks/useUserApartment';
import { supabase } from '~/utils/supabase';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import { callKeepService } from '~/services/calling/CallKeepService';

export default function MoradorLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user, signOut } = useAuth();
  const { apartment, loading: apartmentLoading } = useUserApartment();
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

  // Refs para listeners
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

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

  // ✅ Initialize CallCoordinator as soon as morador logs in
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
          id: user.id,
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

        // Initialize CallKeep before CallCoordinator
        await callKeepService.setup();
        console.log('[MoradorLayout] ✅ CallKeep initialized');

        // Initialize CallCoordinator
        await callCoordinator.initialize();
        console.log('[MoradorLayout] ✅ CallCoordinator initialized');

        console.log('[MoradorLayout] ✅ Call system ready');
      } catch (error) {
        console.error('[MoradorLayout] ❌ Failed to initialize call system:', error);
        console.warn('[MoradorLayout] ⚠️ Falling back to regular notifications');
      }
    };

    void initializeCallSystem();
  }, [user?.id]);

  // NOTE: Call UI is handled globally in root _layout.tsx
  // The coordinator subscription and FullScreenCallUI rendering happens there
  // to avoid duplicate ringtones and UI instances

  // 🔄 CHECK FOR PENDING CALL ON APP STARTUP
  // Handles two scenarios:
  // 1. App launched from notification tap -> getLastNotificationResponseAsync()
  // 2. Background task stored call data -> AsyncStorage
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const checkPendingCall = async () => {
      try {
        console.log('[MoradorLayout] 🔍 Checking for pending call on startup...');
        console.log('[MoradorLayout] User ID:', user?.id);
        
        // METHOD 1: Check if app was launched from a notification tap
        // This is more reliable than AsyncStorage for detecting notification launches
        console.log('[MoradorLayout] 📱 Checking getLastNotificationResponseAsync...');
        const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
        
        if (lastNotificationResponse) {
          const rawData = lastNotificationResponse.notification.request.content.data;
          const notificationData = normalizeIntercomPayload(rawData);
          console.log('[MoradorLayout] 📞 App launched from notification:', notificationData);
          
          if (notificationData?.type === 'intercom_call' && notificationData?.callId) {
            console.log('[MoradorLayout] 🎉 Intercom call notification detected!');
            console.log('[MoradorLayout] Call ID:', notificationData.callId);
            console.log('[MoradorLayout] From:', notificationData.from);
            console.log('[MoradorLayout] Caller name:', notificationData.fromName || notificationData.callerName);
            
            // Check if call is still active
            const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
            console.log('[MoradorLayout] Checking call status at:', `${apiUrl}/api/calls/${notificationData.callId}/status`);
            
            const response = await fetch(`${apiUrl}/api/calls/${notificationData.callId}/status`);
            const result = await response.json();
            
            console.log('[MoradorLayout] Call status response:', result.data?.call?.status);

            if (result.success && (result.data?.call?.status === 'ringing' || result.data?.call?.status === 'calling')) {
              console.log('[MoradorLayout] ✅ Call still active, recovering from notification...');
              
              // Delegate to CallCoordinator to handle the call
              await callCoordinator.handleIncomingPush({
                callId: (notificationData.callId as string) || 'unknown',
                from: (notificationData.from as string) || '',
                callerName: (notificationData.fromName as string) || (notificationData.callerName as string) || 'Porteiro',
                apartmentNumber: (notificationData.apartmentNumber as string) || '',
                buildingName: (notificationData.buildingName as string) || '',
                channelName: (notificationData.channelName as string) || (notificationData.channel as string) || `call-${notificationData.callId}`,
                timestamp: Date.now(),
              });
              
              // Clear AsyncStorage backup if it exists
              await AsyncStorage.removeItem('@pending_intercom_call');
              return; // Exit early, call recovered successfully
            } else {
              console.log('[MoradorLayout] ⏭️ Call no longer active, skipping recovery');
              console.log('[MoradorLayout] Call status was:', result.data?.call?.status);
            }
          }
        } else {
          console.log('[MoradorLayout] No notification response found');
        }
        
        // METHOD 2: Check AsyncStorage (backup for when background task stored call data)
        console.log('[MoradorLayout] 💾 Checking AsyncStorage for pending call...');
        const pendingData = await AsyncStorage.getItem('@pending_intercom_call');
        
        if (!pendingData) {
          console.log('[MoradorLayout] No pending call in AsyncStorage');
          return;
        }

        const callData = JSON.parse(pendingData);
        console.log('[MoradorLayout] 📞 Found pending call in AsyncStorage:', callData.callId);
        console.log('[MoradorLayout] Call data:', callData);

        // Check if call is still active
        const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
        console.log('[MoradorLayout] Checking call status at:', `${apiUrl}/api/calls/${callData.callId}/status`);
        
        const response = await fetch(`${apiUrl}/api/calls/${callData.callId}/status`);
        const result = await response.json();
        
        console.log('[MoradorLayout] Call status response:', result.data?.call?.status);

        if (result.success && (result.data?.call?.status === 'ringing' || result.data?.call?.status === 'calling')) {
          console.log('[MoradorLayout] ✅ Call still active, recovering from AsyncStorage...');
          
          // Delegate to CallCoordinator to handle the call
          await callCoordinator.handleIncomingPush({
            callId: callData.callId,
            from: callData.from,
            callerName: callData.callerName || 'Porteiro',
            apartmentNumber: callData.apartmentNumber || '',
            buildingName: callData.buildingName || '',
            channelName: callData.channelName,
            timestamp: Date.now(),
          });
        } else {
          console.log('[MoradorLayout] ⏭️ Call no longer active, skipping recovery');
          console.log('[MoradorLayout] Call status was:', result.data?.call?.status);
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
  // The CallCoordinator handles the call lifecycle via RTM
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

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const raw = notification.request.content.data as Record<string, unknown>;
      const payload = normalizeIntercomPayload(raw);
      if (!payload) {
        return;
      }

      console.log('📞 [MoradorLayout] Push notification de interfone recebida (foreground)');
      console.log('📞 [MoradorLayout] Delegating to CallCoordinator...');

      // Delegate to CallCoordinator for proper call flow
      // CallCoordinator will: warm RTM → create session → emit event to show UI
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

      // Note: Notification actions (ANSWER_CALL, DECLINE_CALL) are handled in root _layout.tsx
      // This listener is just for tracking - the actual answer/decline is handled by callCoordinator
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
    };
  }, [user?.id]);

  // Remove old app state listener - not needed with new architecture

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
                  : apartment?.number
                    ? `Apartamento ${apartment?.number}`
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

      {/* 📞 CHAMADA DE INTERFONE
          Call UI is rendered globally in root _layout.tsx to avoid duplicates
      */}
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
