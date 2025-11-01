import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AutorizacoesTab from '../AutorizacoesTab';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

export default function PorteiroAutorizacoesScreen() {
  const { user } = useAuth();
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBuilding = async () => {
      if (!user?.id) {
        setBuildingId(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);

        const { data, error } = await supabase
          .from('profiles')
          .select('building_id')
          .eq('id', user.id)
          .eq('user_type', 'porteiro')
          .maybeSingle();

        if (error || !data?.building_id) {
          if (isMounted) {
            setHasError(true);
            setBuildingId(null);
          }
        } else if (isMounted) {
          setBuildingId(data.building_id);
        }
      } catch (err) {
        console.error('Erro ao carregar building_id do porteiro:', err);
        if (isMounted) {
          setHasError(true);
          setBuildingId(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadBuilding();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  if (!user?.id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Faça login novamente para acessar as autorizações.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.message}>Carregando dados...</Text>
      </View>
    );
  }

  if (hasError || !buildingId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Não foi possível carregar as autorizações. Verifique sua conexão e tente novamente.
        </Text>
      </View>
    );
  }

  return <AutorizacoesTab buildingId={buildingId} user={user} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
});
