import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Linking,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import { supabase, adminAuth } from '~/utils/supabase';


interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  number: string;
  building_id: string;
}

interface Activity {
  id: string;
  visitor_name: string;
  apartment_number: string;
  building_name: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [showAvatarMenu, setShowAvatarMenu] = useState(false);



  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchData = async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        return;
      }

      // Buscar apenas os prédios gerenciados pelo administrador atual
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);

      const [apartmentsData, activitiesData] = await Promise.all([
        supabase.from('apartments').select('*').order('number'),
        supabase
          .from('visitor_logs')
          .select('*, apartments(number), buildings(name)')
          .limit(10)
          .order('created_at', { ascending: false }),
      ]);
      setBuildings(adminBuildings || []);
      setApartments(apartmentsData.data || []);
      setActivities(activitiesData.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };



  const handleEmergency = () => {
    router.push('/admin/emergency');
  };



  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={() => setShowAvatarMenu(!showAvatarMenu)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👨‍💼</Text>
            </View>
          </TouchableOpacity>
          {showAvatarMenu && (
            <View style={styles.avatarMenu}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowAvatarMenu(false);
                  router.push('/admin/profile');
                }}>
                <Text style={styles.menuItemText}>👤 Meu Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItemLast}
                onPress={async () => {
                  setShowAvatarMenu(false);
                  try {
                    await supabase.auth.signOut();
                    router.replace('/admin/login');
                  } catch (error) {
                    console.error('Erro ao fazer logout:', error);
                    Alert.alert('Erro', 'Não foi possível fazer logout');
                  }
                }}>
                <Text style={styles.menuItemText}>🚪 Sair</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.title}>Painel Admin</Text>
        <TouchableOpacity style={styles.panicButton} onPress={handleEmergency}>
          <Text style={styles.panicButtonText}>🚨</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.content}>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{buildings.length}</Text>
          <Text style={styles.statLabel}>Prédios gerenciados</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/admin/buildings')}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.activitiesContainer}>
        <Text style={styles.sectionTitle}>Atividades Recentes</Text>
        {activities.map((activity, index) => (
          <View key={index} style={styles.activityItem}>
            <Text style={styles.activityText}>
              Visitante {activity.visitor_name} chegou para o apartamento{' '}
              {activity.apartment_number} em {new Date(activity.created_at).toLocaleString('pt-BR')}{' '}
              - {activity.building_name}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );





  const renderBottomNavigation = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
        onPress={() => setActiveTab('dashboard')}>
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

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/admin/communications')}>
        <Text style={styles.navIcon}>📢</Text>
        <Text style={styles.navLabel}>Avisos</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    return renderDashboard();
  };

  return (
    <ProtectedRoute redirectTo="/admin/login" userType="admin">
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        {renderContent()}
        {renderBottomNavigation()}
      </SafeAreaView>
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
    fontSize: 20,
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
    paddingBottom: 80,
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
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
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
  activitiesContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  activityItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#666',
  },
  cardsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  vehicleActionsContainer: {
    padding: 20,
    gap: 12,
  },
  vehicleSearchContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  vehicleSearchButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  vehicleSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchCardInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  newUserCard: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  newUserCardText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  addForm: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  roleSelector: {
    marginBottom: 15,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    padding: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  photoButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  usersList: {
    padding: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  picker: {
    height: 50,
  },


  bottomNav: {
    position: 'absolute',
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
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#e3f2fd',
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
  avatarContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  avatarMenu: {
    position: 'absolute',
    top: 50,
    left: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    minWidth: 150,
    zIndex: 10000,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  menuItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLast: {
    padding: 15,
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

});
