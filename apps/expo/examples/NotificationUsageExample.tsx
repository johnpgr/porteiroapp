import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAvisosNotifications } from '../hooks/useAvisosNotifications';
import { useAuth } from '../hooks/useAuth';

/**
 * Exemplo de uso do sistema integrado de notificações
 * Demonstra como implementar notificações push para avisos e enquetes
 * seguindo as recomendações do documento técnico
 */
export const NotificationUsageExample: React.FC = () => {
  const { user } = useAuth();
  const {
    notifications,
    loading,
    error,
    isListening,
    unreadCount,
    startListening,
    stopListening,
    refreshNotifications,
    markAsRead,
    confirmUrgentNotification,
    getNotificationStats
  } = useAvisosNotifications();

  const [stats, setStats] = useState<any>(null);

  // Inicializar sistema de notificações quando o usuário estiver disponível
  useEffect(() => {
    if (user?.id && !isListening) {
      console.log('🚀 Iniciando sistema de notificações para usuário:', user.id);
      startListening();
      
      // Carregar notificações recentes
      refreshNotifications();
    }

    // Cleanup ao desmontar componente
    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [user?.id]);

  // Carregar estatísticas
  const loadStats = async () => {
    if (!user?.id) return;
    
    try {
      const notificationStats = await getNotificationStats(undefined, 30);
      setStats(notificationStats);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  // Manipular clique em notificação
  const handleNotificationPress = async (notification: any) => {
    if (!user?.id) return;

    try {
      // Marcar como lida
      await markAsRead(notification.id, notification.type, user.id);
      
      // Se for urgente e não confirmada, solicitar confirmação
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        Alert.alert(
          'Confirmação Necessária',
          `Este ${notification.type === 'communication' ? 'comunicado' : 'enquete'} requer confirmação de leitura.`,
          [
            {
              text: 'Cancelar',
              style: 'cancel'
            },
            {
              text: 'Confirmar Leitura',
              onPress: async () => {
                try {
                  await confirmUrgentNotification(notification.id, notification.type, user.id);
                  Alert.alert('Sucesso', 'Confirmação registrada com sucesso!');
                } catch (err) {
                  Alert.alert('Erro', 'Não foi possível confirmar a leitura.');
                }
              }
            }
          ]
        );
      }
    } catch (err) {
      console.error('Erro ao processar notificação:', err);
      Alert.alert('Erro', 'Não foi possível processar a notificação.');
    }
  };

  // Renderizar item de notificação
  const renderNotificationItem = (notification: any, index: number) => {
    const isUrgent = notification.priority === 'high' || notification.priority === 'urgent';
    const isUnread = notification.notification_status !== 'read';
    const isPoll = notification.type === 'poll';
    
    return (
      <TouchableOpacity
        key={`${notification.type}-${notification.id}-${index}`}
        style={[
          styles.notificationItem,
          isUnread && styles.unreadNotification,
          isUrgent && styles.urgentNotification
        ]}
        onPress={() => handleNotificationPress(notification)}
      >
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationIcon}>
            {isPoll ? '🗳️' : (isUrgent ? '📢' : '📄')}
          </Text>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.notificationBuilding}>{notification.building_name}</Text>
          </View>
          <View style={styles.notificationMeta}>
            {isUrgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>URGENTE</Text>
              </View>
            )}
            {isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
        
        <Text style={styles.notificationBody} numberOfLines={2}>
          {notification.content}
        </Text>
        
        <View style={styles.notificationFooter}>
          <Text style={styles.notificationDate}>
            {new Date(notification.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          
          <Text style={styles.notificationStatus}>
            Status: {notification.notification_status || 'enviado'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando notificações...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header com estatísticas */}
      <View style={styles.header}>
        <Text style={styles.title}>Sistema de Notificações</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{notifications.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{unreadCount}</Text>
            <Text style={styles.statLabel}>Não Lidas</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, isListening ? styles.activeStatus : styles.inactiveStatus]}>
              {isListening ? '🟢' : '🔴'}
            </Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.statsButton} onPress={loadStats}>
          <Text style={styles.statsButtonText}>Carregar Estatísticas</Text>
        </TouchableOpacity>
      </View>

      {/* Estatísticas detalhadas */}
      {stats && (
        <View style={styles.detailedStats}>
          <Text style={styles.sectionTitle}>Estatísticas (30 dias)</Text>
          <Text style={styles.statText}>Comunicados enviados: {stats.communications_sent || 0}</Text>
          <Text style={styles.statText}>Enquetes enviadas: {stats.polls_sent || 0}</Text>
          <Text style={styles.statText}>Taxa de entrega: {stats.delivery_rate || '0%'}</Text>
          <Text style={styles.statText}>Taxa de leitura: {stats.read_rate || '0%'}</Text>
        </View>
      )}

      {/* Mensagem de erro */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Lista de notificações */}
      <View style={styles.notificationsContainer}>
        <Text style={styles.sectionTitle}>Notificações Recentes</Text>
        
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>📭</Text>
            <Text style={styles.emptyMessage}>Nenhuma notificação encontrada</Text>
          </View>
        ) : (
          notifications.map((notification, index) => 
            renderNotificationItem(notification, index)
          )
        )}
      </View>

      {/* Instruções de uso */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.sectionTitle}>Como Funciona</Text>
        <Text style={styles.instructionText}>
          • 📢 Comunicados normais aparecem com ícone de documento{"\n"}
          • 🚨 Comunicados urgentes requerem confirmação de leitura{"\n"}
          • 🗳️ Enquetes aparecem com ícone de urna{"\n"}
          • 🔴 Ponto vermelho indica notificação não lida{"\n"}
          • Toque na notificação para marcar como lida
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeStatus: {
    color: '#4CAF50',
  },
  inactiveStatus: {
    color: '#F44336',
  },
  statsButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statsButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  detailedStats: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  notificationsContainer: {
    margin: 15,
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  urgentNotification: {
    borderLeftColor: '#F44336',
    backgroundColor: '#fff3f3',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  notificationBuilding: {
    fontSize: 12,
    color: '#666',
  },
  notificationMeta: {
    alignItems: 'flex-end',
  },
  urgentBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  urgentText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  notificationBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
  notificationStatus: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default NotificationUsageExample;