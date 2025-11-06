import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { shiftService } from '../services/shiftService';

export interface PorteiroNotification {
  id: string;
  type: 'visitor' | 'delivery' | 'visitor_log';
  title: string;
  message: string;
  data: any;
  timestamp: string;
  read: boolean;
}

export interface UsePorteiroNotificationsReturn {
  notifications: PorteiroNotification[];
  unreadCount: number;
  isListening: boolean;
  error: string | null;
  startListening: (buildingId: string) => void;
  stopListening: () => void;
  markAsRead: (notificationId: string) => void;
  clearAll: () => void;
}

export function usePorteiroNotifications(buildingId?: string | null, porteiroId?: string | null): UsePorteiroNotificationsReturn {
  console.log('🚀 HOOK EXECUTANDO - usePorteiroNotifications iniciado');
  
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<PorteiroNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<any[]>([]);

  console.log('🔧 Estados inicializados:', { 
    notificationsCount: notifications.length, 
    unreadCount, 
    isListening, 
    error 
  });

  // Configurar notificações push
  useEffect(() => {
    console.log('📱 Configurando notificações push...');
    
    const configureNotifications = async () => {
      try {
        // NOTE: Notification channels are configured in services/notificationHandler.ts
        // and initialized at module level to prevent duplication

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('❌ Permissão de notificação negada');
          setError('Permissão de notificação negada');
          return;
        }

        console.log('✅ Notificações configuradas com sucesso');
      } catch (err) {
        console.error('❌ Erro ao configurar notificações:', err);
        setError('Erro ao configurar notificações');
      }
    };

    configureNotifications();
  }, []);

  // Effect para iniciar listeners automaticamente quando buildingId e porteiroId estão disponíveis
  useEffect(() => {
    if (buildingId && porteiroId && !isListening) {
      console.log('🚀 Iniciando listeners automaticamente para:', { buildingId, porteiroId });
      startListening();
    }
  }, [buildingId, porteiroId, isListening, startListening]);

  // Função para criar notificação local
  const createLocalNotification = useCallback(async (notification: PorteiroNotification) => {
    console.log('📢 Criando notificação local:', notification.title);
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: notification.data,
        },
        trigger: null, // Imediata
      });
      console.log('✅ Notificação local criada');
    } catch (err) {
      console.error('❌ Erro ao criar notificação local:', err);
    }
  }, []);

  // Função para processar mudanças nas tabelas com validação de turno
  const processTableChangeWithShiftValidation = useCallback(async (tableName: string, payload: any, addNotification: (notification: PorteiroNotification) => Promise<void>) => {
    console.log(`🔄 Processando mudança na tabela ${tableName}:`, payload);
    
    let notification: PorteiroNotification;
    const timestamp = new Date().toISOString();
    
    switch (tableName) {
      case 'visitors':
        if (payload.eventType === 'INSERT') {
          notification = {
            id: `visitor_${payload.new.id}_${Date.now()}`,
            type: 'visitor',
            title: 'Novo Visitante',
            message: `${payload.new.name} está aguardando autorização`,
            data: payload.new,
            timestamp,
            read: false
          };
        } else if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old?.status) {
          notification = {
            id: `visitor_update_${payload.new.id}_${Date.now()}`,
            type: 'visitor',
            title: 'Status do Visitante Atualizado',
            message: `${payload.new.name} - Status: ${payload.new.status}`,
            data: payload.new,
            timestamp,
            read: false
          };
        } else {
          return; // Não criar notificação para outras atualizações
        }
        break;
        
      case 'deliveries':
        if (payload.eventType === 'INSERT') {
          notification = {
            id: `delivery_${payload.new.id}_${Date.now()}`,
            type: 'delivery',
            title: 'Nova Entrega',
            message: `Entrega de ${payload.new.sender_name || 'remetente não informado'}`,
            data: payload.new,
            timestamp,
            read: false
          };
        } else if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old?.status) {
          notification = {
            id: `delivery_update_${payload.new.id}_${Date.now()}`,
            type: 'delivery',
            title: 'Status da Entrega Atualizado',
            message: `Entrega - Status: ${payload.new.status}`,
            data: payload.new,
            timestamp,
            read: false
          };
        } else {
          return;
        }
        break;
        
      case 'visitor_logs':
        notification = {
          id: `log_${payload.new.id}_${Date.now()}`,
          type: 'visitor_log',
          title: 'Novo Log de Visitante',
          message: `Ação: ${payload.new.action} - ${payload.new.visitor_name || 'Visitante'}`,
          data: payload.new,
          timestamp,
          read: false
        };
        break;
        
      default:
        console.log('⚠️ Tabela não reconhecida:', tableName);
        return;
    }
    
    console.log('📝 Notificação criada:', notification);
    
    // Processar notificação com validação de turno
    await addNotification(notification);
  }, []);

  // Função para verificar se o porteiro está em turno ativo
  const isPorteiroOnDuty = useCallback(async (porteiroId: string): Promise<boolean> => {
    if (!porteiroId) return false;
    
    try {
      const { data, error } = await shiftService.getActiveShift(porteiroId);
      if (error) {
        console.error('Erro ao verificar turno ativo:', error);
        return false;
      }
      return !!data;
    } catch (error) {
      console.error('Erro ao verificar turno ativo:', error);
      return false;
    }
  }, []);

  // Função para iniciar listeners
  const startListening = useCallback((targetBuildingId?: string) => {
    const effectiveBuildingId = targetBuildingId || buildingId;
    console.log('🎧 Iniciando listeners para building_id:', effectiveBuildingId);
    
    if (!effectiveBuildingId) {
      console.log('⚠️ BuildingId não disponível');
      return;
    }
    
    if (isListening) {
      console.log('⚠️ Já está ouvindo');
      return;
    }
    
    // Parar listeners anteriores se existirem
    if (channels.length > 0) {
      console.log('🛑 Parando listeners anteriores');
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setChannels([]);
    }
    
    setError(null);
    
    try {
      // Função para processar notificações com validação de turno
      const addNotification = async (notification: PorteiroNotification) => {
        // Verificar se o porteiro está em turno ativo antes de processar a notificação
        if (porteiroId) {
          const isOnDuty = await isPorteiroOnDuty(porteiroId);
          if (!isOnDuty) {
            console.log('🚫 Porteiro não está em turno ativo. Notificação ignorada:', notification.title);
            return;
          }
        }
        
        console.log('📝 Notificação processada (porteiro em turno):', notification);
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        createLocalNotification(notification);
      };

      // Listener para visitors
      const visitorsChannel = supabase
        .channel(`visitors_${effectiveBuildingId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitors',
            filter: `building_id=eq.${effectiveBuildingId}`
          },
          (payload) => {
            console.log('📨 Mudança em visitors:', payload);
            processTableChangeWithShiftValidation('visitors', payload, addNotification);
          }
        )
        .subscribe();
      
      // Listener para deliveries
      const deliveriesChannel = supabase
        .channel(`deliveries_${effectiveBuildingId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `building_id=eq.${effectiveBuildingId}`
          },
          (payload) => {
            console.log('📨 Mudança em deliveries:', payload);
            processTableChangeWithShiftValidation('deliveries', payload, addNotification);
          }
        )
        .subscribe();
      
      // Listener para visitor_logs
      const logsChannel = supabase
        .channel(`visitor_logs_${effectiveBuildingId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitor_logs',
            filter: `building_id=eq.${effectiveBuildingId}`
          },
          (payload) => {
            console.log('📨 Mudança em visitor_logs:', payload);
            processTableChangeWithShiftValidation('visitor_logs', payload, addNotification);
          }
        )
        .subscribe();
      
      const newChannels = [visitorsChannel, deliveriesChannel, logsChannel];
      setChannels(newChannels);
      setIsListening(true);
      
      console.log('✅ Listeners iniciados com sucesso para:', effectiveBuildingId);
      console.log('📡 Canais ativos:', newChannels.length);
      
    } catch (err) {
      console.error('❌ Erro ao iniciar listeners:', err);
      setError('Erro ao iniciar listeners');
      setIsListening(false);
    }
  }, [isListening, buildingId, channels, porteiroId, isPorteiroOnDuty, createLocalNotification, processTableChangeWithShiftValidation]);

  // Função para parar listeners
  const stopListening = useCallback(() => {
    console.log('🛑 Parando todos os listeners');
    
    channels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    
    setChannels([]);
    setIsListening(false);
    
    console.log('✅ Listeners parados');
  }, [channels]);

  // Função para marcar como lida
  const markAsRead = useCallback((notificationId: string) => {
    console.log('✅ Marcando notificação como lida:', notificationId);
    
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Função para limpar todas
  const clearAll = useCallback(() => {
    console.log('🗑️ Limpando todas as notificações');
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 Cleanup: removendo listeners');
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [channels]);

  console.log('📊 Hook retornando dados:', {
    notificationsCount: notifications.length,
    unreadCount,
    isListening,
    error,
    buildingId
  });

  return {
    notifications,
    unreadCount,
    isListening,
    error,
    startListening,
    stopListening,
    markAsRead,
    clearAll
  };
}