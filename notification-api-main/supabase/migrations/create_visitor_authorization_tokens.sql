-- Criar tabela para tokens de autorização de visitantes
CREATE TABLE visitor_authorization_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_log_id UUID REFERENCES visitor_logs(id) ON DELETE CASCADE,
  visitor_name VARCHAR(255) NOT NULL,
  resident_phone VARCHAR(20) NOT NULL,
  resident_name VARCHAR(255) NOT NULL,
  apartment_number VARCHAR(10) NOT NULL,
  building VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX idx_visitor_authorization_tokens_visitor_log_id ON visitor_authorization_tokens(visitor_log_id);
CREATE INDEX idx_visitor_authorization_tokens_resident_phone ON visitor_authorization_tokens(resident_phone);
CREATE INDEX idx_visitor_authorization_tokens_expires_at ON visitor_authorization_tokens(expires_at);
CREATE INDEX idx_visitor_authorization_tokens_used ON visitor_authorization_tokens(used);

-- Habilitar RLS (Row Level Security)
ALTER TABLE visitor_authorization_tokens ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura e escrita para usuários autenticados
CREATE POLICY "Allow authenticated users to manage visitor authorization tokens" ON visitor_authorization_tokens
  FOR ALL USING (auth.role() = 'authenticated');

-- Política para permitir leitura para usuários anônimos (necessário para webhook)
CREATE POLICY "Allow anonymous users to read visitor authorization tokens" ON visitor_authorization_tokens
  FOR SELECT USING (auth.role() = 'anon');

-- Política para permitir escrita para usuários anônimos (necessário para webhook)
CREATE POLICY "Allow anonymous users to update visitor authorization tokens" ON visitor_authorization_tokens
  FOR UPDATE USING (auth.role() = 'anon');

-- Conceder permissões para as roles
GRANT ALL PRIVILEGES ON visitor_authorization_tokens TO authenticated;
GRANT SELECT, UPDATE ON visitor_authorization_tokens TO anon;
GRANT INSERT ON visitor_authorization_tokens TO authenticated;
GRANT INSERT ON visitor_authorization_tokens TO anon;

-- Função para limpar tokens expirados automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_visitor_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM visitor_authorization_tokens 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE visitor_authorization_tokens IS 'Tabela para armazenar tokens de autorização de visitantes para sistema de botões interativos';
COMMENT ON COLUMN visitor_authorization_tokens.visitor_log_id IS 'Referência ao log de visitante';
COMMENT ON COLUMN visitor_authorization_tokens.expires_at IS 'Data e hora de expiração do token';
COMMENT ON COLUMN visitor_authorization_tokens.used IS 'Indica se o token já foi utilizado';