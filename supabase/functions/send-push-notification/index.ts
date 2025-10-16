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
    } else if (userIds && userIds.length > 0) {
      // Buscar tokens por IDs de usuários
      const { data: profiles } = await supabase
        .from('profiles')
        .select('push_token')
        .in('user_id', userIds)
        .not('push_token', 'is', null);

      const { data: adminProfiles } = await supabase
        .from('admin_profiles')
        .select('push_token')
        .in('user_id', userIds)
        .not('push_token', 'is', null);

      tokens = [
        ...(profiles?.map((p) => p.push_token) || []),
        ...(adminProfiles?.map((p) => p.push_token) || []),
      ].filter(Boolean);
    } else if (userType || buildingId || apartmentIds) {
      // Buscar tokens por filtros
      if (userType === 'admin') {
        const { data } = await supabase
          .from('admin_profiles')
          .select('push_token')
          .not('push_token', 'is', null)
          .eq('is_active', true);

        tokens = data?.map((p) => p.push_token).filter(Boolean) || [];
      } else {
        let query = supabase
          .from('profiles')
          .select('push_token')
          .not('push_token', 'is', null)
          .eq('is_active', true);

        if (userType) {
          query = query.eq('user_type', userType);
        }

        if (buildingId) {
          query = query.eq('building_id', buildingId);
        }

        const { data } = await query;
        tokens = data?.map((p) => p.push_token).filter(Boolean) || [];

        // Se temos apartmentIds, buscar moradores desses apartamentos
        if (apartmentIds && apartmentIds.length > 0) {
          const { data: residents } = await supabase
            .from('apartment_residents')
            .select('profiles!inner(push_token)')
            .in('apartment_id', apartmentIds)
            .not('profiles.push_token', 'is', null);

          if (residents) {
            const residentTokens = residents
              .map((r: any) => r.profiles?.push_token)
              .filter(Boolean);
            tokens = [...tokens, ...residentTokens];
          }
        }
      }
    }

    // Remover duplicatas
    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No push tokens found', sent: 0, failed: 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Preparar mensagens para Expo Push API
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: title,
      body: message,
      data: data || {},
      channelId: type,
      priority: type === 'emergency' ? 'high' : 'default',
    }));

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

        if (result.data) {
          result.data.forEach((item: any) => {
            if (item.status === 'ok') {
              sentCount++;
            } else {
              failedCount++;
              errors.push(item);
            }
          });
        }
      } catch (error) {
        failedCount += batch.length;
        errors.push({ error: error.message, batch: batch.length });
      }
    }

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
    console.error('Error sending push notifications:', error);

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
