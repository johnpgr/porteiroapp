import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AdminTopBar from './AdminTopBar';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';

interface AdminData {
  name: string;
  initials: string;
  role?: string;
}

export default function AdminTabsHeader() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const hasLoadedAdminDataRef = useRef<string | null>(null);

  const loadAdminData = useCallback(async () => {
    if (!user?.id || authLoading) return;

    if (hasLoadedAdminDataRef.current === user.id) {
      return;
    }
    hasLoadedAdminDataRef.current = user.id;

    try {
      setLoadingAdmin(true);
      setConnectionError(false);

      const { error: connectionError } = await supabase.from('profiles').select('id').limit(1);
      if (connectionError) {
        setConnectionError(true);
        hasLoadedAdminDataRef.current = null;
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, user_type')
        .eq('user_id', user.id)
        .in('user_type', ['admin', 'superadmin'])
        .single();

      if (profileError) {
        const nameParts = (user.email || 'user@admin.app').split('@')[0].split('.');
        const name = nameParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('');

        setAdminData({
          name,
          initials,
          role: 'Administrador',
        });
      } else {
        const nameParts = (profile.full_name || user.email || 'Admin').split(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2);

        const roleMap: Record<string, string> = {
          admin: 'Administrador',
          superadmin: 'Super Admin',
        };

        setAdminData({
          name: profile.full_name || user.email || 'Admin',
          initials,
          role: roleMap[profile.user_type ?? 'admin'] || 'Administrador',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error);
      setConnectionError(true);
      hasLoadedAdminDataRef.current = null;
    } finally {
      setLoadingAdmin(false);
    }
  }, [authLoading, user?.email, user?.id]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      loadAdminData();
    }
  }, [authLoading, loadAdminData, user?.id]);

  const handleEmergency = () => {
    router.push('/emergency');
  };

  const handleLogout = async () => {
    Alert.alert('Confirmar Logout', 'Deseja realmente sair do sistema?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch (error) {
            console.error('Erro ao fazer logout:', error);
            Alert.alert('Erro', 'Não foi possível fazer logout. Tente novamente.');
          }
        },
      },
    ]);
  };

  return (
    <AdminTopBar
      adminData={adminData}
      loadingAdmin={loadingAdmin}
      connectionError={connectionError}
      onLogout={handleLogout}
      onEmergencyPress={handleEmergency}
    />
  );
}
