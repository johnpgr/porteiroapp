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
import { Container } from '~/components/Container';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';

interface Delivery {
  id: string;
  recipient_name: string;
  apartment_id: string;
  sender: string;
  description: string;
  photo_url?: string;
  status: 'recebida' | 'entregue';
  received_by?: string;
  delivered_by?: string;
  delivered_at?: string;
  notes?: string;
  created_at: string;
  apartments?: {
    number: string;
  };
}

export default function DeliveryManagement() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'recebida' | 'entregue'>('recebida');
  const [newDelivery, setNewDelivery] = useState({
    recipient_name: '',
    apartment_number: '',
    sender: '',
    description: '',
    notes: '',
    photo_uri: null as string | null,
  });

  useEffect(() => {
    fetchDeliveries();
  }, [filter, fetchDeliveries]);

  const fetchDeliveries = useCallback(async () => {
    try {
      let query = supabase
        .from('deliveries')
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

      const formattedDeliveries =
        data?.map((delivery) => ({
          ...delivery,
          apartment_number: delivery.apartments?.number || 'N/A',
        })) || [];

      setDeliveries(formattedDeliveries);
    } catch {
      Alert.alert('Erro', 'Falha ao carregar encomendas');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleDeliveryAction = async (deliveryId: string, action: 'entregue', notes?: string) => {
    try {
      await supabase
        .from('deliveries')
        .update({
          status: action,
          delivered_by: 'Porteiro', // TODO: pegar do contexto de auth
          delivered_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', deliveryId);

      if (error) throw error;

      fetchDeliveries();
      Alert.alert('Sucesso', 'Encomenda marcada como entregue!');
    } catch {
      Alert.alert('Erro', 'Falha ao marcar encomenda como entregue');
    }
  };

  const handleAddDelivery = async () => {
    if (!newDelivery.recipient_name || !newDelivery.apartment_number || !newDelivery.sender) {
      Alert.alert('Erro', 'Nome do destinatário, apartamento e remetente são obrigatórios');
      return;
    }

    try {
      // Buscar apartamento
      const { data: apartment, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('number', newDelivery.apartment_number)
        .single();

      if (aptError || !apartment) {
        Alert.alert('Erro', 'Apartamento não encontrado');
        return;
      }

      let photoUrl = null;
      if (newDelivery.photo_uri) {
        // TODO: Upload da foto para Supabase Storage
        // Por enquanto, usar a URI local
        photoUrl = newDelivery.photo_uri;
      }

      const { error } = await supabase.from('deliveries').insert({
        recipient_name: newDelivery.recipient_name,
        apartment_id: apartment.id,
        sender: newDelivery.sender,
        description: newDelivery.description || null,
        photo_url: photoUrl,
        status: 'recebida',
        received_by: 'Porteiro', // TODO: pegar do contexto de auth
        notes: newDelivery.notes || null,
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Encomenda registrada com sucesso!');
      setNewDelivery({
        recipient_name: '',
        apartment_number: '',
        sender: '',
        description: '',
        notes: '',
        photo_uri: null,
      });
      setShowAddForm(false);
      fetchDeliveries();
    } catch {
      Alert.alert('Erro', 'Falha ao registrar encomenda');
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
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewDelivery((prev) => ({ ...prev, photo_uri: result.assets[0].uri }));
    }
  };

  const getFilterCount = (filterType: string) => {
    if (filterType === 'all') return deliveries.length;
    return deliveries.filter((d) => d.status === filterType).length;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Manual date formatting to avoid Hermes locale issues
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const DeliveryCard = ({ delivery }: { delivery: Delivery }) => {
    const handleDeliver = () => {
      if (delivery.status === 'entregue') return;

      Alert.prompt(
        'Entregar Encomenda',
        'Adicione observações sobre a entrega (opcional):',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Entregar',
            onPress: (notes) => handleDeliveryAction(delivery.id, 'entregue', notes),
          },
        ],
        'plain-text'
      );
    };

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.deliveryHeader}>
          <View style={styles.deliveryInfo}>
            <Text style={styles.recipientName}>📦 {delivery.recipient_name}</Text>
            <Text style={styles.apartmentNumber}>Apto {delivery.apartment_number}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              delivery.status === 'entregue' ? styles.statusDelivered : styles.statusReceived,
            ]}>
            <Text style={styles.statusText}>
              {delivery.status === 'entregue' ? '✅ Entregue' : '📥 Recebida'}
            </Text>
          </View>
        </View>

        <View style={styles.deliveryDetails}>
          <Text style={styles.detailLabel}>Remetente:</Text>
          <Text style={styles.detailValue}>{delivery.sender}</Text>
        </View>

        {delivery.description && (
          <View style={styles.deliveryDetails}>
            <Text style={styles.detailLabel}>Descrição:</Text>
            <Text style={styles.detailValue}>{delivery.description}</Text>
          </View>
        )}

        <View style={styles.deliveryDetails}>
          <Text style={styles.detailLabel}>Recebida em:</Text>
          <Text style={styles.detailValue}>{formatDate(delivery.created_at)}</Text>
        </View>

        {delivery.delivered_at && (
          <View style={styles.deliveryDetails}>
            <Text style={styles.detailLabel}>Entregue em:</Text>
            <Text style={styles.detailValue}>{formatDate(delivery.delivered_at)}</Text>
          </View>
        )}

        {delivery.notes && (
          <View style={styles.deliveryDetails}>
            <Text style={styles.detailLabel}>Observações:</Text>
            <Text style={styles.detailValue}>{delivery.notes}</Text>
          </View>
        )}

        {delivery.photo_url && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: delivery.photo_url }} style={styles.deliveryPhoto} />
          </View>
        )}

        {delivery.status === 'recebida' && (
          <TouchableOpacity style={styles.deliverButton} onPress={handleDeliver}>
            <Text style={styles.deliverButtonText}>✅ Marcar como Entregue</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📦 Gerenciar Encomendas</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addButtonText}>
              {showAddForm ? '❌ Cancelar' : '➕ Registrar Encomenda'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {[
                { key: 'recebida', label: 'Recebidas', icon: '📥' },
                { key: 'entregue', label: 'Entregues', icon: '✅' },
                { key: 'all', label: 'Todas', icon: '📋' },
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
            <Text style={styles.formTitle}>Registrar Nova Encomenda</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome do destinatário"
              value={newDelivery.recipient_name}
              onChangeText={(text) => setNewDelivery((prev) => ({ ...prev, recipient_name: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Número do apartamento"
              value={newDelivery.apartment_number}
              onChangeText={(text) =>
                setNewDelivery((prev) => ({ ...prev, apartment_number: text }))
              }
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Remetente (empresa/pessoa)"
              value={newDelivery.sender}
              onChangeText={(text) => setNewDelivery((prev) => ({ ...prev, sender: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Descrição da encomenda (opcional)"
              value={newDelivery.description}
              onChangeText={(text) => setNewDelivery((prev) => ({ ...prev, description: text }))}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações (opcional)"
              value={newDelivery.notes}
              onChangeText={(text) => setNewDelivery((prev) => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={3}
            />

            <View style={styles.photoSection}>
              <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                <Text style={styles.photoButtonText}>📷 Tirar Foto da Encomenda</Text>
              </TouchableOpacity>

              {newDelivery.photo_uri && (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: newDelivery.photo_uri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => setNewDelivery((prev) => ({ ...prev, photo_uri: null }))}>
                    <Text style={styles.removePhotoText}>❌</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddDelivery}>
              <Text style={styles.submitButtonText}>✅ Registrar Encomenda</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.deliveriesList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando encomendas...</Text>
            </View>
          ) : deliveries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Nenhuma encomenda encontrada</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all'
                  ? 'Ainda não há encomendas registradas'
                  : `Nenhuma encomenda com status "${filter}" encontrada`}
              </Text>
            </View>
          ) : (
            deliveries.map((delivery) => <DeliveryCard key={delivery.id} delivery={delivery} />)
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
    width: 160,
    height: 120,
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
  deliveriesList: {
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
  deliveryCard: {
    backgroundColor: '#fff',
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  apartmentNumber: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusReceived: {
    backgroundColor: '#FFF3CD',
  },
  statusDelivered: {
    backgroundColor: '#D4EDDA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveryDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  deliveryPhoto: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  deliverButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  deliverButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
