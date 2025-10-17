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

// Função para armazenar senha temporária no banco de dados para visitantes
const storeTemporaryPassword = async (visitorName: string, visitorPhone: string, plainPassword: string, hashedPassword: string, visitorId: string): Promise<void> => {
  try {
    const insertData = {
      visitor_name: visitorName,
      visitor_phone: visitorPhone,
      plain_password: plainPassword,
      hashed_password: hashedPassword,
      visitor_id: visitorId,
      used: false,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias
    };

    console.log('🔑 Armazenando senha temporária para visitante:', visitorName, visitorPhone);

    const { error } = await supabase
      .from('visitor_temporary_passwords')
      .insert(insertData);
    
    if (error) {
      console.error('Erro ao armazenar senha temporária:', error);
      throw error;
    }
    
    console.log('✅ Senha temporária armazenada com sucesso na tabela visitor_temporary_passwords');
  } catch (error) {
    console.error('❌ Erro ao armazenar senha temporária:', error);
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

      // Mapear os dados
      const mappedVisitors: Visitor[] = (visitorsData || []).map(visitor => ({
        id: visitor.id,
        name: visitor.name || 'Nome não informado',
        document: visitor.document,
        phone: visitor.phone,
        photo_url: visitor.photo_url,
        status: visitor.status || 'aprovado',
        visitor_type: visitor.visitor_type || 'comum',
        access_type: visitor.access_type || 'com_aprovacao',
        created_at: visitor.created_at,
        updated_at: visitor.updated_at,
        apartment_id: visitor.apartment_id,
        visit_date: visitor.visit_date,
        visit_start_time: visitor.visit_start_time,
        visit_end_time: visitor.visit_end_time
      }));

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

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'aprovado':
        return '✅';
      case 'rejected':
      case 'negado':
      case 'nao_permitido':
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
      case 'nao_permitido':
        return 'Desaprovado';
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
      const initialStatus = preRegistrationData.access_type === 'direto' ? 'aprovado' : 'pendente';

      // Verificar se já existe visitante com mesmo nome e telefone
      const { data: existingVisitor } = await supabase
        .from('visitors')
        .select('id, name, phone')
        .eq('name', sanitizedName)
        .eq('phone', sanitizedPhone.replace(/\D/g, ''))
        .eq('apartment_id', currentApartmentId)
        .maybeSingle();

      if (existingVisitor) {
        Alert.alert('Aviso', 'Já existe um visitante cadastrado com este nome e telefone.');
        return;
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

      // Armazenar senha temporária usando a função auxiliar
      await storeTemporaryPassword(
        sanitizedName, // nome do visitante
        sanitizedPhone.replace(/\D/g, ''), // telefone do visitante
        temporaryPassword,
        hashedPassword,
        insertedVisitor.id // visitor_id do visitante inserido
      );

      // Gerar link de completação do cadastro para visitantes
      const baseRegistrationUrl = process.env.EXPO_PUBLIC_REGISTRATION_SITE_URL || 'https://jamesavisa.jamesconcierge.com';
      const completionLink = `${baseRegistrationUrl}/cadastro/visitante/completar?token=${registrationToken}&phone=${encodeURIComponent(sanitizedPhone)}`;

      // Preparar dados para WhatsApp seguindo o mesmo formato dos moradores
      const visitorData: ResidentData = {
        name: sanitizedName,
        phone: sanitizedPhone,
        building: 'Edifício', // Pode ser obtido dos dados do apartamento se necessário
        apartment: 'Visitante' // Identificar como visitante
      };

      // Gerar mensagem personalizada para visitante
      const whatsappData = generateWhatsAppMessage(visitorData, completionLink);
      
      // Personalizar mensagem para visitante
      const visitorMessage = whatsappData.message.replace(
        'Olá! Você foi cadastrado como morador',
        `Olá ${sanitizedName}! Você foi pré-cadastrado como visitante`
      ).replace(
        'complete seu cadastro de morador',
        'complete seu cadastro de visitante'
      ).replace(
        'Sua senha temporária é:',
        `Sua senha temporária para acesso é: ${temporaryPassword}\n\nEsta senha expira em 7 dias.\n\nSua senha temporária é:`
      );

      // Enviar mensagem via WhatsApp (serviço temporariamente desabilitado)
      // TODO: Reativar quando API do WhatsApp estiver disponível
      try {
        // Tentar enviar WhatsApp usando a função disponível
        await sendWhatsAppMessage({
          phone: sanitizedPhone,
          message: `Olá ${sanitizedName}! Você foi pré-cadastrado como visitante.\n\nComplete seu cadastro através do link:\n${completionLink}\n\nSenha temporária: ${temporaryPassword}\n\nEsta senha expira em 7 dias.`
        });

        console.log('✅ Mensagem WhatsApp enviada com sucesso');
      } catch (whatsappError) {
        console.warn('⚠️ Não foi possível enviar WhatsApp (serviço pode estar indisponível):', whatsappError);
        // Não interrompe o fluxo se o WhatsApp falhar
      }

      // Sucesso no pré-cadastro independente do WhatsApp
      Alert.alert(
        'Sucesso!',
        `Pré-cadastro realizado com sucesso!\n\nO visitante receberá o link de completação via WhatsApp no número ${formatBrazilianPhone(sanitizedPhone)}.\n\nLink: ${completionLink}\nSenha: ${temporaryPassword}`,
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

  // Função para verificar se o visitante está aprovado
  const isVisitorApproved = (visitor: Visitor): boolean => {
    return visitor.status === 'aprovado' || visitor.status === 'approved';
  };

  // Função para verificar se o visitante está desaprovado
  const isVisitorDisapproved = (visitor: Visitor): boolean => {
    return visitor.status === 'nao_permitido' || visitor.status === 'rejected' || visitor.status === 'negado';
  };

  // Função para verificar se o visitante tem status final (aprovado ou desaprovado)
  const hasVisitorFinalStatus = (visitor: Visitor): boolean => {
    return isVisitorApproved(visitor) || isVisitorDisapproved(visitor);
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

              // 2. Excluir senhas temporárias relacionadas
              const { error: passwordError } = await supabase
                .from('visitor_temporary_passwords')
                .delete()
                .eq('visitor_id', visitor.id);

              if (passwordError) {
                console.error('Erro ao excluir senhas temporárias:', passwordError);
                // Continuar mesmo se não houver senhas para excluir
              }

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

  // Função para aprovar visitante
  const handleApproveVisitor = async (visitor: Visitor) => {
    if (hasVisitorFinalStatus(visitor)) {
      Alert.alert(
        'Ação não permitida',
        'Este visitante já possui um status final (aprovado ou desaprovado) e não pode ser modificado.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('visitors')
        .update({
          status: 'aprovado',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitor.id);

      if (error) {
        console.error('Erro ao aprovar visitante:', error);
        
        // Tratamento específico para erros de coluna inexistente
        if (error.code === '42703') {
          Alert.alert('Erro de Banco', 'Erro de estrutura do banco de dados. Verifique as colunas da tabela visitors.');
        } else if (error.code === 'PGRST204') {
          Alert.alert('Erro de Coluna', 'Coluna não encontrada na tabela visitors. Verifique a estrutura do banco.');
        } else {
          Alert.alert('Erro', `Erro ao aprovar visitante: ${error.message}`);
        }
        return;
      }

      Alert.alert('Sucesso', 'Visitante aprovado com sucesso! O status foi bloqueado para evitar alterações futuras.');
      fetchVisitors(); // Atualizar lista
    } catch (error) {
      console.error('Erro ao aprovar visitante:', error);
      Alert.alert('Erro', 'Erro ao aprovar visitante. Tente novamente.');
    }
  };

  // Função para desaprovar visitante
  const handleDisapproveVisitor = async (visitor: Visitor) => {
    if (isVisitorDisapproved(visitor)) {
      Alert.alert(
        'Ação não permitida',
        'Este visitante já foi desaprovado.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('visitors')
        .update({
          status: 'nao_permitido',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitor.id);

      if (error) {
        console.error('Erro ao desaprovar visitante:', error);
        
        // Tratamento específico para erros de coluna inexistente
        if (error.code === '42703') {
          Alert.alert('Erro de Banco', 'Erro de estrutura do banco de dados. Verifique as colunas da tabela visitors.');
        } else if (error.code === 'PGRST204') {
          Alert.alert('Erro de Coluna', 'Coluna não encontrada na tabela visitors. Verifique a estrutura do banco.');
        } else {
          Alert.alert('Erro', `Erro ao desaprovar visitante: ${error.message}`);
        }
        return;
      }

      Alert.alert('Sucesso', 'Visitante desaprovado com sucesso!');
      fetchVisitors(); // Atualizar lista
    } catch (error) {
      console.error('Erro ao desaprovar visitante:', error);
      Alert.alert('Erro', 'Erro ao desaprovar visitante. Tente novamente.');
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
            <View key={visitor.id} style={[
              styles.visitorCard,
              hasVisitorFinalStatus(visitor) && styles.visitorCardApproved
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
                    <Text style={styles.statusIcon}>{getStatusIcon(visitor.status)}</Text>
                    <Text style={[
                      styles.statusText,
                      isVisitorDisapproved(visitor) && styles.statusTextDisapproved
                    ]}>{getStatusText(visitor.status)}</Text>
                  </View>
                  
                  {hasVisitorFinalStatus(visitor) && (
                    <View style={styles.approvedIndicator}>
                      <Text style={styles.approvedIndicatorText}>🔒 Bloqueado</Text>
                    </View>
                  )}
                  
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
                      hasVisitorFinalStatus(visitor) && styles.actionButtonDisabled
                    ]}
                    onPress={() => handleApproveVisitor(visitor)}
                    disabled={hasVisitorFinalStatus(visitor)}
                  >
                    <Text style={[
                      styles.actionButtonText,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonTextDisabled
                    ]}>✅ Aprovar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.actionButton,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonDisabled
                    ]}
                    onPress={() => handleDisapproveVisitor(visitor)}
                    disabled={hasVisitorFinalStatus(visitor)}
                  >
                    <Text style={[
                      styles.actionButtonText,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonTextDisabled
                    ]}>❌ Desaprovar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      styles.actionButtonDanger,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonDisabled
                    ]}
                    onPress={() => handleDeleteVisitor(visitor)}
                    disabled={hasVisitorFinalStatus(visitor)}
                  >
                    <Text style={[
                      styles.actionButtonText, 
                      styles.actionButtonTextDanger,
                      hasVisitorFinalStatus(visitor) && styles.actionButtonTextDisabled
                    ]}>🗑️ Excluir</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                  onChangeText={(text) => setPreRegistrationData(prev => ({ ...prev, phone: text }))}
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
                    ]}>Prestador de Serviço</Text>
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

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {preRegistrationData.visit_type === 'frequente' 
                    ? '• Visitantes frequentes têm acesso liberado nos dias e horários definidos\n• Ideal para prestadores de serviço regulares\n• O horário define o período em que podem entrar (ex: das 08h às 18h)\n• Acesso sempre requer aprovação do porteiro'
                    : '• Visitantes pontuais têm acesso apenas na data específica\n• Status retorna a "não permitido" após a visita\n• O horário define o período em que podem entrar (ex: das 15h às 18h)\n• Acesso sempre requer aprovação do porteiro'
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 0,
    width: '100%',
    height: '100%',
    marginTop: 0,
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
    paddingTop: 15,
    flex: 1,
  },
  inputGroup: {
    marginTop: 12,
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

});