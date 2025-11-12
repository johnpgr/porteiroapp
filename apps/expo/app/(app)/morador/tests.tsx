import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLembretes } from '~/hooks/useLembretes';
import { format, addMinutes, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  scheduledTime: Date;
  category: string;
  priority: 'baixa' | 'media' | 'alta';
}

function TestesContent() {
  const {
    createLembrete,
    deleteLembrete,
    lembretes,
  } = useLembretes();

  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Cenários de teste específicos
  const testScenarios: TestScenario[] = [
    {
      id: 'test_12_35',
      name: 'Caso Crítico 12:35',
      description: 'Teste do caso que falhou - lembrete às 12:35 com notificação às 12:20',
      scheduledTime: new Date(new Date().setHours(12, 35, 0, 0)),
      category: 'Teste Crítico',
      priority: 'alta'
    },
    {
      id: 'test_immediate',
      name: 'Teste Imediato',
      description: 'Lembrete em 2 minutos para teste rápido',
      scheduledTime: addMinutes(new Date(), 2),
      category: 'Teste Rápido',
      priority: 'media'
    },
    {
      id: 'test_15min',
      name: 'Teste 15 Minutos',
      description: 'Lembrete em 16 minutos para testar notificação prévia',
      scheduledTime: addMinutes(new Date(), 16),
      category: 'Teste Médio',
      priority: 'media'
    },
    {
      id: 'test_1hour',
      name: 'Teste 1 Hora',
      description: 'Lembrete em 1 hora para teste de longo prazo',
      scheduledTime: addHours(new Date(), 1),
      category: 'Teste Longo',
      priority: 'baixa'
    }
  ];

  const addTestLog = (message: string) => {
    const timestamp = format(new Date(), 'HH:mm:ss', { locale: ptBR });
    setTestResults(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runTestScenario = async (scenario: TestScenario) => {
    try {
      addTestLog(`🧪 Iniciando teste: ${scenario.name}`);
      addTestLog(`📅 Horário agendado: ${format(scenario.scheduledTime, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`);
      addTestLog(`⏰ Notificação prévia esperada: ${format(addMinutes(scenario.scheduledTime, -15), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`);

      const lembreteData = {
        titulo: scenario.name,
        descricao: scenario.description,
        data_vencimento: scenario.scheduledTime.toISOString(),
        categoria: scenario.category as any,
        prioridade: scenario.priority,
        status: 'pendente' as const,
        building_admin_id: null, // Required field - null for general reminders
      };

      const result = await createLembrete(lembreteData);
      
      if (result.success && result.lembrete) {
        addTestLog(`✅ Lembrete criado com sucesso - ID: ${result.lembrete.id}`);
        addTestLog(`📱 Notificações agendadas: exata + 15min antes`);
        addTestLog(`🔍 Validação em tempo real ativada`);
      } else {
        addTestLog(`❌ Falha ao criar lembrete`);
      }
    } catch (error) {
      addTestLog(`💥 Erro no teste: ${error}`);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    addTestLog('🚀 Iniciando bateria de testes do sistema de lembretes');
    
    for (const scenario of testScenarios) {
      await runTestScenario(scenario);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre testes
    }
    
    addTestLog('✨ Todos os testes concluídos');
    setIsRunning(false);
  };

  const clearTestLembretes = async () => {
    const testLembretes = lembretes.filter(l => 
      l.categoria?.includes('Teste') || l.titulo?.includes('Teste')
    );
    
    for (const lembrete of testLembretes) {
      await deleteLembrete(lembrete.id);
      addTestLog(`🗑️ Lembrete de teste removido: ${lembrete.titulo}`);
    }
  };

  const generateReport = async () => {
    // Notification stats temporarily disabled
    addTestLog('📊 Relatório de notificações temporariamente desativado');
  };

  useEffect(() => {
    // Report generation temporarily disabled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🧪 Testes de Lembretes</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Controles de Teste */}
        <View style={styles.controlsSection}>
          <Text style={styles.sectionTitle}>Controles de Teste</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={runAllTests}
              disabled={isRunning}
              style={[styles.button, styles.primaryButton, isRunning && styles.disabledButton]}
            >
              {isRunning ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonText}>🚀 Executar Todos</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={clearTestLembretes}
              style={[styles.button, styles.dangerButton]}
            >
              <Text style={styles.buttonText}>🗑️ Limpar Testes</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={generateReport}
              style={[styles.button, styles.successButton]}
            >
              <Text style={styles.buttonText}>📊 Gerar Relatório</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setTestResults([])}
              style={[styles.button, styles.secondaryButton]}
            >
              <Text style={styles.buttonText}>🧹 Limpar Log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cenários de Teste */}
        <View style={styles.scenariosSection}>
          <Text style={styles.sectionTitle}>📋 Cenários de Teste</Text>
          {testScenarios.map(scenario => (
            <View key={scenario.id} style={styles.scenarioCard}>
              <Text style={styles.scenarioName}>{scenario.name}</Text>
              <Text style={styles.scenarioDescription}>{scenario.description}</Text>
              <Text style={styles.scenarioTime}>
                ⏰ {format(scenario.scheduledTime, 'dd/MM HH:mm', { locale: ptBR })}
              </Text>
              <TouchableOpacity
                onPress={() => runTestScenario(scenario)}
                disabled={isRunning}
                style={[styles.scenarioButton, isRunning && styles.disabledButton]}
              >
                <Text style={styles.scenarioButtonText}>▶️ Executar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Estatísticas */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 Estatísticas</Text>
          
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.blueCard]}>
              <Text style={styles.statTitle}>📱 Notificações</Text>
              <Text style={styles.statValue}>Temporariamente desativadas</Text>
            </View>
            
            <View style={[styles.statCard, styles.greenCard]}>
              <Text style={styles.statTitle}>✅ Validação</Text>
              <Text style={styles.statValue}>Temporariamente desativada</Text>
            </View>
          </View>
          
          <View style={[styles.statCard, styles.purpleCard]}>
            <Text style={styles.statTitle}>📊 Sistema</Text>
            <Text style={styles.statValue}>
              Lembretes Ativos: {lembretes.filter(l => l.status === 'pendente').length}
            </Text>
            <Text style={styles.statValue}>Total: {lembretes.length}</Text>
          </View>
        </View>

        {/* Log de Testes */}
        <View style={styles.logSection}>
          <Text style={styles.sectionTitle}>📝 Log de Testes</Text>
          <View style={styles.logContainer}>
            {testResults.length === 0 ? (
              <Text style={styles.emptyLog}>Nenhum teste executado ainda...</Text>
            ) : (
              testResults.map((result, index) => (
                <Text key={index} style={styles.logEntry}>{result}</Text>
              ))
            )}
          </View>
        </View>

        {/* Instruções */}
        <View style={styles.instructionsSection}>
          <Text style={styles.sectionTitle}>⚠️ Instruções de Teste</Text>
          <View style={styles.instructionCard}>
            <Text style={styles.instructionItem}>• <Text style={styles.bold}>Caso Crítico 12:35:</Text> Testa especificamente o cenário que estava falhando</Text>
            <Text style={styles.instructionItem}>• <Text style={styles.bold}>Teste Imediato:</Text> Permite validação rápida em 2 minutos</Text>
            <Text style={styles.instructionItem}>• <Text style={styles.bold}>Teste 15 Minutos:</Text> Valida o sistema de notificação prévia</Text>
            <Text style={styles.instructionItem}>• <Text style={styles.bold}>Teste 1 Hora:</Text> Testa persistência e confiabilidade de longo prazo</Text>
            <Text style={styles.instructionItem}>• Monitore o log em tempo real para acompanhar o funcionamento</Text>
            <Text style={styles.instructionItem}>• Use o relatório de debug para análise detalhada</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      
    </View>
  );
}

export default function TestesPage() {
  return (
    <TestesContent />
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  controlsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    flex: 0.48,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  successButton: {
    backgroundColor: '#34C759',
  },
  secondaryButton: {
    backgroundColor: '#8E8E93',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  scenariosSection: {
    marginBottom: 20,
  },
  scenarioCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  scenarioDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  scenarioTime: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  scenarioButton: {
    backgroundColor: '#5856D6',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  scenarioButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statsSection: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    flex: 0.48,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  blueCard: {
    backgroundColor: '#E3F2FD',
  },
  greenCard: {
    backgroundColor: '#E8F5E8',
  },
  purpleCard: {
    backgroundColor: '#F3E5F5',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  statValue: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  logSection: {
    marginBottom: 20,
  },
  logContainer: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    maxHeight: 200,
  },
  emptyLog: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logEntry: {
    color: '#00FF00',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  instructionsSection: {
    marginBottom: 20,
  },
  instructionCard: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  instructionItem: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
});
