import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import TabIcon from '~/components/TabIcon';
import { useUnreadNotifications } from '~/hooks/useUnreadNotifications';

export default function AdminTabsLayout() {
  const { unreadCount } = useUnreadNotifications();

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#FF9800',
        tabBarInactiveTintColor: '#666666',
        tabBarStyle: {
          backgroundColor: '#fff',
          paddingTop: 8,
          paddingBottom: 8,
          height: 100,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      screenListeners={{
        tabPress: handleTabPress,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="dashboard" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{
          title: 'Usuários',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="clipboard" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="comunicados"
        options={{
          title: 'Comunicados',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bell" color={color} focused={focused} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tabs>
  );
}
