import React, { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { 
  sendWhatsAppMessage, 
  validateBrazilianPhone, 
  formatBrazilianPhone,
  generateWhatsAppMessage,
  type ResidentData 
} from '../../../utils/whatsapp';
// Removed old notification service - using Edge Functions for push notifications
import * as Crypto from 'expo-crypto';

// Funções de formatação
const formatDate = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 8 dígitos (DDMMAAAA)
  const limitedNumbers = numbers.slice(0, 8);
  
  // Aplica a máscara DD/MM/AAAA progressivamente
  if (limitedNumbers.length === 0) {
    return '';
  } else if (limitedNumbers.length <= 2) {
    return limitedNumbers;
  } else if (limitedNumbers.length <= 4) {
    return `${limitedNumbers.slice(0, 2)}/${limitedNumbers.slice(2)}`;
  } else {
    return `${limitedNumbers.slice(0, 2)}/${limitedNumbers.slice(2, 4)}/${limitedNumbers.slice(4)}`;
  }
};

const formatTime = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara HH:MM
  if (numbers.length <= 2) {
    return numbers;
  } else {
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  }
};

// Funções de validação
const validateDate = (dateString: string): boolean => {
  if (!dateString || dateString.length !== 10) return false;
  
  const [day, month, year] = dateString.split('/').map(Number);
  
  if (!day || !month || !year) return false;
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  
  // Verifica se a data é válida
  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return false;
  }
  
  // Permite datas a partir de hoje (data atual) - incluindo hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Remove horas para comparar apenas a data
  date.setHours(0, 0, 0, 0);
  
  return date >= today;
};

const validateTime = (timeString: string): boolean => {
  if (!timeString || timeString.length !== 5) return false;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  
  return true;
};

const validateTimeRange = (startTime: string, endTime: string): boolean => {
  if (!validateTime(startTime) || !validateTime(endTime)) return false;
  
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes > startTotalMinutes;
};

// Função para gerar senha temporária aleatória de 6 dígitos numéricos
const generateTemporaryPassword = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Função para criar hash da senha usando expo-crypto
const hashPassword = async (password: string): Promise<string> => {
  // Usar SHA-256 para criar hash da senha
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
};

// Função para gerar senha temporária (removida a funcionalidade de armazenamento)
const generateTemporaryPasswordForVisitor = async (visitorName: string, visitorPhone: string, visitorId: string): Promise<string> => {
  try {
    const plainPassword = generateTemporaryPassword();
    console.log('🔑 Senha temporária gerada para visitante:', visitorName, visitorPhone);
    return plainPassword;
  } catch (error) {
    console.error('❌ Erro ao gerar senha temporária:', error);
    throw error;
  }
};

interface Visitor {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  photo_url: string | null;
  access_type?: 'direto' | 'com_aprovacao';
  status: string;
  visitor_type: string;
  created_at: string;
  updated_at: string;
  apartment_id: string;
  registration_token?: string;
  token_expires_at?: string;
  visit_date?: string | null;
  visit_start_time?: string | null;
  visit_end_time?: string | null;
}

interface Vehicle {
  id: string;
  license_plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  type?: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other' | null;
  apartment_id: string;
  ownership_type: 'visita' | 'proprietario';
  created_at: string;
}

interface PreRegistrationData {
  name: string;
  phone: string;
  visit_type: 'pontual' | 'frequente' | 'prestador_servico';
  access_type?: 'com_aprovacao' | 'direto';
  visit_date?: string;
  visit_start_time?: string;
  visit_end_time?: string;
  allowed_days?: string[];
  max_simultaneous_visits?: number;
  validity_start?: string;
  validity_end?: string;
}

