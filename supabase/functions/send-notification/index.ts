import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationRequest {
  user_id: string;
  title: string;
  body: string;
  type: 'visitor_approval' | 'visitor_arrival' | 'system' | 'security';
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  sound?: 'default';
  badge?: number;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, title, body, type, data, priority = 'normal' }: NotificationRequest = await req.json();

    if (!user_id || !title || !body || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Criar registro na tabela notifications
    const { data: notification, error: notificationError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id,
        title,
        body,
        type,
        data: data || {},
        status: 'pending',
        priority
      })
      .select()
      .single();

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      return new Response(
        JSON.stringify({ error: 'Failed to create notification record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar tokens ativos do usuário
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('user_notification_tokens')
      .select('notification_token, device_type')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      // Atualizar status para 'failed' - usuário sem tokens
      await supabaseClient
        .from('notifications')
        .update({ status: 'failed' })
        .eq('id', notification.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No active tokens found for user',
          notification_id: notification.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Preparar mensagens para Expo Push API
    const messages: ExpoPushMessage[] = tokens.map(token => ({
      to: token.notification_token,
      title,
      body,
      data: {
        ...data,
        notificationId: notification.id,
        type
      },
      priority,
      sound: 'default',
    }));

    // 4. Enviar para Expo Push API
    const expoPushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoPushResult = await expoPushResponse.json();

    // 5. Processar resultados e criar logs
    let successCount = 0;
    let failureCount = 0;
    const logs = [];

    for (let i = 0; i < expoPushResult.data.length; i++) {
      const result = expoPushResult.data[i];
      const token = tokens[i];

      const logEntry = {
        notification_id: notification.id,
        device_token: token.notification_token,
        device_type: token.device_type,
        status: result.status === 'ok' ? 'sent' : 'failed',
        error_message: result.status !== 'ok' ? result.message || 'Unknown error' : null,
        expo_receipt_id: result.id || null
      };

      logs.push(logEntry);

      if (result.status === 'ok') {
        successCount++;
      } else {
        failureCount++;
        console.error(`Push notification failed for token ${token.notification_token}:`, result);
      }
    }

    // 6. Salvar logs no banco
    if (logs.length > 0) {
      const { error: logsError } = await supabaseClient
        .from('notification_logs')
        .insert(logs);

      if (logsError) {
        console.error('Error saving notification logs:', logsError);
      }
    }

    // 7. Atualizar status da notificação
    const finalStatus = successCount > 0 ? 'sent' : 'failed';
    await supabaseClient
      .from('notifications')
      .update({ 
        status: finalStatus,
        sent_at: finalStatus === 'sent' ? new Date().toISOString() : null
      })
      .eq('id', notification.id);

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
        results: {
          total_tokens: tokens.length,
          success_count: successCount,
          failure_count: failureCount
        },
        expo_response: expoPushResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});