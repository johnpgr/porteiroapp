import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

interface Visitor {
  id: string;
  name: string;
  document: string;
  apartment_number: string;
  status: 'pendente' | 'approved' | 'denied' | 'in_building' | 'exited';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

interface VisitorLog {
  id: string;
  action: string;
  notes?: string;
  timestamp: string;
  performed_by?: string;
}

export default function StatusScreen() {
  const [searchDocument, setSearchDocument] = useState('');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const searchVisitor = async () => {
    if (!searchDocument.trim()) {
      Alert.alert('Erro', 'Digite o número do seu documento para consultar');
      return;
    }

    setLoading(true);
    try {
      // Buscar visitante mais recente com este documento
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*')
        .eq('document', searchDocument.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (visitorError || !visitorData) {
        Alert.alert('Não encontrado', 'Nenhum registro encontrado com este documento.');
        setVisitor(null);
        setLogs([]);
        return;
      }

      setVisitor(visitorData);

      // Buscar logs do visitante
      const { data: logsData, error: logsError } = await supabase
        .from('visitor_logs')
        .select('*')
        .eq('visitor_id', visitorData.id)
        .order('timestamp', { ascending: false });

      if (!logsError && logsData) {
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Erro ao buscar visitante:', error);
      Alert.alert('Erro', 'Não foi possível consultar o status. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!visitor) return;

    setRefreshing(true);
    try {
      // Atualizar dados do visitante
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', visitor.id)
        .single();

      if (!visitorError && visitorData) {
        setVisitor(visitorData);
      }

      // Atualizar logs
      const { data: logsData, error: logsError } = await supabase
        .from('visitor_logs')
        .select('*')
        .eq('visitor_id', visitor.id)
        .order('timestamp', { ascending: false });

      if (!logsError && logsData) {
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pendente':
        return {
          icon: 'time-outline',
          color: '#FF9800',
          text: 'Aguardando Autorização',
          description: 'Sua solicitação foi enviada ao morador',
        };
      case 'aprovado':
        return {
          icon: 'checkmark-circle',
          color: '#4CAF50',
          text: 'Visita Autorizada',
          description: 'Você pode acessar o prédio',
        };
      case 'nao_permitido':
        return {
          icon: 'close-circle',
          color: '#F44336',
          text: 'Visita Negada',
          description: 'O morador não autorizou sua visita',
        };
      case 'in_building':
        return {
          icon: 'home',
          color: '#2196F3',
          text: 'No Prédio',
          description: 'Você está atualmente no prédio',
        };
      case 'exited':
        return {
          icon: 'exit-outline',
          color: '#9E9E9E',
          text: 'Visita Finalizada',
          description: 'Você saiu do prédio',
        };
      default:
        return {
          icon: 'help-circle',
          color: '#9E9E9E',
          text: 'Status Desconhecido',
          description: '',
        };
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'registered':
        return 'Registrado';
      case 'approved':
        return 'Aprovado';
      case 'denied':
        return 'Negado';
      case 'entered':
        return 'Entrada registrada';
      case 'exited':
        return 'Saída registrada';
      default:
        return action;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Status da Visita</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshStatus} />}>
        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>🔍 Consultar Status</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchDocument}
              onChangeText={setSearchDocument}
              placeholder="Digite o número do seu documento"
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonDisabled]}
              onPress={searchVisitor}
              disabled={loading}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Visitor Info */}
        {visitor && (
          <View style={styles.visitorSection}>
            <View style={styles.visitorCard}>
              <View style={styles.visitorHeader}>
                <Text style={styles.visitorName}>{visitor.name}</Text>
                <TouchableOpacity onPress={refreshStatus}>
                  <Ionicons name="refresh" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.visitorDetails}>
                <Text style={styles.visitorDetail}>📄 {visitor.document}</Text>
                <Text style={styles.visitorDetail}>🏠 Apartamento {visitor.apartment_number}</Text>
                <Text style={styles.visitorDetail}>📅 {formatDateTime(visitor.created_at)}</Text>
              </View>

              {/* Status */}
              <View style={styles.statusContainer}>
                {(() => {
                  const statusInfo = getStatusInfo(visitor.status);
                  return (
                    <View style={[styles.statusCard, { borderLeftColor: statusInfo.color }]}>
                      <Ionicons name={statusInfo.icon as any} size={32} color={statusInfo.color} />
                      <View style={styles.statusContent}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.text}
                        </Text>
                        <Text style={styles.statusDescription}>{statusInfo.description}</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Notes */}
              {visitor.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesTitle}>📝 Observações:</Text>
                  <Text style={styles.notesText}>{visitor.notes}</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            {visitor.status === 'aprovado' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Ligar para Portaria</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Timeline */}
            {logs.length > 0 && (
              <View style={styles.timelineSection}>
                <Text style={styles.sectionTitle}>📋 Histórico</Text>
                <View style={styles.timeline}>
                  {logs.map((log, index) => (
                    <View key={log.id} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      {index < logs.length - 1 && <View style={styles.timelineLine} />}
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineAction}>{getActionText(log.action)}</Text>
                        <Text style={styles.timelineTime}>{formatDateTime(log.timestamp)}</Text>
                        {log.notes && <Text style={styles.timelineNotes}>{log.notes}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpSection}>
          <View style={styles.helpCard}>
            <Ionicons name="information-circle" size={24} color="#2196F3" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Como funciona?</Text>
              <Text style={styles.helpText}>
                • Digite seu documento para consultar{'\n'}• Acompanhe o status em tempo real{'\n'}•
                Receba atualizações automáticas{'\n'}• Entre em contato se necessário
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => router.push('/visitante/help')}>
            <Ionicons name="help-circle" size={20} color="#FF9800" />
            <Text style={styles.helpButtonText}>Precisa de Ajuda?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
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
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#FF9800',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  visitorSection: {
    margin: 20,
    marginTop: 0,
  },
  visitorCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  visitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  visitorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  visitorDetails: {
    marginBottom: 20,
  },
  visitorDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statusContainer: {
    marginBottom: 15,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  statusContent: {
    flex: 1,
    marginLeft: 15,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  notesContainer: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionButtons: {
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  timelineSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeline: {
    paddingLeft: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9800',
    marginRight: 15,
    marginTop: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 2,
    height: 30,
    backgroundColor: '#ddd',
  },
  timelineContent: {
    flex: 1,
  },
  timelineAction: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timelineTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  helpSection: {
    margin: 20,
    marginTop: 0,
  },
  helpCard: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  helpContent: {
    flex: 1,
    marginLeft: 15,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  helpButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  helpButtonText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
