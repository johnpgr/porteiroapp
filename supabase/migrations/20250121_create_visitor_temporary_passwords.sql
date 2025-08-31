-- Migração para criar tabela específica de senhas temporárias para visitantes
-- Esta tabela é independente e não possui restrições de chave estrangeira

CREATE TABLE IF NOT EXISTS visitor_temporary_passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_name TEXT NOT NULL,
    visitor_phone TEXT NOT NULL,
    plain_password TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + '7 days'::interval),
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active'
);

-- Comentários para documentar a tabela
COMMENT ON TABLE visitor_temporary_passwords IS 'Tabela específica para armazenar senhas temporárias de visitantes. Independente de outras tabelas.';
COMMENT ON COLUMN visitor_temporary_passwords.id IS 'Identificador único da senha temporária';
COMMENT ON COLUMN visitor_temporary_passwords.visitor_name IS 'Nome do visitante';
COMMENT ON COLUMN visitor_temporary_passwords.visitor_phone IS 'Número de telefone do visitante';
COMMENT ON COLUMN visitor_temporary_passwords.plain_password IS 'Senha em texto plano para envio via WhatsApp';
COMMENT ON COLUMN visitor_temporary_passwords.hashed_password IS 'Senha criptografada para validação';
COMMENT ON COLUMN visitor_temporary_passwords.created_at IS 'Data e hora de criação da senha';
COMMENT ON COLUMN visitor_temporary_passwords.expires_at IS 'Data e hora de expiração da senha (padrão 7 dias)';
COMMENT ON COLUMN visitor_temporary_passwords.used IS 'Indica se a senha já foi utilizada';
COMMENT ON COLUMN visitor_temporary_passwords.used_at IS 'Data e hora em que a senha foi utilizada';
COMMENT ON COLUMN visitor_temporary_passwords.status IS 'Status da senha (active, expired, used, cancelled)';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_visitor_temp_passwords_phone 
ON visitor_temporary_passwords(visitor_phone);

CREATE INDEX IF NOT EXISTS idx_visitor_temp_passwords_status 
ON visitor_temporary_passwords(status);

CREATE INDEX IF NOT EXISTS idx_visitor_temp_passwords_expires_at 
ON visitor_temporary_passwords(expires_at);

CREATE INDEX IF NOT EXISTS idx_visitor_temp_passwords_used 
ON visitor_temporary_passwords(used, status);

-- Habilita RLS (Row Level Security) para a tabela
ALTER TABLE visitor_temporary_passwords ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso aos usuários anônimos (para visitantes)
CREATE POLICY "Allow anonymous access to visitor passwords" 
ON visitor_temporary_passwords 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- Política para permitir acesso aos usuários autenticados
CREATE POLICY "Allow authenticated access to visitor passwords" 
ON visitor_temporary_passwords 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Concede permissões para os roles anon e authenticated
GRANT ALL PRIVILEGES ON visitor_temporary_passwords TO anon;
GRANT ALL PRIVILEGES ON visitor_temporary_passwords TO authenticated;