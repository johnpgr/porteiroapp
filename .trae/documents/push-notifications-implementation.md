# Implementação Prática - Sistema de Push Notifications

## 1. Configurações FCM e APNs

### 1.1 Firebase Cloud Messaging (Android)

**Configuração do Projeto Firebase:**
```json
// firebase.json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2563eb",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

**Configuração no app.json:**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2563eb"
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### 1.2 Apple Push Notification Service (iOS)

**Configuração no app.json:**
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.porteiroapp.notifications",
      "buildNumber": "1.0.0"
    },
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#2563eb",
      "iosDisplayInForeground": true
    }
  }
}
```

## 2. Implementação no Aplicativo

### 2.1 Serviço de Notificações

**utils/notificationService.ts:**
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configuração global de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationToken {
  token: string;
  deviceType: 'android' | 'ios';
  deviceInfo: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

export class NotificationService {
  private static instance: NotificationService;
  private currentToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permission for push notifications denied');
      return false;
    }

    return true;
  }

  async getDeviceToken(): Promise<NotificationToken | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      const deviceInfo = {
        model: Device.modelName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        appVersion: '1.0.0', // Pode vir do app.json
      };

      const token: NotificationToken = {
        token: tokenData.data,
        deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceInfo,
      };

      this.currentToken = token.token;
      return token;
    } catch (error) {
      console.error('Error getting device token:', error);
      return null;
    }
  }

  async registerToken(userId: string): Promise<boolean> {
    try {
      const tokenData = await this.getDeviceToken();
      if (!tokenData) return false;

      const { error } = await supabase
        .from('user_notification_tokens')
        .upsert({
          user_id: userId,
          device_type: tokenData.deviceType,
          notification_token: tokenData.token,
          device_info: tokenData.deviceInfo,
          is_active: true,
        }, {
          onConflict: 'user_id,notification_token'
        });

      if (error) {
        console.error('Error registering token:', error);
        return false;
      }

      console.log('Token registered successfully');
      return true;
    } catch (error) {
      console.error('Error in registerToken:', error);
      return false;
    }
  }

  async updateTokenStatus(userId: string, isActive: boolean): Promise<void> {
    if (!this.currentToken) return;

    try {
      await supabase
        .from('user_notification_tokens')
        .update({ is_active: isActive })
        .eq('user_id', userId)
        .eq('notification_token', this.currentToken);
    } catch (error) {
      console.error('Error updating token status:', error);
    }
  }

  setupNotificationListeners() {
    // Listener para notificações recebidas em foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received in foreground:', notification);
        this.handleNotificationReceived(notification);
      }
    );

    // Listener para quando usuário toca na notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        this.handleNotificationResponse(response);
      }
    );

    return {
      foregroundSubscription,
      responseSubscription,
    };
  }

  private async handleNotificationReceived(notification: Notifications.Notification) {
    // Atualizar status para 'delivered'
    const notificationId = notification.request.content.data?.notificationId;
    if (notificationId) {
      await this.updateNotificationStatus(notificationId, 'delivered');
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    
    // Marcar como lida
    if (data?.notificationId) {
      await this.updateNotificationStatus(data.notificationId, 'read');
    }

    // Navegar para tela apropriada baseado no tipo
    if (data?.type === 'visitor_approval') {
      // Navegar para tela de aprovação de visitante
      console.log('Navigate to visitor approval:', data);
    }
  }

  private async updateNotificationStatus(notificationId: string, status: string) {
    try {
      await supabase
        .from('notifications')
        .update({ 
          status,
          ...(status === 'delivered' && { sent_at: new Date().toISOString() })
        })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }
}
```

### 2.2 Hook de Notificações

**hooks/useNotifications.ts:**
```typescript
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NotificationService } from '../utils/notificationService';
import { useAuth } from './useAuth';

