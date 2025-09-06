'use client';

import { useAuth } from '@/utils/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Building, Plus, Edit, Trash2, Users, MapPin, Phone, Mail } from 'lucide-react';

interface BuildingData {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  created_at: string;
  _count?: {
    residents: number;
    admins: number;
  };
}



export default function BuildingManagement() {
  const { user, isSuperAdmin, isAdmin, requireAuth } = useAuth();
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadBuildings = useCallback(async () => {
    try {
      let query = supabase
        .from('buildings')
        .select('*')
        .order('created_at', { ascending: false });

      // Se não for super admin, mostrar apenas o prédio do admin
      if (!isSuperAdmin() && user?.building_id) {
        query = query.eq('id', user.building_id);
      }

      const { data: buildingsData, error } = await query;

      if (error) throw error;

      // Carregar contadores de moradores e admins para cada prédio
      const buildingsWithCounts = await Promise.all(
        (buildingsData || []).map(async (building) => {
          // Contar moradores
          const { count: residentsCount } = await supabase
            .from('apartment_residents')
            .select('*', { count: 'exact', head: true })
            .eq('building_id', building.id);

          // Contar admins
          const { count: adminsCount } = await supabase
            .from('admin_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('building_id', building.id)
            .eq('is_active', true);

          return {
            ...building,
            _count: {
              residents: residentsCount || 0,
              admins: adminsCount || 0
            }
          };
        })
      );

      setBuildings(buildingsWithCounts);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
      setError('Erro ao carregar prédios');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, user?.building_id]);

  useEffect(() => {
    requireAuth();
    if (!isAdmin()) {
      window.location.href = '/login';
      return;
    }
    loadBuildings();
  }, [isAdmin, loadBuildings, requireAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingBuilding) {
        // Atualizar prédio existente
        const { error } = await supabase
          .from('buildings')
          .update({
            name: formData.name,
            address: formData.address,
            phone: formData.phone || null,
            email: formData.email || null
          })
          .eq('id', editingBuilding.id);

        if (error) throw error;
        setSuccess('Prédio atualizado com sucesso!');
      } else {
        // Criar novo prédio
        const { error } = await supabase
          .from('buildings')
          .insert({
            name: formData.name,
            address: formData.address,
            phone: formData.phone || null,
            email: formData.email || null
          });

        if (error) throw error;
        setSuccess('Prédio criado com sucesso!');
      }

      setFormData({
        name: '',
        address: '',
        phone: '',
        email: ''
      });
      setShowCreateForm(false);
      setEditingBuilding(null);
      loadBuildings();
    } catch (error: unknown) {
      console.error('Erro ao salvar prédio:', error);
      setError(error instanceof Error ? error.message : 'Erro ao salvar prédio');
    }
  };

  const handleEdit = (building: BuildingData) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      phone: building.phone || '',
      email: building.email || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (building: BuildingData) => {
    if (!confirm(`Tem certeza que deseja excluir o prédio "${building.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('buildings')
        .delete()
        .eq('id', building.id);

      if (error) throw error;
      setSuccess('Prédio excluído com sucesso!');
      loadBuildings();
    } catch (error: unknown) {
      console.error('Erro ao excluir prédio:', error);
      setError('Erro ao excluir prédio. Verifique se não há moradores ou admins associados.');
    }
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingBuilding(null);
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: ''
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
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Building className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Gerenciar Prédios</h1>
                  <p className="text-blue-100">
                    {isSuperAdmin() ? 'Painel do Super Administrador' : 'Painel do Administrador'}
                  </p>
                </div>
              </div>
              {isSuperAdmin() && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Prédio</span>
                </button>
              )}
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
        {showCreateForm && isSuperAdmin() && (
          <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBuilding ? 'Editar Prédio' : 'Novo Prédio'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Prédio</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingBuilding ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Buildings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map((building) => (
            <div key={building.id} className="bg-white shadow-xl rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{building.name}</h3>
                  {isSuperAdmin() && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(building)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(building)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span className="text-sm">{building.address}</span>
                  </div>

                  {building.phone && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      <span className="text-sm">{building.phone}</span>
                    </div>
                  )}

                  {building.email && (
                    <div className="flex items-center text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      <span className="text-sm">{building.email}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Users className="h-4 w-4 text-blue-600 mr-1" />
                        <span className="text-2xl font-bold text-blue-600">
                          {building._count?.residents || 0}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Moradores</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Building className="h-4 w-4 text-green-600 mr-1" />
                        <span className="text-2xl font-bold text-green-600">
                          {building._count?.admins || 0}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Admins</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {buildings.length === 0 && (
          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            <div className="p-12 text-center">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum prédio encontrado</h3>
              <p className="text-gray-500 mb-4">
                {isSuperAdmin() 
                  ? 'Comece criando seu primeiro prédio.' 
                  : 'Você ainda não foi associado a nenhum prédio.'}
              </p>
              {isSuperAdmin() && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Prédio
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}