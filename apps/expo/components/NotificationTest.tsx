import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';

interface TestNotification {
  id: string;
  title: string;
  body: string;
  scheduledFor: Date;
}

export const NotificationTest: React.FC = () => {
  const { 
    scheduleNotification, 
    cancelNotification, 
    getScheduledNotifications,
    permissionStatus 
  } = useNotifications();
  
  const [scheduledTests, setScheduledTests] = useState<TestNotification[]>([]);
  const [loading, setLoading] = useState(false);

  // Testar notificação em 10 segundos
  const testNotificationIn10Seconds = async () => {
    try {
      setLoading(true);
      const triggerDate = new Date(Date.now() + 10000); // 10 segundos
      const testId = `test_${Date.now()}`;
      
      const notificationId = await scheduleNotification({
        id: testId,
        title: 'Teste de Notificação',
        body: 'Esta é uma notificação de teste agendada para 10 segundos!',
        triggerDate,
        data: { testType: '10seconds' }
      });
      
      if (notificationId) {
        const newTest: TestNotification = {
          id: testId,
          title: 'Teste 10 segundos',
          body: 'Notificação de teste',
          scheduledFor: triggerDate
        };
        
        setScheduledTests(prev => [...prev, newTest]);
        Alert.alert('Sucesso', 'Notificação agendada para 10 segundos!');
      } else {
        Alert.alert('Erro', 'Falha ao agendar notificação');
      }
    } catch (error) {
      console.error('Erro ao testar notificação:', error);
      Alert.alert('Erro', 'Erro ao agendar notificação de teste');
    } finally {
      setLoading(false);
    }
  };

  // Testar notificação em 1 minuto
  const testNotificationIn1Minute = async () => {
    try {
      setLoading(true);
      const triggerDate = new Date(Date.now() + 60000); // 1 minuto
      const testId = `test_${Date.now()}`;
      
      const notificationId = await scheduleNotification({
        id: testId,
        title: 'Teste de Notificação - 1 Minuto',
        body: 'Esta notificação foi agendada para 1 minuto!',
        triggerDate,
        data: { testType: '1minute' }
      });
      
      if (notificationId) {
        const newTest: TestNotification = {
          id: testId,
          title: 'Teste 1 minuto',
          body: 'Notificação de teste',
          scheduledFor: triggerDate
        };
        
        setScheduledTests(prev => [...prev, newTest]);
        Alert.alert('Sucesso', 'Notificação agendada para 1 minuto!');
      } else {
        Alert.alert('Erro', 'Falha ao agendar notificação');
      }
    } catch (error) {
      console.error('Erro ao testar notificação:', error);
      Alert.alert('Erro', 'Erro ao agendar notificação de teste');
    } finally {
      setLoading(false);
    }
  };

  // Testar notificação com horário específico (próxima hora)
  const testNotificationNextHour = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
      const testId = `test_${Date.now()}`;
      
      const notificationId = await scheduleNotification({
        id: testId,
        title: 'Teste de Notificação - Próxima Hora',
        body: `Notificação agendada para ${nextHour.toLocaleTimeString()}`,
        triggerDate: nextHour,
        data: { testType: 'nexthour' }
      });
      
      if (notificationId) {
        const newTest: TestNotification = {
          id: testId,
          title: 'Teste próxima hora',
          body: 'Notificação de teste',
          scheduledFor: nextHour
        };
        
        setScheduledTests(prev => [...prev, newTest]);
        Alert.alert('Sucesso', `Notificação agendada para ${nextHour.toLocaleTimeString()}!`);
      } else {
        Alert.alert('Erro', 'Falha ao agendar notificação');
      }
    } catch (error) {
      console.error('Erro ao testar notificação:', error);
      Alert.alert('Erro', 'Erro ao agendar notificação de teste');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar teste específico
  const cancelTest = async (testId: string) => {
    try {
      await cancelNotification(testId);
      setScheduledTests(prev => prev.filter(test => test.id !== testId));
      Alert.alert('Sucesso', 'Notificação de teste cancelada!');
    } catch (error) {
      console.error('Erro ao cancelar teste:', error);
      Alert.alert('Erro', 'Erro ao cancelar notificação de teste');
    }
  };

  // Verificar notificações agendadas
  const checkScheduledNotifications = async () => {
    try {
      const scheduled = await getScheduledNotifications();
      const count = scheduled.length;
      const testNotifications = scheduled.filter(n => n.identifier.startsWith('test_'));
      
      Alert.alert(
        'Notificações Agendadas',
        `Total: ${count}\nTestes: ${testNotifications.length}\n\nDetalhes no console.`
      );
      
      console.log('Notificações agendadas:', scheduled);
    } catch (error) {
      console.error('Erro ao verificar notificações:', error);
      Alert.alert('Erro', 'Erro ao verificar notificações agendadas');
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Teste de Notificações
      </Text>
      
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#e3f2fd', borderRadius: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>Status das Permissões:</Text>
        <Text style={{ fontSize: 14, color: permissionStatus === 'granted' ? '#4caf50' : '#f44336' }}>
          {permissionStatus === 'granted' ? '✅ Permissões concedidas' : '❌ Permissões negadas'}
        </Text>
      </View>

      <View style={{ gap: 15 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#2196f3',
            padding: 15,
            borderRadius: 8,
            opacity: loading ? 0.6 : 1
          }}
          onPress={testNotificationIn10Seconds}
          disabled={loading}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
            Testar em 10 segundos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#ff9800',
            padding: 15,
            borderRadius: 8,
            opacity: loading ? 0.6 : 1
          }}
          onPress={testNotificationIn1Minute}
          disabled={loading}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
            Testar em 1 minuto
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#4caf50',
            padding: 15,
            borderRadius: 8,
            opacity: loading ? 0.6 : 1
          }}
          onPress={testNotificationNextHour}
          disabled={loading}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
            Testar na próxima hora
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#9c27b0',
            padding: 15,
            borderRadius: 8
          }}
          onPress={checkScheduledNotifications}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
            Verificar Notificações Agendadas
          </Text>
        </TouchableOpacity>
      </View>

      {scheduledTests.length > 0 && (
        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
            Testes Agendados:
          </Text>
          
          {scheduledTests.map((test) => (
            <View
              key={test.id}
              style={{
                backgroundColor: 'white',
                padding: 15,
                borderRadius: 8,
                marginBottom: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>
                {test.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>
                Agendado para: {test.scheduledFor.toLocaleString()}
              </Text>
              
              <TouchableOpacity
                style={{
                  backgroundColor: '#f44336',
                  padding: 10,
                  borderRadius: 5,
                  alignSelf: 'flex-start'
                }}
                onPress={() => cancelTest(test.id)}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};