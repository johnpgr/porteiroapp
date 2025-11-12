import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { supabase } from '~/utils/supabase';
import { supabaseAdmin } from '~/utils/supabase-admin';
import { adminAuth } from '~/utils/supabase';
import type { Tables } from '@porteiroapp/common/supabase';

type ProfileRow = Tables<'profiles'>;
type BuildingRow = Tables<'buildings'>;

type ProfileWithApartments = Pick<
  ProfileRow,
  'id' | 'full_name' | 'phone' | 'email' | 'cpf' | 'created_at' | 'building_id'
> & {
  role: 'admin' | 'porteiro' | 'morador';
  apartments?: {
    apartment?: {
      id: string;
      number: string;
      building_id: string;
    };
  }[];
};

export default function UsersModal() {
  const [users, setUsers] = useState<ProfileWithApartments[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userListFilter, setUserListFilter] = useState<'morador' | 'porteiro'>('morador');
  const [buildingFilter, setBuildingFilter] = useState<string | null>(null);

  const fetchBuildings = useCallback(async () => {
    try {
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        return;
      }
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      setBuildings(adminBuildings || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (adminError || !adminProfile) {
        console.error('Erro ao obter perfil do admin:', adminError);
        setUsers([]);
        return;
      }

      const { data: buildingAdmins, error: buildingAdminsError } = await supabase
        .from('building_admins')
        .select('building_id')
        .eq('admin_profile_id', adminProfile.id);

      if (buildingAdminsError) {
        console.error('Erro ao carregar prédios do admin:', buildingAdminsError);
        setUsers([]);
        return;
      }

      if (!buildingAdmins || buildingAdmins.length === 0) {
        setUsers([]);
        return;
      }

      const managedBuildingIds = buildingAdmins.map((ba) => ba.building_id);

      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          role,
          phone,
          email,
          cpf,
          created_at,
          building_id,
          apartments:apartment_residents(
            apartment:apartments(
              id,
              number,
              building_id
            )
          )
        `
        )
        .in('role', ['morador', 'porteiro'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar usuários:', error);
        Alert.alert('Erro', 'Falha ao carregar usuários.');
        setUsers([]);
        return;
      }

      const filteredUsers = (data || []).filter((profile) => {
        if (profile.role === 'porteiro') {
          return profile.building_id && managedBuildingIds.includes(profile.building_id);
        }

        if (profile.role === 'morador') {
          return (
            profile.apartments &&
            profile.apartments.some(
              (apt) => apt.apartment && managedBuildingIds.includes(apt.apartment.building_id)
            )
          );
        }

        return false;
      });

      const typedUsers: ProfileWithApartments[] = filteredUsers.map((profile) => ({
        ...profile,
        role: (profile.role || 'morador') as ProfileWithApartments['role'],
      }));

      setUsers(typedUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários do admin:', error);
      Alert.alert('Erro', 'Falha ao carregar usuários. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteUser = useCallback(
    (userId: string, userName: string) => {
      Alert.alert('Confirmar Exclusão', `Deseja excluir o usuário ${userName}?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: apartmentError } = await supabase
                .from('apartment_residents')
                .delete()
                .eq('profile_id', userId);

              if (apartmentError) throw apartmentError;

              const { data: profileData } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('id', userId)
                .single();

              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

              if (profileError) throw profileError;

              if (profileData?.user_id) {
                try {
                  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
                    profileData.user_id
                  );

                  if (authError) {
                    console.error('Erro ao remover usuário da auth.users:', authError);
                  }
                } catch (authError) {
                  console.error('Erro ao deletar usuário do auth:', authError);
                }
              }

              await loadUsers();
              Alert.alert('Sucesso', 'Usuário excluído com sucesso!');
            } catch (error) {
              console.error('Erro na exclusão do usuário:', error);
              Alert.alert('Erro', 'Falha ao excluir usuário. Tente novamente.');
            }
          },
        },
      ]);
    },
    [loadUsers]
  );

  useFocusEffect(
    useCallback(() => {
      fetchBuildings();
      loadUsers();
    }, [fetchBuildings, loadUsers])
  );

  const filteredUsers = users.filter((user) => {
    if (user.role !== userListFilter) return false;

    if (user.role === 'morador') {
      const hasValidApartment =
        user.apartments &&
        user.apartments.some((apt) => buildings.some((b) => b.id === apt.apartment?.building_id));

      if (!hasValidApartment) return false;
      if (buildingFilter) {
        return (
          user.apartments?.some((apt) => apt.apartment?.building_id === buildingFilter) || false
        );
      }
      return true;
    }

    if (user.role === 'porteiro') {
      const isInAdminBuildings = buildings.some((building) => building.id === user.building_id);
      if (!isInAdminBuildings) return false;
      if (buildingFilter) {
        return user.building_id === buildingFilter;
      }
      return true;
    }

    return false;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerTitle}>📋 Usuários Cadastrados</Text>
          <Text style={styles.headerSubtitle}>Filtre moradores e porteiros facilmente</Text>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Carregando usuários...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, userListFilter === 'morador' && styles.toggleButtonActive]}
              onPress={() => setUserListFilter('morador')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  userListFilter === 'morador' && styles.toggleButtonTextActive,
                ]}>
                🏠 Moradores
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, userListFilter === 'porteiro' && styles.toggleButtonActive]}
              onPress={() => setUserListFilter('porteiro')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  userListFilter === 'porteiro' && styles.toggleButtonTextActive,
                ]}>
                🛡️ Porteiros
              </Text>
            </TouchableOpacity>
          </View>

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
                    🏢 {building.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filteredUsers.length === 0 ? (
            <View style={styles.emptyListState}>
              <Text style={styles.emptyListIcon}>{userListFilter === 'morador' ? '🏠' : '🛡️'}</Text>
              <Text style={styles.emptyListText}>
                {buildingFilter
                  ? `Nenhum ${userListFilter} cadastrado neste prédio`
                  : `Nenhum ${userListFilter} cadastrado ainda`}
              </Text>
            </View>
          ) : (
            filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userCardInfo}>
                  <Text style={styles.userIcon}>{user.role === 'morador' ? '🏠' : '🛡️'}</Text>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.full_name}</Text>
                    {user.phone && <Text style={styles.userDetail}>📞 {user.phone}</Text>}
                    {user.email && <Text style={styles.userDetail}>📧 {user.email}</Text>}
                    {user.cpf && <Text style={styles.userDetail}>🆔 {user.cpf}</Text>}
                    {user.apartments && user.apartments.length > 0 && (
                      <Text style={styles.userDetail}>
                        🏠 Apartamentos:{' '}
                        {user.apartments
                          ?.filter((apt) =>
                            buildings.some((building) => building.id === apt.apartment?.building_id)
                          )
                          .map((apt) => apt.apartment?.number)
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    )}
                    <Text style={styles.userDetail}>
                      📅 Cadastrado em: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteUser(user.id, user.full_name || 'Usuário')}>
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            ))
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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 6,
    gap: 8,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FFE0B2',
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  toggleButtonTextActive: {
    color: '#E65100',
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
  emptyListState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyListIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyListText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userCardInfo: {
    flexDirection: 'row',
  },
  userIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 2,
  },
  deleteButton: {
    marginTop: 12,
    backgroundColor: '#F87171',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

