import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from './useAuth';
import { notificationApi } from '../services/notificationApi';

interface TokenNotification {
  id: string;
  visitor_log_id: string;
  token: string;
  visitor_name: string;
  resident_phone: string;
  resident_name: string;
  building: string;
  apartment: string;
  expires_at: string;
  used_at?: string;
  response?: 'approved' | 'rejected';
  response_at?: string;
  created_at: string;
  updated_at: string;
}

interface TokenResponse {
  action: 'approve' | 'reject';
  reason?: string;
}

export const useTokenNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TokenNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);

  // Buscar apartment_id do usuário
  const fetchApartmentId = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.profile_id)
        .maybeSingle();
      
      if (error) throw error;
      if (data?.apartment_id) {
        setApartmentId(data.apartment_id);
      } else {
        // Usuário sem apartamento vinculado: não é erro; apenas não há notificações a buscar
        setApartmentId(null);
      }
    } catch (err) {
      console.error('Erro ao buscar apartment_id:', err);
      setError('Erro ao identificar apartamento');
    }
  }, [user?.id]);

  // Buscar notificações de token pendentes
  const fetchTokenNotifications = useCallback(async () => {
    if (!apartmentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Buscar tokens não utilizados e não expirados
      const { data, error } = await supabase
        .from('authorization_tokens')
        .select('*')
        .eq('apartment', apartmentId)
        .is('used_at', null)
        .is('response', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setNotifications(data || []);
    } catch (err) {
      console.error('Erro ao buscar notificações de token:', err);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  // Configurar Realtime subscription para authorization_tokens
  useEffect(() => {
    if (!apartmentId) return;
    
    const channel = supabase
      .channel('token_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'authorization_tokens',
          filter: `apartment=eq.${apartmentId}`
        },
        (payload) => {
          console.log('Realtime token notification:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newToken = payload.new as TokenNotification;
            if (!newToken.used_at && !newToken.response && 
                new Date(newToken.expires_at) > new Date()) {
              // Adicionar nova notificação
              setNotifications(prev => [newToken, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedToken = payload.new as TokenNotification;
            if (updatedToken.response || updatedToken.used_at) {
              // Remover notificação respondida ou utilizada
              setNotifications(prev => 
                prev.filter(n => n.id !== updatedToken.id)
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [apartmentId]);

  // Responder à notificação de token via API
  const respondToTokenNotification = useCallback(async (
    token: string, 
    response: TokenResponse
  ) => {
    try {
      const result = await notificationApi.processAuthorization({
        token,
        action: response.action,
        reason: response.reason
      });
      
      if (result.success) {
        // Remover da lista local
        setNotifications(prev => prev.filter(n => n.token !== token));
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err: any) {
      console.error('Erro ao responder notificação de token:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Validar token
  const validateToken = useCallback(async (token: string) => {
    try {
      const result = await notificationApi.validateToken(token);
      return result;
    } catch (err: any) {
      console.error('Erro ao validar token:', err);
      return { valid: false, error: err.message };
    }
  }, []);

  // Inicializar
  useEffect(() => {
    fetchApartmentId();
  }, [fetchApartmentId]);

  useEffect(() => {
    if (apartmentId) {
      fetchTokenNotifications();
    }
  }, [apartmentId, fetchTokenNotifications]);

  const refreshNotifications = async () => {
    if (!user?.apartment_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('authorization_tokens')
        .select('*')
        .eq('apartment_id', user.apartment_id)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar tokens:', error);
        setError('Erro ao carregar notificações');
      } else {
        setNotifications(data || []);
        setError(null);
      }
    } catch (error) {
      console.error('Erro ao carregar tokens:', error);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  return {
    notifications,
    loading,
    error,
    respondToTokenNotification,
    validateToken,
    refreshNotifications
  };
};

export type { TokenNotification, TokenResponse };