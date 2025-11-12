import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import TabIcon from '~/components/TabIcon';

export default function MoradorTabsLayout() {
  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
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
      screenListeners={{ tabPress: handleTabPress }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitantes"
        options={{
          title: 'Visitantes',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cadastro"
        options={{
          title: 'Cadastro',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="edit" color={color} focused={focused} />
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
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          href: '/avisos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bell" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitantes/nome"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="visitantes/cpf"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="visitantes/foto"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="visitantes/periodo"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="visitantes/observacoes"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="visitantes/confirmacao"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
