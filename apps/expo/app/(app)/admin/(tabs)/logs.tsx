import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Modal } from '~/components/Modal';
import { supabase, adminAuth } from '~/utils/supabase';
import { router } from 'expo-router';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';

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
  visit_session_id: string | null;
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

export default function AdminLogsScreen() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [logSearchType] = useState('all'); // 'all', 'morador', 'porteiro', 'predio', 'acao'
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logBuildingFilter, setLogBuildingFilter] = useState('');
  const [logDateFilter, setLogDateFilter] = useState({
    start: null as Date | null,
    end: null as Date | null,
  });
  // Estados para os campos de hora e data formatados
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Bottom sheet refs and state
  const buildingSheetRef = useRef<BottomSheetModalRef>(null);
  const [buildingSheetVisible, setBuildingSheetVisible] = useState(false);
  
  // Estados dos modais dos pickers
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [
    logSearchType,
    logSearchQuery,
    logBuildingFilter,
    logDateFilter,
    logs,
  ]);

  // Função helper para obter label do prédio
  const getBuildingLabel = (buildingName: string) => {
    if (!buildingName) return 'Todos os Prédios';
    return buildingName;
  };

  const fetchData = async () => {
    try {
      console.log('🔍 Iniciando busca de logs...');
      
      // Obter o administrador atual
      const currentAdmin = await adminAuth.getCurrentAdmin();
      if (!currentAdmin) {
        console.error('❌ Administrador não encontrado');
        router.push('/');
        return;
      }
      console.log('👤 Admin atual:', currentAdmin.id);

      // Buscar apenas os prédios gerenciados pelo administrador atual
      const adminBuildings = await adminAuth.getAdminBuildings(currentAdmin.id);
      const buildingIds = adminBuildings?.map(b => b.id) || [];
      console.log('🏢 Prédios do admin:', buildingIds);

      if (buildingIds.length === 0) {
        console.log('⚠️ Nenhum prédio encontrado para este administrador');
        setBuildings([]);
        setLogs([]);
        return;
      }

      // Buscar logs de visitantes com joins para obter informações completas
      console.log('📊 Executando consulta de logs...');
      const logsData = await supabase
        .from('visitor_logs')
        .select(`
          id,
          log_time,
          tipo_log,
          visit_session_id,
          purpose,
          notification_status,
          authorized_by,
          created_at,
          building_id,
          visitors(
            name,
            document
          ),
          apartments!inner(
            number,
            building_id
          ),
          buildings!inner(
            name
          )
        `)
        .in('building_id', buildingIds)
        .order('log_time', { ascending: false });
      
      console.log('📋 Resultado da consulta:', logsData.error ? 'ERRO' : 'SUCESSO');
      if (logsData.error) {
        console.error('❌ Erro na consulta:', logsData.error);
      } else {
        console.log('✅ Logs encontrados:', logsData.data?.length || 0);
      }

      // Buscar nomes dos usuários que autorizaram
      const authorizedIds = (logsData.data || [])
        .map((log) => log.authorized_by)
        .filter((id): id is string => id !== null && id !== undefined);
      const uniqueAuthorizedIds = [...new Set(authorizedIds)];

      let authorizedNames: Record<string, string> = {};
      if (uniqueAuthorizedIds.length > 0) {
        const { data: authorizedProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueAuthorizedIds);

        if (authorizedProfiles) {
          authorizedNames = authorizedProfiles.reduce(
            (acc, profile) => {
              acc[profile.id] = profile.full_name || '';
              return acc;
            },
            {} as Record<string, string>
          );
        }
      }

      setBuildings(adminBuildings || []);
      setLogs(
        (logsData.data || []).map((log) => ({
          id: log.id,
          visitor_name: log.visitors?.name || 'Não identificado',
          visitor_document: log.visitors?.document || 'N/A',
          apartment_number: log.apartments?.number || 'N/A',
          building_name: log.buildings?.name || 'Não identificado',
          log_time: log.log_time,
          tipo_log: log.tipo_log as 'IN' | 'OUT',
          visit_session_id: log.visit_session_id,
          purpose: log.purpose ?? undefined,
          notification_status: log.notification_status || 'pending',
          authorized_by_name: log.authorized_by ? authorizedNames[log.authorized_by] : undefined,
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
          log.authorized_by_name?.toLowerCase().includes(query) ||
          log.tipo_log?.toLowerCase().includes(query)
      );
    }

    // Filtro por prédio
    if (logBuildingFilter) {
      filtered = filtered.filter((log) => log.building_name === logBuildingFilter);
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

    // Resetar página atual quando filtros mudarem
    setCurrentPage(1);
    setFilteredLogs(filtered);
  };

  return (
    <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Histórico de visitantes</Text>
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
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setBuildingSheetVisible(true)}
              >
                <Text style={styles.pickerButtonText}>
                  {getBuildingLabel(logBuildingFilter)}
                </Text>
                <Text style={styles.pickerChevron}>▼</Text>
              </TouchableOpacity>
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


          <View style={styles.logsContainer}>
            <ScrollView style={styles.logsList}>
              {(() => {
                // Calcular paginação
                const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const currentLogs = filteredLogs.slice(startIndex, endIndex);
                
                return currentLogs.map((log) => (
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
                  <Text style={styles.sessionId}>Sessão: {log.visit_session_id ? log.visit_session_id.slice(0, 8) : 'N/A'}</Text>
                </View>
                
                {log.authorized_by_name && (
                    <Text style={styles.authorizedBy}>
                      Autorizado por: {log.authorized_by_name}
                    </Text>
                  )}
                </View>
              ));
              })()}
            </ScrollView>
            
            {/* UI de Paginação */}
            {(() => {
              const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
              if (totalPages <= 1) return null;
              
              return (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                    onPress={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                      Anterior
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.paginationInfo}>
                    Página {currentPage} de {totalPages}
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                    onPress={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                      Próximo
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </ScrollView>

        {/* Modal para Prédio */}
        <Modal
          visible={showBuildingPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBuildingPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecionar Prédio</Text>
                <TouchableOpacity onPress={() => setShowBuildingPicker(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    logBuildingFilter === '' && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setLogBuildingFilter('');
                    setShowBuildingPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    logBuildingFilter === '' && styles.modalOptionTextSelected
                  ]}>
                    Todos os Prédios
                  </Text>
                  {logBuildingFilter === '' && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
                {buildings.map((building) => (
                  <TouchableOpacity
                    key={building.id}
                    style={[
                      styles.modalOption,
                      logBuildingFilter === building.name && styles.modalOptionSelected
                    ]}
                    onPress={() => {
                      setLogBuildingFilter(building.name);
                      setShowBuildingPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      logBuildingFilter === building.name && styles.modalOptionTextSelected
                    ]}>
                      {building.name}
                    </Text>
                    {logBuildingFilter === building.name && (
                      <Text style={styles.modalCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Building Selection Bottom Sheet */}
        <BottomSheetModal
          ref={buildingSheetRef}
          visible={buildingSheetVisible}
          onClose={() => setBuildingSheetVisible(false)}
          snapPoints={60}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Selecione um Prédio</Text>
            <Text style={styles.sheetSubtitle}>Filtrar por prédio</Text>
          </View>
          <ScrollView style={styles.modalScrollView}>
            <TouchableOpacity
              style={[
                styles.modalOption,
                logBuildingFilter === '' && styles.modalOptionSelected
              ]}
              onPress={() => {
                setLogBuildingFilter('');
                setBuildingSheetVisible(false);
              }}
            >
              <Text style={[
                styles.modalOptionText,
                logBuildingFilter === '' && styles.modalOptionTextSelected
              ]}>
                🏢 Todos os Prédios
              </Text>
              {logBuildingFilter === '' && (
                <Text style={styles.modalCheckmark}>✓</Text>
              )}
            </TouchableOpacity>
            {buildings.length > 0 ? (
              buildings.map((building) => (
                <TouchableOpacity
                  key={building.id}
                  style={[
                    styles.modalOption,
                    logBuildingFilter === building.name && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setLogBuildingFilter(building.name);
                    setBuildingSheetVisible(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    logBuildingFilter === building.name && styles.modalOptionTextSelected
                  ]}>
                    🏢 {building.name}
                  </Text>
                  {logBuildingFilter === building.name && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.bottomSheetEmpty}>
                <Text style={styles.bottomSheetEmptyText}>Nenhum prédio disponível</Text>
              </View>
            )}
          </ScrollView>
        </BottomSheetModal>
      </View>
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
    paddingHorizontal: 15,
    paddingVertical: 20,
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
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pickerChevron: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  picker: {
    height: 50,
  },
  // Estilos dos modais dos pickers
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '70%',
    minWidth: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalCheckmark: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
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
  logsContainer: {
    flex: 1,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paginationButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
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
  // Bottom Sheet styles (from comunicados.tsx)
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSheetEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  bottomSheetEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
