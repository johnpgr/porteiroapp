import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Image, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  onInfoPress?: () => void;
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
function PendingNotificationCard({ notification, onRespond, onInfoPress }: PendingNotificationCardProps) {
  const [responding, setResponding] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeliveryCodeModal, setShowDeliveryCodeModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deliveryCode, setDeliveryCode] = useState('');
  const [pendingDeliveryDestination, setPendingDeliveryDestination] = useState<'portaria' | 'elevador' | null>(null);

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

  // Debug logs para identificar problemas com detecção de entregas
  console.log('🔍 [NotificationCard] Debug da notificação:', {
    id: notification.id,
    entry_type: notification.entry_type,
    purpose: notification.purpose,
    isDelivery: isDelivery,
    guest_name: notification.guest_name,
    delivery_sender: notification.delivery_sender,
    delivery_description: notification.delivery_description
  });

  const handleApprove = () => {
    onRespond(notification.id, { action: 'approve' });
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const handleDeliveryPortaria = () => {
    setPendingDeliveryDestination('portaria');
    setShowDeliveryCodeModal(true);
  };

  const handleDeliveryElevador = () => {
    setPendingDeliveryDestination('elevador');
    setShowDeliveryCodeModal(true);
  };

  const confirmDeliveryWithCode = () => {
    if (pendingDeliveryDestination) {
      onRespond(notification.id, { 
        action: 'approve', 
        delivery_destination: pendingDeliveryDestination,
        delivery_code: deliveryCode.trim() || undefined
      });
      setShowDeliveryCodeModal(false);
      setDeliveryCode('');
      setPendingDeliveryDestination(null);
    }
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
            style={styles.detailsButton}
            onPress={onInfoPress || (() => setShowInfoModal(true))}
          >
            <Text style={styles.detailsButtonText}>ver detalhes</Text>
          </TouchableOpacity>
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

      {/* Modal de informações redesenhado */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <SafeAreaView style={styles.fullScreenModalOverlay}>
          <View style={styles.fullScreenDetailsCard}>
            {/* Header Fixo */}
            <View style={styles.fullScreenHeader}>
              <View style={styles.headerContent}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => setShowInfoModal(false)}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.fullScreenTitle}>Detalhes da Notificação</Text>
                  <Text style={styles.fullScreenSubtitle}>{notification.guest_name || 'Visitante'}</Text>
                </View>
              </View>
            </View>

            {/* Conteúdo Scrollável */}
            <ScrollView 
              style={styles.fullScreenScrollContent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.fullScreenScrollContainer}
            >
              {/* Foto do Visitante */}
              <View style={styles.photoContainer}>
                {notification.photo_url ? (
                  <TouchableOpacity 
                    style={styles.photoWrapper}
                    onPress={() => {
                      console.debug('�️ Tentando abrir modal de imagem:', notification.photo_url);
                      setShowImageModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image 
                      source={{ uri: notification.photo_url }} 
                      style={styles.visitorPhoto}
                      resizeMode="cover"
                      onLoad={() => console.debug('✅ Imagem carregada com sucesso:', notification.photo_url)}
                      onError={(error) => console.error('❌ Erro ao carregar imagem:', error.nativeEvent.error, 'URL:', notification.photo_url)}
                      onLoadStart={() => console.debug('🔄 Iniciando carregamento da imagem:', notification.photo_url)}
                    />

                  </TouchableOpacity>
                ) : (
                  <View style={styles.noPhotoContainer}>
                    <Ionicons name="camera-off" size={40} color="#ccc" />
                    <Text style={styles.noPhotoText}>Imagem não registrada</Text>
                  </View>
                )}
              </View>

              {/* Informações do Visitante */}
              <View style={styles.infoContainer}>
                <View style={styles.infoGrid}>
                {notification.guest_name && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                       <Ionicons name="person-outline" size={18} color="#4CAF50" />
                     </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Nome Completo</Text>
                      <Text style={styles.infoValue}>{notification.guest_name}</Text>
                    </View>
                  </View>
                )}

                {notification.phone && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                     <Ionicons name="call-outline" size={18} color="#4CAF50" />
                   </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Telefone</Text>
                      <Text style={styles.infoValue}>{notification.phone}</Text>
                    </View>
                  </View>
                )}

                {notification.purpose && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                     <Ionicons name="clipboard-outline" size={18} color="#4CAF50" />
                   </View>
                     <View style={styles.infoContent}>
                       <Text style={styles.infoLabel}>Motivo da Visita</Text>
                       <Text style={styles.infoValue}>{notification.purpose}</Text>
                     </View>
                  </View>
                )}

                <View style={styles.infoItem}>
                   <View style={styles.infoIcon}>
                     <Ionicons name="time-outline" size={18} color="#4CAF50" />
                   </View>
                   <View style={styles.infoContent}>
                     <Text style={styles.infoLabel}>Data e Hora</Text>
                     <Text style={styles.infoValue}>{new Date(notification.notification_sent_at).toLocaleString('pt-BR')}</Text>
                   </View>
                 </View>

                {notification.delivery_sender && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="business-outline" size={18} color="#4CAF50" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Empresa</Text>
                      <Text style={styles.infoValue}>{notification.delivery_sender}</Text>
                    </View>
                  </View>
                )}

                {notification.delivery_description && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="document-text-outline" size={18} color="#4CAF50" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Descrição</Text>
                      <Text style={styles.infoValue}>{notification.delivery_description}</Text>
                    </View>
                  </View>
                )}

                {notification.license_plate && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="car-outline" size={18} color="#4CAF50" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Placa</Text>
                      <Text style={styles.infoValue}>{notification.license_plate}</Text>
                    </View>
                  </View>
                )}

                {notification.vehicle_brand && (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="car-sport-outline" size={18} color="#4CAF50" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Veículo</Text>
                      <Text style={styles.infoValue}>{[notification.vehicle_brand, notification.vehicle_model, notification.vehicle_color].filter(Boolean).join(' ')}</Text>
                    </View>
                  </View>
                )}
                </View>
              </View>
            </ScrollView>

            {/* Footer Fixo com Ações */}
            <View style={styles.fullScreenFooter}>
              {isDelivery ? (
                <>
                  <TouchableOpacity
                    style={[styles.cardActionButton, styles.approveCardButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleDeliveryPortaria();
                    }}
                    disabled={responding}
                  >
                    <Ionicons name="home-outline" size={20} color="white" />
                    <Text style={styles.cardActionText}>{responding ? 'Processando...' : 'Deixar na portaria'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardActionButton, styles.denyCardButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleDeliveryElevador();
                    }}
                    disabled={responding}
                  >
                    <Ionicons name="arrow-up-outline" size={20} color="white" />
                    <Text style={styles.cardActionText}>{responding ? 'Processando...' : 'Subir no elevador'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.cardActionButton, styles.denyCardButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleReject();
                    }}
                    disabled={responding}
                  >
                    <Ionicons name="close-outline" size={20} color="white" />
                    <Text style={styles.cardActionText}>{responding ? 'Processando...' : 'Recusar'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardActionButton, styles.approveCardButton]}
                    onPress={() => {
                      setShowInfoModal(false);
                      handleApprove();
                    }}
                    disabled={responding}
                  >
                    <Ionicons name="checkmark-outline" size={20} color="white" />
                    <Text style={styles.cardActionText}>{responding ? 'Processando...' : 'Aceitar'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
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

      {/* Modal de código de entrega */}
      <Modal
        visible={showDeliveryCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeliveryCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="cube-outline" size={24} color="#FF9800" />
                <Text style={styles.modalTitle}>Código da Encomenda</Text>
              </View>
            </View>
            <Text style={[styles.notificationDetails, { marginBottom: 16 }]}>
              Digite o código ou palavra-chave da encomenda (se houver) para facilitar a localização pelo porteiro:
            </Text>
            <TextInput
              style={[styles.textInput, { minHeight: 50 }]}
              placeholder="Ex: ABC123, Código de retirada, etc. (opcional)"
              value={deliveryCode}
              onChangeText={setDeliveryCode}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeliveryCodeModal(false);
                  setDeliveryCode('');
                  setPendingDeliveryDestination(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
                onPress={confirmDeliveryWithCode}
                disabled={responding}
              >
                <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                  {responding ? 'Processando...' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de visualização de imagem em tela cheia */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.fullScreenImageModalOverlay}>
          {/* Header com título e botão fechar */}
          <View style={styles.fullScreenImageHeader}>
            <Text style={styles.fullScreenImageTitle}>Foto do Visitante</Text>
            <TouchableOpacity
              style={styles.fullScreenImageCloseButton}
              onPress={() => setShowImageModal(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Conteúdo da imagem */}
          <View style={styles.fullScreenImageContent}>
            {notification.photo_url ? (
              <ScrollView
                contentContainerStyle={styles.imageScrollContainer}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                zoomScale={1}
              >
                <Image 
                  source={{ uri: notification.photo_url }} 
                  style={styles.fullSizeImage}
                  resizeMode="contain"
                  onLoad={() => console.debug('✅ Imagem em tela cheia carregada:', notification.photo_url)}
                  onError={(error) => console.error('❌ Erro na imagem em tela cheia:', error.nativeEvent.error)}
                  onLoadStart={() => console.debug('🔄 Carregando imagem em tela cheia:', notification.photo_url)}
                />
              </ScrollView>
            ) : (
              <View style={styles.fullScreenNoImageContainer}>
                <Ionicons name="image-outline" size={80} color="rgba(255, 255, 255, 0.5)" />
                <Text style={styles.fullScreenNoImageText}>Nenhuma imagem disponível</Text>
              </View>
            )}
          </View>
          
          {/* Footer com instruções e botão fechar */}
          <View style={styles.fullScreenImageFooter}>
            {notification.photo_url && (
              <Text style={styles.zoomInstructions}>Toque duas vezes para ampliar</Text>
            )}
            <TouchableOpacity
              style={styles.fullScreenImageCloseButtonBottom}
              onPress={() => setShowImageModal(false)}
            >
              <Ionicons name="close" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.fullScreenImageCloseButtonText}>Fechar</Text>
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
  detailsButton: {
    backgroundColor: '#e3f2fd',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  detailsButtonText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
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
    marginTop: 5,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  photoWrapper: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  visitorPhoto: {
    width: 150,
    height: 150,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },

  noPhotoContainer: {
    width: 150,
    height: 150,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  noPhotoText: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  approveCardButton: {
    backgroundColor: '#4CAF50',
  },
  denyCardButton: {
    backgroundColor: '#f44336',
  },
  cardActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Estilos para modal em tela cheia
  fullScreenModalOverlay: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullScreenDetailsCard: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullScreenHeader: {
    backgroundColor: '#4CAF50',
    padding: 30,
    shadowColor: '#000'
  },
  backButton: {
    width: 40,
    marginTop: 20,
    marginBottom: 20,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTitleContainer: {
    flex: 1,
  },
  fullScreenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  fullScreenSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  fullScreenScrollContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  fullScreenScrollContainer: {
    paddingBottom: 20,
  },
  fullScreenFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
  noImageWarning: {
    backgroundColor: '#fff3cd',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  noImageWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    textAlign: 'center',
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
  // Estilos do modal de imagem em tela cheia
  fullScreenImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'space-between',
  },
  fullScreenImageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  fullScreenImageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  fullScreenImageCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  imageScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullSizeImage: {
    width: '100%',
    height: '100%',
    minWidth: '90%',
    minHeight: '70%',
  },
  fullScreenNoImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  fullScreenNoImageText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
  },
  fullScreenImageFooter: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  zoomInstructions: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  fullScreenImageCloseButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  fullScreenImageCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
