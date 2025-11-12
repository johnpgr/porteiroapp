import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';

interface AdminData {
  name: string;
  initials: string;
  role?: string;
}

interface AdminTopBarProps {
  adminData: AdminData | null;
  loadingAdmin: boolean;
  connectionError: boolean;
  onLogout: () => void;
  onEmergencyPress: () => void;
}

export default function AdminTopBar({
  adminData,
  loadingAdmin,
  connectionError,
  onLogout,
  onEmergencyPress,
}: AdminTopBarProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (connectionError) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>❌ Erro de Conexão</Text>
          <Text style={styles.roleText}>Verifique sua conexão com a internet</Text>
        </View>
      </View>
    );
  }

  if (loadingAdmin || !adminData) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>Carregando...</Text>
          <Text style={styles.roleText}>Aguarde</Text>
        </View>
      </View>
    );
  }

  const menuItems: ProfileMenuItem[] = [
    {
      label: 'Perfil',
      iconName: 'person',
      onPress: () => {
        setShowUserMenu(false);
        router.push('/admin/profile');
      },
    },
    {
      label: 'Logout',
      iconName: 'log-out',
      iconColor: '#f44336',
      destructive: true,
      onPress: () => {
        setShowUserMenu(false);
        onLogout();
      },
    },
  ];

  return (
    <View style={styles.topMenu}>
      <View style={styles.topMenuLeft}>
        <Text style={styles.welcomeText}>Olá, {adminData.name}</Text>
        <Text style={styles.roleText}>
          {adminData.role || 'Administrador'}
        </Text>
      </View>

      <View style={styles.topMenuRight}>
        {/* Botão de Emergência */}
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={onEmergencyPress}
        >
          <Text style={styles.emergencyButtonText}>🚨</Text>
        </TouchableOpacity>

        {/* Avatar do Usuário */}
        <TouchableOpacity
          style={styles.userAvatar}
          onPress={() => setShowUserMenu(!showUserMenu)}
        >
          <Text style={styles.avatarText}>{adminData.initials}</Text>
        </TouchableOpacity>

        <ProfileMenu
          visible={showUserMenu}
          onClose={() => setShowUserMenu(false)}
          items={menuItems}
          placement="top-right"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 100,
  },
  topMenuLeft: {
    flex: 1,
  },
  topMenuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  roleText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emergencyButton: {
    backgroundColor: '#FF5722',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emergencyButtonText: {
    fontSize: 20,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    position: 'relative',
  },
  notificationIcon: {
    fontSize: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  settingsIcon: {
    fontSize: 20,
  },
  userAvatar: {
    backgroundColor: '#2196F3',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
