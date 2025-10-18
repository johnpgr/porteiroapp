import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationRequest {
  user_id?: string;
  profile_id?: string; // Aceita tanto user_id quanto profile_id
  title: string;
  body: string;
  type: 'visitor_approval' | 'visitor_arrival' | 'system' | 'security' | 'general';
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

    const { user_id, profile_id, title, body, type, data, priority = 'normal' }: NotificationRequest = await req.json();

    // Aceita tanto user_id quanto profile_id (profile_id tem prioridade)
    const targetId = profile_id || user_id;

    if (!targetId || !title || !body || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id/profile_id, title, body, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔔 [send-notification] Processing notification:', { targetId, title, type });

    // 1. Buscar push_token do perfil
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('push_token, notification_enabled, full_name')
      .eq('id', targetId)
      .single();

    if (profileError) {
      console.error('❌ [send-notification] Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile || !profile.push_token || !profile.notification_enabled) {
      console.warn('⚠️ [send-notification] No active push token for user:', targetId);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No active push token found for user',
          user_id: targetId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Preparar mensagem para Expo Push API
    const message: ExpoPushMessage = {
      to: profile.push_token,
      title,
      body,
      data: {
        ...data,
        type,
        user_id: targetId
      },
      priority,
      sound: 'default',
    };

    console.log('📤 [send-notification] Sending push notification to:', profile.full_name || targetId);

    // 3. Enviar para Expo Push API
    const expoPushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([message]),
    });

    const expoPushResult = await expoPushResponse.json();
    console.log('📱 [send-notification] Expo response:', expoPushResult);

    // 4. Processar resultado
    const firstResult = expoPushResult.data?.[0];
    const success = firstResult?.status === 'ok';

    if (!success) {
      console.error('❌ [send-notification] Push failed:', firstResult);
    }

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Notification sent successfully' : 'Failed to send notification',
        user_id: targetId,
        expo_result: firstResult,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [send-notification] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});