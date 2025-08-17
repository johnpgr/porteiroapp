import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

interface Visitor {
  id: string;
  name: string;
  document: string;
  apartment_number: string;
  photo_url?: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  purpose?: string;
}

interface VisitorCardProps {
  visitor: Visitor;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  showActions?: boolean;
}

export function VisitorCard({ visitor, onApprove, onDeny, showActions = false }: VisitorCardProps) {
  const getStatusColor = () => {
    switch (visitor.status) {
      case 'approved': return '#4CAF50';
      case 'denied': return '#F44336';
      default: return '#FF9800';
    }
  };

  const getStatusText = () => {
    switch (visitor.status) {
      case 'approved': return '✅ Aprovado';
      case 'denied': return '❌ Negado';
      default: return '⏳ Pendente';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <View style={[styles.card, { borderLeftColor: getStatusColor() }]}>
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
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={[styles.status, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          <Text style={styles.time}>{formatTime(visitor.created_at)}</Text>
        </View>
      </View>

      {visitor.purpose && (
        <View style={styles.purposeContainer}>
          <Text style={styles.purposeLabel}>Motivo:</Text>
          <Text style={styles.purpose}>{visitor.purpose}</Text>
        </View>
      )}

      {showActions && visitor.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.denyButton]}
            onPress={() => onDeny?.(visitor.id)}
          >
            <Text style={styles.actionButtonText}>❌ Negar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => onApprove?.(visitor.id)}
          >
            <Text style={styles.actionButtonText}>✅ Aprovar</Text>
          </TouchableOpacity>
        </View>
      )}
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
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});