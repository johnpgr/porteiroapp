'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  UserCheck, 
  Search, 
  Building2,
  Phone,
  Mail,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
  Calendar,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface DoorkeeperProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  user_type: string;
  is_active: boolean;
  created_at: string;
  building_id?: string;
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

export default function DoorkeepersManagement() {
  const [doorkeepers, setDoorkeepers] = useState<DoorkeeperProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoorkeeper, setSelectedDoorkeeper] = useState<DoorkeeperProfile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadDoorkeepers();
  }, []);

  const loadDoorkeepers = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          building:buildings(
            id,
            name,
            address
          )
        `)
        .eq('user_type', 'doorkeeper')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDoorkeepers(data || []);
    } catch (error) {
      console.error('Erro ao carregar porteiros:', error);
      toast.error('Erro ao carregar lista de porteiros');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActiveStatus = async (doorkeeper: DoorkeeperProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !doorkeeper.is_active })
        .eq('id', doorkeeper.id);

      if (error) throw error;
      
      toast.success(`Porteiro ${!doorkeeper.is_active ? 'ativado' : 'desativado'} com sucesso!`);
      loadDoorkeepers();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do porteiro');
    }
  };

  const handleViewDetails = (doorkeeper: DoorkeeperProfile) => {
    setSelectedDoorkeeper(doorkeeper);
    setShowDetailsModal(true);
  };

  const filteredDoorkeepers = doorkeepers.filter(doorkeeper =>
    doorkeeper.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doorkeeper.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doorkeeper.building?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
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
              Gerenciamento de Porteiros
            </h1>
            <p className="text-gray-600">
              Visualize e gerencie todos os porteiros cadastrados no sistema
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {doorkeepers.length}
            </div>
            <div className="text-sm text-gray-500">
              Total de porteiros
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Porteiros Ativos</p>
              <p className="text-2xl font-bold text-gray-900">
                {doorkeepers.filter(d => d.is_active).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <ShieldX className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Porteiros Inativos</p>
              <p className="text-2xl font-bold text-gray-900">
                {doorkeepers.filter(d => !d.is_active).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Prédios com Porteiros</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(doorkeepers.filter(d => d.building_id).map(d => d.building_id)).size}
              </p>
            </div>
          </div>
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

      {/* Doorkeepers List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredDoorkeepers.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Nenhum porteiro encontrado' : 'Nenhum porteiro cadastrado'}
            </h3>
            <p className="text-gray-500">
              {searchTerm ? 'Tente ajustar os termos de busca' : 'Os porteiros são cadastrados pelos administradores dos prédios'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Porteiro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prédio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDoorkeepers.map((doorkeeper) => (
                  <tr key={doorkeeper.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {doorkeeper.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {doorkeeper.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          <span>{doorkeeper.email}</span>
                        </div>
                        {doorkeeper.phone && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            <span>{doorkeeper.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doorkeeper.building ? (
                        <div className="flex items-start space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {doorkeeper.building.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {doorkeeper.building.address}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Não atribuído</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        getStatusColor(doorkeeper.is_active)
                      }`}>
                        {doorkeeper.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(doorkeeper.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(doorkeeper)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActiveStatus(doorkeeper)}
                          className={`p-1 rounded ${
                            doorkeeper.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={doorkeeper.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {doorkeeper.is_active ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
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

      {/* Details Modal */}
      {showDetailsModal && selectedDoorkeeper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Detalhes do Porteiro
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Personal Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Informações Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Nome Completo
                      </label>
                      <p className="text-sm text-gray-900">{selectedDoorkeeper.full_name}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        E-mail
                      </label>
                      <p className="text-sm text-gray-900">{selectedDoorkeeper.email}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Telefone
                      </label>
                      <p className="text-sm text-gray-900">
                        {selectedDoorkeeper.phone || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Status
                      </label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        getStatusColor(selectedDoorkeeper.is_active)
                      }`}>
                        {selectedDoorkeeper.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Building Info */}
                {selectedDoorkeeper.building && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Prédio Atribuído</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Nome do Prédio
                        </label>
                        <p className="text-sm text-gray-900">{selectedDoorkeeper.building.name}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Endereço
                        </label>
                        <p className="text-sm text-gray-900">{selectedDoorkeeper.building.address}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* System Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Informações do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        ID do Usuário
                      </label>
                      <p className="text-sm text-gray-900 font-mono">{selectedDoorkeeper.user_id}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Data de Cadastro
                      </label>
                      <div className="flex items-center space-x-2 text-sm text-gray-900">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(selectedDoorkeeper.created_at).toLocaleDateString('pt-BR')}</span>
                        <Clock className="h-4 w-4" />
                        <span>{new Date(selectedDoorkeeper.created_at).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  onClick={() => toggleActiveStatus(selectedDoorkeeper)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedDoorkeeper.is_active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {selectedDoorkeeper.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}