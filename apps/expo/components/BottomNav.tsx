import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

export type BottomNavTab = 'inicio' | 'visitantes' | 'cadastro' | 'avisos';

interface BottomNavProps {
  activeTab?: BottomNavTab;
  onTabPress?: (tab: BottomNavTab) => void;
}

export default function BottomNav({ activeTab, onTabPress }: BottomNavProps) {
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

  const navigateToTab = (tab: BottomNavTab) => {
    if (onTabPress) {
      onTabPress(tab);
      return;
    }

    switch (tab) {
      case 'inicio':
        router.push('/morador');
        break;
      case 'visitantes':
        // Navega para a página principal do morador com parâmetro para mostrar aba visitantes
        router.push('/morador?tab=visitantes');
        break;
      case 'cadastro':
        // Leva para a aba de cadastro dentro do dashboard principal
        router.push('/morador?tab=cadastro');
        break;
      case 'avisos':
        // Navega para a página principal do morador com parâmetro para mostrar aba avisos
        router.push('/morador?tab=avisos');
        break;
    }
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={[styles.navItem, currentTab === 'inicio' && styles.navItemActive]}
        onPress={() => navigateToTab('inicio')}>
        <Text style={[styles.navIcon, currentTab === 'inicio' && styles.navIconActive]}>
          🏠
        </Text>
        <Text style={[styles.navLabel, currentTab === 'inicio' && styles.navLabelActive]}>
          Início
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'visitantes' && styles.navItemActive]}
        onPress={() => navigateToTab('visitantes')}>
        <Text style={[styles.navIcon, currentTab === 'visitantes' && styles.navIconActive]}>
          👥
        </Text>
        <Text style={[styles.navLabel, currentTab === 'visitantes' && styles.navLabelActive]}>
          Visitantes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'cadastro' && styles.navItemActive]}
        onPress={() => navigateToTab('cadastro')}>
        <Text style={[styles.navIcon, currentTab === 'cadastro' && styles.navIconActive]}>
          📝
        </Text>
        <Text style={[styles.navLabel, currentTab === 'cadastro' && styles.navLabelActive]}>
          Cadastro
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'avisos' && styles.navItemActive]}
        onPress={() => navigateToTab('avisos')}>
        <Text style={[styles.navIcon, currentTab === 'avisos' && styles.navIconActive]}>
          🔔
        </Text>
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
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navIconActive: {
    // Emojis não precisam de cor diferente quando ativos
  },
});
