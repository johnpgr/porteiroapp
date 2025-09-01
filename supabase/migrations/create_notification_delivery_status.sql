-- Criar tabela para controle de status de entrega das notificações
-- Baseado nas recomendações do documento técnico

CREATE TABLE IF NOT EXISTS notification_delivery_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id VARCHAR(255) NOT NULL UNIQUE, -- Formato: {type}_{content_id}_{user_id}
    user_id UUID NOT NULL,
    building_id UUID NOT NULL,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('communication', 'poll')),
    content_id UUID NOT NULL, -- ID do comunicado ou enquete
    
    -- Status de entrega push
    push_status VARCHAR(20) DEFAULT 'pending' CHECK (push_status IN ('pending', 'sent', 'delivered', 'failed')),
    
    -- Status de entrega WhatsApp (para implementação futura)
    whatsapp_status VARCHAR(20) CHECK (whatsapp_status IN ('pending', 'sent', 'delivered', 'failed')),
    
    -- Status de leitura
    read_status VARCHAR(10) DEFAULT 'unread' CHECK (read_status IN ('unread', 'read')),
    
    -- Status de confirmação (para avisos urgentes)
    confirmation_status VARCHAR(20) CHECK (confirmation_status IN ('pending', 'confirmed', 'ignored')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Controle de tentativas
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    
    -- Mensagem de erro em caso de falha
    error_message TEXT,
    
    -- Índices para performance
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

-- Criar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_id ON notification_delivery_status(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_building_id ON notification_delivery_status(building_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_type ON notification_delivery_status(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_content_id ON notification_delivery_status(content_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_status ON notification_delivery_status(push_status, read_status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_created_at ON notification_delivery_status(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE notification_delivery_status ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados verem apenas suas próprias notificações
CREATE POLICY "Users can view their own notification delivery status" ON notification_delivery_status
    FOR SELECT USING (auth.uid() = user_id);

-- Política para inserção (sistema pode criar registros)
CREATE POLICY "System can insert notification delivery status" ON notification_delivery_status
    FOR INSERT WITH CHECK (true);

-- Política para atualização (usuários podem atualizar seus próprios registros)
CREATE POLICY "Users can update their own notification delivery status" ON notification_delivery_status
    FOR UPDATE USING (auth.uid() = user_id);

-- Função para incrementar tentativas de entrega
CREATE OR REPLACE FUNCTION increment_delivery_attempts(notification_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    current_attempts INTEGER;
BEGIN
    UPDATE notification_delivery_status 
    SET delivery_attempts = delivery_attempts + 1,
        last_attempt_at = NOW()
    WHERE notification_delivery_status.notification_id = increment_delivery_attempts.notification_id
    RETURNING delivery_attempts INTO current_attempts;
    
    RETURN COALESCE(current_attempts, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas de entrega
CREATE OR REPLACE FUNCTION get_notification_delivery_stats(
    p_building_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    notification_type VARCHAR(20),
    total_sent INTEGER,
    total_delivered INTEGER,
    total_read INTEGER,
    total_confirmed INTEGER,
    delivery_rate DECIMAL(5,2),
    read_rate DECIMAL(5,2),
    confirmation_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nds.notification_type,
        COUNT(*)::INTEGER as total_sent,
        COUNT(CASE WHEN nds.push_status = 'delivered' THEN 1 END)::INTEGER as total_delivered,
        COUNT(CASE WHEN nds.read_status = 'read' THEN 1 END)::INTEGER as total_read,
        COUNT(CASE WHEN nds.confirmation_status = 'confirmed' THEN 1 END)::INTEGER as total_confirmed,
        ROUND(
            (COUNT(CASE WHEN nds.push_status = 'delivered' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as delivery_rate,
        ROUND(
            (COUNT(CASE WHEN nds.read_status = 'read' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as read_rate,
        ROUND(
            (COUNT(CASE WHEN nds.confirmation_status = 'confirmed' THEN 1 END)::DECIMAL / NULLIF(COUNT(CASE WHEN nds.confirmation_status IS NOT NULL THEN 1 END), 0)) * 100, 
            2
        ) as confirmation_rate
    FROM notification_delivery_status nds
    WHERE nds.building_id = p_building_id
        AND nds.created_at >= p_start_date
        AND nds.created_at <= p_end_date
    GROUP BY nds.notification_type
    ORDER BY nds.notification_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões necessárias
GRANT SELECT, INSERT, UPDATE ON notification_delivery_status TO authenticated;
GRANT SELECT ON notification_delivery_status TO anon;
GRANT EXECUTE ON FUNCTION increment_delivery_attempts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_delivery_stats(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Comentários para documentação
COMMENT ON TABLE notification_delivery_status IS 'Controla o status de entrega das notificações de avisos e enquetes';
COMMENT ON COLUMN notification_delivery_status.notification_id IS 'ID único da notificação no formato {type}_{content_id}_{user_id}';
COMMENT ON COLUMN notification_delivery_status.push_status IS 'Status da entrega via push notification';
COMMENT ON COLUMN notification_delivery_status.whatsapp_status IS 'Status da entrega via WhatsApp (implementação futura)';
COMMENT ON COLUMN notification_delivery_status.confirmation_status IS 'Status de confirmação para avisos urgentes';
COMMENT ON FUNCTION increment_delivery_attempts(TEXT) IS 'Incrementa o contador de tentativas de entrega';
COMMENT ON FUNCTION get_notification_delivery_stats(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Retorna estatísticas de entrega de notificações por período';