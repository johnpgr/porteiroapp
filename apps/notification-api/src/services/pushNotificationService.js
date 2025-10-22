const admin = require('firebase-admin');
const apn = require('node-apn');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class PushNotificationService {
  constructor() {
    this.fcmApp = null;
    this.apnProvider = null;
    this.initialized = false;
  }

  // Inicializar serviços de notificação
  async initialize() {
    try {
      // Inicializar Firebase Admin (FCM)
      if (!admin.apps.length) {
        // Verificar se existe arquivo de credenciais do Firebase
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        
        if (serviceAccountPath) {
          const serviceAccount = require(serviceAccountPath);
          this.fcmApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } else {
          console.warn('⚠️ Firebase Service Account não configurado. Notificações Android podem não funcionar.');
        }
      } else {
        this.fcmApp = admin.app();
      }

      // Inicializar Apple Push Notifications (APNs)
      const apnKeyPath = process.env.APN_KEY_PATH;
      const apnKeyId = process.env.APN_KEY_ID;
      const apnTeamId = process.env.APN_TEAM_ID;

      if (apnKeyPath && apnKeyId && apnTeamId) {
        this.apnProvider = new apn.Provider({
          token: {
            key: apnKeyPath,
            keyId: apnKeyId,
            teamId: apnTeamId,
          },
          production: process.env.NODE_ENV === 'production',
        });
      } else {
        console.warn('⚠️ Apple Push Notifications não configurado. Notificações iOS podem não funcionar.');
      }

      this.initialized = true;
      console.log('✅ Push Notification Service inicializado');

    } catch (error) {
      console.error('❌ Erro ao inicializar Push Notification Service:', error);
      throw error;
    }
  }

  // Enviar notificação push (método específico para notificações)
  async sendNotification(deviceToken, platform, payload) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const result = {
        token: deviceToken,
        platform: platform,
        sent: false,
        error: null
      };

      if (platform === 'android' || platform === 'web') {
        result.sent = await this.sendFCMNotification(deviceToken, payload);
      } else if (platform === 'ios') {
        result.sent = await this.sendAPNSNotification(deviceToken, payload);
      } else {
        result.error = `Plataforma não suportada: ${platform}`;
      }

      return result;

    } catch (error) {
      console.error(`❌ Erro ao enviar notificação ${platform}:`, error);
      return {
        token: deviceToken,
        platform: platform,
        sent: false,
        error: error.message
      };
    }
  }

  // Enviar notificação via Firebase Cloud Messaging (Android/Web)
  async sendFCMNotification(deviceToken, payload) {
    try {
      if (!this.fcmApp) {
        console.warn('⚠️ Firebase não configurado. Pulando notificação FCM.');
        return false;
      }

      const message = {
        token: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type || 'notification',
          callId: payload.callId || '',
          apartmentNumber: payload.apartmentNumber || '',
          groupId: payload.groupId || '',
          priority: 'urgent',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            channel_id: 'notifications',
            default_sound: true,
            default_vibrate_timings: false,
            vibrate_timings: ['0.5s', '0.5s', '0.5s'],
            notification_priority: 'PRIORITY_MAX',
            visibility: 'PUBLIC'
          },
          data: {
            type: payload.type || 'notification',
            callId: payload.callId || '',
            apartmentNumber: payload.apartmentNumber || '',
            priority: 'urgent'
          }
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: `notification_${payload.callId}`,
            requireInteraction: true,
            actions: [
              { action: 'answer', title: 'Atender' },
              { action: 'decline', title: 'Recusar' }
            ],
            data: {
              callId: payload.callId,
              type: 'notification',
              apartmentNumber: payload.apartmentNumber
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      console.log(`📱 Notificação FCM enviada com sucesso: ${response}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao enviar notificação FCM:', error);
      
      // Verificar se o token é inválido e remover do banco
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        await this.removeInvalidToken(deviceToken);
      }
      
      return false;
    }
  }

  // Enviar notificação via Apple Push Notification Service (iOS)
  async sendAPNSNotification(deviceToken, payload) {
    try {
      if (!this.apnProvider) {
        console.warn('⚠️ Apple Push Notifications não configurado. Pulando notificação APNS.');
        return false;
      }

      const notification = new apn.Notification();
      
      // Configurar como notificação prioritária
      notification.alert = {
        title: payload.title,
        body: payload.body
      };
      
      notification.sound = 'default';
      notification.badge = 1;
      notification.category = 'NOTIFICATION';
      notification.contentAvailable = true;
      notification.mutableContent = true;
      notification.priority = 10; // Prioridade máxima
      notification.pushType = 'alert';
      
      // Dados customizados
      notification.payload = {
        type: payload.type || 'notification',
        callId: payload.callId || '',
        apartmentNumber: payload.apartmentNumber || '',
        groupId: payload.groupId || '',
        priority: 'urgent'
      };

      // Configurar para fazer o telefone tocar como chamada
      notification.aps = {
        ...notification.aps,
        'interruption-level': 'critical',
        'relevance-score': 1.0
      };

      const result = await this.apnProvider.send(notification, deviceToken);
      
      if (result.sent.length > 0) {
        console.log(`📱 Notificação APNS enviada com sucesso para ${result.sent.length} dispositivos`);
        return true;
      } else if (result.failed.length > 0) {
        console.error('❌ Falha ao enviar notificação APNS:', result.failed);
        
        // Remover tokens inválidos
        for (const failure of result.failed) {
          if (failure.status === '410' || failure.status === '400') {
            await this.removeInvalidToken(failure.device);
          }
        }
        
        return false;
      }

      return false;

    } catch (error) {
      console.error('❌ Erro ao enviar notificação APNS:', error);
      return false;
    }
  }

  // Remover token inválido do banco de dados
  async removeInvalidToken(deviceToken) {
    try {
      console.log(`🗑️ Removendo token inválido: ${deviceToken.substring(0, 10)}...`);
      
      // Remover token da tabela device_tokens
      await supabase
        .from('device_tokens')
        .delete()
        .eq('token', deviceToken);

      // Também remover de profiles se existir (compatibilidade)
      await supabase
        .from('profiles')
        .update({ expo_push_token: null })
        .eq('expo_push_token', deviceToken);

    } catch (error) {
      console.error('❌ Erro ao remover token inválido:', error);
    }
  }

  // Enviar notificações em lote
  async sendBatchNotifications(notifications) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📱 Enviando ${notifications.length} notificações push`);

      const results = {
        total: notifications.length,
        successful: 0,
        failed: 0,
        details: []
      };

      // Processar todas as notificações simultaneamente
      const notificationPromises = notifications.map(async (notification) => {
        try {
          const { userId, title, body, data, deviceTokens } = notification;

          if (!deviceTokens || deviceTokens.length === 0) {
            console.warn(`⚠️ Usuário ${userId} não possui tokens de dispositivo`);
            return {
              userId,
              sent: false,
              error: 'Nenhum token de dispositivo encontrado'
            };
          }

          // Enviar para todos os dispositivos do usuário
          const deviceResults = await Promise.allSettled(
            deviceTokens.map(async (tokenData) => {
              const payload = {
                title,
                body,
                data: {
                  ...data,
                  userId,
                  timestamp: new Date().toISOString()
                }
              };

              return await this.sendNotification(
                tokenData.token,
                tokenData.platform,
                payload
              );
            })
          );

          // Contar sucessos e falhas por usuário
          const userSuccessful = deviceResults.filter(
            result => result.status === 'fulfilled' && result.value.sent
          ).length;

          const userFailed = deviceResults.length - userSuccessful;

          return {
            userId,
            devicesTotal: deviceTokens.length,
            devicesSuccessful: userSuccessful,
            devicesFailed: userFailed,
            sent: userSuccessful > 0,
            results: deviceResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
          };

        } catch (error) {
          console.error(`❌ Erro ao processar notificação para usuário ${notification.userId}:`, error);
          return {
            userId: notification.userId,
            sent: false,
            error: error.message
          };
        }
      });

      // Aguardar todas as notificações serem processadas
      const notificationResults = await Promise.allSettled(notificationPromises);

      // Consolidar resultados
      notificationResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const userResult = result.value;
          results.details.push(userResult);
          
          if (userResult.sent) {
            results.successful++;
          } else {
            results.failed++;
          }
        } else {
          results.failed++;
          results.details.push({
            error: result.reason,
            sent: false
          });
        }
      });

      console.log(`📊 Resultado das notificações: ${results.successful}/${results.total} usuários notificados com sucesso`);

      return results;

    } catch (error) {
      console.error('❌ Erro ao enviar notificações em lote:', error);
      return {
        total: notifications.length,
        successful: 0,
        failed: notifications.length,
        error: error.message,
        details: []
      };
    }
  }

  // Registrar token de dispositivo
  async registerDeviceToken(profileId, token, platform) {
    try {
      // Verificar se o token já existe
      const { data: existingToken } = await supabase
        .from('device_tokens')
        .select('id')
        .eq('profile_id', profileId)
        .eq('token', token)
        .single();

      if (existingToken) {
        console.log(`📱 Token já registrado para usuário ${profileId}`);
        return existingToken;
      }

      // Inserir novo token
      const { data, error } = await supabase
        .from('device_tokens')
        .insert({
          profile_id: profileId,
          token: token,
          platform: platform,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`📱 Token registrado com sucesso para usuário ${profileId}`);
      return data;

    } catch (error) {
      console.error('❌ Erro ao registrar token de dispositivo:', error);
      throw error;
    }
  }

  // Desregistrar token de dispositivo
  async unregisterDeviceToken(profileId, token) {
    try {
      const { error } = await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('profile_id', profileId)
        .eq('token', token);

      if (error) throw error;

      console.log(`📱 Token desregistrado para usuário ${profileId}`);

    } catch (error) {
      console.error('❌ Erro ao desregistrar token de dispositivo:', error);
      throw error;
    }
  }

  // Obter tokens ativos de um usuário
  async getUserDeviceTokens(profileId) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('token, platform, created_at')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('❌ Erro ao buscar tokens do usuário:', error);
      return [];
    }
  }
}

module.exports = new PushNotificationService();