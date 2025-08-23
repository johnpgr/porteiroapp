-- Adicionar coluna is_active à tabela visitors
-- Esta migração corrige o erro "column 'is_active' does not exist"

-- Adicionar a coluna is_active à tabela visitors
ALTER TABLE visitors 
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Atualizar todos os registros existentes para is_active = TRUE
UPDATE visitors 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Adicionar comentário à coluna
COMMENT ON COLUMN visitors.is_active IS 'Indica se o visitante está ativo no sistema';

-- Verificar se as políticas RLS estão funcionando corretamente
-- As políticas já criadas na migração anterior devem funcionar agora

-- Conceder permissões necessárias
GRANT SELECT, INSERT, UPDATE ON visitors TO authenticated;
GRANT SELECT, INSERT, UPDATE ON visitors TO anon;

-- Verificar se RLS está habilitado
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;