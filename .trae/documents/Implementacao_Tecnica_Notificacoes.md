# Implementação Técnica - Sistema de Notificações Push

## 1. Arquivos a Serem Criados/Modificados

### 1.1 Migration - Trigger de Notificação de Visitantes

**Arquivo**: `supabase/migrations/20250127_visitor_notification_trigger.sql`

```sql
-- Migration para implementar trigger de notificação de visitantes
-- Data: 2025-01-27

-- Habilitar extensão http para chamadas de Edge Functions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Função para processar notificações de visitantes
CREATE OR REPLACE FUNCTION notify_visitor_arrival()
RETURNS TRIGGER AS $$
DECLARE
    visitor_data RECORD;
    apartment_data RECORD;
    notification_payload JSON;
    function_url TEXT;
    service_key TEXT;
BEGIN
    -- Log de debug
    RAISE LOG 'Trigger notify_visitor_arrival executado para visitor_log_id: %', NEW.id;
    
    -- Verificar se é uma entrada de visitante que requer notificação
    IF NEW.tipo_log = 'entrada' AND 
       COALESCE(NEW.requires_notification, false) = true AND 
       NEW.notification_status = 'pending' THEN
        
        RAISE LOG 'Processando notificação para visitor_log_id: %', NEW.id;
        
        -- Buscar dados do visitante
        SELECT v.name, v.document, v.phone, v.photo_url
        INTO visitor_data
        FROM visitors v
        WHERE v.id = NEW.visitor_id;
        
        -- Buscar dados do apartamento
        SELECT a.number, a.building_id, b.name as building_name
        INTO apartment_data
        FROM apartments a
        LEFT JOIN buildings b ON b.id = a.building_id
        WHERE a.id = NEW.apartment_id;
        
        -- Verificar se encontrou os dados necessários
        IF visitor_data IS NULL THEN
            RAISE LOG 'Visitante não encontrado para ID: %', NEW.visitor_id;
            RETURN NEW;
        END IF;
        
        IF apartment_data IS NULL THEN
            RAISE LOG 'Apartamento não encontrado para ID: %', NEW.apartment_id;
            RETURN NEW;
        END IF;
        
        -- Preparar payload da notificação
        notification_payload := json_build_object(
            'visitor_log_id', NEW.id,
            'visitor_id', NEW.visitor_id,
            'visitor_name', COALESCE(visitor_data.name, 'Visitante'),
            'visitor_document', visitor_data.document,
            'visitor_phone', visitor_data.phone,
            'visitor_photo', visitor_data.photo_url,
            'apartment_number', apartment_data.number,
            'apartment_id', NEW.apartment_id,
            'building_id', apartment_data.building_id,
            'building_name', COALESCE(apartment_data.building_name, 'Prédio'),
            'purpose', NEW.purpose,
            'arrival_time', NEW.log_time,
            'entry_type', NEW.entry_type
        );
        
        -- Configurar URL da Edge Function
        function_url := current_setting('app.supabase_url', true) || '/functions/v1/send-visitor-notification';
        service_key := current_setting('app.supabase_service_key', true);
        
        -- Verificar se as configurações estão disponíveis
        IF function_url IS NULL OR service_key IS NULL THEN
            RAISE LOG 'Configurações do Supabase não encontradas';
            RETURN NEW;
        END IF;
        
        -- Chamar Edge Function para enviar notificação (assíncrono)
        BEGIN
            PERFORM
                net.http_post(
                    url := function_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || service_key
                    ),
                    body := notification_payload::jsonb,
                    timeout_milliseconds := 10000
                );
                
            RAISE LOG 'Chamada para Edge Function enviada com sucesso';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Erro ao chamar Edge Function: %', SQLERRM;
            -- Não falhar o trigger por causa de erro na notificação
        END;
            
        -- Atualizar timestamp de envio
        UPDATE visitor_logs 
        SET notification_sent_at = NOW()
        WHERE id = NEW.id;
        
        RAISE LOG 'Notificação processada com sucesso para visitor_log_id: %', NEW.id;
        
    ELSE
        RAISE LOG 'Condições não atendidas para notificação. tipo_log: %, requires_notification: %, notification_status: %', 
                  NEW.tipo_log, NEW.requires_notification, NEW.notification_status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS visitor_arrival_notification ON visitor_logs;

-- Criar trigger
CREATE TRIGGER visitor_arrival_notification
    AFTER INSERT OR UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_visitor_arrival();

-- Configurar variáveis de ambiente (ajustar conforme necessário)
-- Estas devem ser configuradas no painel do Supabase
-- ALTER DATABASE postgres SET app.supabase_url = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_key = 'sua_service_key_aqui';

-- Criar tabela para logs de notificações se não existir
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    recipient_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    payload JSONB,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- RLS Policy para notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy para admins visualizarem logs
CREATE POLICY "Admin can view notification logs" ON notification_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Policy para inserção via service role
CREATE POLICY "Service role can insert notification logs" ON notification_logs
    FOR INSERT WITH CHECK (true);

-- Comentários
COMMENT ON FUNCTION notify_visitor_arrival() IS 'Trigger function para enviar notificações quando visitantes chegam';
COMMENT ON TABLE notification_logs IS 'Log de todas as notificações enviadas pelo sistema';
```

