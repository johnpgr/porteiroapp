import React, { useEffect, useRef, useState } from 'react';
import { Stack, usePathname } from 'expo-router';

export default function PorteiroLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="visitor" />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="logs" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="emergency" />

    </Stack>
  );
}
