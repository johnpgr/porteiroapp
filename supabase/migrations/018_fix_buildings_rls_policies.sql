-- Verificar e corrigir políticas RLS para tabela buildings
-- Permitir que administradores autenticados possam inserir, atualizar e deletar prédios

-- Primeiro, vamos ver as políticas atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'buildings';

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "buildings_select_policy" ON buildings;
DROP POLICY IF EXISTS "buildings_insert_policy" ON buildings;
DROP POLICY IF EXISTS "buildings_update_policy" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_policy" ON buildings;

-- Criar políticas RLS para a tabela buildings
-- Permitir SELECT para usuários autenticados (admin, porteiro, morador)
CREATE POLICY "buildings_select_policy" ON buildings
    FOR SELECT
    TO authenticated
    USING (true);

-- Permitir INSERT apenas para administradores
CREATE POLICY "buildings_insert_policy" ON buildings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.user_id = auth.uid()
        )
    );

-- Permitir UPDATE apenas para administradores
CREATE POLICY "buildings_update_policy" ON buildings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.user_id = auth.uid()
        )
    );

-- Permitir DELETE apenas para administradores
CREATE POLICY "buildings_delete_policy" ON buildings
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles ap
            WHERE ap.user_id = auth.uid()
        )
    );

-- Verificar se as políticas foram criadas corretamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'buildings'
ORDER BY policyname;

-- Testar as permissões
SELECT 'Políticas RLS para buildings configuradas com sucesso!' as status;