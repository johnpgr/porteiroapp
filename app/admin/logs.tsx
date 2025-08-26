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
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IOSCompatiblePicker, IOSCompatibleTimePicker } from '../../components/IOSCompatiblePickers';
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
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  // Estados para modais customizados iOS
  const [showIOSStartDatePicker, setShowIOSStartDatePicker] = useState(false);
  const [showIOSEndDatePicker, setShowIOSEndDatePicker] = useState(false);
  const [showIOSStartTimePicker, setShowIOSStartTimePicker] = useState(false);
  const [showIOSEndTimePicker, setShowIOSEndTimePicker] = useState(false);
  
  const isIOS = Platform.OS === 'ios';

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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📊 Historico de visitantes</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.filterContainer}>
            <View style={styles.searchTypeContainer}>
              <View style={styles.pickerContainer}>
                {isIOS ? (
                  <IOSCompatiblePicker
                    selectedValue={logSearchType}
                    onValueChange={setLogSearchType}
                    items={[
                      { label: "Buscar em Tudo", value: "all" },
                      { label: "Buscar Morador", value: "morador" },
                      { label: "Buscar Porteiro", value: "porteiro" },
                      { label: "Buscar Prédio", value: "predio" },
                      { label: "Buscar Ação", value: "acao" }
                    ]}
                    placeholder="Selecione o tipo de busca"
                  />
                ) : (
                  <Picker
                    selectedValue={logSearchType}
                    onValueChange={setLogSearchType}
                    style={styles.picker}>
                    <Picker.Item label="Buscar em Tudo" value="all" />
                    <Picker.Item label="Buscar Morador" value="morador" />
                    <Picker.Item label="Buscar Porteiro" value="porteiro" />
                    <Picker.Item label="Buscar Prédio" value="predio" />
                    <Picker.Item label="Buscar Ação" value="acao" />
                  </Picker>
                )}
              </View>

              <TextInput
                style={[styles.filterInput, styles.searchInput]}
                placeholder={`Buscar ${logSearchType === 'all' ? 'em tudo' : logSearchType}...`}
                value={logSearchQuery}
                onChangeText={setLogSearchQuery}
              />
            </View>

            <View style={styles.pickerContainer}>
              {isIOS ? (
                <IOSCompatiblePicker
                  selectedValue={logBuildingFilter}
                  onValueChange={setLogBuildingFilter}
                  items={[
                    { label: "Todos os Prédios", value: "" },
                    ...buildings.map((building) => ({
                      label: building.name,
                      value: building.name
                    }))
                  ]}
                  placeholder="Selecione o prédio"
                />
              ) : (
                <Picker
                  selectedValue={logBuildingFilter}
                  onValueChange={setLogBuildingFilter}
                  style={styles.picker}>
                  <Picker.Item label="Todos os Prédios" value="" />
                  {buildings.map((building) => (
                    <Picker.Item key={building.id} label={building.name} value={building.name} />
                  ))}
                </Picker>
              )}
            </View>



            <View style={styles.dateFilterContainer}>
              <View style={styles.datePickerGroup}>
                {isIOS ? (
                  <IOSCompatibleTimePicker
                    value={logDateFilter.start || new Date()}
                    mode="datetime"
                    onDateChange={(selectedDate) => {
                      if (selectedDate) {
                        setLogDateFilter((prev) => ({ ...prev, start: selectedDate }));
                      }
                    }}
                    placeholder="Selecione data e hora de início"
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowStartDatePicker(true)}>
                      <Text style={styles.datePickerButtonText}>
                        📅{' '}
                        {logDateFilter.start
                          ? logDateFilter.start.toLocaleDateString('pt-BR')
                          : 'Data início'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => setShowStartTimePicker(true)}>
                      <Text style={styles.timePickerButtonText}>
                        🕐{' '}
                        {logDateFilter.start
                          ? logDateFilter.start.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Hora'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={styles.datePickerGroup}>
                {isIOS ? (
                  <IOSCompatibleTimePicker
                    value={logDateFilter.end || new Date()}
                    mode="datetime"
                    onDateChange={(selectedDate) => {
                      if (selectedDate) {
                        setLogDateFilter((prev) => ({ ...prev, end: selectedDate }));
                      }
                    }}
                    placeholder="Selecione data e hora de fim"
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowEndDatePicker(true)}>
                      <Text style={styles.datePickerButtonText}>
                        📅 {logDateFilter.end ? logDateFilter.end.toLocaleDateString('pt-BR') : 'Data fim'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => setShowEndTimePicker(true)}>
                      <Text style={styles.timePickerButtonText}>
                        🕐{' '}
                        {logDateFilter.end
                          ? logDateFilter.end.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Hora'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {!isIOS && showStartDatePicker && (
              <DateTimePicker
                value={logDateFilter.start || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(false);
                  if (selectedDate) {
                    const currentTime = logDateFilter.start || new Date();
                    selectedDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                    setLogDateFilter((prev) => ({ ...prev, start: selectedDate }));
                  }
                }}
              />
            )}

            {!isIOS && showStartTimePicker && (
              <DateTimePicker
                value={logDateFilter.start || new Date()}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowStartTimePicker(false);
                  if (selectedTime) {
                    const currentDate = logDateFilter.start || new Date();
                    currentDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                    setLogDateFilter((prev) => ({ ...prev, start: currentDate }));
                  }
                }}
              />
            )}

            {!isIOS && showEndDatePicker && (
              <DateTimePicker
                value={logDateFilter.end || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(false);
                  if (selectedDate) {
                    const currentTime = logDateFilter.end || new Date();
                    selectedDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                    setLogDateFilter((prev) => ({ ...prev, end: selectedDate }));
                  }
                }}
              />
            )}

            {!isIOS && showEndTimePicker && (
              <DateTimePicker
                value={logDateFilter.end || new Date()}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowEndTimePicker(false);
                  if (selectedTime) {
                    const currentDate = logDateFilter.end || new Date();
                    currentDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                    setLogDateFilter((prev) => ({ ...prev, end: currentDate }));
                  }
                }}
              />
            )}
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
    paddingTop: 60,
    padding: 20,
    backgroundColor: '#9C27B0',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
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
  datePickerButton: {
    height: 50,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  datePickerButtonText: {
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
    backgroundColor: '#9C27B0',
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