### 1.2 Edge Function - Notificação Específica de Visitantes

**Arquivo**: `supabase/functions/send-visitor-notification/index.ts`

```typescript
// Edge Function específica para notificações de visitantes
// Deploy: supabase functions deploy send-visitor-notification

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface VisitorNotificationPayload {
  visitor_log_id: string;
  visitor_id: string;
  visitor_name: string;
  visitor_document?: string;
  visitor_phone?: string;
  visitor_photo?: string;
  apartment_number: string;
  apartment_id: string;
  building_id: string;
  building_name: string;
  purpose?: string;
  arrival_time: string;
  entry_type?: string;
}

interface ResidentProfile {
  user_id: string;
  push_token: string;
  name: string;
  notification_enabled: boolean;
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

  const startTime = Date.now();
  let logData = {
    type: 'visitor_arrival',
    recipient_count: 0,
    success_count: 0,
    failed_count: 0,
    payload: null as any,
    result: null as any,
    error_message: null as string | null
  };

  try {
    // Configuração do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configurações do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse do payload
    const payload: VisitorNotificationPayload = await req.json();
    logData.payload = payload;
    
    console.log('🔔 Processando notificação de visitante:', {
      visitor_log_id: payload.visitor_log_id,
      visitor_name: payload.visitor_name,
      apartment_number: payload.apartment_number,
      building_id: payload.building_id
    });

    // Validação básica
    if (!payload.visitor_log_id || !payload.visitor_name || !payload.apartment_id) {
      throw new Error('Dados obrigatórios não fornecidos');
    }

    // Buscar moradores do apartamento com push tokens ativos
    console.log('🔍 Buscando moradores do apartamento:', payload.apartment_id);
    
    const { data: residents, error: residentsError } = await supabase
      .from('apartment_residents')
      .select(`
        profiles!inner(
          user_id,
          push_token,
          name,
          notification_enabled
        )
      `)
      .eq('apartment_id', payload.apartment_id)
      .eq('profiles.notification_enabled', true)
      .not('profiles.push_token', 'is', null);

    if (residentsError) {
      console.error('❌ Erro ao buscar moradores:', residentsError);
      throw new Error(`Erro ao buscar moradores: ${residentsError.message}`);
    }

    console.log(`📱 Encontrados ${residents?.length || 0} moradores com push tokens`);

    if (!residents || residents.length === 0) {
      console.log('⚠️ Nenhum morador encontrado com push token ativo');
      
      // Log mesmo sem destinatários
      logData.recipient_count = 0;
      logData.result = { message: 'No residents with push tokens found' };
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No residents with push tokens found',
          sent: 0,
          failed: 0,
          recipients: 0
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extrair tokens dos moradores
    const pushTokens = residents
      .map((r: any) => r.profiles?.push_token)
      .filter(Boolean);

    logData.recipient_count = pushTokens.length;

    // Preparar dados da notificação
    const notificationTitle = `👤 Visitante Chegou`;
    const notificationMessage = `${payload.visitor_name} chegou ao Apt. ${payload.apartment_number}`;
    
    const notificationData = {
      type: 'visitor_arrival',
      visitor_log_id: payload.visitor_log_id,
      visitor_id: payload.visitor_id,
      visitor_name: payload.visitor_name,
      apartment_number: payload.apartment_number,
      apartment_id: payload.apartment_id,
      building_id: payload.building_id,
      action_required: true,
      screen: 'visitor_authorization',
      timestamp: new Date().toISOString()
    };

    console.log('📤 Enviando notificação push para', pushTokens.length, 'dispositivos');

    // Chamar função principal de push notification
    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        pushTokens: pushTokens,
        title: notificationTitle,
        message: notificationMessage,
        type: 'visitor',
        data: notificationData
      }),
    });

    if (!pushResponse.ok) {
      throw new Error(`Erro na API de push: ${pushResponse.status} ${pushResponse.statusText}`);
    }

    const pushResult = await pushResponse.json();
    logData.result = pushResult;
    logData.success_count = pushResult.sent || 0;
    logData.failed_count = pushResult.failed || 0;
    
    console.log('📱 Resultado do envio de push:', {
      sent: pushResult.sent,
      failed: pushResult.failed,
      total: pushTokens.length
    });

    // Salvar log da atividade
    try {
      await supabase.from('notification_logs').insert(logData);
    } catch (logError) {
      console.error('⚠️ Erro ao salvar log:', logError);
      // Não falhar por causa do log
    }

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Processamento concluído em ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: pushResult.sent || 0,
        failed: pushResult.failed || 0,
        recipients: pushTokens.length,
        processing_time_ms: processingTime
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || 'Internal server error';
    
    console.error('❌ Erro na notificação de visitante:', {
      error: errorMessage,
      processing_time_ms: processingTime,
      payload: logData.payload
    });
    
    // Salvar log de erro
    logData.error_message = errorMessage;
    logData.failed_count = logData.recipient_count;
    logData.success_count = 0;
    
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabase.from('notification_logs').insert(logData);
    } catch (logError) {
      console.error('⚠️ Erro ao salvar log de erro:', logError);
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
        processing_time_ms: processingTime
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### 1.3 Atualização no AutorizacoesTab.tsx

**Modificação necessária** no arquivo `app/porteiro/AutorizacoesTab.tsx` para garantir que o campo `requires_notification` seja definido corretamente:

```typescript
// Localizar a função handleNotifyResident (linha ~785) e atualizar:

