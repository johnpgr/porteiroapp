import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import useEnhancedAvisosNotifications from '../hooks/useEnhancedAvisosNotifications';
// Removed old notification service - using Edge Functions for push notifications
import { AvisoNotificationData } from '../hooks/useEnhancedAvisosNotifications';

interface EnhancedNotificationsListProps {
  onNotificationPress?: (notification: AvisoNotificationData) => void;
  showDeliveryStats?: boolean;
  maxItems?: number;
}

interface NotificationItemProps {
  notification: AvisoNotificationData;
  onPress: () => void;
  onMarkAsRead: () => void;
  onConfirmUrgent?: () => void;
  deliveryStatus?: NotificationDeliveryStatus | null;
}

/**
 * Item individual de notificação
 */
const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onMarkAsRead,
  onConfirmUrgent,
  deliveryStatus
}) => {
  const isUnread = notification.notification_status !== 'read';
  const isUrgent = notification.priority === 'high' || notification.priority === 'urgent';
  const isPoll = notification.type === 'poll';
  const isExpired = notification.expires_at && new Date(notification.expires_at) < new Date();

  const getStatusIcon = () => {
    if (!deliveryStatus) return null;
    
    switch (deliveryStatus.push_status) {
      case 'delivered':
        return <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />;
      case 'sent':
        return <Ionicons name="checkmark" size={16} color="#FF9800" />;
      case 'failed':
        return <Ionicons name="close-circle" size={16} color="#F44336" />;
      default:
        return <Ionicons name="time" size={16} color="#9E9E9E" />;
    }
  };

  const getTypeIcon = () => {
    if (isPoll) {
      return <Ionicons name="bar-chart" size={20} color="#2196F3" />;
    } else {
      return <Ionicons name="megaphone" size={20} color={isUrgent ? "#F44336" : "#388E3C"} />;
    }
  };

  const getPriorityBadge = () => {
    if (!isUrgent) return null;
    
    return (
      <View style={styles.urgentBadge}>
        <Text style={styles.urgentBadgeText}>URGENTE</Text>
      </View>
    );
  };

  const getExpirationInfo = () => {
    if (!notification.expires_at) return null;
    
    const expiresAt = new Date(notification.expires_at);
    const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000; // 24 horas
    
    return (
      <View style={[styles.expirationInfo, isExpired && styles.expiredInfo]}>
        <Ionicons 
          name={isExpired ? "time-outline" : "timer-outline"} 
          size={12} 
          color={isExpired ? "#F44336" : isExpiringSoon ? "#FF9800" : "#757575"} 
        />
        <Text style={[styles.expirationText, isExpired && styles.expiredText]}>
          {isExpired ? 'Expirada' : `Expira ${formatDistanceToNow(expiresAt, { locale: ptBR, addSuffix: true })}`}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        isUnread && styles.unreadItem,
        isUrgent && styles.urgentItem,
        isExpired && styles.expiredItem
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.notificationHeader}>
        <View style={styles.typeIconContainer}>
          {getTypeIcon()}
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.notificationTitle, isUnread && styles.unreadTitle]} numberOfLines={2}>
              {notification.title}
            </Text>
            {getPriorityBadge()}
          </View>
          
          {(notification.content || notification.description) && (
            <Text style={styles.notificationBody} numberOfLines={3}>
              {notification.content || notification.description}
            </Text>
          )}
          
          <View style={styles.notificationFooter}>
            <View style={styles.metaInfo}>
              <Text style={styles.buildingName}>
                {notification.building_name || 'Condomínio'}
              </Text>
              <Text style={styles.timestamp}>
                {formatDistanceToNow(new Date(notification.created_at), { locale: ptBR, addSuffix: true })}
              </Text>
            </View>
            
            <View style={styles.statusContainer}>
              {getStatusIcon()}
              {deliveryStatus?.read_status === 'read' && (
                <Ionicons name="eye" size={16} color="#4CAF50" style={{ marginLeft: 4 }} />
              )}
              {deliveryStatus?.confirmation_status === 'confirmed' && (
                <Ionicons name="shield-checkmark" size={16} color="#4CAF50" style={{ marginLeft: 4 }} />
              )}
            </View>
          </View>
          
          {getExpirationInfo()}
        </View>
      </View>
      
      {isUnread && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.markReadButton}
            onPress={(e) => {
              e.stopPropagation();
              onMarkAsRead();
            }}
          >
            <Ionicons name="checkmark" size={16} color="#4CAF50" />
            <Text style={styles.markReadText}>Marcar como lida</Text>
          </TouchableOpacity>
          
          {isUrgent && onConfirmUrgent && (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={(e) => {
                e.stopPropagation();
                onConfirmUrgent();
              }}
            >
              <Ionicons name="shield-checkmark" size={16} color="#2196F3" />
              <Text style={styles.confirmText}>Confirmar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Componente principal da lista de notificações aprimorada
 */
export const EnhancedNotificationsList: React.FC<EnhancedNotificationsListProps> = ({
  onNotificationPress,
  showDeliveryStats = false,
  maxItems = 50
}) => {
  const {
    notifications,
    unreadCount,
    isLoading,
    isListening,
    error,
    deliveryStats,
    refreshNotifications,
    markAsRead,
    confirmUrgentNotification,
    getDeliveryStatus,
    loadDeliveryStats,
    clearError
  } = useEnhancedAvisosNotifications();

  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, NotificationDeliveryStatus | null>>({});
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Carregar status de entrega para notificações visíveis
  useEffect(() => {
    const loadDeliveryStatuses = async () => {
      const statuses: Record<string, NotificationDeliveryStatus | null> = {};
      
      for (const notification of notifications.slice(0, 10)) { // Carregar apenas as primeiras 10
        const key = `${notification.type}_${notification.id}`;
        const status = await getDeliveryStatus(notification.id, notification.type);
        statuses[key] = status;
      }
      
      setDeliveryStatuses(statuses);
    };

    if (notifications.length > 0) {
      loadDeliveryStatuses();
    }
  }, [notifications, getDeliveryStatus]);

  // Carregar estatísticas se solicitado
  useEffect(() => {
    if (showDeliveryStats) {
      loadDeliveryStats();
    }
  }, [showDeliveryStats, loadDeliveryStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    if (showDeliveryStats) {
      await loadDeliveryStats();
    }
    setRefreshing(false);
  };

  const handleNotificationPress = (notification: AvisoNotificationData) => {
    // Marcar como lida automaticamente ao abrir
    if (notification.notification_status !== 'read') {
      markAsRead(notification.id, notification.type);
    }
    
    onNotificationPress?.(notification);
  };

  const handleMarkAsRead = (notification: AvisoNotificationData) => {
    markAsRead(notification.id, notification.type);
  };

  const handleConfirmUrgent = (notification: AvisoNotificationData) => {
    Alert.alert(
      'Confirmar Recebimento',
      `Confirmar que você recebeu e leu o ${notification.type === 'poll' ? 'enquete' : 'comunicado'}: "${notification.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => confirmUrgentNotification(notification.id, notification.type)
        }
      ]
    );
  };

  const renderNotificationItem = ({ item }: { item: AvisoNotificationData }) => {
    const key = `${item.type}_${item.id}`;
    const deliveryStatus = deliveryStatuses[key];
    
    return (
      <NotificationItem
        notification={item}
        onPress={() => handleNotificationPress(item)}
        onMarkAsRead={() => handleMarkAsRead(item)}
        onConfirmUrgent={() => handleConfirmUrgent(item)}
        deliveryStatus={deliveryStatus}
      />
    );
  };

  const renderHeader = () => {
    if (!showDeliveryStats && unreadCount === 0) return null;
    
    return (
      <View style={styles.header}>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
            </Text>
          </View>
        )}
        
        {showDeliveryStats && (
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => setShowStatsModal(true)}
          >
            <Ionicons name="stats-chart" size={16} color="#2196F3" />
            <Text style={styles.statsButtonText}>Estatísticas</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderStatsModal = () => {
    if (!deliveryStats) return null;
    
    return (
      <Modal
        visible={showStatsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estatísticas de Entrega</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.statsContainer}>
              <View style={styles.statSection}>
                <Text style={styles.statSectionTitle}>📢 Comunicados</Text>
                <Text style={styles.statItem}>Total enviados: {deliveryStats.communications.total}</Text>
                <Text style={styles.statItem}>Entregues: {deliveryStats.communications.delivered}</Text>
                <Text style={styles.statItem}>Lidos: {deliveryStats.communications.read}</Text>
                <Text style={styles.statItem}>Taxa de entrega: {deliveryStats.communications.deliveryRate}%</Text>
                <Text style={styles.statItem}>Taxa de leitura: {deliveryStats.communications.readRate}%</Text>
              </View>
              
              <View style={styles.statSection}>
                <Text style={styles.statSectionTitle}>🗳️ Enquetes</Text>
                <Text style={styles.statItem}>Total enviadas: {deliveryStats.polls.total}</Text>
                <Text style={styles.statItem}>Entregues: {deliveryStats.polls.delivered}</Text>
                <Text style={styles.statItem}>Lidas: {deliveryStats.polls.read}</Text>
                <Text style={styles.statItem}>Taxa de entrega: {deliveryStats.polls.deliveryRate}%</Text>
                <Text style={styles.statItem}>Taxa de leitura: {deliveryStats.polls.readRate}%</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off" size={48} color="#BDBDBD" />
      <Text style={styles.emptyStateTitle}>Nenhuma notificação</Text>
      <Text style={styles.emptyStateText}>
        Você receberá notificações de novos comunicados e enquetes aqui.
      </Text>
    </View>
  );

  const renderError = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={24} color="#F44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={clearError}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando notificações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderError()}
      
      <FlatList
        data={notifications.slice(0, maxItems)}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        renderItem={renderNotificationItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
      
      {renderStatsModal()}
      
      {!isListening && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="wifi-off" size={16} color="#F44336" />
          <Text style={styles.offlineText}>Monitoramento offline</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  retryButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  statsButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unreadItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  urgentItem: {
    borderLeftColor: '#F44336',
    backgroundColor: '#FFF3E0',
  },
  expiredItem: {
    opacity: 0.7,
    backgroundColor: '#FAFAFA',
  },
  notificationHeader: {
    flexDirection: 'row',
  },
  typeIconContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    lineHeight: 22,
  },
  unreadTitle: {
    fontWeight: '600',
  },
  urgentBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  urgentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaInfo: {
    flex: 1,
  },
  buildingName: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expirationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  expiredInfo: {
    backgroundColor: '#FFEBEE',
  },
  expirationText: {
    fontSize: 11,
    color: '#FF9800',
    marginLeft: 4,
    fontWeight: '500',
  },
  expiredText: {
    color: '#F44336',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  markReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E8F5E8',
    marginRight: 8,
  },
  markReadText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  confirmText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#424242',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    margin: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  statsContainer: {
    gap: 16,
  },
  statSection: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
  },
  statSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  statItem: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 4,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default EnhancedNotificationsList;