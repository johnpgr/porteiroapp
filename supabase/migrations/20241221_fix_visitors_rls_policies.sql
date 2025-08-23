-- Verificar e configurar políticas RLS para tabela visitors

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "visitors_select_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_insert_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_update_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_delete_policy" ON visitors;

-- Criar políticas RLS para a tabela visitors
-- Política para SELECT: usuários autenticados podem ver todos os visitantes
CREATE POLICY "visitors_select_policy" ON visitors
    FOR SELECT
    TO authenticated
    USING (true);

-- Política para INSERT: usuários autenticados podem inserir visitantes
CREATE POLICY "visitors_insert_policy" ON visitors
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política para UPDATE: usuários autenticados podem atualizar visitantes
CREATE POLICY "visitors_update_policy" ON visitors
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política para DELETE: usuários autenticados podem deletar visitantes
CREATE POLICY "visitors_delete_policy" ON visitors
    FOR DELETE
    TO authenticated
    USING (true);

-- Garantir que RLS está habilitado
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Conceder permissões básicas para roles anon e authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO authenticated;

-- Verificar se as políticas foram criadas corretamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'visitors';