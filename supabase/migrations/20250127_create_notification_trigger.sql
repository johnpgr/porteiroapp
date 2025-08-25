-- Criar função para notificar mudanças no notification_status
CREATE OR REPLACE FUNCTION notify_notification_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o notification_status foi alterado
  IF OLD.notification_status IS DISTINCT FROM NEW.notification_status THEN
    -- Enviar notificação via NOTIFY
    PERFORM pg_notify(
      'notification_status_changed',
      json_build_object(
        'visitor_log_id', NEW.id,
        'visitor_id', NEW.visitor_id,
        'apartment_id', NEW.apartment_id,
        'building_id', NEW.building_id,
        'old_status', OLD.notification_status,
        'new_status', NEW.notification_status,
        'log_time', NEW.log_time,
        'tipo_log', NEW.tipo_log,
        'purpose', NEW.purpose,
        'changed_at', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para a tabela visitor_logs
DROP TRIGGER IF EXISTS trigger_notification_status_change ON visitor_logs;

CREATE TRIGGER trigger_notification_status_change
  AFTER UPDATE ON visitor_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_notification_status_change();

-- Comentários para documentação
COMMENT ON FUNCTION notify_notification_status_change() IS 'Função que notifica mudanças no campo notification_status da tabela visitor_logs';
COMMENT ON TRIGGER trigger_notification_status_change ON visitor_logs IS 'Trigger que detecta mudanças no notification_status e envia notificações em tempo real';