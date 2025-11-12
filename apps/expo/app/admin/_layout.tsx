import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import AdminTabsHeader from '~/components/admin/AdminTabsHeader';

export default function AdminLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const renderTabsHeader = useCallback(() => <AdminTabsHeader />, []);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: true,
            header: renderTabsHeader,
          }}
        />
        <Stack.Screen name="polls" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="buildings" />
        <Stack.Screen name="login" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
