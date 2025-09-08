import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Image } from 'react-native';
import { Info, Eye, X } from 'lucide-react-native';
import { PendingNotification, NotificationResponse } from '~/hooks/usePendingNotifications';

// Legacy notification interface for backward compatibility
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  created_at: string;
  read: boolean;
}

// Legacy props for backward compatibility
interface LegacyNotificationCardProps {
  notification: Notification;
  onPress?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
}

// New props for pending notifications
interface PendingNotificationCardProps {
  notification: PendingNotification;
  onRespond: (id: string, response: NotificationResponse) => Promise<{success: boolean; error?: string}>;
}

type NotificationCardProps = LegacyNotificationCardProps | PendingNotificationCardProps;

// Type guard to check if it's a pending notification
function isPendingNotification(props: NotificationCardProps): props is PendingNotificationCardProps {
  return 'onRespond' in props;
}

// Main component that routes to appropriate card type
export function NotificationCard(props: NotificationCardProps) {
  if (isPendingNotification(props)) {
    return <PendingNotificationCard {...props} />;
  } else {
    return <LegacyNotificationCard {...props} />;
  }
}

// Legacy notification card component
function LegacyNotificationCard({ notification, onPress, onMarkAsRead }: LegacyNotificationCardProps) {
  const getTypeIcon = () => {
    switch (notification.type) {
      case 'visitor':
        return '👋';
      case 'delivery':
        return '📦';
      case 'communication':
        return '📢';
      case 'emergency':
        return '🚨';
      default:
        return '🔔';
    }
  };

  const getTypeColor = () => {
    switch (notification.type) {
      case 'visitor':
        return '#4CAF50';
      case 'delivery':
        return '#9C27B0';
      case 'communication':
        return '#2196F3';
      case 'emergency':
        return '#F44336';
      default:
        return '#FF9800';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: getTypeColor() },
        !notification.read && styles.unreadCard,
      ]}
      onPress={() => onPress?.(notification.id)}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getTypeIcon()}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !notification.read && styles.unreadTitle]}>
              {notification.title}
            </Text>
            {!notification.read && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>

          <Text style={styles.time}>{formatTime(notification.created_at)}</Text>
        </View>
      </View>

      {!notification.read && onMarkAsRead && (
        <TouchableOpacity
          style={styles.markAsReadButton}
          onPress={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}>
          <Text style={styles.markAsReadText}>Marcar como lida</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// New pending notification card component
function PendingNotificationCard({ notification, onRespond }: PendingNotificationCardProps) {
  const [responding, setResponding] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const sent = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - sent.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} dias`;
  };

  const getNotificationTitle = () => {
    switch (notification.entry_type) {
      case 'visitor':
        return notification.guest_name ? `🚶 ${notification.guest_name}` : '🚶 Nova visita';
      case 'delivery':
        return '📦 Nova encomenda';
      case 'vehicle':
        return '🚗 Novo veículo';
      default:
        return '🔔 Nova notificação';
    }
  };

  const getNotificationDetails = () => {
    switch (notification.entry_type) {
      case 'visitor':
        const visitorDetails = [];
        if (notification.purpose) visitorDetails.push(`📋 ${notification.purpose}`);
        if (notification.guest_name) visitorDetails.push(`👤 ${notification.guest_name}`);
        if (notification.phone) visitorDetails.push(`📞 ${notification.phone}`);
        return visitorDetails.length > 0 ? visitorDetails.join('\n') : 'Informações do visitante não disponíveis';
      
      case 'delivery':
        const deliveryDetails = [];
        if (notification.delivery_description) deliveryDetails.push(`📦 ${notification.delivery_description}`);
        if (notification.delivery_sender) deliveryDetails.push(`🚚 Remetente: ${notification.delivery_sender}`);
        if (notification.delivery_company) deliveryDetails.push(`🏢 Empresa: ${notification.delivery_company}`);
        return deliveryDetails.length > 0 ? deliveryDetails.join('\n') : 'Informações da encomenda não disponíveis';
      
      case 'vehicle':
        const vehicleDetails = [];
        if (notification.guest_name) vehicleDetails.push(`👤 Proprietário: ${notification.guest_name}`);
        if (notification.license_plate) vehicleDetails.push(`🔢 Placa: ${notification.license_plate}`);
        const vehicleInfo = [notification.vehicle_brand, notification.vehicle_model, notification.vehicle_color].filter(Boolean).join(' ');
        if (vehicleInfo) vehicleDetails.push(`🚗 Veículo: ${vehicleInfo}`);
        return vehicleDetails.length > 0 ? vehicleDetails.join('\n') : 'Informações do veículo não disponíveis';
      
      default:
        return notification.guest_name ? `👤 ${notification.guest_name}` : 'Detalhes não disponíveis';
    }
  };

  const isDelivery = notification.purpose?.toLowerCase().includes('entrega') || 
                   notification.entry_type === 'delivery';

  const handleApprove = () => {
    onRespond(notification.id, { action: 'approve' });
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const handleDeliveryPortaria = () => {
    onRespond(notification.id, { 
      action: 'approve', 
      delivery_destination: 'portaria' 
    });
  };

  const handleDeliveryElevador = () => {
    onRespond(notification.id, { 
      action: 'approve', 
      delivery_destination: 'elevador' 
    });
  };

  const confirmReject = () => {
    onRespond(notification.id, { 
      action: 'reject', 
      reason: rejectReason 
    });
    
    setShowRejectModal(false);
    setRejectReason('');
  };

  const handleDeliveryDestination = async (destination: 'portaria' | 'elevador' | 'apartamento') => {
    setResponding(true);
    const result = await onRespond(notification.id, {
      action: 'approve',
      delivery_destination: destination
    });
    
    if (!result.success) {
      Alert.alert('Erro', 'Não foi possível processar a encomenda');
    }
    
    setShowDeliveryModal(false);
    setResponding(false);
  };

  return (
    <View style={[styles.notificationCard, isDelivery && styles.deliveryCard]}>
      <View style={styles.notificationHeader}>
        <Text style={[styles.notificationTitle, isDelivery && styles.deliveryTitle]}>
          {getNotificationTitle()}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowInfoModal(true)}
          >
            <Info size={16} color="#2196F3" />
          </TouchableOpacity>
          {notification.photo_url && (
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => setShowImageModal(true)}
            >
              <Eye size={16} color="#2196F3" />
            </TouchableOpacity>
          )}
          <Text style={styles.notificationTime}>
            {getTimeAgo(notification.notification_sent_at)}
          </Text>
        </View>
      </View>
      
      {isDelivery && (
        <View style={styles.deliveryInfo}>
          <Text style={styles.deliveryInfoText}>🚚 Entrega aguardando destino</Text>
        </View>
      )}
      
      <View style={styles.notificationActions}>
        {isDelivery ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.porterButton]}
              onPress={handleDeliveryPortaria}
              disabled={responding}
            >
              <Text style={styles.actionButtonText}>
                {responding ? 'Processando...' : 'Deixar na portaria'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.elevatorButton]}
              onPress={handleDeliveryElevador}
              disabled={responding}
            >
              <Text style={styles.actionButtonText}>
                {responding ? 'Processando...' : 'Subir no elevador'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.denyButton]}
              onPress={handleReject}
              disabled={responding}
            >
              <Text style={styles.actionButtonText}>
                {responding ? 'Processando...' : 'Recusar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={responding}
            >
              <Text style={styles.actionButtonText}>
                {responding ? 'Processando...' : 'Aceitar'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Modal de informações */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Info size={24} color="#2196F3" />
                <Text style={styles.modalTitle}>Detalhes da Notificação</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.photoSection}>
              <TouchableOpacity 
                style={styles.viewPhotoButton}
                onPress={() => setShowImageModal(true)}
              >
                <Eye size={18} color="#2196F3" />
                <Text style={styles.viewPhotoText}>Ver Imagem</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoContent}>
              {notification.guest_name && (
                <Text style={styles.infoItem}>👤 Nome: {notification.guest_name}</Text>
              )}
              {notification.phone && (
                <Text style={styles.infoItem}>📞 Telefone: {notification.phone}</Text>
              )}
              {notification.purpose && (
                <Text style={styles.infoItem}>📋 Motivo: {notification.purpose}</Text>
              )}
              {notification.delivery_sender && (
                <Text style={styles.infoItem}>🚚 Remetente: {notification.delivery_sender}</Text>
              )}
              {notification.delivery_company && (
                <Text style={styles.infoItem}>🏢 Empresa: {notification.delivery_company}</Text>
              )}
              {notification.delivery_description && (
                <Text style={styles.infoItem}>📦 Descrição: {notification.delivery_description}</Text>
              )}
              {notification.license_plate && (
                <Text style={styles.infoItem}>🔢 Placa: {notification.license_plate}</Text>
              )}
              {notification.vehicle_brand && (
                <Text style={styles.infoItem}>🚗 Veículo: {[notification.vehicle_brand, notification.vehicle_model, notification.vehicle_color].filter(Boolean).join(' ')}</Text>
              )}
              <Text style={styles.infoItem}>🕐 Solicitado em: {new Date(notification.notification_sent_at).toLocaleString('pt-BR')}</Text>
            </View>
            <View style={styles.modalActions}>
              {isDelivery ? (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.porterButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleDeliveryPortaria();
                    }}
                    disabled={responding}
                  >
                    <Text style={styles.actionButtonText}>
                      {responding ? 'Processando...' : 'Deixar na portaria'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.elevatorButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleDeliveryElevador();
                    }}
                    disabled={responding}
                  >
                    <Text style={styles.actionButtonText}>
                      {responding ? 'Processando...' : 'Subir no elevador'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.denyButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleReject();
                    }}
                    disabled={responding}
                  >
                    <Text style={styles.actionButtonText}>
                      {responding ? 'Processando...' : 'Recusar'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.approveButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleApprove();
                    }}
                    disabled={responding}
                  >
                    <Text style={styles.actionButtonText}>
                      {responding ? 'Processando...' : 'Aceitar'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
           
          </View>
        </View>
      </Modal>

      {/* Modal de rejeição */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motivo da recusa</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Digite o motivo (opcional)"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmReject}
                disabled={responding}
              >
                <Text style={styles.confirmButtonText}>Recusar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de visualização de imagem */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalContent}>
            <View style={styles.imageModalHeader}>
              <Text style={styles.imageModalTitle}>Foto do Visitante</Text>
              <TouchableOpacity
                style={styles.closeImageButton}
                onPress={() => setShowImageModal(false)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {notification.photo_url ? (
              <Image 
                source={{ uri: notification.photo_url }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noImageContainer}>
                <Text style={styles.noImageText}>Nenhuma imagem disponível</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.closeImageButtonBottom}
              onPress={() => setShowImageModal(false)}
            >
              <X size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.closeImageButtonText}>Fechar</Text>
            </TouchableOpacity>
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
    marginVertical: 6,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unreadCard: {
    backgroundColor: '#f8f9ff',
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: 'bold',
    color: '#000',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  markAsReadButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  markAsReadText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  // Pending notification styles
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  infoButtonText: {
    fontSize: 14,
    color: '#2196F3',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  notificationDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  denyButton: {
    backgroundColor: '#f44336',
  },
  porterButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 8,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#45a049',
  },
  elevatorButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 8,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  actionButtonText: {
    color: '#000',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
    letterSpacing: 0.5,
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
    padding: 24,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  viewPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    backgroundColor: '#f44336',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  infoContent: {
    marginBottom: 20,
  },
  infoItem: {
    fontSize: 15,
    color: '#444',
    marginBottom: 12,
    lineHeight: 22,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  deliveryOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  porterButton: {
    backgroundColor: '#e3f2fd',
  },
  elevatorButton: {
    backgroundColor: '#f3e5f5',
  },
  apartmentButton: {
    backgroundColor: '#e8f5e8',
  },
  deliveryOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Estilos específicos para card de entrega
  deliveryCard: {
    borderLeftColor: '#FF9800',
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  deliveryTitle: {
    color: '#E65100',
    fontWeight: 'bold',
  },
  deliveryInfo: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  deliveryInfoText: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600',
  },
  // Estilos do modal de imagem
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '95%',
    height: '90%',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeImageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
    borderRadius: 8,
  },
  noImageContainer: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  noImageText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  closeImageButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    position: 'absolute',
    bottom: 30,
  },
  closeImageButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
