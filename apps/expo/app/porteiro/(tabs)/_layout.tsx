import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import TabIcon from '~/components/TabIcon';
import IntercomModal from '../components/modals/IntercomModal';

export default function PorteiroTabsLayout() {
  const [isIntercomModalVisible, setIsIntercomModalVisible] = useState(false);

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleIntercomPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsIntercomModalVisible(true);
  };

  return (
    <>
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#1E88E5',
        tabBarInactiveTintColor: '#666666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      screenListeners={{ tabPress: handleTabPress }}
    >
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
        name="intercom"
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
                activeOpacity={1}
              >
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
    <IntercomModal
      visible={isIntercomModalVisible}
      onClose={() => setIsIntercomModalVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  centralButton: {
    top: -15,
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
