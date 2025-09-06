'use client';

import { useAuth } from '@/utils/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Edit, Trash2, Building, Phone, Mail, Home, Eye, EyeOff } from 'lucide-react';

interface ResidentData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  apartment: string;
  building_id: string;
  is_active: boolean;
  created_at: string;
  building?: {
    name: string;
  };
}

interface SupabaseResidentItem {
  id: string;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  apartments?: {
    number?: string;
    building_id?: string;
    buildings?: {
      name?: string;
    };
  };
}

interface BuildingOption {
  id: string;
  name: string;
}

export default function ResidentManagement() {
  const { user, isSuperAdmin, isAdmin, requireAuth } = useAuth();
  const [residents, setResidents] = useState<ResidentData[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingResident, setEditingResident] = useState<ResidentData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    apartment: '',
    building_id: '',
    password: '',
    is_active: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadBuildings = useCallback(async () => {
    try {
      let query = supabase
        .from('buildings')
        .select('id, name')
        .order('name');

      // Se não for super admin, mostrar apenas o prédio do admin
      if (!isSuperAdmin() && user?.building_id) {
        query = query.eq('id', user.building_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBuildings(data || []);

      // Se admin regular, definir automaticamente o building_id
      if (!isSuperAdmin() && user?.building_id) {
        setFormData(prev => ({ ...prev, building_id: user.building_id || '' }));
      }
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  }, [isSuperAdmin, user?.building_id]);

  const loadResidents = useCallback(async () => {
    try {
      let query = supabase
        .from('apartment_residents')
        .select(`
          id,
          created_at,
          relationship,
          profiles!apartment_residents_profile_id_fkey(
            id,
            full_name,
            email,
            phone
          ),
          apartments!apartment_residents_apartment_id_fkey(
            id,
            number,
            building_id,
            buildings(
              id,
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Se não for super admin, mostrar apenas moradores do prédio do admin
      if (!isSuperAdmin() && user?.building_id) {
        query = query.eq('apartments.building_id', user.building_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform the data to match ResidentData interface
      const transformedData: ResidentData[] = (data || []).map((item: SupabaseResidentItem) => ({
        id: item.id,
        name: item.profiles?.full_name || '',
        email: item.profiles?.email || '',
        phone: item.profiles?.phone || '',
        apartment: item.apartments?.number || '',
        building_id: item.apartments?.building_id || '',
        is_active: true, // Default value
        created_at: item.created_at,
        building: {
          name: item.apartments?.buildings?.name || ''
        }
      }));
      
      setResidents(transformedData);
    } catch (error) {
      console.error('Erro ao carregar moradores:', error);
      setError('Erro ao carregar moradores');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, user?.building_id]);

  // Carregar dados iniciais
  useEffect(() => {
    requireAuth();
    if (!isAdmin()) {
      window.location.href = '/login';
      return;
    }
    loadBuildings();
    loadResidents();
  }, [isAdmin, loadBuildings, loadResidents, requireAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingResident) {
        // Atualizar morador existente - apenas campos válidos da tabela
        const updateData = {
          relationship: 'resident'
        };

        const { error } = await supabase
          .from('apartment_residents')
          .update(updateData)
          .eq('id', editingResident.id);

        if (error) throw error;
        setSuccess('Morador atualizado com sucesso!');
      } else {
        // Criar novo morador
        // Primeiro criar o usuário na autenticação
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              user_type: 'resident'
            }
          }
        });

        if (authError) throw authError;

        // Depois criar o perfil do morador
        if (!authData.user?.id) {
          throw new Error('Usuário não autenticado');
        }

        const { error: insertError } = await supabase
           .from('apartment_residents')
           .insert({
             profile_id: authData.user.id,
             apartment_id: formData.apartment,
             relationship: 'resident'
           });

        if (insertError) throw insertError;
        setSuccess('Morador criado com sucesso!');
      }

      setFormData({
        name: '',
        email: '',
        phone: '',
        apartment: '',
        building_id: !isSuperAdmin() && user?.building_id ? user.building_id : '',
        password: '',
        is_active: true
      });
      setShowCreateForm(false);
      setEditingResident(null);
      loadResidents();
    } catch (err: unknown) {
      console.error('Erro ao salvar morador:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar morador');
    }
  };

  const handleEdit = (resident: ResidentData) => {
    setEditingResident(resident);
    setFormData({
      name: resident.name,
      email: resident.email,
      phone: resident.phone || '',
      apartment: resident.apartment,
      building_id: resident.building_id,
      password: '',
      is_active: resident.is_active
    });
    setShowCreateForm(true);
  };

  const handleToggleActive = async () => {
    // Funcionalidade temporariamente desabilitada
    setError('Funcionalidade de ativar/desativar temporariamente indisponível.');
  };

  const handleDelete = async (resident: ResidentData) => {
    if (!confirm(`Tem certeza que deseja excluir o morador "${resident.name}"?`)) {
      return;
    }

    try {
      // Primeiro deletar o perfil
      const { error: profileError } = await supabase
        .from('apartment_residents')
        .delete()
        .eq('id', resident.id);

      if (profileError) throw profileError;

      // Depois deletar o usuário da autenticação (apenas super admin pode fazer isso)
      if (isSuperAdmin()) {
        const { error: authError } = await supabase.auth.admin.deleteUser(resident.id);
        if (authError) console.warn('Erro ao deletar usuário da autenticação:', authError);
      }

      setSuccess('Morador excluído com sucesso!');
      loadResidents();
    } catch (error: unknown) {
      console.error('Erro ao excluir morador:', error);
      setError('Erro ao excluir morador');
    }
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingResident(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      apartment: '',
      building_id: !isSuperAdmin() && user?.building_id ? user.building_id : '',
      password: '',
      is_active: true
    });
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Gerenciar Moradores</h1>
                  <p className="text-green-100">
                    {isSuperAdmin() ? 'Painel do Super Administrador' : 'Painel do Administrador'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Morador</span>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingResident ? 'Editar Morador' : 'Novo Morador'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    disabled={!!editingResident}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apartamento</label>
                  <input
                    type="text"
                    value={formData.apartment}
                    onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    placeholder="Ex: 101, 201A, Cobertura"
                  />
                </div>
                {isSuperAdmin() && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prédio</label>
                    <select
                      value={formData.building_id}
                      onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione um prédio</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!editingResident && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Morador ativo
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {editingResident ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Residents List */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Morador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Apartamento
                  </th>
                  {isSuperAdmin() && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prédio
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {residents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Users className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{resident.name}</div>
                          <div className="text-sm text-gray-500">{resident.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {resident.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-1 text-gray-400" />
                            {resident.phone}
                          </div>
                        )}
                        <div className="flex items-center mt-1">
                          <Mail className="h-4 w-4 mr-1 text-gray-400" />
                          {resident.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Home className="h-4 w-4 mr-1 text-gray-400" />
                        {resident.apartment}
                      </div>
                    </td>
                    {isSuperAdmin() && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Building className="h-4 w-4 mr-1 text-gray-400" />
                          {resident.building?.name}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        resident.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {resident.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(resident)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive()}
                          className={`${resident.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {resident.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        {isSuperAdmin() && (
                          <button
                            onClick={() => handleDelete(resident)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {residents.length === 0 && (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum morador encontrado</h3>
              <p className="text-gray-500 mb-4">Comece cadastrando o primeiro morador.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Morador
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}