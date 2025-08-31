-- Migration para criar tabela de tokens de autorização de visitantes
-- Esta tabela armazena tokens temporários para autorização via WhatsApp

CREATE TABLE IF NOT EXISTS public.visitor_authorization_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  apartment_number TEXT NOT NULL,
  building_id UUID REFERENCES public.buildings(id),
  resident_phone TEXT NOT NULL,
  resident_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  action TEXT CHECK (action IN ('accept', 'reject')),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS visitor_authorization_tokens_token_idx ON public.visitor_authorization_tokens(token);
CREATE INDEX IF NOT EXISTS visitor_authorization_tokens_resident_phone_idx ON public.visitor_authorization_tokens(resident_phone);
CREATE INDEX IF NOT EXISTS visitor_authorization_tokens_expires_at_idx ON public.visitor_authorization_tokens(expires_at);
CREATE INDEX IF NOT EXISTS visitor_authorization_tokens_used_idx ON public.visitor_authorization_tokens(used);

-- RLS (Row Level Security)
ALTER TABLE public.visitor_authorization_tokens ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção de tokens
CREATE POLICY "Allow token creation" ON public.visitor_authorization_tokens
  FOR INSERT WITH CHECK (true);

-- Política para permitir leitura de tokens
CREATE POLICY "Allow token reading" ON public.visitor_authorization_tokens
  FOR SELECT USING (true);

-- Política para permitir atualização de tokens
CREATE POLICY "Allow token updates" ON public.visitor_authorization_tokens
  FOR UPDATE USING (true);

-- Conceder permissões para roles anon e authenticated
GRANT ALL PRIVILEGES ON public.visitor_authorization_tokens TO anon;
GRANT ALL PRIVILEGES ON public.visitor_authorization_tokens TO authenticated;

-- Comentários para documentação
COMMENT ON TABLE public.visitor_authorization_tokens IS 'Tokens temporários para autorização de visitantes via WhatsApp';
COMMENT ON COLUMN public.visitor_authorization_tokens.token IS 'Token único para autorização';
COMMENT ON COLUMN public.visitor_authorization_tokens.expires_at IS 'Data/hora de expiração do token';
COMMENT ON COLUMN public.visitor_authorization_tokens.action IS 'Ação tomada: accept ou reject';
COMMENT ON COLUMN public.visitor_authorization_tokens.processed_at IS 'Data/hora quando a resposta foi processada';