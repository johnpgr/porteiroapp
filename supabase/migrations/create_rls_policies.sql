-- Criar políticas RLS para a tabela visitor_logs
-- Permitir que usuários autenticados insiram registros
CREATE POLICY "Users can insert visitor logs" ON visitor_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Permitir que usuários autenticados vejam registros
CREATE POLICY "Users can view visitor logs" ON visitor_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Permitir que usuários autenticados atualizem registros
CREATE POLICY "Users can update visitor logs" ON visitor_logs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Verificar as políticas criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'visitor_logs';