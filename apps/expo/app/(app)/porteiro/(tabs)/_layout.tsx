import React from 'react';
import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import TabIcon from '~/components/TabIcon';

export default function PorteiroTabsLayout() {
  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
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
        name="consulta"
        options={{
          title: 'Consulta',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Chamadas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="phone" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
