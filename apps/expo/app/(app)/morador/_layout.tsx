import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, usePathname, Redirect } from 'expo-router';
import { useAuth } from '~/hooks/useAuth';
import { useFirstLogin } from '~/hooks/useFirstLogin';
import MoradorTabsHeader from '~/components/morador/MoradorTabsHeader';
import { CallSystemInitializer } from './providers/CallSystemInitializer';
import { ActiveCallBootstrapper } from './providers/ActiveCallBootstrapper';
import { IntercomNotificationListeners } from './providers/IntercomNotificationListeners';

export default function MoradorLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user } = useAuth();
  const { isFirstLogin } = useFirstLogin();
  const renderTabsHeader = useCallback(() => <MoradorTabsHeader />, []);

  const shouldHideHeader =
    pathname === '/morador/first-login' ||
    pathname.startsWith('/morador/cadastro_steps/') ||
    pathname.startsWith('/morador/visitante_steps/');

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // Blocking redirect for first login
  if (isFirstLogin && pathname !== '/morador/first-login' && user) {
    return <Redirect href="/morador/first-login" />;
  }

  return (
    <>
      <CallSystemInitializer />
      <ActiveCallBootstrapper />
      <IntercomNotificationListeners />
      <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
        <Stack.Protected guard={user?.user_type === 'morador'}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: !shouldHideHeader,
              header: renderTabsHeader,
            }}
          />
          <Stack.Screen name="authorize" />
          <Stack.Screen name="configuracoes" />
          <Stack.Screen name="logs" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="testes" />
          <Stack.Screen
            name="first-login"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="vehicle-form"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="visitor-form"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="person-form"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="owner-vehicle"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/index"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/acesso"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/dias"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/foto"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/horarios"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/placa"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/relacionamento"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="cadastro_steps/telefone"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
        </Stack.Protected>
      </Stack>
    </>
  );
}