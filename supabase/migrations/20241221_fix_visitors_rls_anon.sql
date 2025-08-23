-- Corrigir políticas RLS para permitir inserção de visitantes
-- Esta migração permite que usuários anônimos e autenticados insiram visitantes

-- Remover políticas existentes que podem estar causando conflito
DROP POLICY IF EXISTS "visitors_insert_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_select_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_update_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_delete_policy" ON visitors;

-- Política para permitir SELECT para todos os usuários autenticados
CREATE POLICY "visitors_select_policy" ON visitors
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Política para permitir INSERT para todos os usuários autenticados e anônimos
CREATE POLICY "visitors_insert_policy" ON visitors
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

-- Política para permitir UPDATE apenas para administradores e porteiros
CREATE POLICY "visitors_update_policy" ON visitors
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'porteiro')
        )
        OR
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'porteiro')
        )
        OR
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );

-- Política para permitir DELETE apenas para administradores
CREATE POLICY "visitors_delete_policy" ON visitors
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );

-- Garantir que RLS está habilitado
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Conceder permissões necessárias
GRANT SELECT, INSERT ON visitors TO anon;
GRANT ALL PRIVILEGES ON visitors TO authenticated;