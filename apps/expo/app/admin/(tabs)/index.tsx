import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';
import { supabase, adminAuth } from '~/utils/supabase';

interface Building {
  id: string;
  name: string;
}

export default function AdminDashboardTab() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map((b) => b.id) || [];

      if (buildingIds.length === 0) {
        setBuildings([]);
        return;
      }

      setBuildings(adminBuildings || []);
      // apartments fetching removed in tabs refactor
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleEmergency = () => {
    router.push('/admin/emergency');
  };

  const menuItems: ProfileMenuItem[] = [
    {
      label: 'Meu Perfil',
      iconName: 'person',
      onPress: () => {
        setShowAvatarMenu(false);
        router.push('/admin/profile');
      },
    },
    {
      label: 'Sair',
      iconName: 'log-out',
      iconColor: '#f44336',
      destructive: true,
      onPress: async () => {
        setShowAvatarMenu(false);
        try {
          await supabase.auth.signOut();
          router.replace('/');
        } catch (error) {
          console.error('Erro ao fazer logout:', error);
          Alert.alert('Erro', 'Não foi possível fazer logout');
        }
      },
    },
  ];

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity style={styles.panicButton} onPress={handleEmergency}>
          <Text style={styles.panicButtonText}>🚨</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Painel Admin</Text>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={() => setShowAvatarMenu((prev) => !prev)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👨‍💼</Text>
            </View>
          </TouchableOpacity>
          <ProfileMenu
            visible={showAvatarMenu}
            onClose={() => setShowAvatarMenu(false)}
            items={menuItems}
            placement="top-right"
          />
        </View>
      </View>
    </View>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.content}>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{buildings.length}</Text>
          <Text style={styles.statLabel}>Prédios gerenciados</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/admin/buildings')}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/lembretes')}>
          <Text style={styles.statIcon}>📝</Text>
          <Text style={styles.statLabel}>Notas</Text>
          <Text style={styles.statDescription}>Gerenciar Notas</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <ProtectedRoute redirectTo="/admin/login" userType="admin">
      <View style={styles.container}>
        {renderHeader()}
        {renderDashboard()}
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingBottom: 15,
    paddingTop: 15,
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingHorizontal: 20,
    zIndex: 50,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  panicButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f44336',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicButtonText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  statDescription: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  avatarContainer: {
    position: 'relative',
    zIndex: 1000,
  },
});
