-- Migração para aprimorar o sistema de notificações existente
-- Adiciona campos necessários para integração com o novo sistema

-- 1. Adicionar campos de status de notificação às tabelas communications e polls
ALTER TABLE communications 
ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_confirmed_by UUID REFERENCES auth.users(id);

ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_confirmed_by UUID REFERENCES auth.users(id);

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_communications_notification_status ON communications(notification_status);
CREATE INDEX IF NOT EXISTS idx_communications_building_notification ON communications(building_id, notification_status);
CREATE INDEX IF NOT EXISTS idx_polls_notification_status ON polls(notification_status);
CREATE INDEX IF NOT EXISTS idx_polls_building_notification ON polls(building_id, notification_status);

-- 3. Criar função para atualizar status de notificação
CREATE OR REPLACE FUNCTION update_notification_status(
  p_table_name TEXT,
  p_record_id UUID,
  p_status VARCHAR(20),
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar parâmetros
  IF p_table_name NOT IN ('communications', 'polls') THEN
    RAISE EXCEPTION 'Tabela inválida: %', p_table_name;
  END IF;
  
  IF p_status NOT IN ('pending', 'sent', 'delivered', 'read', 'confirmed', 'failed') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;
  
  -- Atualizar communications
  IF p_table_name = 'communications' THEN
    UPDATE communications 
    SET 
      notification_status = p_status,
      notification_sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE notification_sent_at END,
      notification_read_at = CASE WHEN p_status = 'read' THEN NOW() ELSE notification_read_at END,
      notification_confirmed_at = CASE WHEN p_status = 'confirmed' THEN NOW() ELSE notification_confirmed_at END,
      notification_confirmed_by = CASE WHEN p_status = 'confirmed' THEN p_user_id ELSE notification_confirmed_by END,
      updated_at = NOW()
    WHERE id = p_record_id;
    
    RETURN FOUND;
  END IF;
  
  -- Atualizar polls
  IF p_table_name = 'polls' THEN
    UPDATE polls 
    SET 
      notification_status = p_status,
      notification_sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE notification_sent_at END,
      notification_read_at = CASE WHEN p_status = 'read' THEN NOW() ELSE notification_read_at END,
      notification_confirmed_at = CASE WHEN p_status = 'confirmed' THEN NOW() ELSE notification_confirmed_at END,
      notification_confirmed_by = CASE WHEN p_status = 'confirmed' THEN p_user_id ELSE notification_confirmed_by END,
      updated_at = NOW()
    WHERE id = p_record_id;
    
    RETURN FOUND;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- 4. Criar função para obter estatísticas de notificação
CREATE OR REPLACE FUNCTION get_notification_stats(
  p_building_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  table_name TEXT,
  total_count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  read_count BIGINT,
  confirmed_count BIGINT,
  failed_count BIGINT,
  delivery_rate NUMERIC,
  read_rate NUMERIC,
  confirmation_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Estatísticas para communications
  RETURN QUERY
  SELECT 
    'communications'::TEXT as table_name,
    COUNT(*)::BIGINT as total_count,
    COUNT(CASE WHEN notification_status IN ('sent', 'delivered', 'read', 'confirmed') THEN 1 END)::BIGINT as sent_count,
    COUNT(CASE WHEN notification_status IN ('delivered', 'read', 'confirmed') THEN 1 END)::BIGINT as delivered_count,
    COUNT(CASE WHEN notification_status IN ('read', 'confirmed') THEN 1 END)::BIGINT as read_count,
    COUNT(CASE WHEN notification_status = 'confirmed' THEN 1 END)::BIGINT as confirmed_count,
    COUNT(CASE WHEN notification_status = 'failed' THEN 1 END)::BIGINT as failed_count,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(CASE WHEN notification_status IN ('delivered', 'read', 'confirmed') THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as delivery_rate,
    CASE 
      WHEN COUNT(CASE WHEN notification_status IN ('sent', 'delivered', 'read', 'confirmed') THEN 1 END) > 0 THEN 
        ROUND((COUNT(CASE WHEN notification_status IN ('read', 'confirmed') THEN 1 END)::NUMERIC / COUNT(CASE WHEN notification_status IN ('sent', 'delivered', 'read', 'confirmed') THEN 1 END)::NUMERIC) * 100, 2)
      ELSE 0
    END as read_rate,
    CASE 
      WHEN COUNT(CASE WHEN priority IN ('high', 'urgent') THEN 1 END) > 0 THEN 
        ROUND((COUNT(CASE WHEN notification_status = 'confirmed' AND priority IN ('high', 'urgent') THEN 1 END)::NUMERIC / COUNT(CASE WHEN priority IN ('high', 'urgent') THEN 1 END)::NUMERIC) * 100, 2)
      ELSE 0
    END as confirmation_rate
  FROM communications 
  WHERE building_id = p_building_id 
    AND created_at >= NOW() - (p_days_back || ' days')::INTERVAL;
  
  -- Estatísticas para polls
  RETURN QUERY
  SELECT 
    'polls'::TEXT as table_name,
    COUNT(*)::BIGINT as total_count,
    COUNT(CASE WHEN notification_status IN ('sent', 'delivered', 'read', 'confirmed') THEN 1 END)::BIGINT as sent_count,
    COUNT(CASE WHEN notification_status IN ('delivered', 'read', 'confirmed') THEN 1 END)::BIGINT as delivered_count,
    COUNT(CASE WHEN notification_status IN ('read', 'confirmed') THEN 1 END)::BIGINT as read_count,
    COUNT(CASE WHEN notification_status = 'confirmed' THEN 1 END)::BIGINT as confirmed_count,
    COUNT(CASE WHEN notification_status = 'failed' THEN 1 END)::BIGINT as failed_count,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(CASE WHEN notification_status IN ('delivered', 'read', 'confirmed') THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as delivery_rate,
    CASE 
      WHEN COUNT(CASE WHEN notification_status IN ('sent', 'delivered', 'read', 'confirmed') THEN 1 END) > 0 THEN 
        ROUND((COUNT(CASE WHEN notification_status IN ('read', 'confirmed') THEN 1 END)::NUMERIC / COUNT(CASE WHEN notification_status IN ('sent', 'delivered', 'read', 'confirmed') THEN 1 END)::NUMERIC) * 100, 2)
      ELSE 0
    END as read_rate,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(CASE WHEN notification_status = 'confirmed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as confirmation_rate
  FROM polls 
  WHERE building_id = p_building_id 
    AND created_at >= NOW() - (p_days_back || ' days')::INTERVAL;
END;
$$;

-- 5. Criar trigger para atualizar automaticamente o status quando um registro é criado
CREATE OR REPLACE FUNCTION trigger_new_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Definir status inicial como 'pending'
  NEW.notification_status = 'pending';
  RETURN NEW;
END;
$$;

-- Aplicar trigger às tabelas
DROP TRIGGER IF EXISTS trigger_communications_notification ON communications;
CREATE TRIGGER trigger_communications_notification
  BEFORE INSERT ON communications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_notification();

DROP TRIGGER IF EXISTS trigger_polls_notification ON polls;
CREATE TRIGGER trigger_polls_notification
  BEFORE INSERT ON polls
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_notification();

-- 6. Atualizar registros existentes para ter status 'sent' (assumindo que já foram enviados)
UPDATE communications 
SET notification_status = 'sent', notification_sent_at = created_at 
WHERE notification_status IS NULL OR notification_status = 'pending';

UPDATE polls 
SET notification_status = 'sent', notification_sent_at = created_at 
WHERE notification_status IS NULL OR notification_status = 'pending';

-- 7. Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION update_notification_status(TEXT, UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_stats(UUID, INTEGER) TO authenticated;

-- 8. Criar políticas RLS para os novos campos
-- As políticas existentes das tabelas já cobrem os novos campos

-- 9. Comentários para documentação
COMMENT ON COLUMN communications.notification_status IS 'Status da notificação: pending, sent, delivered, read, confirmed, failed';
COMMENT ON COLUMN communications.notification_sent_at IS 'Timestamp de quando a notificação foi enviada';
COMMENT ON COLUMN communications.notification_read_at IS 'Timestamp de quando a notificação foi lida';
COMMENT ON COLUMN communications.notification_confirmed_at IS 'Timestamp de quando a notificação foi confirmada';
COMMENT ON COLUMN communications.notification_confirmed_by IS 'ID do usuário que confirmou a notificação';

COMMENT ON COLUMN polls.notification_status IS 'Status da notificação: pending, sent, delivered, read, confirmed, failed';
COMMENT ON COLUMN polls.notification_sent_at IS 'Timestamp de quando a notificação foi enviada';
COMMENT ON COLUMN polls.notification_read_at IS 'Timestamp de quando a notificação foi lida';
COMMENT ON COLUMN polls.notification_confirmed_at IS 'Timestamp de quando a notificação foi confirmada';
COMMENT ON COLUMN polls.notification_confirmed_by IS 'ID do usuário que confirmou a notificação';

COMMENT ON FUNCTION update_notification_status(TEXT, UUID, VARCHAR, UUID) IS 'Atualiza o status de notificação de um registro';
COMMENT ON FUNCTION get_notification_stats(UUID, INTEGER) IS 'Retorna estatísticas de notificação para um prédio';

-- Verificar se as alterações foram aplicadas com sucesso
SELECT 
  'communications' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'communications' 
  AND column_name LIKE 'notification_%'
UNION ALL
SELECT 
  'polls' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'polls' 
  AND column_name LIKE 'notification_%'
ORDER BY table_name, column_name;