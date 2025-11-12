import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import { adminAuth } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

interface Building {
  id: string;
  name: string;
}

export default function AdminDashboardTab() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setBuildings([]);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        // Silent return during logout - expected behavior
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

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.title}>📊 Painel Admin</Text>
      </View>
    </View>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.content}>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{buildings.length}</Text>
          <Text style={styles.statLabel}>Prédios gerenciados</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/admin/(modals)/buildings')}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/(modals)/lembretes')}>
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
    borderBottomEndRadius: 20,
    borderBottomStartRadius: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
});
