import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface QueuedNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, any>;
  priority: string;
  created_at: string;
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

    // 1. Buscar notificações pendentes (ordenadas por prioridade e data)
    const { data: pendingNotifications, error: fetchError } = await supabaseClient
      .from('notifications')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false }) // high, normal, low
      .order('created_at', { ascending: true }) // mais antigas primeiro
      .limit(50); // processar até 50 por vez

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending notifications' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending notifications to process',
          processed_count: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingNotifications.length} pending notifications`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // 2. Processar cada notificação
    for (const notification of pendingNotifications as QueuedNotification[]) {
      try {
        results.processed++;

        // Marcar como 'processing' para evitar processamento duplo
        await supabaseClient
          .from('notifications')
          .update({ status: 'processing' })
          .eq('id', notification.id);

        // Chamar a função send-notification
        const sendResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: notification.user_id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            data: notification.data,
            priority: notification.priority
          })
        });

        const sendResult = await sendResponse.json();

        if (sendResult.success) {
          results.successful++;
          console.log(`Successfully processed notification ${notification.id}`);
        } else {
          results.failed++;
          const errorMsg = `Failed to process notification ${notification.id}: ${sendResult.error || 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);

          // Marcar como failed se não conseguiu enviar
          await supabaseClient
            .from('notifications')
            .update({ status: 'failed' })
            .eq('id', notification.id);
        }

      } catch (error) {
        results.failed++;
        const errorMsg = `Error processing notification ${notification.id}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);

        // Marcar como failed em caso de erro
        await supabaseClient
          .from('notifications')
          .update({ status: 'failed' })
          .eq('id', notification.id);
      }
    }

    // 3. Limpar notificações antigas (opcional)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error: cleanupError } = await supabaseClient
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .in('status', ['sent', 'delivered', 'read', 'failed']);

    if (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
      results.errors.push(`Cleanup error: ${cleanupError.message}`);
    } else {
      console.log('Cleanup of old notifications completed');
    }

    // 4. Limpar logs antigos
    const { error: logsCleanupError } = await supabaseClient
      .from('notification_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (logsCleanupError) {
      console.error('Error during logs cleanup:', logsCleanupError);
      results.errors.push(`Logs cleanup error: ${logsCleanupError.message}`);
    } else {
      console.log('Cleanup of old notification logs completed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} notifications`,
        results: {
          total_processed: results.processed,
          successful: results.successful,
          failed: results.failed,
          success_rate: results.processed > 0 ? (results.successful / results.processed * 100).toFixed(2) + '%' : '0%'
        },
        errors: results.errors.length > 0 ? results.errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in queue processor:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});