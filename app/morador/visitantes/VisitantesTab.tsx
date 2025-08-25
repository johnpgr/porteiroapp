import React, { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface Visitor {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  photo_url: string | null;
  status: string;
  visitor_type: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  apartment_id: string;
}

export default function VisitantesTab() {
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Iniciando busca de visitantes...');
      console.log('👤 Usuário logado:', user?.id);

      if (!user?.id) {
        console.log('❌ Usuário não encontrado');
        setError('Usuário não encontrado');
        return;
      }

      // Primeiro, buscar o apartment_id do usuário logado
      console.log('🏠 Buscando apartment_id do usuário...');
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', user.id)
        .single();

      if (apartmentError) {
        console.error('❌ Erro ao buscar apartment_id:', apartmentError);
        throw apartmentError;
      }

      if (!apartmentData?.apartment_id) {
        console.log('❌ Apartment_id não encontrado para o usuário');
        setError('Apartamento não encontrado para o usuário');
        return;
      }

      console.log('✅ Apartment_id encontrado:', apartmentData.apartment_id);

      // Buscar visitantes filtrados por apartment_id
      console.log('📋 Buscando visitantes do apartamento...');
      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitors')
        .select(`
          id,
          name,
          document,
          phone,
          photo_url,
          status,
          visitor_type,
          created_at,
          updated_at,
          is_active,
          apartment_id
        `)
        .eq('apartment_id', apartmentData.apartment_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (visitorsError) {
        console.error('❌ Erro ao buscar visitantes:', visitorsError);
        throw visitorsError;
      }

      console.log('✅ Visitantes encontrados para o apartamento:', visitorsData?.length || 0);
      console.log('📊 Dados dos visitantes:', visitorsData);

      // Mapear os dados
      const mappedVisitors: Visitor[] = (visitorsData || []).map(visitor => ({
        id: visitor.id,
        name: visitor.name || 'Nome não informado',
        document: visitor.document,
        phone: visitor.phone,
        photo_url: visitor.photo_url,
        status: visitor.status || 'pending',
        visitor_type: visitor.visitor_type || 'comum',
        created_at: visitor.created_at,
        updated_at: visitor.updated_at,
        is_active: visitor.is_active,
        apartment_id: visitor.apartment_id
      }));

      console.log('✅ [VisitantesTab] Mapped visitors:', mappedVisitors);
      setVisitors(mappedVisitors);
    } catch (error) {
      console.error('❌ Erro geral ao buscar visitantes:', error);
      setError('Erro ao carregar visitantes');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  const getVisitorTypeIcon = (type: string) => {
    switch (type) {
      case 'frequente':
        return '⭐';
      case 'comum':
      default:
        return '👤';
    }
  };

  const getVisitorTypeText = (type: string) => {
    switch (type) {
      case 'frequente':
        return 'Frequente';
      case 'comum':
      default:
        return 'Comum';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      case 'pending':
      default:
        return '⏳';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'Aprovado';
      case 'rejected':
        return 'Negado';
      case 'pending':
      default:
        return 'Pendente';
    }
  };

  return (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Pré-cadastro de Visitantes</Text>
        <Text style={styles.sectionDescription}>
          Cadastre visitantes esperados para facilitar a entrada
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/morador/visitantes/novo')}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.primaryButtonText}>Cadastrar Novo Visitante</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📝 Visitantes Pré-cadastrados</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={fetchVisitors}
            disabled={loading}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={loading ? '#ccc' : '#4CAF50'} 
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando visitantes...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#f44336" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchVisitors}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : visitors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum visitante pré-cadastrado</Text>
            <Text style={styles.emptySubtext}>
              Cadastre visitantes esperados para facilitar a entrada
            </Text>
          </View>
        ) : (
          visitors.map((visitor) => (
            <View key={visitor.id} style={styles.visitorCard}>
              <Text style={styles.visitorName}>{visitor.name}</Text>
              {visitor.document && (
                <Text style={styles.visitorDocument}>📄 {visitor.document}</Text>
              )}
              {visitor.phone && (
                <Text style={styles.visitorPhone}>📞 {visitor.phone}</Text>
              )}
              <View style={styles.visitorTypeContainer}>
                <Text style={styles.visitorTypeIcon}>{getVisitorTypeIcon(visitor.visitor_type)}</Text>
                <Text style={styles.visitorTypeText}>{getVisitorTypeText(visitor.visitor_type)}</Text>
              </View>
              <Text style={styles.visitorDate}>
                Cadastrado: {formatDate(visitor.created_at)}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editButton}>
                  <Text style={styles.editButtonText}>✏️ Editar</Text>
                </TouchableOpacity>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusIcon}>{getStatusIcon(visitor.status)}</Text>
                  <Text style={styles.statusText}>{getStatusText(visitor.status)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  visitorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitorTypeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  visitorTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  visitorDocument: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    color: '#2d5a2d',
    fontSize: 12,
    fontWeight: '500',
  },
});