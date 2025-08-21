import React, { useState } from 'react';
import { Link, router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { flattenStyles } from '~/utils/styles';
import ProtectedRoute from '~/components/ProtectedRoute';
import { useAuth } from '~/hooks/useAuth';

export default function MoradorDashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('inicio');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  const handleLogout = async () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.alertButton} onPress={() => router.push('/admin/emergency')}>
        <Ionicons name="warning" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.title}>🏠 Morador</Text>
        <Text style={styles.subtitle}>Apartamento 101</Text>
      </View>

      <TouchableOpacity style={styles.avatarButton} onPress={() => setShowAvatarMenu(true)}>
        <Ionicons name="person-circle" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderAvatarMenu = () => (
    <Modal
      visible={showAvatarMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAvatarMenu(false)}>
      <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowAvatarMenu(false)}>
        <View style={styles.avatarMenu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              router.push('/morador/profile');
            }}>
            <Ionicons name="person" size={20} color="#333" />
            <Text style={styles.menuText}>Ver/Editar Perfil</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowAvatarMenu(false);
              handleLogout();
            }}>
            <Ionicons name="log-out" size={20} color="#f44336" />
            <Text style={[styles.menuText, { color: '#f44336' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'inicio':
        return renderInicioTab();
      case 'visitantes':
        return renderVisitantesTab();
      case 'cadastro':
        return renderCadastroTab();
      case 'avisos':
        return renderAvisosTab();
      default:
        return renderInicioTab();
    }
  };

  const renderInicioTab = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📬 Notificações Pendentes</Text>

        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>👤 Roberto Silva quer subir</Text>
            <Text style={styles.notificationTime}>há 5 min</Text>
          </View>
          <View style={styles.notificationActions}>
            <TouchableOpacity style={[styles.actionButton, styles.approveButton]}>
              <Text style={styles.actionButtonText}>✅ Aprovar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.denyButton]}>
              <Text style={styles.actionButtonText}>❌ Recusar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>📦 Encomenda da Amazon chegou</Text>
            <Text style={styles.notificationTime}>há 15 min</Text>
          </View>
          <View style={styles.notificationActions}>
            <TouchableOpacity style={[styles.actionButton, styles.porterButton]}>
              <Text style={styles.actionButtonText}>🏢 Deixar na portaria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.elevatorButton]}>
              <Text style={styles.actionButtonText}>🛗 Colocar no elevador</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Histórico de Visitantes</Text>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Maria Santos</Text>
          <Text style={styles.historyDetails}>Prestadora de serviço • Hoje às 14:30</Text>
          <Text style={styles.historyStatus}>✅ Autorizada</Text>
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>João Oliveira</Text>
          <Text style={styles.historyDetails}>Visita social • Ontem às 19:15</Text>
          <Text style={styles.historyStatus}>✅ Autorizada</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderVisitantesTab = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Pré-cadastro de Visitantes</Text>
        <Text style={styles.sectionDescription}>
          Cadastre visitantes esperados para facilitar a entrada
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/morador/visitantes/novo')}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.primaryButtonText}>Cadastrar Novo Visitante</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Visitantes Pré-cadastrados</Text>

        <View style={styles.visitorCard}>
          <Text style={styles.visitorName}>Carlos Silva</Text>
          <Text style={styles.visitorType}>🔧 Prestador de serviço</Text>
          <Text style={styles.visitorDate}>Válido até: 25/12/2024</Text>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderCadastroTab = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Cadastro de Pessoas</Text>
        <Text style={styles.sectionDescription}>
          Cadastre familiares, funcionários e pessoas autorizadas
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/morador/cadastro/novo')}>
          <Ionicons name="person-add" size={24} color="#fff" />
          <Text style={styles.primaryButtonText}>Cadastrar Nova Pessoa</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Pessoas Cadastradas</Text>

        <View style={styles.personCard}>
          <Text style={styles.personName}>Ana Silva</Text>
          <Text style={styles.personRelation}>💑 Cônjuge</Text>
          <Text style={styles.personAccess}>👤 Usuário do app</Text>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.personCard}>
          <Text style={styles.personName}>Pedro Silva</Text>
          <Text style={styles.personRelation}>👶 Filho</Text>
          <Text style={styles.personAccess}>🚫 Sem acesso ao app</Text>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderAvisosTab = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📢 Avisos do Condomínio</Text>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>🛗 Manutenção do Elevador</Text>
          <Text style={styles.noticeDescription}>
            O elevador social estará em manutenção preventiva no dia 28/12/2024 das 8h às 17h.
          </Text>
          <Text style={styles.noticeTime}>Publicado em 20/12/2024 às 10:30</Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>💧 Interrupção no Fornecimento de Água</Text>
          <Text style={styles.noticeDescription}>
            Haverá interrupção no fornecimento de água no dia 30/12/2024 das 9h às 15h para
            manutenção da caixa d&apos;água.
          </Text>
          <Text style={styles.noticeTime}>Publicado em 18/12/2024 às 14:15</Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>🎄 Festa de Fim de Ano</Text>
          <Text style={styles.noticeDescription}>
            Convidamos todos os moradores para a festa de fim de ano que acontecerá no salão de
            festas no dia 31/12/2024 às 20h.
          </Text>
          <Text style={styles.noticeTime}>Publicado em 15/12/2024 às 16:45</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderBottomNavigation = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={[styles.navItem, activeTab === 'inicio' && styles.navItemActive]}
        onPress={() => setActiveTab('inicio')}>
        <Ionicons
          name={activeTab === 'inicio' ? 'home' : 'home-outline'}
          size={24}
          color={activeTab === 'inicio' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'inicio' && styles.navLabelActive]}>
          Início
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === 'visitantes' && styles.navItemActive]}
        onPress={() => setActiveTab('visitantes')}>
        <Ionicons
          name={activeTab === 'visitantes' ? 'people' : 'people-outline'}
          size={24}
          color={activeTab === 'visitantes' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'visitantes' && styles.navLabelActive]}>
          Visitantes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === 'cadastro' && styles.navItemActive]}
        onPress={() => setActiveTab('cadastro')}>
        <Ionicons
          name={activeTab === 'cadastro' ? 'person-add' : 'person-add-outline'}
          size={24}
          color={activeTab === 'cadastro' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'cadastro' && styles.navLabelActive]}>
          Cadastro
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === 'avisos' && styles.navItemActive]}
        onPress={() => setActiveTab('avisos')}>
        <Ionicons
          name={activeTab === 'avisos' ? 'notifications' : 'notifications-outline'}
          size={24}
          color={activeTab === 'avisos' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.navLabel, activeTab === 'avisos' && styles.navLabelActive]}>
          Avisos
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          {renderHeader()}
          {renderContent()}
          {renderBottomNavigation()}
          {renderAvatarMenu()}
        </View>
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
    backgroundColor: '#4CAF50',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  alertButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  avatarButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  denyButton: {
    backgroundColor: '#f44336',
  },
  porterButton: {
    backgroundColor: '#2196F3',
  },
  elevatorButton: {
    backgroundColor: '#FF9800',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  historyDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  visitorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  personCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  personRelation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  personAccess: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noticeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noticeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noticeTime: {
    fontSize: 12,
    color: '#999',
  },
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
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  avatarMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
});
