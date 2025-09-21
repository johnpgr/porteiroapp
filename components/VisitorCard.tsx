import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../utils/supabase';

interface Visitor {
  id: string;
  name: string;
  document: string;
  apartment_number: string;
  photo_url?: string;
  notification_status: 'pending' | 'approved' | 'rejected' | 'entrada' | 'saida';
  visitor_type?: 'comum' | 'frequente';
  created_at: string;
  purpose?: string;
}

interface VisitorCardProps {
  visitor: Visitor;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  onAction?: (id: string, action: 'aprovado' | 'negado' | 'entrada' | 'saida', notes?: string) => void;
  showActions?: boolean;
}

interface ResidentData {
  id: string;
  full_name: string;
  photo_url?: string;
  apartment_number?: string;
}

export function VisitorCard({ visitor, onApprove, onDeny, onAction, showActions = false }: VisitorCardProps) {
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [residentData, setResidentData] = useState<ResidentData | null>(null);
  const [loadingResident, setLoadingResident] = useState(false);
  const getStatusColor = () => {
    switch (visitor.notification_status) {
      case 'aprovado':
        return '#4CAF50';
      case 'nao_permitido':
        return '#F44336';
      case 'entrada':
        return '#2196F3';
      case 'saida':
        return '#9C27B0';
      default:
        return '#FF9800';
    }
  };

  const getStatusText = () => {
    switch (visitor.notification_status) {
      case 'aprovado':
        return '✅ Aprovado';
      case 'nao_permitido':
        return '❌ Negado';
      case 'entrada':
        return '🏢 No prédio';
      case 'saida':
        return '🚪 Saiu';
      default:
        return '⏳ Pendente';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchResidentData = async () => {
    if (!visitor.authorized_by) {
      Alert.alert('Erro', 'Visitante não possui morador autorizado');
      return;
    }

    setLoadingResident(true);
    try {
      // Buscar dados do morador através do authorized_by
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          photo_url,
          apartment_residents!inner(
            apartments!inner(number)
          )
        `)
        .eq('user_id', visitor.authorized_by)
        .single();

      if (error || !profile) {
        Alert.alert('Erro', 'Não foi possível encontrar os dados do morador');
        return;
      }

      setResidentData({
        id: profile.id,
        full_name: profile.full_name,
        photo_url: profile.photo_url,
        apartment_number: profile.apartment_residents?.[0]?.apartments?.number
      });
      setShowResidentModal(true);
    } catch (error) {
      console.error('Erro ao buscar dados do morador:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do morador');
    } finally {
      setLoadingResident(false);
    }
  };

  return (
    <View style={[
      styles.card,
      { borderLeftColor: getStatusColor() },
      visitor.visitor_type === 'frequente' && styles.frequentVisitorCard
    ]}>
      <View style={styles.header}>
        <View style={styles.photoContainer}>
          {visitor.photo_url ? (
            <Image source={{ uri: visitor.photo_url }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>👤</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{visitor.name}</Text>
          <Text style={styles.document}>Doc: {visitor.document}</Text>
          <Text style={styles.apartment}>Apt: {visitor.apartment_number}</Text>
          {visitor.visitor_type && (
            <View style={[
              styles.visitorTypeContainer,
              visitor.visitor_type === 'frequente' ? styles.frequentVisitorTypeContainer : styles.commonVisitorTypeContainer
            ]}>
              <Text style={[
                styles.visitorTypeText,
                visitor.visitor_type === 'frequente' ? styles.frequentVisitorType : styles.commonVisitorType
              ]}>
                {visitor.visitor_type === 'frequente' ? '⭐ VISITANTE FREQUENTE' : '👤 Visitante Comum'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statusContainer}>
          <Text style={[styles.status, { color: getStatusColor() }]}>{getStatusText()}</Text>
          <Text style={styles.time}>{formatTime(visitor.created_at)}</Text>
        </View>
      </View>

      {visitor.purpose && (
        <View style={styles.purposeContainer}>
          <Text style={styles.purposeLabel}>Motivo:</Text>
          <Text style={styles.purpose}>{visitor.purpose}</Text>
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          {/* Botões para visitantes pendentes */}
          {visitor.notification_status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.denyButton]}
                onPress={() => onAction ? onAction(visitor.id, 'negado') : onDeny?.(visitor.id)}>
                <Text style={styles.actionButtonText}>❌ Negar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => onAction ? onAction(visitor.id, 'aprovado') : onApprove?.(visitor.id)}>
                <Text style={styles.actionButtonText}>✅ Aprovar</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Botões para visitantes aprovados */}
          {visitor.notification_status === 'aprovado' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.entryButton]}
              onPress={() => onAction?.(visitor.id, 'entrada')}>
              <Text style={styles.actionButtonText}>🏢 Registrar Entrada</Text>
            </TouchableOpacity>
          )}
          
          {/* Botões para visitantes no prédio */}
          {visitor.notification_status === 'entrada' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.exitButton]}
              onPress={() => onAction?.(visitor.id, 'saida')}>
              <Text style={styles.actionButtonText}>🚪 Registrar Saída</Text>
            </TouchableOpacity>
          )}
          
          {/* Botão para ver foto do morador */}
          {visitor.authorized_by && (
            <TouchableOpacity
              style={[styles.actionButton, styles.residentButton]}
              onPress={fetchResidentData}
              disabled={loadingResident}>
              {loadingResident ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>👤 Ver Morador</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Modal para exibir foto do morador */}
      <Modal
        visible={showResidentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResidentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Morador Autorizado</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowResidentModal(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {residentData && (
              <View style={styles.residentInfo}>
                <View style={styles.residentPhotoContainer}>
                  {residentData.photo_url ? (
                    <Image 
                      source={{ uri: residentData.photo_url }} 
                      style={styles.residentPhoto} 
                    />
                  ) : (
                    <View style={styles.residentPhotoPlaceholder}>
                      <Text style={styles.residentPhotoPlaceholderText}>👤</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.residentDetails}>
                  <Text style={styles.residentName}>{residentData.full_name}</Text>
                  {residentData.apartment_number && (
                    <Text style={styles.residentApartment}>
                      Apartamento {residentData.apartment_number}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginVertical: 8,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  frequentVisitorCard: {
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#FFB300',
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoContainer: {
    width: 60,
    height: 60,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  document: {
    fontSize: 14,
    color: '#666',
  },
  apartment: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  visitorTypeContainer: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  frequentVisitorTypeContainer: {
    backgroundColor: '#FFB300',
    borderWidth: 1,
    borderColor: '#FF8F00',
  },
  commonVisitorTypeContainer: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  visitorTypeText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  frequentVisitorType: {
    color: '#FFFFFF',
    textShadowColor: '#E65100',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  commonVisitorType: {
    color: '#1565C0',
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  purposeContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  purposeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  purpose: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  denyButton: {
    backgroundColor: '#F44336',
  },
  entryButton: {
    backgroundColor: '#2196F3',
  },
  exitButton: {
    backgroundColor: '#9C27B0',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  residentButton: {
    backgroundColor: '#6B46C1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: 350,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  residentInfo: {
    alignItems: 'center',
    gap: 16,
  },
  residentPhotoContainer: {
    width: 120,
    height: 120,
  },
  residentPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6B46C1',
  },
  residentPhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6B46C1',
  },
  residentPhotoPlaceholderText: {
    fontSize: 48,
  },
  residentDetails: {
    alignItems: 'center',
    gap: 8,
  },
  residentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  residentApartment: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
