import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  created_at: string;
  read: boolean;
}

interface NotificationCardProps {
  notification: Notification;
  onPress?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
}

export function NotificationCard({ notification, onPress, onMarkAsRead }: NotificationCardProps) {
  const getTypeIcon = () => {
    switch (notification.type) {
      case 'visitor': return '👋';
      case 'delivery': return '📦';
      case 'communication': return '📢';
      case 'emergency': return '🚨';
      default: return '🔔';
    }
  };

  const getTypeColor = () => {
    switch (notification.type) {
      case 'visitor': return '#4CAF50';
      case 'delivery': return '#9C27B0';
      case 'communication': return '#2196F3';
      case 'emergency': return '#F44336';
      default: return '#FF9800';
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
        !notification.read && styles.unreadCard
      ]}
      onPress={() => onPress?.(notification.id)}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getTypeIcon()}</Text>
        </View>
        
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.title,
              !notification.read && styles.unreadTitle
            ]}>
              {notification.title}
            </Text>
            {!notification.read && (
              <View style={styles.unreadDot} />
            )}
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
          }}
        >
          <Text style={styles.markAsReadText}>Marcar como lida</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
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
});