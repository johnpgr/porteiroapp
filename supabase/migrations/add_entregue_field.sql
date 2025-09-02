-- Adicionar campo 'entregue' na tabela deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS entregue BOOLEAN DEFAULT FALSE;

-- Atualizar registros existentes baseado no status
UPDATE deliveries SET entregue = TRUE WHERE status = 'delivered';

-- Comentário para o campo
COMMENT ON COLUMN deliveries.entregue IS 'Indica se a entrega foi efetivamente entregue ao destinatário';

-- Garantir permissões para os roles
GRANT SELECT, UPDATE ON deliveries TO authenticated;
GRANT SELECT ON deliveries TO anon;