import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

interface UseUserApartmentReturn {
  apartmentNumber: string | null;
  loading: boolean;
  error: string | null;
}

export const useUserApartment = (): UseUserApartmentReturn => {
  const { user } = useAuth();
  const [apartmentNumber, setApartmentNumber] = useState<string | null>(null);
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
            apartments (
              number
            )
          `)
          .eq('profile_id', user.id)
          .eq('is_active', true)
          .single();

        console.log('Resultado da query:', { data, queryError });

        if (queryError) {
          console.error('Erro ao buscar apartamento do usuário:', queryError);
          setError('Erro ao carregar apartamento');
          setApartmentNumber(null);
        } else if (data?.apartments?.number) {
          console.log('Apartamento encontrado:', data.apartments.number);
          setApartmentNumber(data.apartments.number);
        } else {
          console.log('Nenhum apartamento encontrado para o usuário');
          setApartmentNumber(null);
        }
      } catch (err) {
        console.error('Erro inesperado ao buscar apartamento:', err);
        setError('Erro inesperado');
        setApartmentNumber(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserApartment();
  }, [user?.id]);

  return {
    apartmentNumber,
    loading,
    error
  };
};