const handleNotifyResident = async (activityId: string) => {
  try {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    // Buscar dados do visitante para verificar o access_type e horários
    const { data: visitorData, error: visitorError } = await supabase
      .from('visitors')
      .select('*')
      .eq('id', activityId)
      .single();

    if (visitorError || !visitorData) {
      Alert.alert('Erro', 'Não foi possível encontrar os dados do visitante');
      return;
    }

    // Buscar apartamento do visitante
    const { data: apartmentData, error: apartmentError } = await supabase
      .from('apartments')
      .select('id, number')
      .eq('number', activity.apartmentNumber)
      .eq('building_id', buildingId)
      .single();

    if (apartmentError || !apartmentData) {
      Alert.alert('Erro', 'Não foi possível encontrar o apartamento');
      return;
    }

    // Criar dados do log baseado no access_type
    const logData = {
      visitor_id: activityId,
      building_id: buildingId,
      apartment_id: apartmentData.id,
      guest_name: visitorData.name || activity.title.replace('👤 ', ''),
      entry_type: 'visitor',
      notification_status: 'pending',
      requires_notification: true, // ✅ IMPORTANTE: Garantir que seja true
      tipo_log: 'entrada',
      purpose: visitorData.purpose || 'Visita',
      log_time: new Date().toISOString(),
      // Remover resident_response_by daqui - será preenchido quando o morador responder
    };

    console.log('🔔 Criando notificação para morador:', logData);

    const { data: logResult, error: logError } = await supabase
      .from('visitor_logs')
      .insert(logData)
      .select('*')
      .single();

    if (logError) {
      console.error('❌ Erro ao criar log:', logError);
      Alert.alert('Erro', 'Falha ao notificar morador');
      return;
    }

    console.log('✅ Log criado com sucesso:', logResult.id);
    Alert.alert('Sucesso', 'Morador notificado com sucesso!');
    
    // Atualizar a lista de atividades
    fetchActivities();

  } catch (error) {
    console.error('❌ Erro geral:', error);
    Alert.alert('Erro', 'Falha ao processar notificação');
  }
};
```

## 2. Configuração de Variáveis de Ambiente

### 2.1 No Painel do Supabase

Acessar: **Settings > Database > Configuration**

Adicionar as seguintes configurações:

```sql
-- Configurar URL do Supabase
ALTER DATABASE postgres SET app.supabase_url = 'https://ycamhxzumzkpxuhtugxc.supabase.co';

