import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { Ionicons } from '@expo/vector-icons';
import { supabase, adminAuth } from '~/utils/supabase';
import type { Tables } from '@porteiroapp/supabase';

type BuildingRow = Tables<'buildings'>;
type VehicleRow = Tables<'vehicles'>;

type VehicleWithRelations = Pick<
  VehicleRow,
  'id' | 'license_plate' | 'model' | 'color' | 'brand' | 'type' | 'apartment_id' | 'created_at'
> & {
  apartments?: {
    id: string;
    number: string;
    building_id: string;
    buildings?: {
      name: string;
    };
  } | null;
};

const formatLicensePlate = (input: string): string => {
  const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleanInput.length <= 3) return cleanInput;
  if (cleanInput.length <= 7) {
    const letters = cleanInput.slice(0, 3);
    const remaining = cleanInput.slice(3);
    return `${letters}-${remaining}`;
  }
  return cleanInput;
};

const getVehicleTypeInfo = (type?: string | null) => {
  switch (type) {
    case 'car':
      return { icon: 'car-sport', color: '#4CAF50', label: 'Carro' };
    case 'motorcycle':
      return { icon: 'bicycle', color: '#FF9800', label: 'Moto' };
    case 'truck':
      return { icon: 'car', color: '#795548', label: 'Caminhão' };
    case 'van':
      return { icon: 'bus', color: '#2196F3', label: 'Van' };
    case 'bus':
      return { icon: 'bus-outline', color: '#9C27B0', label: 'Ônibus' };
    default:
      return { icon: 'car-outline', color: '#607D8B', label: 'Outro' };
  }
};

export default function VehiclesModal() {
  const [vehicles, setVehicles] = useState<VehicleWithRelations[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBuildings = useCallback(async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) return;
      const managedBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      setBuildings(managedBuildings || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        setVehicles([]);
        setLoading(false);
        return;
      }

      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const managedBuildingIds = adminBuildings?.map((building) => building.id) || [];

      const { data, error } = await supabase
        .from('vehicles')
        .select(
          `
          id,
          license_plate,
          model,
          color,
          brand,
          type,
          created_at,
          apartment_id,
          apartments(
            id,
            number,
            building_id,
            buildings(name)
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
            setLoading(false);
        console.error('Erro ao carregar veículos:', error);
        return;
      }

      const filteredVehicles = (data || []).filter((vehicle) => {
        if (vehicle.apartments && vehicle.apartments.building_id) {
          return managedBuildingIds.includes(vehicle.apartments.building_id);
        }
        return false;
      });

      setVehicles(filteredVehicles as VehicleWithRelations[]);
    } catch (error) {
      console.error('Erro ao carregar veículos do admin:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBuildings();
      loadVehicles();
    }, [fetchBuildings, loadVehicles])
  );

  const filteredVehicles = vehicles.filter(
    (vehicle) => !buildingFilter || vehicle.apartments?.building_id === buildingFilter
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>🚙 Veículos Cadastrados</Text>
          <Text style={styles.headerSubtitle}>Gerencie os veículos por prédio</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Carregando veículos...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.buildingFilterContainer}>
            <Text style={styles.buildingFilterLabel}>Filtrar por prédio:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.buildingFilterScroll}>
              <TouchableOpacity
                style={[
                  styles.buildingFilterButton,
                  buildingFilter === null && styles.buildingFilterButtonActive,
                ]}
                onPress={() => setBuildingFilter(null)}>
                <Text
                  style={[
                    styles.buildingFilterButtonText,
                    buildingFilter === null && styles.buildingFilterButtonTextActive,
                  ]}>
                  🏢 Todos
                </Text>
              </TouchableOpacity>
              {buildings.map((building) => (
                <TouchableOpacity
                  key={building.id}
                  style={[
                    styles.buildingFilterButton,
                    buildingFilter === building.id && styles.buildingFilterButtonActive,
                  ]}
                  onPress={() => setBuildingFilter(building.id)}>
                  <Text
                    style={[
                      styles.buildingFilterButtonText,
                      buildingFilter === building.id && styles.buildingFilterButtonTextActive,
                    ]}>
                    {building.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filteredVehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={56} color="#cbd5f5" />
              <Text style={styles.emptyTitle}>Nenhum veículo encontrado</Text>
              <Text style={styles.emptyText}>
                {buildingFilter
                  ? 'Não há veículos cadastrados neste prédio.'
                  : 'Cadastre um veículo para começar.'}
              </Text>
            </View>
          ) : (
            filteredVehicles.map((vehicle) => {
              const vehicleInfo = getVehicleTypeInfo(vehicle.type);
              const buildingName =
                vehicle.apartments?.buildings?.name ||
                buildings.find((b) => b.id === vehicle.apartments?.building_id)?.name ||
                'Sem prédio';

              return (
                <View key={vehicle.id} style={styles.vehicleCard}>
                  <View style={styles.vehicleHeader}>
                    <View
                      style={[
                        styles.vehicleIconContainer,
                        { backgroundColor: `${vehicleInfo.color}15` },
                      ]}>
                      <Ionicons
                        name={vehicleInfo.icon as any}
                        size={22}
                        color={vehicleInfo.color}
                      />
                    </View>
                    <View style={styles.vehicleHeaderInfo}>
                      <Text style={styles.vehiclePlate}>
                        {formatLicensePlate(vehicle.license_plate)}
                      </Text>
                      <Text style={styles.vehicleType}>{vehicleInfo.label}</Text>
                    </View>
                    <Text style={styles.vehicleStatus}>Ativo</Text>
                  </View>

                  <View style={styles.vehicleBody}>
                    <View style={styles.vehicleInfoRow}>
                      <Ionicons name="car-outline" size={16} color="#64748b" />
                      <Text style={styles.vehicleInfoLabel}>Modelo</Text>
                      <Text style={styles.vehicleInfoValue}>
                        {vehicle.brand ? `${vehicle.brand} ${vehicle.model || ''}` : vehicle.model || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.vehicleInfoRow}>
                      <Ionicons name="color-palette-outline" size={16} color="#64748b" />
                      <Text style={styles.vehicleInfoLabel}>Cor</Text>
                      <Text style={styles.vehicleInfoValue}>{vehicle.color || 'N/A'}</Text>
                    </View>
                    <View style={styles.vehicleInfoRow}>
                      <Ionicons name="business-outline" size={16} color="#64748b" />
                      <Text style={styles.vehicleInfoLabel}>Prédio</Text>
                      <Text style={styles.vehicleInfoValue}>{buildingName}</Text>
                    </View>
                    <View style={styles.vehicleInfoRow}>
                      <Ionicons name="time-outline" size={16} color="#64748b" />
                      <Text style={styles.vehicleInfoLabel}>Cadastrado em</Text>
                      <Text style={styles.vehicleInfoValue}>
                        {new Date(vehicle.created_at).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTextContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4b5563',
  },
  content: {
    padding: 20,
  },
  buildingFilterContainer: {
    marginBottom: 20,
  },
  buildingFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  buildingFilterScroll: {
    flexGrow: 0,
  },
  buildingFilterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  buildingFilterButtonActive: {
    backgroundColor: '#FFE0B2',
    borderColor: '#FDBA74',
  },
  buildingFilterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  buildingFilterButtonTextActive: {
    color: '#C2410C',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  vehicleHeaderInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  vehicleType: {
    fontSize: 13,
    color: '#6b7280',
  },
  vehicleStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  vehicleBody: {
    gap: 8,
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleInfoLabel: {
    fontSize: 13,
    color: '#6b7280',
    minWidth: 80,
  },
  vehicleInfoValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
});

