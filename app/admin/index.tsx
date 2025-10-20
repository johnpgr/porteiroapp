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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);

  const [showAvatarMenu, setShowAvatarMenu] = useState(false);



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
        return;
      }

      // Buscar apenas os prédios gerenciados pelo administrador atual
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map(b => b.id) || [];

      if (buildingIds.length === 0) {
        console.log('Nenhum prédio encontrado para este administrador');
        setBuildings([]);
        setApartments([]);
        return;
      }

      const apartmentsData = await supabase
        .from('apartments')
        .select('*')
        .in('building_id', buildingIds)
        .order('number');

      setBuildings(adminBuildings || []);
      setApartments(apartmentsData.data || []);
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
                    router.replace('/');
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
        
        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => router.push('/admin/lembretes')}>
          <Text style={styles.statIcon}>📝</Text>
          <Text style={styles.statLabel}>Notas</Text>
          <Text style={styles.statDescription}>Gerenciar Notas</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );

  const renderContent = () => {
    return renderDashboard();
  };

  return (
    <ProtectedRoute redirectTo="/admin/login" userType="admin">
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        {renderContent()}
        {/* BottomNav fixa é renderizada no layout global */}
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
