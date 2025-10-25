-- Adicionar campo delivery_code à tabela deliveries existente
-- Data: 2025-01-28

-- Adicionar coluna delivery_code se não existir
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(50) NULL;

-- Comentário para o campo
COMMENT ON COLUMN public.deliveries.delivery_code IS 'Código/palavra-chave fornecido pelo morador ao aceitar entrega';

-- Criar índice para delivery_code para facilitar buscas
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_code 
ON public.deliveries USING btree (delivery_code) TABLESPACE pg_default
WHERE (delivery_code IS NOT NULL);