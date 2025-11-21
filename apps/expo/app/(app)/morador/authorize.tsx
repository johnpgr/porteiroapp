import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Modal } from '~/components/Modal';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import { useUserApartment } from '~/hooks/useUserApartment';
import { VisitorCard } from '~/components/VisitorCard';
import { flattenStyles } from '~/utils/styles';
import { notifyPorteiroVisitorAuthorized } from '~/utils/pushNotifications';
import { sendPushNotification } from '~/utils/pushNotifications';
import type { Tables } from '@porteiroapp/supabase';

type VisitorRow = Tables<'visitors'>;

// Extended type for display with apartment info
// Override nullable fields to match VisitorCard expectations
type Visitor = Omit<VisitorRow, 'document' | 'photo_url' | 'phone' | 'visitor_type'> & {
  document: string;
  apartment_number: string;
  notification_status: string;
  photo_url?: string;
  phone?: string;
  visitor_type?: 'comum' | 'frequente';
};

export default function AuthorizeScreen() {
  const { user } = useAuth();
  const { apartment } = useUserApartment();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'deny'>('approve');
  const [notes, setNotes] = useState('');

  const fetchPendingVisitors = async () => {
    if (!apartment?.id) return;

    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*, apartments!inner(number)')
        .eq('apartment_id', apartment.id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the data to include apartment_number for display and filter out invalid entries
      const visitorsWithApartment: Visitor[] = (data || [])
        .filter((v: any) => v.document) // Filter out visitors without document
        .map((v: any) => ({
          ...v,
          document: v.document,
          apartment_number: v.apartments?.number || apartment.number || '',
          notification_status: v.status || 'pendente',
          photo_url: v.photo_url || undefined,
          phone: v.phone || undefined,
          visitor_type: v.visitor_type === 'frequente' ? 'frequente' : (v.visitor_type === 'comum' ? 'comum' : undefined),
        }));
      
      setVisitors(visitorsWithApartment);
    } catch (error) {
      console.error('Erro ao buscar visitantes:', error);
      Alert.alert('Erro', 'Não foi possível carregar os visitantes pendentes');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingVisitors();
    setRefreshing(false);
  };

  const handleVisitorAction = (visitor: Visitor, action: 'approve' | 'deny') => {
    setSelectedVisitor(visitor);
    setActionType(action);
    setNotes('');
    setModalVisible(true);
  };

  const confirmAction = async () => {
    if (!selectedVisitor || !user) return;

    try {
      const newStatus = actionType === 'approve' ? 'approved' : 'denied';

      // Atualizar status do visitante
      const { error } = await supabase
        .from('visitors')
        .update({
          status: newStatus,
        })
        .eq('id', selectedVisitor.id);

      if (error) throw error;

      if (!selectedVisitor.apartment_id) {
        throw new Error('Visitante sem apartamento associado');
      }

      // Buscar dados do apartamento incluindo building_id e número
      const { data: apartmentData } = await supabase
        .from('apartments')
        .select('id, building_id, number')
        .eq('id', selectedVisitor.apartment_id)
        .maybeSingle();

      if (apartmentData) {
        // Criar log da atividade
        await supabase.from('visitor_logs').insert({
          visitor_id: selectedVisitor.id,
          apartment_id: apartmentData.id,
          building_id: apartmentData.building_id,
          log_time: new Date().toISOString(),
          tipo_log: 'IN',
          visit_session_id: Crypto.randomUUID(),
          purpose:
            notes || `Visitante ${actionType === 'approve' ? 'aprovado' : 'negado'} pelo morador`,
          authorized_by: user.id,
          status: newStatus,
          notification_status: actionType === 'approve' ? 'approved' : 'rejected',
        });

        // Criar notificação para o porteiro na tabela communications
        await supabase.from('communications').insert({
          title: `Visitante ${actionType === 'approve' ? 'Aprovado' : 'Negado'}`,
          content: `${selectedVisitor.name} foi ${actionType === 'approve' ? 'aprovado' : 'negado'} pelo morador do apt. ${apartmentData.number}`,
          building_id: apartmentData.building_id,
          created_by: user.id,
          type: 'visitor',
          priority: 'medium',
        });

        // Enviar notificação push para o porteiro via Edge Function
        try {
          const isApproved = actionType === 'approve';
          const title = isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Rejeitado';
          const message = isApproved
            ? `${selectedVisitor.name} foi aprovado para o apartamento ${apartmentData.number}`
            : `A entrada de ${selectedVisitor.name} foi rejeitada pelo apartamento ${apartmentData.number}`;

          const result = await sendPushNotification({
            title,
            message,
            type: 'visitor',
            userType: 'porteiro',
            buildingId: apartmentData.building_id,
            data: {
              type: isApproved ? 'visitor_approved' : 'visitor_rejected',
              visitor_id: selectedVisitor.id,
              visitor_name: selectedVisitor.name,
              apartment_number: apartmentData.number,
            },
          });

          if (result.success) {
            console.log(`✅ Notificação push enviada para ${result.sent} porteiro(s)`);
          } else {
            console.warn('⚠️ Nenhuma notificação enviada:', result.error);
          }
        } catch (pushError) {
          console.error('❌ Erro ao enviar notificação push para o porteiro:', pushError);
          // Não interrompe o fluxo principal se a notificação push falhar
        }
      }

      Alert.alert(
        'Sucesso',
        `Visitante ${actionType === 'approve' ? 'aprovado' : 'negado'} com sucesso!`
      );

      setModalVisible(false);
      fetchPendingVisitors();
    } catch (error) {
      console.error('Erro ao processar visitante:', error);
      Alert.alert('Erro', 'Não foi possível processar a solicitação');
    }
  };

  useEffect(() => {
    fetchPendingVisitors();
  }, [user, fetchPendingVisitors]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Autorizar Visitas</Text>
        <View style={styles.headerRight}>
          {visitors.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{visitors.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#2196F3" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Visitantes Pendentes</Text>
          <Text style={styles.infoText}>
            Aprove ou negue visitantes que desejam acessar seu apartamento
          </Text>
        </View>
      </View>

      {/* Visitors List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando visitantes...</Text>
          </View>
        ) : visitors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            <Text style={styles.emptyTitle}>Nenhum visitante pendente</Text>
            <Text style={styles.emptyText}>
              Não há visitantes aguardando sua autorização no momento
            </Text>
          </View>
        ) : (
          <View style={styles.visitorsList}>
            {visitors.map((visitor) => (
              <VisitorCard
                key={visitor.id}
                visitor={visitor}
                onApprove={() => handleVisitorAction(visitor, 'approve')}
                onDeny={() => handleVisitorAction(visitor, 'deny')}
                showActions={true}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === 'approve' ? 'Aprovar Visitante' : 'Negar Visitante'}
            </Text>

            {selectedVisitor && (
              <View style={styles.visitorInfo}>
                <Text style={styles.visitorName}>{selectedVisitor.name}</Text>
                <Text style={styles.visitorDocument}>Doc: {selectedVisitor.document}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Observações (opcional):</Text>
            <TextInput
              style={styles.textInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Adicione uma observação..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={flattenStyles([
                  styles.confirmButton,
                  { backgroundColor: actionType === 'approve' ? '#4CAF50' : '#F44336' },
                ])}
                onPress={confirmAction}>
                <Text style={styles.confirmButtonText}>
                  {actionType === 'approve' ? 'Aprovar' : 'Negar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  visitorsList: {
    padding: 20,
    paddingTop: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  visitorInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  visitorDocument: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
