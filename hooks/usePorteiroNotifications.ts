import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import * as Notifications from 'expo-notifications';
import { RealtimeChannel } from '@supabase/supabase-js';

console.log('🔥 HOOK FILE LOADED - IMMEDIATE LOG');

interface PorteiroNotification {
  id: string;
  type: 'visitor' | 'delivery' | 'visitor_log';
  title: string;
  message: string;
  data: any;
  timestamp: string;
  read: boolean;
}

export const usePorteiroNotifications = (buildingId?: string | null) => {
  console.log('🎯 [usePorteiroNotifications] Hook EXECUTANDO com buildingId:', buildingId);
  
  const [notifications, setNotifications] = useState<PorteiroNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const channelsRef = useRef<RealtimeChannel[]>([]);
  
  // Configurar notificações push
  useEffect(() => {
    const configurePushNotifications = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('🚨 [usePorteiroNotifications] Permissão de notificação negada');
          return;
        }
        
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        
        console.log('✅ [usePorteiroNotifications] Push notifications configuradas');
      } catch (err) {
        console.error('❌ [usePorteiroNotifications] Erro ao configurar push notifications:', err);
        setError('Erro ao configurar notificações push');
      }
    };
    
    configurePushNotifications();
  }, []);
  
  // Função para criar notificação local
  const createLocalNotification = async (notification: PorteiroNotification) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: notification.data,
        },
        trigger: null, // Imediata
      });
      console.log('📱 [usePorteiroNotifications] Notificação local criada:', notification.title);
    } catch (err) {
      console.error('❌ [usePorteiroNotifications] Erro ao criar notificação local:', err);
    }
  };
  
  // Função para adicionar nova notificação
  const addNotification = async (notification: PorteiroNotification) => {
    console.log('➕ [usePorteiroNotifications] Adicionando notificação:', notification);
    
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Criar notificação push local
    await createLocalNotification(notification);
  };
  
  // Iniciar listeners do Supabase
  const startListening = async () => {
    if (!buildingId) {
      console.log('⚠️ [usePorteiroNotifications] Não pode iniciar listeners - buildingId não disponível');
      return;
    }
    
    if (isListening) {
      console.log('⚠️ [usePorteiroNotifications] Listeners já estão ativos, ignorando chamada');
      return;
    }
    
    console.log('🚀 [usePorteiroNotifications] Iniciando listeners para buildingId:', buildingId);
    
    // Marcar como listening imediatamente para prevenir chamadas simultâneas
    setIsListening(true);
    
    try {
      // Limpar listeners existentes
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      
      // Listener para visitor_logs (principal para a aba Autorizações)
      const visitorLogsChannel = supabase
        .channel('visitor_logs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitor_logs',
            filter: `building_id=eq.${buildingId}`
          },
          async (payload) => {
            console.log('🔄 [usePorteiroNotifications] Mudança em visitor_logs:', payload);
            
            const notification: PorteiroNotification = {
              id: `visitor_log_${Date.now()}`,
              type: 'visitor_log',
              title: 'Nova Atividade Registrada',
              message: `${payload.eventType === 'INSERT' ? 'Novo registro' : 'Registro atualizado'} de atividade`,
              data: payload.new || payload.old,
              timestamp: new Date().toISOString(),
              read: false
            };
            
            await addNotification(notification);
          }
        )
        .subscribe();
      
      channelsRef.current.push(visitorLogsChannel);
      
      // Listener para visitors
      const visitorsChannel = supabase
        .channel('visitors_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitors',
            filter: `building_id=eq.${buildingId}`
          },
          async (payload) => {
            console.log('🔄 [usePorteiroNotifications] Mudança em visitors:', payload);
            
            const notification: PorteiroNotification = {
              id: `visitor_${Date.now()}`,
              type: 'visitor',
              title: 'Visitante Atualizado',
              message: `${payload.eventType === 'INSERT' ? 'Novo visitante' : 'Visitante atualizado'}`,
              data: payload.new || payload.old,
              timestamp: new Date().toISOString(),
              read: false
            };
            
            await addNotification(notification);
          }
        )
        .subscribe();
      
      channelsRef.current.push(visitorsChannel);
      
      // Listener para deliveries
      const deliveriesChannel = supabase
        .channel('deliveries_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `building_id=eq.${buildingId}`
          },
          async (payload) => {
            console.log('🔄 [usePorteiroNotifications] Mudança em deliveries:', payload);
            
            const notification: PorteiroNotification = {
              id: `delivery_${Date.now()}`,
              type: 'delivery',
              title: 'Encomenda Atualizada',
              message: `${payload.eventType === 'INSERT' ? 'Nova encomenda' : 'Encomenda atualizada'}`,
              data: payload.new || payload.old,
              timestamp: new Date().toISOString(),
              read: false
            };
            
            await addNotification(notification);
          }
        )
        .subscribe();
      
      channelsRef.current.push(deliveriesChannel);
      
      setError(null);
      console.log('✅ [usePorteiroNotifications] Listeners iniciados com sucesso');
      
    } catch (err) {
      console.error('❌ [usePorteiroNotifications] Erro ao iniciar listeners:', err);
      setError('Erro ao iniciar listeners de notificação');
      setIsListening(false); // Reverter estado em caso de erro
    }
  };
  
  // Parar listeners
  const stopListening = () => {
    console.log('🛑 [usePorteiroNotifications] Parando listeners');
    
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
    setIsListening(false);
  };
  
  // Atualizar notificações
  const refreshNotifications = async () => {
    console.log('🔄 [usePorteiroNotifications] Atualizando notificações');
    // Aqui poderia buscar notificações do banco se necessário
  };
  
  // Iniciar listeners automaticamente quando buildingId estiver disponível
  useEffect(() => {
    if (buildingId && !isListening) {
      console.log('🎯 [usePorteiroNotifications] BuildingId disponível, iniciando listeners automaticamente');
      startListening();
    } else if (!buildingId && isListening) {
      console.log('🛑 [usePorteiroNotifications] BuildingId removido, parando listeners');
      stopListening();
    }
    
    // Cleanup apenas quando o componente for desmontado
    return () => {
      if (isListening) {
        console.log('🧹 [usePorteiroNotifications] Cleanup - parando listeners');
        stopListening();
      }
    };
  }, [buildingId]); // Removido isListening das dependências para evitar loops
  
  return {
    notifications,
    unreadCount,
    isListening,
    startListening,
    stopListening,
    error,
    refreshNotifications
  };
};