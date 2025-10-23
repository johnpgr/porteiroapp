'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Search, 
  Building2,
  Phone,
  Mail,
  Home,
  Eye,
  Calendar,
  Clock,
  Filter,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from 'sonner';

interface ResidentProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  user_type: string;
  is_active: boolean;
  created_at: string;
  apartment?: {
    id: string;
    number: string;
    floor: number;
    building: {
      id: string;
      name: string;
      address: string;
    };
  };
}

interface Building {
  id: string;
  name: string;
  address: string;
}

export default function ResidentsManagement() {
  const [residents, setResidents] = useState<ResidentProfile[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedResident, setSelectedResident] = useState<ResidentProfile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load residents
      const { data: residentsData, error: residentsError } = await supabase
        .from('profiles')
        .select(`
          *,
          apartment:apartments(
            id,
            number,
            floor,
            building:buildings(
              id,
              name,
              address
            )
          )
        `)
        .eq('user_type', 'resident')
        .order('created_at', { ascending: false });

      if (residentsError) throw residentsError;

      // Load buildings for filter
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('id, name, address')
        .order('name');

      if (buildingsError) throw buildingsError;

      setResidents(residentsData || []);
      setBuildings(buildingsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos moradores');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActiveStatus = async (resident: ResidentProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !resident.is_active })
        .eq('id', resident.id);

      if (error) throw error;
      
      toast.success(`Morador ${!resident.is_active ? 'ativado' : 'desativado'} com sucesso!`);
      loadData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do morador');
    }
  };

  const handleViewDetails = (resident: ResidentProfile) => {
    setSelectedResident(resident);
    setShowDetailsModal(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBuilding('');
    setStatusFilter('');
  };

  const filteredResidents = residents.filter(resident => {
    const matchesSearch = 
      resident.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resident.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resident.apartment?.building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resident.apartment?.number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBuilding = !selectedBuilding || 
      resident.apartment?.building.id === selectedBuilding;
    
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && resident.is_active) ||
      (statusFilter === 'inactive' && !resident.is_active);
    
    return matchesSearch && matchesBuilding && matchesStatus;
  });

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const activeFiltersCount = [searchTerm, selectedBuilding, statusFilter].filter(Boolean).length;

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
              Controle de Moradores
            </h1>
            <p className="text-gray-600">
              Visualize e gerencie todos os moradores cadastrados no sistema
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {residents.length}
            </div>
            <div className="text-sm text-gray-500">
              Total de moradores
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Moradores Ativos</p>
              <p className="text-2xl font-bold text-gray-900">
                {residents.filter(r => r.is_active).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <UserX className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Moradores Inativos</p>
              <p className="text-2xl font-bold text-gray-900">
                {residents.filter(r => !r.is_active).length}
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
              <p className="text-sm font-medium text-gray-600">Prédios com Moradores</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(residents.filter(r => r.apartment?.building.id).map(r => r.apartment?.building.id)).size}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <Home className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Apartamentos Ocupados</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(residents.filter(r => r.apartment?.id).map(r => r.apartment?.id)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail, prédio ou apartamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Filter className="h-4 w-4" />
              <span>Filtros Avançados</span>
              {activeFiltersCount > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Limpar filtros
              </button>
            )}
          </div>
          
          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prédio
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos os prédios</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos os status</option>
                  <option value="active">Apenas ativos</option>
                  <option value="inactive">Apenas inativos</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      {(searchTerm || selectedBuilding || statusFilter) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Mostrando {filteredResidents.length} de {residents.length} moradores
            {activeFiltersCount > 0 && ' com filtros aplicados'}
          </p>
        </div>
      )}

      {/* Residents List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredResidents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || selectedBuilding || statusFilter 
                ? 'Nenhum morador encontrado' 
                : 'Nenhum morador cadastrado'
              }
            </h3>
            <p className="text-gray-500">
              {searchTerm || selectedBuilding || statusFilter
                ? 'Tente ajustar os filtros de busca'
                : 'Os moradores são cadastrados pelos administradores dos prédios'
              }
            </p>
          </div>
        ) : (
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
                {filteredResidents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <Users className="h-6 w-6 text-purple-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {resident.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {resident.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          <span>{resident.email}</span>
                        </div>
                        {resident.phone && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            <span>{resident.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resident.apartment ? (
                        <div className="flex items-center space-x-2">
                          <Home className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              Apt {resident.apartment.number}
                            </div>
                            <div className="text-sm text-gray-500">
                              {resident.apartment.floor}º andar
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Não atribuído</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resident.apartment?.building ? (
                        <div className="flex items-start space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {resident.apartment.building.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {resident.apartment.building.address}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Não atribuído</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        getStatusColor(resident.is_active)
                      }`}>
                        {resident.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(resident.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(resident)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActiveStatus(resident)}
                          className={`p-1 rounded ${
                            resident.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={resident.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {resident.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
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
      {showDetailsModal && selectedResident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Detalhes do Morador
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
                      <p className="text-sm text-gray-900">{selectedResident.full_name}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        E-mail
                      </label>
                      <p className="text-sm text-gray-900">{selectedResident.email}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Telefone
                      </label>
                      <p className="text-sm text-gray-900">
                        {selectedResident.phone || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Status
                      </label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        getStatusColor(selectedResident.is_active)
                      }`}>
                        {selectedResident.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Apartment Info */}
                {selectedResident.apartment && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Apartamento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Número
                        </label>
                        <p className="text-sm text-gray-900">{selectedResident.apartment.number}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Andar
                        </label>
                        <p className="text-sm text-gray-900">{selectedResident.apartment.floor}º andar</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Prédio
                        </label>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900">
                            {selectedResident.apartment.building.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {selectedResident.apartment.building.address}
                          </p>
                        </div>
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
                      <p className="text-sm text-gray-900 font-mono">{selectedResident.user_id}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Data de Cadastro
                      </label>
                      <div className="flex items-center space-x-2 text-sm text-gray-900">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(selectedResident.created_at).toLocaleDateString('pt-BR')}</span>
                        <Clock className="h-4 w-4" />
                        <span>{new Date(selectedResident.created_at).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  onClick={() => toggleActiveStatus(selectedResident)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedResident.is_active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {selectedResident.is_active ? 'Desativar' : 'Ativar'}
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