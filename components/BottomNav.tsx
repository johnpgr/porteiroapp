import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

interface BottomNavProps {
  activeTab?: string;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Determina a aba ativa baseada na rota atual se não for fornecida
  const getCurrentTab = () => {
    if (activeTab) return activeTab;
    
    if (pathname === '/morador' || pathname === '/morador/') return 'inicio';
    if (pathname.includes('/morador/visitantes')) return 'visitantes';
    if (pathname.includes('/morador/cadastro')) return 'cadastro';
    if (pathname.includes('/morador/avisos')) return 'avisos';
    
    return 'inicio';
  };

  const currentTab = getCurrentTab();

  const navigateToTab = (tab: string) => {
    switch (tab) {
      case 'inicio':
        router.push('/morador');
        break;
      case 'visitantes':
        router.push('/morador/visitantes');
        break;
      case 'cadastro':
        router.push('/morador/cadastro');
        break;
      case 'avisos':
        router.push('/morador/avisos');
        break;
    }
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={[styles.navItem, currentTab === 'inicio' && styles.navItemActive]}
        onPress={() => navigateToTab('inicio')}>
        <Ionicons
          name={currentTab === 'inicio' ? 'home' : 'home-outline'}
          size={24}
          color={currentTab === 'inicio' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, currentTab === 'inicio' && styles.navLabelActive]}>
          Início
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'visitantes' && styles.navItemActive]}
        onPress={() => navigateToTab('visitantes')}>
        <Ionicons
          name={currentTab === 'visitantes' ? 'people' : 'people-outline'}
          size={24}
          color={currentTab === 'visitantes' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, currentTab === 'visitantes' && styles.navLabelActive]}>
          Visitantes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'cadastro' && styles.navItemActive]}
        onPress={() => navigateToTab('cadastro')}>
        <Ionicons
          name={currentTab === 'cadastro' ? 'person-add' : 'person-add-outline'}
          size={24}
          color={currentTab === 'cadastro' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, currentTab === 'cadastro' && styles.navLabelActive]}>
          Cadastro
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'avisos' && styles.navItemActive]}
        onPress={() => navigateToTab('avisos')}>
        <Ionicons
          name={currentTab === 'avisos' ? 'notifications' : 'notifications-outline'}
          size={24}
          color={currentTab === 'avisos' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, currentTab === 'avisos' && styles.navLabelActive]}>
          Avisos
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navItemActive: {
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  navLabelActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});