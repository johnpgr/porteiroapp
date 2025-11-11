import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import type { Database } from '~/../../packages/common/supabase/types/database';

type NotificationToken = Database['public']['Tables']['user_notification_tokens']['Row'];
type NotificationLog = Database['public']['Tables']['notification_logs']['Row'];

interface UseNotificationServiceReturn {
  // Token management
  registerToken: (token: string, platform: 'ios' | 'android' | 'web') => Promise<boolean>;
  unregisterToken: (token: string) => Promise<boolean>;
  getUserTokens: () => Promise<NotificationToken[]>;
  
  // Notification sending
  sendNotification: (userId: string, title: string, body: string, data?: any) => Promise<boolean>;
  sendBulkNotifications: (userIds: string[], title: string, body: string, data?: any) => Promise<{ success: number; failed: number }>;
  
  // Notification history
  getNotificationHistory: (limit?: number) => Promise<NotificationLog[]>;
  markNotificationAsRead: (notificationId: string) => Promise<boolean>;
  
  // Status
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para gerenciamento completo do sistema de notificações
 * Integra com Edge Functions do Supabase para envio de push notifications
 */
export const useNotificationService = (): UseNotificationServiceReturn => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Registra um token de dispositivo para o usuário atual
   */
  const registerToken = useCallback(async (token: string, platform: 'ios' | 'android' | 'web'): Promise<boolean> => {
    if (!user?.id) {
      console.warn('⚠️ [useNotificationService] Usuário não autenticado para registrar token');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📱 [useNotificationService] Registrando token:', { userId: user.id, platform, token: token.substring(0, 20) + '...' });

      // Verificar se o token já existe
       const { data: existingToken } = await supabase
         .from('user_notification_tokens')
         .select('id, is_active')
         .eq('user_id', user.id)
         .eq('notification_token', token)
         .single();

      if (existingToken) {
        // Token já existe, apenas ativar se necessário
        if (!existingToken.is_active) {
          const { error: updateError } = await supabase
             .from('user_notification_tokens')
             .update({ 
               is_active: true, 
               last_updated: new Date().toISOString() 
             })
             .eq('id', existingToken.id);

          if (updateError) {
            console.error('❌ [useNotificationService] Erro ao ativar token existente:', updateError);
            setError('Erro ao ativar token de notificação');
            return false;
          }
        }
        
        console.log('✅ [useNotificationService] Token já registrado e ativo');
        return true;
      }

      // Criar novo token
       const { error: insertError } = await supabase
         .from('user_notification_tokens')
         .insert({
           user_id: user.id,
           notification_token: token,
           device_type: platform,
           is_active: true,
           created_at: new Date().toISOString(),
           last_updated: new Date().toISOString()
         });

      if (insertError) {
        console.error('❌ [useNotificationService] Erro ao registrar novo token:', insertError);
        setError('Erro ao registrar token de notificação');
        return false;
      }

      console.log('✅ [useNotificationService] Token registrado com sucesso');
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [useNotificationService] Erro ao registrar token:', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Remove um token de dispositivo
   */
  const unregisterToken = useCallback(async (token: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase
         .from('user_notification_tokens')
         .update({ is_active: false, last_updated: new Date().toISOString() })
         .eq('user_id', user.id)
         .eq('notification_token', token);

      if (error) {
        console.error('❌ [useNotificationService] Erro ao desregistrar token:', error);
        setError('Erro ao desregistrar token');
        return false;
      }

      console.log('✅ [useNotificationService] Token desregistrado com sucesso');
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [useNotificationService] Erro ao desregistrar token:', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Obtém todos os tokens ativos do usuário
   */
  const getUserTokens = useCallback(async (): Promise<NotificationToken[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('user_notification_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [useNotificationService] Erro ao buscar tokens:', error);
        return [];
      }

      return data || [];

    } catch (err) {
      console.error('❌ [useNotificationService] Erro ao buscar tokens:', err);
      return [];
    }
  }, [user?.id]);

  /**
   * Envia notificação para um usuário específico usando Edge Function
   */
  const sendNotification = useCallback(async (
    userId: string, 
    title: string, 
    body: string, 
    data?: any
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📤 [useNotificationService] Enviando notificação:', { userId, title });

      const { data: result, error } = await supabase.functions.invoke('send-notification', {
        body: {
          user_id: userId,
          title,
          body,
          data: data || {},
          type: 'general'
        }
      });

      if (error) {
        console.error('❌ [useNotificationService] Erro na Edge Function:', error);
        setError('Erro ao enviar notificação');
        return false;
      }

      console.log('✅ [useNotificationService] Notificação enviada:', result);
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [useNotificationService] Erro ao enviar notificação:', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Envia notificações em lote para múltiplos usuários
   */
  const sendBulkNotifications = useCallback(async (
    userIds: string[], 
    title: string, 
    body: string, 
    data?: any
  ): Promise<{ success: number; failed: number }> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`📤 [useNotificationService] Enviando notificações em lote para ${userIds.length} usuários`);

      const promises = userIds.map(userId => 
        sendNotification(userId, title, body, data)
      );

      const results = await Promise.allSettled(promises);
      
      const success = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failed = results.length - success;

      console.log(`📊 [useNotificationService] Resultado do lote: ${success} sucessos, ${failed} falhas`);

      return { success, failed };

    } catch (err) {
      console.error('❌ [useNotificationService] Erro no envio em lote:', err);
      return { success: 0, failed: userIds.length };
    } finally {
      setIsLoading(false);
    }
  }, [sendNotification]);

  /**
   * Obtém histórico de notificações do usuário
   */
  const getNotificationHistory = useCallback(async (limit: number = 50): Promise<NotificationLog[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select(`
          *,
          notifications!inner(recipient_id)
        `)
        .eq('notifications.recipient_id', user.id)
        .order('attempted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [useNotificationService] Erro ao buscar histórico:', error);
        return [];
      }

      return data || [];

    } catch (err) {
      console.error('❌ [useNotificationService] Erro ao buscar histórico:', err);
      return [];
    }
  }, [user?.id]);

  /**
   * Marca notificação como lida
   */
  const markNotificationAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notification_logs')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('❌ [useNotificationService] Erro ao marcar como lida:', error);
        return false;
      }

      return true;

    } catch (err) {
      console.error('❌ [useNotificationService] Erro ao marcar como lida:', err);
      return false;
    }
  }, []);

  return {
    // Token management
    registerToken,
    unregisterToken,
    getUserTokens,
    
    // Notification sending
    sendNotification,
    sendBulkNotifications,
    
    // Notification history
    getNotificationHistory,
    markNotificationAsRead,
    
    // Status
    isLoading,
    error
  };
};

export default useNotificationService;