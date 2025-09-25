'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building2,
  Phone,
  Mail,
  Shield,
  ShieldCheck,
  ShieldX
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

interface AdminProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  admin_type: 'building' | 'super';
  is_active: boolean;
  created_at: string;
  building_admins?: {
    building: {
      id: string;
      name: string;
    };
  }[];
}

interface Building {
  id: string;
  name: string;
}

interface AdminFormData {
  email: string;
  full_name: string;
  phone: string;
  admin_type: 'building' | 'super';
  is_active: boolean;
  building_id: string;
}

export default function AdminsManagement() {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminProfile | null>(null);
  const [formData, setFormData] = useState<AdminFormData>({
    email: '',
    full_name: '',
    phone: '',
    admin_type: 'building',
    is_active: true,
    building_id: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const searchParams = useSearchParams();
  const shouldShowCreateModal = searchParams.get('action') === 'create';

  useEffect(() => {
    loadData();
    if (shouldShowCreateModal) {
      handleCreateNew();
    }
  }, [shouldShowCreateModal]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Carregar administradores e prédios em paralelo
      const [adminsResult, buildingsResult] = await Promise.all([
        supabase
          .from('admin_profiles')
          .select(`
            *,
            building_admins(
              building:buildings(
                id,
                name
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('buildings')
          .select('id, name')
          .order('name')
      ]);

      if (adminsResult.error) throw adminsResult.error;
      if (buildingsResult.error) throw buildingsResult.error;

      setAdmins(adminsResult.data || []);
      setBuildings(buildingsResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingAdmin(null);
    setFormData({
      email: '',
      full_name: '',
      phone: '',
      admin_type: 'building',
      is_active: true,
      building_id: ''
    });
    setShowModal(true);
  };

  const handleEdit = (admin: AdminProfile) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      full_name: admin.full_name,
      phone: admin.phone || '',
      admin_type: admin.admin_type,
      is_active: admin.is_active,
      building_id: admin.building_admins?.[0]?.building?.id || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim() || !formData.full_name.trim()) {
      toast.error('E-mail e nome completo são obrigatórios');
      return;
    }

    if (formData.admin_type === 'building' && !formData.building_id) {
      toast.error('Selecione um prédio para administradores de prédio');
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingAdmin) {
        // Atualizar administrador existente
        const { error: updateError } = await supabase
          .from('admin_profiles')
          .update({
            email: formData.email.trim(),
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim() || null,
            admin_type: formData.admin_type,
            is_active: formData.is_active
          })
          .eq('id', editingAdmin.id);

        if (updateError) throw updateError;

        // Atualizar associação com prédio se necessário
        if (formData.admin_type === 'building') {
          // Remover associações antigas
          await supabase
            .from('building_admins')
            .delete()
            .eq('admin_id', editingAdmin.id);

          // Criar nova associação
          if (formData.building_id) {
            const { error: buildingError } = await supabase
              .from('building_admins')
              .insert({
                admin_id: editingAdmin.id,
                building_id: formData.building_id
              });

            if (buildingError) throw buildingError;
          }
        } else {
          // Se mudou para super admin, remover associações com prédios
          await supabase
            .from('building_admins')
            .delete()
            .eq('admin_id', editingAdmin.id);
        }

        toast.success('Administrador atualizado com sucesso!');
      } else {
        // Criar novo administrador
        const { data: adminData, error: adminError } = await supabase
          .from('admin_profiles')
          .insert({
            email: formData.email.trim(),
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim() || null,
            admin_type: formData.admin_type,
            is_active: formData.is_active
          })
          .select()
          .single();

        if (adminError) throw adminError;

        // Associar com prédio se necessário
        if (formData.admin_type === 'building' && formData.building_id && adminData) {
          const { error: buildingError } = await supabase
            .from('building_admins')
            .insert({
              admin_id: adminData.id,
              building_id: formData.building_id
            });

          if (buildingError) throw buildingError;
        }

        toast.success('Administrador criado com sucesso!');
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar administrador:', error);
      toast.error('Erro ao salvar administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (admin: AdminProfile) => {
    if (!confirm(`Tem certeza que deseja excluir o administrador "${admin.full_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_profiles')
        .delete()
        .eq('id', admin.id);

      if (error) throw error;
      
      toast.success('Administrador excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao excluir administrador:', error);
      toast.error('Erro ao excluir administrador');
    }
  };

  const toggleActiveStatus = async (admin: AdminProfile) => {
    try {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ is_active: !admin.is_active })
        .eq('id', admin.id);

      if (error) throw error;
      
      toast.success(`Administrador ${!admin.is_active ? 'ativado' : 'desativado'} com sucesso!`);
      loadData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do administrador');
    }
  };

  const filteredAdmins = admins.filter(admin =>
    admin.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.building_admins?.some(ba => 
      ba.building.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getAdminTypeIcon = (type: string) => {
    switch (type) {
      case 'super':
        return <ShieldCheck className="h-4 w-4 text-red-600" />;
      case 'building':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <ShieldX className="h-4 w-4 text-gray-400" />;
    }
  };

  const getAdminTypeLabel = (type: string) => {
    switch (type) {
      case 'super':
        return 'Super Admin';
      case 'building':
        return 'Admin Prédio';
      default:
        return 'Desconhecido';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Gerenciamento de Administradores
            </h1>
            <p className="text-gray-600">
              Gerencie todos os administradores do sistema
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Novo Admin</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou prédio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Admins List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredAdmins.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Nenhum administrador encontrado' : 'Nenhum administrador cadastrado'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Tente ajustar os termos de busca' : 'Comece criando seu primeiro administrador'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateNew}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Criar Primeiro Admin</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Administrador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo & Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prédio
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {admin.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Criado em {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          <span>{admin.email}</span>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            <span>{admin.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {getAdminTypeIcon(admin.admin_type)}
                          <span className="text-sm font-medium text-gray-900">
                            {getAdminTypeLabel(admin.admin_type)}
                          </span>
                        </div>
                        <div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            admin.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {admin.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {admin.admin_type === 'building' && admin.building_admins?.length ? (
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {admin.building_admins[0].building.name}
                          </span>
                        </div>
                      ) : admin.admin_type === 'super' ? (
                        <span className="text-sm text-gray-500 italic">Todos os prédios</span>
                      ) : (
                        <span className="text-sm text-gray-400">Não atribuído</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => toggleActiveStatus(admin)}
                          className={`p-1 rounded ${
                            admin.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={admin.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {admin.is_active ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(admin)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(admin)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Excluir"
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
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingAdmin ? 'Editar Administrador' : 'Novo Administrador'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="admin@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="João Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Administrador *
                  </label>
                  <select
                    value={formData.admin_type}
                    onChange={(e) => setFormData({ ...formData, admin_type: e.target.value as 'building' | 'super', building_id: e.target.value === 'super' ? '' : formData.building_id })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="building">Administrador de Prédio</option>
                    <option value="super">Super Administrador</option>
                  </select>
                </div>

                {formData.admin_type === 'building' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prédio *
                    </label>
                    <select
                      value={formData.building_id}
                      onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                    Administrador ativo
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Salvando...' : (editingAdmin ? 'Atualizar' : 'Criar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}