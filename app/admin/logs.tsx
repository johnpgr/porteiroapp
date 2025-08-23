import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Container } from '~/components/Container';
import { supabase, adminAuth } from '~/utils/supabase';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Building {
  id: string;
  name: string;
}

interface Log {
  id: string;
  action: string;
  user_name: string;
  building_name: string;
  created_at: string;
}

export default function SystemLogs() {
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

      const logsData = await supabase
        .from('system_logs')
        .select('*, profiles(name), buildings(name)')
        .order('created_at', { ascending: false });

      setBuildings(adminBuildings || []);
      setLogs(logsData.data || []);
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
              log.user_name?.toLowerCase().includes(query) &&
              (log.action.toLowerCase().includes('morador') ||
                log.user_name?.toLowerCase().includes(query))
            );
          case 'porteiro':
            return (
              log.user_name?.toLowerCase().includes(query) &&
              (log.action.toLowerCase().includes('porteiro') ||
                log.user_name?.toLowerCase().includes(query))
            );
          case 'predio':
            return log.building_name?.toLowerCase().includes(query);
          case 'acao':
            return log.action.toLowerCase().includes(query);
          default:
            return true;
        }
      });
    } else if (logSearchQuery && logSearchType === 'all') {
      // Busca geral quando tipo é 'all'
      const query = logSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(query) ||
          log.user_name?.toLowerCase().includes(query) ||
          log.building_name?.toLowerCase().includes(query)
      );
    }

    // Filtro por prédio
    if (logBuildingFilter) {
      filtered = filtered.filter((log) => log.building_name === logBuildingFilter);
    }

    // Filtro por tipo de movimentação
    if (logMovementFilter !== 'all') {
      filtered = filtered.filter((log) => {
        const action = log.action.toLowerCase();
        if (logMovementFilter === 'entrada') {
          return action.includes('entrada') || action.includes('entrou');
        } else if (logMovementFilter === 'saida') {
          return action.includes('saída') || action.includes('saiu') || action.includes('saida');
        }
        return true;
      });
    }

    // Filtro por período
    if (logDateFilter.start || logDateFilter.end) {
      filtered = filtered.filter((log) => {
        const logDate = new Date(log.created_at);
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
    <Container>
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
              </View>

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
              </View>

              <View style={styles.datePickerGroup}>
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
              </View>
            </View>

            {showStartDatePicker && (
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

            {showStartTimePicker && (
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

            {showEndDatePicker && (
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

            {showEndTimePicker && (
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
              <View key={log.id} style={styles.logItem}>
                <Text style={styles.logAction}>{log.action}</Text>
                <Text style={styles.logUser}>Usuário: {log.user_name}</Text>
                <Text style={styles.logBuilding}>Prédio: {log.building_name}</Text>
                <Text style={styles.logDate}>{new Date(log.created_at).toLocaleString('pt-BR')}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
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
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  datePickerButtonText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  timePickerButton: {
    backgroundColor: '#e8f4f8',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#b3d9e6',
  },
  timePickerButtonText: {
    fontSize: 12,
    color: '#2c5aa0',
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
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
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
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
});
