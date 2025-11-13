import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { usePathname } from 'expo-router';

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
  const pathname = usePathname();

  // Consider the initial navigation finished when we are no longer on the root index route
  // This avoids a brief blank frame during the Redirect from / to the target route
  const hasNavigatedAwayFromIndex = pathname != null && pathname !== '/' && pathname !== '/index';

  useEffect(() => {
    // Keep splash visible until all conditions are met
    const shouldHideSplash = isAppReady && initialized && !loading && hasNavigatedAwayFromIndex;
    
    if (!shouldHideSplash) {
      return;
    }

    // Hide splash screen when everything is ready
    // Use a rAF to ensure the target screen has committed before hiding to reduce flicker
    const id = requestAnimationFrame(() => {
      try {
        SplashScreen.hide();
      } catch (error) {
        console.warn('[SplashScreenController] Failed to hide splash screen:', error);
      }
    });

    return () => cancelAnimationFrame(id);
  }, [hasNavigatedAwayFromIndex, initialized, isAppReady, loading]);

  return null;
}
