-- Migração para Sistema de Push Notifications
-- Criação das tabelas: user_notification_tokens, notifications, notification_logs

-- Tabela de Tokens de Notificação-- Criar tabela user_notification_tokens
CREATE TABLE user_notification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_type VARCHAR(10) NOT NULL CHECK (device_type IN ('android', 'ios')),
    notification_token TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, notification_token)
);

-- Criar índices para user_notification_tokens
CREATE INDEX idx_user_notification_tokens_user_id ON user_notification_tokens(user_id);
CREATE INDEX idx_user_notification_tokens_active ON user_notification_tokens(is_active) WHERE is_active = true;
CREATE INDEX idx_user_notification_tokens_device_type ON user_notification_tokens(device_type);
CREATE INDEX idx_user_notification_tokens_updated ON user_notification_tokens(last_updated DESC);

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_notification_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualização automática
CREATE TRIGGER update_notification_token_timestamp_trigger
    BEFORE UPDATE ON user_notification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_token_timestamp();

-- Criar tabela notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Criar índices para notifications
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE status = 'pending';

-- Tabela de Logs de Notificação (notification_logs)
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    token_id UUID REFERENCES user_notification_tokens(id) ON DELETE SET NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'expired')),
    error_message TEXT,
    response_data JSONB,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices para notification_logs
CREATE INDEX idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_attempted_at ON notification_logs(attempted_at DESC);
CREATE INDEX idx_notification_logs_platform ON notification_logs(platform);

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para user_notification_tokens
CREATE POLICY "Users can manage their own tokens" ON user_notification_tokens
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Porteiros can view all tokens" ON user_notification_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type = 'porteiro'
        )
    );

-- Políticas para notifications
CREATE POLICY "Users can view their notifications" ON notifications
    FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Porteiros can create notifications" ON notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type = 'porteiro'
        )
    );

CREATE POLICY "Users can update their notification status" ON notifications
    FOR UPDATE USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Políticas para notification_logs
CREATE POLICY "System can manage logs" ON notification_logs
    FOR ALL USING (true);

-- Grants para roles
GRANT SELECT ON user_notification_tokens TO anon;
GRANT ALL PRIVILEGES ON user_notification_tokens TO authenticated;
GRANT SELECT ON notifications TO anon;
GRANT ALL PRIVILEGES ON notifications TO authenticated;
GRANT ALL PRIVILEGES ON notification_logs TO authenticated;

-- Dados Iniciais para Teste
-- Inserir tokens de teste (após ter usuários criados)
INSERT INTO user_notification_tokens (user_id, device_type, notification_token, device_info)
SELECT 
    p.id,
    'android',
    'test_token_android_' || p.id,
    '{"model": "Test Device", "os_version": "13"}'
FROM profiles p 
WHERE p.user_type = 'morador'
LIMIT 3;

INSERT INTO user_notification_tokens (user_id, device_type, notification_token, device_info)
SELECT 
    p.id,
    'ios',
    'test_token_ios_' || p.id,
    '{"model": "iPhone 14", "os_version": "16.0"}'
FROM profiles p 
WHERE p.user_type = 'morador'
LIMIT 2;

-- Inserir notificações de teste
INSERT INTO notifications (recipient_id, title, body, data, priority)
SELECT 
    p.id,
    'Visitante Aguardando',
    'João Silva está aguardando autorização para entrar.',
    '{"visitor_id": "123", "apartment": "101", "type": "visitor_approval"}',
    'high'
FROM profiles p 
WHERE p.user_type = 'morador'
LIMIT 1;