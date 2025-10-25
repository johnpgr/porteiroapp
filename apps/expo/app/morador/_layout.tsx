import { useEffect, useRef, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { useAuth } from '~/hooks/useAuth';
import useAgoraHook from '~/hooks/useAgora';
import IncomingCallModal from '~/components/IncomingCallModal';
import { registerForPushNotificationsAsync, savePushToken } from '~/services/notificationService';

export default function MoradorLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user } = useAuth();

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
    <>
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

      {/* 📞 MODAL DE CHAMADA DE INTERFONE via useAgora + IncomingCallModal */}
      <IncomingCallModal agoraContext={agoraContext} />
    </>
  );
}
