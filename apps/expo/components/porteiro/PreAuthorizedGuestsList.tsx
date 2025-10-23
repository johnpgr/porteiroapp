import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, Image, ScrollView, TextInput } from 'react-native';
import { supabase } from '~/utils/supabase';
import { notifyResidentOfVisitorArrival } from '~/services/notifyResidentService';
import { notifyResidentsVisitorArrival } from '~/services/pushNotificationService';

interface PreAuthorizedGuestsListProps {
  apartmentId: string;
  buildingId: string;
  onGuestSelected: () => void;
}

const PreAuthorizedGuestsList: React.FC<PreAuthorizedGuestsListProps> = ({
  apartmentId,
  buildingId,
  onGuestSelected
}) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para seleção múltipla
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Função para alternar seleção múltipla
  const toggleMultiSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedGuests(new Set());
  };

  // Função para selecionar/deselecionar convidado
  const toggleGuestSelection = (guestId: string) => {
    const newSelected = new Set(selectedGuests);
    if (newSelected.has(guestId)) {
      newSelected.delete(guestId);
    } else {
      newSelected.add(guestId);
    }
    setSelectedGuests(newSelected);
  };

  // Função para selecionar todos os convidados
  const selectAllGuests = () => {
    const eligibleGuests = filteredActivities.filter(activity => {
      const canEnterDirectly = activity.status === 'Aprovado' || 
                             activity.status === 'ENTRADA LIBERADA' || 
                             activity.access_type === 'direto';
      return canEnterDirectly;
    });
    
    if (selectedGuests.size === eligibleGuests.length) {
      // Se todos estão selecionados, desselecionar todos
      setSelectedGuests(new Set());
    } else {
      // Selecionar todos os elegíveis
      setSelectedGuests(new Set(eligibleGuests.map(guest => guest.id)));
    }
  };

  // Função para confirmar entrada em lote
  const handleBatchCheckIn = async () => {
    if (selectedGuests.size === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um convidado para confirmar a entrada.');
      return;
    }

    Alert.alert(
      'Confirmar Entradas',
      `Deseja confirmar a entrada de ${selectedGuests.size} convidado(s) selecionado(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setBatchActionLoading(true);
            try {
              const selectedGuestIds = Array.from(selectedGuests);
              
              // Processar cada convidado selecionado
              for (const guestId of selectedGuestIds) {
                await handleCheckIn(guestId, false); // false para não mostrar alert individual
              }
              
              Alert.alert('Sucesso', `Entrada confirmada para ${selectedGuests.size} convidado(s)!`);
              setSelectedGuests(new Set());
              setMultiSelectMode(false);
              
            } catch (error) {
              console.error('❌ Erro no check-in em lote:', error);
              Alert.alert('Erro', 'Ocorreu um erro ao confirmar as entradas. Tente novamente.');
            } finally {
              setBatchActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Função para avisar moradores em lote
  const handleBatchNotifyResident = async () => {
    if (selectedGuests.size === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um convidado para avisar os moradores.');
      return;
    }

    Alert.alert(
      'Avisar Moradores',
      `Deseja avisar os moradores sobre ${selectedGuests.size} convidado(s) selecionado(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Avisar',
          onPress: async () => {
            setBatchActionLoading(true);
            try {
              const selectedGuestIds = Array.from(selectedGuests);
              
              // Processar cada convidado selecionado
              for (const guestId of selectedGuestIds) {
                await handleNotifyResident(guestId, false); // false para não mostrar alert individual
              }
              
              Alert.alert('Sucesso', `Moradores avisados sobre ${selectedGuests.size} convidado(s)!`);
              setSelectedGuests(new Set());
              setMultiSelectMode(false);
              
            } catch (error) {
              console.error('❌ Erro ao avisar moradores em lote:', error);
              Alert.alert('Erro', 'Ocorreu um erro ao avisar os moradores. Tente novamente.');
            } finally {
              setBatchActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Função para buscar convidados pré-autorizados para o apartamento específico
  const fetchPreAuthorizedGuests = useCallback(async () => {
    if (!apartmentId || !buildingId) return;

    try {
      setLoading(true);
      console.log('🔍 [PreAuthorizedGuestsList] Buscando convidados pré-autorizados para apartamento:', apartmentId);

      const { data: visitors, error } = await supabase
        .from('visitors')
        .select(`
          *,
          apartments!inner(number, building_id)
        `)
        .eq('apartment_id', apartmentId)
        .eq('apartments.building_id', buildingId)
        .in('status', ['pendente', 'aprovado'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [PreAuthorizedGuestsList] Erro ao buscar convidados:', error);
        return;
      }

      if (!visitors || visitors.length === 0) {
        console.log('ℹ️ [PreAuthorizedGuestsList] Nenhum convidado pré-autorizado encontrado');
        setActivities([]);
        return;
      }

      console.log(`✅ [PreAuthorizedGuestsList] ${visitors.length} convidado(s) pré-autorizado(s) encontrado(s)`);

      // Transformar dados para o formato esperado pelo componente
      const formattedActivities = visitors.map(visitor => {
        const getStatusInfo = (status, accessType) => {
          if (status === 'aprovado' || accessType === 'direto') {
            return {
              status: 'ENTRADA LIBERADA',
              color: '#4CAF50'
            };
          } else {
            return {
              status: 'Pendente',
              color: '#FF9800'
            };
          }
        };

        const statusInfo = getStatusInfo(visitor.status, visitor.access_type);

        return {
          id: visitor.id,
          icon: '👤',
          title: `👤 ${visitor.name}`,
          subtitle: `Apt. ${visitor.apartments.number} • ${visitor.purpose || 'Visita'}`,
          ...statusInfo,
          time: new Date(visitor.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          details: [
            `Nome: ${visitor.name}`,
            `Apartamento: ${visitor.apartments.number}`,
            `Documento: ${visitor.document || 'Não informado'}`,
            `Propósito: ${visitor.purpose || 'Visita'}`,
            `Tipo: ${visitor.visit_type || 'Não informado'}`,
            `Acesso: ${visitor.access_type === 'direto' ? 'Entrada Direta' : 'Com Aprovação'}`,
            visitor.visit_start_time && visitor.visit_end_time 
              ? `Horário: ${visitor.visit_start_time} às ${visitor.visit_end_time}`
              : 'Horário: Não especificado'
          ],
          photo_url: visitor.photo_url,
          access_type: visitor.access_type,
          visit_type: visitor.visit_type,
          apartment_id: visitor.apartment_id
        };
      });

      setActivities(formattedActivities);
    } catch (error) {
      console.error('❌ [PreAuthorizedGuestsList] Erro inesperado:', error);
    } finally {
      setLoading(false);
    }
  }, [apartmentId, buildingId]);

  useEffect(() => {
    fetchPreAuthorizedGuests();
  }, [fetchPreAuthorizedGuests]);

  // Se não há convidados, não renderiza nada
  if (!loading && activities.length === 0) {
    return null;
  }

  const toggleCardExpansion = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  // Função para filtrar convidados baseado na busca
  const filteredActivities = activities.filter((activity) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const title = activity.title.toLowerCase();
    const subtitle = activity.subtitle.toLowerCase();
    
    // Buscar por nome (no título)
    if (title.includes(query)) return true;
    
    // Buscar por apartamento (no subtítulo)
    if (subtitle.includes(query)) return true;
    
    // Buscar nos detalhes (propósito, etc.)
    const detailsText = activity.details.join(' ').toLowerCase();
    if (detailsText.includes(query)) return true;
    
    return false;
  });

  // Função para avisar morador
  const handleNotifyResident = async (activityId: string, showAlert: boolean = true) => {
    try {
      const activity = activities.find(a => a.id === activityId);
      if (!activity) return;

      // Buscar dados do visitante para verificar o access_type e horários
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*, apartments(number)')
        .eq('id', activityId)
        .single();

      if (visitorError) {
        console.error('Erro ao buscar dados do visitante:', visitorError);
        if (showAlert) {
          Alert.alert('Erro', 'Não foi possível encontrar os dados do visitante');
        }
        return;
      }

      // Verificar se está fora do horário permitido
      if (visitorData.visit_start_time && visitorData.visit_end_time) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const isOutsideAllowedTime =
          currentTime < visitorData.visit_start_time ||
          currentTime > visitorData.visit_end_time;

        if (isOutsideAllowedTime) {
          // Mostrar popup de confirmação
          const userConfirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Fora do Horário Permitido',
              `Este visitante só pode entrar entre ${visitorData.visit_start_time} e ${visitorData.visit_end_time}.\n\nHorário atual: ${currentTime}\n\nTem certeza que deseja avisar o morador?`,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => resolve(false)
                },
                {
                  text: 'Confirmar',
                  style: 'default',
                  onPress: () => resolve(true)
                }
              ],
              { cancelable: false }
            );
          });

          // Se o usuário cancelou, sair da função
          if (!userConfirmed) {
            return;
          }
        }
      }

      // Função para gerar UUID compatível com React Native
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Buscar o morador responsável pelo apartamento
      // Primeiro tenta buscar o proprietário (is_owner = true)
      let { data: apartmentResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('profile_id, profiles!inner(full_name)')
        .eq('apartment_id', visitorData.apartment_id)
        .eq('is_owner', true)
        .maybeSingle();

      // Se não encontrar proprietário, busca qualquer morador do apartamento
      if (!apartmentResident || residentError) {
        console.log('🔍 [handleNotifyResident] Proprietário não encontrado, buscando qualquer morador do apartamento');
        const result = await supabase
          .from('apartment_residents')
          .select('profile_id, profiles!inner(full_name)')
          .eq('apartment_id', visitorData.apartment_id)
          .limit(1)
          .maybeSingle();

        apartmentResident = result.data;
        residentError = result.error;
      }

      let residentId = null;
      let residentName = 'Morador';

      if (apartmentResident && !residentError) {
        residentId = apartmentResident.profile_id;
        residentName = apartmentResident.profiles.full_name;
        console.log(`✅ [handleNotifyResident] Morador encontrado: ${residentName} (ID: ${residentId})`);
      } else {
        console.error('❌ [handleNotifyResident] Nenhum morador encontrado para apartment_id:', visitorData.apartment_id);
      }

      // Criar automaticamente um novo registro no visitor_logs
      const logData = {
        visitor_id: activityId,
        building_id: buildingId,
        apartment_id: visitorData.apartment_id,
        guest_name: visitorData.name || activity.title.replace('👤 ', ''),
        entry_type: 'visitor',
        notification_status: 'pending',
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: generateUUID(),
        resident_response_by: residentId,
        purpose: `Notificação de chegada do visitante - Aguardando aprovação do morador`,
        photo_url: visitorData.photo_url
      };

      const { error: insertError } = await supabase
        .from('visitor_logs')
        .insert(logData);

      if (insertError) {
        console.error('Erro ao criar registro no visitor_logs:', insertError);
        Alert.alert('Erro', 'Não foi possível criar o registro de visita');
        return;
      }

      // Atualizar status do visitante baseado no tipo
      if (visitorData.visit_type === 'pontual' || visitorData.visit_type === 'prestador_servico') {
        console.log(`🔄 Atualizando status do visitante ${visitorData.visit_type} ${visitorData.name} (ID: ${activityId}) para 'expirado'`);
        
        const { error: updateError } = await supabase
          .from('visitors')
          .update({ status: 'expirado' })
          .eq('id', activityId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status do visitante:', updateError);
          // Não interromper o fluxo, apenas logar o erro
        } else {
          console.log(`✅ Status do visitante ${visitorData.visit_type} ${visitorData.name} atualizado para 'expirado'`);
        }
      } else if (visitorData.visit_type === 'frequente') {
        console.log(`ℹ️ Visitante frequente ${visitorData.name} mantém status 'pendente'`);
      } else {
        console.log(`ℹ️ Visitante ${visitorData.name} é do tipo '${visitorData.visit_type}', mantendo status atual`);
      }

      // Enviar notificação push para o morador
      try {
        console.log('📱 [handleNotifyResident] Enviando push notification para morador...');
        const pushResult = await notifyResidentsVisitorArrival({
          apartmentIds: [visitorData.apartment_id],
          visitorName: visitorData.name || activity.title.replace('👤 ', ''),
          apartmentNumber: visitorData.apartments?.number || 'N/A',
          purpose: visitorData.purpose || 'Visita',
          photoUrl: visitorData.photo_url
        });

        if (pushResult.success) {
          console.log('✅ [handleNotifyResident] Push notification enviada:', `${pushResult.sent} enviada(s), ${pushResult.failed} falha(s)`);
        } else {
          console.warn('⚠️ [handleNotifyResident] Falha ao enviar push:', pushResult.message);
        }
      } catch (pushError) {
        console.error('❌ [handleNotifyResident] Erro ao enviar push notification:', pushError);
      }

      const statusMessage = visitorData.access_type === 'com_aprovacao'
        ? 'Morador notificado! Aguardando aprovação.'
        : 'Visitante autorizado e morador notificado!';

      if (showAlert) {
        Alert.alert('Sucesso', statusMessage);
        onGuestSelected(); // Fechar modal e recarregar dados
      }
    } catch (error) {
      console.error('Erro ao notificar morador:', error);
      if (showAlert) {
        Alert.alert('Erro', 'Não foi possível notificar o morador');
      }
    }
  };

  // Função para check de entrada
  const handleCheckIn = async (activityId: string, showAlert: boolean = true) => {
    try {
      const activity = activities.find(a => a.id === activityId);
      if (!activity) return;

      // Buscar dados completos do visitante
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', activityId)
        .single();

      if (visitorError || !visitorData) {
        console.error('Erro ao buscar dados do visitante:', visitorError);
        Alert.alert('Erro', 'Não foi possível encontrar os dados do visitante');
        return;
      }

      // Função para gerar UUID compatível com React Native
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Buscar o morador responsável pelo apartamento
      // Primeiro tenta buscar o proprietário (is_owner = true)
      let { data: apartmentResident, error: residentError } = await supabase
        .from('apartment_residents')
        .select('profile_id, profiles!inner(full_name)')
        .eq('apartment_id', visitorData.apartment_id)
        .eq('is_owner', true)
        .maybeSingle();

      // Se não encontrar proprietário, busca qualquer morador do apartamento
      if (!apartmentResident || residentError) {
        console.log('🔍 [handleCheckIn] Proprietário não encontrado, buscando qualquer morador do apartamento');
        const result = await supabase
          .from('apartment_residents')
          .select('profile_id, profiles!inner(full_name)')
          .eq('apartment_id', visitorData.apartment_id)
          .limit(1)
          .maybeSingle();

        apartmentResident = result.data;
        residentError = result.error;
      }

      let residentId = null;
      let residentName = 'Morador';

      if (apartmentResident && !residentError) {
        residentId = apartmentResident.profile_id;
        residentName = apartmentResident.profiles.full_name;
        console.log(`✅ [handleCheckIn] Morador encontrado: ${residentName} (ID: ${residentId})`);
      } else {
        console.error('❌ [handleCheckIn] Nenhum morador encontrado para apartment_id:', visitorData.apartment_id);
      }

      // Criar dados do log baseado no access_type
      const logData = {
        visitor_id: activityId,
        building_id: buildingId,
        apartment_id: visitorData.apartment_id,
        guest_name: visitorData.name || activity.title.replace('👤 ', ''),
        entry_type: 'visitor',
        notification_status: 'approved',
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: generateUUID(),
        resident_response_by: residentId,
        purpose: `Check-in confirmado pelo porteiro - Visitante pré-cadastrado autorizado por: ${residentName}`,
        photo_url: visitorData.photo_url
      };

      // Registrar entrada aprovada no visitor_logs
      const { error } = await supabase
        .from('visitor_logs')
        .insert(logData);

      if (error) {
        console.error('Erro ao registrar entrada:', error);
        if (showAlert) {
          Alert.alert('Erro', 'Não foi possível registrar a entrada');
        }
        return;
      }

      // Atualizar status do visitante baseado no tipo
      if (visitorData.visit_type === 'pontual' || visitorData.visit_type === 'prestador_servico') {
        console.log(`🔄 Atualizando status do visitante ${visitorData.visit_type} ${visitorData.name} (ID: ${activityId}) para 'expirado'`);
        
        const { error: updateError } = await supabase
          .from('visitors')
          .update({ status: 'expirado' })
          .eq('id', activityId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status do visitante:', updateError);
          // Não interromper o fluxo, apenas logar o erro
        } else {
          console.log(`✅ Status do visitante ${visitorData.name} atualizado para 'expirado'`);
        }
      } else if (visitorData.visit_type === 'frequente') {
        console.log(`ℹ️ Visitante frequente ${visitorData.name} mantém status 'pendente'`);
      } else {
        console.log(`ℹ️ Visitante ${visitorData.name} é do tipo '${visitorData.visit_type}', mantendo status atual`);
      }

      // Buscar dados do apartamento
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select('number')
        .eq('id', visitorData.apartment_id)
        .single();

      if (apartmentError) {
        console.error('❌ [handleCheckIn] Erro ao buscar dados do apartamento:', apartmentError);
      }

      // Disparar notificação para o morador
      try {
        console.log('🔔 [handleCheckIn] Iniciando notificação para morador...');

        // 1. Enviar via WhatsApp/SMS (método antigo)
        const notificationResult = await notifyResidentOfVisitorArrival({
          visitorName: visitorData.name || activity.title.replace('👤 ', ''),
          apartmentNumber: apartmentData?.number || 'N/A',
          buildingId: buildingId,
          visitorId: activityId,
          purpose: visitorData.purpose || 'Visita',
          photo_url: visitorData.photo_url,
          entry_type: 'visitor'
        });

        if (notificationResult.success) {
          console.log('✅ [handleCheckIn] Notificação WhatsApp enviada com sucesso:', notificationResult.message);
        } else {
          console.warn('⚠️ [handleCheckIn] Falha ao enviar WhatsApp:', notificationResult.message);
        }

        // 2. Enviar Push Notification via Edge Function
        try {
          console.log('📱 [handleCheckIn] Enviando push notification para morador...');
          const pushResult = await notifyResidentsVisitorArrival({
            apartmentIds: [visitorData.apartment_id],
            visitorName: visitorData.name || activity.title.replace('👤 ', ''),
            apartmentNumber: apartmentData?.number || 'N/A',
            purpose: visitorData.purpose || 'Visita',
            photoUrl: visitorData.photo_url
          });

          if (pushResult.success) {
            console.log('✅ [handleCheckIn] Push notification enviada:', `${pushResult.sent} enviada(s), ${pushResult.failed} falha(s)`);
          } else {
            console.warn('⚠️ [handleCheckIn] Falha ao enviar push:', pushResult.message);
          }
        } catch (pushError) {
          console.error('❌ [handleCheckIn] Erro ao enviar push notification:', pushError);
        }
      } catch (notificationError) {
        console.error('❌ [handleCheckIn] Erro ao enviar notificações:', notificationError);
      }

      if (showAlert) {
        Alert.alert('Sucesso', 'Entrada registrada com sucesso! Morador foi notificado.');
        onGuestSelected(); // Fechar modal e recarregar dados
      }
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      Alert.alert('Erro', 'Não foi possível registrar a entrada');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Convidados Pré-autorizados</Text>
      
      {/* Controles de seleção múltipla */}
      <View style={styles.multiSelectControls}>
        <TouchableOpacity 
          style={[styles.multiSelectButton, multiSelectMode && styles.multiSelectButtonActive]}
          onPress={toggleMultiSelectMode}
        >
          <Text style={[styles.multiSelectButtonText, multiSelectMode && styles.multiSelectButtonTextActive]}>
            {multiSelectMode ? '✓ Seleção Múltipla' : '☐ Seleção Múltipla'}
          </Text>
        </TouchableOpacity>

        {multiSelectMode && (
          <View style={styles.multiSelectActions}>
            <TouchableOpacity 
              style={styles.selectAllButton}
              onPress={selectAllGuests}
            >
              <Text style={styles.selectAllButtonText}>
                {selectedGuests.size === filteredActivities.filter(a => 
                  a.status === 'Aprovado' || a.status === 'direto' || a.status === 'Liberado para Entrada Direta'
                ).length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Text>
            </TouchableOpacity>
            
            {selectedGuests.size > 0 && (
              <Text style={styles.selectedCounter}>
                {selectedGuests.size} selecionado(s)
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Botões de ação em lote */}
      {multiSelectMode && selectedGuests.size > 0 && (
        <View style={styles.batchActionsContainer}>
          <TouchableOpacity 
            style={[styles.batchActionButton, styles.batchCheckInButton]}
            onPress={handleBatchCheckIn}
            disabled={batchActionLoading}
          >
            <Text style={styles.batchActionButtonText}>
              ✅ Confirmar Entradas ({selectedGuests.size})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.batchActionButton, styles.batchNotifyButton]}
            onPress={handleBatchNotifyResident}
            disabled={batchActionLoading}
          >
            <Text style={styles.batchActionButtonText}>
              🔔 Avisar Moradores ({selectedGuests.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando convidados...</Text>
        </View>
      ) : (
        <ScrollView 
          style={[styles.scrollContainer, multiSelectMode && styles.scrollContainerExpanded]} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {filteredActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'Nenhum resultado encontrado' : 'Nenhum convidado encontrado'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim()
                  ? `Não há convidados com "${searchQuery}"`
                  : 'Não há convidados pré-autorizados para este apartamento'
                }
              </Text>
            </View>
          ) : (
            filteredActivities.map((activity) => {
              const canEnterDirectly = activity.status === 'Aprovado' || 
                                     activity.status === 'ENTRADA LIBERADA' || 
                                     activity.access_type === 'direto';
              const isSelected = selectedGuests.has(activity.id);
              
              return (
                <TouchableOpacity
                  key={activity.id}
                  style={[
                    styles.activityCard,
                    multiSelectMode && canEnterDirectly && styles.activityCardSelectable,
                    isSelected && styles.activityCardSelected
                  ]}
                  onPress={() => {
                    if (multiSelectMode && canEnterDirectly) {
                      toggleGuestSelection(activity.id);
                    } else {
                      toggleCardExpansion(activity.id);
                    }
                  }}
                >
                  <View style={styles.activityHeader}>
                    {/* Checkbox para seleção múltipla */}
                    {multiSelectMode && canEnterDirectly && (
                      <View style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                      </View>
                    )}
                    
                    <Text style={styles.activityIcon}>{activity.icon}</Text>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
                      <Text style={styles.activitySubtitle} numberOfLines={1}>{activity.subtitle}</Text>
                    </View>
                    <View style={styles.activityMeta}>
                      <Text style={[styles.activityStatus, { color: activity.color }]}>{activity.status}</Text>
                      <Text style={styles.activityTime}>{activity.time}</Text>
                    </View>
                  </View>
                  
                  {/* Botões de ação - sempre visíveis quando não está em modo de seleção múltipla */}
                  {!multiSelectMode && (
                    <View style={styles.actionButtonsContainer}>
                      {/* Botão Ver Foto */}
                      <TouchableOpacity 
                        style={styles.viewPhotoActionButton}
                        onPress={() => activity.photo_url ? openImageModal(activity.photo_url) : Alert.alert('Sem Foto', 'Visitante está sem foto')}>
                        <Text style={styles.viewPhotoActionButtonText}>
                          📷 Ver Foto
                        </Text>
                      </TouchableOpacity>

                      {/* Lógica condicional para botões de ação */}
                      {(() => {
                        if (canEnterDirectly) {
                          // Para visitantes com entrada liberada: apenas botão Confirmar Entrada
                          return (
                            <TouchableOpacity 
                              style={styles.checkInButton}
                              onPress={() => handleCheckIn(activity.id)}>
                              <Text style={styles.checkInButtonText}>
                                ✅ Confirmar Entrada
                              </Text>
                            </TouchableOpacity>
                          );
                        } else {
                          // Para visitantes pendentes ou não autorizados: botão Avisar Morador
                          return (
                            <TouchableOpacity 
                              style={styles.notifyResidentButton}
                              onPress={() => handleNotifyResident(activity.id)}>
                              <Text style={styles.notifyResidentButtonText}>
                                🔔 Avisar Morador
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                      })()}
                    </View>
                  )}
                  
                  {/* Detalhes expandidos - agora apenas para informações extras */}
                  {expandedCards.has(activity.id) && !multiSelectMode && (
                    <View style={styles.activityDetails}>
                      {activity.details.map((detail, index) => (
                        <Text key={index} style={styles.activityDetail}>{detail}</Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal de imagem */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalBackground}
            activeOpacity={1}
            onPress={closeImageModal}>
            <View style={styles.imageModalContent}>
              <TouchableOpacity 
                style={styles.closeImageButton}
                onPress={closeImageModal}>
                <Text style={styles.closeImageButtonText}>×</Text>
              </TouchableOpacity>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 20,
    marginVertical: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  activityCard: {
    backgroundColor: '#fff',
    marginHorizontal: 8,
    marginVertical: 12, 
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 8,
    width: 32,
    textAlign: 'center',
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
    flexShrink: 1,
    lineHeight: 18,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
    lineHeight: 16,
  },
  activityMeta: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 70,
    maxWidth: 100,
  },
  activityStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
    textAlign: 'right',
    flexWrap: 'wrap',
    maxWidth: 100,
    lineHeight: 12,
  },
  activityTime: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
    lineHeight: 14,
  },
  activityDetails: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  activityDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  viewPhotoActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginTop: 14,
  },
  viewPhotoActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  notifyResidentButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FF9800',
    marginTop: 8,
  },
  notifyResidentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  checkInButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
  checkInButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  closeImageButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 1,
  },
  scrollContainer: {
    maxHeight: 500,
    flex: 1,
  },
  scrollContainerExpanded: {
    maxHeight: '70%',
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  multiSelectControls: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  multiSelectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    alignSelf: 'flex-start',
  },
  multiSelectButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  multiSelectButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  multiSelectButtonTextActive: {
    color: '#fff',
  },
  multiSelectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  selectAllButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedCounter: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  batchActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  batchActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  batchCheckInButton: {
    backgroundColor: '#4CAF50',
  },
  batchNotifyButton: {
    backgroundColor: '#FF9800',
  },
  batchActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  activityCardSelectable: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  activityCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  checkboxContainer: {
    marginRight: 8,
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtonsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
});

export default PreAuthorizedGuestsList;