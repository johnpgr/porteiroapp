-- Criar políticas RLS para a tabela visitors
-- Permitir que usuários anônimos e autenticados possam inserir, selecionar, atualizar e deletar visitantes

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Enable read access for all users" ON visitors;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON visitors;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON visitors;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON visitors;

-- Política para permitir leitura para todos (anon e authenticated)
CREATE POLICY "Enable read access for all users" ON visitors
    FOR SELECT USING (true);

-- Política para permitir inserção para usuários anônimos e autenticados
CREATE POLICY "Enable insert for all users" ON visitors
    FOR INSERT WITH CHECK (true);

-- Política para permitir atualização para usuários anônimos e autenticados
CREATE POLICY "Enable update for all users" ON visitors
    FOR UPDATE USING (true) WITH CHECK (true);

-- Política para permitir exclusão para usuários anônimos e autenticados
CREATE POLICY "Enable delete for all users" ON visitors
    FOR DELETE USING (true);

-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'visitors';