import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { useAuth } from '~/hooks/useAuth';
import useAgoraHook from '~/hooks/useAgora';
import IncomingCallModal from '~/components/IncomingCallModal';
import { registerForPushNotificationsAsync, savePushToken } from '~/services/notificationService';
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
      onPress: () => router.push('/morador?tab=cadastro'),
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

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // 🔔 REGISTRAR PUSH TOKEN para notificações do morador
  useEffect(() => {
    const registerPushToken = async () => {
      if (!user?.id) return;

      try {
        console.log('🔔 [MoradorLayout] Registrando push token para morador:', user.id);
        const pushToken = await registerForPushNotificationsAsync();

        if (pushToken) {
          const saved = await savePushToken(user.id, pushToken);

          if (saved) {
            console.log('✅ [MoradorLayout] Push token registrado com sucesso');
          } else {
            console.warn('⚠️ [MoradorLayout] Falha ao salvar push token no banco');
          }
        } else {
          console.warn('⚠️ [MoradorLayout] Push token não obtido (emulador ou permissão negada)');
        }
      } catch (pushError) {
        console.error('❌ [MoradorLayout] Erro ao registrar push token:', pushError);
        // Não bloquear o layout por erro de push token
      }
    };

    registerPushToken();
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

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const payload = notification.request.content.data as Record<string, unknown>;
      if (payload?.type !== 'intercom_call') {
        return;
      }

      console.log('📞 [MoradorLayout] Push notification de interfone recebida (foreground)');
      // useAgora will handle the call via RTM
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
      // When user taps notification, the app comes to foreground and useAgora/RTM will sync state
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
          <Stack.Screen name="index" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="authorize" />
          <Stack.Screen name="preregister" />
          <Stack.Screen name="logs" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="emergency" />
          <Stack.Screen name="avisos" />
          <Stack.Screen name="visitantes/nome" />
          <Stack.Screen name="visitantes/cpf" />
          <Stack.Screen name="visitantes/foto" />
          <Stack.Screen name="visitantes/periodo" />
          <Stack.Screen name="visitantes/observacoes" />
          <Stack.Screen name="visitantes/confirmacao" />
          <Stack.Screen name="cadastro/novo" />
          <Stack.Screen name="cadastro/relacionamento" />
          <Stack.Screen name="cadastro/telefone" />
          <Stack.Screen name="cadastro/placa" />
          <Stack.Screen name="cadastro/acesso" />
          <Stack.Screen name="cadastro/foto" />
          <Stack.Screen name="cadastro/dias" />
          <Stack.Screen name="cadastro/horarios" />
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
