import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import * as Notifications from 'expo-notifications';
import { RealtimeChannel } from '@supabase/supabase-js';
import { shiftService } from '../services/shiftService';
import { Alert, AppState, AppStateStatus } from 'react-native';
import notificationService from '../services/notification/notificationService';

interface PorteiroNotification {
  id: string;
  type: 'visitor' | 'delivery' | 'visitor_log';
  title: string;
  message: string;
  data: any;
  timestamp: string;
  read: boolean;
}

export const usePorteiroNotifications = (buildingId?: string | null, porteiroId?: string | null) => {

  const [notifications, setNotifications] = useState<PorteiroNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    console.log(
      '🎯 [usePorteiroNotifications] Hook EXECUTANDO com buildingId:',
      buildingId,
      'porteiroId:',
      porteiroId
    );
  }, [buildingId, porteiroId]);

  // Configurar notificações push e listeners de foreground
  useEffect(() => {
    const configurePushNotifications = async () => {
      try {
        // NOTE: Notification handler is configured in services/notificationHandler.ts
        // and initialized at module level to prevent conflicts

        // Solicitar permissões
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('🚨 [usePorteiroNotifications] Permissão de notificação negada');
          return;
        }

        console.log('✅ [usePorteiroNotifications] Push notifications configuradas');
      } catch (err) {
        console.error('❌ [usePorteiroNotifications] Erro ao configurar push notifications:', err);
        setError('Erro ao configurar notificações push');
      }
    };

    configurePushNotifications();

    // Listener para notificações recebidas enquanto app está em foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📩 [usePorteiroNotifications] Notificação recebida (foreground):', notification);

      const data = notification.request.content.data;

      // Exibir Alert baseado no tipo de notificação
      if (data.type === 'visitor_approved' || data.type === 'visitor_rejected') {
        const isApproved = data.type === 'visitor_approved';
        const title = isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Rejeitado';
        const message = isApproved
          ? `${data.visitor_name} foi aprovado para o apartamento ${data.apartment_number}`
          : `A entrada de ${data.visitor_name} foi rejeitada pelo apartamento ${data.apartment_number}`;

        Alert.alert(title, message, [{ text: 'OK', style: 'default' }], { cancelable: true });
      }
    });

    // Listener para quando usuário toca na notificação
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 [usePorteiroNotifications] Notificação tocada:', response);

      const data = response.notification.request.content.data;

      // Aqui você pode navegar para uma tela específica baseado no tipo
      // Por exemplo: router.push('/porteiro/autorizacoes')
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Função para criar notificação local
  const createLocalNotification = useCallback(async (notification: PorteiroNotification) => {
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
  }, []);

  // Função para exibir popup de aprovação/rejeição
  const showApprovalPopup = useCallback(async (status: string, visitorData: any) => {
    console.log('🎯 [showApprovalPopup] Dados recebidos:', JSON.stringify(visitorData, null, 2));

    const isApproved = status === 'approved';
    let apartmentNumber = 'N/A';

    try {
      console.log('🔍 [showApprovalPopup] Tentando buscar apartamento com visitor_id:', visitorData?.visitor_id);
      console.log('🔍 [showApprovalPopup] Tentando buscar apartamento com apartment_id:', visitorData?.apartment_id);

      // Primeiro tentar pelo apartment_id diretamente (mais provável de estar no payload)
      if (visitorData?.apartment_id) {
        console.log('🏠 [showApprovalPopup] Buscando via apartment_id...');
        const { data: apartmentInfo, error } = await supabase
          .from('apartments')
          .select('number')
          .eq('id', visitorData.apartment_id)
          .single();

        console.log('🏠 [showApprovalPopup] Resultado busca apartment:', { apartmentInfo, error });

        if (!error && apartmentInfo?.number) {
          apartmentNumber = apartmentInfo.number;
          console.log('✅ [showApprovalPopup] Apartamento encontrado via apartment_id:', apartmentNumber);
        }
      }
      // Se não conseguiu pelo apartment_id, tentar pelo visitor_id
      else if (visitorData?.visitor_id) {
        console.log('📋 [showApprovalPopup] Buscando via visitor_id...');
        const { data: visitorInfo, error } = await supabase
          .from('visitors')
          .select(`
            apartment_id,
            apartments!inner(
              number
            )
          `)
          .eq('id', visitorData.visitor_id)
          .single();

        console.log('📋 [showApprovalPopup] Resultado busca visitor:', { visitorInfo, error });

        if (!error && visitorInfo?.apartments?.number) {
          apartmentNumber = visitorInfo.apartments.number;
          console.log('✅ [showApprovalPopup] Apartamento encontrado via visitor_id:', apartmentNumber);
        }
      }
    } catch (error) {
      console.error('❌ [showApprovalPopup] Erro ao buscar número do apartamento:', error);
    }

    // Verificar se é uma entrega
    if (visitorData?.entry_type === 'delivery') {
      console.log('📦 [showApprovalPopup] Detectada entrega, exibindo alerta específico');

      const deliveryDestination = visitorData?.delivery_destination;
      const destinationText = deliveryDestination === 'elevador' ? 'no elevador' : 'na portaria';

      const title = 'Instrução de Entrega';
      const message = `O morador do apartamento ${apartmentNumber} solicitou para deixar ${destinationText}.`;

      Alert.alert(
        title,
        message,
        [{ text: 'OK', style: 'default' }],
        { cancelable: true }
      );
      return;
    }

    // Comportamento padrão para visitantes
    const visitorName = visitorData?.guest_name || 'Visitante';
    const title = isApproved ? 'Visitante Aprovado' : 'Visitante Rejeitado';
    const message = isApproved 
      ? `O visitante ${visitorName} foi aprovado para o apartamento ${apartmentNumber}.`
      : `A entrada do visitante ${visitorName} foi rejeitada pelo apartamento ${apartmentNumber}.`;

    Alert.alert(
      title,
      message,
      [{ text: 'OK', style: 'default' }],
      { cancelable: true }
    );
  }, []);

  // Verificar se o porteiro está em turno ativo
  const isPorteiroOnDuty = useCallback(async (): Promise<boolean> => {
    if (!porteiroId) {
      console.log('⚠️ [usePorteiroNotifications] PorteiroId não disponível para verificação de turno');
      return false;
    }

    try {
      const { shift } = await shiftService.getActiveShift(porteiroId);
      const onDuty = shift?.status === 'active';
      console.log('🔍 [usePorteiroNotifications] Porteiro em turno:', onDuty, shift ? `(${shift.id})` : '(sem turno)');
      return onDuty;
    } catch (error) {
      console.error('❌ [usePorteiroNotifications] Erro ao verificar turno:', error);
      return false;
    }
  }, [porteiroId]);

  // Função para adicionar nova notificação (apenas se porteiro estiver em turno)
  const addNotification = useCallback(async (notification: PorteiroNotification) => {
    console.log('➕ [usePorteiroNotifications] Tentando adicionar notificação:', notification.title);

    // Verificar se o porteiro está em turno ativo
    const onDuty = await isPorteiroOnDuty();

    if (!onDuty) {
      console.log('⏸️ [usePorteiroNotifications] Notificação ignorada - porteiro não está em turno ativo');
      return;
    }

    console.log('✅ [usePorteiroNotifications] Adicionando notificação - porteiro em turno ativo');

    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Criar notificação push local
    await createLocalNotification(notification);
  }, [createLocalNotification, isPorteiroOnDuty]);

  // Iniciar listeners do Supabase
  const startListening = useCallback(async () => {
    if (!buildingId) {
      console.log('⚠️ [usePorteiroNotifications] Não pode iniciar listeners - buildingId não disponível');
      return;
    }

    if (!porteiroId) {
      console.log('⚠️ [usePorteiroNotifications] Não pode iniciar listeners - porteiroId não disponível');
      return;
    }

    if (isListening) {
      console.log('⚠️ [usePorteiroNotifications] Listeners já estão ativos, ignorando chamada');
      return;
    }

    console.log('🚀 [usePorteiroNotifications] Iniciando listeners para buildingId:', buildingId, 'porteiroId:', porteiroId);

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

            // Verificar se é uma atualização de status para approved ou rejected
            if (payload.eventType === 'UPDATE' && payload.new?.notification_status) {
              const status = payload.new.notification_status;
              if (status === 'approved' || status === 'rejected') {
                console.log('🎯 [usePorteiroNotifications] Status de aprovação detectado:', status);
                await showApprovalPopup(status, payload.new);
              }
            }

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
  }, [addNotification, buildingId, isListening, porteiroId, showApprovalPopup]);

  // Parar listeners
  const stopListening = useCallback(async () => {
    console.log('🛑 [usePorteiroNotifications] Parando listeners');

    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
    setIsListening(false);
  }, []);

  // Atualizar notificações
  const refreshNotifications = useCallback(async () => {
    console.log('🔄 [usePorteiroNotifications] Atualizando notificações');
    // Aqui poderia buscar notificações do banco se necessário
  }, []);

  // Iniciar listeners automaticamente quando buildingId e porteiroId estiverem disponíveis
  useEffect(() => {
    if (buildingId && porteiroId && !isListening) {
      console.log('🎯 [usePorteiroNotifications] BuildingId e PorteiroId disponíveis, iniciando listeners automaticamente');
      startListening();
    } else if ((!buildingId || !porteiroId) && isListening) {
      console.log('🛑 [usePorteiroNotifications] BuildingId ou PorteiroId removido, parando listeners');
      stopListening();
    }

    // Cleanup apenas quando o componente for desmontado
    return () => {
      if (isListening) {
        console.log('🧹 [usePorteiroNotifications] Cleanup - parando listeners');
        stopListening();
      }
    };
  }, [buildingId, porteiroId, isListening, startListening, stopListening]); // Adicionado porteiroId às dependências

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
