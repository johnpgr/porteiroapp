-- Adicionar campo para controlar liberação direta de visitantes
-- Data: 2025-01-16

-- Adicionar coluna allow_direct_access na tabela visitors
ALTER TABLE public.visitors
ADD COLUMN IF NOT EXISTS allow_direct_access BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.visitors.allow_direct_access IS 'Indica se o visitante pode subir direto sem avisar o morador (liberação direta)';

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_visitors_direct_access
ON public.visitors(allow_direct_access)
WHERE allow_direct_access = true;
