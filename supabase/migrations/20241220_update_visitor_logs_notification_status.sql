-- Migração para substituir o campo 'status' pelo campo 'notification_status' na tabela visitor_logs
-- e implementar sistema de notificações em tempo real

-- 1. Primeiro, vamos atualizar os dados existentes do campo 'status' para 'notification_status'
-- Mapeamento: pending -> pending, approved -> approved, denied -> rejected
UPDATE visitor_logs 
SET notification_status = CASE 
    WHEN status = 'pending' THEN 'pending'::character varying
    WHEN status = 'approved' THEN 'approved'::character varying
    WHEN status = 'denied' THEN 'rejected'::character varying
    WHEN status = 'entered' THEN 'approved'::character varying
    WHEN status = 'exited' THEN 'approved'::character varying
    WHEN status = 'permanent' THEN 'approved'::character varying
    ELSE 'pending'::character varying
END
WHERE notification_status IS NULL OR notification_status = 'pending';

-- 2. Remover o campo 'status' antigo (após migração dos dados)
ALTER TABLE visitor_logs DROP COLUMN IF EXISTS status;

-- 3. Criar função para trigger de notificação em tempo real
CREATE OR REPLACE FUNCTION notify_notification_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Notificar mudanças no notification_status via NOTIFY
    IF OLD.notification_status IS DISTINCT FROM NEW.notification_status THEN
        PERFORM pg_notify(
            'visitor_notification_status_changed',
            json_build_object(
                'id', NEW.id,
                'visitor_log_id', NEW.id,
                'apartment_id', NEW.apartment_id,
                'building_id', NEW.building_id,
                'old_status', OLD.notification_status,
                'new_status', NEW.notification_status,
                'guest_name', NEW.guest_name,
                'entry_type', NEW.entry_type,
                'log_time', NEW.log_time,
                'changed_at', NOW(),
                'visitor_id', NEW.visitor_id,
                'delivery_sender', NEW.delivery_sender,
                'delivery_description', NEW.delivery_description,
                'license_plate', NEW.license_plate,
                'vehicle_model', NEW.vehicle_model,
                'vehicle_color', NEW.vehicle_color,
                'vehicle_brand', NEW.vehicle_brand
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para detectar mudanças no notification_status
DROP TRIGGER IF EXISTS trigger_visitor_notification_status_change ON visitor_logs;
CREATE TRIGGER trigger_visitor_notification_status_change
    AFTER UPDATE ON visitor_logs
    FOR EACH ROW
    WHEN (OLD.notification_status IS DISTINCT FROM NEW.notification_status)
    EXECUTE FUNCTION notify_notification_status_change();

-- 5. Criar tabela para histórico de notificações do porteiro
CREATE TABLE IF NOT EXISTS doorkeeper_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_log_id UUID NOT NULL REFERENCES visitor_logs(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES buildings(id),
    apartment_id UUID NOT NULL REFERENCES apartments(id),
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('visitor', 'delivery', 'vehicle')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    guest_name VARCHAR(255),
    entry_type VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    is_read BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    metadata JSONB DEFAULT '{}'
);

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_building_id ON doorkeeper_notifications(building_id);
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_created_at ON doorkeeper_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_is_read ON doorkeeper_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_priority ON doorkeeper_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_notification_status ON visitor_logs(notification_status);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_building_id_log_time ON visitor_logs(building_id, log_time DESC);

-- 7. Função para criar notificação do porteiro automaticamente
CREATE OR REPLACE FUNCTION create_doorkeeper_notification()
RETURNS TRIGGER AS $$
DECLARE
    notification_title VARCHAR(255);
    notification_message TEXT;
    notification_type VARCHAR(50);
BEGIN
    -- Determinar tipo de notificação e mensagem
    IF NEW.entry_type = 'visitor' THEN
        notification_type := 'visitor';
        notification_title := 'Mudança de Status - Visitante';
        notification_message := format('Status do visitante %s foi alterado para %s', 
            COALESCE(NEW.guest_name, 'Não informado'), NEW.notification_status);
    ELSIF NEW.entry_type = 'delivery' THEN
        notification_type := 'delivery';
        notification_title := 'Mudança de Status - Entrega';
        notification_message := format('Status da entrega de %s foi alterado para %s', 
            COALESCE(NEW.delivery_sender, 'Remetente não informado'), NEW.notification_status);
    ELSIF NEW.entry_type = 'vehicle' THEN
        notification_type := 'vehicle';
        notification_title := 'Mudança de Status - Veículo';
        notification_message := format('Status do veículo %s foi alterado para %s', 
            COALESCE(NEW.license_plate, 'Placa não informada'), NEW.notification_status);
    ELSE
        notification_type := 'visitor';
        notification_title := 'Mudança de Status';
        notification_message := format('Status foi alterado para %s', NEW.notification_status);
    END IF;

    -- Inserir notificação para o porteiro
    INSERT INTO doorkeeper_notifications (
        visitor_log_id,
        building_id,
        apartment_id,
        notification_type,
        title,
        message,
        old_status,
        new_status,
        guest_name,
        entry_type,
        priority,
        metadata
    ) VALUES (
        NEW.id,
        NEW.building_id,
        NEW.apartment_id,
        notification_type,
        notification_title,
        notification_message,
        OLD.notification_status,
        NEW.notification_status,
        NEW.guest_name,
        NEW.entry_type,
        CASE 
            WHEN NEW.notification_status = 'rejected' THEN 'high'
            WHEN NEW.notification_status = 'approved' THEN 'normal'
            ELSE 'normal'
        END,
        json_build_object(
            'delivery_sender', NEW.delivery_sender,
            'delivery_description', NEW.delivery_description,
            'license_plate', NEW.license_plate,
            'vehicle_info', json_build_object(
                'model', NEW.vehicle_model,
                'color', NEW.vehicle_color,
                'brand', NEW.vehicle_brand
            )
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para criar notificações do porteiro
DROP TRIGGER IF EXISTS trigger_create_doorkeeper_notification ON visitor_logs;
CREATE TRIGGER trigger_create_doorkeeper_notification
    AFTER UPDATE ON visitor_logs
    FOR EACH ROW
    WHEN (OLD.notification_status IS DISTINCT FROM NEW.notification_status)
    EXECUTE FUNCTION create_doorkeeper_notification();

-- 9. Habilitar RLS na nova tabela
ALTER TABLE doorkeeper_notifications ENABLE ROW LEVEL SECURITY;

-- 10. Criar políticas RLS para doorkeeper_notifications
CREATE POLICY "Porteiros podem ver notificações do seu prédio" ON doorkeeper_notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.user_type = 'porteiro'
            AND p.building_id = doorkeeper_notifications.building_id
        )
    );

CREATE POLICY "Porteiros podem atualizar notificações do seu prédio" ON doorkeeper_notifications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.user_type = 'porteiro'
            AND p.building_id = doorkeeper_notifications.building_id
        )
    );

-- 11. Conceder permissões necessárias
GRANT SELECT, UPDATE ON doorkeeper_notifications TO authenticated;
GRANT SELECT, UPDATE ON visitor_logs TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 12. Comentários para documentação
COMMENT ON TABLE doorkeeper_notifications IS 'Tabela para armazenar notificações em tempo real para porteiros sobre mudanças de status de visitantes';
COMMENT ON FUNCTION notify_notification_status_change() IS 'Função que envia notificações via NOTIFY quando o status de notificação muda';
COMMENT ON FUNCTION create_doorkeeper_notification() IS 'Função que cria registros de notificação para porteiros quando status muda';
COMMENT ON TRIGGER trigger_visitor_notification_status_change ON visitor_logs IS 'Trigger que detecta mudanças no notification_status e envia notificações';
COMMENT ON TRIGGER trigger_create_doorkeeper_notification ON visitor_logs IS 'Trigger que cria notificações para porteiros quando status muda';