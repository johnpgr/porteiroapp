import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';
import { audioService } from '../services/audioService';
import * as Notifications from 'expo-notifications';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    // Configurar listeners de notificação
    const setupNotifications = () => {
      notificationService.setupNotificationListeners(
        // Quando uma notificação é recebida
        (notification) => {
          console.log('Notificação recebida:', notification);
        },
        // Quando o usuário toca na notificação
        (response) => {
          console.log('Notificação tocada:', response);
          const data = response.notification.request.content.data;
          
          // Navegar baseado no tipo de notificação
          if (data.type === 'visitor') {
            // Navegar para tela de visitantes
          } else if (data.type === 'delivery') {
            // Navegar para tela de encomendas
          } else if (data.type === 'emergency') {
            // Mostrar alerta de emergência
          }
        }
      );
    };

    setupNotifications();

    // Cleanup ao desmontar
    return () => {
      audioService.cleanup();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
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
  );
}
