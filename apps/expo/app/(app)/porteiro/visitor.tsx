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
import { MediaTypeOptions } from 'expo-image-picker';
import { notificationApi } from '~/services/notificationApi';

interface Visitor {
  id: string;
  name: string;
  document: string | null;
  apartment_id: string | null;
  apartment_number?: string;
  photo_url?: string;
  visitor_type?: 'comum' | 'frequente';
  authorized_by?: string;
  notes?: string;
  created_at: string;
  notification_status?: 'pending' | 'approved' | 'rejected' | 'entrada' | 'saida' | 'aprovado' | 'nao_permitido';
  apartments?: {
    number: string;
  };
}

export default function PorteiroVisitorScreen() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'entrada'>('pending');
  const [newVisitor, setNewVisitor] = useState({
    name: '',
    document: '',
    apartment_number: '',
    notes: '',
    photo_uri: null as string | null,
    visitor_type: 'comum' as 'comum' | 'frequente',
  });
  const [existingVisitor, setExistingVisitor] = useState<Visitor | null>(null);
  const [, setShowExistingVisitorOptions] = useState(false);


  const fetchVisitors = useCallback(async () => {
    try {
      console.log('🔍 fetchVisitors - Filtro atual:', filter);
      
      // Query corrigida: buscar visitantes diretamente sem apartment join, excluindo os não autorizados
      let query = supabase
        .from('visitors')
        .select('*')
        .neq('status', 'nao_permitido')
        .order('created_at', { ascending: false });

      // Filtro removido temporariamente - notification_status não existe na tabela visitors
      // TODO: Implementar filtro baseado nos logs de visitantes

      const { data: visitorsData, error } = await query;

      if (error) {
        console.error('❌ fetchVisitors - Erro na query:', error);
        throw error;
      }

      console.log('📊 fetchVisitors - Dados retornados:', visitorsData?.length || 0, 'visitantes');
      console.log('📋 fetchVisitors - Dados completos:', visitorsData);

      // Para cada visitante, buscar o apartamento mais recente dos logs
      const formattedVisitors = [];
      
      if (visitorsData) {
        for (const visitor of visitorsData) {
          // Buscar o log mais recente para obter apartment_id
          const { data: logData } = await supabase
            .from('visitor_logs')
            .select(`
              apartment_id,
              apartments!inner(number)
            `)
            .eq('visitor_id', visitor.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          formattedVisitors.push({
            ...visitor,
            apartment_number: logData?.apartments?.number || 'N/A',
            apartment_id: logData?.apartment_id || visitor.apartment_id || null,
            notification_status: visitor.status as Visitor['notification_status'] || 'pending',
            document: visitor.document || '',
            photo_url: visitor.photo_url || undefined
          });
        }
      }

      console.log('✅ fetchVisitors - Visitantes formatados:', formattedVisitors.length);
      console.log('📝 fetchVisitors - Dados dos visitantes:', formattedVisitors.map(v => ({ name: v.name, type: v.visitor_type, apt: v.apartment_number })));

      setVisitors(formattedVisitors as Visitor[]);
    } catch (error) {
      console.error('💥 fetchVisitors - Erro geral:', error);
      Alert.alert('Erro', 'Falha ao carregar visitantes');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchVisitors();
  }, [filter, fetchVisitors]);

  const handleVisitorAction = async (
    visitorId: string,
    action: 'aprovado' | 'negado' | 'entrada' | 'saida',
    notes?: string
  ) => {
    try {
      // Buscar dados completos do visitante
      const visitor = visitors.find((v) => v.id === visitorId);
      if (!visitor) {
        Alert.alert('Erro', 'Visitante não encontrado');
        return;
      }

      // Determinar o novo status baseado na ação e tipo de visitante
      let newStatus: 'pending' | 'approved' | 'rejected' | 'entrada' | 'saida' | 'aprovado' | 'nao_permitido';
      if (action === 'negado') {
        newStatus = 'nao_permitido';
      } else if (action === 'entrada') {
        // Para visitantes comuns, o status volta para 'pending' após entrada
        // Para visitantes frequentes, mantém o status 'aprovado' (permanente)
        if (visitor.visitor_type === 'comum') {
          newStatus = 'pending';
        } else if (visitor.visitor_type === 'frequente') {
          newStatus = 'aprovado'; // Mantém acesso permanente
        } else {
          newStatus = 'entrada';
        }
      } else if (action === 'aprovado') {
        newStatus = 'aprovado';
        
        // Enviar notificação para o morador quando visitante for aprovado
        try {
          if (!visitor.apartment_id) {
            console.warn('Visitante não possui apartment_id, não é possível enviar notificação');
            return;
          }

          // Buscar dados do apartamento e morador
          const { data: apartment, error: aptError } = await supabase
            .from('apartments')
            .select(`
              number,
              buildings(name),
              apartment_residents!inner(
                profile_id,
                profiles!inner(
                  phone,
                  full_name
                )
              )
            `)
            .eq('id', visitor.apartment_id)
            .single();

          if (!aptError && apartment) {
            const apartmentResidents = apartment.apartment_residents as Array<{
              profile_id: string;
              profiles: {
                phone: string | null;
                full_name: string | null;
              };
            }>;
            
            if (apartmentResidents && apartmentResidents.length > 0 && apartmentResidents[0]?.profiles) {
              const resident = apartmentResidents[0].profiles;
              const building = apartment.buildings as { name: string } | null;
            
              // Gerar um ID único para o log de visitante
              const visitSessionId = Crypto.randomUUID();
              
              await notificationApi.sendVisitorNotification({
                visitorLogId: visitSessionId,
                visitorName: visitor.name,
                residentPhone: resident.phone || '',
                residentName: resident.full_name || '',
                building: building?.name || 'Edifício',
                apartment: apartment.number
              });
              
              console.log('Notificação enviada com sucesso para o morador');
            }
          }
        } catch (notificationError) {
          console.error('Erro ao enviar notificação:', notificationError);
          // Não interromper o fluxo principal se a notificação falhar
        }
      } else if (action === 'saida') {
        newStatus = 'saida';
      } else {
        newStatus = 'pending';
      }

      // Update removido temporariamente - notification_status não existe na tabela visitors
      // TODO: Implementar update baseado nos logs de visitantes

      // Registrar no log com nova estrutura
      if (visitor && visitor.apartment_id) {
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
        let logStatus = 'authorized';

        if (action === 'aprovado' || action === 'entrada') {
          tipoLog = 'IN';
          // Para visitantes frequentes, usar status 'permanent'
          if (visitor.visitor_type === 'frequente') {
            logStatus = 'permanent';
          }
        } else if (action === 'saida') {
          tipoLog = 'OUT';
        }

        // Buscar o morador responsável pelo apartamento
        // Primeiro tenta buscar o proprietário (is_owner = true)
        let { data: apartmentResident, error: residentError } = await supabase
          .from('apartment_residents')
          .select('profile_id')
          .eq('apartment_id', visitor.apartment_id!)
          .eq('is_owner', true)
          .maybeSingle();

        // Se não encontrar proprietário, busca qualquer morador do apartamento
        if (!apartmentResident || residentError) {
          console.log('🔍 [handleVisitorAction - visitor.tsx] Proprietário não encontrado, buscando qualquer morador do apartamento');
          const result = await supabase
            .from('apartment_residents')
            .select('profile_id')
            .eq('apartment_id', visitor.apartment_id!)
            .limit(1)
            .maybeSingle();

          apartmentResident = result.data;
          residentError = result.error;
        }

        let residentId = null;

        if (apartmentResident && !residentError) {
          residentId = apartmentResident.profile_id;
          console.log(`✅ [handleVisitorAction - visitor.tsx] Morador encontrado (ID: ${residentId})`);
        } else {
          console.error('❌ [handleVisitorAction - visitor.tsx] Nenhum morador encontrado para apartment_id:', visitor.apartment_id);
        }

        // Só criar log se for entrada ou saída
        if (tipoLog && visitor.apartment_id) {
          const { error: logError } = await supabase.from('visitor_logs').insert({
            visitor_id: visitor.id,
            apartment_id: visitor.apartment_id,
            building_id: apartment.building_id,
            log_time: new Date().toISOString(),
            tipo_log: tipoLog,
            visit_session_id: visitSessionId,
            purpose: notes || 'Visita registrada pelo porteiro',
            resident_response_by: residentId, // ID do morador responsável
            notification_status: logStatus
          });

          if (logError) console.error('Erro ao registrar log:', logError);
        }
      }

      fetchVisitors();

      const actionMessages = {
        aprovado: 'Visitante aprovado com sucesso!',
        negado: 'Visitante negado',
        entrada: visitor.visitor_type === 'frequente' 
          ? 'Entrada registrada - Acesso permanente mantido' 
          : 'Entrada registrada - Status alterado para pendente',
        saida: 'Saída registrada',
      };

      Alert.alert('Sucesso', actionMessages[action]);
    } catch {
      Alert.alert('Erro', 'Falha ao processar ação');
    }
  };

  const searchExistingVisitor = async () => {
    if (!newVisitor.document.trim()) {
      Alert.alert('Erro', 'Digite o documento para consultar');
      return;
    }

    try {
      const { data: visitor, error } = await supabase
        .from('visitors')
        .select(`
          *,
          apartments!inner(number)
        `)
        .eq('document', newVisitor.document.trim())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (visitor) {
        const visitorData: Visitor = {
          ...visitor,
          apartment_number: visitor.apartments?.number || '',
          notification_status: visitor.status as Visitor['notification_status'] || 'pending',
          photo_url: visitor.photo_url || undefined,
          document: visitor.document || '',
          visitor_type: (visitor.visitor_type as 'comum' | 'frequente') || undefined
        };
        setExistingVisitor(visitorData);
        setShowExistingVisitorOptions(true);
        Alert.alert(
          'Visitante Encontrado',
          `${visitor.name} já está cadastrado no sistema.\n\nTipo: ${visitor.visitor_type === 'frequente' ? 'Visitante Frequente' : 'Visitante Comum'}\n\nDeseja usar este cadastro ou criar um novo?`,
          [
            { text: 'Usar Existente', onPress: () => handleUseExistingVisitor(visitorData) },
            { text: 'Criar Novo', onPress: () => setShowExistingVisitorOptions(false) },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Visitante Não Encontrado', 'Este documento não está cadastrado no sistema. Você pode prosseguir com o cadastro.');
        setExistingVisitor(null);
        setShowExistingVisitorOptions(false);
      }
    } catch {
      Alert.alert('Erro', 'Falha ao consultar visitante');
    }
  };

  const handleUseExistingVisitor = (visitor: Visitor) => {
    setNewVisitor({
      name: visitor.name,
      document: visitor.document || '',
      apartment_number: visitor.apartments?.number || '',
      notes: '',
      photo_uri: visitor.photo_url || null,
      visitor_type: visitor.visitor_type || 'comum',
    });
    setShowExistingVisitorOptions(false);
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

      // Se é um visitante existente, atualizar ao invés de inserir
      if (existingVisitor) {
        const { error: updateError } = await supabase
          .from('visitors')
          .update({
            name: newVisitor.name,
            apartment_id: apartment.id, // Adicionar apartment_id
            photo_url: photoUrl,
            visitor_type: newVisitor.visitor_type,
            status: 'aprovado', // Porteiro pode aprovar diretamente
          })
          .eq('id', existingVisitor.id);

        if (updateError) throw updateError;
        Alert.alert('Sucesso', 'Dados do visitante atualizados com sucesso!');
      } else {
        const { error: insertError } = await supabase.from('visitors').insert({
          name: newVisitor.name,
          document: newVisitor.document,
          apartment_id: apartment.id, // Adicionar apartment_id
          phone: null,
          photo_url: photoUrl,
          visitor_type: newVisitor.visitor_type,
          status: 'aprovado', // Porteiro pode aprovar diretamente
          access_type: 'com_aprovacao', // Tipo de acesso padrão
        });

        if (insertError) throw insertError;
        Alert.alert('Sucesso', 'Visitante registrado com sucesso!');
      }

      setNewVisitor({
        name: '',
        document: '',
        apartment_number: '',
        notes: '',
        photo_uri: null,
        visitor_type: 'comum',
      });
      setExistingVisitor(null);
      setShowExistingVisitorOptions(false);
      setShowAddForm(false);
      fetchVisitors();
    } catch {
      Alert.alert('Erro', 'Falha ao processar visitante');
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erro', 'Permissão de câmera necessária');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: MediaTypeOptions.Images,
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
    // TODO: Implementar contagem baseada nos logs de visitantes
    return 0;
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
                { key: 'pending', label: 'Pendentes', icon: '⏳' },
                { key: 'approved', label: 'Aprovados', icon: '✅' },
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

            <View style={styles.searchSection}>
              <TextInput
                style={styles.input}
                placeholder="Digite o documento para consultar"
                value={newVisitor.document}
                onChangeText={(text) => setNewVisitor((prev) => ({ ...prev, document: text }))}
              />
              <TouchableOpacity style={styles.searchButton} onPress={searchExistingVisitor}>
                <Text style={styles.searchButtonText}>🔍 Consultar</Text>
              </TouchableOpacity>
            </View>

            {existingVisitor && (
              <View style={styles.existingVisitorInfo}>
                <Text style={styles.existingVisitorTitle}>✅ Visitante Encontrado:</Text>
                <Text style={styles.existingVisitorName}>{existingVisitor.name}</Text>
                <Text style={styles.existingVisitorType}>
                  Tipo: {existingVisitor.visitor_type === 'frequente' ? 'Visitante Frequente' : 'Visitante Comum'}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Nome completo do visitante"
              value={newVisitor.name}
              onChangeText={(text) => setNewVisitor((prev) => ({ ...prev, name: text }))}
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

            <View style={styles.visitorTypeSection}>
              <Text style={styles.sectionTitle}>Tipo de Visitante:</Text>
              <View style={styles.visitorTypeButtons}>
                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    newVisitor.visitor_type === 'comum' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() => setNewVisitor((prev) => ({ ...prev, visitor_type: 'comum' }))}>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      newVisitor.visitor_type === 'comum' && styles.visitorTypeButtonTextActive,
                    ]}>
                    👤 Comum
                  </Text>
                  <Text style={styles.visitorTypeDescription}>
                    Status volta para &quot;pendente&quot; após cada entrada
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.visitorTypeButton,
                    newVisitor.visitor_type === 'frequente' && styles.visitorTypeButtonActive,
                  ]}
                  onPress={() => setNewVisitor((prev) => ({ ...prev, visitor_type: 'frequente' }))}>
                  <Text
                    style={[
                      styles.visitorTypeButtonText,
                      newVisitor.visitor_type === 'frequente' && styles.visitorTypeButtonTextActive,
                    ]}>
                    ⭐ Frequente
                  </Text>
                  <Text style={styles.visitorTypeDescription}>
                    Mantém acesso permanente após autorização
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

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
                visitor={{
                  ...visitor,
                  document: visitor.document || '',
                  apartment_number: visitor.apartment_number || 'N/A',
                  notification_status: (visitor.notification_status === 'aprovado' ? 'approved' : 
                                       visitor.notification_status === 'nao_permitido' ? 'rejected' :
                                       visitor.notification_status) as 'pending' | 'approved' | 'rejected' | 'entrada' | 'saida' || 'pending'
                }}
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
  searchSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  searchButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  existingVisitorInfo: {
    backgroundColor: '#E8F5E8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  existingVisitorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  existingVisitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  existingVisitorType: {
    fontSize: 14,
    color: '#666',
  },
  visitorTypeSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  visitorTypeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  visitorTypeButton: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  visitorTypeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  visitorTypeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  visitorTypeButtonTextActive: {
    color: '#2196F3',
  },
  visitorTypeDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});
