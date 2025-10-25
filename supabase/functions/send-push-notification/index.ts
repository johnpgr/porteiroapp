// Supabase Edge Function para enviar notificações push via Expo Push API
// Deploy: supabase functions deploy send-push-notification

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface PushNotificationRequest {
  userIds?: string[];
  pushTokens?: string[];
  title: string;
  message: string;
  type: 'visitor' | 'delivery' | 'communication' | 'emergency';
  data?: Record<string, any>;
  // Filtros alternativos
  userType?: 'admin' | 'porteiro' | 'morador';
  buildingId?: string;
  apartmentIds?: string[];
}

interface ExpoPushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId: string;
  priority: 'default' | 'normal' | 'high';
  badge?: number;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: PushNotificationRequest = await req.json();
    const { title, message, type, data, userIds, pushTokens, userType, buildingId, apartmentIds } =
      body;

    console.log('🔔 [send-push-notification] Request received:', {
      title,
      type,
      userType,
      buildingId,
      hasUserIds: !!userIds,
      hasPushTokens: !!pushTokens,
      hasApartmentIds: !!apartmentIds
    });

    // Validação básica
    if (!title || !message || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, message, type' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar push tokens
    let tokens: string[] = [];

    if (pushTokens && pushTokens.length > 0) {
      // Tokens fornecidos diretamente
      tokens = pushTokens;
      console.log(`📱 [send-push-notification] Usando ${tokens.length} tokens fornecidos diretamente`);
    } else if (userIds && userIds.length > 0) {
      // Buscar tokens por IDs de usuários na tabela profiles
      console.log(`🔍 [send-push-notification] Buscando tokens por userIds: ${userIds.length} IDs`);

      const { data: profileTokens, error } = await supabase
        .from('profiles')
        .select('push_token')
        .in('id', userIds)
        .eq('notification_enabled', true)
        .not('push_token', 'is', null);

      if (error) {
        console.error('❌ [send-push-notification] Erro ao buscar tokens por userIds:', error);
      } else {
        tokens = profileTokens?.map((t) => t.push_token).filter(Boolean) || [];
        console.log(`📱 [send-push-notification] Encontrados ${tokens.length} tokens por userIds`);
      }
    } else if (userType || buildingId || apartmentIds) {
      // Buscar tokens por filtros
      console.log(`🔍 [send-push-notification] Buscando tokens para userType: ${userType}, buildingId: ${buildingId}`);

      if (userType === 'porteiro') {
        // Buscar porteiros diretamente da tabela profiles usando push_token
        console.log('🔍 [send-push-notification] Buscando tokens de porteiros via profiles.push_token');

        let profileQuery = supabase
          .from('profiles')
          .select('push_token, full_name, id')
          .eq('user_type', 'porteiro')
          .eq('notification_enabled', true)
          .not('push_token', 'is', null);

        if (buildingId) {
          profileQuery = profileQuery.eq('building_id', buildingId);
          console.log(`🏢 [send-push-notification] Filtrando por building_id: ${buildingId}`);
        }

        const { data: porteiroProfiles, error: profileError } = await profileQuery;

        if (profileError) {
          console.error('❌ [send-push-notification] Erro ao buscar perfis de porteiros:', profileError);
        } else if (porteiroProfiles && porteiroProfiles.length > 0) {
          tokens = porteiroProfiles.map(p => p.push_token).filter(Boolean);
          console.log(`📱 [send-push-notification] Encontrados ${tokens.length} tokens de porteiros`);
          console.log(`📱 [send-push-notification] Porteiros:`, porteiroProfiles.map(p => p.full_name));
        } else {
          console.warn(`⚠️ [send-push-notification] Nenhum porteiro encontrado para buildingId: ${buildingId}`);
        }
      } else if (userType === 'morador') {
        // Buscar moradores
        let profileQuery = supabase
          .from('profiles')
          .select('push_token')
          .eq('user_type', 'morador')
          .eq('notification_enabled', true)
          .not('push_token', 'is', null);

        if (buildingId) {
          profileQuery = profileQuery.eq('building_id', buildingId);
        }

        const { data: profiles } = await profileQuery;

        if (profiles && profiles.length > 0) {
          tokens = profiles.map(p => p.push_token).filter(Boolean);
          console.log(`📱 [send-push-notification] Encontrados ${tokens.length} tokens de moradores`);
        }

        // Se temos apartmentIds, buscar moradores desses apartamentos
        if (apartmentIds && apartmentIds.length > 0) {
          console.log(`🏠 [send-push-notification] Buscando moradores por apartmentIds:`, apartmentIds);

          const { data: residents, error: residentError } = await supabase
            .from('apartment_residents')
            .select('profile_id, profiles!inner(id, full_name, push_token, notification_enabled, user_type)')
            .in('apartment_id', apartmentIds);

          console.log(`🔍 [send-push-notification] Residents query result:`, {
            count: residents?.length,
            error: residentError,
            residents: residents
          });

          if (residentError) {
            console.error('❌ [send-push-notification] Erro ao buscar moradores por apartamento:', residentError);
          } else if (residents && residents.length > 0) {
            console.log(`📋 [send-push-notification] Moradores encontrados:`, residents.map((r: any) => ({
              name: r.profiles?.full_name,
              user_type: r.profiles?.user_type,
              has_token: !!r.profiles?.push_token,
              notification_enabled: r.profiles?.notification_enabled,
              token_preview: r.profiles?.push_token ? r.profiles.push_token.substring(0, 20) + '...' : null
            })));

            const apartmentTokens = residents
              .filter((r: any) => r.profiles?.notification_enabled && r.profiles?.push_token)
              .map((r: any) => r.profiles?.push_token)
              .filter(Boolean);

            tokens = [...tokens, ...apartmentTokens];
            console.log(`📱 [send-push-notification] Adicionados ${apartmentTokens.length} tokens válidos de moradores do apartamento`);
            console.log(`📱 [send-push-notification] Tokens completos:`, apartmentTokens);
          } else {
            console.warn(`⚠️ [send-push-notification] Nenhum morador encontrado para apartmentIds:`, apartmentIds);
          }
        }
      }
    }

    // Remover duplicatas
    tokens = [...new Set(tokens)];

    console.log(`📊 [send-push-notification] Total de tokens únicos: ${tokens.length}`);

    if (tokens.length === 0) {
      console.warn('⚠️ [send-push-notification] Nenhum token encontrado');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No push tokens found',
          sent: 0,
          failed: 0,
          message: 'Nenhum usuário com token de notificação ativo encontrado'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Preparar mensagens para Expo Push API
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: 'doorbell-push.mp3',
      title: title,
      body: message,
      data: data || {},
      channelId: type,
      priority: type === 'emergency' ? 'high' : 'default',
    }));

    console.log(`📤 [send-push-notification] Enviando ${messages.length} notificações`);

    // Enviar notificações em lotes de 100 (limite da API Expo)
    const batchSize = 100;
    const batches: ExpoPushMessage[][] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (const batch of batches) {
      try {
        const response = await fetch(EXPO_PUSH_API, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        const result = await response.json();

        console.log('📱 [send-push-notification] Resposta completa do Expo:', JSON.stringify(result, null, 2));

        if (result.data) {
          result.data.forEach((item: any, index: number) => {
            console.log(`📱 [send-push-notification] Item ${index}:`, JSON.stringify(item, null, 2));
            console.log(`📱 [send-push-notification] Token usado:`, batch[index]?.to);

            if (item.status === 'ok') {
              sentCount++;
              console.log(`✅ [send-push-notification] Notificação ${index} enviada com sucesso`);
            } else {
              failedCount++;
              errors.push({
                ...item,
                token: batch[index]?.to,
                title: batch[index]?.title
              });
              console.error(`❌ [send-push-notification] Notificação ${index} falhou:`, item);
            }
          });
        }
      } catch (error) {
        failedCount += batch.length;
        errors.push({ error: error.message, batch: batch.length });
      }
    }

    console.log(`✅ [send-push-notification] Resultado: ${sentCount} enviadas, ${failedCount} falharam`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: tokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ [send-push-notification] Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        success: false,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
