-- Criar tabela authorization_tokens para sistema de notificações via API
CREATE TABLE IF NOT EXISTS authorization_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_log_id UUID NOT NULL REFERENCES visitor_logs(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    visitor_name VARCHAR(255) NOT NULL,
    resident_phone VARCHAR(20) NOT NULL,
    resident_name VARCHAR(255) NOT NULL,
    building VARCHAR(100),
    apartment VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    response VARCHAR(20) CHECK (response IN ('approved', 'rejected')),
    response_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_authorization_tokens_token ON authorization_tokens(token);
CREATE INDEX IF NOT EXISTS idx_authorization_tokens_visitor_log_id ON authorization_tokens(visitor_log_id);
CREATE INDEX IF NOT EXISTS idx_authorization_tokens_expires_at ON authorization_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_authorization_tokens_created_at ON authorization_tokens(created_at);

-- Adicionar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_authorization_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_authorization_tokens_updated_at
    BEFORE UPDATE ON authorization_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_authorization_tokens_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE authorization_tokens ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para authorization_tokens
-- Permitir que usuários autenticados vejam apenas seus próprios tokens
CREATE POLICY "Users can view their own authorization tokens" ON authorization_tokens
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            -- Permitir acesso se o usuário é o morador do token
            resident_phone IN (
                SELECT phone FROM profiles WHERE user_id = auth.uid()
            )
            OR
            -- Permitir acesso se o usuário é porteiro ou admin
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE user_id = auth.uid() 
                AND role IN ('doorkeeper', 'admin')
            )
        )
    );

-- Permitir que porteiros e admins insiram tokens
CREATE POLICY "Doorkeepers and admins can insert authorization tokens" ON authorization_tokens
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('doorkeeper', 'admin')
        )
    );

-- Permitir que moradores atualizem seus próprios tokens (para responder)
CREATE POLICY "Residents can update their own authorization tokens" ON authorization_tokens
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        resident_phone IN (
            SELECT phone FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Permitir que porteiros e admins atualizem tokens
CREATE POLICY "Doorkeepers and admins can update authorization tokens" ON authorization_tokens
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('doorkeeper', 'admin')
        )
    );

-- Conceder permissões básicas para roles anon e authenticated
GRANT SELECT, INSERT, UPDATE ON authorization_tokens TO authenticated;
GRANT SELECT ON authorization_tokens TO anon;

-- Adicionar comentários para documentação
COMMENT ON TABLE authorization_tokens IS 'Tabela para armazenar tokens de autorização de visitantes via API';
COMMENT ON COLUMN authorization_tokens.visitor_log_id IS 'Referência ao log do visitante';
COMMENT ON COLUMN authorization_tokens.token IS 'Token JWT único para autorização';
COMMENT ON COLUMN authorization_tokens.expires_at IS 'Data/hora de expiração do token (30 minutos)';
COMMENT ON COLUMN authorization_tokens.response IS 'Resposta do morador: approved ou rejected';
COMMENT ON COLUMN authorization_tokens.used_at IS 'Data/hora em que o token foi usado';
COMMENT ON COLUMN authorization_tokens.response_at IS 'Data/hora da resposta do morador';