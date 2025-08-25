-- Migração para configurar políticas RLS adequadas para poll_votes
-- Garantir que apenas usuários autenticados possam votar

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view poll votes" ON poll_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON poll_votes;
DROP POLICY IF EXISTS "Authenticated users can view poll votes" ON poll_votes;
DROP POLICY IF EXISTS "Authenticated users can insert votes" ON poll_votes;
DROP POLICY IF EXISTS "Anonymous users can view poll votes" ON poll_votes;

-- Garantir que RLS está habilitado
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Política para leitura: apenas usuários autenticados podem ver votos
CREATE POLICY "Authenticated users can view poll votes" ON poll_votes
    FOR SELECT
    TO authenticated
    USING (true);

-- Política para inserção: apenas usuários autenticados podem votar
-- E apenas podem votar em nome próprio
CREATE POLICY "Authenticated users can insert their own votes" ON poll_votes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Política para atualização: usuários podem atualizar apenas seus próprios votos
CREATE POLICY "Users can update their own votes" ON poll_votes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política para exclusão: usuários podem excluir apenas seus próprios votos
CREATE POLICY "Users can delete their own votes" ON poll_votes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Revogar permissões do role anon para inserção
REVOKE INSERT ON poll_votes FROM anon;
REVOKE UPDATE ON poll_votes FROM anon;
REVOKE DELETE ON poll_votes FROM anon;

-- Manter apenas SELECT para anon (se necessário para visualização pública)
-- REVOKE SELECT ON poll_votes FROM anon; -- Descomente se quiser bloquear leitura anônima também

-- Comentários explicativos
COMMENT ON POLICY "Authenticated users can view poll votes" ON poll_votes IS 
'Permite que usuários autenticados vejam todos os votos';

COMMENT ON POLICY "Authenticated users can insert their own votes" ON poll_votes IS 
'Permite que usuários autenticados votem apenas em seu próprio nome';

COMMENT ON POLICY "Users can update their own votes" ON poll_votes IS 
'Permite que usuários atualizem apenas seus próprios votos';

COMMENT ON POLICY "Users can delete their own votes" ON poll_votes IS 
'Permite que usuários excluam apenas seus próprios votos';

-- Verificação final
DO $$
BEGIN
    RAISE NOTICE 'Políticas RLS para poll_votes configuradas com sucesso';
END $$;