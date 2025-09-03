import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Users, UserPlus, Settings, LogOut, Home, Phone, Mail, Calendar, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Building {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

interface Resident {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  apartment_number: string;
  building_name: string;
  created_at: string;
}

interface AdminProfile {
  id: string;
  full_name: string;
  email: string;
  admin_type: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Carregar perfil do admin
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        navigate('/login');
        return;
      }

      setAdminProfile(profile);

      // Carregar prédios gerenciados pelo admin
      const { data: adminBuildings } = await supabase
        .from('building_admins')
        .select(`
          buildings (
            id,
            name,
            address,
            created_at
          )
        `)
        .eq('admin_profile_id', profile.id);

      const buildingsList = adminBuildings?.map(ab => ab.buildings).filter(Boolean) || [];
      setBuildings(buildingsList);

      // Carregar moradores dos prédios gerenciados
      if (buildingsList.length > 0) {
        const buildingIds = buildingsList.map(b => b.id);
        
        const { data: residentsData } = await supabase
          .from('apartment_residents')
          .select(`
            profiles (
              id,
              full_name,
              email,
              phone,
              created_at
            ),
            apartments (
              number,
              buildings (
                name
              )
            )
          `)
          .in('apartments.building_id', buildingIds);

        const residentsList = residentsData?.map(rd => ({
          id: rd.profiles?.id || '',
          full_name: rd.profiles?.full_name || '',
          email: rd.profiles?.email || '',
          phone: rd.profiles?.phone || '',
          apartment_number: rd.apartments?.number || '',
          building_name: rd.apartments?.buildings?.name || '',
          created_at: rd.profiles?.created_at || ''
        })).filter(r => r.id) || [];

        setResidents(residentsList);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Home className="h-8 w-8 text-blue-600" />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                Dashboard do Administrador
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Olá, {adminProfile?.full_name}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('buildings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'buildings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Prédios
            </button>
            <button
              onClick={() => setActiveTab('residents')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'residents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Moradores
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Building className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Prédios Gerenciados
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {buildings.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total de Moradores
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {residents.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <UserPlus className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Ações Rápidas
                        </dt>
                        <dd className="text-sm text-gray-900">
                          <a href="/register-resident" className="text-blue-600 hover:text-blue-500">
                            Cadastrar Morador
                          </a>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Prédios Gerenciados
                </h3>
                {buildings.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    Nenhum prédio atribuído a este administrador.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {buildings.slice(0, 3).map((building) => (
                      <div key={building.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{building.name}</p>
                            <p className="text-xs text-gray-500">{building.address}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(building.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Buildings Tab */}
        {activeTab === 'buildings' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Prédios Gerenciados
                </h3>
              </div>
              {buildings.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum prédio</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Nenhum prédio foi atribuído a este administrador.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {buildings.map((building) => (
                    <div key={building.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            {building.name}
                          </h4>
                          <div className="space-y-1">
                            <div className="flex items-center text-xs text-gray-500">
                              <MapPin className="h-3 w-3 mr-1" />
                              {building.address}
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              Criado em {new Date(building.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Residents Tab */}
        {activeTab === 'residents' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Moradores
                </h3>
                <a
                  href="/register-resident"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar Morador
                </a>
              </div>
              {residents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum morador</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Nenhum morador cadastrado nos prédios gerenciados.
                  </p>
                  <div className="mt-6">
                    <a
                      href="/register-resident"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Cadastrar Primeiro Morador
                    </a>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nome
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {residents.map((resident) => (
                        <tr key={resident.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {resident.full_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <div className="flex items-center">
                                <Mail className="h-3 w-3 mr-1 text-gray-400" />
                                {resident.email}
                              </div>
                              {resident.phone && (
                                <div className="flex items-center mt-1">
                                  <Phone className="h-3 w-3 mr-1 text-gray-400" />
                                  {resident.phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {resident.apartment_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {resident.building_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;