import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import AdminTabsHeader from '~/components/admin/AdminTabsHeader';
import { useAuth } from '~/hooks/useAuth';

export default function AdminLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const renderTabsHeader = useCallback(() => <AdminTabsHeader />, []);
  const { user } = useAuth();

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
        <Stack.Protected guard={user?.user_type === 'admin'}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: true,
              header: renderTabsHeader,
            }}
          />
          <Stack.Screen name="polls" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="communications" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="multiple-dispatches" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="profile" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="users-create" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="users" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="vehicle-form" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="vehicles" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="buildings/index"
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="buildings/edit/[id]" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="lembretes/index" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="lembretes/novo" 
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </Stack.Protected>
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
