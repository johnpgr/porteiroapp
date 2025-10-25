import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
// Removed old notification service - using Edge Functions for push notifications
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(error => {
  console.error('❌ Erro ao prevenir auto-hide da splash screen:', error);
});

// Componente interno para gerenciar push tokens
function PushTokenManager() {
  const { user, updatePushToken } = useAuth();

  useEffect(() => {
    const registerPushToken = async () => {
      // Só registra em dispositivos físicos
      if (!Device.isDevice) {
        console.log('🔔 Push notifications não são suportadas em simulador/emulador');
        return;
      }

      // Só registra se o usuário estiver autenticado
      if (!user?.id) {
        return;
      }

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
          console.log('🔔 Push token obtido:', token);
          await updatePushToken(token);
          console.log('✅ Push token registrado no banco de dados');
        }
      } catch (error) {
        console.error('❌ Erro ao registrar push token:', error);
      }
    };

    registerPushToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, updatePushToken]); // Exclude user.push_token to avoid infinite loops

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

        // Aguarda um pouco para garantir que tudo está pronto
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('✅ App pronto, escondendo splash screen');
        setAppReady(true);

        // Esconde a splash screen
        await SplashScreen.hideAsync();
        console.log('✅ Splash screen escondida');
      } catch (error) {
        console.error('❌ Erro ao preparar app:', error);
        // Mesmo com erro, esconde a splash screen
        setAppReady(true);
        SplashScreen.hideAsync().catch(e => console.error('❌ Erro ao esconder splash:', e));
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
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 [Foreground] Notificação recebida:', notification);
      // A notificação será exibida automaticamente devido ao handler acima
    });

    // Listener para quando usuário clica na notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
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
    });

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
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="porteiro" options={{ headerShown: false }} />
              <Stack.Screen name="morador" options={{ headerShown: false }} />
              <Stack.Screen name="visitante" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
