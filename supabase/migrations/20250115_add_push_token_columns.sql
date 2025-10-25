-- Adiciona coluna push_token para notificações push
-- Data: 2025-01-15

-- Adicionar push_token na tabela profiles (porteiros e moradores)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Adicionar push_token na tabela admin_profiles
ALTER TABLE public.admin_profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Criar índices para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
ON public.profiles(push_token)
WHERE push_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_profiles_push_token
ON public.admin_profiles(push_token)
WHERE push_token IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN public.profiles.push_token IS 'Expo push token para notificações push';
COMMENT ON COLUMN public.admin_profiles.push_token IS 'Expo push token para notificações push';
