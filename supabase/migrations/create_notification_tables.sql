-- Tabela para armazenar tokens de notificação dos usuários
CREATE TABLE IF NOT EXISTS user_notification_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) NOT NULL,
    device_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices para performance
    UNIQUE(user_id, token)
);

-- Tabela principal de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT CHECK (type IN ('visitor_approval', 'visitor_arrival', 'system', 'security', 'general')) NOT NULL,
    data JSONB DEFAULT '{}',
    priority TEXT CHECK (priority IN ('high', 'normal', 'low')) DEFAULT 'normal',
    status TEXT CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'failed')) DEFAULT 'pending',
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Campos específicos para visitantes
    visitor_id UUID,
    apartment_id UUID,
    building_id UUID
);

-- Tabela de logs de notificações para auditoria e debugging
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'sent', 'delivered', 'read', 'failed'
    status TEXT,
    message TEXT,
    error_details JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Campos para rastreamento de push notifications
    push_token TEXT,
    device_type TEXT,
    expo_ticket_id TEXT,
    expo_receipt_id TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_notification_tokens_user_id ON user_notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_tokens_active ON user_notification_tokens(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_notification_tokens_device ON user_notification_tokens(device_type, device_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications(status, priority, created_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_action ON notification_logs(action);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_user_notification_tokens_updated_at 
    BEFORE UPDATE ON user_notification_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE user_notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para user_notification_tokens
CREATE POLICY "Users can view their own tokens" ON user_notification_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" ON user_notification_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" ON user_notification_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" ON user_notification_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para notification_logs (apenas leitura para usuários)
CREATE POLICY "Users can view their own notification logs" ON notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Permissões para roles anon e authenticated
GRANT SELECT ON user_notification_tokens TO anon;
GRANT ALL PRIVILEGES ON user_notification_tokens TO authenticated;

GRANT SELECT ON notifications TO anon;
GRANT ALL PRIVILEGES ON notifications TO authenticated;

GRANT SELECT ON notification_logs TO anon;
GRANT ALL PRIVILEGES ON notification_logs TO authenticated;

-- Função para limpar tokens inativos
CREATE OR REPLACE FUNCTION cleanup_inactive_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM user_notification_tokens 
    WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Função para marcar notificação como lida
CREATE OR REPLACE FUNCTION mark_notification_as_read(notification_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE notifications 
    SET status = 'read', read_at = NOW()
    WHERE id = notification_id AND user_id = auth.uid();
    
    INSERT INTO notification_logs (notification_id, user_id, action, status, message)
    VALUES (notification_id, auth.uid(), 'read', 'success', 'Notification marked as read by user');
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas de notificações do usuário
CREATE OR REPLACE FUNCTION get_user_notification_stats(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    total_notifications BIGINT,
    unread_notifications BIGINT,
    read_notifications BIGINT,
    failed_notifications BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_notifications,
        COUNT(*) FILTER (WHERE status NOT IN ('read')) as unread_notifications,
        COUNT(*) FILTER (WHERE status = 'read') as read_notifications,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_notifications
    FROM notifications 
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;