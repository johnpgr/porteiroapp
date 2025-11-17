import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import TabIcon from '~/components/TabIcon';

export default function PorteiroTabsLayout() {
  const router = useRouter();

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleIntercomPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/porteiro/intercom');
  };

  return (
    <>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: '#1E88E5',
          tabBarInactiveTintColor: '#666666',
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
        screenListeners={{ tabPress: handleTabPress }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Chegada',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="log-in" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="autorizacoes"
          options={{
            title: 'Autorizações',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="badge-check" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="dummy-intercom"
          options={{
            title: '',
            tabBarIcon: () => null,
            tabBarButton: (props) => {
              const { delayLongPress, ...restProps } = props as any;
              return (
                <TouchableOpacity
                  {...restProps}
                  style={styles.centralButton}
                  onPress={handleIntercomPress}
                  activeOpacity={1}>
                  <View style={styles.centralButtonInner}>
                    <TabIcon name="phone" color="#fff" focused={false} size={28} />
                  </View>
                </TouchableOpacity>
              );
            },
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tabs.Screen
          name="consulta"
          options={{
            title: 'Consulta',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="search" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="logs"
          options={{
            title: 'Logs',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="scroll-text" color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  centralButton: {
    top: -10,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  centralButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
