import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { RealtimeNotificationData } from '../hooks/useNotifications';

interface NotificationsListProps {
  notifications: RealtimeNotificationData[];
  onAcknowledge: (notificationId: string) => void;
  onClearAll: () => void;
}

export const NotificationsList: React.FC<NotificationsListProps> = ({
  notifications,
  onAcknowledge,
  onClearAll
}) => {
  // Função para obter cor baseada no status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
      case 'denied':
        return '#F44336';
      case 'entered':
        return '#2196F3';
      case 'exited':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  // Função para obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprovado';
      case 'pending':
        return 'Pendente';
      case 'rejected':
      case 'denied':
        return 'Negado';
      case 'entered':
        return 'Entrada Registrada';
      case 'exited':
        return 'Saída Registrada';
      default:
        return status;
    }
  };

  // Função para obter ícone baseado no tipo de log e status
  const getNotificationIcon = (tipoLog: string, newStatus: string) => {
    if (tipoLog === 'IN') {
      switch (newStatus) {
        case 'approved':
          return '✅';
        case 'entered':
          return '🔵';
        default:
          return '📥';
      }
    } else if (tipoLog === 'OUT') {
      return '🔴';
    }
    return '🔔';
  };

  // Função para formatar data/hora
  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) {
      return 'Agora mesmo';
    } else if (diffMins < 60) {
      return `${diffMins} min atrás`;
    } else if (diffHours < 24) {
      return `${diffHours}h atrás`;
    } else {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} às ${hours}:${minutes}`;
    }
  };

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔔</Text>
        <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
        <Text style={styles.emptySubtitle}>As notificações de mudanças de status aparecerão aqui</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header com botão de limpar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificações Recentes</Text>
        {notifications.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={onClearAll}>
            <Text style={styles.clearButtonText}>Limpar Todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de notificações */}
      <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
        {notifications.map((notification) => (
          <View
            key={notification.id}
            style={[
              styles.notificationCard,
              {
                borderLeftColor: getStatusColor(notification.new_status),
                backgroundColor: notification.acknowledged ? '#f8f9fa' : '#fff'
              }
            ]}
          >
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationIcon}>
                {getNotificationIcon(notification.tipo_log, notification.new_status)}
              </Text>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationTitle}>
                  {notification.visitor_name || 'Visitante'}
                </Text>
                <Text style={styles.notificationSubtitle}>
                  Apartamento {notification.apartment_number}
                </Text>
              </View>
              <View style={styles.notificationMeta}>
                <Text style={styles.notificationTime}>
                  {formatDateTime(notification.changed_at)}
                </Text>
                {!notification.acknowledged && (
                  <View style={styles.unreadBadge} />
                )}
              </View>
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationMessage}>
                Status alterado de{' '}
                <Text style={[styles.statusText, { color: getStatusColor(notification.old_status) }]}>
                  {getStatusText(notification.old_status)}
                </Text>
                {' '}para{' '}
                <Text style={[styles.statusText, { color: getStatusColor(notification.new_status) }]}>
                  {getStatusText(notification.new_status)}
                </Text>
              </Text>
              
              {notification.purpose && (
                <Text style={styles.notificationPurpose}>
                  {notification.purpose}
                </Text>
              )}
            </View>

            {!notification.acknowledged && (
              <TouchableOpacity
                style={styles.acknowledgeButton}
                onPress={() => onAcknowledge(notification.id!)}
              >
                <Text style={styles.acknowledgeButtonText}>✓ Confirmar Recebimento</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f44336',
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 6,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  notificationSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  notificationMeta: {
    alignItems: 'flex-end',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
  },
  notificationContent: {
    marginBottom: 12,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  statusText: {
    fontWeight: '600',
  },
  notificationPurpose: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 4,
  },
  acknowledgeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  acknowledgeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});