import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
<<<<<<< Updated upstream
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
=======
import { useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
>>>>>>> Stashed changes
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';
<<<<<<< Updated upstream
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web
import * as Notifications from 'expo-notifications';
import CustomSplashScreen from '../components/SplashScreen';
=======
import * as Notifications from 'expo-notifications';
// import { audioService } from '../services/audioService'; // Temporariamente comentado devido a problemas com expo-av na web
>>>>>>> Stashed changes

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});
<<<<<<< Updated upstream
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Carregando fontes...');
=======
  const router = useRouter();
>>>>>>> Stashed changes

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes

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
