-- Migração para garantir que a coluna is_active existe na tabela deliveries
-- e tem as permissões corretas

-- Adicionar coluna is_active se não existir (será ignorado se já existir)
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Adicionar comentário na coluna
COMMENT ON COLUMN deliveries.is_active IS 'Indica se a entrega está ativa no sistema';

-- Garantir que as permissões estão corretas para a tabela deliveries
GRANT SELECT, INSERT, UPDATE ON deliveries TO authenticated;
GRANT SELECT ON deliveries TO anon;

-- Verificar se RLS está habilitado
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção de entregas por usuários autenticados
DROP POLICY IF EXISTS "Users can insert deliveries" ON deliveries;
CREATE POLICY "Users can insert deliveries" ON deliveries
    FOR INSERT WITH CHECK (true);

-- Política para permitir leitura de entregas por usuários autenticados
DROP POLICY IF EXISTS "Users can view deliveries" ON deliveries;
CREATE POLICY "Users can view deliveries" ON deliveries
    FOR SELECT USING (true);

-- Política para permitir atualização de entregas por usuários autenticados
DROP POLICY IF EXISTS "Users can update deliveries" ON deliveries;
CREATE POLICY "Users can update deliveries" ON deliveries
    FOR UPDATE USING (true);