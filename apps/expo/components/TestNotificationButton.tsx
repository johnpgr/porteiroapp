import React, { useState } from 'react';
import { TouchableOpacity, Text, View, Alert, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';

interface TestNotificationButtonProps {
  style?: any;
}

const TestNotificationButton: React.FC<TestNotificationButtonProps> = ({ style }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<'success' | 'error' | null>(null);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  // TEMPORÁRIO: Botão habilitado para produção para testes de APK
  // TODO: Remover após testes e voltar a verificação __DEV__
  // if (!__DEV__) {
  //   return null;
  // }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logMessage = `[${timestamp}] ${message}`;
    setTestLogs(prev => [...prev, logMessage]);
  };

  const sendTestNotification = async () => {
    setIsLoading(true);
    setLastTestResult(null);
    setTestLogs([]);

    try {
      addLog('🚀 Iniciando teste completo de notificações');
      
      if (!user?.id) {
        throw new Error('Usuário não autenticado');
      }

      addLog('👤 Usuário autenticado: ' + user.id);

      // 1. Buscar apartamento do usuário
      addLog('🔍 Buscando apartamento do usuário...');
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartment_residents')
        .select(`
          apartment_id,
          apartments (
            building_id
          )
        `)
        .eq('profile_id', user.id)
        .maybeSingle();

      if (apartmentError) {
        throw new Error('Erro ao buscar apartamento: ' + apartmentError.message);
      }

      if (!apartmentData?.apartment_id || !apartmentData?.apartments?.building_id) {
        throw new Error('Usuário não possui apartamento ou building_id vinculado');
      }

      addLog('🏠 Apartamento encontrado: ' + apartmentData.apartment_id);
      addLog('🏢 Building ID: ' + apartmentData.apartments.building_id);

      // 2. Criar visitante de teste
      addLog('👥 Criando visitante de teste...');
      const testVisitorData = {
        name: 'Visitante Teste',
        document: '12345678901',
        phone: '91981941219', // Número fixo de teste
        created_at: new Date().toISOString()
      };

      const { data: visitorData, error: visitorError } = await supabase
        .from('visitors')
        .insert(testVisitorData)
        .select()
        .single();

      if (visitorError) {
        throw new Error('Erro ao criar visitante: ' + visitorError.message);
      }

      addLog('✅ Visitante criado: ' + visitorData.id);

      // 3. Criar log de visitante (notificação)
      addLog('📝 Criando notificação no banco...');
      const testLogData = {
        visitor_id: visitorData.id,
        apartment_id: apartmentData.apartment_id,
        building_id: apartmentData.apartments.building_id,
        tipo_log: 'entrada',
        purpose: 'Teste de notificação automática',
        notification_status: 'pending',
        requires_resident_approval: true,
        log_time: new Date().toISOString()
      };

      const { data: logData, error: logError } = await supabase
        .from('visitor_logs')
        .insert(testLogData)
        .select()
        .single();

      if (logError) {
        throw new Error('Erro ao criar log: ' + logError.message);
      }

      addLog('📋 Notificação criada no banco: ' + logData.id);

      // 4. Verificar permissões de push notification
      addLog('🔔 Verificando permissões de push notification...');
      const { status } = await Notifications.getPermissionsAsync();
      
      if (status !== 'granted') {
        addLog('⚠️ Permissões de push não concedidas');
        Alert.alert(
          'Permissões necessárias',
          'As notificações push não estão habilitadas. Habilite nas configurações do app.'
        );
      } else {
        // 5. Enviar push notification
        addLog('📱 Enviando push notification...');
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔔 Visitante Aguardando',
            body: `${testVisitorData.name} está aguardando autorização para entrada.`,
            data: {
              type: 'visitor_waiting',
              visitor_id: visitorData.id,
              log_id: logData.id,
              timestamp: new Date().toISOString(),
            },
          },
          trigger: null, // Envia imediatamente
        });
        addLog('✅ Push notification enviado');
      }

      // 6. Chamar endpoint WhatsApp
      addLog('📞 Chamando endpoint WhatsApp...');
      const apiUrl = `${process.env.EXPO_PUBLIC_NOTIFICATION_API_URL || 'https://jamesavisaapi.jamesconcierge.com'}/api/send-visitor-waiting-notification`;
      const whatsappResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitor_name: testVisitorData.name,
          visitor_phone: testVisitorData.phone,
          apartment_id: apartmentData.apartment_id,
          purpose: testLogData.purpose
        }),
      });

      if (!whatsappResponse.ok) {
        const errorText = await whatsappResponse.text();
        throw new Error(`Erro no endpoint WhatsApp: ${whatsappResponse.status} - ${errorText}`);
      }

      const whatsappResult = await whatsappResponse.json();
      addLog('✅ WhatsApp enviado: ' + JSON.stringify(whatsappResult));

      // 7. Limpar dados de teste
      addLog('🧹 Limpando dados de teste...');
      await supabase.from('visitor_logs').delete().eq('id', logData.id);
      await supabase.from('visitors').delete().eq('id', visitorData.id);
      addLog('✅ Dados de teste removidos');

      setLastTestResult('success');
      addLog('🎉 Teste completo finalizado com sucesso!');
      
      Alert.alert(
        'Teste Completo! ✅',
        'Fluxo de notificação testado:\n\n' +
        '✅ Notificação criada no banco\n' +
        '✅ Push notification enviado\n' +
        '✅ WhatsApp enviado para 91981941219\n' +
        '✅ Dados de teste limpos\n\n' +
        'Verifique o console para logs detalhados.'
      );
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      addLog('❌ ERRO: ' + error.message);
      setLastTestResult('error');
      Alert.alert(
        'Erro no Teste ❌',
        `Falha durante o teste:\n\n${error.message}\n\nVerifique o console para mais detalhes.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonColor = () => {
    if (lastTestResult === 'success') return '#10B981'; // Verde
    if (lastTestResult === 'error') return '#EF4444'; // Vermelho
    return '#3B82F6'; // Azul padrão
  };

  const getButtonText = () => {
    if (isLoading) return 'Testando...';
    if (lastTestResult === 'success') return 'Teste OK ✅';
    if (lastTestResult === 'error') return 'Erro ❌';
    return 'Teste Completo';
  };

  return (
    <View style={[{ position: 'absolute', top: 50, right: 20, zIndex: 1000 }, style]}>
      <TouchableOpacity
        onPress={sendTestNotification}
        disabled={isLoading}
        style={{
          backgroundColor: getButtonColor(),
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading && (
          <ActivityIndicator 
            size="small" 
            color="white" 
            style={{ marginRight: 8 }} 
          />
        )}
        <Text
          style={{
            color: 'white',
            fontSize: 12,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {getButtonText()}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default TestNotificationButton;