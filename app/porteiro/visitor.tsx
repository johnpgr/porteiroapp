import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Container } from '~/components/Container';
import { VisitorCard } from '~/components/VisitorCard';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';

interface Visitor {
  id: string;
  name: string;
  document: string;
  apartment_id: string;
  photo_url?: string;
  status: 'pendente' | 'aprovado' | 'negado' | 'entrada' | 'saida';
  authorized_by?: string;
  notes?: string;
  created_at: string;
  apartments?: {
    number: string;
  };
}

export default function VisitorManagement() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pendente' | 'aprovado' | 'entrada'>('pendente');
  const [newVisitor, setNewVisitor] = useState({
    name: '',
    document: '',
    apartment_number: '',
    notes: '',
    photo_uri: null as string | null,
  });

  useEffect(() => {
    fetchVisitors();
  }, [filter, fetchVisitors]);

  const fetchVisitors = useCallback(async () => {
    try {
      let query = supabase
        .from('visitors')
        .select(
          `
          *,
          apartments!inner(number)
        `
        )
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedVisitors =
        data?.map((visitor) => ({
          ...visitor,
          apartment_number: visitor.apartments?.number || 'N/A',
        })) || [];

      setVisitors(formattedVisitors);
    } catch {
      Alert.alert('Erro', 'Falha ao carregar visitantes');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleVisitorAction = async (
    visitorId: string,
    action: 'aprovado' | 'negado' | 'entrada' | 'saida',
    notes?: string
  ) => {
    try {
      const { error: updateError } = await supabase
        .from('visitors')
        .update({
          status: action,
          authorized_by: 'Porteiro', // TODO: pegar do contexto de auth
          notes: notes || null,
        })
        .eq('id', visitorId);

      if (updateError) throw updateError;

      // Registrar no log com nova estrutura
      const visitor = visitors.find((v) => v.id === visitorId);
      if (visitor) {
        // Buscar building_id do apartamento
        const { data: apartment, error: aptError } = await supabase
          .from('apartments')
          .select('building_id')
          .eq('id', visitor.apartment_id)
          .single();

        if (aptError || !apartment) {
          console.error('Erro ao buscar building_id:', aptError);
          return;
        }

        // Gerar visit_session_id único para agrupar entrada/saída
        const visitSessionId = Crypto.randomUUID();
        
        // Determinar o tipo de log baseado na ação
        let tipoLog: 'IN' | 'OUT' | null = null;
        if (action === 'aprovado' || action === 'entrada') {
          tipoLog = 'IN';
        } else if (action === 'saida') {
          tipoLog = 'OUT';
        }

        // Só criar log se for entrada ou saída
        if (tipoLog) {
          const { error: logError } = await supabase.from('visitor_logs').insert({
            visitor_id: visitor.id,
            apartment_id: visitor.apartment_id,
            building_id: apartment.building_id,
            log_time: new Date().toISOString(),
            tipo_log: tipoLog,
            visit_session_id: visitSessionId,
            purpose: notes || 'Visita registrada pelo porteiro',
            authorized_by: 'Porteiro', // TODO: pegar ID do usuário logado
            status: 'authorized'
          });

          if (logError) console.error('Erro ao registrar log:', logError);
        }
      }

      fetchVisitors();

      const actionMessages = {
        aprovado: 'Visitante aprovado com sucesso!',
        negado: 'Visitante negado',
        entrada: 'Entrada registrada',
        saida: 'Saída registrada',
      };

      Alert.alert('Sucesso', actionMessages[action]);
    } catch {
      Alert.alert('Erro', 'Falha ao processar ação');
    }
  };

  const handleAddVisitor = async () => {
    if (!newVisitor.name || !newVisitor.document || !newVisitor.apartment_number) {
      Alert.alert('Erro', 'Nome, documento e apartamento são obrigatórios');
      return;
    }

    try {
      // Buscar apartamento
      const { data: apartment, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('number', newVisitor.apartment_number)
        .single();

      if (aptError || !apartment) {
        Alert.alert('Erro', 'Apartamento não encontrado');
        return;
      }

      let photoUrl = null;
      if (newVisitor.photo_uri) {
        // TODO: Upload da foto para Supabase Storage
        // Por enquanto, usar a URI local
        photoUrl = newVisitor.photo_uri;
      }

      const { error: insertError } = await supabase.from('visitors').insert({
        name: newVisitor.name,
        document: newVisitor.document,
        phone: null,
        photo_url: photoUrl,
        is_active: true,
      });

      if (insertError) throw insertError;

      Alert.alert('Sucesso', 'Visitante registrado com sucesso!');
      setNewVisitor({
        name: '',
        document: '',
        apartment_number: '',
        notes: '',
        photo_uri: null,
      });
      setShowAddForm(false);
      fetchVisitors();
    } catch {
      Alert.alert('Erro', 'Falha ao adicionar visitante');
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erro', 'Permissão de câmera necessária');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewVisitor((prev) => ({ ...prev, photo_uri: result.assets[0].uri }));
    }
  };

  const getFilterCount = (filterType: string) => {
    if (filterType === 'all') return visitors.length;
    return visitors.filter((v) => v.status === filterType).length;
  };

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>👥 Gerenciar Visitantes</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addButtonText}>
              {showAddForm ? '❌ Cancelar' : '➕ Registrar Visitante'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'pendente', label: 'Pendentes', icon: '⏳' },
                { key: 'aprovado', label: 'Aprovados', icon: '✅' },
                { key: 'entrada', label: 'No Prédio', icon: '🏠' },
                { key: 'all', label: 'Todos', icon: '📋' },
              ].map((filterOption) => (
                <TouchableOpacity
                  key={filterOption.key}
                  style={[
                    styles.filterButton,
                    filter === filterOption.key && styles.filterButtonActive,
                  ]}
                  onPress={() => setFilter(filterOption.key as any)}>
                  <Text
                    style={[
                      styles.filterButtonText,
                      filter === filterOption.key && styles.filterButtonTextActive,
                    ]}>
                    {filterOption.icon} {filterOption.label}
                  </Text>
                  <Text
                    style={[
                      styles.filterCount,
                      filter === filterOption.key && styles.filterCountActive,
                    ]}>
                    {getFilterCount(filterOption.key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Registrar Novo Visitante</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome completo do visitante"
              value={newVisitor.name}
              onChangeText={(text) => setNewVisitor((prev) => ({ ...prev, name: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Documento (RG/CPF)"
              value={newVisitor.document}
              onChangeText={(text) => setNewVisitor((prev) => ({ ...prev, document: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Número do apartamento"
              value={newVisitor.apartment_number}
              onChangeText={(text) =>
                setNewVisitor((prev) => ({ ...prev, apartment_number: text }))
              }
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações (opcional)"
              value={newVisitor.notes}
              onChangeText={(text) => setNewVisitor((prev) => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={3}
            />

            <View style={styles.photoSection}>
              <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                <Text style={styles.photoButtonText}>📷 Tirar Foto</Text>
              </TouchableOpacity>

              {newVisitor.photo_uri && (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: newVisitor.photo_uri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => setNewVisitor((prev) => ({ ...prev, photo_uri: null }))}>
                    <Text style={styles.removePhotoText}>❌</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddVisitor}>
              <Text style={styles.submitButtonText}>✅ Registrar Visitante</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.visitorsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando visitantes...</Text>
            </View>
          ) : visitors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>Nenhum visitante encontrado</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all'
                  ? 'Ainda não há visitantes registrados'
                  : `Nenhum visitante com status "${filter}" encontrado`}
              </Text>
            </View>
          ) : (
            visitors.map((visitor) => (
              <VisitorCard
                key={visitor.id}
                visitor={visitor}
                onAction={handleVisitorAction}
                showActions={true}
              />
            ))
          )}
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  actions: {
    padding: 20,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filters: {
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    minWidth: 80,
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  filterCountActive: {
    color: '#fff',
  },
  addForm: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoSection: {
    marginBottom: 15,
  },
  photoButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoPreview: {
    position: 'relative',
    alignSelf: 'center',
  },
  previewImage: {
    width: 120,
    height: 160,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  removePhotoText: {
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  visitorsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