export default function VisitantesTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreRegistrationModal, setShowPreRegistrationModal] = useState(false);
  const [preRegistrationData, setPreRegistrationData] = useState<PreRegistrationData>({
    name: '',
    phone: '',
    visit_type: 'pontual',
    access_type: 'com_aprovacao',
    visit_date: '',
    visit_start_time: '',
    visit_end_time: '',
    allowed_days: [],
    max_simultaneous_visits: 1,
    validity_start: '',
    validity_end: ''
  });
  
  // Estado para armazenar apartment_id e evitar múltiplas consultas
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [apartmentIdLoading, setApartmentIdLoading] = useState(false);
  
  // Rate limiting para pré-cadastros
  const [lastRegistrationTime, setLastRegistrationTime] = useState<number>(0);
  const REGISTRATION_COOLDOWN = 30000; // 30 segundos entre registros
  const [isSubmittingPreRegistration, setIsSubmittingPreRegistration] = useState(false);
  
  // Estados para modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [editData, setEditData] = useState<PreRegistrationData>({
    name: '',
    phone: '',
    visit_type: 'pontual',
    visit_date: '',
    visit_start_time: '',
    visit_end_time: '',
    allowed_days: [],
    max_simultaneous_visits: 1
  });
  
  // Estado para controlar expansão dos cards
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  
  // Estado para armazenar veículos
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Estados para paginação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'expirado'>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'visitantes' | 'veiculos'>('todos');
  const ITEMS_PER_PAGE = 10;
  
  // Estados para o modal de filtros
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempStatusFilter, setTempStatusFilter] = useState<'todos' | 'pendente' | 'expirado'>('todos');
  const [tempTypeFilter, setTempTypeFilter] = useState<'todos' | 'visitantes' | 'veiculos'>('todos');
  
  // Função para alternar expansão do card
  const toggleCardExpansion = (visitorId: string) => {
    setExpandedCardId(expandedCardId === visitorId ? null : visitorId);
  };
  






  // Função para carregar apartment_id uma única vez
  const loadApartmentId = useCallback(async (): Promise<string | null> => {
    if (apartmentId) {
      return apartmentId; // Retorna o valor já carregado
    }

    if (apartmentIdLoading) {
      // Se já está carregando, aguarda um pouco e tenta novamente
      await new Promise(resolve => setTimeout(resolve, 100));
      return apartmentId;
    }

    try {
      setApartmentIdLoading(true);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar profile_id do usuário
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (profileError) {
        throw new Error('Erro ao buscar perfil do usuário');
      }
      if (!profileData) {
        console.log('Perfil não encontrado para o usuário autenticado');
        setApartmentId(null);
        return null;
      }

      // Buscar apartment_id usando profile_id
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', profileData.id)
        .maybeSingle();

      if (apartmentError) {
        throw new Error('Erro ao buscar apartment_id');
      }

      if (!apartmentData?.apartment_id) {
        console.log('Nenhum apartment_id associado ao perfil');
        setApartmentId(null);
        return null;
      }

      setApartmentId(apartmentData.apartment_id);
      return apartmentData.apartment_id;
    } catch (error) {
      console.error('Erro ao carregar apartment_id:', error);
      return null;
    } finally {
      setApartmentIdLoading(false);
    }
  }, [apartmentId, apartmentIdLoading]);

  const fetchVisitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Iniciando busca de visitantes...');
      console.log('👤 Usuário logado:', user?.id);

      if (!user?.id) {
        console.log('❌ Usuário não encontrado');
        setError('Usuário não encontrado');
        return;
      }

      // Usar apartment_id do estado ou carregá-lo se necessário
      console.log('🏠 Obtendo apartment_id...');
      const currentApartmentId = await loadApartmentId();

      if (!currentApartmentId) {
        console.log('❌ Apartment_id não encontrado para o usuário');
        setError('Apartamento não encontrado para o usuário');
        return;
      }

      console.log('✅ Apartment_id encontrado:', currentApartmentId);

      // Buscar visitantes filtrados por apartment_id
      console.log('📋 Buscando visitantes do apartamento...');
      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitors')
        .select(`
          id,
          name,
          document,
          phone,
          photo_url,
          status,
          visitor_type,
          access_type,
          created_at,
          updated_at,
          apartment_id,
          visit_date,
          visit_start_time,
          visit_end_time
        `)
        .eq('apartment_id', currentApartmentId)
        .order('created_at', { ascending: false });

      if (visitorsError) {
        console.error('❌ Erro ao buscar visitantes:', visitorsError);
        
        // Tratamento específico para erros de coluna inexistente
        if (visitorsError.code === '42703') {
          setError('Erro de estrutura do banco de dados. Verifique as colunas da tabela visitors.');
        } else if (visitorsError.code === 'PGRST204') {
          setError('Coluna não encontrada na tabela visitors. Verifique a estrutura do banco.');
        } else {
          setError(`Erro ao buscar visitantes: ${visitorsError.message}`);
        }
        return;
      }

      console.log('✅ Visitantes encontrados para o apartamento:', visitorsData?.length || 0);
      console.log('📊 Dados dos visitantes:', visitorsData);

      // Buscar veículos filtrados por apartment_id e ownership_type = 'visita'
      console.log('🚗 Buscando veículos de visitantes do apartamento...');
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          id,
          license_plate,
          brand,
          model,
          color,
          type,
          apartment_id,
          ownership_type,
          created_at
        `)
        .eq('apartment_id', currentApartmentId)
        .eq('ownership_type', 'visita')
        .order('created_at', { ascending: false });

      if (vehiclesError) {
        console.error('❌ Erro ao buscar veículos:', vehiclesError);
        // Não interrompe o fluxo se houver erro nos veículos, apenas loga
      } else {
        console.log('✅ Veículos encontrados para o apartamento:', vehiclesData?.length || 0);
        console.log('📊 Dados dos veículos:', vehiclesData);
      }

      // Mapear os dados dos visitantes
      const mappedVisitors: Visitor[] = (visitorsData || []).map(visitor => ({
        id: visitor.id,
        name: visitor.name || 'Nome não informado',
        document: visitor.document,
        phone: visitor.phone,
        photo_url: visitor.photo_url,
        status: visitor.status,
        visitor_type: visitor.visitor_type || 'comum',
        access_type: visitor.access_type || 'com_aprovacao',
        created_at: visitor.created_at,
        updated_at: visitor.updated_at,
        apartment_id: visitor.apartment_id,
        visit_date: visitor.visit_date,
        visit_start_time: visitor.visit_start_time,
        visit_end_time: visitor.visit_end_time
      }));

      // Mapear os dados dos veículos
      const mappedVehicles: Vehicle[] = (vehiclesData || []).map(vehicle => ({
        id: vehicle.id,
        license_plate: vehicle.license_plate,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        type: vehicle.type,
        apartment_id: vehicle.apartment_id,
        ownership_type: vehicle.ownership_type || 'proprietario',
        created_at: vehicle.created_at
      }));

      setVisitors(mappedVisitors);
      setVehicles(mappedVehicles);
    } catch (error) {
      console.error('❌ Erro geral ao buscar visitantes:', error);
      setError('Erro ao carregar visitantes');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  // Função para contar filtros ativos
  const getActiveFiltersCount = () => {
    let count = 0;
    if (statusFilter !== 'todos') count++;
    if (typeFilter !== 'todos') count++;
    return count;
  };

  // Função para aplicar filtros do modal
  const applyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setTypeFilter(tempTypeFilter);
    setCurrentPage(1); // Reset pagination
    setFilterModalVisible(false);
  };

  // Função para cancelar filtros do modal
  const cancelFilters = () => {
    setTempStatusFilter(statusFilter);
    setTempTypeFilter(typeFilter);
    setFilterModalVisible(false);
  };

  // Função para filtrar e paginar visitantes
  const getFilteredAndPaginatedVisitors = () => {
    let filteredVisitors = visitors;
    let filteredVehicles = vehicles;

    // Aplicar filtro de status
    if (statusFilter !== 'todos') {
      filteredVisitors = visitors.filter(visitor => {
        // Normalizar status para comparação
        const visitorStatus = visitor.status?.toLowerCase();
        const filterStatus = statusFilter.toLowerCase();
        
        // Permitir apenas 'pendente' e 'expirado'
        if (filterStatus === 'pendente') {
          return visitorStatus === 'pendente';
        } else if (filterStatus === 'expirado') {
          return visitorStatus === 'expirado';
        }
        
        return false;
      });
    } else {
      // Quando 'todos', mostrar apenas visitantes com status 'pendente' ou 'expirado'
      filteredVisitors = visitors.filter(visitor => {
        const visitorStatus = visitor.status?.toLowerCase();
        return visitorStatus === 'pendente' || visitorStatus === 'expirado';
      });
    }

    // Aplicar filtro de tipo
    let combinedItems: any[] = [];
    
    if (typeFilter === 'todos') {
      // Mostrar visitantes e veículos
      combinedItems = [
        ...filteredVisitors.map(visitor => ({ ...visitor, itemType: 'visitor' })),
        ...filteredVehicles.map(vehicle => ({ ...vehicle, itemType: 'vehicle' }))
      ];
    } else if (typeFilter === 'visitantes') {
      // Mostrar apenas visitantes
      combinedItems = filteredVisitors.map(visitor => ({ ...visitor, itemType: 'visitor' }));
    } else if (typeFilter === 'veiculos') {
      // Mostrar apenas veículos
      combinedItems = filteredVehicles.map(vehicle => ({ ...vehicle, itemType: 'vehicle' }));
    }

    // Calcular paginação
    const totalPages = Math.ceil(combinedItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedItems = combinedItems.slice(startIndex, endIndex);

    return {
      visitors: paginatedItems.filter(item => item.itemType === 'visitor'),
      vehicles: paginatedItems.filter(item => item.itemType === 'vehicle'),
      totalPages,
      totalItems: combinedItems.length
    };
  };

  const formatDisplayDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  const getVisitorTypeIcon = (type: string) => {
    switch (type) {
      case 'frequente':
        return '⭐';
      case 'comum':
      default:
        return '👤';
    }
  };

  const getVisitorTypeText = (type: string) => {
    switch (type) {
      case 'frequente':
        return 'Frequente';
      case 'comum':
      default:
        return 'Comum';
    }
  };

  const getStatusIcon = (visitor: Visitor) => {
    switch (visitor.status?.toLowerCase()) {
      case 'expirado':
        return '❌';
      case 'pendente':
      default:
        return '⏳';
    }
  };

  const getStatusText = (visitor: Visitor) => {
    switch (visitor.status?.toLowerCase()) {
      case 'expirado':
        return 'Expirado';
      case 'pendente':
      default:
        return 'Pendente';
    }
  };

  // Função para gerar token único seguro
  const generateRegistrationToken = (): string => {
    // Implementação compatível com React Native usando Math.random()
    const chars = '0123456789abcdef';
    let token = '';
    for (let i = 0; i < 64; i++) { // 64 caracteres hex = 32 bytes
      token += chars[Math.floor(Math.random() * 16)];
    }
    return token;
  };

  // Função para calcular data de expiração (10 minutos)
  const getTokenExpirationDate = (): string => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return now.toISOString();
  };

  // Função para sanitizar entrada de texto
  const sanitizeInput = (input: string): string => {
    return input.trim().replace(/[<>"'&]/g, '');
  };

  // Função para validar formato de telefone brasileiro
  const validatePhoneNumber = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  };

  // Função para validar nome (apenas letras e espaços)
  const validateName = (name: string): boolean => {
    const nameRegex = /^[a-zA-ZÀ-ÿ\s]{2,50}$/;
    return nameRegex.test(name.trim());
  };

  // Função para validar formato de data (DD/MM/AAAA)
  const validateDate = (dateString: string): boolean => {
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateString.match(dateRegex);
    if (!match) return false;
    
    const [, day, month, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    return date.getDate() == parseInt(day) && 
           date.getMonth() == parseInt(month) - 1 && 
           date.getFullYear() == parseInt(year) &&
           date >= today; // Data deve ser atual ou futura
  };

  // Função para validar formato de horário (HH:MM)
  const validateTime = (timeString: string): boolean => {
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(timeString);
  };

  // Função para formatar data de visita
  const formatVisitDate = (dateString: string | null): string => {
    if (!dateString) return 'Data não definida';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Função para formatar horário de visita
  const formatVisitTime = (timeString: string | null): string => {
    if (!timeString) return '--:--';
    return timeString.substring(0, 5); // Pega apenas HH:MM
  };

  // Função para formatar período de visita completo
  const formatVisitPeriod = (date: string | null, startTime: string | null, endTime: string | null): string => {
    const formattedDate = formatVisitDate(date);
    const formattedStartTime = formatVisitTime(startTime);
    const formattedEndTime = formatVisitTime(endTime);
    
    if (date && (startTime || endTime)) {
      return `${formattedDate} das ${formattedStartTime} às ${formattedEndTime}`;
    }
    return 'Período não definido';
  };

  // Função para verificar conflitos de agendamento
  const checkSchedulingConflicts = async (visitData: any): Promise<{ hasConflict: boolean; message?: string }> => {
    try {
      // Usar apartment_id do estado
      const currentApartmentId = await loadApartmentId();
      if (!currentApartmentId) {
        throw new Error('Apartment_id não encontrado');
      }

      if (visitData.visit_type === 'pontual') {
        // Verificar conflitos para visitas pontuais na mesma data e horário
        const { data: conflicts } = await supabase
          .from('visitors')
          .select('id, name, visit_start_time, visit_end_time')
          .eq('apartment_id', currentApartmentId)
          .eq('visit_date', visitData.visit_date)
          .eq('visit_type', 'pontual')
          .eq('notification_status', 'approved')
          .neq('id', visitData.id || 0); // Excluir o próprio registro se for edição

        if (conflicts && conflicts.length > 0) {
          // Verificar sobreposição de horários
          const newStartMinutes = timeToMinutes(visitData.visit_start_time);
          const newEndMinutes = timeToMinutes(visitData.visit_end_time);

          for (const conflict of conflicts) {
            const existingStartMinutes = timeToMinutes(conflict.visit_start_time);
            const existingEndMinutes = timeToMinutes(conflict.visit_end_time);

            // Verificar se há sobreposição
            if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
              return {
                hasConflict: true,
                message: `Conflito de horário com visitante ${conflict.name} (${conflict.visit_start_time} - ${conflict.visit_end_time})`
              };
            }
          }
        }
      } else if (visitData.visit_type === 'frequente') {
        // Verificar conflitos para visitas frequentes nos mesmos dias e horários
        const { data: conflicts } = await supabase
          .from('visitors')
          .select('id, name, visit_start_time, visit_end_time, allowed_days')
          .eq('apartment_id', currentApartmentId)
          .eq('visit_type', 'frequente')
          .eq('notification_status', 'approved')
          .neq('id', visitData.id || 0);

        if (conflicts && conflicts.length > 0) {
          const newStartMinutes = timeToMinutes(visitData.visit_start_time);
          const newEndMinutes = timeToMinutes(visitData.visit_end_time);

          for (const conflict of conflicts) {
            // Verificar se há dias em comum
            const commonDays = visitData.allowed_days.filter((day: string) => 
              conflict.allowed_days.includes(day)
            );

            if (commonDays.length > 0) {
              const existingStartMinutes = timeToMinutes(conflict.visit_start_time);
              const existingEndMinutes = timeToMinutes(conflict.visit_end_time);

              // Verificar se há sobreposição de horários
              if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
                return {
                  hasConflict: true,
                  message: `Conflito de horário com visitante ${conflict.name} nos dias: ${commonDays.join(', ')} (${conflict.visit_start_time} - ${conflict.visit_end_time})`
                };
              }
            }
          }
        }
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('Erro ao verificar conflitos:', error);
      return { hasConflict: false }; // Em caso de erro, permitir o cadastro
    }
  };

  // Função para obter ícone do tipo de veículo
  const getVehicleTypeIcon = (type: string | null | undefined) => {
    switch (type) {
      case 'car':
        return '🚗';
      case 'motorcycle':
        return '🏍️';
      case 'truck':
        return '🚛';
      case 'van':
        return '🚐';
      case 'bus':
        return '🚌';
      default:
        return '🚗';
    }
  };

  // Função para obter texto do tipo de veículo
  const getVehicleTypeText = (type: string | null | undefined) => {
    switch (type) {
      case 'car':
        return 'Carro';
      case 'motorcycle':
        return 'Moto';
      case 'truck':
        return 'Caminhão';
      case 'van':
        return 'Van';
      case 'bus':
        return 'Ônibus';
      default:
        return 'Veículo';
    }
  };

  // Função auxiliar para converter horário em minutos
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Função para verificar limite de visitas simultâneas
  const checkSimultaneousVisitsLimit = async (visitData: any): Promise<{ exceedsLimit: boolean; message?: string }> => {
    try {
      // Garantir que temos o apartment_id
      const currentApartmentId = await loadApartmentId();
      if (!currentApartmentId) {
        throw new Error('Erro ao obter apartment_id');
      }

      const maxLimit = visitData.max_simultaneous_visits || 1;
      
      if (visitData.visit_type === 'pontual') {
        // Contar visitas pontuais na mesma data e horário
        const { data: simultaneousVisits } = await supabase
          .from('visitors')
          .select('id, name')
          .eq('apartment_id', currentApartmentId)
          .eq('visit_date', visitData.visit_date)
          .eq('visit_type', 'pontual')
          .eq('notification_status', 'approved')
          .neq('id', visitData.id || 0);

        if (simultaneousVisits && simultaneousVisits.length > 0) {
          const newStartMinutes = timeToMinutes(visitData.visit_start_time);
          const newEndMinutes = timeToMinutes(visitData.visit_end_time);
          
          // Contar visitas que se sobrepõem no horário
          let overlappingCount = 0;
          
          for (const visit of simultaneousVisits) {
            const { data: visitDetails } = await supabase
              .from('visitors')
              .select('visit_start_time, visit_end_time')
              .eq('id', visit.id)
              .maybeSingle();
              
            if (visitDetails) {
              const existingStartMinutes = timeToMinutes(visitDetails.visit_start_time);
              const existingEndMinutes = timeToMinutes(visitDetails.visit_end_time);
              
              // Verificar sobreposição
              if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
                overlappingCount++;
              }
            }
          }
          
          if (overlappingCount >= maxLimit) {
            return {
              exceedsLimit: true,
              message: `Limite de ${maxLimit} visita(s) simultânea(s) excedido. Já existem ${overlappingCount} visita(s) agendada(s) para este horário.`
            };
          }
        }
      } else if (visitData.visit_type === 'frequente') {
        // Para visitas frequentes, verificar limite por dia da semana
        const { data: frequentVisits } = await supabase
          .from('visitors')
          .select('id, name, allowed_days, visit_start_time, visit_end_time')
          .eq('apartment_id', currentApartmentId)
          .eq('visit_type', 'frequente')
          .eq('notification_status', 'approved')
          .neq('id', visitData.id || 0);

        if (frequentVisits && frequentVisits.length > 0) {
          const newStartMinutes = timeToMinutes(visitData.visit_start_time);
          const newEndMinutes = timeToMinutes(visitData.visit_end_time);
          
          // Verificar cada dia da semana
          for (const day of visitData.allowed_days) {
            let overlappingCount = 0;
            
            for (const visit of frequentVisits) {
              // Verificar se o visitante tem o mesmo dia permitido
              if (visit.allowed_days.includes(day)) {
                const existingStartMinutes = timeToMinutes(visit.visit_start_time);
                const existingEndMinutes = timeToMinutes(visit.visit_end_time);
                
                // Verificar sobreposição de horários
                if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
                  overlappingCount++;
                }
              }
            }
            
            if (overlappingCount >= maxLimit) {
              return {
                exceedsLimit: true,
                message: `Limite de ${maxLimit} visita(s) simultânea(s) excedido para ${day}. Já existem ${overlappingCount} visita(s) frequente(s) agendada(s) para este dia e horário.`
              };
            }
          }
        }
      }
      
      return { exceedsLimit: false };
    } catch (error) {
      console.error('Erro ao verificar limite de visitas simultâneas:', error);
      return { exceedsLimit: false }; // Em caso de erro, permitir o cadastro
    }
  };

  // Função para processar pré-cadastro
  const handlePreRegistration = async () => {
    if (isSubmittingPreRegistration) return;
    
    // Rate limiting - verificar cooldown
    const now = Date.now();
    if (now - lastRegistrationTime < REGISTRATION_COOLDOWN) {
      const remainingTime = Math.ceil((REGISTRATION_COOLDOWN - (now - lastRegistrationTime)) / 1000);
      Alert.alert('Aguarde', `Aguarde ${remainingTime} segundos antes de fazer outro pré-cadastro.`);
      return;
    }
    
    // Sanitizar dados de entrada
    const sanitizedName = sanitizeInput(preRegistrationData.name);
    const sanitizedPhone = sanitizeInput(preRegistrationData.phone);

    try {
      // Garantir que temos o apartment_id
      const currentApartmentId = await loadApartmentId();
      if (!currentApartmentId) {
        throw new Error('Erro ao obter apartment_id');
      }

    // Validar campos obrigatórios
    if (!sanitizedName || !sanitizedPhone) {
      Alert.alert('Erro', 'Nome completo e telefone são obrigatórios.');
      return;
    }

    // Validar nome
    if (!validateName(sanitizedName)) {
      Alert.alert('Erro', 'Nome deve conter apenas letras e espaços (2-50 caracteres).');
      return;
    }

    // Validar telefone
    if (!validatePhoneNumber(sanitizedPhone) || !validateBrazilianPhone(sanitizedPhone)) {
      Alert.alert('Erro', 'Número de telefone inválido. Use o formato (XX) 9XXXX-XXXX');
      return;
    }

    // Validações removidas: visit_reason e access_type não existem na tabela

    // Validar período de validade se fornecido
    if (preRegistrationData.validity_start && !validateDate(preRegistrationData.validity_start)) {
      Alert.alert('Erro', 'Data de início da validade inválida. Use o formato DD/MM/AAAA.');
      return;
    }

    if (preRegistrationData.validity_end && !validateDate(preRegistrationData.validity_end)) {
      Alert.alert('Erro', 'Data de fim da validade inválida. Use o formato DD/MM/AAAA.');
      return;
    }

    // Verificar se data de início é anterior à data de fim
    if (preRegistrationData.validity_start && preRegistrationData.validity_end) {
      const startDate = parseDate(preRegistrationData.validity_start);
      const endDate = parseDate(preRegistrationData.validity_end);
      if (startDate >= endDate) {
        Alert.alert('Erro', 'Data de início da validade deve ser anterior à data de fim.');
        return;
      }
    }

    // Validações específicas para agendamento
    if (preRegistrationData.visit_type === 'pontual') {
      if (!preRegistrationData.visit_date) {
        Alert.alert('Erro', 'Para visitas pontuais, a data é obrigatória.');
        return;
      }
      
      if (!validateDate(preRegistrationData.visit_date)) {
        Alert.alert('Erro', 'Data inválida. Use o formato DD/MM/AAAA e uma data atual ou futura.');
        return;
      }
      
      // Verificar horários apenas se ambos estiverem preenchidos
      const hasStartTime = preRegistrationData.visit_start_time && preRegistrationData.visit_start_time.trim() !== '';
      const hasEndTime = preRegistrationData.visit_end_time && preRegistrationData.visit_end_time.trim() !== '';
      
      // Se um horário está preenchido, ambos devem estar
      if (hasStartTime !== hasEndTime) {
        Alert.alert('Erro', 'Se definir horários, preencha tanto o horário de início quanto o de fim. Deixe ambos em branco para liberação 24h.');
        return;
      }
      
      // Se ambos os horários estão preenchidos, validar formato e sequência
      if (hasStartTime && hasEndTime) {
        if (!validateTime(preRegistrationData.visit_start_time) || !validateTime(preRegistrationData.visit_end_time)) {
          Alert.alert('Erro', 'Horário inválido. Use o formato HH:MM.');
          return;
        }
        
        // Verificar se horário de início é anterior ao de fim
        const [startHour, startMin] = preRegistrationData.visit_start_time.split(':').map(Number);
        const [endHour, endMin] = preRegistrationData.visit_end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (startMinutes >= endMinutes) {
          Alert.alert('Erro', 'Horário de início deve ser anterior ao horário de fim.');
          return;
        }
      }
    } else if (preRegistrationData.visit_type === 'frequente') {
      if (!preRegistrationData.allowed_days || preRegistrationData.allowed_days.length === 0) {
        Alert.alert('Erro', 'Para visitas frequentes, selecione pelo menos um dia da semana.');
        return;
      }
      
      // Verificar horários apenas se ambos estiverem preenchidos
      const hasStartTime = preRegistrationData.visit_start_time && preRegistrationData.visit_start_time.trim() !== '';
      const hasEndTime = preRegistrationData.visit_end_time && preRegistrationData.visit_end_time.trim() !== '';
      
      // Se um horário está preenchido, ambos devem estar
      if (hasStartTime !== hasEndTime) {
        Alert.alert('Erro', 'Se definir horários, preencha tanto o horário de início quanto o de fim. Deixe ambos em branco para liberação 24h.');
        return;
      }
      
      // Se ambos os horários estão preenchidos, validar formato e sequência
      if (hasStartTime && hasEndTime) {
        if (!validateTime(preRegistrationData.visit_start_time) || !validateTime(preRegistrationData.visit_end_time)) {
          Alert.alert('Erro', 'Horário inválido. Use o formato HH:MM.');
          return;
        }
        
        // Verificar se horário de início é anterior ao de fim
        const [startHour, startMin] = preRegistrationData.visit_start_time.split(':').map(Number);
        const [endHour, endMin] = preRegistrationData.visit_end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (startMinutes >= endMinutes) {
          Alert.alert('Erro', 'Horário de início deve ser anterior ao horário de fim.');
          return;
        }
      }
    }

      // Atualizar timestamp do último registro
      setLastRegistrationTime(now);

      setIsSubmittingPreRegistration(true);

      // Gerar token e data de expiração
      const registrationToken = generateRegistrationToken();
      const tokenExpiresAt = getTokenExpirationDate();

      // Determinar status inicial baseado no tipo de acesso selecionado
      const initialStatus = 'pendente';

      // Verificar se já existe visitante com mesmo nome e telefone
      const { data: existingVisitor } = await supabase
        .from('visitors')
        .select('id, name, phone, status')
        .eq('name', sanitizedName)
        .eq('phone', sanitizedPhone.replace(/\D/g, ''))
        .eq('apartment_id', currentApartmentId)
        .maybeSingle();

      console.log('🔍 Verificando visitante existente:', { name: sanitizedName, phone: sanitizedPhone, existingVisitor });

      if (existingVisitor) {
        // Se o visitante existe e está expirado, permitir recadastração
        if (existingVisitor.status?.toLowerCase() === 'expirado') {
          console.log('♻️ Visitante expirado encontrado, permitindo recadastração:', existingVisitor.id);
          
          // Atualizar visitante expirado ao invés de criar novo
          const updateData = {
            status: initialStatus,
            registration_token: registrationToken,
            token_expires_at: tokenExpiresAt,
            access_type: preRegistrationData.access_type || 'com_aprovacao',
            visit_type: preRegistrationData.visit_type,
            visit_start_time: preRegistrationData.visit_start_time || '00:00',
            visit_end_time: preRegistrationData.visit_end_time || '23:59',
            max_simultaneous_visits: preRegistrationData.max_simultaneous_visits || 1,
            is_recurring: preRegistrationData.visit_type === 'frequente',
            updated_at: new Date().toISOString()
          };

          // Adicionar campos específicos baseados no tipo de visita
          if (preRegistrationData.visit_type === 'pontual') {
            const [day, month, year] = preRegistrationData.visit_date.split('/');
            updateData.visit_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (preRegistrationData.visit_type === 'frequente') {
            updateData.allowed_days = preRegistrationData.allowed_days;
          }

          // Adicionar período de validade se fornecido
          if (preRegistrationData.validity_start) {
            const [day, month, year] = preRegistrationData.validity_start.split('/');
            updateData.validity_start = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }

          if (preRegistrationData.validity_end) {
            const [day, month, year] = preRegistrationData.validity_end.split('/');
            updateData.validity_end = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }

          console.log('📝 Atualizando visitante expirado com dados:', updateData);

          const { error: updateError } = await supabase
            .from('visitors')
            .update(updateData)
            .eq('id', existingVisitor.id);

          if (updateError) {
            console.error('❌ Erro ao atualizar visitante expirado:', updateError);
            Alert.alert('Erro', 'Erro ao recadastrar visitante. Tente novamente.');
            return;
          }

          console.log('✅ Visitante expirado recadastrado com sucesso:', existingVisitor.id);

          // Gerar senha temporária para o visitante recadastrado
          const temporaryPassword = await generateTemporaryPasswordForVisitor(
            sanitizedName,
            sanitizedPhone,
            existingVisitor.id
          );

          // Preparar dados do morador para WhatsApp
          const residentData: ResidentData = {
            name: user?.name || 'Morador',
            apartment: 'Apartamento', // Pode ser melhorado buscando o número do apartamento
            building: 'Edifício' // Pode ser melhorado buscando o nome do edifício
          };

          // Enviar mensagem via WhatsApp
          const registrationLink = `https://porteiroapp.com/visitante/completar-cadastro?token=${registrationToken}`;
          const whatsappMessage = generateWhatsAppMessage(
            sanitizedName,
            temporaryPassword,
            registrationLink,
            residentData
          );

          console.log('📱 Enviando WhatsApp para visitante recadastrado:', sanitizedPhone);
          
          try {
            await sendWhatsAppMessage(sanitizedPhone, whatsappMessage);
            console.log('✅ WhatsApp enviado com sucesso para visitante recadastrado');
          } catch (whatsappError) {
            console.error('❌ Erro ao enviar WhatsApp para visitante recadastrado:', whatsappError);
            // Não interrompe o fluxo se o WhatsApp falhar
          }

          Alert.alert(
            'Sucesso', 
            'Visitante recadastrado com sucesso! Uma nova mensagem com instruções foi enviada via WhatsApp.',
            [{ text: 'OK', onPress: () => {
              setShowPreRegistrationModal(false);
              fetchVisitors(); // Recarregar lista
            }}]
          );
          return;
        } else {
          // Se o visitante existe e não está expirado, mostrar erro
          console.log('⚠️ Visitante já existe com status:', existingVisitor.status);
          Alert.alert('Aviso', 'Já existe um visitante cadastrado com este nome e telefone.');
          return;
        }
      }

      // Preparar dados de agendamento
      let visitData: any = {
        name: sanitizedName,
        phone: sanitizedPhone.replace(/\D/g, ''),
        status: initialStatus,
        access_type: preRegistrationData.access_type || 'com_aprovacao', // Usar tipo selecionado pelo morador
        apartment_id: currentApartmentId,
        registration_token: registrationToken,
        token_expires_at: tokenExpiresAt,
        visit_type: preRegistrationData.visit_type,
        // Se os horários estão em branco, definir como liberação 24h (00:00 - 23:59)
        visit_start_time: preRegistrationData.visit_start_time || '00:00',
        visit_end_time: preRegistrationData.visit_end_time || '23:59',
        max_simultaneous_visits: preRegistrationData.max_simultaneous_visits || 1,
        is_recurring: preRegistrationData.visit_type === 'frequente'
      };

      // Adicionar período de validade se fornecido
      if (preRegistrationData.validity_start) {
        const [day, month, year] = preRegistrationData.validity_start.split('/');
        visitData.validity_start = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      if (preRegistrationData.validity_end) {
        const [day, month, year] = preRegistrationData.validity_end.split('/');
        visitData.validity_end = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // Adicionar campos específicos baseados no tipo de visita
      if (preRegistrationData.visit_type === 'pontual') {
        // Converter data DD/MM/AAAA para formato ISO (AAAA-MM-DD)
        const [day, month, year] = preRegistrationData.visit_date.split('/');
        visitData.visit_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else if (preRegistrationData.visit_type === 'frequente') {
         visitData.allowed_days = preRegistrationData.allowed_days;
       }

      // Verificar conflitos de agendamento
      const conflictCheck = await checkSchedulingConflicts(visitData);
      if (conflictCheck.hasConflict) {
        Alert.alert('Conflito de Agendamento', conflictCheck.message || 'Há um conflito de horário com outro visitante.');
        return;
      }

      // Verificar limite de visitas simultâneas
      const limitCheck = await checkSimultaneousVisitsLimit(visitData);
      if (limitCheck.exceedsLimit) {
        Alert.alert('Limite Excedido', limitCheck.message || 'Limite de visitas simultâneas excedido.');
        return;
      }

      // Inserir visitante na base de dados
      const { data: insertedVisitor, error: visitorError } = await supabase
        .from('visitors')
        .insert(visitData)
        .select()
        .single();

      if (visitorError) {
        console.error('Erro ao inserir visitante:', visitorError);
        
        // Tratamento específico para erros de coluna inexistente
        if (visitorError.code === '42703') {
          Alert.alert('Erro de Banco', 'Erro de estrutura do banco de dados. Verifique as colunas da tabela visitors.');
        } else if (visitorError.code === 'PGRST204') {
          Alert.alert('Erro de Coluna', 'Coluna não encontrada na tabela visitors. Verifique a estrutura do banco.');
        } else {
          Alert.alert('Erro', `Erro ao inserir visitante: ${visitorError.message}`);
        }
        return;
      }

      console.log('Visitante inserido com sucesso:', insertedVisitor);

      // Gerar senha temporária usando a função auxiliar
      const temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await hashPassword(temporaryPassword);
      console.log('Senha temporária gerada para visitante:', sanitizedPhone.replace(/\D/g, ''));

      // Gerar senha temporária (removida funcionalidade de armazenamento)
      const temporaryPasswordGenerated = await generateTemporaryPasswordForVisitor(
        sanitizedName, // nome do visitante
        sanitizedPhone.replace(/\D/g, ''), // telefone do visitante
        insertedVisitor.id // visitor_id do visitante inserido
      );

      // Buscar dados do apartamento e prédio para o WhatsApp
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select(`
          number,
          buildings!inner (
            name
          )
        `)
        .eq('id', currentApartmentId)
        .single();

      if (apartmentError || !apartmentData) {
        console.warn('⚠️ Não foi possível buscar dados do apartamento:', apartmentError);
      }

      const buildingName = apartmentData?.buildings?.name || 'Edifício';
      const apartmentNumber = apartmentData?.number || 'Apartamento';

      // Gerar link de completação do cadastro para visitantes
      const baseRegistrationUrl = process.env.EXPO_PUBLIC_REGISTRATION_SITE_URL || 'https://jamesavisa.jamesconcierge.com';
      const completionLink = `${baseRegistrationUrl}/cadastro/visitante/completar?token=${registrationToken}&phone=${encodeURIComponent(sanitizedPhone)}`;

      // Enviar mensagem via WhatsApp usando o serviço correto
      try {
        const { sendVisitorWhatsApp } = await import('../../../services/whatsappService');

        const whatsappResult = await sendVisitorWhatsApp({
          name: sanitizedName,
          phone: sanitizedPhone.replace(/\D/g, ''),
          building: buildingName,
          apartment: apartmentNumber,
          url: completionLink
        });

        if (whatsappResult.success) {
          console.log('✅ Mensagem WhatsApp enviada com sucesso para visitante');
        } else {
          console.warn('⚠️ Erro ao enviar WhatsApp:', whatsappResult.error);
        }
      } catch (whatsappError) {
        console.warn('⚠️ Não foi possível enviar WhatsApp (serviço pode estar indisponível):', whatsappError);
        // Não interrompe o fluxo se o WhatsApp falhar
      }

      // Sucesso no pré-cadastro independente do WhatsApp
      Alert.alert(
        'Sucesso!',
        `Pré-cadastro realizado com sucesso!\n\nO visitante receberá o link de completação via WhatsApp no número ${formatBrazilianPhone(sanitizedPhone)}.`,
        [{ text: 'OK', onPress: () => {
            setShowPreRegistrationModal(false);
            setPreRegistrationData({ 
              name: '', 
              phone: '', 
              visit_type: 'pontual',
              access_type: 'com_aprovacao',
              visit_date: '',
              visit_start_time: '',
              visit_end_time: '',
              allowed_days: [],
              max_simultaneous_visits: 1,
              validity_start: '',
              validity_end: ''
            });
            fetchVisitors(); // Atualizar lista
          }}]
        );
    } catch (error) {
      console.error('Erro no pré-cadastro:', error);
      Alert.alert('Erro', 'Erro ao realizar pré-cadastro. Tente novamente.');
    } finally {
      setIsSubmittingPreRegistration(false);
    }
  };

  // Função para verificar se o visitante está aprovado (não existe mais)
  const isVisitorApproved = (visitor: Visitor): boolean => {
    return false; // Não existem mais visitantes aprovados
  };

  // Função para verificar se o visitante está desaprovado (agora é expirado)
  const isVisitorDisapproved = (visitor: Visitor): boolean => {
    return visitor.status === 'expirado';
  };

  // Função para verificar se o visitante tem status final (apenas expirado)
  const hasVisitorFinalStatus = (visitor: Visitor): boolean => {
    return visitor.status === 'expirado';
  };

  // Função para verificar se o visitante pode ser editado
  const canEditVisitor = (visitor: Visitor): boolean => {
    return !hasVisitorFinalStatus(visitor);
  };

  // Função para abrir modal de edição com dados do visitante
  const handleEditVisitor = (visitor: Visitor) => {
    if (!canEditVisitor(visitor)) {
      Alert.alert(
        'Ação não permitida',
        'Visitantes aprovados não podem ser editados. O status foi bloqueado para manter a integridade dos dados.',
        [{ text: 'OK' }]
      );
      return;
    }
    setEditingVisitor(visitor);
    setEditData({
      name: visitor.name,
      phone: visitor.phone || '',
      visit_type: 'pontual', // Valor padrão, pode ser ajustado conforme necessário
      visit_date: '',
      visit_start_time: '',
      visit_end_time: '',
      allowed_days: [],
      max_simultaneous_visits: 1
    });
    setShowEditModal(true);
  };

  // Função para salvar alterações do visitante editado
  const handleSaveEditedVisitor = async () => {
    if (!editingVisitor) return;

    try {
      const sanitizedName = sanitizeInput(editData.name);
      const sanitizedPhone = sanitizeInput(editData.phone);

      // Validar campos obrigatórios
      if (!sanitizedName || !sanitizedPhone) {
        Alert.alert('Erro', 'Nome completo e telefone são obrigatórios.');
        return;
      }

      // Validar nome
      if (!validateName(sanitizedName)) {
        Alert.alert('Erro', 'Nome deve conter apenas letras e espaços (2-50 caracteres).');
        return;
      }

      // Validar telefone
      if (!validatePhoneNumber(sanitizedPhone)) {
        Alert.alert('Erro', 'Número de telefone inválido. Use o formato (XX) 9XXXX-XXXX');
        return;
      }

      // Atualizar visitante no banco de dados
      const { error: updateError } = await supabase
        .from('visitors')
        .update({
          name: sanitizedName,
          phone: sanitizedPhone.replace(/\D/g, ''),
          visitor_type: editData.visitor_type,
          access_type: editData.access_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingVisitor.id);

      if (updateError) {
        console.error('Erro ao atualizar visitante:', updateError);
        
        // Tratamento específico para erros de coluna inexistente
        if (updateError.code === '42703') {
          Alert.alert('Erro de Banco', 'Erro de estrutura do banco de dados. Verifique as colunas da tabela visitors.');
        } else if (updateError.code === 'PGRST204') {
          Alert.alert('Erro de Coluna', 'Coluna não encontrada na tabela visitors. Verifique a estrutura do banco.');
        } else {
          Alert.alert('Erro', `Erro ao atualizar visitante: ${updateError.message}`);
        }
        return;
      }

      Alert.alert(
        'Sucesso!',
        'Visitante atualizado com sucesso!',
        [{
          text: 'OK',
          onPress: () => {
            setShowEditModal(false);
            setEditingVisitor(null);
            setEditData({
              name: '',
              phone: '',
              visitor_type: 'comum',
              visit_type: 'pontual',
              access_type: 'com_aprovacao',
              visit_date: '',
              visit_start_time: '',
              visit_end_time: '',
              allowed_days: [],
              max_simultaneous_visits: 1
            });
            fetchVisitors(); // Atualizar lista
          }
        }]
      );
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      Alert.alert('Erro', 'Erro ao salvar alterações. Tente novamente.');
    }
  };

  // Função para excluir visitante com confirmação
  const handleDeleteVisitor = (visitor: Visitor) => {
    if (!canEditVisitor(visitor)) {
      Alert.alert(
        'Ação não permitida',
        'Visitantes aprovados não podem ser excluídos. O status foi bloqueado para manter a integridade dos dados.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o visitante "${visitor.name}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Excluir logs de visitante relacionados (visitor_logs)
              const { error: logsError } = await supabase
                .from('visitor_logs')
                .delete()
                .eq('visitor_id', visitor.id);

              if (logsError) {
                console.error('Erro ao excluir logs do visitante:', logsError);
                // Continuar mesmo se não houver logs para excluir
              }

              // 2. Senhas temporárias removidas (não mais necessárias)

              // 3. Por último, excluir o visitante
              const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', visitor.id);

              if (error) {
                console.error('Erro ao excluir visitante:', error);

                // Tratamento específico para foreign key constraint
                if (error.code === '23503') {
                  Alert.alert(
                    'Erro de Dependência',
                    'Este visitante possui registros associados que impedem sua exclusão. Entre em contato com o suporte.'
                  );
                } else if (error.code === '42703') {
                  Alert.alert('Erro de Banco', 'Erro de estrutura do banco de dados. Verifique as colunas da tabela visitors.');
                } else if (error.code === 'PGRST204') {
                  Alert.alert('Erro de Coluna', 'Coluna não encontrada na tabela visitors. Verifique a estrutura do banco.');
                } else {
                  Alert.alert('Erro', `Erro ao excluir visitante: ${error.message}`);
                }
                return;
              }

              Alert.alert('Sucesso', 'Visitante excluído com sucesso!');
              fetchVisitors(); // Atualizar lista
            } catch (error) {
              console.error('Erro ao excluir visitante:', error);
              Alert.alert('Erro', 'Erro ao excluir visitante. Tente novamente.');
            }
          }
        }
      ]
    );
  };

  // Funções de aprovação/desaprovação removidas - não são mais necessárias
  // O sistema agora trabalha apenas com status 'pendente' e 'expirado'

  return (
    <>
      <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Pré-cadastro de Visitantes</Text>
        <Text style={styles.sectionDescription}>
          Cadastre visitantes esperados para facilitar a entrada
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setShowPreRegistrationModal(true)}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.primaryButtonText}>Cadastrar Novo Visitante</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vehicleButton}
          onPress={() => router.push('/morador/veiculo')}>
          <Ionicons name="car" size={24} color="#fff" />
          <Text style={styles.vehicleButtonText}>Cadastrar Novo Veículo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📝 Visitantes Pré-cadastrados</Text>
          <View style={styles.headerButtons}>
           
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={fetchVisitors}
              disabled={loading}
            >
              <Ionicons 
                name="refresh" 
                size={20} 
                color={loading ? '#ccc' : '#4CAF50'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão de Filtros */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity 
            style={styles.filterModalButton}
            onPress={() => {
              setTempStatusFilter(statusFilter);
              setTempTypeFilter(typeFilter);
              setFilterModalVisible(true);
            }}
          >
            <Ionicons name="filter" size={20} color="#4CAF50" />
            <Text style={styles.filterModalButtonText}>
              Filtros {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando visitantes...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#f44336" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchVisitors}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : visitors.length === 0 && vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum visitante ou veículo cadastrado</Text>
            <Text style={styles.emptySubtext}>
              Cadastre visitantes e veículos para facilitar a entrada
            </Text>
          </View>
        ) : (
          <>
            {/* Renderizar veículos filtrados */}
            {getFilteredAndPaginatedVisitors().vehicles.map((vehicle) => (
              <View key={`vehicle-${vehicle.id}`} style={[styles.visitorCard, styles.vehicleCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardMainInfo}>
                    <Text style={styles.visitorName}>{vehicle.license_plate}</Text>
                    <View style={styles.visitorTypeContainer}>
                      <Text style={styles.visitorTypeIcon}>{getVehicleTypeIcon(vehicle.type)}</Text>
                      <Text style={styles.visitorTypeText}>{getVehicleTypeText(vehicle.type)}</Text>
                    </View>
                    {vehicle.brand && (
                      <Text style={styles.visitorDocument}>🏷️ {vehicle.brand} {vehicle.model || ''}</Text>
                    )}
                    {vehicle.color && (
                      <Text style={styles.visitorPhone}>🎨 {vehicle.color}</Text>
                    )}
                    <Text style={styles.visitorDate}>
                      Cadastrado: {formatDisplayDate(vehicle.created_at)}
                    </Text>
                    <View style={styles.visitorTypeContainer}>
                      <Text style={styles.visitorTypeIcon}>
                        {vehicle.ownership_type === 'visita' ? '👥' : '🏠'}
                      </Text>
                      <Text style={styles.visitorTypeText}>
                        {vehicle.ownership_type === 'visita' ? 'Veículo de Visita' : 'Veículo do Proprietário'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.cardHeaderActions}>
                    <View style={styles.vehicleBadge}>
                      <Text style={styles.vehicleBadgeText}>🚗 Veículo</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            
            {/* Renderizar visitantes filtrados */}
            {getFilteredAndPaginatedVisitors().visitors.map((visitor) => (
            <View key={visitor.id} style={[
              styles.visitorCard,
              hasVisitorFinalStatus(visitor) && styles.visitorCardApproved,
              visitor.status === 'expirado' && styles.visitorCardExpired
            ]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardMainInfo}>
                  <Text style={[
                    styles.visitorName,
                    hasVisitorFinalStatus(visitor) && styles.visitorNameApproved
                  ]}>{visitor.name}</Text>
                  {visitor.document && (
                    <Text style={styles.visitorDocument}>📄 {visitor.document}</Text>
                  )}
                  {visitor.phone && (
                    <Text style={styles.visitorPhone}>📞 {visitor.phone}</Text>
                  )}
                  <View style={styles.visitorTypeContainer}>
                    <Text style={styles.visitorTypeIcon}>{getVisitorTypeIcon(visitor.visitor_type)}</Text>
                    <Text style={styles.visitorTypeText}>{getVisitorTypeText(visitor.visitor_type)}</Text>
                  </View>
                  <Text style={styles.visitorDate}>
                    Cadastrado: {formatDisplayDate(visitor.created_at)}
                  </Text>
                  {(visitor.visit_date || visitor.visit_start_time || visitor.visit_end_time) && (
                    <View style={styles.visitScheduleContainer}>
                      <Text style={styles.visitScheduleLabel}>🕒 Período de Visita:</Text>
                      <Text style={styles.visitScheduleText}>
                        {formatVisitPeriod(visitor.visit_date, visitor.visit_start_time, visitor.visit_end_time)}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.cardHeaderActions}>
                  <View style={[
                    styles.statusBadge,
                    isVisitorDisapproved(visitor) && styles.statusBadgeDisapproved
                  ]}>
                    <Text style={styles.statusIcon}>{getStatusIcon(visitor)}</Text>
                    <Text style={[
                      styles.statusText,
                      isVisitorDisapproved(visitor) && styles.statusTextDisapproved
                    ]}>{getStatusText(visitor)}</Text>
                  </View>
                  
                  {/* Removido indicador "Expirado" incorreto - visitantes aprovados não devem mostrar como expirados */}
                  
                  <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => toggleCardExpansion(visitor.id)}
                  >
                    <Text style={styles.menuButtonText}>⋮</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {expandedCardId === visitor.id && (
                <View style={styles.expandedActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonDisabled
                    ]}
                    onPress={() => handleEditVisitor(visitor)}
                    disabled={hasVisitorFinalStatus(visitor)}
                  >
                    <Text style={[
                      styles.actionButtonText,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonTextDisabled
                    ]}>✏️ Editar</Text>
                  </TouchableOpacity>
                  

                  
                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      styles.actionButtonDanger
                    ]}
                    onPress={() => handleDeleteVisitor(visitor)}
                  >
                    <Text style={[
                      styles.actionButtonText, 
                      styles.actionButtonTextDanger
                    ]}>🗑️ Excluir</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          
          {/* Controles de paginação */}
          {(() => {
            const { totalPages } = getFilteredAndPaginatedVisitors();
            if (totalPages > 1) {
              return (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      currentPage === 1 && styles.paginationButtonDisabled
                    ]}
                    onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <Text style={[
                      styles.paginationButtonText,
                      currentPage === 1 && styles.paginationButtonTextDisabled
                    ]}>
                      ← Anterior
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.paginationInfo}>
                    Página {currentPage} de {totalPages}
                  </Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      currentPage === totalPages && styles.paginationButtonDisabled
                    ]}
                    onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <Text style={[
                      styles.paginationButtonText,
                      currentPage === totalPages && styles.paginationButtonTextDisabled
                    ]}>
                      Próxima →
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return null;
          })()}
          </>
        )}
      </View>

      {/* Modal de Pré-cadastro */}
      <Modal
        visible={showPreRegistrationModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPreRegistrationModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pré-cadastro de Visitantes</Text>
              <TouchableOpacity
                onPress={() => setShowPreRegistrationModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.textInput}
                  value={preRegistrationData.name}
                  onChangeText={(text) => setPreRegistrationData(prev => ({ ...prev, name: text }))}
                  placeholder="Digite o nome completo do visitante"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Telefone *</Text>
                <TextInput
                  style={styles.textInput}
                  value={preRegistrationData.phone}
                  maxLength={15}
                  onChangeText={(text) => {
                    // Remove tudo que não é dígito
                    const cleaned = text.replace(/\D/g, '');
                    // Limita a 11 dígitos
                    const limited = cleaned.slice(0, 11);
                    // Aplica a formatação (XX) 9XXXX-XXXX
                    let formatted = limited;
                    if (limited.length > 6) {
                      formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}${limited.slice(3, 7)}-${limited.slice(7)}`;
                    } else if (limited.length > 2) {
                      formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
                    } else if (limited.length > 0) {
                      formatted = `(${limited}`;
                    }
                    setPreRegistrationData(prev => ({ ...prev, phone: formatted }));
                  }}
                  placeholder="(XX) 9XXXX-XXXX"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tipo de Visita *</Text>
                <View style={styles.visitorTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.visit_type === 'pontual' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, visit_type: 'pontual' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.visit_type === 'pontual' && styles.visitorTypeButtonTextActive
                    ]}>Pontual</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.visit_type === 'frequente' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, visit_type: 'frequente' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.visit_type === 'frequente' && styles.visitorTypeButtonTextActive
                    ]}>Frequente</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.visit_type === 'prestador_servico' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, visit_type: 'prestador_servico' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.visit_type === 'prestador_servico' && styles.visitorTypeButtonTextActive
                    ]}>Serviço</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tipo de Aprovação *</Text>
                <View style={styles.visitorTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.access_type === 'com_aprovacao' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, access_type: 'com_aprovacao' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.access_type === 'com_aprovacao' && styles.visitorTypeButtonTextActive
                    ]}>Com Aprovação</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.access_type === 'direto' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, access_type: 'direto' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.access_type === 'direto' && styles.visitorTypeButtonTextActive
                    ]}>Liberação Direta</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Campos condicionais para visita pontual */}
              {preRegistrationData.visit_type === 'pontual' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Data da Visita *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={preRegistrationData.visit_date}
                      onChangeText={(text) => {
                        const formattedDate = formatDate(text);
                        setPreRegistrationData(prev => ({ ...prev, visit_date: formattedDate }));
                      }}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Início da Pré-liberação (opcional)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={preRegistrationData.visit_start_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setPreRegistrationData(prev => ({ ...prev, visit_start_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 15:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação (opcional)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={preRegistrationData.visit_end_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setPreRegistrationData(prev => ({ ...prev, visit_end_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 18:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      💡 Dica: Deixe os campos de horário em branco para liberação 24h (visitante pode entrar a qualquer hora do dia)
                    </Text>
                  </View>
                </>
              )}

              {/* Campos condicionais para visita frequente */}
              {preRegistrationData.visit_type === 'frequente' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Dias da Semana Permitidos *</Text>
                    <View style={styles.daysSelector}>
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, index) => {
                        const dayValue = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][index];
                        const isSelected = preRegistrationData.allowed_days?.includes(dayValue);
                        return (
                          <TouchableOpacity
                            key={dayValue}
                            style={[
                              styles.dayButton,
                              isSelected && styles.dayButtonActive
                            ]}
                            onPress={() => {
                              const currentDays = preRegistrationData.allowed_days || [];
                              const newDays = isSelected 
                                ? currentDays.filter(d => d !== dayValue)
                                : [...currentDays, dayValue];
                              setPreRegistrationData(prev => ({ ...prev, allowed_days: newDays }));
                            }}
                          >
                            <Text style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextActive
                            ]}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Início da Pré-liberação (opcional)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={preRegistrationData.visit_start_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setPreRegistrationData(prev => ({ ...prev, visit_start_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 08:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação (opcional)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={preRegistrationData.visit_end_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setPreRegistrationData(prev => ({ ...prev, visit_end_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 18:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      💡 Dica: Deixe os campos de horário em branco para liberação 24h (visitante pode entrar a qualquer hora do dia)
                    </Text>
                  </View>

                </>
              )}

              {/* Campos condicionais para prestador de serviço */}
              {preRegistrationData.visit_type === 'prestador_servico' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Data da Visita *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={preRegistrationData.visit_date}
                      onChangeText={(text) => {
                        const formattedDate = formatDate(text);
                        setPreRegistrationData(prev => ({ ...prev, visit_date: formattedDate }));
                      }}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Início da Pré-liberação (opcional)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={preRegistrationData.visit_start_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setPreRegistrationData(prev => ({ ...prev, visit_start_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 08:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação (opcional)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={preRegistrationData.visit_end_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setPreRegistrationData(prev => ({ ...prev, visit_end_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 18:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      💡 Dica: Deixe os campos de horário em branco para liberação 24h (visitante pode entrar a qualquer hora do dia)
                    </Text>
                  </View>
                </>
              )}

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPreRegistrationModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmittingPreRegistration && styles.submitButtonDisabled
                ]}
                onPress={handlePreRegistration}
                disabled={isSubmittingPreRegistration}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmittingPreRegistration ? 'Enviando...' : 'Cadastrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de Edição */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Visitante</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.name}
                  onChangeText={(text) => setEditData(prev => ({ ...prev, name: text }))}
                  placeholder="Digite o nome completo do visitante"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Telefone *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.phone}
                  onChangeText={(text) => setEditData(prev => ({ ...prev, phone: text }))}
                  placeholder="(XX) 9XXXX-XXXX"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tipo de Acesso *</Text>
                <View style={styles.visitorTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      editData.access_type === 'direto' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setEditData(prev => ({ ...prev, access_type: 'direto' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      editData.access_type === 'direto' && styles.visitorTypeButtonTextActive
                    ]}>Direto</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      editData.access_type === 'com_aprovacao' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setEditData(prev => ({ ...prev, access_type: 'com_aprovacao' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      editData.access_type === 'com_aprovacao' && styles.visitorTypeButtonTextActive
                    ]}>Com Aprovação</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tipo de Visitante *</Text>
                <View style={styles.visitorTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      editData.visitor_type === 'comum' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setEditData(prev => ({ ...prev, visitor_type: 'comum' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      editData.visitor_type === 'comum' && styles.visitorTypeButtonTextActive
                    ]}>Comum</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      editData.visitor_type === 'frequente' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setEditData(prev => ({ ...prev, visitor_type: 'frequente' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      editData.visitor_type === 'frequente' && styles.visitorTypeButtonTextActive
                    ]}>Frequente</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tipo de Visita *</Text>
                <View style={styles.visitorTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      editData.visit_type === 'pontual' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setEditData(prev => ({ ...prev, visit_type: 'pontual' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'pontual' && styles.visitorTypeButtonTextActive
                    ]}>Pontual</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      editData.visit_type === 'frequente' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setEditData(prev => ({ ...prev, visit_type: 'frequente' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      editData.visit_type === 'frequente' && styles.visitorTypeButtonTextActive
                    ]}>Frequente</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Campos condicionais para visita pontual */}
              {editData.visit_type === 'pontual' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Data da Visita *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.visit_date}
                      onChangeText={(text) => {
                        const formattedDate = formatDate(text);
                        setEditData(prev => ({ ...prev, visit_date: formattedDate }));
                      }}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Início da Pré-liberação *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editData.visit_start_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setEditData(prev => ({ ...prev, visit_start_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 15:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editData.visit_end_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setEditData(prev => ({ ...prev, visit_end_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 18:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Campos condicionais para visita frequente */}
              {editData.visit_type === 'frequente' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Dias da Semana Permitidos *</Text>
                    <View style={styles.daysSelector}>
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, index) => {
                        const dayValue = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][index];
                        const isSelected = editData.allowed_days?.includes(dayValue);
                        return (
                          <TouchableOpacity
                            key={dayValue}
                            style={[
                              styles.dayButton,
                              isSelected && styles.dayButtonActive
                            ]}
                            onPress={() => {
                              const currentDays = editData.allowed_days || [];
                              const newDays = isSelected
                                ? currentDays.filter(d => d !== dayValue)
                                : [...currentDays, dayValue];
                              setEditData(prev => ({ ...prev, allowed_days: newDays }));
                            }}
                          >
                            <Text style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextActive
                            ]}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Início *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editData.visit_start_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setEditData(prev => ({ ...prev, visit_start_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 08:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>

                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Fim *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editData.visit_end_time}
                        onChangeText={(text) => {
                          const formattedTime = formatTime(text);
                          setEditData(prev => ({ ...prev, visit_end_time: formattedTime }));
                        }}
                        placeholder="HH:MM (ex: 18:00)"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmittingPreRegistration && styles.submitButtonDisabled
                ]}
                onPress={handleSaveEditedVisitor}
                disabled={isSubmittingPreRegistration}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmittingPreRegistration ? 'Salvando...' : 'Salvar Alterações'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      </ScrollView>

      {/* Modal de Filtros */}
    <Modal
      visible={filterModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={cancelFilters}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros</Text>
            <TouchableOpacity onPress={cancelFilters}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Filtros de Status */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              <View style={styles.filterOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.modalFilterButton,
                    tempStatusFilter === 'todos' && styles.modalFilterButtonActive
                  ]}
                  onPress={() => setTempStatusFilter('todos')}
                >
                  <Text style={[
                    styles.modalFilterButtonText,
                    tempStatusFilter === 'todos' && styles.modalFilterButtonTextActive
                  ]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalFilterButton,
                    tempStatusFilter === 'pendente' && styles.modalFilterButtonActive
                  ]}
                  onPress={() => setTempStatusFilter('pendente')}
                >
                  <Text style={[
                    styles.modalFilterButtonText,
                    tempStatusFilter === 'pendente' && styles.modalFilterButtonTextActive
                  ]}>
                    Pendentes
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalFilterButton,
                    tempStatusFilter === 'expirado' && styles.modalFilterButtonActive
                  ]}
                  onPress={() => setTempStatusFilter('expirado')}
                >
                  <Text style={[
                    styles.modalFilterButtonText,
                    tempStatusFilter === 'expirado' && styles.modalFilterButtonTextActive
                  ]}>
                    Expirados
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Filtros de Tipo */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo</Text>
              <View style={styles.filterOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.modalFilterButton,
                    tempTypeFilter === 'todos' && styles.modalFilterButtonActive
                  ]}
                  onPress={() => setTempTypeFilter('todos')}
                >
                  <Text style={[
                    styles.modalFilterButtonText,
                    tempTypeFilter === 'todos' && styles.modalFilterButtonTextActive
                  ]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalFilterButton,
                    tempTypeFilter === 'visitantes' && styles.modalFilterButtonActive
                  ]}
                  onPress={() => setTempTypeFilter('visitantes')}
                >
                  <Text style={[
                    styles.modalFilterButtonText,
                    tempTypeFilter === 'visitantes' && styles.modalFilterButtonTextActive
                  ]}>
                    Visitantes
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalFilterButton,
                    tempTypeFilter === 'veiculos' && styles.modalFilterButtonActive
                  ]}
                  onPress={() => setTempTypeFilter('veiculos')}
                >
                  <Text style={[
                    styles.modalFilterButtonText,
                    tempTypeFilter === 'veiculos' && styles.modalFilterButtonTextActive
                  ]}>
                    Veículos
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={cancelFilters}
            >
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalApplyButton}
              onPress={applyFilters}
            >
              <Text style={styles.modalApplyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
       </View>
     </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  visitorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visitorCardApproved: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  visitorCardExpired: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorNameApproved: {
    color: '#999',
  },
  visitorTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitorTypeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  visitorTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  visitorDocument: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeDisapproved: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    color: '#2d5a2d',
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextDisapproved: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '500',
  },
  // Estilos do Modal
  modalOverlay: {
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  modalBody: {
    paddingHorizontal: 20,
    flex: 1,
  },
  inputGroup: {
    marginTop: 12,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  visitorTypeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  visitorTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  visitorTypeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  visitorTypeButtonText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    color: '#666',
  },
  visitorTypeButtonTextActive: {
    color: '#fff',
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginTop: 10,
    marginBottom: 35,
    borderLeftColor: '#4CAF50',
  }, 
  infoText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Estilos para campos de agendamento
  timeInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputGroup: {
    marginBottom: 36,
    flex: 1,
  },
  daysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    minWidth: 70,
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  // Estilos para o layout do card
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMainInfo: {
    flex: 1,
    paddingRight: 12,
  },
  cardHeaderActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  menuButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  expandedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  // Estilos para os botões de ação
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    flex: 1,
  },
  actionButton: {
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 70,
    alignItems: 'center',
    flex: 1,
  },
  actionButtonDanger: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffcdd2',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonTextDanger: {
    color: '#f44336',
  },
  actionButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
    opacity: 0.5,
  },
  actionButtonTextDisabled: {
    color: '#ccc',
  },
  approvedIndicator: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  approvedIndicatorText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Estilos para exibição do período de visita
  visitScheduleContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  visitScheduleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  visitScheduleText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  vehicleButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  vehicleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  vehicleCard: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  vehicleBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  vehicleBadgeText: {
    color: '#1976d2',
    fontSize: 12,
    fontWeight: '600',
  },
  filtersContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  filtersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#999',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterSeparator: {
    width: 1,
    height: 30,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  
  // Estilos do botão de filtro modal
  filterModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 8,
  },
  filterModalButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  
  // Estilos do modal
  modalOverlay: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '90%',
    maxWidth: 400,
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalFilterButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  modalFilterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modalFilterButtonTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalApplyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  modalApplyButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

});