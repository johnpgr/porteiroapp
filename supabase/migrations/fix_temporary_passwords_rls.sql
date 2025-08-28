-- Criar políticas RLS para a tabela temporary_passwords

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "temporary_passwords_insert_policy" ON temporary_passwords;
DROP POLICY IF EXISTS "temporary_passwords_select_policy" ON temporary_passwords;
DROP POLICY IF EXISTS "temporary_passwords_update_policy" ON temporary_passwords;

-- Política para permitir inserção de senhas temporárias (para usuários autenticados)
CREATE POLICY "temporary_passwords_insert_policy" ON temporary_passwords
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política para permitir seleção de senhas temporárias (para usuários autenticados)
CREATE POLICY "temporary_passwords_select_policy" ON temporary_passwords
    FOR SELECT
    TO authenticated
    USING (true);

-- Política para permitir atualização de senhas temporárias (para usuários autenticados)
CREATE POLICY "temporary_passwords_update_policy" ON temporary_passwords
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Garantir permissões para roles anon e authenticated
GRANT SELECT, INSERT, UPDATE ON temporary_passwords TO authenticated;
GRANT SELECT ON temporary_passwords TO anon;

-- Verificar se as políticas foram criadas
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd 
FROM pg_policies 
WHERE tablename = 'temporary_passwords';