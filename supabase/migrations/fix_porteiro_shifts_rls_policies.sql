-- Verificar políticas RLS existentes para porteiro_shifts
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'porteiro_shifts';

-- Remover políticas existentes se houver conflito
DROP POLICY IF EXISTS "Porteiros podem gerenciar seus próprios turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Porteiros podem ver turnos do seu prédio" ON porteiro_shifts;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON porteiro_shifts;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON porteiro_shifts;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON porteiro_shifts;

-- Criar políticas RLS mais permissivas para testes
-- Política para SELECT (leitura)
CREATE POLICY "Allow authenticated users to read shifts" ON porteiro_shifts
    FOR SELECT
    TO authenticated
    USING (true);

-- Política para INSERT (criação)
CREATE POLICY "Allow authenticated users to create shifts" ON porteiro_shifts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política para UPDATE (atualização)
CREATE POLICY "Allow authenticated users to update shifts" ON porteiro_shifts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política para DELETE (exclusão)
CREATE POLICY "Allow authenticated users to delete shifts" ON porteiro_shifts
    FOR DELETE
    TO authenticated
    USING (true);

-- Verificar políticas após criação
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'porteiro_shifts';