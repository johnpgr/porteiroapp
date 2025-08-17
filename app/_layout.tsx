import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '../hooks/useAuth';
// import { notificationService } from '../services/notificationService'; // TEMPORARIAMENTE DESABILITADO
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web
// import * as Notifications from 'expo-notifications'; // TEMPORARIAMENTE DESABILITADO

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

  // TEMPORARIAMENTE DESABILITADO - PUSH NOTIFICATIONS
  // useEffect(() => {
  //   const setupNotifications = () => {
  //     notificationService.setupNotificationListeners(
  //       (notification) => {
  //         console.log('Notificação recebida:', notification);
  //       },
  //       (response) => {
  //         const data = response.notification.request.content.data;
  //         console.log('Resposta da notificação:', data);
  //       }
  //     );
  //   };

  //   setupNotifications();
  // }, []);

  // FUNÇÃO SETUPNOTIFICATIONS DESABILITADA TEMPORARIAMENTE
  /*
  const setupNotifications = () => {
    notificationService.setupNotificationListeners(
      (notification) => {
        console.log('Notificação recebida:', notification);
      },
      (response) => {
        const data = response.notification.request.content.data;
        console.log('Resposta da notificação:', data);
      }
    );
  };
  */

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
