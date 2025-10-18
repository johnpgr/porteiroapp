import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import { useAuth } from '~/hooks/useAuth';
import { registerPushTokenAfterLogin } from '~/utils/pushNotifications';

export default function AdminLayout() {
  const pathname = usePathname();
  const shouldHideBottomNav = pathname === '/admin/login';
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // 🔔 REGISTRAR PUSH TOKEN para notificações do admin
  useEffect(() => {
    const registerPushToken = async () => {
      if (!user?.id) return;

      try {
        console.log('🔔 [AdminLayout] Registrando push token para admin:', user.id);
        await registerPushTokenAfterLogin(user.id, 'admin');
        console.log('✅ [AdminLayout] Push token registrado com sucesso');
      } catch (pushError) {
        console.error('❌ [AdminLayout] Erro ao registrar push token:', pushError);
        // Não bloquear o layout por erro de push token
      }
    };

    registerPushToken();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="users" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="communications" />
        <Stack.Screen name="communications-create" />
        <Stack.Screen name="polls" />
        <Stack.Screen name="Notas" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="buildings" />
        <Stack.Screen name="emergency" />
        <Stack.Screen name="login" />
      </Stack>

      {!shouldHideBottomNav && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin')}>
            <Text style={styles.navIcon}>📊</Text>
            <Text style={styles.navLabel}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin/users')}>
            <Text style={styles.navIcon}>👥</Text>
            <Text style={styles.navLabel}>Usuários</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin/logs')}>
            <Text style={styles.navIcon}>📋</Text>
            <Text style={styles.navLabel}>Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin/communications')}>
            <Text style={styles.navIcon}>📢</Text>
            <Text style={styles.navLabel}>Avisos</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const BOTTOM_NAV_HEIGHT = 64;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: BOTTOM_NAV_HEIGHT,
    backgroundColor: '#f5f5f5',
  },
  bottomNav: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 100,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    height: BOTTOM_NAV_HEIGHT,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
});
