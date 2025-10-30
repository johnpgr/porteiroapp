import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProfileMenu, { ProfileMenuItem } from '~/components/ProfileMenu';
import { flattenStyles } from '~/utils/styles';

interface PorteiroData {
  name: string;
  initials: string;
  shift_start?: string;
  shift_end?: string;
}

interface PorteiroTopBarProps {
  porteiroData: PorteiroData | null;
  loadingPorteiro: boolean;
  connectionError: boolean;
  isInitializing: boolean;
  onLogout: () => void;
  onShiftControlPress: () => void;
  onPanicPress: () => void;
  onNotificationsPress: () => void;
  unreadNotifications?: number;
  checkShiftBeforeAction: (action: () => void, actionName?: string) => void;
}

export default function PorteiroTopBar({
  porteiroData,
  loadingPorteiro,
  connectionError,
  isInitializing,
  onLogout,
  onShiftControlPress,
  onPanicPress,
  onNotificationsPress,
  unreadNotifications = 0,
  checkShiftBeforeAction,
}: PorteiroTopBarProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (connectionError) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>❌ Erro de Conexão</Text>
          <Text style={styles.shiftText}>Verifique sua conexão com a internet</Text>
        </View>
      </View>
    );
  }

  if (isInitializing) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>Carregando ambiente</Text>
          <Text style={styles.shiftText}>Verificando status do turno...</Text>
        </View>
      </View>
    );
  }

  if (loadingPorteiro || !porteiroData) {
    return (
      <View style={styles.topMenu}>
        <View style={styles.topMenuLeft}>
          <Text style={styles.welcomeText}>Carregando...</Text>
          <Text style={styles.shiftText}>Aguarde</Text>
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
        router.push('/porteiro/profile');
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
        <Text style={styles.welcomeText}>Olá, {porteiroData.name}</Text>
        <Text style={styles.shiftText}>
          Turno: {porteiroData.shift_start} - {porteiroData.shift_end}
        </Text>
      </View>

      <View style={styles.topMenuRight}>
        {/* Botão de Pânico */}
        <TouchableOpacity
          style={styles.panicButton}
          onPress={() => checkShiftBeforeAction(onPanicPress, 'acionar emergência')}
        >
          <Text style={styles.panicButtonText}>🚨</Text>
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

        {/* Botão Circular de Controle de Turno */}
        <TouchableOpacity
          style={flattenStyles([
            styles.shiftControlButton,
            isInitializing && styles.shiftControlButtonDisabled,
          ])}
          onPress={onShiftControlPress}
          disabled={isInitializing}
        >
          <Text style={styles.shiftControlIcon}>⏰</Text>
        </TouchableOpacity>

        {/* Avatar do Usuário */}
        <TouchableOpacity
          style={styles.userAvatar}
          onPress={() => setShowUserMenu(!showUserMenu)}
        >
          <Text style={styles.avatarText}>{porteiroData.initials}</Text>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  shiftText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  panicButton: {
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
  panicButtonText: {
    fontSize: 20,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E88E5',
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
  shiftControlButton: {
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
  shiftControlButtonDisabled: {
    backgroundColor: '#9CCC9C',
    opacity: 0.6,
  },
  shiftControlIcon: {
    fontSize: 20,
    color: '#fff',
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