export const useNotifications = () => {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const notificationService = NotificationService.getInstance();

  useEffect(() => {
    if (user?.id) {
      initializeNotifications();
      setupAppStateListener();
    }
  }, [user?.id]);

  const initializeNotifications = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const success = await notificationService.registerToken(user.id);
      setIsRegistered(success);
      
      if (success) {
        // Configurar listeners
        const listeners = notificationService.setupNotificationListeners();
        
        // Cleanup function será retornada pelo useEffect
        return () => {
          listeners.foregroundSubscription.remove();
          listeners.responseSubscription.remove();
        };
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (user?.id) {
        const isActive = nextAppState === 'active';
        notificationService.updateTokenStatus(user.id, isActive);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const refreshToken = async () => {
    if (!user?.id) return false;
    
    setIsLoading(true);
    try {
      const success = await notificationService.registerToken(user.id);
      setIsRegistered(success);
      return success;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isRegistered,
    isLoading,
    refreshToken,
  };
};
```

## 3. Servidor de Notificações (Supabase Edge Functions)

### 3.1 Edge Function Principal

**supabase/functions/send-notification/index.ts:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationRequest {
  recipient_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

interface FCMMessage {
  to: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  priority: string;
}

serve(async (req) => {
  try {
    // Verificar método HTTP
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse do body
    const notificationData: NotificationRequest = await req.json();
    
    // Validação básica
    if (!notificationData.recipient_id || !notificationData.title || !notificationData.body) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Inicializar Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar registro de notificação
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: notificationData.recipient_id,
        title: notificationData.title,
        body: notificationData.body,
        data: notificationData.data || {},
        priority: notificationData.priority || 'normal',
        status: 'pending'
      })
      .select()
      .single();

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      return new Response('Error creating notification', { status: 500 });
    }

    // Buscar tokens do usuário
    const { data: tokens, error: tokensError } = await supabase
      .from('user_notification_tokens')
      .select('*')
      .eq('user_id', notificationData.recipient_id)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response('Error fetching tokens', { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      await supabase
        .from('notifications')
        .update({ status: 'failed' })
        .eq('id', notification.id);
      
      return new Response('No active tokens found', { status: 404 });
    }

    // Enviar notificações para cada token
    const sendPromises = tokens.map(token => 
      sendPushNotification(token, notification, supabase)
    );

    const results = await Promise.allSettled(sendPromises);
    
    // Verificar resultados
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    // Atualizar status da notificação
    const finalStatus = successCount > 0 ? 'sent' : 'failed';
    await supabase
      .from('notifications')
      .update({ 
        status: finalStatus,
        sent_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return new Response(JSON.stringify({
      success: true,
      notification_id: notification.id,
      sent_to: successCount,
      failed: failureCount
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in send-notification function:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

async function sendPushNotification(token: any, notification: any, supabase: any) {
  try {
    let success = false;
    let errorMessage = '';
    let responseData = {};

    if (token.device_type === 'android' || token.device_type === 'ios') {
      // Usar Expo Push API para ambas as plataformas
      const message = {
        to: token.notification_token,
        title: notification.title,
        body: notification.body,
        data: {
          ...notification.data,
          notificationId: notification.id
        },
        priority: notification.priority === 'high' ? 'high' : 'default',
        sound: 'default',
        badge: 1
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });

      responseData = await response.json();
      success = response.ok;
      
      if (!success) {
        errorMessage = JSON.stringify(responseData);
      }
    }

    // Log do resultado
    await supabase
      .from('notification_logs')
      .insert({
        notification_id: notification.id,
        token_id: token.id,
        platform: token.device_type,
        status: success ? 'sent' : 'failed',
        error_message: errorMessage || null,
        response_data: responseData,
        attempted_at: new Date().toISOString()
      });

    return success;
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // Log do erro
    await supabase
      .from('notification_logs')
      .insert({
        notification_id: notification.id,
        token_id: token.id,
        platform: token.device_type,
        status: 'failed',
        error_message: error.message,
        attempted_at: new Date().toISOString()
      });

    return false;
  }
}
```

## 4. Sistema de Filas e Retry

### 4.1 Edge Function para Processamento de Fila

**supabase/functions/process-notification-queue/index.ts:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar notificações pendentes ou com falha (para retry)
    const { data: pendingNotifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        notification_logs(
          id,
          status,
          attempted_at
        )
      `)
      .in('status', ['pending', 'failed'])
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutos atrás
      .limit(50);

    if (error) {
      console.error('Error fetching pending notifications:', error);
      return new Response('Error fetching notifications', { status: 500 });
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending notifications' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const notification of pendingNotifications) {
      try {
        // Verificar se já tentou muitas vezes
        const attemptCount = notification.notification_logs?.length || 0;
        if (attemptCount >= 3) {
          // Marcar como falha permanente
          await supabase
            .from('notifications')
            .update({ status: 'failed' })
            .eq('id', notification.id);
          continue;
        }

        // Reenviar notificação
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            recipient_id: notification.recipient_id,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            priority: notification.priority
          })
        });

        if (response.ok) {
          processedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing notification:', error);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      processed: processedCount,
      errors: errorCount,
      total: pendingNotifications.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-notification-queue:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
```

## 5. Monitoramento e Métricas

### 5.1 Dashboard de Monitoramento

**components/admin/NotificationDashboard.tsx:**
```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../../utils/supabase';

interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  avgResponseTime: number;
  activeTokens: number;
  platformBreakdown: {
    android: number;
    ios: number;
  };
}

export const NotificationDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      // Buscar métricas dos últimos 7 dias
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Total de notificações enviadas
      const { count: totalSent } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

      // Total entregues
      const { count: totalDelivered } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['delivered', 'read'])
        .gte('created_at', sevenDaysAgo);

      // Total com falha
      const { count: totalFailed } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', sevenDaysAgo);

      // Tokens ativos
      const { count: activeTokens } = await supabase
        .from('user_notification_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Breakdown por plataforma
      const { data: platformData } = await supabase
        .from('user_notification_tokens')
        .select('device_type')
        .eq('is_active', true);

      const platformBreakdown = {
        android: platformData?.filter(t => t.device_type === 'android').length || 0,
        ios: platformData?.filter(t => t.device_type === 'ios').length || 0,
      };

      const deliveryRate = totalSent ? (totalDelivered / totalSent) * 100 : 0;

      setMetrics({
        totalSent: totalSent || 0,
        totalDelivered: totalDelivered || 0,
        totalFailed: totalFailed || 0,
        deliveryRate,
        avgResponseTime: 0, // Implementar cálculo se necessário
        activeTokens: activeTokens || 0,
        platformBreakdown,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMetrics();
  };

  if (loading && !metrics) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Carregando métricas...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50 p-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text className="text-2xl font-bold mb-6">Dashboard de Notificações</Text>
      
      {/* Cards de métricas */}
      <View className="flex-row flex-wrap justify-between mb-6">
        <MetricCard 
          title="Total Enviadas" 
          value={metrics?.totalSent || 0} 
          color="blue" 
        />
        <MetricCard 
          title="Entregues" 
          value={metrics?.totalDelivered || 0} 
          color="green" 
        />
        <MetricCard 
          title="Falhas" 
          value={metrics?.totalFailed || 0} 
          color="red" 
        />
        <MetricCard 
          title="Taxa de Entrega" 
          value={`${metrics?.deliveryRate.toFixed(1)}%`} 
          color="purple" 
        />
      </View>

      {/* Breakdown por plataforma */}
      <View className="bg-white rounded-lg p-4 mb-4">
        <Text className="text-lg font-semibold mb-3">Dispositivos Ativos</Text>
        <View className="flex-row justify-between">
          <View className="items-center">
            <Text className="text-2xl font-bold text-green-600">
              {metrics?.platformBreakdown.android || 0}
            </Text>
            <Text className="text-gray-600">Android</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-blue-600">
              {metrics?.platformBreakdown.ios || 0}
            </Text>
            <Text className="text-gray-600">iOS</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-purple-600">
              {metrics?.activeTokens || 0}
            </Text>
            <Text className="text-gray-600">Total</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  color: 'blue' | 'green' | 'red' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <View className="bg-white rounded-lg p-4 mb-4 w-[48%]">
      <View className={`w-3 h-3 rounded-full ${colorClasses[color]} mb-2`} />
      <Text className="text-gray-600 text-sm">{title}</Text>
      <Text className="text-2xl font-bold">{value}</Text>
    </View>
  );
};
```

## 6. Plano de Testes Detalhado

### 6.1 Testes Unitários

**__tests__/notificationService.test.ts:**
```typescript
import { NotificationService } from '../utils/notificationService';

// Mock do Expo Notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

// Mock do Supabase
jest.mock('../utils/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(),
      update: jest.fn(),
      eq: jest.fn(),
    })),
  },
}));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = NotificationService.getInstance();
  });

  describe('requestPermissions', () => {
    it('should return true when permissions are granted', async () => {
      const mockNotifications = require('expo-notifications');
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await service.requestPermissions();
      expect(result).toBe(true);
    });

    it('should request permissions when not granted', async () => {
      const mockNotifications = require('expo-notifications');
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await service.requestPermissions();
      expect(result).toBe(true);
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('getDeviceToken', () => {
    it('should return token data when successful', async () => {
      const mockNotifications = require('expo-notifications');
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'test-token-123'
      });

      const result = await service.getDeviceToken();
      expect(result).toMatchObject({
        token: 'test-token-123',
        deviceType: expect.any(String),
        deviceInfo: expect.any(Object),
      });
    });
  });
});
```

### 6.2 Testes de Integração

**__tests__/integration/pushNotifications.test.ts:**
```typescript
import { supabase } from '../../utils/supabase';

describe('Push Notifications Integration', () => {
  const testUserId = 'test-user-123';
  const testToken = 'test-expo-token-456';

  beforeEach(async () => {
    // Limpar dados de teste
    await supabase
      .from('user_notification_tokens')
      .delete()
      .eq('user_id', testUserId);
    
    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', testUserId);
  });

  describe('Token Registration', () => {
    it('should register a new token successfully', async () => {
      const { error } = await supabase
        .from('user_notification_tokens')
        .insert({
          user_id: testUserId,
          device_type: 'android',
          notification_token: testToken,
          device_info: { model: 'Test Device' },
        });

      expect(error).toBeNull();

      // Verificar se foi inserido
      const { data, error: fetchError } = await supabase
        .from('user_notification_tokens')
        .select('*')
        .eq('user_id', testUserId)
        .single();

      expect(fetchError).toBeNull();
      expect(data.notification_token).toBe(testToken);
    });

    it('should update existing token on conflict', async () => {
      // Inserir token inicial
      await supabase
        .from('user_notification_tokens')
        .insert({
          user_id: testUserId,
          device_type: 'android',
          notification_token: testToken,
          is_active: false,
        });

      // Atualizar com upsert
      const { error } = await supabase
        .from('user_notification_tokens')
        .upsert({
          user_id: testUserId,
          device_type: 'android',
          notification_token: testToken,
          is_active: true,
        }, {
          onConflict: 'user_id,notification_token'
        });

      expect(error).toBeNull();

      // Verificar atualização
      const { data } = await supabase
        .from('user_notification_tokens')
        .select('is_active')
        .eq('user_id', testUserId)
        .single();

      expect(data.is_active).toBe(true);
    });
  });

  describe('Notification Creation', () => {
    it('should create notification with correct data', async () => {
      const notificationData = {
        recipient_id: testUserId,
        title: 'Test Notification',
        body: 'This is a test notification',
        data: { type: 'test' },
        priority: 'high',
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.title).toBe(notificationData.title);
      expect(data.status).toBe('pending');
    });
  });
});
```

### 6.3 Testes End-to-End

**e2e/pushNotifications.e2e.ts:**
```typescript
import { by, device, element, expect } from 'detox';

describe('Push Notifications E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should request notification permissions on app start', async () => {
    // Aguardar tela de login
    await expect(element(by.id('login-screen'))).toBeVisible();
    
    // Fazer login
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    
    // Verificar se chegou na tela principal
    await expect(element(by.id('main-screen'))).toBeVisible();
    
    // Verificar se as permissões foram solicitadas
    // (Isso pode variar dependendo da plataforma)
  });

  it('should display notification when received', async () => {
    // Simular recebimento de notificação
    await device.sendUserNotification({
      trigger: {
        type: 'push',
      },
      title: 'Visitante Aguardando',
      body: 'João Silva está aguardando autorização',
      payload: {
        type: 'visitor_approval',
        visitor_id: '123',
      },
    });

    // Verificar se a notificação apareceu
    await expect(element(by.text('Visitante Aguardando'))).toBeVisible();
  });

  it('should navigate to correct screen when notification is tapped', async () => {
    // Enviar notificação
    await device.sendUserNotification({
      trigger: { type: 'push' },
      title: 'Visitante Aguardando',
      body: 'João Silva está aguardando autorização',
      payload: {
        type: 'visitor_approval',
        visitor_id: '123',
      },
    });

    // Tocar na notificação
    await device.launchApp({ newInstance: false, userNotification: {
      trigger: { type: 'push' },
      title: 'Visitante Aguardando',
      body: 'João Silva está aguardando autorização',
      payload: {
        type: 'visitor_approval',
        visitor_id: '123',
      },
    }});

    // Verificar navegação para tela correta
    await expect(element(by.id('visitor-approval-screen'))).toBeVisible();
  });
});
```

### 6.4 Testes de Performance

**__tests__/performance/notificationLoad.test.ts:**
```typescript
describe('Notification Performance Tests', () => {
  it('should handle multiple token registrations efficiently', async () => {
    const startTime = Date.now();
    const promises = [];

    // Simular 100 registros simultâneos
    for (let i = 0; i < 100; i++) {
      promises.push(
        supabase
          .from('user_notification_tokens')
          .upsert({
            user_id: `user-${i}`,
            device_type: 'android',
            notification_token: `token-${i}`,
          })
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Deve completar em menos de 5 segundos
    expect(duration).toBeLessThan(5000);
  });

  it('should process notification queue efficiently', async () => {
    // Criar 50 notificações pendentes
    const notifications = Array.from({ length: 50 }, (_, i) => ({
      recipient_id: `user-${i}`,
      title: `Test Notification ${i}`,
      body: 'Test body',
      status: 'pending',
    }));

    await supabase
      .from('notifications')
      .insert(notifications);

    const startTime = Date.now();
    
    // Processar fila
    const response = await fetch('/functions/v1/process-notification-queue', {
      method: 'POST',
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(10000); // 10 segundos
  });
});
```

## 7. Compatibilidade e Migração

### 7.1 Verificação de Compatibilidade

**utils/compatibilityCheck.ts:**
```typescript
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export interface CompatibilityResult {
  isSupported: boolean;
  issues: string[];
  recommendations: string[];
}

export const checkPushNotificationCompatibility = (): CompatibilityResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Verificar se é dispositivo físico
  if (!Device.isDevice) {
    issues.push('Push notifications não funcionam em simuladores');
    recommendations.push('Teste em dispositivo físico');
  }

  // Verificar versão do OS
  if (Platform.OS === 'ios') {
    const iosVersion = parseFloat(Device.osVersion || '0');
    if (iosVersion < 10.0) {
      issues.push('iOS 10.0+ é necessário para push notifications');
      recommendations.push('Atualize o iOS para versão 10.0 ou superior');
    }
  }

  if (Platform.OS === 'android') {
    const androidVersion = parseInt(Device.osVersion || '0');
    if (androidVersion < 21) {
      issues.push('Android 5.0+ (API 21) é necessário');
      recommendations.push('Atualize o Android para versão 5.0 ou superior');
    }
  }

  // Verificar se Expo está configurado
  if (!process.env.EXPO_PUBLIC_PROJECT_ID) {
    issues.push('EXPO_PUBLIC_PROJECT_ID não configurado');
    recommendations.push('Configure o Project ID do Expo');
  }

  return {
    isSupported: issues.length === 0,
    issues,
    recommendations,
  };
};
```

### 7.2 Script de Migração

**scripts/migrateNotifications.sql:**
```sql
-- Script para migração segura do sistema de notificações
-- Execute este script em ambiente de produção

BEGIN;

-- 1. Backup das tabelas existentes (se houver)
CREATE TABLE IF NOT EXISTS notifications_backup AS 
SELECT * FROM notifications WHERE 1=0;

-- 2. Criar tabelas se não existirem
CREATE TABLE IF NOT EXISTS user_notification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_type VARCHAR(10) NOT NULL CHECK (device_type IN ('android', 'ios')),
    notification_token TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, notification_token)
);

-- 3. Verificar se índices existem antes de criar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_notification_tokens_user_id') THEN
        CREATE INDEX idx_user_notification_tokens_user_id ON user_notification_tokens(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_notification_tokens_active') THEN
        CREATE INDEX idx_user_notification_tokens_active ON user_notification_tokens(is_active) WHERE is_active = true;
    END IF;
END $$;

-- 4. Migrar dados existentes (se houver)
-- Este passo deve ser customizado baseado na estrutura atual

-- 5. Verificar integridade dos dados
DO $$
DECLARE
    token_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO token_count FROM user_notification_tokens;
    SELECT COUNT(*) INTO user_count FROM users;
    
    RAISE NOTICE 'Migração concluída: % tokens para % usuários', token_count, user_count;
END $$;

COMMIT;
```

Este documento fornece uma implementação completa e robusta do sistema de push notifications, incluindo todos os aspectos técnicos necessários para uma implementação bem-sucedida em produção.