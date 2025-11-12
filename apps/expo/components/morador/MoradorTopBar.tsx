import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';

interface MoradorData {
  name: string;
  initials: string;
  apartmentNumber?: string;
}

interface MoradorTopBarProps {
  moradorData: MoradorData | null;
  loadingMorador: boolean;
  connectionError: boolean;
  onLogout: () => void;
  onEmergencyPress: () => void;
  onNotificationsPress: () => void;
  unreadNotifications?: number;
}

export default function MoradorTopBar({
  moradorData,
  loadingMorador,
  connectionError,
  onLogout,
  onEmergencyPress,
  onNotificationsPress,
  unreadNotifications = 0,
}: MoradorTopBarProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (connectionError) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>❌ Erro de Conexão</Text>
          <Text style={styles.apartmentText}>Verifique sua conexão com a internet</Text>
        </View>
      </View>
    );
  }

  if (loadingMorador || !moradorData) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>Carregando...</Text>
          <Text style={styles.apartmentText}>Aguarde</Text>
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
        router.push('/morador/profile');
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
        <Text style={styles.welcomeText}>Olá, {moradorData.name}</Text>
        <Text style={styles.apartmentText}>
          {moradorData.apartmentNumber 
            ? `Apartamento ${moradorData.apartmentNumber}`
            : 'Apartamento não encontrado'}
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

        {/* Botão de Notificações */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={onNotificationsPress}
        >
          <Text style={styles.notificationIcon}>🔔</Text>
          {unreadNotifications > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Avatar do Usuário */}
        <TouchableOpacity
          style={styles.userAvatar}
          onPress={() => setShowUserMenu(!showUserMenu)}
        >
          <Text style={styles.avatarText}>{moradorData.initials}</Text>
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
  apartmentText: {
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
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
});
