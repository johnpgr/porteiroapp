import React, { useState } from 'react';
import { TouchableOpacity, Text, View, Alert, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';

interface TestNotificationButtonProps {
  style?: any;
}

const TestNotificationButton: React.FC<TestNotificationButtonProps> = ({ style }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<'success' | 'error' | null>(null);

  // TEMPORÁRIO: Botão habilitado para produção para testes de APK
  // TODO: Remover após testes e voltar a verificação __DEV__
  // if (!__DEV__) {
  //   return null;
  // }

  const sendTestNotification = async () => {
    setIsLoading(true);
    setLastTestResult(null);

    try {
      // Verifica se as permissões estão concedidas
      const { status } = await Notifications.getPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissões necessárias',
          'As notificações push não estão habilitadas. Habilite nas configurações do app.'
        );
        setIsLoading(false);
        return;
      }

      // Envia uma notificação de teste
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Teste de Notificação',
          body: 'Esta é uma notificação de teste do JamesAvisa!',
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
          },
        },
        trigger: null, // Envia imediatamente
      });

      setLastTestResult('success');
      Alert.alert(
        'Sucesso!',
        'Notificação de teste enviada com sucesso! ✅'
      );
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      setLastTestResult('error');
      Alert.alert(
        'Erro',
        'Falha ao enviar notificação de teste. Verifique o console para mais detalhes.'
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
    if (isLoading) return 'Enviando...';
    if (lastTestResult === 'success') return 'Teste OK ✅';
    if (lastTestResult === 'error') return 'Erro ❌';
    return 'Testar Notificações';
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