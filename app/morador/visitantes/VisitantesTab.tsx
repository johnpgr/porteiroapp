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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DateTimePickerAndroid from '@react-native-community/datetimepicker';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { 
  sendWhatsAppMessage, 
  validateBrazilianPhone, 
  formatBrazilianPhone,
  type ResidentData 
} from '../../../utils/whatsapp';

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
  if (year < new Date().getFullYear()) return false;
  
  // Verifica se a data é válida
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
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

interface Visitor {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  photo_url: string | null;
  status: string;
  visitor_type: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  apartment_id: string;
  registration_token?: string;
  token_expires_at?: string;
}

interface PreRegistrationData {
  name: string;
  phone: string;
  visitor_type: 'comum' | 'frequente';
  visit_type: 'pontual' | 'frequente';
  visit_date?: string;
  visit_start_time?: string;
  visit_end_time?: string;
  allowed_days?: string[];
  max_simultaneous_visits?: number;
}

export default function VisitantesTab() {
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreRegistrationModal, setShowPreRegistrationModal] = useState(false);
  const [preRegistrationData, setPreRegistrationData] = useState<PreRegistrationData>({
    name: '',
    phone: '',
    visitor_type: 'comum',
    visit_type: 'pontual',
    visit_date: '',
    visit_start_time: '',
    visit_end_time: '',
    allowed_days: [],
    max_simultaneous_visits: 1
  });
  
  // Estado para armazenar apartment_id e evitar múltiplas consultas
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [apartmentIdLoading, setApartmentIdLoading] = useState(false);
  
  // Rate limiting para pré-cadastros
  const [lastRegistrationTime, setLastRegistrationTime] = useState<number>(0);
  const REGISTRATION_COOLDOWN = 30000; // 30 segundos entre registros
  const [isSubmittingPreRegistration, setIsSubmittingPreRegistration] = useState(false);
  
  // Estados para o DatePicker modal
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Função para mostrar o DatePicker com tratamento específico para iOS
  const showDatePickerModal = () => {
    if (Platform.OS === 'ios') {
      setShowDatePicker(true);
    } else {
      // Para Android, usar o DateTimePickerAndroid
      DateTimePickerAndroid.open({
        value: selectedDate,
        onChange: (event, date) => {
          if (date) {
            setSelectedDate(date);
            const formattedDate = date.toLocaleDateString('pt-BR');
            setPreRegistrationData(prev => ({ ...prev, visit_date: formattedDate }));
          }
        },
        mode: 'date',
        is24Hour: true,
      });
    }
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
        .single();

      if (profileError || !profileData) {
        throw new Error('Erro ao buscar perfil do usuário');
      }

      // Buscar apartment_id usando profile_id
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select('apartment_id')
        .eq('profile_id', profileData.id)
        .single();

      if (apartmentError || !apartmentData?.apartment_id) {
        throw new Error('Erro ao buscar apartment_id');
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
          created_at,
          updated_at,
          is_active,
          apartment_id
        `)
        .eq('apartment_id', currentApartmentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (visitorsError) {
        console.error('❌ Erro ao buscar visitantes:', visitorsError);
        throw visitorsError;
      }

      console.log('✅ Visitantes encontrados para o apartamento:', visitorsData?.length || 0);
      console.log('📊 Dados dos visitantes:', visitorsData);

      // Mapear os dados
      const mappedVisitors: Visitor[] = (visitorsData || []).map(visitor => ({
        id: visitor.id,
        name: visitor.name || 'Nome não informado',
        document: visitor.document,
        phone: visitor.phone,
        photo_url: visitor.photo_url,
        status: visitor.status || 'approved',
        visitor_type: visitor.visitor_type || 'comum',
        created_at: visitor.created_at,
        updated_at: visitor.updated_at,
        is_active: visitor.is_active,
        apartment_id: visitor.apartment_id
      }));

      console.log('✅ [VisitantesTab] Mapped visitors:', mappedVisitors);
      setVisitors(mappedVisitors);
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

  const formatDate = (dateString: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'aprovado':
        return '✅';
      case 'rejected':
      case 'negado':
        return '❌';
      case 'pending':
      case 'pendente':
      default:
        return '⏳';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'aprovado':
        return 'Aprovado';
      case 'rejected':
      case 'negado':
        return 'Negado';
      case 'pending':
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
    return date.getDate() == parseInt(day) && 
           date.getMonth() == parseInt(month) - 1 && 
           date.getFullYear() == parseInt(year) &&
           date >= new Date(); // Data deve ser futura
  };

  // Função para validar formato de horário (HH:MM)
  const validateTime = (timeString: string): boolean => {
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(timeString);
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
              .single();
              
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

    // Validações específicas para agendamento
    if (preRegistrationData.visit_type === 'pontual') {
      if (!preRegistrationData.visit_date || !preRegistrationData.visit_start_time || !preRegistrationData.visit_end_time) {
        Alert.alert('Erro', 'Para visitas pontuais, data e horários são obrigatórios.');
        return;
      }
      
      if (!validateDate(preRegistrationData.visit_date)) {
        Alert.alert('Erro', 'Data inválida. Use o formato DD/MM/AAAA e uma data futura.');
        return;
      }
      
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
    } else if (preRegistrationData.visit_type === 'frequente') {
      if (!preRegistrationData.allowed_days || preRegistrationData.allowed_days.length === 0) {
        Alert.alert('Erro', 'Para visitas frequentes, selecione pelo menos um dia da semana.');
        return;
      }
      
      if (!preRegistrationData.visit_start_time || !preRegistrationData.visit_end_time) {
        Alert.alert('Erro', 'Para visitas frequentes, horários são obrigatórios.');
        return;
      }
      
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

      // Atualizar timestamp do último registro
      setLastRegistrationTime(now);

      setIsSubmittingPreRegistration(true);

      // Gerar token e data de expiração
      const registrationToken = generateRegistrationToken();
      const tokenExpiresAt = getTokenExpirationDate();

      // Determinar status inicial baseado no tipo de visitante
      const initialStatus = preRegistrationData.visitor_type === 'frequente' ? 'aprovado' : 'pendente';

      // Verificar se já existe visitante com mesmo nome e telefone
      const { data: existingVisitor } = await supabase
        .from('visitors')
        .select('id, name, phone')
        .eq('name', sanitizedName)
        .eq('phone', sanitizedPhone.replace(/\D/g, ''))
        .eq('apartment_id', currentApartmentId)
        .single();

      if (existingVisitor) {
        Alert.alert('Aviso', 'Já existe um visitante cadastrado com este nome e telefone.');
        return;
      }

      // Preparar dados de agendamento
      let visitData: any = {
        name: sanitizedName,
        phone: sanitizedPhone.replace(/\D/g, ''),
        visitor_type: preRegistrationData.visitor_type,
        status: initialStatus,
        apartment_id: currentApartmentId,
        registration_token: registrationToken,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        visit_type: preRegistrationData.visit_type,
        visit_start_time: preRegistrationData.visit_start_time,
        visit_end_time: preRegistrationData.visit_end_time,
        max_simultaneous_visits: preRegistrationData.max_simultaneous_visits || 1,
        is_recurring: preRegistrationData.visit_type === 'frequente'
      };

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
      const { error: visitorError } = await supabase
        .from('visitors')
        .insert(visitData)
        .select()
        .single();

      if (visitorError) {
        throw visitorError;
      }

      // Gerar link de completação do cadastro
      const baseRegistrationUrl = process.env.EXPO_PUBLIC_REGISTRATION_SITE_URL || 'https://jamesavisa.jamesconcierge.com';
      const completionLink = `${baseRegistrationUrl}/complete?token=${registrationToken}`;

      // Preparar dados para WhatsApp
      const residentData: ResidentData = {
        name: preRegistrationData.name,
        phone: preRegistrationData.phone,
        building: 'Edifício', // Pode ser obtido dos dados do apartamento se necessário
        apartment: 'Apt' // Pode ser obtido dos dados do apartamento se necessário
      };

      // Enviar mensagem via WhatsApp
      const whatsappResult = await sendWhatsAppMessage(residentData, completionLink);

      if (whatsappResult.success) {
        Alert.alert(
          'Sucesso!', 
          `Pré-cadastro realizado com sucesso!\n\nUm link foi enviado via WhatsApp para ${formatBrazilianPhone(preRegistrationData.phone)} para completar o cadastro.\n\nO link expira em 10 minutos.`,
          [{ text: 'OK', onPress: () => {
            setShowPreRegistrationModal(false);
            setPreRegistrationData({ 
              name: '', 
              phone: '', 
              visitor_type: 'comum',
              visit_type: 'pontual',
              visit_date: '',
              visit_start_time: '',
              visit_end_time: '',
              allowed_days: [],
              max_simultaneous_visits: 1
            });
            fetchVisitors(); // Atualizar lista
          }}]
        );
      } else {
        Alert.alert(
          'Atenção', 
          `Pré-cadastro realizado, mas houve erro no envio do WhatsApp: ${whatsappResult.error}\n\nO visitante foi cadastrado e pode completar o registro posteriormente.`,
          [{ text: 'OK', onPress: () => {
            setShowPreRegistrationModal(false);
            setPreRegistrationData({ 
              name: '', 
              phone: '', 
              visitor_type: 'comum',
              visit_type: 'pontual',
              visit_date: '',
              visit_start_time: '',
              visit_end_time: '',
              allowed_days: [],
              max_simultaneous_visits: 1
            });
            fetchVisitors();
          }}]
        );
      }
    } catch (error) {
      console.error('Erro no pré-cadastro:', error);
      Alert.alert('Erro', 'Erro ao realizar pré-cadastro. Tente novamente.');
    } finally {
      setIsSubmittingPreRegistration(false);
    }
  };



  return (
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
        ) : visitors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum visitante pré-cadastrado</Text>
            <Text style={styles.emptySubtext}>
              Cadastre visitantes esperados para facilitar a entrada
            </Text>
          </View>
        ) : (
          visitors.map((visitor) => (
            <View key={visitor.id} style={styles.visitorCard}>
              <Text style={styles.visitorName}>{visitor.name}</Text>
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
                Cadastrado: {formatDate(visitor.created_at)}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editButton}>
                  <Text style={styles.editButtonText}>✏️ Editar</Text>
                </TouchableOpacity>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusIcon}>{getStatusIcon(visitor.status)}</Text>
                  <Text style={styles.statusText}>{getStatusText(visitor.status)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Modal de Pré-cadastro */}
      <Modal
        visible={showPreRegistrationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreRegistrationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pré-cadastro de Visitante</Text>
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
                  onChangeText={(text) => setPreRegistrationData(prev => ({ ...prev, phone: text }))}
                  placeholder="(XX) 9XXXX-XXXX"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tipo de Visitante *</Text>
                <View style={styles.visitorTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.visitor_type === 'comum' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, visitor_type: 'comum' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.visitor_type === 'comum' && styles.visitorTypeButtonTextActive
                    ]}>Comum</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visitorTypeButton,
                      preRegistrationData.visitor_type === 'frequente' && styles.visitorTypeButtonActive
                    ]}
                    onPress={() => setPreRegistrationData(prev => ({ ...prev, visitor_type: 'frequente' }))}
                  >
                    <Text style={[
                      styles.visitorTypeButtonText,
                      preRegistrationData.visitor_type === 'frequente' && styles.visitorTypeButtonTextActive
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
                </View>
              </View>

              {/* Campos condicionais para visita pontual */}
              {preRegistrationData.visit_type === 'pontual' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Data da Visita *</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={showDatePickerModal}
                    >
                      <Text style={[
                        styles.datePickerButtonText,
                        !preRegistrationData.visit_date && styles.datePickerPlaceholder
                      ]}>
                        {preRegistrationData.visit_date || 'DD/MM/AAAA'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.inputLabel}>Horário de Início da Pré-liberação *</Text>
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
                      <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação *</Text>
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
                      <Text style={styles.inputLabel}>Horário de Início da Pré-liberação *</Text>
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
                      <Text style={styles.inputLabel}>Horário de Fim da Pré-liberação *</Text>
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

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Máximo de Visitas Simultâneas</Text>
                    <TextInput
                      style={styles.textInput}
                      value={preRegistrationData.max_simultaneous_visits?.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 1;
                        setPreRegistrationData(prev => ({ ...prev, max_simultaneous_visits: num }));
                      }}
                      placeholder="1"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                  </View>
                </>
              )}

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {preRegistrationData.visitor_type === 'frequente' 
                    ? '• Visitantes frequentes mantêm acesso aprovado permanentemente\n• Ideal para prestadores de serviço regulares\n• O horário define o período em que podem entrar (ex: das 08h às 18h)'
                    : '• Visitantes comuns precisam de aprovação a cada visita\n• Status retorna a "não permitido" após cada verificação\n• O horário define o período em que podem entrar (ex: das 15h às 18h)'
                  }
                </Text>
              </View>
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
                  {isSubmittingPreRegistration ? 'Enviando...' : 'Enviar Link WhatsApp'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal do DatePicker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            if (Platform.OS === 'ios') {
              setShowDatePicker(false);
            }
            if (date) {
              setSelectedDate(date);
              const formattedDate = date.toLocaleDateString('pt-BR');
              setPreRegistrationData(prev => ({ ...prev, visit_date: formattedDate }));
            }
            if (Platform.OS === 'android' && event.type === 'dismissed') {
              setShowDatePicker(false);
            }
          }}
        />
      )}
    </ScrollView>
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
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
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
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    color: '#2d5a2d',
    fontSize: 12,
    fontWeight: '500',
  },
  // Estilos do Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 0,
    width: '100%',
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
    marginTop: 15,
    paddingHorizontal: 20
  },
  inputGroup: {
    marginBottom: 16,
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
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  visitorTypeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  visitorTypeButtonText: {
    fontSize: 14,
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
    borderLeftColor: '#4CAF50',
  },
  infoText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
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
  // Estilos para o botão do DatePicker
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerPlaceholder: {
    color: '#999',
  },
});