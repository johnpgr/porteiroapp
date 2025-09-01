import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { RealtimeChannel } from '@supabase/supabase-js';
import { integratedNotificationService } from '../services/integratedNotificationService';
import { AvisoNotificationData } from '../services/avisosNotificationService';

// Configurar comportamento das notificações para FCM e APNS
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

// Configurar canal de notificação para Android (FCM)
if (Device.isDevice && Constants.platform?.android) {
  Notifications.setNotificationChannelAsync('avisos-enquetes', {
    name: 'Avisos e Enquetes',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#388E3C',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

interface AvisoNotification {
  id: string;
  type: 'communication' | 'poll';
  title: string;
  content?: string;
  description?: string;
  building_id: string;
  building_name?: string;
  priority?: string;
  created_at: string;
  expires_at?: string;
  notification_status?: string;
}

export const useAvisosNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AvisoNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userBuildingId, setUserBuildingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [communicationsChannel, setCommunicationsChannel] = useState<RealtimeChannel | null>(null);
  const [pollsChannel, setPollsChannel] = useState<RealtimeChannel | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Buscar building_id do usuário
  const fetchUserBuildingId = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Primeiro tentar pelo building_id direto no perfil
      if (user.building_id) {
        setUserBuildingId(user.building_id);
        return;
      }

      // Se não tiver, buscar através do apartment_residents
      const { data, error } = await supabase
        .from('apartment_residents')
        .select('apartment_id, apartments!inner(building_id)')
        .eq('profile_id', user.id as any)
        .maybeSingle();
      
      if (error) throw error;
      if ((data as any)?.apartments?.building_id) {
        setUserBuildingId((data as any).apartments.building_id);
      } else {
        // Usuário sem prédio vinculado: não é erro; apenas não há notificações a buscar
        setUserBuildingId(null);
      }
    } catch (err) {
      console.error('Erro ao buscar building_id:', err);
      setError('Erro ao identificar prédio do usuário');
    }
  }, [user?.id, user?.building_id]);

  // Inicializar serviço integrado
  const initializeIntegratedService = useCallback(async (userId: string, buildingId?: string) => {
    try {
      await integratedNotificationService.initialize(userId, buildingId);
      
      // Configurar callbacks
      integratedNotificationService.setCallbacks({
        onNewNotification: (notification: AvisoNotificationData) => {
          // Converter para formato do hook existente
          const avisoNotification: AvisoNotification = {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            content: notification.content,
            building_id: notification.building_id,
            building_name: notification.building_name,
            priority: notification.priority,
            created_at: notification.created_at,
            expires_at: notification.expires_at,
            notification_status: notification.notification_status
          };
          
          setNotifications(prev => [avisoNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        },
        onNotificationStatusUpdate: (id: string, type: string, status: string) => {
          setNotifications(prev => 
            prev.map(notif => 
              notif.id === id && notif.type === type 
                ? { ...notif, notification_status: status }
                : notif
            )
          );
          
          if (status === 'read') {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        },
        onError: (errorMessage: string) => {
          setError(errorMessage);
        }
      });
      
      console.log('✅ Serviço integrado inicializado com sucesso');
    } catch (err) {
      console.error('❌ Erro ao inicializar serviço integrado:', err);
      setError('Erro ao inicializar notificações');
    }
  }, []);

  // Função para disparar notificações automáticas para novos comunicados
  const triggerCommunicationNotification = useCallback(async (newCommunication: any) => {
    try {
      console.log('📢 Novo comunicado detectado:', newCommunication);

      // Verificar se é do prédio do usuário
      if (newCommunication.building_id !== userBuildingId) {
        return;
      }

      // Buscar dados completos do comunicado
      const { data: commData, error: commError } = await supabase
        .from('communications')
        .select(`
          id,
          title,
          content,
          type,
          priority,
          building_id,
          created_at,
          buildings (
            name
          )
        `)
        .eq('id', newCommunication.id)
        .single();

      if (commError || !commData) {
        console.error('Erro ao buscar dados do comunicado:', commError);
        return;
      }

      const buildingName = (commData as any).buildings?.name || 'Condomínio';
      
      // Definir prioridade
      const priorityText = (commData as any).priority === 'high' ? ' [URGENTE]' : ''

      // Disparar Push Notification com configurações para FCM e APNS
      try {
        const notificationConfig: any = {
          content: {
            title: '📢 Novo Comunicado',
            body: `${buildingName}: ${(commData as any).title}`,
            data: {
              type: 'new_communication',
              communication_id: (commData as any).id,
              building_id: (commData as any).building_id,
              building_name: buildingName,
              communication_type: (commData as any).type,
              priority: (commData as any).priority
            },
            sound: 'default',
            priority: (commData as any).priority === 'high' ? 'high' : 'normal',
          },
          trigger: null, // Imediato
        };

        // Configurações específicas para Android (FCM)
        if (Device.isDevice && Constants.platform?.android) {
          notificationConfig.content.android = {
            channelId: 'avisos-enquetes',
            priority: (commData as any).priority === 'high' ? 'high' : 'normal',
            vibrate: [0, 250, 250, 250],
            color: '#388E3C',
            sticky: (commData as any).priority === 'high',
          };
        }

        // Configurações específicas para iOS (APNS)
        if (Device.isDevice && Constants.platform?.ios) {
          notificationConfig.content.ios = {
            sound: 'default',
            badge: 1,
            critical: (commData as any).priority === 'high',
            interruptionLevel: (commData as any).priority === 'high' ? 'critical' : 'active',
          };
        }

        await Notifications.scheduleNotificationAsync(notificationConfig);

        console.log('✅ Notificação de comunicado enviada com sucesso');
      } catch (pushError) {
        console.error('❌ Erro ao enviar push notification de comunicado:', pushError);
      }

    } catch (error) {
      console.error('❌ Erro geral ao disparar notificação de comunicado:', error);
    }
  }, [userBuildingId]);

  // Função para disparar notificações automáticas para novas enquetes
  const triggerPollNotification = useCallback(async (newPoll: any) => {
    try {
      console.log('🗳️ Nova enquete detectada:', newPoll);

      // Verificar se é do prédio do usuário
      if (newPoll.building_id !== userBuildingId) {
        return;
      }

      // Buscar dados completos da enquete
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select(`
          id,
          title,
          description,
          building_id,
          created_at,
          expires_at,
          is_active,
          buildings (
            name
          )
        `)
        .eq('id', newPoll.id)
        .single();

      if (pollError || !pollData) {
        console.error('Erro ao buscar dados da enquete:', pollError);
        return;
      }

      const buildingName = (pollData as any).buildings?.name || 'Condomínio';
      const createdDate = new Date((pollData as any).created_at);
      const createdText = createdDate.toLocaleDateString('pt-BR');

      // Disparar Push Notification com configurações para FCM e APNS
      try {
        const notificationConfig: any = {
          content: {
            title: '🗳️ Nova Enquete Disponível',
            body: `${buildingName}: ${(pollData as any).title} (Criada em ${createdText})`,
            data: {
              type: 'new_poll',
              poll_id: (pollData as any).id,
              building_id: (pollData as any).building_id || '',
              building_name: buildingName,
              created_at: (pollData as any).created_at
            },
            sound: 'default',
            priority: 'normal',
          },
          trigger: null, // Imediato
        };

        // Configurações específicas para Android (FCM)
        if (Device.isDevice && Constants.platform?.android) {
          notificationConfig.content.android = {
            channelId: 'avisos-enquetes',
            priority: 'normal',
            vibrate: [0, 250, 250, 250],
            color: '#388E3C',
          };
        }

        // Configurações específicas para iOS (APNS)
        if (Device.isDevice && Constants.platform?.ios) {
          notificationConfig.content.ios = {
            sound: 'default',
            badge: 1,
            interruptionLevel: 'active',
          };
        }

        await Notifications.scheduleNotificationAsync(notificationConfig);

        console.log('✅ Notificação de enquete enviada com sucesso');
      } catch (pushError) {
        console.error('❌ Erro ao enviar push notification de enquete:', pushError);
      }

    } catch (error) {
      console.error('❌ Erro geral ao disparar notificação de enquete:', error);
    }
  }, [userBuildingId]);

  // Função para iniciar o monitoramento
  const startListening = useCallback(async () => {
    if (!user?.id || !userBuildingId || isListening) return;
    
    try {
      setError(null);
      setLoading(true);
      
      // Inicializar serviço integrado
      await initializeIntegratedService(user.id, userBuildingId);
      
      // Iniciar monitoramento integrado
      await integratedNotificationService.startListening();
      setIsListening(true);
      
      console.log('✅ Monitoramento integrado iniciado com sucesso');
      
    } catch (err) {
      console.error('❌ Erro ao iniciar monitoramento:', err);
      setError('Erro ao iniciar monitoramento de notificações');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userBuildingId, isListening, initializeIntegratedService]);

  // Função para parar o monitoramento
  const stopListening = useCallback(async () => {
    if (!isListening) return;
    
    console.log('🔄 Parando monitoramento de notificações');
    
    try {
      await integratedNotificationService.stopListening();
      setIsListening(false);
      
      // Manter compatibilidade com sistema antigo
      if (communicationsChannel) {
        supabase.removeChannel(communicationsChannel);
        setCommunicationsChannel(null);
      }
      
      if (pollsChannel) {
        supabase.removeChannel(pollsChannel);
        setPollsChannel(null);
      }
      
      console.log('✅ Monitoramento parado');
    } catch (err) {
      console.error('❌ Erro ao parar monitoramento:', err);
    }
  }, [isListening, communicationsChannel, pollsChannel]);

  // Buscar notificações recentes (opcional - para histórico)
  const fetchRecentNotifications = useCallback(async (limit: number = 50) => {
    if (!userBuildingId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Buscar comunicados recentes com status de notificação
      const { data: communications, error: commError } = await supabase
        .from('communications')
        .select(`
          id, title, content, type, priority, building_id, created_at,
          notification_status, notification_sent_at, notification_read_at, notification_confirmed_at,
          buildings (name)
        `)
        .eq('building_id', userBuildingId as any)
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 2));
      
      if (commError) {
        console.error('Erro ao buscar comunicados:', commError);
      }
      
      // Buscar enquetes recentes com status de notificação
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select(`
          id, title, description, building_id, created_at,
          notification_status, notification_sent_at, notification_read_at, notification_confirmed_at,
          buildings (name)
        `)
        .eq('building_id', userBuildingId as any)
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 2));
      
      if (pollsError) {
        console.error('Erro ao buscar enquetes:', pollsError);
      }
      
      // Combinar e formatar notificações
      const allNotifications: AvisoNotification[] = [];
      let unreadCounter = 0;
      
      // Adicionar comunicados
      if (communications) {
        communications.forEach(comm => {
          const isUnread = !comm.notification_read_at;
          if (isUnread) unreadCounter++;
          
          allNotifications.push({
            id: comm.id,
            type: 'communication',
            title: comm.title,
            content: comm.content,
            building_id: comm.building_id,
            building_name: (comm as any).buildings?.name || 'Condomínio',
            priority: comm.priority || 'normal',
            created_at: comm.created_at,
            expires_at: undefined,
            notification_status: comm.notification_status || 'sent'
          });
        });
      }
      
      // Adicionar enquetes
      if (polls) {
        polls.forEach(poll => {
          const isUnread = !poll.notification_read_at;
          if (isUnread) unreadCounter++;
          
          allNotifications.push({
            id: poll.id,
            type: 'poll',
            title: poll.title,
            content: poll.description,
            building_id: poll.building_id,
            building_name: (poll as any).buildings?.name || 'Condomínio',
            priority: 'normal',
            created_at: poll.created_at,
            expires_at: undefined,
            notification_status: poll.notification_status || 'sent'
          });
        });
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setNotifications(allNotifications.slice(0, limit));
      setUnreadCount(unreadCounter);
      
      console.log(`✅ ${allNotifications.length} notificações carregadas (${unreadCounter} não lidas)`);
      
    } catch (err) {
      console.error('❌ Erro ao buscar notificações recentes:', err);
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [userBuildingId]);

  // Função para marcar como lida
  const markAsRead = useCallback(async (recordId: string, recordType: 'communication' | 'poll', userId: string) => {
    try {
      await integratedNotificationService.markAsRead(recordId, recordType, userId);
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
      setError('Erro ao marcar notificação como lida');
    }
  }, []);

  // Função para confirmar notificação urgente
  const confirmUrgentNotification = useCallback(async (recordId: string, recordType: 'communication' | 'poll', userId: string) => {
    try {
      await integratedNotificationService.confirmUrgentNotification(recordId, recordType, userId);
    } catch (err) {
      console.error('Erro ao confirmar notificação:', err);
      setError('Erro ao confirmar notificação urgente');
    }
  }, []);

  // Função para obter estatísticas
  const getNotificationStats = useCallback(async (buildingId?: string, daysBack: number = 30) => {
    try {
      return await integratedNotificationService.getNotificationStats(buildingId, daysBack);
    } catch (err) {
      console.error('Erro ao obter estatísticas:', err);
      return null;
    }
  }, []);

  // Inicializar
  useEffect(() => {
    fetchUserBuildingId();
  }, [fetchUserBuildingId]);

  useEffect(() => {
    if (userBuildingId) {
      fetchRecentNotifications();
    }
  }, [userBuildingId, fetchRecentNotifications]);

  return {
    notifications,
    loading,
    error,
    userBuildingId,
    isListening,
    unreadCount,
    startListening,
    stopListening,
    refreshNotifications: fetchRecentNotifications,
    markAsRead,
    confirmUrgentNotification,
    getNotificationStats,
    // Funções para uso manual se necessário
    triggerCommunicationNotification,
    triggerPollNotification
  };
};

export type { AvisoNotification };