-- Configurar Service Key (substituir pela chave real)
ALTER DATABASE postgres SET app.supabase_service_key = 'sua_service_key_aqui';
```

### 2.2 Verificar Configurações

```sql
-- Verificar se as configurações foram aplicadas
SELECT name, setting FROM pg_settings 
WHERE name LIKE 'app.%';
```

## 3. Scripts de Deploy

### 3.1 Deploy das Edge Functions

```bash
# Navegar para o diretório do projeto
cd c:\Users\Douglas Moura\Documents\GitHub\porteiroapp

# Deploy da função de notificação de visitantes
supabase functions deploy send-visitor-notification

# Verificar se a função foi deployada
supabase functions list

# Testar a função (opcional)
supabase functions serve send-visitor-notification
```

### 3.2 Aplicar Migrations

```bash
# Aplicar a migration do trigger
supabase db push

# Verificar se foi aplicada corretamente
supabase db diff
```

## 4. Testes de Validação

### 4.1 Teste Manual do Trigger

```sql
-- Inserir um log de teste para verificar se o trigger funciona
INSERT INTO visitor_logs (
    visitor_id, 
    apartment_id, 
    building_id, 
    tipo_log, 
    notification_status, 
    requires_notification,
    purpose,
    log_time
) VALUES (
    'test-visitor-id',
    'test-apartment-id', 
    'test-building-id',
    'entrada',
    'pending',
    true,
    'Teste de notificação',
    NOW()
);

-- Verificar se notification_sent_at foi preenchido
SELECT id, notification_sent_at, created_at 
FROM visitor_logs 
WHERE visitor_id = 'test-visitor-id';
```

### 4.2 Verificar Logs da Edge Function

```bash
# Ver logs em tempo real
supabase functions logs send-visitor-notification --follow

# Ver logs específicos
supabase functions logs send-visitor-notification --since=1h
```

### 4.3 Monitorar Notificações

```sql
-- Verificar logs de notificações
SELECT 
    type,
    recipient_count,
    success_count,
    failed_count,
    created_at,
    error_message
FROM notification_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## 5. Troubleshooting

### 5.1 Problemas Comuns

#### Trigger não executa:
```sql
-- Verificar se o trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'visitor_arrival_notification';

-- Verificar logs do PostgreSQL
SELECT * FROM pg_stat_activity WHERE query LIKE '%notify_visitor_arrival%';
```

#### Edge Function não recebe chamada:
```sql
-- Verificar configurações
SHOW app.supabase_url;
SHOW app.supabase_service_key;

-- Testar conectividade
SELECT net.http_get('https://httpbin.org/get');
```

#### Push tokens não encontrados:
```sql
-- Verificar tokens ativos
SELECT COUNT(*) FROM profiles WHERE push_token IS NOT NULL;
SELECT COUNT(*) FROM admin_profiles WHERE push_token IS NOT NULL;
```

### 5.2 Logs de Debug

Adicionar logs detalhados no código do app para rastrear o fluxo:

```typescript
// No AutorizacoesTab.tsx, adicionar logs:
console.log('🔍 DEBUG - Dados do log antes da inserção:', logData);
console.log('🔍 DEBUG - Resultado da inserção:', logResult);
console.log('🔍 DEBUG - requires_notification:', logData.requires_notification);
```

## 6. Métricas de Sucesso

### 6.1 KPIs a Monitorar

- **Taxa de entrega**: > 95%
- **Latência média**: < 5 segundos
- **Falhas de trigger**: < 1%
- **Tempo de resposta da Edge Function**: < 3 segundos

### 6.2 Query de Monitoramento

```sql
-- Dashboard de métricas (executar diariamente)
WITH notification_stats AS (
    SELECT 
        DATE(created_at) as date,
        type,
        COUNT(*) as total_notifications,
        SUM(success_count) as total_sent,
        SUM(failed_count) as total_failed,
        AVG(EXTRACT(EPOCH FROM (created_at - lag(created_at) OVER (ORDER BY created_at)))) as avg_interval_seconds
    FROM notification_logs 
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(created_at), type
)
SELECT 
    date,
    type,
    total_notifications,
    total_sent,
    total_failed,
    ROUND((total_sent::float / NULLIF(total_sent + total_failed, 0)) * 100, 2) as success_rate_percent,
    ROUND(avg_interval_seconds, 2) as avg_interval_seconds
FROM notification_stats
ORDER BY date DESC, type;
```

Este plano de implementação técnica fornece todos os códigos e configurações necessárias para implementar e validar o sistema de notificações push, com foco especial na correção das notificações de chegada de visitantes pré-cadastrados.