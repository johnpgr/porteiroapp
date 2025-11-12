import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import MoradorTopBar from './MoradorTopBar';
import { useAuth } from '~/hooks/useAuth';
import { useUserApartment } from '~/hooks/useUserApartment';
import { supabase } from '~/utils/supabase';

interface MoradorData {
  name: string;
  initials: string;
  apartmentNumber?: string;
}

export default function MoradorTabsHeader() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { apartment, loading: apartmentLoading } = useUserApartment();

  const [moradorData, setMoradorData] = useState<MoradorData | null>(null);
  const [loadingMorador, setLoadingMorador] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const hasLoadedMoradorDataRef = useRef<string | null>(null);

  const loadMoradorData = useCallback(async () => {
    if (!user?.id || authLoading) return;

    if (hasLoadedMoradorDataRef.current === user.id) {
      return;
    }
    hasLoadedMoradorDataRef.current = user.id;

    try {
      setLoadingMorador(true);
      setConnectionError(false);

      const { error: connectionError } = await supabase.from('profiles').select('id').limit(1);
      if (connectionError) {
        setConnectionError(true);
        hasLoadedMoradorDataRef.current = null;
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .eq('user_type', 'morador')
        .single();

      if (profileError) {
        const nameParts = (user.email || 'user@morador.app').split('@')[0].split('.');
        const name = nameParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('');

        setMoradorData({
          name,
          initials,
          apartmentNumber: apartment?.number,
        });
      } else {
        const nameParts = (profile.full_name || user.email || 'Morador').split(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2);

        setMoradorData({
          name: profile.full_name || user.email || 'Morador',
          initials,
          apartmentNumber: apartment?.number,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados do morador:', error);
      setConnectionError(true);
      hasLoadedMoradorDataRef.current = null;
    } finally {
      setLoadingMorador(false);
    }
  }, [authLoading, user?.email, user?.id, apartment?.number]);

  useEffect(() => {
    if (!authLoading && user?.id && !apartmentLoading) {
      loadMoradorData();
    }
  }, [authLoading, loadMoradorData, user?.id, apartmentLoading]);

  const handleEmergency = () => {
    router.push('/emergency');
  };

  const handleNotifications = () => {
    router.push('/avisos');
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
            router.replace('/');
          } catch (error) {
            console.error('Erro ao fazer logout:', error);
            Alert.alert('Erro', 'Não foi possível fazer logout. Tente novamente.');
          }
        },
      },
    ]);
  };

  return (
    <MoradorTopBar
      moradorData={moradorData}
      loadingMorador={loadingMorador}
      connectionError={connectionError}
      onLogout={handleLogout}
      onEmergencyPress={handleEmergency}
      onNotificationsPress={handleNotifications}
      unreadNotifications={0}
    />
  );
}
