import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});
  const router = useRouter();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Configurar listeners de notificação push
  useEffect(() => {
    // Não configurar na web
    if (Platform.OS === 'web') return;

    const cleanup = notificationService.setupNotificationListeners(
      // Quando notificação é recebida (app em foreground)
      (notification) => {
        console.log('🔔 Notificação recebida (app aberto):', notification);
        // Você pode mostrar um banner customizado aqui se quiser
      },
      // Quando usuário toca na notificação
      (response) => {
        const data = response.notification.request.content.data;
        console.log('🔔 Usuário tocou na notificação:', data);

        // Navegar para tela apropriada baseado no tipo
        if (data.type === 'visitor' && data.apartmentNumber) {
          // Navegar para tela de visitantes
          router.push('/morador/notifications');
        } else if (data.type === 'delivery') {
          // Navegar para tela de encomendas
          router.push('/morador/notifications');
        } else if (data.type === 'emergency') {
          // Navegar para tela de emergências
          router.push('/morador/emergency');
        } else if (data.type === 'communication') {
          // Navegar para tela de comunicações
          router.push('/morador/notifications');
        }
      }
    );

    // Cleanup quando componente desmontar
    return cleanup;
  }, [router]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <AuthProvider>
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
