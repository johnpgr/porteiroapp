import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  number: string;
  building_id?: string;
}

interface UseUserApartmentReturn {
  apartment: Apartment | null;
  building: Building | null;
  loading: boolean;
  error: string | null;
}

export const useUserApartment = (): UseUserApartmentReturn => {
  const { user } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserApartment = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Buscar o apartamento do usuário através da tabela apartment_residents
        console.log('Buscando apartamento para user.id:', user.id);

        const { data, error: queryError } = await supabase
          .from('apartment_residents')
          .select(`
            apartment_id,
            apartments (
              id,
              number,
              building_id,
              buildings (
                id,
                name
              )
            )
          `)
          .eq('profile_id', user.id)
          .eq('is_active', true)
          .single();

        console.log('Resultado da query:', { data, queryError });

        if (queryError) {
          console.error('Erro ao buscar apartamento do usuário:', queryError);
          setError('Erro ao carregar apartamento');
          setApartment(null);
          setBuilding(null);
        } else if (data?.apartments?.number && data?.apartment_id) {
          console.log('Apartamento encontrado:', data.apartments.number);
          setApartment({ 
            id: data.apartment_id,
            number: data.apartments.number,
            building_id: data.apartments.building_id
          });
          
          if (data.apartments.buildings) {
            setBuilding({
              id: data.apartments.buildings.id,
              name: data.apartments.buildings.name
            });
          } else {
            setBuilding(null);
          }
        } else {
          console.log('Nenhum apartamento encontrado para o usuário');
          setApartment(null);
          setBuilding(null);
        }
      } catch (err) {
        console.error('Erro inesperado ao buscar apartamento:', err);
        setError('Erro inesperado');
        setApartment(null);
        setBuilding(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserApartment();
  }, [user?.id]);

  return {
    apartment,
    building,
    loading,
    error
  };
};