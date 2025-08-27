import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase, adminAuth } from '../../utils/supabase';
import { router } from 'expo-router';

interface Building {
  id: string;
  name: string;
}

interface Log {
  id: string;
  visitor_name: string;
  visitor_document: string;
  apartment_number: string;
  building_name: string;
  log_time: string;
  tipo_log: 'IN' | 'OUT';
  visit_session_id: string;
  purpose?: string;
  notification_status: string;
  authorized_by_name?: string;
  created_at: string;
}

// Funções de formatação
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

const formatDate = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara DD/MM/YYYY
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

// Funções de validação
const validateTime = (timeString: string): boolean => {
  if (!timeString || timeString.length !== 5) return false;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  
  return true;
};

const validateDate = (dateString: string): boolean => {
  if (!dateString || dateString.length !== 10) return false;
  
  const [day, month, year] = dateString.split('/').map(Number);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;
  
  // Validação mais específica de data
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export default function SystemLogs() {
  const [activeTab, setActiveTab] = useState('logs');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [logSearchType, setLogSearchType] = useState('all'); // 'all', 'morador', 'porteiro', 'predio', 'acao'
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logBuildingFilter, setLogBuildingFilter] = useState('');
  const [logMovementFilter, setLogMovementFilter] = useState('all');
  const [logDateFilter, setLogDateFilter] = useState({
    start: null as Date | null,
    end: null as Date | null,
  });
  // Estados para os campos de hora e data formatados
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [
    logSearchType,
    logSearchQuery,
    logBuildingFilter,
    logMovementFilter,
    logDateFilter,
    logs,
  ]);

  const fetchData = async () => {
    try {
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('Administrador não encontrado');
        router.push('/');
        return;
      }

      // Buscar apenas os prédios gerenciados pelo administrador atual
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map(b => b.id) || [];

      if (buildingIds.length === 0) {
        console.log('Nenhum prédio encontrado para este administrador');
        setBuildings([]);
        setLogs([]);
        return;
      }

      // Buscar logs de visitantes com joins para obter informações completas
      const logsData = await supabase
        .from('visitor_logs')
        .select(`
          id,
          log_time,
          tipo_log,
          visit_session_id,
          purpose,
          notification_status,
          created_at,
          visitors!inner(
            name,
            document
          ),
          apartments!inner(
            number,
            building_id
          ),
          buildings!inner(
            name
          ),
          authorized_by_profile:profiles(
            full_name
          )
        `)
        .in('building_id', buildingIds)
        .order('log_time', { ascending: false });

      setBuildings(adminBuildings || []);
      setLogs(
        (logsData.data || []).map((log) => ({
          id: log.id,
          visitor_name: log.visitors?.name || 'Não identificado',
          visitor_document: log.visitors?.document || 'N/A',
          apartment_number: log.apartments?.number || 'N/A',
          building_name: log.buildings?.name || 'Não identificado',
          log_time: log.log_time,
          tipo_log: log.tipo_log,
          visit_session_id: log.visit_session_id,
          purpose: log.purpose,
          notification_status: log.notification_status || 'pending',
          authorized_by_name: log.authorized_by_profile?.full_name || null,
          created_at: log.created_at
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    // Filtro por busca específica
    if (logSearchQuery && logSearchType !== 'all') {
      const query = logSearchQuery.toLowerCase();
      filtered = filtered.filter((log) => {
        switch (logSearchType) {
          case 'morador':
            return (
              log.authorized_by_name?.toLowerCase().includes(query) ||
              log.visitor_name?.toLowerCase().includes(query)
            );
          case 'porteiro':
            return (
              log.authorized_by_name?.toLowerCase().includes(query)
            );
          case 'predio':
            return log.building_name?.toLowerCase().includes(query);
          case 'acao':
            return (
              log.purpose?.toLowerCase().includes(query) ||
              log.notification_status?.toLowerCase().includes(query)
            );
          default:
            return true;
        }
      });
    } else if (logSearchQuery && logSearchType === 'all') {
      // Busca geral quando tipo é 'all'
      const query = logSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.visitor_name?.toLowerCase().includes(query) ||
          log.visitor_document?.toLowerCase().includes(query) ||
          log.apartment_number?.toLowerCase().includes(query) ||
          log.building_name?.toLowerCase().includes(query) ||
          log.purpose?.toLowerCase().includes(query) ||
          log.notification_status?.toLowerCase().includes(query) ||
          log.authorized_by_name?.toLowerCase().includes(query)
      );
    }

    // Filtro por prédio
    if (logBuildingFilter) {
      filtered = filtered.filter((log) => log.building_name === logBuildingFilter);
    }

    // Filtro por tipo de movimentação
    if (logMovementFilter !== 'all') {
      filtered = filtered.filter((log) => {
        if (logMovementFilter === 'entrada') {
          return log.tipo_log === 'IN';
        } else if (logMovementFilter === 'saida') {
          return log.tipo_log === 'OUT';
        }
        return true;
      });
    }

    // Filtro por período
    if (logDateFilter.start || logDateFilter.end) {
      filtered = filtered.filter((log) => {
        const logDate = new Date(log.log_time);
        const startDate = logDateFilter.start;
        const endDate = logDateFilter.end;

        if (startDate && logDate < startDate) return false;
        if (endDate && logDate > endDate) return false;
        return true;
      });
    }

    setFilteredLogs(filtered);
  };

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Historico de visitantes</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.filterContainer}>
            <View style={styles.searchTypeContainer}>             

              <TextInput
                style={[styles.filterInput, styles.searchInput]}
                placeholder={`Buscar ${logSearchType === 'all' ? 'em tudo' : logSearchType}...`}
                value={logSearchQuery}
                onChangeText={setLogSearchQuery}
              />
            </View>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={logBuildingFilter}
                onValueChange={setLogBuildingFilter}
                style={styles.picker}>
                <Picker.Item label="Todos os Prédios" value="" />
                {buildings.map((building) => (
                  <Picker.Item key={building.id} label={building.name} value={building.name} />
                ))}
              </Picker>
            </View>

            <View style={styles.dateFilterContainer}>
              <View style={styles.datePickerGroup}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="📅 DD/MM/YYYY"
                  value={startDateInput}
                  onChangeText={(text) => {
                    const formatted = formatDate(text);
                    setStartDateInput(formatted);
                    
                    // Se a data for válida, atualizar o filtro de data
                    if (validateDate(formatted)) {
                      const [day, month, year] = formatted.split('/').map(Number);
                      const newDate = new Date(year, month - 1, day);
                      
                      // Manter horário se já existir
                      if (logDateFilter.start) {
                        newDate.setHours(logDateFilter.start.getHours(), logDateFilter.start.getMinutes());
                      }
                      
                      setLogDateFilter((prev) => ({ ...prev, start: newDate }));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />

                <TextInput
                  style={styles.timeInput}
                  placeholder="🕐 HH:MM"
                  value={startTimeInput}
                  onChangeText={(text) => {
                    const formatted = formatTime(text);
                    setStartTimeInput(formatted);
                    
                    // Se o horário for válido, atualizar o filtro de data
                    if (validateTime(formatted)) {
                      const [hours, minutes] = formatted.split(':').map(Number);
                      const currentDate = logDateFilter.start || new Date();
                      const newDate = new Date(currentDate);
                      newDate.setHours(hours, minutes);
                      setLogDateFilter((prev) => ({ ...prev, start: newDate }));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>

              <View style={styles.datePickerGroup}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="📅 DD/MM/YYYY"
                  value={endDateInput}
                  onChangeText={(text) => {
                    const formatted = formatDate(text);
                    setEndDateInput(formatted);
                    
                    // Se a data for válida, atualizar o filtro de data
                    if (validateDate(formatted)) {
                      const [day, month, year] = formatted.split('/').map(Number);
                      const newDate = new Date(year, month - 1, day);
                      
                      // Manter horário se já existir
                      if (logDateFilter.end) {
                        newDate.setHours(logDateFilter.end.getHours(), logDateFilter.end.getMinutes());
                      }
                      
                      setLogDateFilter((prev) => ({ ...prev, end: newDate }));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />

                <TextInput
                  style={styles.timeInput}
                  placeholder="🕐 HH:MM"
                  value={endTimeInput}
                  onChangeText={(text) => {
                    const formatted = formatTime(text);
                    setEndTimeInput(formatted);
                    
                    // Se o horário for válido, atualizar o filtro de data
                    if (validateTime(formatted)) {
                      const [hours, minutes] = formatted.split(':').map(Number);
                      const currentDate = logDateFilter.end || new Date();
                      const newDate = new Date(currentDate);
                      newDate.setHours(hours, minutes);
                      setLogDateFilter((prev) => ({ ...prev, end: newDate }));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>




          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, logMovementFilter === 'all' && styles.tabButtonActive]}
              onPress={() => setLogMovementFilter('all')}>
              <Text
                style={[
                  styles.tabButtonText,
                  logMovementFilter === 'all' && styles.tabButtonTextActive,
                ]}>
                Todos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, logMovementFilter === 'entrada' && styles.tabButtonActive]}
              onPress={() => setLogMovementFilter('entrada')}>
              <Text
                style={[
                  styles.tabButtonText,
                  logMovementFilter === 'entrada' && styles.tabButtonTextActive,
                ]}>
                Entrada
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, logMovementFilter === 'saida' && styles.tabButtonActive]}
              onPress={() => setLogMovementFilter('saida')}>
              <Text
                style={[
                  styles.tabButtonText,
                  logMovementFilter === 'saida' && styles.tabButtonTextActive,
                ]}>
                Saída
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logsList}>
            {filteredLogs.map((log) => (
              <View key={log.id} style={[
                styles.logItem,
                log.tipo_log === 'IN' ? styles.logItemEntry : styles.logItemExit
              ]}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTime}>
                    {new Date(log.log_time).toLocaleString('pt-BR')}
                  </Text>
                  <View style={[
                    styles.movementBadge,
                    log.tipo_log === 'IN' ? styles.movementEntry : styles.movementExit
                  ]}>
                    <Text style={styles.movementText}>
                      {log.tipo_log === 'IN' ? '🔵 ENTRADA' : '🔴 SAÍDA'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, 
                    log.notification_status === 'approved' ? styles.statusApproved :
                    log.notification_status === 'rejected' ? styles.statusRejected :
                    styles.statusPending
                  ]}>
                    <Text style={styles.statusText}>
                      {log.notification_status === 'approved' ? 'Aprovado' :
                       log.notification_status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.visitorInfo}>
                  <Text style={styles.visitorName}>{log.visitor_name}</Text>
                  <Text style={styles.visitorDocument}>Doc: {log.visitor_document}</Text>
                </View>
                
                <View style={styles.locationInfo}>
                  <Text style={styles.buildingName}>{log.building_name}</Text>
                  <Text style={styles.apartmentNumber}>Apt: {log.apartment_number}</Text>
                </View>
                
                {log.purpose && (
                  <Text style={styles.purpose}>Propósito: {log.purpose}</Text>
                )}
                
                <View style={styles.timeInfo}>
                  <Text style={[
                    styles.logTimeDetail,
                    log.tipo_log === 'IN' ? styles.entryTime : styles.exitTime
                  ]}>
                    {log.tipo_log === 'IN' ? 'Entrada' : 'Saída'}: {new Date(log.log_time).toLocaleString('pt-BR')}
                  </Text>
                  <Text style={styles.sessionId}>Sessão: {log.visit_session_id.slice(0, 8)}</Text>
                </View>
                
                {log.authorized_by_name && (
                  <Text style={styles.authorizedBy}>
                    Autorizado por: {log.authorized_by_name}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
        
        <View style={styles.bottomNav}>
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]} 
            onPress={() => setActiveTab('dashboard')}>
            <Text style={styles.navIcon}>📊</Text>
            <Text style={styles.navLabel}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/admin/users')}>
            <Text style={styles.navIcon}>👥</Text>
            <Text style={styles.navLabel}>Usuários</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.navItem, styles.navItemActive]} onPress={() => router.push('/admin/logs')}>
            <Text style={styles.navIcon}>📋</Text>
            <Text style={styles.navLabel}>Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navItem} 
            onPress={() => router.push('/admin/communications')}>
            <Text style={styles.navIcon}>📢</Text>
            <Text style={styles.navLabel}>Avisos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: "center",
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: '#9C27B0',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  filterContainer: {
    padding: 20,
  },
  filterInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  datePickerGroup: {
    flex: 1,
    marginHorizontal: 5,
  },
  dateInput: {
    height: 50,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  timePickerButton: {
    height: 45,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  timePickerButtonText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  timeInput: {
    height: 45,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  searchTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  pickerContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  picker: {
    height: 50,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 0,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#4CAF50',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  logsList: {
    padding: 20,
  },
  logItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  logItemEntry: {
    borderLeftColor: '#4CAF50',
  },
  logItemExit: {
    borderLeftColor: '#F44336',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: '#4CAF50',
  },
  statusRejected: {
    backgroundColor: '#F44336',
  },
  statusPending: {
    backgroundColor: '#FF9800',
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  movementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  movementEntry: {
    backgroundColor: '#E8F5E8',
  },
  movementExit: {
    backgroundColor: '#FFEBEE',
  },
  movementText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  visitorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  visitorDocument: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  buildingName: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    flex: 1,
  },
  apartmentNumber: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  purpose: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  timeInfo: {
    marginBottom: 6,
  },
  logTimeDetail: {
    fontSize: 12,
    fontWeight: '500',
  },
  entryTime: {
    color: '#4CAF50',
  },
  exitTime: {
    color: '#F44336',
  },
  sessionId: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  authorizedBy: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  logAction: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  logUser: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  logBuilding: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  logDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  navItemActive: {
    backgroundColor: '#F5F5F5',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
});
