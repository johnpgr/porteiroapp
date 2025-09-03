'use client';

import { useAuth } from '@/utils/useAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCheck, Plus, Edit, Trash2, Building, Phone, Clock, Key, Eye, EyeOff, Copy } from 'lucide-react';

interface VisitorData {
  id: string;
  visitor_name: string;
  visitor_phone?: string;
  apartment: string;
  building_id: string;
  password: string;
  expires_at: string;
  is_used: boolean;
  used_at?: string;
  created_by: string;
  created_at: string;
  building?: {
    name: string;
  };
  creator?: {
    name: string;
  };
}

interface BuildingOption {
  id: string;
  name: string;
}

export default function VisitorManagement() {
  const { user, isSuperAdmin, isAdmin, requireAuth } = useAuth();
  const [visitors, setVisitors] = useState<VisitorData[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<VisitorData | null>(null);
  const [showPassword, setShowPassword] = useState<{[key: string]: boolean}>({});
  const [formData, setFormData] = useState({
    visitor_name: '',
    visitor_phone: '',
    apartment: '',
    building_id: '',
    password: '',
    expires_at: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    requireAuth();
    if (!isAdmin()) {
      window.location.href = '/login';
      return;
    }
    loadBuildings();
    loadVisitors();
    generateRandomPassword();
  }, []);

  const loadBuildings = async () => {
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
        setFormData(prev => ({ ...prev, building_id: user.building_id }));
      }
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  };

  const loadVisitors = async () => {
    try {
      let query = supabase
        .from('visitor_temporary_passwords')
        .select(`
          *,
          building:buildings(name),
          creator:admin_profiles(name)
        `)
        .order('created_at', { ascending: false });

      // Se não for super admin, mostrar apenas visitantes do prédio do admin
      if (!isSuperAdmin() && user?.building_id) {
        query = query.eq('building_id', user.building_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVisitors(data || []);
    } catch (error) {
      console.error('Erro ao carregar visitantes:', error);
      setError('Erro ao carregar visitantes');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  const getDefaultExpiryTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 24); // 24 horas a partir de agora
    return now.toISOString().slice(0, 16); // formato datetime-local
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingVisitor) {
        // Atualizar visitante existente
        const { error } = await supabase
          .from('visitor_temporary_passwords')
          .update({
            visitor_name: formData.visitor_name,
            visitor_phone: formData.visitor_phone || null,
            apartment: formData.apartment,
            building_id: formData.building_id,
            password: formData.password,
            expires_at: formData.expires_at
          })
          .eq('id', editingVisitor.id);

        if (error) throw error;
        setSuccess('Visitante atualizado com sucesso!');
      } else {
        // Criar novo visitante
        const { error } = await supabase
          .from('visitor_temporary_passwords')
          .insert({
            visitor_name: formData.visitor_name,
            visitor_phone: formData.visitor_phone || null,
            apartment: formData.apartment,
            building_id: formData.building_id,
            password: formData.password,
            expires_at: formData.expires_at,
            created_by: user?.id,
            is_used: false
          });

        if (error) throw error;
        setSuccess('Senha temporária criada com sucesso!');
      }

      setFormData({
        visitor_name: '',
        visitor_phone: '',
        apartment: '',
        building_id: !isSuperAdmin() && user?.building_id ? user.building_id : '',
        password: '',
        expires_at: ''
      });
      generateRandomPassword();
      setShowCreateForm(false);
      setEditingVisitor(null);
      loadVisitors();
    } catch (error: any) {
      console.error('Erro ao salvar visitante:', error);
      setError(error.message || 'Erro ao salvar visitante');
    }
  };

  const handleEdit = (visitor: VisitorData) => {
    setEditingVisitor(visitor);
    setFormData({
      visitor_name: visitor.visitor_name,
      visitor_phone: visitor.visitor_phone || '',
      apartment: visitor.apartment,
      building_id: visitor.building_id,
      password: visitor.password,
      expires_at: new Date(visitor.expires_at).toISOString().slice(0, 16)
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (visitor: VisitorData) => {
    if (!confirm(`Tem certeza que deseja excluir a senha temporária para "${visitor.visitor_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('visitor_temporary_passwords')
        .delete()
        .eq('id', visitor.id);

      if (error) throw error;
      setSuccess('Senha temporária excluída com sucesso!');
      loadVisitors();
    } catch (error: any) {
      console.error('Erro ao excluir visitante:', error);
      setError('Erro ao excluir senha temporária');
    }
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setSuccess('Senha copiada para a área de transferência!');
    } catch (error) {
      setError('Erro ao copiar senha');
    }
  };

  const togglePasswordVisibility = (visitorId: string) => {
    setShowPassword(prev => ({
      ...prev,
      [visitorId]: !prev[visitorId]
    }));
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingVisitor(null);
    setFormData({
      visitor_name: '',
      visitor_phone: '',
      apartment: '',
      building_id: !isSuperAdmin() && user?.building_id ? user.building_id : '',
      password: '',
      expires_at: ''
    });
    generateRandomPassword();
    setError('');
    setSuccess('');
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
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
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <UserCheck className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Gerenciar Visitantes</h1>
                  <p className="text-purple-100">
                    {isSuperAdmin() ? 'Painel do Super Administrador' : 'Painel do Administrador'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setFormData(prev => ({ ...prev, expires_at: getDefaultExpiryTime() }));
                }}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Senha Temporária</span>
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
                {editingVisitor ? 'Editar Senha Temporária' : 'Nova Senha Temporária'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Visitante</label>
                  <input
                    type="text"
                    value={formData.visitor_name}
                    onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone do Visitante</label>
                  <input
                    type="tel"
                    value={formData.visitor_phone}
                    onChange={(e) => setFormData({ ...formData, visitor_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apartamento de Destino</label>
                  <input
                    type="text"
                    value={formData.apartment}
                    onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha Temporária</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                      maxLength={10}
                    />
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expira em</label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    min={new Date().toISOString().slice(0, 16)}
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  {editingVisitor ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Visitors List */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visitante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Senha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Validade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visitors.map((visitor) => (
                  <tr key={visitor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <UserCheck className="h-5 w-5 text-purple-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{visitor.visitor_name}</div>
                          {visitor.visitor_phone && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {visitor.visitor_phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">Apt. {visitor.apartment}</div>
                        {isSuperAdmin() && (
                          <div className="text-gray-500 flex items-center">
                            <Building className="h-3 w-3 mr-1" />
                            {visitor.building?.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {showPassword[visitor.id] ? visitor.password : '••••••'}
                        </code>
                        <button
                          onClick={() => togglePasswordVisibility(visitor.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showPassword[visitor.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyPassword(visitor.password)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-gray-400" />
                          {formatDateTime(visitor.expires_at)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        visitor.is_used
                          ? 'bg-gray-100 text-gray-800'
                          : isExpired(visitor.expires_at)
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {visitor.is_used
                          ? 'Usada'
                          : isExpired(visitor.expires_at)
                          ? 'Expirada'
                          : 'Ativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {!visitor.is_used && !isExpired(visitor.expires_at) && (
                          <button
                            onClick={() => handleEdit(visitor)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(visitor)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visitors.length === 0 && (
            <div className="p-12 text-center">
              <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma senha temporária encontrada</h3>
              <p className="text-gray-500 mb-4">Comece criando a primeira senha temporária para visitantes.</p>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setFormData(prev => ({ ...prev, expires_at: getDefaultExpiryTime() }));
                }}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Senha
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}