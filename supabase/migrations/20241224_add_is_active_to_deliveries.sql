-- Adicionar coluna is_active à tabela deliveries
-- Esta migração corrige o erro "column 'is_active' does not exist"

-- Adicionar a coluna is_active à tabela deliveries
ALTER TABLE deliveries 
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Atualizar todos os registros existentes para is_active = TRUE
UPDATE deliveries 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Adicionar comentário à coluna
COMMENT ON COLUMN deliveries.is_active IS 'Indica se a entrega está ativa no sistema';

-- Verificar se as políticas RLS estão funcionando corretamente
-- As políticas já criadas na migração anterior devem funcionar agora

-- Conceder permissões necessárias
GRANT SELECT, INSERT, UPDATE ON deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON deliveries TO anon;

-- Verificar se RLS está habilitado
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;