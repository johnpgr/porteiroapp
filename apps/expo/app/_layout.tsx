import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ReadOnlyGuard } from '~/components/ReadOnlyGuard';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { SplashScreenController } from '../splash';
import { PushTokenProvider } from '../providers/PushTokenProvider';
import { DeepLinkProvider } from '../providers/DeepLinkProvider';
import { CallManagerProvider } from '../providers/CallManagerProvider';
import { NotificationProvider } from '../providers/NotificationProvider';
import { initializeNotificationHandler } from '../services/notification/notificationHandler';
import { registerBackgroundNotificationTask } from '../services/notification/backgroundTask';
import { SafeAreaView } from '~/components/SafeAreaView';

function App() {
  const { user } = useAuth();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="visitante" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
      <Stack.Screen
        name="emergency"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="avisos" options={{ headerShown: false }} />
        <Stack.Screen
          name="camera"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({});
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('🚀 Iniciando preparação do app...');

        // Initialize notification handler and background task (must happen before any push is received)
        await initializeNotificationHandler();
        await registerBackgroundNotificationTask();

        console.log('✅ App pronto, assets carregados');
        setAppReady(true);
      } catch (error) {
        console.error('❌ Erro ao preparar app:', error);
        // Mesmo com erro, marcamos appReady para não travar a splash
        setAppReady(true);
      }
    }

    if (loaded) {
      prepare();
    }
  }, [loaded]);

  if (!loaded || !appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AuthProvider>
          <SplashScreenController isAppReady={appReady} />
          <PushTokenProvider />
          <DeepLinkProvider />
          <CallManagerProvider />
          <NotificationProvider />
          <ReadOnlyGuard>
            <SafeAreaView style={{ flex: 1 }}>
              <App />
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            </SafeAreaView>
          </ReadOnlyGuard>
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
