import { useEffect } from 'react';
import { SplashScreen } from 'expo-router';

import { useAuth } from './hooks/useAuth';

// Keep splash visible until both assets and auth session are resolved.
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('[SplashScreenController] Failed to prevent auto-hide:', error);
});

interface SplashScreenControllerProps {
  isAppReady: boolean;
}

export function SplashScreenController({ isAppReady }: SplashScreenControllerProps) {
  const { initialized, loading } = useAuth();

  useEffect(() => {
    if (!isAppReady || !initialized || loading) {
      return;
    }

    SplashScreen.hideAsync().catch((error) => {
      console.warn('[SplashScreenController] Failed to hide splash screen:', error);
    });
  }, [initialized, isAppReady]);

  return null;
}
