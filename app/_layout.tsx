import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web
import * as Notifications from 'expo-notifications';
import CustomSplashScreen from '../components/SplashScreen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Carregando fontes...');

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoadingMessage('Inicializando notificações...');
        
        // Aguardar um pouco para mostrar a mensagem
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Configurar listeners de notificações
        await notificationService.setupNotificationListeners();
        
        // Adicionar callback personalizado para processar notificações
        notificationService.addCallback((notification) => {
          console.log('🔔 Notificação processada no RootLayout:', notification);
          // Aqui você pode adicionar lógica adicional para processar notificações
        });
        
        setLoadingMessage('Finalizando configurações...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ Sistema de notificações inicializado com sucesso');
        setIsAppReady(true);
      } catch (error) {
        console.error('❌ Erro ao inicializar sistema de notificações:', error);
        setLoadingMessage('Erro na inicialização');
        // Mesmo com erro, permitir que o app continue
        setTimeout(() => setIsAppReady(true), 1000);
      }
    };

    if (loaded) {
      initializeApp();
    }
    
    // Cleanup quando o componente for desmontado
    return () => {
      notificationService.stopListening();
    };
  }, [loaded]);





  // Mostrar splash screen personalizado enquanto carrega
  if (!loaded || !isAppReady) {
    return <CustomSplashScreen isLoading={true} message={loadingMessage} />;
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
