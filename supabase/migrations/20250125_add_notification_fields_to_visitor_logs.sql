-- Migração para adicionar campos de notificação à tabela visitor_logs
-- Data: 2025-01-25
-- Descrição: Adiciona campos necessários para o sistema de notificações em tempo real

-- Adicionar campos de notificação à tabela visitor_logs
ALTER TABLE visitor_logs 
ADD COLUMN IF NOT EXISTS notification_status TEXT DEFAULT 'pending' 
    CHECK (notification_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS requires_resident_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'visitor' 
    CHECK (entry_type IN ('visitor', 'delivery', 'service', 'emergency')),
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

-- Criar índices para melhor performance nas consultas de notificação
CREATE INDEX IF NOT EXISTS idx_visitor_logs_notification_status 
    ON visitor_logs(notification_status);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_requires_approval 
    ON visitor_logs(requires_resident_approval);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_expires_at 
    ON visitor_logs(expires_at);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_entry_type 
    ON visitor_logs(entry_type);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_notification_sent_at 
    ON visitor_logs(notification_sent_at);

-- Índice composto para consultas de notificações pendentes
CREATE INDEX IF NOT EXISTS idx_visitor_logs_pending_notifications 
    ON visitor_logs(apartment_id, notification_status, requires_resident_approval, expires_at)
    WHERE notification_status = 'pending' AND requires_resident_approval = true;

-- Atualizar registros existentes para ter valores padrão apropriados
UPDATE visitor_logs 
SET 
    notification_status = 'approved',
    requires_resident_approval = false,
    entry_type = CASE 
        WHEN purpose ILIKE '%entrega%' THEN 'delivery'
        WHEN purpose ILIKE '%prestador%' OR purpose ILIKE '%serviço%' THEN 'service'
        WHEN purpose ILIKE '%emergência%' THEN 'emergency'
        ELSE 'visitor'
    END,
    guest_name = COALESCE(
        (SELECT name FROM visitors WHERE id = visitor_logs.visitor_id),
        'Visitante'
    )
WHERE notification_status IS NULL;

-- Remover políticas existentes se existirem
DROP POLICY IF EXISTS "Moradores podem ver notificações do seu apartamento" ON visitor_logs;
DROP POLICY IF EXISTS "Moradores podem responder notificações do seu apartamento" ON visitor_logs;

-- Adicionar política RLS para permitir que moradores vejam suas notificações
CREATE POLICY "Moradores podem ver notificações do seu apartamento" 
    ON visitor_logs
    FOR SELECT 
    USING (
        apartment_id IN (
            SELECT ar.apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON p.id = ar.profile_id
            WHERE p.user_id = auth.uid() AND ar.is_active = true
        )
        AND requires_resident_approval = true
        AND notification_status = 'pending'
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Adicionar política RLS para permitir que moradores atualizem o status das notificações
CREATE POLICY "Moradores podem responder notificações do seu apartamento" 
    ON visitor_logs
    FOR UPDATE 
    USING (
        apartment_id IN (
            SELECT ar.apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON p.id = ar.profile_id
            WHERE p.user_id = auth.uid() AND ar.is_active = true
        )
        AND requires_resident_approval = true
    )
    WITH CHECK (
        apartment_id IN (
            SELECT ar.apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON p.id = ar.profile_id
            WHERE p.user_id = auth.uid() AND ar.is_active = true
        )
        AND requires_resident_approval = true
        AND notification_status IN ('approved', 'rejected')
    );

-- Comentários nas colunas
COMMENT ON COLUMN visitor_logs.notification_status IS 'Status da notificação: pending, approved, rejected';
COMMENT ON COLUMN visitor_logs.requires_resident_approval IS 'Indica se a visita requer aprovação do morador';
COMMENT ON COLUMN visitor_logs.expires_at IS 'Data/hora de expiração da notificação';
COMMENT ON COLUMN visitor_logs.entry_type IS 'Tipo de entrada: visitor, delivery, service, emergency';
COMMENT ON COLUMN visitor_logs.guest_name IS 'Nome do visitante para exibição na notificação';
COMMENT ON COLUMN visitor_logs.notification_sent_at IS 'Data/hora em que a notificação foi enviada';

-- Verificar se as permissões estão corretas
GRANT SELECT, UPDATE ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;