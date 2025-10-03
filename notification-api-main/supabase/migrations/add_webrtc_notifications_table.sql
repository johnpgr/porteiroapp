-- Criar tabela para registrar notificações WebRTC enviadas
CREATE TABLE IF NOT EXISTS webrtc_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES webrtc_calls(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'incoming_call',
        'missed_call', 
        'webrtc_activated',
        'call_quality_issue',
        'system_maintenance',
        'system'
    )),
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'fcm', 'email', 'sms')),
    success BOOLEAN NOT NULL DEFAULT false,
    message_id TEXT,
    error_message TEXT,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_webrtc_notifications_user_id ON webrtc_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_notifications_call_id ON webrtc_notifications(call_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_notifications_type ON webrtc_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_webrtc_notifications_created_at ON webrtc_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_webrtc_notifications_success ON webrtc_notifications(success);

-- Adicionar campo phone na tabela webrtc_users se não existir
ALTER TABLE webrtc_users 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Índice para o campo phone
CREATE INDEX IF NOT EXISTS idx_webrtc_users_phone ON webrtc_users(phone);

-- Habilitar RLS na tabela de notificações
ALTER TABLE webrtc_notifications ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas suas próprias notificações
CREATE POLICY "Users can view their own notifications" ON webrtc_notifications
    FOR SELECT USING (auth.uid()::text = user_id);

-- Política para permitir inserção de notificações (service role)
CREATE POLICY "Service can insert notifications" ON webrtc_notifications
    FOR INSERT WITH CHECK (true);

-- Política para permitir atualização de notificações (service role)
CREATE POLICY "Service can update notifications" ON webrtc_notifications
    FOR UPDATE USING (true);

-- Conceder permissões para as roles
GRANT ALL PRIVILEGES ON webrtc_notifications TO authenticated;
GRANT ALL PRIVILEGES ON webrtc_notifications TO anon;
GRANT ALL PRIVILEGES ON webrtc_notifications TO service_role;

-- Comentários para documentação
COMMENT ON TABLE webrtc_notifications IS 'Registro de notificações WebRTC enviadas aos usuários';
COMMENT ON COLUMN webrtc_notifications.call_id IS 'ID da chamada relacionada (opcional)';
COMMENT ON COLUMN webrtc_notifications.user_id IS 'ID do usuário que recebeu a notificação';
COMMENT ON COLUMN webrtc_notifications.notification_type IS 'Tipo da notificação enviada';
COMMENT ON COLUMN webrtc_notifications.channel IS 'Canal usado para enviar a notificação';
COMMENT ON COLUMN webrtc_notifications.success IS 'Se a notificação foi enviada com sucesso';
COMMENT ON COLUMN webrtc_notifications.message_id IS 'ID da mensagem no canal (ex: WhatsApp message ID)';
COMMENT ON COLUMN webrtc_notifications.error_message IS 'Mensagem de erro se o envio falhou';
COMMENT ON COLUMN webrtc_notifications.data IS 'Dados adicionais da notificação em formato JSON';