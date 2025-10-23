import React, { useState, useEffect } from 'react';
import { useLembretes } from '@/hooks/useLembretes';
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

export function NotificationTestPanel() {
  const {
    createLembrete,
    deleteLembrete,
    lembretes,
    notificationStats,
    validationStats,
    generateNotificationReport
  } = useLembretes();

  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [debugReport, setDebugReport] = useState<string>('');

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
        categoria: scenario.category,
        prioridade: scenario.priority,
        status: 'pendente' as const
      };

      const result = await createLembrete(lembreteData);
      
      if (result) {
        addTestLog(`✅ Lembrete criado com sucesso - ID: ${result.id}`);
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
    const report = await generateNotificationReport();
    setDebugReport(report);
  };

  useEffect(() => {
    // Atualizar relatório automaticamente a cada 30 segundos
    const interval = setInterval(generateReport, 30000);
    generateReport(); // Gerar relatório inicial
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          🧪 Painel de Testes - Sistema de Lembretes
        </h2>

        {/* Controles de Teste */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
          >
            {isRunning ? '⏳ Executando...' : '🚀 Executar Todos os Testes'}
          </button>
          
          <button
            onClick={clearTestLembretes}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            🗑️ Limpar Testes
          </button>
          
          <button
            onClick={generateReport}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            📊 Gerar Relatório
          </button>
          
          <button
            onClick={() => setTestResults([])}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            🧹 Limpar Log
          </button>
        </div>

        {/* Cenários de Teste */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">📋 Cenários de Teste</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testScenarios.map(scenario => (
              <div key={scenario.id} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-800">{scenario.name}</h4>
                <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                <p className="text-xs text-gray-500">
                  ⏰ {format(scenario.scheduledTime, 'dd/MM HH:mm', { locale: ptBR })}
                </p>
                <button
                  onClick={() => runTestScenario(scenario)}
                  disabled={isRunning}
                  className="mt-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm"
                >
                  ▶️ Executar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800">📱 Notificações</h4>
            <p className="text-sm text-blue-600">
              Agendadas: {notificationStats?.scheduled || 0}
            </p>
            <p className="text-sm text-blue-600">
              Disparadas: {notificationStats?.triggered || 0}
            </p>
            <p className="text-sm text-blue-600">
              Perdidas: {notificationStats?.missed || 0}
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800">✅ Validação</h4>
            <p className="text-sm text-green-600">
              Regras Ativas: {validationStats?.activeRules || 0}
            </p>
            <p className="text-sm text-green-600">
              Verificações: {validationStats?.totalChecks || 0}
            </p>
            <p className="text-sm text-green-600">
              Fallbacks: {validationStats?.fallbackTriggers || 0}
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-800">📊 Sistema</h4>
            <p className="text-sm text-purple-600">
              Lembretes Ativos: {lembretes.filter(l => l.status === 'pendente').length}
            </p>
            <p className="text-sm text-purple-600">
              Total: {lembretes.length}
            </p>
          </div>
        </div>

        {/* Log de Testes */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">📝 Log de Testes</h3>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
            {testResults.length === 0 ? (
              <p className="text-gray-500">Nenhum teste executado ainda...</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">{result}</div>
              ))
            )}
          </div>
        </div>

        {/* Relatório de Debug */}
        {debugReport && (
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">🔍 Relatório de Debug</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                {debugReport}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}